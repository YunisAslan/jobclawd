"""High-fidelity DOCX → HTML conversion via LibreOffice headless.

LibreOffice produces near-perfect HTML: columns, colors, fonts, icons,
images, tables — everything is preserved.  Falls back to None so the
caller can use the python-docx converter instead.

LibreOffice must be installed in the environment (it is added to the
Docker image via apt-get install libreoffice).
"""

import base64
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

# Common install paths for LibreOffice executable
_LO_CANDIDATES = [
    "libreoffice",
    "soffice",
    "/usr/bin/libreoffice",
    "/usr/bin/soffice",
    "/usr/local/bin/libreoffice",
    "/opt/libreoffice/program/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
]


def _find_libreoffice() -> Optional[str]:
    for candidate in _LO_CANDIDATES:
        if shutil.which(candidate):
            return candidate
        if Path(candidate).exists():
            return candidate
    return None


def convert_docx_to_html_libreoffice(filepath: Path) -> Optional[str]:
    """
    Convert a DOCX file to styled HTML using LibreOffice headless.

    Returns the full HTML string with all images inlined as base64
    data URIs, or None if LibreOffice is unavailable or conversion fails.
    """
    lo_bin = _find_libreoffice()
    if not lo_bin:
        return None

    try:
        return _run_conversion(lo_bin, filepath)
    except Exception:
        return None


def _run_conversion(lo_bin: str, filepath: Path) -> Optional[str]:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        # Copy the source file in to avoid any path issues
        src_copy = tmp_path / filepath.name
        shutil.copy2(filepath, src_copy)

        # Run LibreOffice headless conversion
        result = subprocess.run(
            [
                lo_bin,
                "--headless",
                "--norestore",
                "--nofirststartwizard",
                "--convert-to", "html:HTML (StarWriter)",
                "--outdir", str(tmp_path),
                str(src_copy),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode != 0:
            return None

        # Find the generated HTML file
        html_files = list(tmp_path.glob("*.html")) + list(tmp_path.glob("*.HTML"))
        if not html_files:
            return None

        html_file = html_files[0]
        html_content = html_file.read_text(encoding="utf-8", errors="replace")

        if not html_content.strip():
            return None

        # LibreOffice places images in a sibling folder named <stem>_html_m.../
        # We find them by searching the temp dir and inline them as base64.
        html_content = _inline_images(html_content, tmp_path)

        # Extract just the <body> content — we don't need the full HTML doc wrapper.
        body_html = _extract_body(html_content)

        # Strip LibreOffice's page-break divs that force fixed page sizes
        body_html = _clean_libreoffice_html(body_html)

        return body_html if body_html.strip() else None


def _inline_images(html: str, base_dir: Path) -> str:
    """Replace all relative <img src="..."> with base64 data URIs."""
    def replace_src(m: re.Match) -> str:
        before = m.group(1)
        src = m.group(2)
        after = m.group(3)

        # Skip already-inlined or external URLs
        if src.startswith("data:") or src.startswith("http"):
            return m.group(0)

        # Resolve path relative to the HTML file's directory
        candidate = base_dir / src
        if not candidate.exists():
            # Try searching recursively for the filename
            name = Path(src).name
            found = list(base_dir.rglob(name))
            if found:
                candidate = found[0]
            else:
                return m.group(0)

        try:
            raw = candidate.read_bytes()
            b64 = base64.b64encode(raw).decode("ascii")
            mime = _mime_for_ext(candidate.suffix.lower())
            data_uri = f"data:{mime};base64,{b64}"
            return f'{before}"{data_uri}"{after}'
        except Exception:
            return m.group(0)

    return re.sub(r'(<img\s[^>]*src=)"([^"]*)"([^>]*>)', replace_src, html, flags=re.IGNORECASE)


def _extract_body(html: str) -> str:
    """Return just the content inside <body>...</body>."""
    m = re.search(r"<body[^>]*>(.*?)</body>", html, re.IGNORECASE | re.DOTALL)
    if m:
        return m.group(1)
    return html


def _clean_libreoffice_html(html: str) -> str:
    """
    Remove or soften LibreOffice-specific artifacts that break the editor:
    - Fixed-size page containers (width/height in absolute units)
    - Page-break divs
    - Excessive margin/padding that shifts content off-screen
    """
    # Remove fixed-width/height from outer page divs LibreOffice inserts
    # They look like: <div style="... width:21cm; height:29.7cm; ..."
    # Replace the fixed dimensions with auto so content flows naturally.
    html = re.sub(
        r'(style="[^"]*)\bwidth\s*:\s*[\d.]+\s*(?:cm|mm|in|pt|px)\b',
        r'\1width:100%',
        html,
    )
    html = re.sub(
        r'(style="[^"]*)\bheight\s*:\s*[\d.]+\s*(?:cm|mm|in|pt|px)\b',
        r'\1height:auto',
        html,
    )
    # Remove page-break markers
    html = re.sub(
        r'<div[^>]+page-break[^>]*>\s*</div>',
        '',
        html,
        flags=re.IGNORECASE,
    )
    return html


def _mime_for_ext(ext: str) -> str:
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".bmp": "image/bmp",
        ".svg": "image/svg+xml",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
        ".webp": "image/webp",
    }.get(ext, "application/octet-stream")
