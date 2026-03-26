"""
Confidence Engine — wraps every extracted field with a confidence score,
extraction method, and supporting evidence.

Usage:
    field = FieldResult(value="Remote", confidence=0.95, method="regex", evidence="work from home")
    report = ExtractionReport(work_mode=field, ...)
    report.overall_confidence  # weighted average
    report.fields_needing_ai   # list of field names below threshold
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from utils.job_meta_extractor import primary_experience_value, split_experience_value


# Confidence thresholds — below these, the field is a candidate for AI enrichment
CONFIDENCE_THRESHOLD_HIGH = 0.80   # field is trustworthy
CONFIDENCE_THRESHOLD_AI = 0.50     # below this → send to AI


@dataclass(slots=True)
class FieldResult:
    """A single extracted field with confidence metadata."""
    value: Optional[str] = None
    confidence: float = 0.0
    method: str = "none"            # "structured" | "regex" | "keyword" | "rule" | "ai" | "none"
    evidence: str = ""              # the text fragment that led to the extraction

    @property
    def is_empty(self) -> bool:
        return self.value is None

    @property
    def needs_ai(self) -> bool:
        return self.is_empty or self.confidence < CONFIDENCE_THRESHOLD_AI

    @property
    def is_trustworthy(self) -> bool:
        return not self.is_empty and self.confidence >= CONFIDENCE_THRESHOLD_HIGH

    def merge(self, other: FieldResult) -> FieldResult:
        """Keep the higher-confidence result. Structured always wins over regex."""
        if other.is_empty:
            return self
        if self.is_empty:
            return other
        # Structured source always wins
        if self.method == "structured" and other.method != "structured":
            return self
        if other.method == "structured" and self.method != "structured":
            return other
        # AI wins over regex
        if self.method == "ai" and other.method == "regex":
            return self
        if other.method == "ai" and self.method == "regex":
            return other
        # Otherwise, higher confidence wins
        return self if self.confidence >= other.confidence else other


# ── Weights for overall confidence calculation ─────────────────────
_FIELD_WEIGHTS = {
    "work_mode": 1.0,
    "job_type": 1.0,
    "seniority": 0.8,
    "experience_years": 0.8,
    "salary": 0.7,
    "apply_method": 1.2,       # user cares most about this
    "skills": 0.5,
    "languages": 0.3,
    "work_authorization": 0.3,
    "location": 0.6,
}


@dataclass
class ExtractionReport:
    """Aggregates all extracted fields for a single job."""
    work_mode: FieldResult = field(default_factory=FieldResult)
    job_type: FieldResult = field(default_factory=FieldResult)
    seniority: FieldResult = field(default_factory=FieldResult)
    experience_years: FieldResult = field(default_factory=FieldResult)
    salary: FieldResult = field(default_factory=FieldResult)
    apply_method: FieldResult = field(default_factory=FieldResult)
    skills: FieldResult = field(default_factory=FieldResult)         # comma-separated skill list
    languages: FieldResult = field(default_factory=FieldResult)      # comma-separated
    work_authorization: FieldResult = field(default_factory=FieldResult)
    location: FieldResult = field(default_factory=FieldResult)

    # Extra context carried through the pipeline
    apply_url: Optional[str] = None
    apply_complexity: Optional[str] = None    # "easy" | "moderate" | "hard"
    auto_apply_support: Optional[str] = None  # "full" | "assisted" | "manual"

    @property
    def _core_fields(self) -> dict[str, FieldResult]:
        """The fields that matter for AI gating and scoring."""
        return {
            "work_mode": self.work_mode,
            "job_type": self.job_type,
            "seniority": self.seniority,
            "experience_years": self.experience_years,
            "salary": self.salary,
            "apply_method": self.apply_method,
        }

    @property
    def _all_fields(self) -> dict[str, FieldResult]:
        return {
            **self._core_fields,
            "skills": self.skills,
            "languages": self.languages,
            "work_authorization": self.work_authorization,
            "location": self.location,
        }

    @property
    def overall_confidence(self) -> float:
        """Weighted average confidence across all non-empty fields."""
        total_weight = 0.0
        total_score = 0.0
        for name, fr in self._all_fields.items():
            w = _FIELD_WEIGHTS.get(name, 0.5)
            if not fr.is_empty:
                total_weight += w
                total_score += w * fr.confidence
            else:
                # Empty fields drag confidence down (proportional to weight)
                total_weight += w * 0.5
        return round(total_score / total_weight, 3) if total_weight > 0 else 0.0

    @property
    def fields_needing_ai(self) -> list[str]:
        """Core field names that should be sent to AI for enrichment."""
        return [name for name, fr in self._core_fields.items() if fr.needs_ai]

    @property
    def parse_confidence_pct(self) -> int:
        """0-100 integer suitable for the frontend."""
        return max(0, min(100, round(self.overall_confidence * 100)))

    def merge(self, other: ExtractionReport) -> ExtractionReport:
        """Merge two reports field-by-field, keeping higher-confidence values."""
        merged = ExtractionReport()
        for name in self._all_fields:
            mine = getattr(self, name)
            theirs = getattr(other, name)
            setattr(merged, name, mine.merge(theirs))
        merged.apply_url = other.apply_url or self.apply_url
        merged.apply_complexity = other.apply_complexity or self.apply_complexity
        merged.auto_apply_support = other.auto_apply_support or self.auto_apply_support
        return merged

    def to_flat_dict(self) -> dict:
        """Convert to the flat _str/_src/_conf format used by JobListing and job_metadata."""
        out: dict = {}
        field_map = {
            "work_mode": "work_mode",
            "job_type": "job_type",
            "seniority": "seniority",
            "experience_years": "experience_years",
            "salary": "salary",
            "apply_method": "apply_method",
        }
        for attr_name, prefix in field_map.items():
            fr: FieldResult = getattr(self, attr_name)
            if not fr.is_empty:
                out[f"{prefix}_str"] = fr.value
                out[f"{prefix}_src"] = fr.method
                out[f"{prefix}_conf"] = round(fr.confidence, 2)

        experience_value = primary_experience_value(
            self.seniority.value,
            self.experience_years.value,
        )
        if experience_value:
            if self.seniority.value:
                experience_field = self.seniority
            else:
                experience_field = self.experience_years
            out["experience_str"] = experience_value
            out["experience_src"] = experience_field.method
            out["experience_conf"] = round(experience_field.confidence, 2)

        # Extra fields packed as simple strings
        if not self.skills.is_empty:
            out["skills_str"] = self.skills.value
        if not self.languages.is_empty:
            out["languages_str"] = self.languages.value
        if not self.work_authorization.is_empty:
            out["work_auth_str"] = self.work_authorization.value
        if not self.location.is_empty:
            out["location_str"] = self.location.value

        if self.apply_url:
            out["apply_url"] = self.apply_url
        if self.apply_complexity:
            out["apply_complexity"] = self.apply_complexity
        if self.auto_apply_support:
            out["auto_apply_support"] = self.auto_apply_support

        out["parse_confidence"] = self.parse_confidence_pct
        return out

    @classmethod
    def from_flat_dict(cls, d: dict) -> ExtractionReport:
        """Reconstruct from the flat _str/_src/_conf format (e.g. from DB or job dict)."""
        report = cls()
        field_map = {
            "work_mode": "work_mode",
            "job_type": "job_type",
            "seniority": "seniority",
            "experience_years": "experience_years",
            "salary": "salary",
            "apply_method": "apply_method",
        }
        for attr_name, prefix in field_map.items():
            val = d.get(f"{prefix}_str")
            src = d.get(f"{prefix}_src", "none")
            conf = d.get(f"{prefix}_conf", 0.0)
            if val:
                setattr(report, attr_name, FieldResult(
                    value=val,
                    confidence=float(conf) if conf else _default_confidence_for_method(src),
                    method=src or "none",
                ))

        if report.seniority.is_empty and report.experience_years.is_empty and d.get("experience_str"):
            seniority, years = split_experience_value(d.get("experience_str"))
            src = d.get("experience_src", "none")
            conf = d.get("experience_conf", 0.0)
            confidence = float(conf) if conf else _default_confidence_for_method(src)
            if seniority:
                report.seniority = FieldResult(
                    value=seniority,
                    confidence=confidence,
                    method=src or "none",
                )
            if years:
                report.experience_years = FieldResult(
                    value=years,
                    confidence=confidence,
                    method=src or "none",
                )

        if d.get("skills_str"):
            report.skills = FieldResult(value=d["skills_str"], confidence=0.6, method="regex")
        if d.get("languages_str"):
            report.languages = FieldResult(value=d["languages_str"], confidence=0.6, method="regex")
        if d.get("work_auth_str"):
            report.work_authorization = FieldResult(value=d["work_auth_str"], confidence=0.6, method="regex")
        if d.get("location_str"):
            report.location = FieldResult(value=d["location_str"], confidence=0.7, method="structured")

        report.apply_url = d.get("apply_url")
        report.apply_complexity = d.get("apply_complexity")
        report.auto_apply_support = d.get("auto_apply_support")
        return report


def _default_confidence_for_method(method: str) -> float:
    """Assign a default confidence when only the extraction method is known."""
    return {
        "structured": 0.95,
        "ai": 0.85,
        "openai": 0.85,
        "regex": 0.55,
        "keyword": 0.60,
        "rule": 0.70,
        "default": 0.30,
        "none": 0.0,
    }.get(method or "none", 0.40)
