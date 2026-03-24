"""
Multilingual Keyword Dictionary System.

Each category contains entries with:
  - canonical: normalized English value
  - weight: signal strength (1.0 = definitive, 0.3 = weak hint)
  - synonyms: {lang_code: [keyword_list]}
  - negatives: phrases where the keyword does NOT carry its usual meaning

All matching is case-insensitive. Compiled regex patterns are cached at module load.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass(slots=True, frozen=True)
class KeywordEntry:
    canonical: str
    weight: float
    synonyms: dict[str, list[str]]
    negatives: list[str] = field(default_factory=list)

    @property
    def all_synonyms(self) -> list[str]:
        """Flatten all language synonyms into one list."""
        out: list[str] = []
        for terms in self.synonyms.values():
            out.extend(terms)
        return out


@dataclass(slots=True)
class KeywordMatch:
    canonical: str
    weight: float
    matched_text: str
    lang: str  # which language dict matched


# ══════════════════════════════════════════════════════════════════════
# WORK MODEL
# ══════════════════════════════════════════════════════════════════════

WORK_MODE: list[KeywordEntry] = [
    KeywordEntry(
        canonical="Remote",
        weight=1.0,
        synonyms={
            "en": ["fully remote", "100% remote", "remote position", "remote role",
                   "remote work", "work from home", "wfh", "telecommute", "work remotely",
                   "remote-first", "remote friendly"],
            "az": ["uzaqdan", "uzaqdan iş", "evdən iş", "distant"],
            "tr": ["uzaktan", "uzaktan çalışma", "evden çalışma", "remote"],
            "ru": ["удалённо", "удалённая работа", "дистанционно", "работа из дома",
                   "удаленно", "удаленная работа"],
        },
        negatives=[
            "not remote", "no remote", "remote is not", "this is not a remote",
            "remote support", "remote access", "remote monitoring", "remote desktop",
            "remote teams", "work with remote", "manage remote", "remote control",
            "remote sensing", "remote region",
            "uzaqdan deyil", "не удалённо", "не удаленно", "uzaktan değil",
        ],
    ),
    KeywordEntry(
        canonical="Hybrid",
        weight=1.0,
        synonyms={
            "en": ["hybrid", "hybrid work", "hybrid model", "hybrid schedule",
                   "partial remote", "flex office", "split office"],
            "az": ["hibrid", "qarışıq", "hibrid iş"],
            "tr": ["hibrit", "karma çalışma", "hibrit model"],
            "ru": ["гибрид", "гибридный", "смешанный", "гибридная работа"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="On-site",
        weight=1.0,
        synonyms={
            "en": ["on-site", "onsite", "on site", "in-office", "in office",
                   "office-based", "in-person", "office only", "must work in office"],
            "az": ["ofisdə", "ofis bazalı", "ofisdə iş"],
            "tr": ["ofiste", "ofis bazlı", "iş yerinde"],
            "ru": ["в офисе", "офисная работа", "офисн", "очно"],
        },
        negatives=[],
    ),
]

# ══════════════════════════════════════════════════════════════════════
# EMPLOYMENT TYPE
# ══════════════════════════════════════════════════════════════════════

JOB_TYPE: list[KeywordEntry] = [
    KeywordEntry(
        canonical="Full-time",
        weight=1.0,
        synonyms={
            "en": ["full-time", "full time", "fulltime", "permanent", "FTE"],
            "az": ["tam iş günü", "tam ştat", "tam zamanlı", "tam vaxt", "daimi"],
            "tr": ["tam zamanlı", "tam gün", "kadrolu"],
            "ru": ["полная занятость", "полный рабочий день", "полная ставка", "полн"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Part-time",
        weight=1.0,
        synonyms={
            "en": ["part-time", "part time", "parttime", "half-time"],
            "az": ["yarım iş günü", "yarım ştat", "natamam", "yarım vaxt"],
            "tr": ["yarı zamanlı", "yarım gün", "kısmi zamanlı"],
            "ru": ["неполная занятость", "частичная занятость", "неполный рабочий день", "частичн"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Contract",
        weight=1.0,
        synonyms={
            "en": ["contract", "contractor", "fixed-term", "fixed term", "term contract"],
            "az": ["müqavilə", "müqavilə ilə", "sözləşmə"],
            "tr": ["sözleşmeli", "sözleşme", "kontrat"],
            "ru": ["контракт", "по контракту", "по договору", "срочный договор"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Freelance",
        weight=1.0,
        synonyms={
            "en": ["freelance", "freelancer", "freelancing", "self-employed", "independent contractor"],
            "az": ["frilans", "sərbəst"],
            "tr": ["serbest", "freelance", "serbest çalışan"],
            "ru": ["фриланс", "фрилансер", "свободный"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Internship",
        weight=1.0,
        synonyms={
            "en": ["internship", "intern position", "student placement", "co-op"],
            "az": ["təcrübə proqramı", "staj", "praktika"],
            "tr": ["staj", "stajyer", "stajyerlik"],
            "ru": ["стажировка", "стажёр", "стажер", "практика"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Temporary",
        weight=0.8,
        synonyms={
            "en": ["temporary", "temp position", "short-term"],
            "az": ["müvəqqəti"],
            "tr": ["geçici", "kısa süreli"],
            "ru": ["временная", "временно", "краткосрочн"],
        },
        negatives=[],
    ),
]

# ══════════════════════════════════════════════════════════════════════
# SENIORITY
# ══════════════════════════════════════════════════════════════════════

SENIORITY: list[KeywordEntry] = [
    KeywordEntry(
        canonical="Intern",
        weight=1.0,
        synonyms={
            "en": ["intern", "internship", "trainee", "graduate trainee"],
            "az": ["təcrübəçi", "stajçı", "stajer"],
            "tr": ["stajyer", "staj", "aday"],
            "ru": ["стажёр", "стажер", "практикант"],
        },
        negatives=["internal", "international", "internet", "internat"],
    ),
    KeywordEntry(
        canonical="Junior",
        weight=1.0,
        synonyms={
            "en": ["junior", "jr", "jr.", "entry level", "entry-level"],
            "az": ["kiçik mütəxəssis", "gənc mütəxəssis"],
            "tr": ["kıdemsiz", "giriş seviyesi"],
            "ru": ["младший", "начинающий"],
        },
        negatives=["junior achievement", "junior league", "junior high"],
    ),
    KeywordEntry(
        canonical="Mid",
        weight=0.8,
        synonyms={
            "en": ["mid-level", "mid level", "middle", "mid-senior", "intermediate"],
            "az": ["orta səviyyə"],
            "tr": ["orta düzey", "orta seviye"],
            "ru": ["средний", "средний уровень"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Senior",
        weight=1.0,
        synonyms={
            "en": ["senior", "sr", "sr.", "experienced", "advanced"],
            "az": ["baş mütəxəssis", "böyük mütəxəssis"],
            "tr": ["kıdemli", "uzman"],
            "ru": ["старший", "ведущий"],
        },
        negatives=[
            "senior mindset", "senior citizen", "senior care", "senior living",
            "senior discount", "senior community", "senior management style",
        ],
    ),
    KeywordEntry(
        canonical="Lead",
        weight=1.0,
        synonyms={
            "en": ["lead", "team lead", "tech lead", "principal", "staff"],
            "az": ["rəhbər", "komanda rəhbəri"],
            "tr": ["lider", "takım lideri", "baş"],
            "ru": ["руководитель", "тимлид", "ведущий разработчик"],
        },
        negatives=[
            "lead generation", "lead management", "lead nurturing", "sales lead",
            "lead scoring", "lead qualification",
        ],
    ),
    KeywordEntry(
        canonical="Manager",
        weight=0.9,
        synonyms={
            "en": ["manager", "head of", "director", "vp of", "vice president"],
            "az": ["menecer", "müdir", "rəis", "şöbə rəhbəri"],
            "tr": ["müdür", "yönetici", "direktör"],
            "ru": ["менеджер", "директор", "руководитель отдела", "начальник"],
        },
        negatives=["account manager relationship", "manage expectations"],
    ),
]

# ══════════════════════════════════════════════════════════════════════
# APPLICATION METHOD
# ══════════════════════════════════════════════════════════════════════

APPLY_METHOD: list[KeywordEntry] = [
    KeywordEntry(
        canonical="email",
        weight=1.0,
        synonyms={
            "en": ["send your cv to", "email your resume", "send resume to",
                   "email your cv", "submit your cv via email", "apply via email",
                   "apply by email", "forward your cv", "attach your cv"],
            "az": ["cv-nizi göndərin", "müraciət emailə", "göndər cv"],
            "tr": ["cv'nizi gönderin", "e-posta ile başvurun", "cv gönderin"],
            "ru": ["отправьте резюме", "направьте резюме", "присылайте cv",
                   "резюме на почту", "отправить cv"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="external",
        weight=0.8,
        synonyms={
            "en": ["apply on our website", "apply on company website", "apply through our portal",
                   "visit our careers page", "application portal", "apply at",
                   "click here to apply", "apply through the link"],
            "az": ["müraciət linki", "şirkətin saytında müraciət"],
            "tr": ["şirket sitesinden başvurun", "başvuru linki"],
            "ru": ["подать заявку на сайте", "перейти по ссылке", "подать заявку через"],
        },
        negatives=[],
    ),
]


# ══════════════════════════════════════════════════════════════════════
# COMPILED MATCHER
# ══════════════════════════════════════════════════════════════════════

class CompiledDictionary:
    """Pre-compiled regex patterns for a keyword category."""

    def __init__(self, entries: list[KeywordEntry]):
        self.entries = entries
        self._positive_patterns: list[tuple[re.Pattern, KeywordEntry, str]] = []
        self._negative_patterns: list[re.Pattern] = []

        for entry in entries:
            # Compile negative patterns
            for neg in entry.negatives:
                self._negative_patterns.append(
                    re.compile(re.escape(neg), re.IGNORECASE)
                )

            # Compile positive patterns per language
            for lang, terms in entry.synonyms.items():
                for term in terms:
                    # Use word boundary for single words, looser match for phrases
                    if " " in term or "-" in term:
                        pattern = re.compile(re.escape(term), re.IGNORECASE)
                    else:
                        pattern = re.compile(r'\b' + re.escape(term) + r'\b', re.IGNORECASE)
                    self._positive_patterns.append((pattern, entry, lang))

    def match(self, text: str) -> list[KeywordMatch]:
        """Find all keyword matches in text, excluding negatives."""
        if not text:
            return []

        text_lower = text.lower()

        # Find negative regions — positions where negatives match
        negative_spans: list[tuple[int, int]] = []
        for neg_pat in self._negative_patterns:
            for m in neg_pat.finditer(text):
                negative_spans.append((m.start(), m.end()))

        results: list[KeywordMatch] = []
        seen_canonicals: set[str] = set()

        for pattern, entry, lang in self._positive_patterns:
            if entry.canonical in seen_canonicals:
                continue

            for m in pattern.finditer(text):
                # Check if this match falls within a negative span
                match_start, match_end = m.start(), m.end()
                in_negative = any(
                    ns <= match_start and match_end <= ne
                    for ns, ne in negative_spans
                )
                if in_negative:
                    continue

                seen_canonicals.add(entry.canonical)
                results.append(KeywordMatch(
                    canonical=entry.canonical,
                    weight=entry.weight,
                    matched_text=m.group(0),
                    lang=lang,
                ))
                break  # one match per entry is enough

        return results

    def best_match(self, text: str) -> Optional[KeywordMatch]:
        """Return the highest-weight match, or None."""
        matches = self.match(text)
        if not matches:
            return None
        return max(matches, key=lambda m: m.weight)


# Pre-compile all dictionaries at import time
WORK_MODE_DICT = CompiledDictionary(WORK_MODE)
JOB_TYPE_DICT = CompiledDictionary(JOB_TYPE)
SENIORITY_DICT = CompiledDictionary(SENIORITY)
APPLY_METHOD_DICT = CompiledDictionary(APPLY_METHOD)
