import type { CVAnalysisBundleResponse, CVData, JobListing, SearchResponse, JobDetail } from "@/types";

export const DEMO_JOB_URL = "__demo_job__";

export const DEMO_JOB: JobListing = {
  title: "Marketing Manager",
  company: "GrowthBridge",
  url: DEMO_JOB_URL,
  date_posted: new Date().toISOString(),
  source: "linkedin",
  match_score: 74,
  match_level: "high",
  match_flags: ["title-match", "skills-match", "experience-match"],
  location_str: "San Francisco, CA",
  work_mode_str: "Hybrid",
  seniority_str: "Mid-Senior",
  job_type_str: "Full-time",
  salary_str: "$95k – $130k",
  description_snippet:
    "GrowthBridge is looking for a data-driven Marketing Manager to lead demand generation, performance marketing, and go-to-market strategy. You will own campaign execution across paid and organic channels, manage HubSpot CRM, and drive OKR-aligned growth initiatives.",
};

export const DEMO_SEARCH_RESPONSE: SearchResponse = {
  jobs: [DEMO_JOB],
  total: 1,
  query: "Marketing Manager",
  cached: true,
};

export const DEMO_JOB_DETAIL: JobDetail = {
  title: "Marketing Manager",
  company: "GrowthBridge",
  description: `About GrowthBridge\nGrowthBridge is a fast-growing B2B SaaS company helping mid-market teams unlock revenue through smarter go-to-market execution.\n\nRole Overview\nWe are looking for a data-driven Marketing Manager to own demand generation, performance marketing, and brand strategy. You will report directly to the VP of Marketing and collaborate cross-functionally with Sales, Product, and Customer Success.\n\nResponsibilities\n• Own end-to-end campaign execution across paid (Google Ads, Meta) and organic channels\n• Manage and optimise HubSpot CRM workflows, lead scoring, and nurture sequences\n• Define and track OKRs across marketing — pipeline contribution, MQL volume, CAC, and ROAS\n• Lead go-to-market strategy for new product launches\n• Build and mentor a team of 2–3 marketing specialists\n• Partner with Sales to align on ICP, messaging, and pipeline acceleration\n\nRequirements\n• 5+ years in B2B marketing with proven demand generation results\n• HubSpot CRM certification or equivalent hands-on experience\n• Strong analytical skills — comfortable in GA4, Looker, or similar tools\n• Experience managing $150K+ annual paid budget\n• Familiarity with OKR-driven goal setting\n\nNice to Have\n• Experience at a Series A–C SaaS company\n• Background in content-led growth or PLG motions\n\nCompensation\n$95,000 – $130,000 base + equity + full benefits`,
  email: null,
  email_found: false,
  apply_url: DEMO_JOB_URL,
  error_message: null,
  resolved_apply_url: DEMO_JOB_URL,
  apply_url_confidence: 1,
  apply_requires_login: false,
  fallback_urls: [],
  requirements: [
    "5+ years in B2B marketing with proven demand generation results",
    "HubSpot CRM certification or equivalent hands-on experience",
    "Strong analytical skills — GA4, Looker, or similar",
    "Experience managing $150K+ annual paid budget",
    "Familiarity with OKR-driven goal setting",
  ],
  required_skills: ["HubSpot CRM", "Google Ads", "Meta Ads", "Marketing Automation", "OKR", "Demand Generation"],
  job_summary: "Data-driven Marketing Manager to lead demand generation, performance marketing, and go-to-market strategy at a fast-growing B2B SaaS company.",
};

export const DEMO_BUNDLE: CVAnalysisBundleResponse = {
  analysis: {
    overall_score: 74,
    match_level: "high",
    categories: [
      {
        category: "skills",
        score: 78,
        matched: ["Content Marketing", "Brand Strategy", "SEO", "Social Media"],
        missing: ["HubSpot CRM", "Marketing Automation", "OKR methodology"],
        reasoning:
          "Strong content and brand skills, but missing key technical tools required for this role.",
      },
      {
        category: "experience",
        score: 72,
        matched: ["Campaign management", "Team leadership", "Go-to-market strategy"],
        missing: ["Performance marketing", "Data-driven decision making"],
        reasoning:
          "Solid experience managing campaigns, with some gaps in data-focused marketing.",
      },
      {
        category: "education",
        score: 82,
        matched: ["Marketing degree", "Business management"],
        missing: [],
        reasoning: "Educational background aligns well with the role requirements.",
      },
    ],
    summary:
      "Strong marketing background with relevant campaign and brand experience. Adding HubSpot, quantifying results with metrics, and demonstrating OKR familiarity would push your score above 85.",
  },
  suggestions: {
    suggestions: [
      {
        category: "add_keywords",
        priority: "high",
        title: "Add HubSpot & marketing automation stack",
        description:
          "HubSpot is listed as a hard requirement in the job description — its absence drops your skills score by ~9 points. Adding it with related automation tools signals you can hit the ground running.",
        specific_text: null,
        suggested_text: "HubSpot CRM, Marketing Automation, Lead Nurturing, Pardot, ActiveCampaign",
      },
      {
        category: "rewrite_bullets",
        priority: "high",
        title: "Quantify your biggest campaign win",
        description:
          "GrowthBridge's hiring rubric scores for measurable impact. Your current bullet mentions campaigns but gives no numbers — a single metric here can lift your score by 7–10 points.",
        specific_text: "Led marketing campaigns across multiple channels to drive brand awareness",
        suggested_text:
          "Led 12 cross-channel campaigns generating $2.4M in pipeline and a 34% YoY increase in qualified leads",
      },
      {
        category: "improve_headline",
        priority: "high",
        title: "Rewrite your summary to mirror the job posting",
        description:
          "Your current summary is generic. GrowthBridge's ATS scans for 'data-driven', 'performance marketing', and 'growth' — none appear in your summary. This single change can add 8+ points.",
        specific_text: "Results-driven Marketing Manager with 6+ years driving brand growth across B2B and B2C markets. Proven track record in multi-channel campaign execution, content strategy, and cross-functional team leadership.",
        suggested_text:
          "Data-driven Marketing Manager with 6+ years leading performance marketing and brand growth in B2B and B2C markets. Proven record of building scalable growth engines — $2.4M pipeline generated, 78% organic traffic lift, and 34% YoY lead growth through data-backed campaign strategy.",
      },
      {
        category: "address_requirements",
        priority: "high",
        title: "Add performance marketing experience",
        description:
          "The role explicitly requires paid acquisition experience (Google Ads, Meta). Your CV lists 'Google Ads' in skills but never demonstrates results. Adding a metrics-backed bullet closes this gap directly.",
        specific_text: null,
        suggested_text:
          "Managed $200K+ monthly paid budget across Google Ads and Meta, achieving 3.2x ROAS and reducing cost-per-lead by 27% through continuous A/B testing",
      },
      {
        category: "add_keywords",
        priority: "medium",
        title: "Include OKR & growth methodology keywords",
        description:
          "GrowthBridge runs on company-wide OKRs and expects marketing to tie directly to revenue. Adding these terms to your summary and skills signals cultural fit and strategic alignment.",
        specific_text: null,
        suggested_text: "OKR-driven planning, Growth Marketing, Revenue Operations, Demand Generation, Pipeline Acceleration",
      },
      {
        category: "elevate_experience",
        priority: "medium",
        title: "Highlight cross-functional leadership impact",
        description:
          "GrowthBridge is a scale-up — they need someone who can lead cross-functional initiatives, not just execute campaigns. Elevating your team leadership and stakeholder alignment bullets will strengthen the 'experience' category score.",
        specific_text: null,
        suggested_text:
          "Partnered with Product, Sales, and CS teams to align quarterly go-to-market strategy, reducing sales cycle by 18% and improving win rate by 12% YoY",
      },
    ],
    total: 6,
    job_title: "Marketing Manager",
    job_company: "GrowthBridge",
  },
  draft: {
    text: [
      "Alex Martinez",
      "alex.martinez@email.com | +1 (555) 234-5678 | linkedin.com/in/alexmartinez | San Francisco, CA",
      "",
      "SUMMARY",
      "Results-driven Marketing Manager with 6+ years driving brand growth across B2B and B2C markets. Proven track record in multi-channel campaign execution, content strategy, and cross-functional team leadership.",
      "",
      "EXPERIENCE",
      "",
      "Senior Marketing Manager — Apex Digital | San Francisco, CA | Jan 2021 – Present",
      "• Led 12 cross-channel marketing campaigns generating $2.4M in pipeline",
      "• Managed a team of 5 across content, paid media, and social channels",
      "• Developed go-to-market strategy for 3 product launches resulting in 28% faster adoption",
      "• Implemented marketing analytics dashboard reducing reporting time by 40%",
      "",
      "Marketing Manager — Bright Media | New York, NY | Mar 2018 – Dec 2020",
      "• Grew organic traffic 78% through SEO and content marketing initiatives",
      "• Coordinated with Sales to improve MQL-to-SQL conversion rate by 22%",
      "• Managed $500K annual marketing budget across digital and event channels",
      "",
      "SKILLS",
      "Content Marketing · Brand Strategy · SEO · Campaign Management · Go-to-Market",
      "Google Analytics · Salesforce · Social Media · Google Ads",
      "",
      "EDUCATION",
      "BSc Marketing — University of Commerce | 2014 – 2018 | Dean's List 2016–2018",
    ].join("\n"),
    file_name: "Marketing_Resume_Demo.pdf",
  },
  error_analysis: null,
  error_suggestions: null,
  error_draft: null,
};

export const DEMO_CV_DATA: CVData = {
  personal_info: {
    full_name: "Alex Martinez",
    email: "alex.martinez@email.com",
    phone: "+1 (555) 234-5678",
    location: "San Francisco, CA",
    linkedin: "linkedin.com/in/alexmartinez",
    portfolio: "",
    summary:
      "Results-driven Marketing Manager with 6+ years driving brand growth across B2B and B2C markets. Proven track record in multi-channel campaign execution, content strategy, and cross-functional team leadership.",
  },
  experience: [
    {
      id: "exp-1",
      company: "Apex Digital",
      title: "Senior Marketing Manager",
      location: "San Francisco, CA",
      start_date: "Jan 2021",
      end_date: "Present",
      bullets: [
        "Led 12 cross-channel marketing campaigns generating $2.4M in pipeline",
        "Managed a team of 5 across content, paid media, and social channels",
        "Developed go-to-market strategy for 3 product launches resulting in 28% faster adoption",
        "Implemented marketing analytics dashboard reducing reporting time by 40%",
      ],
    },
    {
      id: "exp-2",
      company: "Bright Media",
      title: "Marketing Manager",
      location: "New York, NY",
      start_date: "Mar 2018",
      end_date: "Dec 2020",
      bullets: [
        "Grew organic traffic 78% through SEO and content marketing initiatives",
        "Coordinated with Sales to improve MQL-to-SQL conversion rate by 22%",
        "Managed $500K annual marketing budget across digital and event channels",
      ],
    },
  ],
  education: [
    {
      id: "edu-1",
      institution: "University of Commerce",
      degree: "BSc",
      field_of_study: "Marketing",
      start_date: "2014",
      end_date: "2018",
      details: ["Dean's List, 2016–2018"],
    },
  ],
  skills: [
    {
      category: "Marketing",
      items: [
        "Content Marketing",
        "Brand Strategy",
        "SEO",
        "Campaign Management",
        "Go-to-Market Strategy",
      ],
    },
    {
      category: "Tools",
      items: ["Google Analytics", "Salesforce", "Google Ads", "Social Media Management"],
    },
  ],
  languages: [{ language: "English", level: "Native" }],
  certifications: [],
  additional_sections: {},
};
