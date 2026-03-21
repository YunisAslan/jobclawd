"""
Analyze LinkedIn Easy Apply flow complexity.

Tier A: 1-click or ≤2 simple steps (name, email, resume) → safe to auto-submit
Tier B: 3-5 steps with known fields (education, experience, phone, etc.) → assisted
Tier C: Custom questions, unknown fields, or complex flows → human review required
"""
import re
from typing import Optional
from models.schemas import EasyApplyAnalysis


# Fields that can be filled from profile data automatically
KNOWN_FIELDS = {
    "first name", "last name", "full name", "name",
    "email", "email address",
    "phone", "phone number", "mobile", "mobile number",
    "linkedin", "linkedin url", "linkedin profile",
    "resume", "cv", "cover letter",
    "city", "location", "address",
    "current company", "current title", "headline",
    "education", "school", "university", "degree",
    "years of experience", "experience",
    "website", "portfolio", "github",
    "salary", "salary expectation", "expected salary",
    "work authorization", "authorized to work",
    "sponsorship", "visa",
    "start date", "availability", "notice period",
    "relocation", "willing to relocate",
}

# Patterns that indicate custom/unknown questions
CUSTOM_QUESTION_PATTERNS = [
    r"why\s+(do\s+you|are\s+you|should\s+we)",
    r"describe\s+(a\s+time|your|how)",
    r"tell\s+us\s+about",
    r"what\s+(?:makes|interests|motivated|experience)",
    r"how\s+(?:did\s+you|would\s+you|many)",
    r"explain\s+(?:your|why|how)",
    r"provide\s+(?:an?\s+example|details)",
]


def _is_known_field(label: str) -> bool:
    """Check if a form field label matches something we can auto-fill."""
    lower = label.lower().strip().rstrip("*:").strip()
    if lower in KNOWN_FIELDS:
        return True
    for known in KNOWN_FIELDS:
        if known in lower or lower in known:
            return True
    return False


def _is_custom_question(text: str) -> bool:
    """Check if text looks like a custom screening question."""
    lower = text.lower().strip()
    for pattern in CUSTOM_QUESTION_PATTERNS:
        if re.search(pattern, lower):
            return True
    return False


async def analyze_easy_apply(page, url: str) -> EasyApplyAnalysis:
    """
    Analyze a LinkedIn job page to classify Easy Apply complexity.
    Must be called after the page has loaded.
    Returns an EasyApplyAnalysis with tier classification.
    """
    if "linkedin.com" not in url:
        return EasyApplyAnalysis(tier="unknown", tier_label="Not a LinkedIn job")

    try:
        analysis = await page.evaluate("""
            () => {
                const result = {
                    hasEasyApply: false,
                    hasResume: false,
                    hasCoverLetter: false,
                    hasCustomQuestions: false,
                    stepCount: 0,
                    fieldLabels: [],
                    questionTexts: [],
                    additionalInfo: [],
                };

                // Check for Easy Apply button
                const applyBtn = document.querySelector(
                    '.jobs-apply-button, button[aria-label*="Easy Apply"], ' +
                    '.jobs-s-apply button, [data-control-name="jobdetails_topcard_inapply"]'
                );
                result.hasEasyApply = !!applyBtn;

                // Check the job description for clues about application requirements
                const descEl = document.querySelector(
                    '.jobs-description__content, .description__text, ' +
                    '.show-more-less-html__markup, [class*="description"]'
                );
                const descText = descEl ? descEl.innerText || '' : '';

                // Check for resume/CV mentions
                if (/resume|cv|curriculum/i.test(descText)) result.hasResume = true;

                // Check for cover letter mentions
                if (/cover\\s*letter/i.test(descText)) result.hasCoverLetter = true;

                // Look for "questions" or screening indicators in the apply section
                const applySection = document.querySelector(
                    '.jobs-easy-apply-content, .jobs-apply-form, ' +
                    '[class*="easy-apply"], [class*="apply-form"]'
                );

                if (applySection) {
                    // Count form steps/pages
                    const stepIndicators = applySection.querySelectorAll(
                        '.jobs-easy-apply-modal__pagination-bullet, ' +
                        '[class*="step"], [class*="page-indicator"]'
                    );
                    result.stepCount = stepIndicators.length || 1;

                    // Collect field labels
                    const labels = applySection.querySelectorAll('label, .fb-form-element__label');
                    labels.forEach(l => {
                        const text = (l.textContent || '').trim();
                        if (text.length > 0 && text.length < 200) result.fieldLabels.push(text);
                    });

                    // Collect question texts (longer text that looks like screening questions)
                    const questions = applySection.querySelectorAll(
                        '[class*="question"], .jobs-easy-apply-form-section__grouping, ' +
                        'fieldset legend, .fb-form-element__label'
                    );
                    questions.forEach(q => {
                        const text = (q.textContent || '').trim();
                        if (text.length > 20 && text.length < 500) result.questionTexts.push(text);
                    });
                }

                // Look at criteria/requirements in the header area
                const criteriaEl = document.querySelector(
                    '.job-details-how-match-card, .jobs-unified-top-card__job-insight, ' +
                    '[class*="criteria"], [class*="requirements"]'
                );
                if (criteriaEl) {
                    const items = criteriaEl.querySelectorAll('li, span');
                    items.forEach(item => {
                        const text = (item.textContent || '').trim();
                        if (text.length > 0 && text.length < 200) result.additionalInfo.push(text);
                    });
                }

                // LinkedIn public pages show application complexity hints
                const applyComplexity = document.querySelector(
                    '[class*="num-applicants"], .jobs-unified-top-card__applicant-count'
                );
                if (applyComplexity) {
                    result.additionalInfo.push(applyComplexity.textContent.trim());
                }

                return result;
            }
        """)

        # Classify based on analysis
        has_easy_apply = analysis.get("hasEasyApply", False)
        step_count = analysis.get("stepCount", 0)
        has_resume = analysis.get("hasResume", False)
        has_cover_letter = analysis.get("hasCoverLetter", False)
        field_labels = analysis.get("fieldLabels", [])
        question_texts = analysis.get("questionTexts", [])

        # Identify unknown fields
        unknown_fields = []
        has_custom_questions = False

        for label in field_labels:
            if not _is_known_field(label):
                unknown_fields.append(label)

        for q in question_texts:
            if _is_custom_question(q):
                has_custom_questions = True
                if q not in unknown_fields:
                    unknown_fields.append(q)

        # Tier classification
        if not has_easy_apply:
            tier = "unknown"
            tier_label = "Easy Apply not detected"
            safe = False
        elif step_count <= 2 and len(unknown_fields) == 0 and not has_custom_questions:
            tier = "A"
            tier_label = "Quick — 1-click or simple form"
            safe = True
        elif step_count <= 5 and len(unknown_fields) <= 2 and not has_custom_questions:
            tier = "B"
            tier_label = "Assisted — known fields, may need review"
            safe = False
        else:
            tier = "C"
            tier_label = "Complex — custom questions, needs your input"
            safe = False

        return EasyApplyAnalysis(
            tier=tier,
            tier_label=tier_label,
            step_count=max(step_count, 1) if has_easy_apply else 0,
            has_resume_upload=has_resume,
            has_custom_questions=has_custom_questions,
            has_cover_letter=has_cover_letter,
            unknown_fields=unknown_fields[:10],
            safe_to_auto_submit=safe,
        )

    except Exception as e:
        print(f"[EasyApply] Analysis error: {e}")
        return EasyApplyAnalysis(
            tier="unknown",
            tier_label="Could not analyze application flow",
        )
