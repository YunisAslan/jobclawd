"""
Extract job metadata (experience, salary, job type, work mode) from text.

Supports: English, Azerbaijani, Russian, Turkish.
Strategy: cast to lowercase once, match against multilingual keyword banks.
"""

import re
from typing import Optional


# ── Experience ──────────────────────────────────────────────────────

# Patterns for "X years experience" in multiple languages
_YEAR_RANGE = re.compile(
    r'(\d{1,2})\s*[\-–—]\s*(\d{1,2})\s*\+?\s*'
    r'(?:years?|yrs?|il|год[а-я]*|yıl|sene|ил)'
    r'(?:\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?'
    r'(?:experience|təcrübə|опыт[а-я]*|deneyim|iş\s*təcrübəsi))\b',
    re.IGNORECASE,
)
_YEAR_SINGLE = re.compile(
    r'(\d{1,2})\s*(\+)?\s*'
    r'(?:years?|yrs?|il|год[а-я]*|yıl|sene|ил)'
    r'(?:\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?'
    r'(?:experience|təcrübə|опыт[а-я]*|deneyim|iş\s*təcrübəsi))\b',
    re.IGNORECASE,
)
# "experience: 3 years", "təcrübə: 2 il", "опыт: 5 лет"
_EXP_LABEL_THEN_NUM = re.compile(
    r'(?:experience|years?\s+of\s+experience|relevant\s+experience|work\s+experience'
    r'|təcrübə|iş\s*təcrübəsi|опыт|deneyim|tecrübe|staj)'
    r'\s*[:：\-–—]\s*'
    r'(\d{1,2})\s*[\-–—]?\s*(\d{1,2})?\s*\+?\s*'
    r'(?:years?|yrs?|il|год[а-я]*|yıl|sene|ил)?',
    re.IGNORECASE,
)
# "minimum 3 years", "ən azı 2 il", "минимум 3 года", "en az 2 yıl"
_MIN_YEARS = re.compile(
    r'(?:minimum|min\.?|ən\s*az[ıi]?|минимум|минимальный|en\s*az|at\s*least)\s*'
    r'(\d{1,2})\s*\+?\s*'
    r'(?:years?|yrs?|il|год[а-я]*|yıl|sene|ил)'
    r'(?:\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?'
    r'(?:experience|təcrübə|опыт[а-я]*|deneyim|iş\s*təcrübəsi))?',
    re.IGNORECASE,
)
_NO_EXPERIENCE = re.compile(
    r'\b(?:no\s+experience(?:\s+required)?|experience\s+not\s+required'
    r'|təcrübə\s+tələb\s+olunmur|без\s+опыта|deneyim\s+gerekm(?:ez|iyor))\b',
    re.IGNORECASE,
)

_LEVEL_PATTERNS = [
    # Senior
    (re.compile(
        r'\b(?:senior|sr\.?|baş\s*mütəxəssis|старший|kıdemli|bаş)\b', re.IGNORECASE
    ), "Senior"),
    # Lead / Principal
    (re.compile(
        r'\b(?:lead|principal|staff|team\s*lead|rəhbər|ведущий|руководитель|lider|takım\s*lideri)\b', re.IGNORECASE
    ), "Lead"),
    # Mid-level
    (re.compile(
        r'\b(?:mid[\s\-]?level|mid[\s\-]?senior|middle|orta\s*səviyyə|средний|orta\s*düzey)\b', re.IGNORECASE
    ), "Mid-level"),
    # Junior
    (re.compile(
        r'\b(?:junior|jr\.?|kiçik\s*mütəxəssis|младший|kıdemsiz)\b', re.IGNORECASE
    ), "Junior"),
    # Entry-level / Intern
    (re.compile(
        r'\b(?:intern(?:ship)?|entry[\s\-]?level|trainee|fresher|stажер|стажёр|стажер'
        r'|təcrübəçi|stajer|stajyer|başlangıç)\b', re.IGNORECASE
    ), "Entry-level"),
]


def extract_experience(text: str) -> Optional[str]:
    """Extract experience level or required years from text."""
    if not text:
        return None

    if _NO_EXPERIENCE.search(text):
        return "No experience"

    # "experience: X-Y years" or "təcrübə: X il"
    m = _EXP_LABEL_THEN_NUM.search(text)
    if m:
        lo = m.group(1)
        hi = m.group(2)
        if hi:
            return f"{lo}-{hi} years"
        return f"{lo}+ years"

    # "minimum X years"
    m = _MIN_YEARS.search(text)
    if m:
        return f"{m.group(1)}+ years"

    # "X-Y years"
    m = _YEAR_RANGE.search(text)
    if m:
        return f"{m.group(1)}-{m.group(2)} years"

    # "X years" / "X+ years"
    m = _YEAR_SINGLE.search(text)
    if m:
        n = int(m.group(1))
        if n == 0:
            return None
        plus = "+" if m.group(2) else ""
        return f"{n}{plus} {'year' if n == 1 else 'years'}"

    # Named levels
    t = text.lower()
    for pattern, label in _LEVEL_PATTERNS:
        if pattern.search(t):
            return label

    return None


# ── Salary ──────────────────────────────────────────────────────────

_CURRENCIES = r'[\$€£₼₺₽]'
_CURRENCY_CODES = r'(?:USD|EUR|GBP|AZN|TRY|RUB|TL|manat|манат|руб(?:л[а-я]*)?|сом|₸|тенге)'
_PERIOD_SUFFIXES = (
    r'(?:\s*(?:/\s*(?:yr|year|mo|month|hr|hour|ay|aylıq|ай|мес|месяц|annual|monthly|hourly))'
    r'|\s+(?:(?:per|a|an)\s+(?:year|month|hour|annum|week|day)'
    r'|v\s+(?:месяц|год)|a\s+week|a\s+day|a\s+month|a\s+year|an\s+hour))?'
)

# "$1000-$2000", "€50k", "1000-2000 AZN", "₼800", "50 000 ₽"
_SALARY_SYMBOL_FIRST = re.compile(
    _CURRENCIES + r'\s*\d[\d,\.]*(?:\s\d{3})*[kK]?'
    r'(?:\s*[\-–—]\s*' + _CURRENCIES + r'?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?)?'
    + _PERIOD_SUFFIXES,
    re.IGNORECASE,
)
_SALARY_CODE_AFTER = re.compile(
    r'\d[\d,\.]*(?:\s\d{3})*[kK]?\s*(?:[\-–—]\s*\d[\d,\.]*(?:\s\d{3})*[kK]?)?\s*' + _CURRENCY_CODES
    + _PERIOD_SUFFIXES,
    re.IGNORECASE,
)
_SALARY_TEXTUAL_PERIOD = re.compile(
    _CURRENCIES + r'\s*\d[\d,\.]*(?:\s\d{3})*[kK]?'
    r'(?:\s*[\-–—]\s*' + _CURRENCIES + r'?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?)?'
    r'\s+(?:per|a|an)\s+(?:year|month|hour|week|day)',
    re.IGNORECASE,
)
_SALARY_UP_TO = re.compile(
    r'(?:up\s*to|upto|maximum|max\.?|adək|qədər|до)\s*'
    r'(' + _CURRENCIES + r'?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?'
    r'(?:\s*' + _CURRENCY_CODES + r')?'
    r'(?:\s+(?:per|a|an)\s+(?:year|month|hour|week|day)|\s*/\s*(?:yr|year|mo|month|hr|hour))?'
    r')',
    re.IGNORECASE,
)

# "salary: 1000-2000", "maaş: 800 AZN", "зарплата: 50000 руб", "əmək haqqı: 1000"
_SALARY_LABELED = re.compile(
    r'(?:salary|wage|compensation|pay'
    r'|maa[şs]|əmək\s*haqq[ıi]|ödəniş'
    r'|зарплата|оклад|оплата|з/?п'
    r'|maaş|ücret|gelir)'
    r'\s*[:：\-–—]\s*'
    r'(' + _CURRENCIES + r'?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?\s*(?:[\-–—]\s*' + _CURRENCIES + r'?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?)?\s*'
    + _CURRENCY_CODES + r'?' + _PERIOD_SUFFIXES + r')',
    re.IGNORECASE,
)

# "from 500 to 1000 AZN", "от 50000 до 80000", "dan 1000 a 2000"
_SALARY_FROM_TO = re.compile(
    r'(?:from|от|dan|-dən|-dan)\s+'
    r'(' + _CURRENCIES + r'?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?)\s*'
    r'(?:to|до|a\s|(?:-[yə])?a(?:dək)?|[-–—])\s*'
    r'(' + _CURRENCIES + r'?\s*\d[\d,\.]*(?:\s\d{3})*[kK]?)\s*'
    r'(' + _CURRENCY_CODES + r')?',
    re.IGNORECASE,
)


def extract_salary(text: str) -> Optional[str]:
    """Extract salary information from text."""
    if not text:
        return None

    m = _SALARY_UP_TO.search(text)
    if m:
        return _clean_salary(m.group(0))

    # Labeled salary lines (highest confidence)
    m = _SALARY_LABELED.search(text)
    if m:
        return _clean_salary(m.group(1))

    # "from X to Y"
    m = _SALARY_FROM_TO.search(text)
    if m:
        lo, hi = m.group(1).strip(), m.group(2).strip()
        cur = (m.group(3) or "").strip()
        return _clean_salary(f"{lo}-{hi} {cur}")

    # Symbol-first: $1000, ₼800-1200
    m = _SALARY_SYMBOL_FIRST.search(text)
    if m:
        return _clean_salary(m.group(0))

    m = _SALARY_TEXTUAL_PERIOD.search(text)
    if m:
        return _clean_salary(m.group(0))

    # Code-after: 1000-2000 AZN
    m = _SALARY_CODE_AFTER.search(text)
    if m:
        return _clean_salary(m.group(0))

    return None


def _clean_salary(s: str) -> str:
    """Normalize whitespace in extracted salary string."""
    return re.sub(r'\s+', ' ', s).strip()


# ── Job Type ────────────────────────────────────────────────────────

_JOB_TYPE_PATTERNS = [
    # Full-time
    (re.compile(
        r'\b(?:full[\s\-]?time|tam\s*(?:iş\s*günü|ştat|zamanlı|vaxt)|полн(?:ый|ая)\s*(?:занятость|ставка)|tam\s*gün)\b',
        re.IGNORECASE,
    ), "Full-time"),
    # Part-time
    (re.compile(
        r'\b(?:part[\s\-]?time|yarım\s*(?:iş\s*günü|ştat|vaxt)|natamam|неполн(?:ый|ая)\s*(?:занятость|ставка)|частичн|yarı\s*zamanlı)\b',
        re.IGNORECASE,
    ), "Part-time"),
    # Contract
    (re.compile(
        r'\b(?:contract(?:or)?|müqavilə|sözləşmə|контракт|договор|подряд|sözleşme)\b',
        re.IGNORECASE,
    ), "Contract"),
    # Freelance
    (re.compile(
        r'\b(?:freelanc(?:e|er|ing)|frilans|фриланс|serbest)\b',
        re.IGNORECASE,
    ), "Freelance"),
    # Temporary
    (re.compile(
        r'\b(?:temporary|temp\b|müvəqqəti|временн(?:ый|ая)|geçici)\b',
        re.IGNORECASE,
    ), "Temporary"),
    # Internship
    (re.compile(
        r'\b(?:internship|intern\b|təcrübə\s*proqramı|стажировка|staj(?:yerlik)?)\b',
        re.IGNORECASE,
    ), "Internship"),
    # Seasonal
    (re.compile(
        r'\b(?:seasonal|mövsümi|сезонн(?:ый|ая)|sezonluk)\b',
        re.IGNORECASE,
    ), "Seasonal"),
]


def extract_job_type(text: str) -> Optional[str]:
    """Extract job type from text."""
    if not text:
        return None
    for pattern, label in _JOB_TYPE_PATTERNS:
        if pattern.search(text):
            return label
    return None


# ── Work Mode ───────────────────────────────────────────────────────

_WORK_MODE_PATTERNS = [
    # Remote
    (re.compile(
        r'\b(?:remote(?:ly)?|work\s*from\s*home|wfh'
        r'|uzaqdan|distant|evdən\s*iş'
        r'|удалённ(?:ый|ая|о|ая\s*работа)|дистанционн'
        r'|uzaktan|evden\s*çalışma)\b',
        re.IGNORECASE,
    ), "Remote"),
    # Hybrid
    (re.compile(
        r'\b(?:hybrid|hibrid|гибрид|смешанн|hibrit)\b',
        re.IGNORECASE,
    ), "Hybrid"),
    # On-site
    (re.compile(
        r'\b(?:on[\s\-]?site|in[\s\-]?office|ofisdə|в\s*офисе|офисн|ofiste)\b',
        re.IGNORECASE,
    ), "On-site"),
    (re.compile(
        r'\b(?:in\s+person|office[-\s]?based|presential)\b',
        re.IGNORECASE,
    ), "On-site"),
]


def extract_work_mode(text: str) -> Optional[str]:
    """Extract work mode from text."""
    if not text:
        return None
    for pattern, label in _WORK_MODE_PATTERNS:
        if pattern.search(text):
            return label
    return None


# ── Public API ──────────────────────────────────────────────────────

def extract_all(text: str) -> dict:
    """Extract all metadata fields from text. Returns dict with non-None values only."""
    if not text:
        return {}
    result = {}
    exp = extract_experience(text)
    if exp:
        result["experience_str"] = exp
    sal = extract_salary(text)
    if sal:
        result["salary_str"] = sal
    jt = extract_job_type(text)
    if jt:
        result["job_type_str"] = jt
    wm = extract_work_mode(text)
    if wm:
        result["work_mode_str"] = wm
    return result
