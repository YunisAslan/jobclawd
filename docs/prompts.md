I want to work with apply part. For now we can detect apply method from vacancies. But only email applications is functional. We must work detailed. 

- Detect application type
email
LinkedIn Easy Apply
external ATS
custom company site

- Classify complexity
simple
assisted
unsupported

- Extract required fields
resume
name / phone / email
cover letter
salary expectation
location
work authorization
experience questions
custom screening questions

- Map against user profile
known data → autofill
unknown data → ask user once and save
risky data → request confirmation

- Execute
auto-submit
assisted submit
handoff to manual

- Track result
applied
partially completed
requires review
failed with reason


What you should build next
Phase 1 — make application support transparent

Before more automation, improve the product model.

For every vacancy, show something like:

Apply via Email

Easy Apply — Supported

Easy Apply — Assisted

External Apply — Manual Required

External Apply — Unsupported

This alone will help users trust the system.

Because right now a user may assume:
“JobClawd can apply everywhere”
when in reality it mostly handles email-based jobs.

Be explicit.

Phase 2 — create reusable profile data

You need a strong application profile schema.

Not just CV upload, but structured fields like:

full name

email

phone

location

LinkedIn URL

portfolio URL

GitHub URL

years of experience

work authorization

salary expectation

preferred job type

notice period

relocation preference

education

skills

language levels

cover letter templates

answers to common screening questions

Then:

use this for email applications

use this for Easy Apply

use this for external form prefill

Without this layer, every application flow becomes messy.

Phase 3 — build a question memory system

A lot of job forms ask repeated questions.

Examples:

Are you legally authorized to work in this country?

Will you now or in the future require sponsorship?

What are your salary expectations?

How many years of React experience do you have?

Are you willing to relocate?

When can you start?

You should build:

reusable answer memory

ask once

let user edit later

reuse across future applications

This is one of the highest-value features you can add.

Because external applications become much easier even if they are not fully automatable.

Phase 4 — support LinkedIn Easy Apply in tiers

Do not treat all Easy Apply jobs as one thing.

Break it down:

Tier A: one-click or very short flows

Support these first.

Tier B: medium flows with known fields

Support with assisted mode.

Tier C: complex custom questions

Fallback to human confirmation.

For automation logic:

detect number of steps

detect required unknown fields

detect file upload requirements

detect knockout questions

classify whether safe to proceed

This gives you a reliable system instead of “try submit and hope.”

Phase 5 — external-site strategy

This is where many apps die if they overcommit.

Instead of “we automate every external site,” choose this path:

First support the biggest ATS platforms

Examples in concept:

Greenhouse-style forms

Lever-style forms

Workable-style forms

common ATS/careers page structures

Why?
Because these platforms repeat across many companies.
That gives better ROI than supporting random company sites one by one.

Even then, use:

field mapping

assisted fill

missing-answer prompts

final human review

not blind submit.

add “Apply Readiness Score”

For each job, calculate not only match score, but also application readiness.

Example:

95% ready → can auto-apply

70% ready → needs 2 more answers

40% ready → external site, manual review needed

This helps users decide where to spend time.

It also helps your product explain why a flow is not fully automated.


Since uncached search already consumes credits, don’t mix search credits and apply complexity in a confusing way.

Better:

Search credits

Used when fetching uncached jobs.

Apply actions

Separate logic:

email apply = low cost

assisted apply = medium cost

advanced auto-apply = premium / more credits

That makes pricing easier later.

Because if users spend credits searching but then cannot apply effectively, they may feel disappointed.

So your monetization should reflect real user value:
search + actual application progress, not search alone.

UX you should add immediately
1. Application type badge

Show on every job card:

Email Apply

Easy Apply

External Apply

2. Automation support badge

Show:

Auto Apply

Assisted Apply

Manual Only

3. Missing information panel

Before applying:

“You are missing phone number”

“Salary expectation not set”

“Portfolio URL not set”

4. Application outcome status

For each attempt:

Sent

Submitted

Drafted

Waiting for your input

Open manually

Failed

5. Reasoned failure messages

Instead of generic failure:

external login required

unsupported custom form

CAPTCHA detected

missing required answer

file type mismatch

This reduces frustration a lot.

Technical strategy that is safer
Avoid full blind automation

Do not auto-submit when:

unknown required fields exist

answers are inferred but low confidence

salary/work authorization questions are ambiguous

site has anti-bot friction

the user has never reviewed this answer before

Use confidence-based execution:

high confidence → auto

medium confidence → ask

low confidence → manual handoff