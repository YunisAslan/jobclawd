"""
Canonical vacancy signal model used by the extraction pipeline.

Different sources expose different structures. This layer converts scraper
output into a single shape so deterministic and AI extraction can reason over
structured fields, card chips, labeled sections, and narrative text together.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from services.extraction.section_parser import parse_sections


def _collect_text(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        cleaned = " ".join(value.split()).strip()
        return [cleaned] if cleaned else []
    if isinstance(value, (list, tuple, set)):
        out: list[str] = []
        for item in value:
            out.extend(_collect_text(item))
        return out
    if isinstance(value, dict):
        out: list[str] = []
        for item in value.values():
            out.extend(_collect_text(item))
        return out
    return []


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(value)
    return out


@dataclass(slots=True)
class CanonicalVacancySignals:
    title: str = ""
    locations: list[str] = field(default_factory=list)
    primary_location: Optional[str] = None
    workplace_type_raw: list[str] = field(default_factory=list)
    applicant_location_requirements_raw: list[str] = field(default_factory=list)
    employment_type_raw: list[str] = field(default_factory=list)
    seniority_raw: list[str] = field(default_factory=list)
    experience_years_raw: list[str] = field(default_factory=list)
    salary_raw: list[str] = field(default_factory=list)
    apply_url: Optional[str] = None
    apply_method_hints: list[str] = field(default_factory=list)
    card_badges: list[str] = field(default_factory=list)
    topline_labels: list[str] = field(default_factory=list)
    requirements_text: str = ""
    responsibilities_text: str = ""
    benefits_text: str = ""
    about_company_text: str = ""
    general_text: str = ""
    custom_fields_raw: dict[str, Any] = field(default_factory=dict)
    source_name: str = ""
    source_confidence: float = 0.0

    @property
    def card_label_text(self) -> list[str]:
        return _dedupe(self.card_badges + self.topline_labels)

    @property
    def combined_text(self) -> str:
        parts = [
            self.requirements_text,
            self.responsibilities_text,
            self.benefits_text,
            self.about_company_text,
            self.general_text,
        ]
        return "\n\n".join(part for part in parts if part)


def build_canonical_vacancy_signals(
    *,
    title: str = "",
    description: str = "",
    location_str: Optional[str] = None,
    source: str = "",
    apply_url: Optional[str] = None,
    card_data: Optional[dict[str, Any]] = None,
    structured_fields: Optional[dict[str, Any]] = None,
) -> CanonicalVacancySignals:
    card = card_data or {}
    structured = structured_fields or {}

    sections = parse_sections(
        title=title,
        card_labels=_dedupe(
            _collect_text(card.get("labels"))
            + _collect_text(card.get("card_badges"))
            + _collect_text(card.get("topline_labels"))
            + _collect_text(card.get("work_mode"))
            + _collect_text(card.get("employment_type"))
            + _collect_text(card.get("job_type"))
            + _collect_text(card.get("seniority_level"))
            + _collect_text(card.get("experience_years"))
        ) or None,
        description=description,
    )

    grouped: dict[str, list[str]] = {
        "requirements": [],
        "responsibilities": [],
        "benefits": [],
        "about_company": [],
        "general": [],
    }
    for section in sections:
        if section.name in grouped and section.text:
            grouped[section.name].append(section.text)

    locations = _collect_text(location_str) + _collect_text(card.get("locations"))
    primary_location = location_str or (locations[0] if locations else None)

    source_confidence = 0.4
    if structured:
        source_confidence = 0.95
    elif card:
        source_confidence = 0.8

    return CanonicalVacancySignals(
        title=(title or "").strip(),
        locations=_dedupe(locations),
        primary_location=primary_location,
        workplace_type_raw=_dedupe(
            _collect_text(structured.get("work_mode"))
            + _collect_text(card.get("workplace_type"))
            + _collect_text(card.get("work_mode"))
            + _collect_text(card.get("work_arrangement"))
        ),
        applicant_location_requirements_raw=_dedupe(
            _collect_text(structured.get("applicant_location_requirements"))
            + _collect_text(card.get("applicant_location_requirements"))
        ),
        employment_type_raw=_dedupe(
            _collect_text(structured.get("job_type"))
            + _collect_text(card.get("employment_type"))
            + _collect_text(card.get("job_type"))
        ),
        seniority_raw=_dedupe(
            _collect_text(structured.get("seniority"))
            + _collect_text(structured.get("experience"))
            + _collect_text(card.get("seniority_level"))
            + _collect_text(card.get("experience"))
        ),
        experience_years_raw=_dedupe(
            _collect_text(structured.get("experience_years"))
            + _collect_text(card.get("experience"))
            + _collect_text(card.get("experience_years"))
        ),
        salary_raw=_dedupe(
            _collect_text(structured.get("salary"))
            + _collect_text(card.get("salary"))
        ),
        apply_url=apply_url,
        apply_method_hints=_dedupe(
            _collect_text(structured.get("apply_method"))
            + _collect_text(card.get("apply_method_hints"))
        ),
        card_badges=_dedupe(
            _collect_text(card.get("card_badges"))
            + _collect_text(card.get("badges"))
        ),
        topline_labels=_dedupe(
            _collect_text(card.get("topline_labels"))
            + _collect_text(card.get("labels"))
        ),
        requirements_text="\n\n".join(grouped["requirements"]),
        responsibilities_text="\n\n".join(grouped["responsibilities"]),
        benefits_text="\n\n".join(grouped["benefits"]),
        about_company_text="\n\n".join(grouped["about_company"]),
        general_text="\n\n".join(grouped["general"]),
        custom_fields_raw={
            "structured_fields": structured,
            "card_data": card,
        },
        source_name=source,
        source_confidence=source_confidence,
    )
