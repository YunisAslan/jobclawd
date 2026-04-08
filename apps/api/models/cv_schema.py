"""Structured CV data schema for parsing and regeneration."""

from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


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


class ExperienceEntry(BaseModel):
    id: str = Field(default_factory=_uid)
    company: str = ""
    title: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    bullets: list[str] = []


class EducationEntry(BaseModel):
    id: str = Field(default_factory=_uid)
    institution: str = ""
    degree: str = ""
    field_of_study: str = ""
    start_date: str = ""
    end_date: str = ""
    details: list[str] = []


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


class CVData(BaseModel):
    personal_info: PersonalInfo = Field(default_factory=PersonalInfo)
    experience: list[ExperienceEntry] = []
    education: list[EducationEntry] = []
    skills: list[SkillGroup] = []
    languages: list[LanguageEntry] = []
    certifications: list[CertificationEntry] = []
    additional_sections: dict[str, list[str]] = {}
