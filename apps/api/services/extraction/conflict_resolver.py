"""
Conflict Resolution — determines final values when signals disagree.

Priority order:
  1. Structured API field (always wins)
  2. Explicit negation (cancels a positive signal)
  3. Title signal (wins over description for seniority, work_mode)
  4. Higher-weight keyword wins over lower-weight
  5. Higher-confidence signal wins
  6. When truly ambiguous → keep higher-confidence, flag as conflicted

This module operates on lists of FieldResult candidates for the same field
and produces one resolved FieldResult.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from services.extraction.confidence import FieldResult


@dataclass(slots=True)
class ResolvedField:
    """A resolved field with optional conflict metadata."""
    result: FieldResult
    had_conflict: bool = False
    conflicting_values: list[str] | None = None
    resolution_reason: str = ""


def resolve(candidates: list[FieldResult]) -> ResolvedField:
    """
    Resolve a list of FieldResult candidates into a single winner.

    candidates: multiple extractions for the same field from different sections/methods.
    """
    # Filter out empty and negated results
    live = [c for c in candidates if not c.is_empty and c.method != "negated"]

    if not live:
        # Check if everything was negated
        negated = [c for c in candidates if c.method == "negated"]
        if negated:
            return ResolvedField(
                result=negated[0],
                had_conflict=False,
                resolution_reason="all_negated",
            )
        return ResolvedField(
            result=FieldResult(),
            had_conflict=False,
            resolution_reason="no_signals",
        )

    if len(live) == 1:
        return ResolvedField(result=live[0], had_conflict=False, resolution_reason="single_signal")

    # Check if all candidates agree on the same value
    values = set(c.value for c in live)
    if len(values) == 1:
        # All agree — take the highest confidence
        best = max(live, key=lambda c: c.confidence)
        return ResolvedField(
            result=best,
            had_conflict=False,
            resolution_reason="unanimous",
        )

    # ── CONFLICT: multiple different values ──

    # Rule 1: Structured always wins
    structured = [c for c in live if c.method == "structured"]
    if structured:
        best = max(structured, key=lambda c: c.confidence)
        return ResolvedField(
            result=best,
            had_conflict=True,
            conflicting_values=sorted(values),
            resolution_reason="structured_wins",
        )

    # Rule 2: "rule" method wins over "regex" and "keyword"
    method_priority = {"rule": 3, "keyword": 2, "regex": 1, "default": 0}
    best_priority = max(method_priority.get(c.method, 0) for c in live)
    top_tier = [c for c in live if method_priority.get(c.method, 0) == best_priority]

    if len(top_tier) == 1:
        return ResolvedField(
            result=top_tier[0],
            had_conflict=True,
            conflicting_values=sorted(values),
            resolution_reason="method_priority",
        )

    # Rule 3: Highest weight (if keyword matches have weights)
    # We embed weight into confidence via section_parser, so this is handled by confidence

    # Rule 4: Highest confidence wins
    best = max(live, key=lambda c: c.confidence)
    return ResolvedField(
        result=best,
        had_conflict=True,
        conflicting_values=sorted(values),
        resolution_reason="highest_confidence",
    )


def merge_section_results(
    per_section: dict[str, FieldResult],
) -> ResolvedField:
    """
    Merge extraction results from different text sections.

    per_section: {"title": FieldResult, "requirements": FieldResult, ...}
    """
    candidates = [fr for fr in per_section.values() if not fr.is_empty]
    return resolve(candidates)
