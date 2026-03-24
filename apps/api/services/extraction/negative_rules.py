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
    # ── Work Mode ──
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'\b(?:not\s+remote|no\s+remote|remote\s+is\s+not|this\s+is\s+not\s+a\s+remote|office[\s\-]only)'),
        action="reject", reason="Explicit negation of remote work",
    ),
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'\bremote\s+(?:support|access|monitoring|desktop|control|sensing|region|server|diagnostics|administration)'),
        action="reject", reason="'remote' refers to technology, not work arrangement",
    ),
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'(?:work\s+with|manage|collaborate\s+with|support)\s+remote\s+(?:teams?|colleagues?|employees?)'),
        action="reject", reason="Working with remote teams ≠ being remote yourself",
    ),
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'\b(?:flexible\s+(?:schedule|hours|environment|work\s+arrangement)|flex[\s\-]?time)\b'),
        action="downgrade", reason="'flexible' does not necessarily mean remote", factor=0.4,
    ),
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'\bvirtual\s+(?:meetings?|interviews?|onboarding|calls?)'),
        action="reject", reason="Virtual meetings don't mean remote position",
    ),
    # Azerbaijani / Turkish / Russian negations
    NegativeRule(
        field="work_mode", target_value="Remote",
        pattern=_r(r'uzaqdan\s+deyil|uzaktan\s+değil|не\s+удалённо|не\s+удаленно'),
        action="reject", reason="Explicit negation in non-English language",
    ),

    # ── Seniority ──
    NegativeRule(
        field="seniority", target_value="Senior",
        pattern=_r(r'\bsenior\s+(?:mindset|attitude|thinking|approach|citizens?|care|living|community|discount)'),
        action="reject", reason="'senior' not used as seniority level",
    ),
    NegativeRule(
        field="seniority", target_value="Junior",
        pattern=_r(r'\bjunior\s+(?:achievement|league|high|school|varsity)'),
        action="reject", reason="'junior' not used as seniority level",
    ),
    NegativeRule(
        field="seniority", target_value="Lead",
        pattern=_r(r'\blead\s+(?:generation|management|nurturing|scoring|qualification|conversion|pipeline|magnet)'),
        action="reject", reason="'lead' used in marketing context, not seniority",
    ),
    NegativeRule(
        field="seniority", target_value="Intern",
        pattern=_r(r'\b(?:internal|international|internet|internat)\b'),
        action="reject", reason="'intern' is part of a different word",
    ),

    # ── Salary ──
    NegativeRule(
        field="salary", target_value=None,
        pattern=_r(r'\b(?:competitive\s+(?:salary|compensation|pay)|salary\s+(?:competitive|commensurate|negotiable|DOE|TBD))\b'),
        action="downgrade", reason="Non-numeric salary signal", factor=0.3,
    ),
    NegativeRule(
        field="salary", target_value=None,
        pattern=_r(r'\d+\s*%\s*(?:bonus|commission|incentive|increase|growth)'),
        action="reject", reason="Percentage is not a salary amount",
    ),
    NegativeRule(
        field="salary", target_value=None,
        pattern=_r(r'(?:founded|established|since|over)\s+(?:in\s+)?\d{4}'),
        action="reject", reason="Year is not a salary amount",
    ),
    NegativeRule(
        field="salary", target_value=None,
        pattern=_r(r'\b\d+\s*(?:employees|people|staff|team members|offices|countries|locations)'),
        action="reject", reason="Headcount/stat is not a salary amount",
    ),
    NegativeRule(
        field="salary", target_value=None,
        pattern=_r(r'(?:save|discount|off|up\s+to)\s+(?:[\$€£₼]?\s*)?\d'),
        action="reject", reason="Discount/savings amount is not a salary",
    ),

    # ── Language ──
    NegativeRule(
        field="languages", target_value=None,
        pattern=_r(r'\b(?:is\s+a\s+plus|would\s+be\s+a\s+plus|nice\s+to\s+have|preferred|advantage|bonus)\b'),
        action="downgrade", reason="Language is preferred, not required", factor=0.5,
    ),

    # ── Experience ──
    NegativeRule(
        field="experience", target_value=None,
        pattern=_r(r'(?:company|firm|organization)\s+(?:has|with)\s+\d+\s*\+?\s*years?\s+(?:of\s+)?experience'),
        action="reject", reason="Company experience, not candidate requirement",
    ),
    NegativeRule(
        field="experience", target_value=None,
        pattern=_r(r'(?:founded|established|operating)\s+(?:for\s+)?\d+\s*\+?\s*years?'),
        action="reject", reason="Company age, not candidate experience",
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
