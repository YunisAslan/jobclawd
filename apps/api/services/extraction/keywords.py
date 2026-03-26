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
            "en": [
                # Explicit remote
                "fully remote", "100% remote", "remote position", "remote role",
                "remote work", "work from home", "wfh", "telecommute", "work remotely",
                "remote-first", "remote friendly", "remote-friendly", "distributed team",
                "office optional", "work anywhere", "remote in any country",
                # Flexible / optional office
                "flexible workforce", "location independent", "location-independent",
                "location flexible", "location-flexible", "no office required",
                "office attendance not required", "office attendance is not required",
                "office attendance is optional", "no geographical restrictions",
                "no location requirement", "no location restrictions",
                "open to remote", "remote eligible", "remote optional",
                "remote ok", "remote okay", "remote-eligible",
                # Apply remotely
                "apply to work remotely", "can apply to work remotely",
                "can work remotely", "you can work remotely", "option to work remotely",
                "opportunity to work remotely", "eligible to work remotely",
                "choose to work remotely", "work from anywhere",
                # Global / worldwide
                "global remote", "worldwide remote", "anywhere in the world",
                "anywhere in the country", "from any location",
                "from any country", "from wherever you are",
                "wherever you are located", "regardless of location",
                # Remote-only / virtual
                "remote-only", "remote only", "virtual position", "virtual role",
                "digital nomad", "nomad friendly", "nomad-friendly",
                "virtual team", "distributed workforce", "distributed role",
                "distributed position", "geo-distributed",
                # Phrased as freedom
                "you do not need to be in an office", "no need to be in office",
                "no need to come to office", "not required to be in office",
                "not required to come to the office",
                "work from home permanently", "permanent remote",
                "permanent work from home", "perpetual remote",
                # Common abbreviations & variations
                "wfh position", "wfh role", "wfh friendly",
                "home based", "home-based", "homebased",
                "telecommuting", "tele-work", "telework",
            ],
            "az": [
                "uzaqdan", "uzaqdan iş", "evdən iş", "distant",
                "uzaqdan işləmək", "evdən işləmək", "ofis tələb olunmur",
                "uzaqdan iş imkanı", "istənilən yerdən",
            ],
            "tr": [
                "uzaktan", "uzaktan çalışma", "evden çalışma", "remote",
                "uzaktan pozisyon", "uzaktan iş", "evden iş",
                "ofis zorunlu değil", "her yerden çalışma",
                "lokasyon bağımsız",
            ],
            "ru": [
                "удалённо", "удалённая работа", "дистанционно", "работа из дома",
                "удаленно", "удаленная работа", "удалённая позиция",
                "удалённый формат", "работа из любой точки",
                "полностью удалённо", "без привязки к офису",
                "не требуется присутствие в офисе", "из любого города",
            ],
            "de": [
                "remote arbeit", "homeoffice", "home office",
                "ortsunabhängig", "standortunabhängig",
            ],
            "fr": [
                "télétravail", "travail à distance", "100% télétravail",
                "travail à domicile",
            ],
            "es": [
                "trabajo remoto", "teletrabajo", "trabajo desde casa",
                "100% remoto", "posición remota",
            ],
        },
        negatives=[
            "not remote", "no remote", "remote is not", "this is not a remote",
            "remote support", "remote access", "remote monitoring", "remote desktop",
            "remote teams", "work with remote", "manage remote", "remote control",
            "remote sensing", "remote region", "remote server", "remote diagnostics",
            "remote administration", "remote troubleshooting", "remote infrastructure",
            "remote patient", "remote learning environment",
            "uzaqdan deyil", "не удалённо", "не удаленно", "uzaktan değil",
            "kein remote", "pas de télétravail", "no es remoto",
        ],
    ),
    KeywordEntry(
        canonical="Hybrid",
        weight=1.0,
        synonyms={
            "en": [
                # Explicit hybrid
                "hybrid", "hybrid work", "hybrid model", "hybrid schedule",
                "hybrid role", "hybrid position", "hybrid arrangement",
                "hybrid workplace", "hybrid environment", "hybrid policy",
                "hybrid-remote", "hybrid remote",
                "#hybrid",
                # Partial office
                "partial remote", "partially remote", "partially in-office",
                "flex office", "split office",
                "split between office and remote",
                "some days in office", "some days remote",
                "mix of office and remote", "mix of remote and office",
                "combination of office and remote",
                # X days in office patterns
                "days per week in office", "days per week in the office",
                "days in office per week", "days a week in office",
                "days a week in the office",
                "in-office days", "required office days",
                "office days required", "mandatory office days",
                "in the office at least", "in office at least",
                "expected to be in office", "expected in office",
                "required in office", "required to be in office",
                "come into the office at least",
                # Office-first with flexibility
                "office-first", "office first but flexible",
                "primarily in-office", "primarily in office",
                "primarily on-site", "mostly in-office", "mostly on-site",
                "flexible hybrid", "semi-remote",
            ],
            "az": [
                "hibrid", "qarışıq", "hibrid iş", "hibrid model",
                "qismən ofisdə", "qismən uzaqdan",
                "həftədə bəzi günlər ofisdə",
            ],
            "tr": [
                "hibrit", "karma çalışma", "hibrit model",
                "hibrit pozisyon", "kısmen ofiste", "kısmen uzaktan",
                "haftada bazı günler ofiste",
            ],
            "ru": [
                "гибрид", "гибридный", "смешанный", "гибридная работа",
                "гибридный формат", "гибридная модель",
                "частично в офисе", "частично удалённо",
                "несколько дней в офисе",
            ],
            "de": ["hybrid", "hybrides arbeiten", "teilweise im büro"],
            "fr": ["hybride", "travail hybride", "mi-temps bureau"],
            "es": ["híbrido", "trabajo híbrido", "parcialmente presencial"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="On-site",
        weight=1.0,
        synonyms={
            "en": [
                "on-site", "onsite", "on site", "in-office", "in office",
                "office-based", "in-person", "office only", "must work in office",
                # Strong on-site signals
                "100% on-site", "100% onsite", "fully on-site", "fully onsite",
                "no remote option", "no remote work", "no work from home",
                "office required", "office mandatory", "office attendance required",
                "must be in office daily", "5 days in office",
                "five days in office", "5 days a week in office",
                "face-to-face", "face to face", "co-located", "colocated",
                "work at our office", "work from our office",
                "in-person only", "in person only", "on premises", "on-premises",
                "no remote", "not remote eligible", "not a remote position",
                "this is not a remote role", "this is not a remote position",
            ],
            "az": [
                "ofisdə", "ofis bazalı", "ofisdə iş",
                "yalnız ofisdə", "ofisə gəlmək tələb olunur",
                "uzaqdan iş yoxdur",
            ],
            "tr": [
                "ofiste", "ofis bazlı", "iş yerinde",
                "sadece ofiste", "uzaktan çalışma yok",
                "ofise gelmek zorunlu",
            ],
            "ru": [
                "в офисе", "офисная работа", "офисн", "очно",
                "только в офисе", "без удалёнки", "без удаленки",
                "присутствие в офисе обязательно",
            ],
            "de": ["vor ort", "im büro", "büropflicht"],
            "fr": ["sur site", "en présentiel", "au bureau"],
            "es": ["presencial", "en oficina", "en la oficina"],
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
            "en": [
                "full-time", "full time", "fulltime", "permanent", "FTE",
                "permanent position", "permanent role", "permanent employment",
                "regular employee", "regular employment", "regular position",
                "staff position", "staff role", "salaried position", "salaried role",
                "salaried employee", "indefinite contract", "unlimited contract",
                "40 hours per week", "40 hours a week", "40 hour week",
                "full benefits", "benefits eligible",
            ],
            "az": [
                "tam iş günü", "tam ştat", "tam zamanlı", "tam vaxt", "daimi",
                "daimi iş", "daimi vəzifə", "ştat vahidi",
            ],
            "tr": [
                "tam zamanlı", "tam gün", "kadrolu",
                "daimi pozisyon", "sürekli iş", "kadro",
            ],
            "ru": [
                "полная занятость", "полный рабочий день", "полная ставка", "полн",
                "постоянная работа", "постоянная позиция", "штатная позиция",
                "в штат", "штатный сотрудник",
            ],
            "de": ["vollzeit", "vollzeitstelle", "unbefristet"],
            "fr": ["temps plein", "CDI", "contrat à durée indéterminée"],
            "es": ["tiempo completo", "jornada completa", "contrato indefinido"],
        },
        negatives=["full-time equivalent", "fte headcount", "fte count"],
    ),
    KeywordEntry(
        canonical="Part-time",
        weight=1.0,
        synonyms={
            "en": [
                "part-time", "part time", "parttime", "half-time",
                "20 hours per week", "20 hours a week", "reduced hours",
                "fewer hours", "part time position", "part time role",
            ],
            "az": ["yarım iş günü", "yarım ştat", "natamam", "yarım vaxt"],
            "tr": ["yarı zamanlı", "yarım gün", "kısmi zamanlı"],
            "ru": [
                "неполная занятость", "частичная занятость",
                "неполный рабочий день", "частичн", "на полставки",
            ],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Fixed-term",
        weight=1.0,
        synonyms={
            "en": ["fixed-term", "fixed term", "fixed term contract",
                   "limited term", "definite term"],
            "az": ["müddətli", "müddətli müqavilə"],
            "tr": ["belirli süreli", "belirli süreli sözleşme"],
            "ru": ["срочный договор", "срочный контракт", "на определённый срок"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Contract",
        weight=1.0,
        synonyms={
            "en": [
                "contract", "contractor", "term contract", "contract position",
                "contract role", "contract basis", "on contract",
                "contract-to-hire", "contract to hire", "c2h",
                "contract work", "1099", "W2 contract",
                "independent contractor", "subcontractor",
            ],
            "az": ["müqavilə", "müqavilə ilə", "sözləşmə"],
            "tr": ["sözleşmeli", "sözleşme", "kontrat", "kontrat bazlı"],
            "ru": [
                "контракт", "по контракту", "по договору",
                "контрактная работа", "договорная основа",
            ],
        },
        negatives=["social contract", "contract us", "contract details"],
    ),
    KeywordEntry(
        canonical="Freelance",
        weight=1.0,
        synonyms={
            "en": [
                "freelance", "freelancer", "freelancing", "self-employed",
                "independent contractor", "gig", "gig work", "gig economy",
                "project-based", "project based", "per-project",
            ],
            "az": ["frilans", "sərbəst", "layihə əsaslı"],
            "tr": ["serbest", "freelance", "serbest çalışan", "proje bazlı"],
            "ru": ["фриланс", "фрилансер", "свободный", "проектная работа"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Internship",
        weight=1.0,
        synonyms={
            "en": [
                "internship", "intern position", "student placement", "co-op",
                "summer intern", "winter intern", "fall intern",
                "internship program", "intern program",
                "undergraduate intern", "graduate intern",
                "paid internship", "unpaid internship",
                "work placement", "industrial placement",
                "sandwich year", "year in industry",
            ],
            "az": ["təcrübə proqramı", "staj", "praktika", "təcrübə müddəti"],
            "tr": ["staj", "stajyer", "stajyerlik", "staj programı"],
            "ru": ["стажировка", "стажёр", "стажер", "практика", "летняя стажировка"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Temporary",
        weight=0.8,
        synonyms={
            "en": [
                "temporary", "temp position", "short-term", "temp role",
                "temp-to-perm", "temporary to permanent", "temp work",
                "temporary assignment", "limited duration",
            ],
            "az": ["müvəqqəti", "qısamüddətli"],
            "tr": ["geçici", "kısa süreli", "geçici pozisyon"],
            "ru": ["временная", "временно", "краткосрочн", "временная позиция"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Apprenticeship",
        weight=1.0,
        synonyms={
            "en": [
                "apprenticeship", "apprentice", "apprentice position",
                "apprentice program", "work-study", "vocational training",
            ],
            "az": ["şagirdlik", "peşə təhsili"],
            "tr": ["çıraklık", "çırak", "mesleki eğitim"],
            "ru": ["ученичество", "ученик", "профессиональное обучение"],
            "de": ["ausbildung", "azubi", "lehrling"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Seasonal",
        weight=0.8,
        synonyms={
            "en": ["seasonal", "seasonal position", "seasonal role",
                   "holiday seasonal", "summer seasonal"],
            "az": ["mövsümi", "mövsümi iş"],
            "tr": ["sezonluk", "mevsimlik"],
            "ru": ["сезонный", "сезонная работа"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Volunteer",
        weight=0.7,
        synonyms={
            "en": ["volunteer", "volunteer position", "volunteer role",
                   "unpaid position", "pro bono"],
            "az": ["könüllü", "könüllü iş"],
            "tr": ["gönüllü", "gönüllü pozisyon"],
            "ru": ["волонтёр", "волонтер", "добровольная работа"],
        },
        negatives=["volunteer experience", "volunteer work preferred"],
    ),
    KeywordEntry(
        canonical="Commission",
        weight=0.7,
        synonyms={
            "en": ["commission", "commission-based", "commission only",
                   "commission based pay", "100% commission"],
            "az": ["komissiya", "komissiya əsaslı"],
            "tr": ["komisyon", "komisyon bazlı"],
            "ru": ["комиссионный", "комиссионная оплата"],
        },
        negatives=["commission to", "European Commission"],
    ),
    KeywordEntry(
        canonical="Per Diem",
        weight=0.7,
        synonyms={
            "en": ["per diem", "per-diem", "daily rate", "day rate"],
            "az": ["günlük ödəniş"],
            "tr": ["günlük ücret"],
            "ru": ["посуточная оплата", "дневная ставка"],
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
            "en": [
                "intern", "internship", "trainee", "graduate trainee",
                "student intern", "summer intern", "winter intern",
                "co-op student", "placement student",
            ],
            "az": ["təcrübəçi", "stajçı", "stajer", "praktikant"],
            "tr": ["stajyer", "staj", "aday", "stajyer pozisyon"],
            "ru": ["стажёр", "стажер", "практикант", "стажировка"],
        },
        negatives=[
            "internal", "international", "internet", "internat",
            "internally", "internalize",
        ],
    ),
    KeywordEntry(
        canonical="New Grad",
        weight=1.0,
        synonyms={
            "en": [
                "new grad", "new graduate", "graduate engineer",
                "graduate hire", "campus hire", "recent graduate",
                "fresh graduate", "university graduate",
                "college graduate", "graduating student",
                "class of 202", "class of 203",
            ],
            "az": ["yeni məzun", "təzə məzun"],
            "tr": ["yeni mezun", "üniversite mezunu"],
            "ru": ["выпускник", "молодой специалист", "недавний выпускник"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Early Career",
        weight=0.9,
        synonyms={
            "en": [
                "early career", "entry level", "entry-level",
                "early-career", "fresher", "0-2 years experience",
                "0-1 years experience", "no experience required",
                "beginner", "starter position",
            ],
            "az": ["erkən karyera", "başlanğıc səviyyə"],
            "tr": ["kariyer başlangıcı", "giriş seviyesi"],
            "ru": ["начальный уровень", "начало карьеры", "без опыта"],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="Junior",
        weight=1.0,
        synonyms={
            "en": [
                "junior", "jr", "jr.",
                "junior-level", "junior level",
                "associate level", "level 1", "level I",
                "L1", "IC1", "IC2",
                "SDE I", "SDE-I", "SDE 1",
                "engineer I", "developer I",
            ],
            "az": ["kiçik mütəxəssis", "gənc mütəxəssis", "kiçik"],
            "tr": ["kıdemsiz", "giriş seviyesi", "alt düzey"],
            "ru": ["младший", "начинающий", "джуниор"],
        },
        negatives=[
            "junior achievement", "junior league", "junior high",
            "junior school", "junior varsity",
        ],
    ),
    KeywordEntry(
        canonical="Mid-level",
        weight=1.0,
        synonyms={
            "en": [
                "mid-level", "mid level", "middle", "mid-senior",
                "intermediate", "associate",
                "generalist mid-level", "mid-career",
                "level 2", "level II", "level 3", "level III",
                "L2", "L3", "IC3",
                "SDE II", "SDE-II", "SDE 2",
                "engineer II", "developer II",
                "2-5 years", "3-5 years",
            ],
            "az": [
                "orta səviyyə", "orta", "orta mütəxəssis",
            ],
            "tr": [
                "orta düzey", "orta seviye", "orta kıdem",
            ],
            "ru": [
                "средний", "средний уровень", "мидл", "миддл",
            ],
        },
        negatives=[
            "mid-level management", "middle management",
            "mid-level manager",
        ],
    ),
    KeywordEntry(
        canonical="Senior",
        weight=1.0,
        synonyms={
            "en": [
                "senior", "sr", "sr.", "experienced", "advanced",
                "senior-level", "senior level",
                "level 4", "level IV", "level 5", "level V",
                "L4", "L5", "IC4", "IC5",
                "SDE III", "SDE-III", "SDE 3",
                "engineer III", "developer III",
                "seasoned", "veteran",
                "5+ years", "7+ years", "8+ years", "10+ years",
            ],
            "az": [
                "baş mütəxəssis", "böyük mütəxəssis",
                "təcrübəli", "yüksək səviyyəli",
            ],
            "tr": [
                "kıdemli", "uzman", "deneyimli",
                "üst düzey", "tecrübeli",
            ],
            "ru": [
                "старший", "ведущий", "синьор", "сениор",
                "опытный",
            ],
        },
        negatives=[
            "senior mindset", "senior citizen", "senior care", "senior living",
            "senior discount", "senior community", "senior management style",
            "senior residents", "senior population", "senior center",
        ],
    ),
    KeywordEntry(
        canonical="Lead",
        weight=1.0,
        synonyms={
            "en": [
                "lead", "team lead", "tech lead", "technical lead",
                "principal", "staff", "staff engineer", "staff developer",
                "principal engineer", "principal developer",
                "distinguished", "distinguished engineer",
                "architect", "solutions architect", "technical architect",
                "L6", "L7", "IC6",
            ],
            "az": ["rəhbər", "komanda rəhbəri", "texniki rəhbər", "baş mühəndis"],
            "tr": ["lider", "takım lideri", "baş", "teknik lider", "baş mühendis"],
            "ru": [
                "руководитель", "тимлид", "ведущий разработчик",
                "техлид", "главный инженер", "архитектор",
            ],
        },
        negatives=[
            "lead generation", "lead management", "lead nurturing", "sales lead",
            "lead scoring", "lead qualification", "lead conversion",
            "lead pipeline", "lead magnet", "lead capture",
            "lead gen", "leads team",
        ],
    ),
    KeywordEntry(
        canonical="Manager",
        weight=0.9,
        synonyms={
            "en": [
                "manager", "head of", "director", "vp of", "vice president",
                # Tech management
                "engineering manager", "development manager",
                "technical manager", "product manager",
                "project manager", "program manager",
                "group manager", "department head",
                "general manager", "GM",
                # Marketing management
                "marketing manager", "brand manager",
                "growth marketing manager", "performance marketing manager",
                "digital marketing manager", "content marketing manager",
                # Sales management
                "sales manager", "business development manager",
                "territory sales manager", "regional sales manager",
                "key account manager",
                # HR management
                "hr manager", "people operations manager",
                "talent acquisition manager", "recruiting manager",
                # Finance management
                "finance manager", "accounting manager",
                # Operations management
                "operations manager", "supply chain manager",
                "strategy manager", "logistics manager",
                # Support management
                "customer success manager", "support manager",
            ],
            "az": [
                "menecer", "müdir", "rəis", "şöbə rəhbəri",
                "baş direktor", "departament rəhbəri",
            ],
            "tr": [
                "müdür", "yönetici", "direktör",
                "departman yöneticisi", "genel müdür",
            ],
            "ru": [
                "менеджер", "директор", "руководитель отдела", "начальник",
                "руководитель департамента", "глава отдела",
            ],
        },
        negatives=[
            "account manager relationship", "manage expectations",
            "manage your time", "manage workload",
            "manage project priorities",
        ],
    ),
    KeywordEntry(
        canonical="Executive",
        weight=0.9,
        synonyms={
            "en": [
                "executive", "c-level", "c-suite",
                "chief technology officer", "CTO",
                "chief information officer", "CIO",
                "chief engineering officer",
                "chief product officer", "CPO",
                "SVP", "EVP", "senior vice president",
                "executive vice president",
            ],
            "az": ["icra direktoru", "baş texnoloji direktor"],
            "tr": ["üst düzey yönetici", "C-seviye"],
            "ru": ["топ-менеджер", "высшее руководство", "исполнительный директор"],
        },
        negatives=["executive summary", "executive assistant"],
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
            "en": [
                "send your cv to", "email your resume", "send resume to",
                "email your cv", "submit your cv via email", "apply via email",
                "apply by email", "forward your cv", "attach your cv",
                "send your resume to", "mail your cv", "mail your resume",
                "submit resume to", "submit cv to", "email us your cv",
                "email us your resume", "send your application to",
                "applications to", "resumes to", "cv to the following email",
                "apply by sending", "send your cover letter and cv",
                "send your cv and cover letter",
            ],
            "az": [
                "cv-nizi göndərin", "müraciət emailə", "göndər cv",
                "cv-ni göndərin", "elektron poçta ilə müraciət",
            ],
            "tr": [
                "cv'nizi gönderin", "e-posta ile başvurun", "cv gönderin",
                "özgeçmişinizi gönderin", "mail ile başvurun",
            ],
            "ru": [
                "отправьте резюме", "направьте резюме", "присылайте cv",
                "резюме на почту", "отправить cv", "отправьте cv на",
                "резюме направлять на", "заявку отправлять на",
            ],
        },
        negatives=[],
    ),
    KeywordEntry(
        canonical="external",
        weight=0.8,
        synonyms={
            "en": [
                "apply on our website", "apply on company website",
                "apply through our portal", "visit our careers page",
                "application portal", "apply at",
                "click here to apply", "apply through the link",
                "apply now", "apply here", "submit application",
                "submit your application", "apply online",
                "apply on the company site", "apply directly",
                "apply through our careers page", "careers page",
                "application form", "online application",
                "apply using the link", "apply via the link",
            ],
            "az": [
                "müraciət linki", "şirkətin saytında müraciət",
                "onlayn müraciət", "müraciət forması",
            ],
            "tr": [
                "şirket sitesinden başvurun", "başvuru linki",
                "online başvuru", "başvuru formu",
            ],
            "ru": [
                "подать заявку на сайте", "перейти по ссылке",
                "подать заявку через", "откликнуться на сайте",
                "форма заявки", "онлайн заявка",
            ],
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
