"""
Section-Aware Parser — splits job text into weighted sections.

Signals in titles/labels carry more weight than buried in description.
Signals in benefits ≠ signals in requirements.

Section weights:
  title          → 1.5x
  card_labels    → 1.3x
  requirements   → 1.0x
  apply_section  → 1.2x (for apply method)
  responsibilities → 0.8x
  benefits       → 0.5x
  general        → 0.7x (unclassified description text)
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(slots=True)
class Section:
    name: str
    text: str
    weight: float


# Section heading patterns (multilingual)
_SECTION_PATTERNS: list[tuple[re.Pattern, str, float]] = [
    # Requirements / Qualifications
    (re.compile(
        r'(?:^|\n)\s*(?:#+\s*)?(?:'
        r'requirements?|qualifications?|what we (?:need|require|expect|look for)|'
        r'who you are|must.have|minimum qualifications?|what you.?ll need|'
        r'tələblər|namizədə tələblər|tələb olunanlar|'
        r'gereksinimler|nitelikler|aranan özellikler|'
        r'требования|квалификация|что мы ожидаем|что нужно'
        r')\s*[:：\-]?\s*',
        re.IGNORECASE | re.MULTILINE,
    ), "requirements", 1.0),

    # Responsibilities / Duties
    (re.compile(
        r'(?:^|\n)\s*(?:#+\s*)?(?:'
        r'responsibilities|duties|what you.?ll do|your role|key tasks|'
        r'vəzifələr|iş öhdəlikləri|'
        r'sorumluluklar|görevler|yapacaklarınız|'
        r'обязанности|задачи|что предстоит делать'
        r')\s*[:：\-]?\s*',
        re.IGNORECASE | re.MULTILINE,
    ), "responsibilities", 0.8),

    # Benefits / Perks
    (re.compile(
        r'(?:^|\n)\s*(?:#+\s*)?(?:'
        r'benefits|perks|what we offer|we offer|why (?:join|work)|our offer|'
        r'üstünlüklər|biz təklif edirik|imkanlar|'
        r'avantajlar|sunduklarımız|neden biz|'
        r'преимущества|мы предлагаем|что мы предлагаем|бонусы'
        r')\s*[:：\-]?\s*',
        re.IGNORECASE | re.MULTILINE,
    ), "benefits", 0.5),

    # Apply / How to apply
    (re.compile(
        r'(?:^|\n)\s*(?:#+\s*)?(?:'
        r'how to apply|application|apply now|to apply|application process|'
        r'müraciət|necə müraciət|müraciət qaydası|'
        r'başvuru|nasıl başvurulur|başvuru süreci|'
        r'как подать заявку|подать заявку|как откликнуться'
        r')\s*[:：\-]?\s*',
        re.IGNORECASE | re.MULTILINE,
    ), "apply_section", 1.2),

    # About the company
    (re.compile(
        r'(?:^|\n)\s*(?:#+\s*)?(?:'
        r'about (?:us|the company|our company)|company (?:description|overview)|who we are|'
        r'şirkət haqqında|haqqımızda|'
        r'hakkımızda|şirket hakkında|'
        r'о компании|о нас|кто мы'
        r')\s*[:：\-]?\s*',
        re.IGNORECASE | re.MULTILINE,
    ), "about_company", 0.3),
]


def parse_sections(
    *,
    title: str = "",
    card_labels: list[str] | None = None,
    description: str = "",
) -> list[Section]:
    """
    Split a vacancy into weighted sections.

    Returns a list of Section objects, each with a name, text, and weight multiplier.
    """
    sections: list[Section] = []

    # Title — highest weight
    if title.strip():
        sections.append(Section(name="title", text=title.strip(), weight=1.5))

    # Card labels — high weight
    if card_labels:
        label_text = " | ".join(l.strip() for l in card_labels if l.strip())
        if label_text:
            sections.append(Section(name="card_labels", text=label_text, weight=1.3))

    # Parse description into sections
    if description.strip():
        desc_sections = _split_description(description)
        sections.extend(desc_sections)

    return sections


def _split_description(description: str) -> list[Section]:
    """Split description text into classified sections."""
    if not description:
        return []

    # Find all section boundaries
    boundaries: list[tuple[int, str, float]] = []
    for pattern, name, weight in _SECTION_PATTERNS:
        for m in pattern.finditer(description):
            boundaries.append((m.start(), name, weight))

    if not boundaries:
        # No sections detected — treat entire description as general
        return [Section(name="general", text=description.strip(), weight=0.7)]

    # Sort by position
    boundaries.sort(key=lambda b: b[0])

    sections: list[Section] = []

    # Text before the first section heading → general
    first_pos = boundaries[0][0]
    if first_pos > 0:
        pre_text = description[:first_pos].strip()
        if pre_text:
            sections.append(Section(name="general", text=pre_text, weight=0.7))

    # Each section runs from its heading to the next heading
    for i, (pos, name, weight) in enumerate(boundaries):
        end = boundaries[i + 1][0] if i + 1 < len(boundaries) else len(description)
        # Skip the heading line itself
        heading_end = description.find("\n", pos)
        if heading_end == -1 or heading_end >= end:
            text_start = pos
        else:
            text_start = heading_end + 1
        section_text = description[text_start:end].strip()
        if section_text:
            sections.append(Section(name=name, text=section_text, weight=weight))

    return sections


def apply_section_weight(base_confidence: float, section_weight: float) -> float:
    """Apply section weight to a base confidence, clamped to [0, 1]."""
    adjusted = base_confidence * section_weight
    return max(0.0, min(1.0, adjusted))
