"""
Extract normalized vacancy metadata from heterogeneous job text.

Supports English, Azerbaijani, Russian, and Turkish.
The parser separates seniority from years-of-experience and keeps a
compatibility alias for older code paths that still read experience_str.
"""

from __future__ import annotations

import re
from typing import Optional


def _clean(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = " ".join(value.split()).strip()
    return cleaned or None


# ── Experience / Seniority ────────────────────────────────────────

_YEAR_UNIT = r"(?:years?|yrs?|year|yr|il|illik|год[а-я]*|лет|yıl|sene)"
_EXPERIENCE_WORD = (
    r"(?:experience|relevant experience|professional experience|work experience|"
    r"working experience|hands[\s\-]?on experience|industry experience|"
    r"software (?:development |engineering )?experience|"
    r"programming experience|coding experience|development experience|"
    r"engineering experience|technical experience|practical experience|"
    r"commercial experience|production experience|real[\s\-]?world experience|"
    r"təcrübə|iş\s*təcrübəsi|peşə\s*təcrübəsi|опыт[а-я]*|стаж[а-я]*|"
    r"deneyim|tecrübe|iş\s*deneyimi|Erfahrung|expérience|experiencia)"
)
_ROLE_WORD = (
    # ── Tech / Engineering ──
    r"(?:engineer|developer|architect|designer|programmer|coder|technologist|"
    r"software|backend|frontend|full[\s\-]?stack|mobile|web|cloud|devops|sre|"
    r"platform|infrastructure|embedded|firmware|systems|network|security|"
    r"data|machine\s*learning|ML|AI|qa|test|automation|reliability|"
    # ── Product / Project / Operations ──
    r"|product|project|program|operations|strategy|business|process|"
    r"supply\s*chain|logistics|procurement|vendor|planning|"
    # ── Marketing / Growth ──
    r"|marketing|digital\s*marketing|growth|brand|content|seo|sem|ppc|"
    r"performance\s*marketing|social\s*media|email\s*marketing|"
    r"communications?|advertising|media|creative|"
    # ── Sales / BD ──
    r"|sales|business\s*development|account|key\s*account|territory|"
    r"inside\s*sales|revenue|partnerships?|customer\s*success|"
    r"lead\s*generation|pre[\s\-]?sales|"
    # ── Design ──
    r"|design|ui|ux|product\s*design|graphic|visual|motion|interaction|"
    r"ux\s*research|"
    # ── HR / People ──
    r"|hr|human\s*resources?|recruiter|recruiting|talent\s*acquisition|"
    r"people\s*operations?|people|compensation|benefits|training|"
    r"organizational\s*development|"
    # ── Finance / Accounting ──
    r"|finance|financial|accounting|accountant|audit|auditor|tax|"
    r"payroll|treasury|investment|risk|compliance|controller|"
    r"bookkeep|billing|"
    # ── Customer / Support ──
    r"|support|customer\s*support|technical\s*support|help\s*desk|"
    r"customer\s*service|call\s*center|service\s*desk|"
    # ── Admin / Legal / Other ──
    r"|admin|administrative|office|executive\s*assistant|legal|"
    r"paralegal|translator|interpreter|procurement|"
    r"coordinator|supervisor|"
    # ── Generic seniority / level words ──
    r"|specialist|analyst|consultant|advisor|administrator|"
    r"manager|director|lead|staff|principal|"
    r"senior|junior|mid[\s\-]?level|associate|generalist|"
    r"intern|professional|practitioner|contributor|representative)"
)

_YEAR_PATTERNS = [
    re.compile(
        rf"(?:{_EXPERIENCE_WORD}|years?\s+of\s+experience)\s*[:：\-–—]\s*"
        rf"(\d{{1,2}})\s*(?:[\-–—]|to)\s*(\d{{1,2}})\s*{_YEAR_UNIT}?",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:{_EXPERIENCE_WORD}|years?\s+of\s+experience)\s*[:：\-–—]\s*"
        rf"(\d{{1,2}})\s*(\+)?\s*{_YEAR_UNIT}?",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:minimum|min\.?|at\s+least|atleast|at\s+minimum|"
        rf"ən\s*az[ıi]?|минимум|не\s+менее|как\s+минимум|"
        rf"en\s*az|asgari)\s*"
        rf"(\d{{1,2}})\s*(\+)?\s*{_YEAR_UNIT}"
        rf"(?:\s+(?:of\s+)?{_EXPERIENCE_WORD})?",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(\d{{1,2}})\s*(?:\+)?\s*(?:[\-–—]|to)\s*(\d{{1,2}})\s*{_YEAR_UNIT}"
        rf"(?:\s+(?:of\s+)?{_EXPERIENCE_WORD})?",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(\d{{1,2}})\s*(\+)?\s*{_YEAR_UNIT}"
        rf"(?:\s+(?:of\s+)?{_EXPERIENCE_WORD})?",
        re.IGNORECASE,
    ),
]

_NO_EXPERIENCE = re.compile(
    r"\b(?:no\s+experience(?:\s+required)?|experience\s+not\s+required|"
    r"təcrübə\s+tələb\s+olunmur|без\s+опыта|deneyim\s+gerekm(?:ez|iyor))\b",
    re.IGNORECASE,
)

_COMPANY_AGE_CONTEXT = re.compile(
    r"\b(?:founded|established|operating|for\s+over|over|more\s+than|since|"
    r"company|organization|firm|business|team)\b",
    re.IGNORECASE,
)

_SENIORITY_PATTERNS: list[tuple[re.Pattern, str]] = [
    # ── Intern / Trainee ──
    (re.compile(r"\b(?:intern(?:ship)?|staj(?:yer|yerlik)?|стаж(?:ёр|ер)|practicum|trainee|graduate\s+trainee)\b", re.IGNORECASE), "Intern"),
    # ── New Grad ──
    (re.compile(r"\b(?:new[\s\-]?grad(?:uate)?|graduate\s+(?:hire|engineer|developer)|campus\s+hire|recent\s+graduate|fresh\s+graduate)\b", re.IGNORECASE), "New Grad"),
    # ── Early Career ──
    (re.compile(r"\b(?:early[\s\-]?career|entry[\s\-]?level|fresher|beginner|starter)\b", re.IGNORECASE), "Early Career"),
    # ── Junior (including non-tech: coordinator, assistant) ──
    (re.compile(
        r"\b(?:junior|jr\.?"
        r"|kiçik\s+mütəxəssis|младший|джуниор|kıdemsiz"
        r")\b",
        re.IGNORECASE
    ), "Junior"),
    # ── Mid-level (including non-tech: specialist, analyst, consultant, representative) ──
    (re.compile(
        r"\b(?:mid[\s\-]?level|mid[\s\-]?senior|middle|intermediate|associate"
        r"|generalist\s+mid[\s\-]?level|mid[\s\-]?career"
        r"|orta\s*(?:səviyyə)?|средний|мидл|миддл"
        r"|orta\s*(?:düzey|seviye|kıdem))\b",
        re.IGNORECASE
    ), "Mid-level"),
    # ── Senior ──
    (re.compile(
        r"\b(?:senior|sr\.?|baş\s*mütəxəssis|böyük\s*mütəxəssis|старший|синьор|сениор"
        r"|kıdemli|uzman|deneyimli|seasoned|veteran)\b",
        re.IGNORECASE
    ), "Senior"),
    # ── Lead / Principal / Staff ──
    (
        re.compile(
            rf"\b(?:team\s+lead|tech(?:nical)?\s+lead|lead\s+{_ROLE_WORD}|"
            rf"principal\s+{_ROLE_WORD}|staff\s+{_ROLE_WORD}|"
            rf"distinguished\s+{_ROLE_WORD}|"
            rf"head\s+of\s+\w+|director|vp|vice\s+president"
            rf"|architect|solutions?\s+architect"
            rf"|тимлид|техлид|ведущий\s+разработчик"
            rf"|takım\s+lideri|teknik\s+lider"
            rf"|komanda\s+rəhbəri|texniki\s+rəhbər)\b",
            re.IGNORECASE,
        ),
        "Lead",
    ),
    # ── Manager (all industries) ──
    (re.compile(
        r"\b(?:manager|engineering\s+manager|development\s+manager|technical\s+manager"
        r"|marketing\s+manager|brand\s+manager|growth\s+(?:marketing\s+)?manager"
        r"|sales\s+manager|business\s+development\s+manager|territory\s+(?:sales\s+)?manager"
        r"|hr\s+manager|people\s+operations\s+manager|talent\s+acquisition\s+manager"
        r"|finance\s+manager|accounting\s+manager"
        r"|operations\s+manager|supply\s+chain\s+manager|strategy\s+manager"
        r"|customer\s+success\s+manager|support\s+manager"
        r"|product\s+manager|project\s+manager|program\s+manager"
        r"|regional\s+manager|area\s+manager|country\s+manager"
        r"|general\s+manager|department\s+head"
        r"|menecer|müdir|менеджер|yönetici|müdür)\b",
        re.IGNORECASE
    ), "Manager"),
    # ── Executive / C-Level ──
    (re.compile(
        r"\b(?:c[\s\-]?level|c[\s\-]?suite|CTO|CIO|CPO|CMO|CFO|COO|CEO|CHRO"
        r"|SVP|EVP"
        r"|chief\s+(?:technology|information|engineering|product|marketing|financial|operating|executive|people|revenue|data)\s+officer"
        r"|senior\s+vice\s+president|executive\s+vice\s+president)\b",
        re.IGNORECASE
    ), "Executive"),
]

# Patterns that look like seniority but aren't — used by extract_seniority()
_SENIORITY_FALSE_POSITIVES = re.compile(
    r"\b(?:sales\s+executive|executive\s+assistant|executive\s+search|executive\s+summary"
    r"|executive\s+recruiter|executive\s+recruiting"
    r"|lead\s+generation|lead\s+management|lead\s+nurturing|lead\s+scoring"
    r"|lead\s+qualification|lead\s+conversion|lead\s+pipeline|lead\s+capture"
    r"|lead\s+gen\b)\b",
    re.IGNORECASE,
)

_SENIORITY_NORMALIZERS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bnew[\s\-]?grad(?:uate)?\b|\brecent\s+graduate\b|\bfresh\s+graduate\b|\bcampus\s+hire\b", re.IGNORECASE), "New Grad"),
    (re.compile(r"\bearly[\s\-]?career\b", re.IGNORECASE), "Early Career"),
    (re.compile(r"\bentry[\s\-]?level\b|\bfresher\b|\bbeginner\b", re.IGNORECASE), "Early Career"),
    (re.compile(r"\bintern(?:ship)?\b|\btrainee\b", re.IGNORECASE), "Intern"),
    (re.compile(r"\bjunior\b|\bjr\.?\b|\bджуниор\b", re.IGNORECASE), "Junior"),
    (re.compile(r"\bmid[\s\-]?level\b|\bmid[\s\-]?senior\b|\bmiddle\b|\bintermediate\b|\bassociate\b|\bmid[\s\-]?career\b|\bмидл\b|\bмиддл\b|\bсредний\b", re.IGNORECASE), "Mid-level"),
    (re.compile(r"\bsenior\b|\bsr\.?\b|\bсиньор\b|\bсениор\b|\bсеньор\b|\bstarший\b", re.IGNORECASE), "Senior"),
    (re.compile(r"\blead\b|\bprincipal\b|\bstaff\b|\bteam\s+lead\b|\btech(?:nical)?\s+lead\b|\bdistinguished\b|\barchitect\b|\bтимлид\b|\bтехлид\b", re.IGNORECASE), "Lead"),
    (re.compile(r"\bmanager\b|\bdirector\b|\bhead\s+of\b|\bvice\s+president\b|\bvp\b|\bменеджер\b|\bмüдир\b", re.IGNORECASE), "Manager"),
    (re.compile(r"\bc[\s\-]?level\b|\bCTO\b|\bCIO\b|\bCPO\b|\bCMO\b|\bCFO\b|\bCOO\b|\bCEO\b|\bSVP\b|\bEVP\b", re.IGNORECASE), "Executive"),
]


def normalize_seniority(value: object) -> Optional[str]:
    cleaned = _clean(value)
    if not cleaned:
        return None
    for pattern, label in _SENIORITY_NORMALIZERS:
        if pattern.search(cleaned):
            return label
    return None


def _years_context_is_false_positive(text: str, match: re.Match) -> bool:
    start = max(0, match.start() - 80)
    end = min(len(text), match.end() + 60)
    window = text[start:end]

    # If there's an explicit experience word nearby, it's NOT a false positive
    if re.search(_EXPERIENCE_WORD, window, re.IGNORECASE):
        return False

    # Company age / founding signals
    if re.search(r"\b(?:founded|established|since|incorporated|started\s+in|created\s+in)\b", window, re.IGNORECASE):
        return True

    # Statistics / headcount / non-experience numbers
    if re.search(
        r"\b(?:active\s+communities|daily\s+active|employees|people|visitors|"
        r"users|customers|clients|members|subscribers|partners|offices|"
        r"countries|locations|markets|cities|hubs|regions|"
        r"team\s+members|staff\s+members|headcount|workforce|"
        r"revenue|transactions|requests?\s+per\s+day|"
        r"million|billion|thousand|100,?\s*000)\b",
        window, re.IGNORECASE,
    ):
        return True

    # Company age context without experience word
    if _COMPANY_AGE_CONTEXT.search(window):
        return True

    return False


def _format_years(low: str, high: Optional[str] = None, plus: bool = False) -> str:
    lo = int(low)
    if high:
        hi = int(high)
        return f"{lo}-{hi} years"
    if plus:
        return f"{lo}+ years"
    return f"{lo} year" if lo == 1 else f"{lo} years"


def normalize_experience_years(value: object) -> Optional[str]:
    cleaned = _clean(value)
    if not cleaned or _NO_EXPERIENCE.search(cleaned):
        return None

    for pattern in _YEAR_PATTERNS:
        for match in pattern.finditer(cleaned):
            if _years_context_is_false_positive(cleaned, match):
                continue
            groups = match.groups()
            if len(groups) >= 2 and groups[1] and groups[1].isdigit():
                return _format_years(groups[0], groups[1])
            return _format_years(groups[0], plus=bool(groups[1] if len(groups) > 1 else False))
    return None


def extract_seniority(text: str) -> Optional[str]:
    if not text:
        return None
    # First strip false positives so they don't match
    cleaned = _SENIORITY_FALSE_POSITIVES.sub("", text)
    for pattern, label in _SENIORITY_PATTERNS:
        if pattern.search(cleaned):
            return label
    return None


def extract_experience_years(text: str) -> Optional[str]:
    if not text:
        return None
    return normalize_experience_years(text)


def primary_experience_value(
    seniority: Optional[str],
    experience_years: Optional[str],
) -> Optional[str]:
    return seniority or experience_years


def split_experience_value(value: object) -> tuple[Optional[str], Optional[str]]:
    cleaned = _clean(value)
    if not cleaned:
        return None, None
    seniority = normalize_seniority(cleaned)
    years = normalize_experience_years(cleaned)
    if years:
        return None, years
    if seniority:
        return seniority, None
    return None, None


def extract_experience(text: str) -> Optional[str]:
    """Backward-compatible alias used by older call sites."""
    if not text:
        return None
    if _NO_EXPERIENCE.search(text):
        return "No experience"
    seniority = extract_seniority(text)
    years = extract_experience_years(text)
    return primary_experience_value(seniority, years)


# ── Salary ────────────────────────────────────────────────────────

_CURRENCIES = r"[\$€£₼₺₽]"
_CURRENCY_CODES = r"(?:USD|EUR|GBP|AZN|TRY|RUB|TL|manat|манат|руб(?:л[а-я]*)?|сом|₸|тенге|CAD)"
_PERIOD_SUFFIXES = (
    r"(?:\s*(?:/\s*(?:yr|year|mo|month|hr|hour|week|day|annual|monthly|hourly))"
    r"|\s+(?:(?:per|a|an)\s+(?:year|month|hour|annum|week|day)))?"
)

_SALARY_SYMBOL_FIRST = re.compile(
    _CURRENCIES + r"\s*\d[\d,\.]*(?:\s\d{3})*[kK]?"
    r"(?:\s*[\-–—]\s*" + _CURRENCIES + r"?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?)?"
    + _PERIOD_SUFFIXES,
    re.IGNORECASE,
)
_SALARY_CODE_AFTER = re.compile(
    r"\d[\d,\.]*(?:\s\d{3})*[kK]?\s*(?:[\-–—]\s*\d[\d,\.]*(?:\s\d{3})*[kK]?)?\s*" + _CURRENCY_CODES
    + _PERIOD_SUFFIXES,
    re.IGNORECASE,
)
_SALARY_UP_TO = re.compile(
    r"(?:up\s*to|upto|maximum|max\.?|adək|qədər|до)\s*"
    r"(" + _CURRENCIES + r"?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?"
    r"(?:\s*" + _CURRENCY_CODES + r")?"
    r"(?:\s+(?:per|a|an)\s+(?:year|month|hour|week|day)|\s*/\s*(?:yr|year|mo|month|hr|hour))?"
    r")",
    re.IGNORECASE,
)
_SALARY_LABELED = re.compile(
    r"(?:salary|wage|compensation|pay|maa[şs]|əmək\s*haqq[ıi]|ödəniş|"
    r"зарплата|оклад|оплата|z/?p|ücret|gelir)\s*[:：\-–—]\s*"
    r"(" + _CURRENCIES + r"?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?\s*(?:[\-–—]\s*" + _CURRENCIES + r"?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?)?\s*"
    + _CURRENCY_CODES + r"?" + _PERIOD_SUFFIXES + r")",
    re.IGNORECASE,
)
_SALARY_FROM_TO = re.compile(
    r"(?:from|от|dan|-dən|-dan)\s+"
    r"(" + _CURRENCIES + r"?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?)\s*"
    r"(?:to|до|a\s|(?:-[yə])?a(?:dək)?|[-–—])\s*"
    r"(" + _CURRENCIES + r"?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?)\s*"
    r"(" + _CURRENCY_CODES + r")?",
    re.IGNORECASE,
)


def _is_false_salary(text: str, match: re.Match) -> bool:
    end = match.end()
    rest = text[end:end + 5].lstrip()
    matched = match.group(0)
    if rest.startswith("%") or "%" in matched:
        return True
    if re.search(r"\b(?:discount|bonus|commission|off)\b", matched, re.IGNORECASE):
        return True
    return False


def _clean_salary(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract_salary(text: str) -> Optional[str]:
    if not text:
        return None

    for pattern, extractor in (
        (_SALARY_UP_TO, lambda m: m.group(0)),
        (_SALARY_LABELED, lambda m: m.group(1)),
        (_SALARY_FROM_TO, lambda m: f"{m.group(1).strip()}-{m.group(2).strip()} {(m.group(3) or '').strip()}"),
        (_SALARY_SYMBOL_FIRST, lambda m: m.group(0)),
        (_SALARY_CODE_AFTER, lambda m: m.group(0)),
    ):
        match = pattern.search(text)
        if match and not _is_false_salary(text, match):
            return _clean_salary(extractor(match))
    return None


# ── Job Type ──────────────────────────────────────────────────────

_JOB_TYPE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(
        r"\b(?:full[\s\-]?time|permanent|regular\s+employee|fte|"
        r"permanent\s+(?:position|role|employment)|staff\s+(?:position|role)|"
        r"salaried\s+(?:position|role|employee)|indefinite\s+contract|"
        r"regular\s+(?:position|employment)|"
        r"tam\s*(?:iş\s*günü|ştat|zamanlı|vaxt)|daimi|"
        r"полн(?:ый|ая)\s*(?:занятость|ставка)|постоянн(?:ый|ая)|в\s*штат|"
        r"tam\s*gün|kadrolu|"
        r"vollzeit|temps\s+plein|CDI|tiempo\s+completo)\b",
        re.IGNORECASE
    ), "Full-time"),
    (re.compile(
        r"\b(?:part[\s\-]?time|p/t|"
        r"yarım\s*(?:iş\s*günü|ştat|vaxt)|natamam|"
        r"неполн(?:ый|ая)\s*(?:занятость|ставка)|частичн|на\s*полставки|"
        r"yarı\s*zamanlı|kısmi\s*zamanlı|"
        r"teilzeit|temps\s+partiel|medio\s+tiempo)\b",
        re.IGNORECASE
    ), "Part-time"),
    (re.compile(r"\b(?:fixed[\s\-]?term|sроков(?:ый|ая)|müddətli|belirli\s+süreli|на\s+определённый\s+срок)\b", re.IGNORECASE), "Fixed-term"),
    (re.compile(
        r"\b(?:term\s+contract|contract(?:or)?|contract[\s\-]?to[\s\-]?hire|c2h|"
        r"müqavilə|sözləşmə|контракт|договор|подряд|sözleşme|kontrat)\b",
        re.IGNORECASE
    ), "Contract"),
    (re.compile(r"\b(?:freelanc(?:e|er|ing)|frilans|фриланс|serbest|project[\s\-]?based|gig\s+work)\b", re.IGNORECASE), "Freelance"),
    (re.compile(r"\b(?:temporary|temp(?:orary)?|müvəqqəti|временн(?:ый|ая)|geçici|temp-to-perm|short[\s\-]?term)\b", re.IGNORECASE), "Temporary"),
    (re.compile(r"\b(?:internship|intern\b|co[\s\-]?op|təcrübə\s*proqramı|стажировка|staj(?:yerlik)?|work\s+placement|industrial\s+placement)\b", re.IGNORECASE), "Internship"),
    (re.compile(r"\b(?:apprentice(?:ship)?|ausbildung|çıraklık|ученичество|work[\s\-]?study)\b", re.IGNORECASE), "Apprenticeship"),
    (re.compile(r"\b(?:seasonal|mövsümi|сезонн(?:ый|ая)|sezonluk|mevsimlik)\b", re.IGNORECASE), "Seasonal"),
    (re.compile(r"\b(?:volunteer|könüllü|gönüllü|волонт[её]р)\b", re.IGNORECASE), "Volunteer"),
    (re.compile(r"\b(?:commission(?:[\s\-]?based)?|комисси(?:я|онн)|komisyon)\b", re.IGNORECASE), "Commission"),
]

_JOB_TYPE_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bfull[\s\-]?time\b|\bpermanent\b|\bfte\b|\bsalaried\b|\bstaff\s+position\b|\bindefinite\b|\bCDI\b|\bvollzeit\b", re.IGNORECASE), "Full-time"),
    (re.compile(r"\bpart[\s\-]?time\b|\bp\/t\b|\bteilzeit\b", re.IGNORECASE), "Part-time"),
    (re.compile(r"\bfixed[\s\-]?term\b", re.IGNORECASE), "Fixed-term"),
    (re.compile(r"\bcontract\b|\bcontractor\b|\bc2h\b|\bcontract[\s\-]?to[\s\-]?hire\b", re.IGNORECASE), "Contract"),
    (re.compile(r"\bfreelance\b|\bfreelancer\b|\bgig\b|\bproject[\s\-]?based\b", re.IGNORECASE), "Freelance"),
    (re.compile(r"\btemporary\b|\btemp\b|\bshort[\s\-]?term\b", re.IGNORECASE), "Temporary"),
    (re.compile(r"\binternship\b|\bintern\b|\bco[\s\-]?op\b|\bplacement\b", re.IGNORECASE), "Internship"),
    (re.compile(r"\bapprentice(?:ship)?\b|\bausbildung\b", re.IGNORECASE), "Apprenticeship"),
    (re.compile(r"\bseasonal\b", re.IGNORECASE), "Seasonal"),
    (re.compile(r"\bvolunteer\b", re.IGNORECASE), "Volunteer"),
    (re.compile(r"\bcommission\b", re.IGNORECASE), "Commission"),
]


def normalize_job_type(value: object) -> Optional[str]:
    cleaned = _clean(value)
    if not cleaned:
        return None
    for pattern, label in _JOB_TYPE_MAP:
        if pattern.search(cleaned):
            return label
    return None


def extract_job_type(text: str) -> Optional[str]:
    if not text:
        return None
    for pattern, label in _JOB_TYPE_PATTERNS:
        if pattern.search(text):
            return label
    return None


# ── Work Mode ─────────────────────────────────────────────────────

_REMOTE_PATTERNS = [
    re.compile(
        r"\b(?:fully\s+remote|100%\s+remote|remote[\s\-]?first|distributed\s+team|"
        r"work\s+remotely|work\s+from\s+home|wfh|remote\s+position|remote\s+role|"
        r"apply\s+to\s+work\s+remotely|remote\s+in\s+any\s+country|"
        r"office\s+optional|work\s+anywhere|anywhere\s+in\s+the\s+(?:country|world)|"
        r"remote\s+friendly|remote[\s\-]?only|permanent\s+remote|"
        r"remote\s+eligible|can\s+work\s+remotely|you\s+can\s+work\s+remotely|"
        r"option\s+to\s+work\s+remotely|eligible\s+to\s+work\s+remotely|"
        r"from\s+any\s+(?:location|country)|regardless\s+of\s+location|"
        r"location\s+(?:independent|flexible)|no\s+office\s+required|"
        r"flexible\s+workforce|distributed\s+workforce|distributed\s+role|"
        r"home[\s\-]?based|telecommut(?:e|ing)|telework(?:ing)?|"
        r"global\s+remote|worldwide\s+remote|no\s+geographical\s+restrictions|"
        r"remote(?:ly)?|uzaqdan|evdən\s*iş|удал[её]нн(?:ый|ая|о)|"
        r"дистанционн|uzaktan|evden\s*çalışma|"
        r"télétravail|trabajo\s+remoto|teletrabajo|homeoffice|home\s+office)\b",
        re.IGNORECASE,
    ),
]
_HYBRID_PATTERNS = [
    # Explicit hybrid keyword
    re.compile(
        r"\b(?:hybrid|hibrid|hibrit|гибрид(?:ный|ная)?|смешанн(?:ый|ая)?|"
        r"hybrid\s+(?:schedule|model|role|position|work|arrangement|environment|policy)|"
        r"hybride|híbrido)\b|#hybrid\b",
        re.IGNORECASE,
    ),
    # "X days in office / Y days remote" split pattern
    re.compile(
        r"\b\d+\s+days?\s+(?:per\s+week\s+)?(?:in|at)\s+(?:the\s+)?office\b.*\b\d+\s+days?\s+(?:remote|from\s+home)\b",
        re.IGNORECASE,
    ),
    # Split between office and remote
    re.compile(
        r"\b(?:split|balance|combination|mix)\s+(?:of\s+|between\s+)?(?:office|in[\s\-]?office|on[\s\-]?site).{0,40}(?:remote|from\s+home|home)\b",
        re.IGNORECASE,
    ),
    # "at least/minimum X days per week in office"
    re.compile(
        r"(?:at\s+least|minimum|min\.?)\s+\d+\s+days?\s+(?:per\s+|a\s+)?week\s+(?:in|at)\s+(?:the\s+)?office",
        re.IGNORECASE,
    ),
    # "expected/required to be in office X days"
    re.compile(
        r"(?:expected|required)\s+to\s+(?:be\s+in|work\s+(?:in|at|from))\s+(?:the\s+)?office\s+(?:at\s+least\s+)?\d+\s+days?",
        re.IGNORECASE,
    ),
    # "in the office at least X days per week"
    re.compile(
        r"in\s+(?:the\s+)?office\s+(?:at\s+least|minimum)\s+\d+\s+days?\s+(?:per\s+|a\s+)?week",
        re.IGNORECASE,
    ),
    # "X days in-office" pattern
    re.compile(
        r"\b\d+\s+days?\s+(?:in[\s\-]?office|on[\s\-]?site)\b",
        re.IGNORECASE,
    ),
    # "primarily/mostly in-office with some remote"
    re.compile(
        r"\b(?:primarily|mostly)\s+(?:in[\s\-]?office|on[\s\-]?site)\b",
        re.IGNORECASE,
    ),
    # "office-first" (implies hybrid, not full on-site)
    re.compile(
        r"\boffice[\s\-]?first\b",
        re.IGNORECASE,
    ),
]
_ONSITE_PATTERNS = [
    re.compile(
        r"\b(?:on[\s\-]?site|onsite|in[\s\-]?office|office[\s\-]?based|"
        r"must\s+work\s+in\s+office|in\s+person|presential|"
        r"office\s+only|100%\s+on[\s\-]?site|fully\s+on[\s\-]?site|"
        r"no\s+remote\s+(?:option|work)|5\s+days?\s+(?:in|at)\s+(?:the\s+)?office|"
        r"office\s+(?:required|mandatory)|not\s+(?:a\s+)?remote\b|"
        r"ofisdə|в\s*офисе|ofiste|"
        r"en\s+présentiel|presencial|vor\s+ort)\b",
        re.IGNORECASE,
    ),
]

_WORK_MODE_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bremote\b|\bwork\s+from\s+home\b|\bwfh\b|\btelecommut\b|\btelework\b|\btélétravail\b|\bteletrabajo\b|\bhomeoffice\b", re.IGNORECASE), "Remote"),
    (re.compile(r"\bhybrid\b|\bhibrid\b|\bhíbrido\b|\bhybride\b", re.IGNORECASE), "Hybrid"),
    (re.compile(r"\bon[\s\-]?site\b|\bonsite\b|\bon site\b|\bin[\s\-]?office\b|\bin person\b|\bpresencial\b|\bprésentiel\b", re.IGNORECASE), "On-site"),
]


def normalize_work_mode(value: object) -> Optional[str]:
    cleaned = _clean(value)
    if not cleaned:
        return None
    for pattern, label in _WORK_MODE_MAP:
        if pattern.search(cleaned):
            return label
    return None


def extract_work_mode(text: str) -> Optional[str]:
    if not text:
        return None

    if any(pattern.search(text) for pattern in _HYBRID_PATTERNS):
        return "Hybrid"
    if any(pattern.search(text) for pattern in _REMOTE_PATTERNS):
        return "Remote"
    if any(pattern.search(text) for pattern in _ONSITE_PATTERNS):
        return "On-site"
    return None


# ── Public API ────────────────────────────────────────────────────

def extract_all(text: str) -> dict:
    """Extract normalized metadata. Returns only non-empty values."""
    if not text:
        return {}

    result: dict[str, str] = {}

    seniority = extract_seniority(text)
    if seniority:
        result["seniority_str"] = seniority

    experience_years = extract_experience_years(text)
    if experience_years:
        result["experience_years_str"] = experience_years

    experience = primary_experience_value(seniority, experience_years)
    if experience:
        result["experience_str"] = experience

    salary = extract_salary(text)
    if salary:
        result["salary_str"] = salary

    job_type = extract_job_type(text)
    if job_type:
        result["job_type_str"] = job_type

    work_mode = extract_work_mode(text)
    if work_mode:
        result["work_mode_str"] = work_mode

    return result
