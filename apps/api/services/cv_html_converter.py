"""Faithful DOCX → HTML converter using python-docx.

Produces HTML with inline styles that preserve the original document's
visual appearance: fonts, sizes, colors, bold/italic/underline,
alignment, images (base64-embedded), tables, and list structure.
"""

import base64
import html as _html
import re
import zipfile
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET

_NSMAP = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "v": "urn:schemas-microsoft-com:vml",
}

# Mime types for common image extensions
_IMAGE_MIMES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".emf": "image/x-emf",
    ".wmf": "image/x-wmf",
}


def convert_docx_to_html(filepath: Path) -> Optional[str]:
    """Convert a DOCX file to styled HTML preserving visual formatting."""
    try:
        return _DocxHtmlConverter(filepath).convert()
    except Exception:
        return None


class _DocxHtmlConverter:
    """Walks the DOCX XML tree and emits styled HTML."""

    def __init__(self, filepath: Path):
        self.filepath = filepath
        self.archive: Optional[zipfile.ZipFile] = None
        self.rels: dict[str, str] = {}  # rId -> target path
        self.images: dict[str, str] = {}  # target path -> base64 data URI
        self.default_font = "Calibri, Arial, sans-serif"
        self.default_size_pt = 11
        self.numbering_map: dict[str, list[dict]] = {}  # numId -> list of level defs
        self.style_map: dict[str, dict] = {}  # styleId -> style properties
        self.theme_colors: dict[str, str] = {}  # theme color name -> hex (#RRGGBB)
        self.theme_major_font = ""  # heading font from theme
        self.theme_minor_font = ""  # body font from theme
        self.html_parts: list[str] = []

    def convert(self) -> Optional[str]:
        with zipfile.ZipFile(self.filepath) as archive:
            self.archive = archive
            self._load_relationships()
            self._load_images()
            self._load_numbering()
            self._load_styles()
            self._load_theme_defaults()
            body_xml = self._get_body()
            if body_xml is None:
                return None
            self._process_body(body_xml)

        html = "".join(self.html_parts)
        return html if html.strip() else None

    # ── Relationship & resource loading ──────────────────────────────

    def _load_relationships(self):
        """Load word/_rels/document.xml.rels to map rId to target paths."""
        rels_path = "word/_rels/document.xml.rels"
        try:
            xml_bytes = self.archive.read(rels_path)
        except KeyError:
            return
        root = ET.fromstring(xml_bytes)
        ns = _NSMAP["rel"]
        for rel in root.findall(f"{{{ns}}}Relationship"):
            rid = rel.get("Id", "")
            target = rel.get("Target", "")
            if rid and target:
                self.rels[rid] = target

    def _load_images(self):
        """Read all image files from the archive and encode as base64 data URIs."""
        for name in self.archive.namelist():
            if not name.startswith("word/media/"):
                continue
            ext = Path(name).suffix.lower()
            mime = _IMAGE_MIMES.get(ext, "application/octet-stream")
            try:
                img_bytes = self.archive.read(name)
                b64 = base64.b64encode(img_bytes).decode("ascii")
                # Store keyed by relative path from word/
                rel_path = name[len("word/"):]
                self.images[rel_path] = f"data:{mime};base64,{b64}"
            except Exception:
                pass

    def _load_numbering(self):
        """Parse word/numbering.xml to understand list formats."""
        try:
            xml_bytes = self.archive.read("word/numbering.xml")
        except KeyError:
            return
        root = ET.fromstring(xml_bytes)
        w = _NSMAP["w"]

        # Build abstract numbering defs
        abstract_map: dict[str, list[dict]] = {}
        for abstract in root.findall(f"{{{w}}}abstractNum"):
            abs_id = abstract.get(f"{{{w}}}abstractNumId", "")
            levels = []
            for lvl in abstract.findall(f"{{{w}}}lvl"):
                lvl_num = int(lvl.get(f"{{{w}}}ilvl", "0"))
                fmt_el = lvl.find(f"{{{w}}}numFmt")
                fmt = fmt_el.get(f"{{{w}}}val", "bullet") if fmt_el is not None else "bullet"
                levels.append({"ilvl": lvl_num, "numFmt": fmt})
            levels.sort(key=lambda x: x["ilvl"])
            abstract_map[abs_id] = levels

        # Map numId → abstract
        for num in root.findall(f"{{{w}}}num"):
            num_id = num.get(f"{{{w}}}numId", "")
            abs_ref = num.find(f"{{{w}}}abstractNumId")
            if abs_ref is not None:
                abs_id = abs_ref.get(f"{{{w}}}val", "")
                if abs_id in abstract_map:
                    self.numbering_map[num_id] = abstract_map[abs_id]

    def _load_styles(self):
        """Parse word/styles.xml to get default and named style properties."""
        try:
            xml_bytes = self.archive.read("word/styles.xml")
        except KeyError:
            return
        root = ET.fromstring(xml_bytes)
        w = _NSMAP["w"]

        # Document defaults
        doc_defaults = root.find(f"{{{w}}}docDefaults")
        if doc_defaults is not None:
            rpr_default = doc_defaults.find(f".//{{{w}}}rPrDefault/{{{w}}}rPr")
            if rpr_default is not None:
                font = self._extract_font_from_rpr(rpr_default)
                if font:
                    self.default_font = font
                size = self._extract_size_from_rpr(rpr_default)
                if size:
                    self.default_size_pt = size

        # Named styles
        for style_el in root.findall(f"{{{w}}}style"):
            style_id = style_el.get(f"{{{w}}}styleId", "")
            if not style_id:
                continue
            props: dict = {}

            # Paragraph properties
            ppr = style_el.find(f"{{{w}}}pPr")
            if ppr is not None:
                props["pPr"] = self._extract_paragraph_props(ppr)

            # Run properties
            rpr = style_el.find(f"{{{w}}}rPr")
            if rpr is not None:
                props["rPr"] = self._extract_run_props_from_xml(rpr)

            # Based-on (style inheritance)
            based_on = style_el.find(f"{{{w}}}basedOn")
            if based_on is not None:
                props["basedOn"] = based_on.get(f"{{{w}}}val", "")

            self.style_map[style_id] = props

    def _load_theme_defaults(self):
        """Extract theme colors and fonts from word/theme/theme1.xml."""
        try:
            xml_bytes = self.archive.read("word/theme/theme1.xml")
        except KeyError:
            return
        root = ET.fromstring(xml_bytes)
        a = _NSMAP["a"]

        # ── Theme colors ──
        # The color scheme lives under a:themeElements/a:clrScheme
        clr_scheme = root.find(f".//{{{a}}}clrScheme")
        if clr_scheme is not None:
            for child in clr_scheme:
                tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                # Each child is like <a:dk1>, <a:lt1>, <a:accent1>, etc.
                # Inside is either <a:sysClr lastClr="..."/> or <a:srgbClr val="..."/>
                srgb = child.find(f"{{{a}}}srgbClr")
                sys_clr = child.find(f"{{{a}}}sysClr")
                hex_val = ""
                if srgb is not None:
                    hex_val = srgb.get("val", "")
                elif sys_clr is not None:
                    hex_val = sys_clr.get("lastClr", "") or sys_clr.get("val", "")
                if hex_val:
                    self.theme_colors[tag] = f"#{hex_val}"

        # Map OOXML themeColor attribute names to theme XML element names
        # dk1/dk2/lt1/lt2 map to dark1/dark2/light1/light2 in w:themeColor
        _THEME_ALIASES = {
            "dark1": "dk1", "dark2": "dk2",
            "light1": "lt1", "light2": "lt2",
            "accent1": "accent1", "accent2": "accent2",
            "accent3": "accent3", "accent4": "accent4",
            "accent5": "accent5", "accent6": "accent6",
            "hyperlink": "hlink", "followedHyperlink": "folHlink",
        }
        # Add aliased names so lookup works with w:themeColor values
        for alias, xml_name in _THEME_ALIASES.items():
            if xml_name in self.theme_colors and alias not in self.theme_colors:
                self.theme_colors[alias] = self.theme_colors[xml_name]

        # ── Theme fonts ──
        major = root.find(f".//{{{a}}}majorFont/{{{a}}}latin")
        minor = root.find(f".//{{{a}}}minorFont/{{{a}}}latin")
        if major is not None:
            self.theme_major_font = major.get("typeface", "")
        if minor is not None:
            self.theme_minor_font = minor.get("typeface", "")
            if self.theme_minor_font:
                self.default_font = f"'{self.theme_minor_font}', {self.default_font}"

    # ── XML parsing helpers ──────────────────────────────────────────

    def _get_body(self) -> Optional[ET.Element]:
        try:
            xml_bytes = self.archive.read("word/document.xml")
        except KeyError:
            return None
        root = ET.fromstring(xml_bytes)
        w = _NSMAP["w"]
        return root.find(f"{{{w}}}body")

    def _extract_font_from_rpr(self, rpr: ET.Element) -> Optional[str]:
        w = _NSMAP["w"]
        fonts = rpr.find(f"{{{w}}}rFonts")
        if fonts is not None:
            # Direct font name
            for attr in ["ascii", "hAnsi", "cs", "eastAsia"]:
                val = fonts.get(f"{{{w}}}{attr}")
                if val:
                    return f"'{val}'"
            # Theme font reference (asciiTheme, hAnsiTheme, etc.)
            for attr in ["asciiTheme", "hAnsiTheme", "cstheme", "eastAsiaTheme"]:
                val = fonts.get(f"{{{w}}}{attr}", "")
                if val:
                    resolved = self._resolve_theme_font(val)
                    if resolved:
                        return f"'{resolved}'"
        return None

    def _resolve_theme_font(self, theme_ref: str) -> str:
        """Resolve a theme font reference like 'majorHAnsi' or 'minorBidi'."""
        lower = theme_ref.lower()
        if "major" in lower:
            return self.theme_major_font or ""
        if "minor" in lower:
            return self.theme_minor_font or ""
        return ""

    def _extract_size_from_rpr(self, rpr: ET.Element) -> Optional[float]:
        w = _NSMAP["w"]
        sz = rpr.find(f"{{{w}}}sz")
        if sz is not None:
            val = sz.get(f"{{{w}}}val")
            if val:
                return float(val) / 2  # half-points to points
        return None

    def _extract_paragraph_props(self, ppr: ET.Element) -> dict:
        w = _NSMAP["w"]
        props: dict = {}

        jc = ppr.find(f"{{{w}}}jc")
        if jc is not None:
            props["align"] = jc.get(f"{{{w}}}val", "")

        spacing = ppr.find(f"{{{w}}}spacing")
        if spacing is not None:
            before = spacing.get(f"{{{w}}}before")
            after = spacing.get(f"{{{w}}}after")
            line = spacing.get(f"{{{w}}}line")
            if before:
                props["spacingBefore"] = int(before)
            if after:
                props["spacingAfter"] = int(after)
            if line:
                props["lineSpacing"] = int(line)

        ind = ppr.find(f"{{{w}}}ind")
        if ind is not None:
            left = ind.get(f"{{{w}}}left")
            right = ind.get(f"{{{w}}}right")
            if left:
                props["indentLeft"] = int(left)
            if right:
                props["indentRight"] = int(right)

        # Numbering (list) properties
        num_pr = ppr.find(f"{{{w}}}numPr")
        if num_pr is not None:
            ilvl_el = num_pr.find(f"{{{w}}}ilvl")
            num_id_el = num_pr.find(f"{{{w}}}numId")
            if num_id_el is not None:
                props["numId"] = num_id_el.get(f"{{{w}}}val", "")
            if ilvl_el is not None:
                props["ilvl"] = int(ilvl_el.get(f"{{{w}}}val", "0"))

        # Outline level (heading detection)
        outline_lvl = ppr.find(f"{{{w}}}outlineLvl")
        if outline_lvl is not None:
            props["outlineLvl"] = int(outline_lvl.get(f"{{{w}}}val", "9"))

        # Borders
        pBdr = ppr.find(f"{{{w}}}pBdr")
        if pBdr is not None:
            props["hasBorder"] = True
            bottom = pBdr.find(f"{{{w}}}bottom")
            if bottom is not None:
                props["borderBottom"] = True

        return props

    def _extract_run_props_from_xml(self, rpr: ET.Element) -> dict:
        w = _NSMAP["w"]
        props: dict = {}

        font = self._extract_font_from_rpr(rpr)
        if font:
            props["font"] = font

        size = self._extract_size_from_rpr(rpr)
        if size:
            props["size"] = size

        # Bold
        b = rpr.find(f"{{{w}}}b")
        if b is not None:
            val = b.get(f"{{{w}}}val", "true")
            props["bold"] = val != "false" and val != "0"

        # Italic
        i = rpr.find(f"{{{w}}}i")
        if i is not None:
            val = i.get(f"{{{w}}}val", "true")
            props["italic"] = val != "false" and val != "0"

        # Underline
        u = rpr.find(f"{{{w}}}u")
        if u is not None:
            val = u.get(f"{{{w}}}val", "single")
            props["underline"] = val != "none"

        # Strikethrough
        strike = rpr.find(f"{{{w}}}strike")
        if strike is not None:
            val = strike.get(f"{{{w}}}val", "true")
            props["strike"] = val != "false" and val != "0"

        # Color — direct hex or theme color
        color = rpr.find(f"{{{w}}}color")
        if color is not None:
            resolved = self._resolve_color(color)
            if resolved:
                props["color"] = resolved

        # Highlight / background
        highlight = rpr.find(f"{{{w}}}highlight")
        if highlight is not None:
            val = highlight.get(f"{{{w}}}val", "")
            if val and val != "none":
                props["highlight"] = val

        # Shading (direct fill or theme fill)
        shd = rpr.find(f"{{{w}}}shd")
        if shd is not None:
            fill = shd.get(f"{{{w}}}fill", "")
            theme_fill = shd.get(f"{{{w}}}themeFill", "")
            theme_fill_tint = shd.get(f"{{{w}}}themeFillTint", "")
            theme_fill_shade = shd.get(f"{{{w}}}themeFillShade", "")
            if fill and fill.lower() not in ("auto", "ffffff", ""):
                props["background"] = f"#{fill}"
            elif theme_fill and self.theme_colors:
                base = self.theme_colors.get(theme_fill, "")
                if base:
                    props["background"] = self._apply_tint_shade(base, theme_fill_tint, theme_fill_shade) if (theme_fill_tint or theme_fill_shade) else base

        # Vertical alignment (superscript/subscript)
        vert_align = rpr.find(f"{{{w}}}vertAlign")
        if vert_align is not None:
            props["vertAlign"] = vert_align.get(f"{{{w}}}val", "")

        # All caps / small caps
        caps = rpr.find(f"{{{w}}}caps")
        if caps is not None:
            val = caps.get(f"{{{w}}}val", "true")
            props["caps"] = val != "false" and val != "0"

        small_caps = rpr.find(f"{{{w}}}smallCaps")
        if small_caps is not None:
            val = small_caps.get(f"{{{w}}}val", "true")
            props["smallCaps"] = val != "false" and val != "0"

        # Letter spacing
        spacing_el = rpr.find(f"{{{w}}}spacing")
        if spacing_el is not None:
            val = spacing_el.get(f"{{{w}}}val")
            if val:
                props["letterSpacing"] = int(val)

        return props

    def _resolve_style_rpr(self, style_id: str) -> dict:
        """Resolve run properties from a style, following basedOn chain."""
        visited: set[str] = set()
        merged: dict = {}
        current = style_id
        while current and current not in visited:
            visited.add(current)
            style = self.style_map.get(current, {})
            rpr = style.get("rPr", {})
            # Properties from parent are lower priority
            merged = {**rpr, **merged}
            current = style.get("basedOn", "")
        return merged

    def _resolve_style_ppr(self, style_id: str) -> dict:
        """Resolve paragraph properties from a style, following basedOn chain."""
        visited: set[str] = set()
        merged: dict = {}
        current = style_id
        while current and current not in visited:
            visited.add(current)
            style = self.style_map.get(current, {})
            ppr = style.get("pPr", {})
            merged = {**ppr, **merged}
            current = style.get("basedOn", "")
        return merged

    # ── Body processing ──────────────────────────────────────────────

    def _process_body(self, body: ET.Element):
        w = _NSMAP["w"]
        # Collect all children and group list items
        children = list(body)
        i = 0
        while i < len(children):
            child = children[i]
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

            if tag == "p":
                # Check if this is a list item
                num_info = self._get_numbering_info(child)
                if num_info:
                    # Collect consecutive list items with same numId
                    list_items = [(child, num_info)]
                    j = i + 1
                    while j < len(children):
                        next_child = children[j]
                        next_tag = next_child.tag.split("}")[-1] if "}" in next_child.tag else next_child.tag
                        if next_tag != "p":
                            break
                        next_num = self._get_numbering_info(next_child)
                        if not next_num or next_num["numId"] != num_info["numId"]:
                            break
                        list_items.append((next_child, next_num))
                        j += 1
                    self._emit_list(list_items)
                    i = j
                    continue
                else:
                    self._emit_paragraph(child)
            elif tag == "tbl":
                self._emit_table(child)
            # Skip other elements (sectPr, etc.)
            i += 1

    def _get_numbering_info(self, para: ET.Element) -> Optional[dict]:
        w = _NSMAP["w"]
        ppr = para.find(f"{{{w}}}pPr")
        if ppr is None:
            return None

        num_pr = ppr.find(f"{{{w}}}numPr")
        if num_pr is None:
            # Check style for numbering
            style_el = ppr.find(f"{{{w}}}pStyle")
            if style_el is not None:
                style_id = style_el.get(f"{{{w}}}val", "")
                style_ppr = self._resolve_style_ppr(style_id)
                if "numId" in style_ppr:
                    return {"numId": style_ppr["numId"], "ilvl": style_ppr.get("ilvl", 0)}
            return None

        num_id_el = num_pr.find(f"{{{w}}}numId")
        if num_id_el is None:
            return None
        num_id = num_id_el.get(f"{{{w}}}val", "")
        if not num_id or num_id == "0":
            return None

        ilvl_el = num_pr.find(f"{{{w}}}ilvl")
        ilvl = int(ilvl_el.get(f"{{{w}}}val", "0")) if ilvl_el is not None else 0

        return {"numId": num_id, "ilvl": ilvl}

    def _is_ordered_list(self, num_id: str, ilvl: int) -> bool:
        levels = self.numbering_map.get(num_id, [])
        for lvl in levels:
            if lvl["ilvl"] == ilvl:
                return lvl["numFmt"] != "bullet"
        return False

    # ── Paragraph emission ───────────────────────────────────────────

    def _emit_paragraph(self, para: ET.Element):
        w = _NSMAP["w"]
        ppr = para.find(f"{{{w}}}pPr")

        # Determine if this is a heading
        tag = "p"
        style_id = ""
        ppr_props: dict = {}

        if ppr is not None:
            style_el = ppr.find(f"{{{w}}}pStyle")
            if style_el is not None:
                style_id = style_el.get(f"{{{w}}}val", "")
                # Heading detection
                heading_match = re.match(r"Heading(\d+)", style_id, re.IGNORECASE)
                if heading_match:
                    level = int(heading_match.group(1))
                    if 1 <= level <= 6:
                        tag = f"h{level}"
                elif style_id.lower() == "title":
                    tag = "h1"
                elif style_id.lower() == "subtitle":
                    tag = "h2"

            ppr_props = self._extract_paragraph_props(ppr)

        # Merge style-level paragraph props
        if style_id:
            style_ppr = self._resolve_style_ppr(style_id)
            ppr_props = {**style_ppr, **ppr_props}

        # Build paragraph style
        p_style = self._build_paragraph_style(ppr_props, tag)

        # Collect run content
        inner_html = self._collect_paragraph_content(para, style_id)

        # Skip truly empty paragraphs but keep spacing ones
        if not inner_html.strip():
            inner_html = "&nbsp;"

        style_attr = f' style="{p_style}"' if p_style else ""
        self.html_parts.append(f"<{tag}{style_attr}>{inner_html}</{tag}>")

    def _build_paragraph_style(self, props: dict, tag: str) -> str:
        parts: list[str] = []

        align = props.get("align", "")
        if align and align != "left":
            css_align = {"center": "center", "right": "right", "both": "justify", "distribute": "justify"}.get(align, "")
            if css_align:
                parts.append(f"text-align:{css_align}")

        # Spacing (twips → pt, 1 twip = 1/20 pt)
        before = props.get("spacingBefore")
        if before is not None:
            parts.append(f"margin-top:{before / 20:.1f}pt")

        after = props.get("spacingAfter")
        if after is not None:
            parts.append(f"margin-bottom:{after / 20:.1f}pt")
        elif tag == "p":
            parts.append("margin-bottom:0pt")

        line = props.get("lineSpacing")
        if line is not None:
            # line is in 240ths of a line; 240 = single, 480 = double
            ratio = line / 240
            parts.append(f"line-height:{ratio:.2f}")

        # Indentation (twips → pt)
        indent_left = props.get("indentLeft")
        if indent_left:
            parts.append(f"margin-left:{indent_left / 20:.1f}pt")

        indent_right = props.get("indentRight")
        if indent_right:
            parts.append(f"margin-right:{indent_right / 20:.1f}pt")

        # Bottom border
        if props.get("borderBottom"):
            parts.append("border-bottom:1px solid #000")
            parts.append("padding-bottom:2pt")

        return ";".join(parts)

    def _collect_paragraph_content(self, para: ET.Element, style_id: str = "") -> str:
        w = _NSMAP["w"]
        parts: list[str] = []

        for child in para:
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

            if tag == "r":
                parts.append(self._render_run(child, style_id))
            elif tag == "hyperlink":
                # Process runs inside hyperlink
                rid = child.get(f"{{{_NSMAP['r']}}}id", "")
                href = ""
                if rid and rid in self.rels:
                    href = self.rels[rid]
                link_parts = []
                for sub in child:
                    sub_tag = sub.tag.split("}")[-1] if "}" in sub.tag else sub.tag
                    if sub_tag == "r":
                        link_parts.append(self._render_run(sub, style_id))
                inner = "".join(link_parts)
                if href:
                    parts.append(f'<a href="{_html.escape(href)}" style="color:#0563C1;text-decoration:underline">{inner}</a>')
                else:
                    parts.append(inner)

        return "".join(parts)

    # ── Run (text span) rendering ────────────────────────────────────

    def _render_run(self, run: ET.Element, para_style_id: str = "") -> str:
        w = _NSMAP["w"]
        parts: list[str] = []

        # Extract run properties
        rpr = run.find(f"{{{w}}}rPr")
        run_props = self._extract_run_props_from_xml(rpr) if rpr is not None else {}

        # Merge style-level run properties (style is lower priority)
        if para_style_id:
            style_rpr = self._resolve_style_rpr(para_style_id)
            run_props = {**style_rpr, **run_props}

        # Also check for run-level style
        if rpr is not None:
            rStyle = rpr.find(f"{{{w}}}rStyle")
            if rStyle is not None:
                rs_id = rStyle.get(f"{{{w}}}val", "")
                if rs_id:
                    rs_props = self._resolve_style_rpr(rs_id)
                    run_props = {**rs_props, **run_props}

        # Collect text and other content
        for child in run:
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

            if tag == "t":
                text = child.text or ""
                parts.append(_html.escape(text))
            elif tag == "br":
                br_type = child.get(f"{{{w}}}type", "")
                if br_type == "page":
                    parts.append('<hr style="page-break-after:always;border:none">')
                else:
                    parts.append("<br>")
            elif tag == "tab":
                parts.append('<span style="white-space:pre">&#9;</span>')
            elif tag == "drawing":
                img_html = self._render_drawing(child)
                if img_html:
                    parts.append(img_html)
            elif tag == "pict":
                img_html = self._render_vml_picture(child)
                if img_html:
                    parts.append(img_html)

        content = "".join(parts)
        if not content:
            return ""

        # Build span style
        style = self._build_run_style(run_props)
        if style:
            return f'<span style="{style}">{content}</span>'
        return content

    def _build_run_style(self, props: dict) -> str:
        parts: list[str] = []

        font = props.get("font")
        if font:
            parts.append(f"font-family:{font}")

        size = props.get("size")
        if size and abs(size - self.default_size_pt) > 0.5:
            parts.append(f"font-size:{size:.1f}pt")

        if props.get("bold"):
            parts.append("font-weight:bold")

        if props.get("italic"):
            parts.append("font-style:italic")

        decorations = []
        if props.get("underline"):
            decorations.append("underline")
        if props.get("strike"):
            decorations.append("line-through")
        if decorations:
            parts.append(f"text-decoration:{' '.join(decorations)}")

        color = props.get("color")
        if color:
            parts.append(f"color:{color}")

        bg = props.get("background") or self._highlight_to_css(props.get("highlight", ""))
        if bg:
            parts.append(f"background-color:{bg}")

        vert = props.get("vertAlign")
        if vert == "superscript":
            parts.append("vertical-align:super;font-size:smaller")
        elif vert == "subscript":
            parts.append("vertical-align:sub;font-size:smaller")

        if props.get("caps"):
            parts.append("text-transform:uppercase")
        elif props.get("smallCaps"):
            parts.append("font-variant:small-caps")

        ls = props.get("letterSpacing")
        if ls:
            parts.append(f"letter-spacing:{ls / 20:.1f}pt")

        return ";".join(parts)

    @staticmethod
    def _highlight_to_css(val: str) -> str:
        if not val:
            return ""
        color_map = {
            "yellow": "#FFFF00", "green": "#00FF00", "cyan": "#00FFFF",
            "magenta": "#FF00FF", "blue": "#0000FF", "red": "#FF0000",
            "darkBlue": "#00008B", "darkCyan": "#008B8B", "darkGreen": "#006400",
            "darkMagenta": "#8B008B", "darkRed": "#8B0000", "darkYellow": "#808000",
            "darkGray": "#A9A9A9", "lightGray": "#D3D3D3", "black": "#000000",
            "white": "#FFFFFF",
        }
        return color_map.get(val, "")

    def _resolve_color(self, color_el: ET.Element) -> str:
        """Resolve a w:color element to a CSS hex color.

        Handles:
        - Direct hex values: <w:color w:val="FF0000"/>
        - Theme colors:      <w:color w:val="auto" w:themeColor="accent1"/>
        - Theme + tint/shade: <w:color w:themeColor="accent1" w:themeTint="BF"/>
        """
        w = _NSMAP["w"]
        val = color_el.get(f"{{{w}}}val", "")
        theme_color = color_el.get(f"{{{w}}}themeColor", "")
        theme_tint = color_el.get(f"{{{w}}}themeTint", "")
        theme_shade = color_el.get(f"{{{w}}}themeShade", "")

        # Direct hex value (not "auto")
        if val and val.lower() != "auto" and re.match(r"^[0-9A-Fa-f]{6}$", val):
            return f"#{val}"

        # Theme color lookup
        if theme_color and self.theme_colors:
            base = self.theme_colors.get(theme_color, "")
            if not base:
                return ""
            if not theme_tint and not theme_shade:
                return base
            # Apply tint or shade
            return self._apply_tint_shade(base, theme_tint, theme_shade)

        return ""

    @staticmethod
    def _apply_tint_shade(hex_color: str, tint: str, shade: str) -> str:
        """Apply OOXML tint or shade to a hex color.

        Tint moves toward white; shade moves toward black.
        The tint/shade value is a hex byte (00-FF) where FF = full effect.
        """
        hex_color = hex_color.lstrip("#")
        if len(hex_color) != 6:
            return f"#{hex_color}"
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)

        if tint:
            t = int(tint, 16) / 255.0
            r = int(r + (255 - r) * t)
            g = int(g + (255 - g) * t)
            b = int(b + (255 - b) * t)
        elif shade:
            s = int(shade, 16) / 255.0
            r = int(r * s)
            g = int(g * s)
            b = int(b * s)

        return f"#{min(r,255):02X}{min(g,255):02X}{min(b,255):02X}"

    # ── Image rendering ──────────────────────────────────────────────

    def _render_drawing(self, drawing: ET.Element) -> str:
        """Extract image from w:drawing element."""
        wp = _NSMAP["wp"]
        a = _NSMAP["a"]
        r = _NSMAP["r"]

        # Get dimensions from inline or anchor
        width_emu = None
        height_emu = None
        for inline_or_anchor in drawing:
            tag = inline_or_anchor.tag.split("}")[-1] if "}" in inline_or_anchor.tag else inline_or_anchor.tag
            if tag in ("inline", "anchor"):
                extent = inline_or_anchor.find(f"{{{wp}}}extent")
                if extent is not None:
                    cx = extent.get("cx")
                    cy = extent.get("cy")
                    if cx:
                        width_emu = int(cx)
                    if cy:
                        height_emu = int(cy)

        # Find the blip (image reference)
        blip = drawing.find(f".//{{{a}}}blip")
        if blip is None:
            return ""

        embed_rid = blip.get(f"{{{r}}}embed", "")
        if not embed_rid or embed_rid not in self.rels:
            return ""

        target = self.rels[embed_rid]
        # Normalize the target path
        if not target.startswith("media/"):
            target = "media/" + target.split("media/")[-1] if "media/" in target else target
        data_uri = self.images.get(target, "")
        if not data_uri:
            # Try without leading path
            for key, val in self.images.items():
                if key.endswith(target.split("/")[-1]):
                    data_uri = val
                    break

        if not data_uri:
            return ""

        style_parts = ["max-width:100%", "height:auto"]
        if width_emu:
            px = width_emu / 914400 * 96  # EMU to pixels
            style_parts.append(f"width:{px:.0f}px")
        if height_emu:
            px = height_emu / 914400 * 96
            style_parts.append(f"height:{px:.0f}px")

        style = ";".join(style_parts)
        return f'<img src="{data_uri}" style="{style}" />'

    def _render_vml_picture(self, pict: ET.Element) -> str:
        """Handle legacy VML images (w:pict > v:shape > v:imagedata)."""
        v = _NSMAP["v"]
        r = _NSMAP["r"]

        imagedata = pict.find(f".//{{{v}}}imagedata")
        if imagedata is None:
            return ""

        rid = imagedata.get(f"{{{r}}}id", "")
        if not rid or rid not in self.rels:
            return ""

        target = self.rels[rid]
        if not target.startswith("media/"):
            target = "media/" + target.split("media/")[-1] if "media/" in target else target
        data_uri = self.images.get(target, "")
        if not data_uri:
            for key, val in self.images.items():
                if key.endswith(target.split("/")[-1]):
                    data_uri = val
                    break
        if not data_uri:
            return ""

        # Try to get dimensions from v:shape style
        shape = pict.find(f".//{{{v}}}shape")
        style = ""
        if shape is not None:
            vml_style = shape.get("style", "")
            width_match = re.search(r"width:\s*([\d.]+)(pt|px|in)", vml_style)
            height_match = re.search(r"height:\s*([\d.]+)(pt|px|in)", vml_style)
            parts = ["max-width:100%"]
            if width_match:
                parts.append(f"width:{width_match.group(1)}{width_match.group(2)}")
            if height_match:
                parts.append(f"height:{height_match.group(1)}{height_match.group(2)}")
            style = ";".join(parts)

        style_attr = f' style="{style}"' if style else ' style="max-width:100%;height:auto"'
        return f'<img src="{data_uri}"{style_attr} />'

    # ── List emission ────────────────────────────────────────────────

    def _emit_list(self, items: list[tuple[ET.Element, dict]]):
        """Emit a group of list items as nested <ul>/<ol>."""
        if not items:
            return

        first_num_id = items[0][1]["numId"]
        first_ilvl = items[0][1]["ilvl"]
        is_ordered = self._is_ordered_list(first_num_id, first_ilvl)
        list_tag = "ol" if is_ordered else "ul"

        style = "margin-top:0;margin-bottom:0"
        self.html_parts.append(f"<{list_tag} style=\"{style}\">")

        for para, num_info in items:
            ilvl = num_info["ilvl"]
            # Simple indentation for nested levels
            li_style = f"margin-left:{ilvl * 18}pt" if ilvl > 0 else ""
            style_attr = f' style="{li_style}"' if li_style else ""

            w = _NSMAP["w"]
            ppr = para.find(f"{{{w}}}pPr")
            style_id = ""
            if ppr is not None:
                style_el = ppr.find(f"{{{w}}}pStyle")
                if style_el is not None:
                    style_id = style_el.get(f"{{{w}}}val", "")

            content = self._collect_paragraph_content(para, style_id)
            self.html_parts.append(f"<li{style_attr}>{content}</li>")

        self.html_parts.append(f"</{list_tag}>")

    # ── Table emission ───────────────────────────────────────────────

    def _emit_table(self, tbl: ET.Element):
        w = _NSMAP["w"]

        table_style = "border-collapse:collapse;width:100%;margin-bottom:8pt"
        self.html_parts.append(f'<table style="{table_style}">')

        for tr in tbl.findall(f"{{{w}}}tr"):
            self.html_parts.append("<tr>")
            for tc in tr.findall(f"{{{w}}}tc"):
                # Cell properties
                tc_pr = tc.find(f"{{{w}}}tcPr")
                cell_style_parts = ["border:1px solid #ccc", "padding:4pt 6pt", "vertical-align:top"]
                colspan_attr = ""

                if tc_pr is not None:
                    # Cell width
                    tc_w = tc_pr.find(f"{{{w}}}tcW")
                    if tc_w is not None:
                        w_val = tc_w.get(f"{{{w}}}w")
                        w_type = tc_w.get(f"{{{w}}}type", "")
                        if w_val and w_type == "dxa":
                            cell_style_parts.append(f"width:{int(w_val) / 20:.0f}pt")
                        elif w_val and w_type == "pct":
                            cell_style_parts.append(f"width:{int(w_val) / 50:.1f}%")

                    # Cell shading
                    shd = tc_pr.find(f"{{{w}}}shd")
                    if shd is not None:
                        fill = shd.get(f"{{{w}}}fill", "")
                        if fill and fill.lower() not in ("auto", "ffffff"):
                            cell_style_parts.append(f"background-color:#{fill}")

                    # Gridspan (colspan)
                    grid_span = tc_pr.find(f"{{{w}}}gridSpan")
                    if grid_span is not None:
                        span_val = grid_span.get(f"{{{w}}}val", "")
                        if span_val and int(span_val) > 1:
                            colspan_attr = f' colspan="{span_val}"'

                    # Vertical merge
                    v_merge = tc_pr.find(f"{{{w}}}vMerge")
                    if v_merge is not None:
                        merge_val = v_merge.get(f"{{{w}}}val", "")
                        if merge_val != "restart":
                            # This is a continuation cell — skip it
                            continue

                cell_style = ";".join(cell_style_parts)

                # Render cell content (multiple paragraphs possible)
                cell_html_parts = []
                for p in tc.findall(f"{{{w}}}p"):
                    ppr = p.find(f"{{{w}}}pPr")
                    sid = ""
                    if ppr is not None:
                        se = ppr.find(f"{{{w}}}pStyle")
                        if se is not None:
                            sid = se.get(f"{{{w}}}val", "")
                    content = self._collect_paragraph_content(p, sid)
                    if content.strip():
                        cell_html_parts.append(content)
                    else:
                        cell_html_parts.append("&nbsp;")

                cell_content = "<br>".join(cell_html_parts)
                self.html_parts.append(f'<td style="{cell_style}"{colspan_attr}>{cell_content}</td>')

            self.html_parts.append("</tr>")
        self.html_parts.append("</table>")
