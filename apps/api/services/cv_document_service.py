"""Helpers for editable CV draft loading and document export."""

from io import BytesIO
import html as _html
import re
from pathlib import Path

from services.cv_extractor import extract_cv_text


def extract_cv_draft(cv_url: str) -> str | None:
    return extract_cv_text(cv_url)


def build_cv_export(content: str, source_name: str | None = None) -> tuple[BytesIO, str, str]:
    if _is_html_content(content):
        return _build_word_html_export_from_html(content, source_name)

    try:
        from docx import Document
    except ModuleNotFoundError:
        return _build_word_html_export(content, source_name)

    document = Document()

    for paragraph in _split_paragraphs(content):
        document.add_paragraph(paragraph)

    output = BytesIO()
    document.save(output)
    output.seek(0)

    filename = _build_filename(source_name)
    return (
        output,
        filename,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


def infer_cv_filename(cv_url: str) -> str:
    raw_name = Path((cv_url or "").split("?")[0]).stem or "updated-cv"
    return _slugify(raw_name)


def _build_filename(source_name: str | None) -> str:
    base = _slugify(source_name or "updated-cv")
    return f"{base}.docx"


def _build_word_html_export(content: str, source_name: str | None = None) -> tuple[BytesIO, str, str]:
    base = _slugify(source_name or "updated-cv")
    body_parts = []

    for paragraph in _split_paragraphs(content):
        escaped = _html.escape(paragraph).replace("\n", "<br>")
        body_parts.append(f"<p>{escaped}</p>")

    html_doc = f"""\
<html>
  <head>
    <meta charset="utf-8">
    <title>{_html.escape(base)}</title>
    <style>
      body {{
        font-family: Calibri, Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.45;
        margin: 1in;
        color: #111827;
      }}
      p {{
        margin: 0 0 12pt 0;
      }}
    </style>
  </head>
  <body>
    {''.join(body_parts)}
  </body>
</html>
"""
    output = BytesIO(html_doc.encode("utf-8"))
    output.seek(0)
    return output, f"{base}.doc", "application/msword"


def _is_html_content(content: str) -> bool:
    """Returns True if content looks like HTML (starts with < and contains block-level tags)."""
    stripped = content.strip()
    if not stripped.startswith("<"):
        return False
    return any(tag in stripped for tag in ("<p>", "<ul>", "<h", "<li>"))


def _build_word_html_export_from_html(html_content: str, source_name: str | None = None) -> tuple[BytesIO, str, str]:
    """Wrap rich HTML content in a Word-compatible HTML document."""
    base = _slugify(source_name or "updated-cv")

    html_doc = f"""\
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8">
    <meta name=ProgId content=Word.Document>
    <meta name=Generator content="Microsoft Word 15">
    <meta name=Originator content="Microsoft Word 15">
    <title>{_html.escape(base)}</title>
    <!--[if gte mso 9]>
    <xml>
      <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
        <w:DoNotOptimizeForBrowser/>
      </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
      @page {{
        margin: 1in;
      }}
      body {{
        font-family: Calibri, Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.45;
        color: #111827;
      }}
      p {{
        margin: 0 0 8pt 0;
      }}
      ul, ol {{
        margin: 0 0 8pt 0;
        padding-left: 20pt;
      }}
      li {{
        margin-bottom: 3pt;
      }}
      h1 {{
        font-size: 16pt;
        font-weight: bold;
        margin: 0 0 8pt 0;
      }}
      h2 {{
        font-size: 13pt;
        font-weight: bold;
        margin: 0 0 6pt 0;
      }}
      h3 {{
        font-size: 11pt;
        font-weight: bold;
        margin: 0 0 4pt 0;
      }}
    </style>
  </head>
  <body>
    {html_content}
  </body>
</html>
"""
    output = BytesIO(html_doc.encode("utf-8"))
    output.seek(0)
    return output, f"{base}.doc", "application/msword"


def _split_paragraphs(content: str) -> list[str]:
    parts = [part.strip() for part in re.split(r"\n\s*\n", content or "") if part.strip()]
    if parts:
        return parts
    single = (content or "").strip()
    return [single] if single else [""]


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "updated-cv"
