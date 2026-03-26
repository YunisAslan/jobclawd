"""
Negative Rules Engine — prevents common false positives.

Each rule targets a specific field and either:
  - "reject": completely discard the extraction
  - "downgrade": reduce confidence by a factor (default 0.5)

Rules run AFTER positive extraction. If a negative rule matches the
surrounding context of a positive match, it vetoes or weakens that match.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from services.extraction.confidence import FieldResult


@dataclass(slots=True, frozen=True)
class NegativeRule:
    field: str                  # which field this guards: "work_mode", "seniority", etc.
    pattern: re.Pattern         # regex to match (case-insensitive)
    action: str                 # "reject" or "downgrade"
    target_value: Optional[str] # only apply if the extracted value matches this (None = any)
    reason: str                 # human-readable explanation
    factor: float = 0.5        # confidence multiplier for "downgrade" action


def _r(pattern: str) -> re.Pattern:
    """Compile a case-insensitive regex."""
    return re.compile(pattern, re.IGNORECASE)


# ══════════════════════════════════════════════════════════════════════
# RULE DEFINITIONS
# ══════════════════════════════════════════════════════════════════════

RULES: list[NegativeRule] = [
    # ══════════════════════════════════════════════════════════════
    # WORK MODE
    # ══════════════════════════════════════════════════════════════

    # ── Remote negations ──
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'\b(?:not\s+(?:a\s+)?remote|no\s+remote|remote\s+is\s+not|this\s+is\s+not\s+a\s+remote|office[\s\-]only)'),
        action="reject", reason="Explicit negation of remote work",
    ),
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'\bremote\s+(?:support|access|monitoring|desktop|control|sensing|region|server|diagnostics|administration|troubleshoot|infrastructure|patient|learning\s+environment)'),
        action="reject", reason="'remote' refers to technology, not work arrangement",
    ),
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'(?:work\s+with|manage|collaborate\s+with|support|coordinate\s+with|interact\s+with)\s+remote\s+(?:teams?|colleagues?|employees?|workers?|staff)'),
        action="reject", reason="Working with remote teams ≠ being remote yourself",
    ),
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'\b(?:flexible\s+(?:schedule|hours|work\s+arrangement)|flex[\s\-]?time)\b'),
        action="downgrade", reason="'flexible schedule/hours' does not necessarily mean remote", factor=0.4,
    ),
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'\bvirtual\s+(?:meetings?|interviews?|onboarding|calls?|sessions?)'),
        action="reject", reason="Virtual meetings don't mean remote position",
    ),
    # Hybrid override: if text has "at least X days in office" → Remote should be downgraded
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'(?:at\s+least|minimum)\s+\d+\s+days?\s+(?:per\s+|a\s+)?week\s+(?:in|at)\s+(?:the\s+)?office'),
        action="reject", reason="Required office days means not fully remote",
    ),
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'(?:expected|required)\s+to\s+(?:be\s+in|work\s+(?:in|at|from))\s+(?:the\s+)?office\s+(?:at\s+least\s+)?\d+\s+days?'),
        action="reject", reason="Required office attendance means not fully remote",
    ),
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'#hybrid\b'),
        action="reject", reason="#Hybrid tag overrides remote detection",
    ),
    # Multilingual negations
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'uzaqdan\s+deyil|uzaktan\s+değil|не\s+удалённо|не\s+удаленно|kein\s+remote|pas\s+de\s+télétravail|no\s+es\s+remoto'),
        action="reject", reason="Explicit negation in non-English language",
    ),

    # ── On-site negations (should be hybrid not on-site) ──
    NegativeRule(
        field="work_mode", target_value="On-site",
        pattern=_r(r'(?:at\s+least|minimum)\s+\d+\s+days?\s+(?:per\s+|a\s+)?week\s+(?:in|at)\s+(?:the\s+)?office'),
        action="downgrade", reason="Partial office days = hybrid, not fully on-site", factor=0.4,
    ),
    NegativeRule(
        field="work_mode", target_value="On-site",
        pattern=_r(r'#hybrid\b'),
        action="reject", reason="#Hybrid tag means not fully on-site",
    ),
    NegativeRule(
        field="work_mode", target_value="On-site",
        pattern=_r(r'\b(?:can\s+(?:also\s+)?work\s+remotely|option\s+to\s+work\s+remotely|remote\s+(?:option|flexibility)|apply\s+to\s+work\s+remotely|work\s+from\s+home\s+(?:option|flexibility))'),
        action="downgrade", reason="Remote option available means not strictly on-site", factor=0.4,
    ),
    NegativeRule(
        field="work_mode", target_value="On-site",
        pattern=_r(r'\b(?:flexible\s+(?:workforce|work(?:ing)?\s+(?:arrangement|environment|policy))|come\s+(?:into|to)\s+(?:the\s+)?office\s+as\s+(?:often|much)\s+as)'),
        action="reject", reason="Flexible/optional office = not strictly on-site",
    ),

    # ══════════════════════════════════════════════════════════════
    # SENIORITY
    # ══════════════════════════════════════════════════════════════
    NegativeRule(
        field="seniority", target_value="Senior",
        pattern=_r(r'\bsenior\s+(?:mindset|attitude|thinking|approach|citizens?|care|living|community|discount|residents?|population|center|centre)'),
        action="reject", reason="'senior' not used as seniority level",
    ),
    NegativeRule(
        field="seniority", target_value="Junior",
        pattern=_r(r'\bjunior\s+(?:achievement|league|high|school|varsity|college)'),
        action="reject", reason="'junior' not used as seniority level",
    ),
    NegativeRule(
        field="seniority", target_value="Lead",
        pattern=_r(r'\blead\s+(?:generation|management|nurturing|scoring|qualification|conversion|pipeline|magnet|capture|gen\b)'),
        action="reject", reason="'lead' used in marketing context, not seniority",
    ),
    NegativeRule(
        field="seniority", target_value="Lead",
        pattern=_r(r'\blead\s+(?:the|a|an|our|cross[\s\-]?functional|day[\s\-]?to[\s\-]?day|process|processes|delivery|execution|implementation|design|roadmap|initiative|effort|meeting)\b'),
        action="reject", reason="'lead' used as an action verb in responsibilities",
    ),
    NegativeRule(
        field="seniority", target_value="Intern",
        pattern=_r(r'\b(?:internal|international|internet|internat|internally|internalize)\b'),
        action="reject", reason="'intern' is part of a different word",
    ),
    NegativeRule(
        field="seniority", target_value="Manager",
        pattern=_r(r'\b(?:manage\s+(?:expectations|workload|your\s+time|priorities|deadlines|project\s+(?:priorities|timelines))|manager\s+(?:approval))\b'),
        action="reject", reason="'manage' used as verb in responsibilities, not seniority",
    ),
    NegativeRule(
        field="seniority", target_value="Executive",
        pattern=_r(r'\bexecutive\s+(?:summary|assistant|search|recruiter|recruiting)\b'),
        action="reject", reason="'executive' not used as seniority level",
    ),

    # ══════════════════════════════════════════════════════════════
    # SALARY
    # ══════════════════════════════════════════════════════════════
    NegativeRule(
        field="salary", target_value=None,
        pattern=_r(r'\b(?:competitive\s+(?:salary|compensation|pay)|salary\s+(?:competitive|commensurate|negotiable|DOE|TBD)|attractive\s+(?:salary|compensation|package))'),
        action="downgrade", reason="Non-numeric salary signal", factor=0.3,
    ),
    NegativeRule(
        field="salary", target_value=None,
        pattern=_r(r'\d+\s*%\s*(?:bonus|commission|incentive|increase|growth|match|matching|vesting)'),
        action="reject", reason="Percentage is not a salary amount",
    ),
    NegativeRule(
        field="salary", target_value=None,
        pattern=_r(r'(?:founded|established|since|over|incorporated)\s+(?:in\s+)?\d{4}'),
        action="reject", reason="Year is not a salary amount",
    ),
    NegativeRule(
        field="salary", target_value=None,
        pattern=_r(r'\b\d+\s*(?:employees|people|staff|team\s+members|offices|countries|locations|markets|cities|hubs|communities|visitors|users|customers|clients)'),
        action="reject", reason="Headcount/stat is not a salary amount",
    ),
    NegativeRule(
        field="salary", target_value=None,
        pattern=_r(r'(?:save|discount|off|up\s+to)\s+(?:[\$€£₼]?\s*)?\d'),
        action="reject", reason="Discount/savings amount is not a salary",
    ),
    NegativeRule(
        field="salary", target_value=None,
        pattern=_r(r'(?:approximately|approx\.?)\s+\d+\s*(?:million|billion)\s+(?:daily\s+active|active|monthly)'),
        action="reject", reason="User metrics are not salary amounts",
    ),

    # ══════════════════════════════════════════════════════════════
    # LANGUAGE
    # ══════════════════════════════════════════════════════════════
    NegativeRule(
        field="languages", target_value=None,
        pattern=_r(r'\b(?:is\s+a\s+plus|would\s+be\s+a\s+plus|nice\s+to\s+have|preferred|advantage|bonus|bonus\s+points?)\b'),
        action="downgrade", reason="Language is preferred, not required", factor=0.5,
    ),

    # ══════════════════════════════════════════════════════════════
    # EXPERIENCE
    # ══════════════════════════════════════════════════════════════
    NegativeRule(
        field="experience", target_value=None,
        pattern=_r(r'(?:company|firm|organization|business)\s+(?:has|with)\s+\d+\s*\+?\s*years?\s+(?:of\s+)?experience'),
        action="reject", reason="Company experience, not candidate requirement",
    ),
    NegativeRule(
        field="experience", target_value=None,
        pattern=_r(r'(?:founded|established|operating|incorporated)\s+(?:for\s+)?\d+\s*\+?\s*years?'),
        action="reject", reason="Company age, not candidate experience",
    ),
    NegativeRule(
        field="experience_years", target_value=None,
        pattern=_r(r'(?:company|firm|organization|business)\s+(?:has|with)\s+\d+\s*\+?\s*years?\s+(?:of\s+)?experience'),
        action="reject", reason="Company experience, not candidate requirement",
    ),
    NegativeRule(
        field="experience_years", target_value=None,
        pattern=_r(r'(?:founded|established|operating|since|incorporated)\s+(?:for\s+)?\d+\s*\+?\s*years?'),
        action="reject", reason="Company age, not candidate experience",
    ),
    NegativeRule(
        field="experience_years", target_value=None,
        pattern=_r(r'\b\d+\s*\+?\s*(?:active\s+communities|daily\s+active|employees|people|visitors|users|customers|offices|countries|locations)'),
        action="reject", reason="Statistic/headcount is not experience requirement",
    ),
]


def apply_negative_rules(
    field_name: str,
    result: FieldResult,
    text: str,
) -> FieldResult:
    """
    Check a FieldResult against negative rules. Returns a modified FieldResult
    (or the original if no rules matched).
    """
    if result.is_empty:
        return result

    for rule in RULES:
        if rule.field != field_name:
            continue

        # Check if the rule targets a specific value
        if rule.target_value is not None and result.value != rule.target_value:
            continue

        # Check if the negative pattern matches in the text
        if not rule.pattern.search(text):
            continue

        # Rule matched!
        if rule.action == "reject":
            return FieldResult(
                value=None, confidence=0.0, method="negated",
                evidence=f"Rejected: {rule.reason}",
            )
        elif rule.action == "downgrade":
            new_conf = result.confidence * rule.factor
            return FieldResult(
                value=result.value,
                confidence=round(new_conf, 3),
                method=result.method,
                evidence=f"{result.evidence} (downgraded: {rule.reason})",
            )

    return result
