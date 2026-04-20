"""Structured CV data schema for parsing and regeneration."""

from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


def _uid() -> str:
    return uuid4().hex[:12]


class PersonalInfo(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    portfolio: str = ""
    summary: str = ""
    photo: Optional[str] = None  # base64 data URL
    email_link: str = ""
    phone_link: str = ""
    linkedin_link: str = ""
    portfolio_link: str = ""


class ExperienceEntry(BaseModel):
    id: str = Field(default_factory=_uid)
    company: str = ""
    title: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    bullets: list[str] = []
    link: str = ""


class EducationEntry(BaseModel):
    id: str = Field(default_factory=_uid)
    institution: str = ""
    degree: str = ""
    field_of_study: str = ""
    start_date: str = ""
    end_date: str = ""
    details: list[str] = []
    link: str = ""


class SkillGroup(BaseModel):
    category: str = ""
    items: list[str] = []


class LanguageEntry(BaseModel):
    language: str = ""
    level: str = ""


class CertificationEntry(BaseModel):
    id: str = Field(default_factory=_uid)
    name: str = ""
    issuer: str = ""
    date: str = ""
    link: str = ""


class AdditionalEntry(BaseModel):
    """Structured entry inside an `additional_sections` bucket.

    Mirrors the title+subtitle+date+bullets layout of Experience/Education so
    sections like Awards, Volunteer Experience, Memberships preserve the
    original document's hierarchy instead of being flattened into bullets.
    """
    id: str = Field(default_factory=_uid)
    title: str = ""
    subtitle: str = ""
    date: str = ""
    bullets: list[str] = []
    link: str = ""


class CVData(BaseModel):
    personal_info: PersonalInfo = Field(default_factory=PersonalInfo)
    experience: list[ExperienceEntry] = []
    education: list[EducationEntry] = []
    skills: list[SkillGroup] = []
    languages: list[LanguageEntry] = []
    certifications: list[CertificationEntry] = []
    additional_sections: dict[str, list[AdditionalEntry]] = {}
    # Section keys in the order they appeared in the source document.
    # Uses "personal_info", "experience", "education", "skills", "languages",
    # "certifications" for built-in sections and the exact heading text for
    # additional_sections. Empty list means "use default order".
    section_order: list[str] = []

    @field_validator("additional_sections", mode="before")
    @classmethod
    def _coerce_additional_sections(cls, v: Any) -> dict[str, list[dict]]:
        # Tolerate legacy cached shape `dict[str, list[str]]` and mixed content.
        # A plain string is treated as a single-bullet entry with no title so
        # older parses keep rendering without manual migration.
        if not isinstance(v, dict):
            return {}
        result: dict[str, list[dict]] = {}
        for section, items in v.items():
            if not isinstance(items, list):
                continue
            coerced: list[dict] = []
            for item in items:
                if isinstance(item, str):
                    if item.strip():
                        coerced.append({"bullets": [item]})
                elif isinstance(item, dict):
                    coerced.append(item)
            result[str(section)] = coerced
        return result
