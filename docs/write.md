Product Requirement Document (PRD): JobAuto MVP
Core Value Proposition: An intelligent job automation platform that aggregates listings from multiple sources (Jobsearch.az, LinkedIn, Indeed), filters them based on user preferences, and automates the application process via "Assistant" or "Autopilot" modes.
1. 👤 User Onboarding & Profile Configuration
Goal: Collect critical data to power the matching engine and safety protocols.
Personal Info: Name, Surname, Email, Phone.
Current Employer (CRITICAL): Input field for "Current Company Name" (used for the Anti-Fail safety protocol).
Work Preferences:
Work Mode (Multi-select): Remote, Hybrid, On-site.
Current Location: (e.g., Baku, Azerbaijan).
Relocation (Boolean):
No (Local jobs only).
Yes (Open to relocation).
Experience Level (Optional - Dropdown): Junior, Middle, Senior.
Logic: If left empty, the system ignores experience level filters and matches ALL levels (user accepts the risk of rejection).
Blacklist: Input field to add specific company names where CVs should never be sent.
CV Management: Upload multiple versions (e.g., CV_Frontend.pdf, CV_Fullstack.pdf).
2. 🧠 Intelligence Engine (Scoring & Filtering)
Goal: Categorize scraped jobs into three distinct buckets based on user profile.
🟢 High Match (90%+):
Meets ALL criteria (Location, Mode, Title, Experience).
Action: Enabled for "Autopilot" and "Auto-Send".
🟡 Review Needed (Risky):
Partial match (e.g., User is "Junior" but job says "Middle", or location is slightly off).
UI Alert: "Warning: This job requires Middle level. Apply anyway?"
🔴 Hidden/Trash:
Hard mismatches (e.g., User wants "Remote" only, job is "On-site").
Action: Automatically hidden from the main feed.
3. ⚙️ Operational Modes (Workflows)
A. Assistant Mode (Default)
Aggregation: System scrapes targets (Jobsearch.az, LinkedIn, Indeed) based on filters.
Queueing: Matches are sent to the "Pending Review" dashboard tab.
Manual Review: User selects/deselects jobs from the list.
Bulk Action: User clicks "Approve & Send".
Final Confirmation: A modal shows a summary of applications before execution.
B. Autopilot Mode (Advanced)
Activation: Requires a "Disclaimer & Risk Acceptance" toggle in Settings.
Logic: System automatically applies to 🟢 High Match jobs only.
Notification: Push/Email notification: "While you slept, we applied to 3 matching jobs."
4. 🛡️ Safety Protocols
Anti-Fail System (Current Employer Protection):
Logic: Before showing or applying to any job, check Job_Company_Name against User_Current_Employer.
Action: If match found (fuzzy matching included), immediately discard the job.
Blacklist Enforcement: Same logic as above for user-defined blacklisted companies.
5. 💻 Dashboard Architecture (UI/UX)
Layout: Fixed Left Sidebar + Main Content Area.
Sidebar Menu:
📊 Dashboard (Overview)
🔍 Job Feed (Search & Match)
📨 Applications (Status Tracker)
👤 Profile & CVs
⚙️ Settings
Page Breakdown:
1. Dashboard (Overview)
Stats Cards:
Vacancies Found Today: [Integer]
Pending Review: [Integer]
Total Sent: [Integer]
Interviews/Replies: [Integer]
Analytics Chart: Weekly application volume vs. Response rate.
CV Performance: "CV_A" vs "CV_B" response tracking.
2. Job Feed
View: Card Layout.
Card Data: Company Logo, Job Title, Source (e.g., LinkedIn), Match Score (e.g., 95% Match).
Actions: "Quick Apply", "Ignore", "View Details".
3. Applications (Tracking)
Table Columns: Company | Role | Date Sent | CV Version Used | Status.
Status Tags: Sent, Viewed (Pixel tracking if possible), Replied, Rejected.
4. Settings
Switches: Enable/Disable Autopilot.
Management: Edit Blacklist, Change Password, Delete Account.
6. 🔌 Technical Scope (Backend Notes)
Sources:
LinkedIn/Indeed: Use Playwright to handle bot detection.