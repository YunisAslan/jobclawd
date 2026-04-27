"""
Pre-baked demo data for the onboarding tour.
Returned instantly when demo=True — no scraping, no AI calls.
"""
from models.schemas import (
    SearchResponse,
    JobListing,
    MatchLevel,
    JobSource,
    CVAnalysisBundleResponse,
    CVMatchResponse,
    MatchCategoryScore,
    CVSuggestionsResponse,
    CVSuggestion,
    SuggestionCategory,
    SuggestionPriority,
    CVDraftResponse,
)
from models.cv_schema import (
    CVData,
    PersonalInfo,
    ExperienceEntry,
    EducationEntry,
    SkillGroup,
    LanguageEntry,
)

DEMO_SEARCH_RESULT = SearchResponse(
    jobs=[
        JobListing(
            title="Marketing Manager",
            company="GrowthBridge",
            url="https://demo.jobclawd.com/job/marketing-manager",
            date_posted="2026-04-24T00:00:00",
            source=JobSource.linkedin,
            match_score=85,
            match_level=MatchLevel.high,
            match_flags=["title-match", "skills-match"],
            location_str="Remote",
            work_mode_str="Remote",
            seniority_str="Mid-level",
            job_type_str="Full-time",
            salary_str="$70k – $100k",
            description_snippet=(
                "GrowthBridge is looking for a Marketing Manager to lead our digital campaigns, "
                "manage a $500K annual budget, and grow brand awareness across social and search channels. "
                "Experience with HubSpot and Google Ads required."
            ),
        ),
        JobListing(
            title="Digital Marketing Manager",
            company="Meridian Media",
            url="https://demo.jobclawd.com/job/digital-marketing-manager",
            date_posted="2026-04-24T00:00:00",
            source=JobSource.indeed,
            match_score=58,
            match_level=MatchLevel.review,
            match_flags=["skills-partial"],
            location_str="New York, NY",
            work_mode_str="Hybrid",
            seniority_str="Senior",
            job_type_str="Full-time",
            salary_str="$90k – $125k",
            description_snippet=(
                "Meridian Media seeks a Digital Marketing Manager with deep expertise in SEO/SEM, "
                "content strategy, and marketing automation. You'll lead a team of 4 and report directly to the CMO."
            ),
        ),
    ],
    total=2,
    query="Marketing Manager",
    cached=True,
    currency="USD",
)

DEMO_CV_BUNDLE = CVAnalysisBundleResponse(
    analysis=CVMatchResponse(
        overall_score=74,
        match_level=MatchLevel.high,
        categories=[
            MatchCategoryScore(
                category="skills",
                score=80,
                matched=["Campaign management", "Google Analytics", "SEO/SEM", "Content strategy"],
                missing=["HubSpot", "Marketing automation"],
                reasoning="Strong core marketing skills. Adding HubSpot and automation tools would widen your match.",
            ),
            MatchCategoryScore(
                category="experience",
                score=72,
                matched=["3+ years marketing", "budget ownership", "cross-functional collaboration"],
                missing=["Team leadership", "P&L responsibility"],
                reasoning="Solid background. Highlighting any team lead or ownership experience would help.",
            ),
            MatchCategoryScore(
                category="education",
                score=85,
                matched=["Marketing degree", "relevant certifications"],
                missing=[],
                reasoning="Education requirements fully met.",
            ),
            MatchCategoryScore(
                category="keywords",
                score=65,
                matched=["brand awareness", "digital campaigns", "social media"],
                missing=["HubSpot", "Salesforce", "OKRs"],
                reasoning="Add HubSpot, Salesforce, and OKR terminology — they appear in the job description.",
            ),
        ],
        summary=(
            "Your CV shows solid alignment with this Marketing Manager role. "
            "Adding HubSpot proficiency and quantified team leadership examples would push your score above 85."
        ),
    ),
    suggestions=CVSuggestionsResponse(
        suggestions=[
            CVSuggestion(
                category=SuggestionCategory.add_keywords,
                priority=SuggestionPriority.high,
                title="Add HubSpot to your skills",
                description="The role explicitly requires HubSpot — listing it signals hands-on readiness.",
                suggested_text="HubSpot, HubSpot Marketing Hub",
            ),
            CVSuggestion(
                category=SuggestionCategory.rewrite_bullets,
                priority=SuggestionPriority.medium,
                title="Quantify campaign results",
                description="Replace generic bullets with measurable outcomes to stand out.",
                specific_text="Managed digital marketing campaigns",
                suggested_text="Managed 12 digital campaigns generating 2.4M impressions and 18% YoY revenue growth",
            ),
            CVSuggestion(
                category=SuggestionCategory.add_keywords,
                priority=SuggestionPriority.low,
                title="Mention OKR methodology",
                description="The job description references OKRs — including this boosts keyword match.",
                suggested_text="OKR planning and tracking",
            ),
        ],
        total=3,
        job_title="Marketing Manager",
        job_company="GrowthBridge",
    ),
    draft=CVDraftResponse(
        text="",
        file_name="demo-cv.pdf",
    ),
)

DEMO_CV_DATA = CVData(
    personal_info=PersonalInfo(
        full_name="Alex Rivera",
        email="alex.rivera@email.com",
        phone="+1 555-234-5678",
        location="San Francisco, CA",
        linkedin="linkedin.com/in/alexrivera",
        summary=(
            "Marketing professional with 4+ years of experience in digital campaigns, brand strategy, "
            "and content marketing. Track record of growing organic traffic and managing multi-channel "
            "campaigns with measurable ROI."
        ),
    ),
    experience=[
        ExperienceEntry(
            company="BrandCo",
            title="Marketing Specialist",
            location="San Francisco, CA",
            start_date="Jan 2022",
            end_date="Present",
            bullets=[
                "Managed digital marketing campaigns across Google Ads, Meta, and LinkedIn with a $200K annual budget",
                "Grew organic website traffic by 35% through SEO content strategy and technical optimization",
                "Collaborated with design and sales teams to produce campaign assets and lead-gen materials",
            ],
        ),
        ExperienceEntry(
            company="StartupMedia",
            title="Content Marketing Coordinator",
            location="Remote",
            start_date="Jun 2020",
            end_date="Dec 2021",
            bullets=[
                "Produced 20+ blog posts per month, increasing newsletter subscribers by 40%",
                "Managed social media calendar across Instagram, LinkedIn, and Twitter",
            ],
        ),
    ],
    education=[
        EducationEntry(
            institution="UC Berkeley",
            degree="B.A. Marketing & Communications",
            field_of_study="Marketing",
            start_date="2016",
            end_date="2020",
        ),
    ],
    skills=[
        SkillGroup(category="Marketing", items=["Campaign Management", "SEO/SEM", "Google Analytics", "Content Strategy", "Social Media"]),
        SkillGroup(category="Tools", items=["Google Ads", "Meta Business Suite", "Canva", "Mailchimp"]),
        SkillGroup(category="Other", items=["Copywriting", "A/B Testing", "Market Research"]),
    ],
    languages=[
        LanguageEntry(language="English", level="Native"),
        LanguageEntry(language="Spanish", level="Conversational"),
    ],
    section_order=["personal_info", "experience", "education", "skills", "languages"],
)
