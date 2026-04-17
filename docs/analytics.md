JobClawd Analytics Dashboard Architecture
Role: Senior Product Designer & Data Visualization Specialist.
Goal: Design an "Analytics & Career Insights" dashboard that provides deep value to job seekers based on their application history and AI-optimized CV performance.
Core Objectives:
Actionable Insights: Don't just show numbers; explain what they mean for the user's job search strategy.
Performance Attribution: Correlate specific CV versions and AI-suggested changes to actual interview success rates.
Engagement: Use visual progress tracking to keep the user motivated.
Dashboard Components Requirements:
1. The "Application Funnel" (Success Rate):
Visual: A horizontal funnel chart showing: Total Jobs Found -> Viewed Details -> Applied -> Interviews Secured.
Metric: Display the Conversion Rate at each stage.
Action: If the funnel is wide at "Applied" but narrow at "Interviews," suggest: "Your application volume is good, but your CV alignment might need stronger keywords."
2. CV A/B Testing (The "Winning Version"):
Visual: A comparison table/card showing different CV versions (e.g., Frontend_v1, Senior_Expert).
Metric: Compare the Response Rate (%) for each CV version side-by-side.
Action: Identify the "Winning CV" and recommend users to use that version for future applications.
3. AI Optimization Metrics:
Suggestion Impact: A bar chart showing the relationship between "AI Suggestions Accepted" and "Interview Success."
Metric: Accepted Suggestions count vs. Response Rate.
Action: Show a growth indicator: "Users who accept AI optimizations get 30% more interview callbacks."
4. Search & Activity Trends:
Visual: A trend line showing "Application Velocity" over time (Daily/Weekly).
Metric: "Days to first interview" (Time-to-Success).
Insight: Help the user see if they are consistent or if they have "application burnout."
Design & UI Style:
Aesthetic: Clean, dark-mode friendly, data-rich but minimalist (e.g., Shadcn Charts or Recharts implementation).
Interaction: Use "Tooltips" to explain what each metric means.
Empty State: When no data exists, provide a "Getting Started" guide: "Apply to your first 5 jobs to unlock your Career Insights."
Output Requirement:
Provide the Component Structure (Dashboard components).
Propose the Data Schema required from the FastAPI backend to render these charts.
Suggest a User-Friendly summary statement for the top of the page (e.g., "You are performing better than 70% of Frontend Developers in Baku this month").
