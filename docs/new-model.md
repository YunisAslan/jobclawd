Design the next product direction for JobClawd based on the new strategy:

Core model:
"Filter-based job search + match score + CV optimization suggestions"

Important context:
JobClawd is no longer focused on browser extension-assisted form filling, apply automation, SMTP-based application sending, screening answer storage, or vacancy apply-type workflows.
Those surfaces and related product logic have been removed.
The product direction has shifted away from automation and toward search intelligence, readiness/match understanding, and CV optimization.

You must design the product around this new direction and explicitly reflect that transition.

New product direction to emphasize:
- Filter-based vacancy search
- Structured vacancy understanding
- Match / readiness score
- CV optimization suggestions
- Saved vacancies as a short-lived decision workspace

Main objective:
Help users make better application decisions and improve their CVs for specific vacancies before they apply manually.

Key questions to solve:
1. What should the apply/search sidebar become now that autofill automation is gone?
2. Should profile information still be shown there?
3. If yes, how should it be shown in a minimal, relevant, and intelligent way?
4. How should CV become the primary object in this workflow?
5. How should users update their CV live inside the experience?
6. What kind of suggestion system should guide CV improvement with strong UX and UI?
7. How should saved vacancies work as a lightweight temporary workspace?
8. How should the system connect search results, match score, and CV improvement into one coherent flow?

Product direction to enforce:
Do not design this as an autofill assistant, extension automation tool, or submission bot.
Design it as a job application intelligence product.

Requirements:

1. Sidebar rethink
The current apply sidebar must be redefined for the new product strategy.
Propose whether it should remain a sidebar at all, or become a different kind of panel/workspace.

If a sidebar/panel remains, it should focus on:
- vacancy summary
- match score
- why this role matches or does not match
- missing signals / weak points
- selected CV
- CV improvement suggestions
- saved status

It should not show full raw profile forms.
If profile data is shown, it must be shown as a vacancy-relevant summary rather than a generic account/profile dump.

2. Profile display strategy
Define how user profile information should appear in this new model.
The system should show only the parts of the profile that matter for this vacancy, for example:
- matched skills
- missing skills
- experience alignment
- location/work mode alignment
- salary alignment where relevant

Explain what should be visible, what should be hidden, and why.

3. CV-first workflow
The user’s CV must become the most important editable object in this experience.
Design a workflow where:
- the user selects a CV for the vacancy
- the system evaluates how well that CV fits the job
- the user can update the CV live
- the match/readiness result refreshes after updates
- the system gives structured, high-value suggestions

This should feel interactive and premium, not like a simple document upload widget.

4. Live CV updating
Design how live CV updating should work in product terms.
Include:
- edit flow
- save/update flow
- versioning or draft behavior if needed
- whether updates affect the master CV or a vacancy-specific variant
- how the UI communicates changes and impact

5. Suggestion system
Design a strong UX/UI model for CV optimization suggestions.
Suggestions should be:
- concrete
- actionable
- prioritized
- tied to vacancy requirements
- clearly justified

Examples of suggestion categories:
- add missing keywords
- rewrite weak bullets
- elevate more relevant experience
- reduce irrelevant content
- improve title/headline alignment
- address missing must-have requirements where possible

The suggestion model should feel like a guided copilot for improvement, not a generic AI text box.

6. Saved vacancies
Add a saved-vacancies/bookmark feature.
Requirements:
- users can save vacancies they want to review later
- saved vacancies should support comparison, follow-up, and CV optimization workflows
- saved vacancies are temporary in the database for now
- retention policy: maximum 7 days in DB
- the system should treat saved vacancies as a lightweight working set, not a permanent archive

Design:
- save flow
- saved jobs view/workspace
- how saved jobs interact with score and CV suggestions
- what happens when saved jobs expire

7. Search-to-decision flow
Design the ideal end-to-end experience:
- user searches with filters
- sees structured vacancy parameters
- opens a vacancy
- sees match score and reasoning
- sees selected CV and optimization suggestions
- optionally saves the vacancy
- improves CV
- then manually applies outside the system

8. UX principles
The product should feel:
- focused
- intelligent
- calm
- trustworthy
- high-signal
- not automation-heavy
- not cluttered

Avoid:
- extension-era automation language
- generic autofill metaphors
- raw profile dumps
- weak or generic AI suggestions
- noisy temporary panels with no strategic value

9. Output format
Provide the result as a practical product/UX spec with:
- product framing
- updated information architecture
- sidebar/panel recommendation
- profile display recommendation
- CV-first workflow
- live CV update model
- suggestion engine UX model
- saved vacancies model with 7-day retention
- end-to-end user flow
- MVP scope
- non-goals
- rollout recommendation

Important:
Explicitly acknowledge that the product has transitioned to this model:
"Filter-based vacancy search + match score + CV optimization suggestions"
and that previous automation-oriented surfaces have been removed from scope.
