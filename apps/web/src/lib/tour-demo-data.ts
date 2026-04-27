import type { CVAnalysisBundleResponse, CVData } from "@/types";

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
        title: "Add HubSpot to your skills",
        description:
          "GrowthBridge requires HubSpot CRM experience. Adding it alongside your existing tools will increase your score by ~8 points.",
        specific_text: null,
        suggested_text: "HubSpot CRM, Salesforce, Marketing Automation, Lead Nurturing",
      },
      {
        category: "rewrite_bullets",
        priority: "high",
        title: "Quantify your campaign results",
        description:
          "Your bullets mention campaigns but lack numbers. Recruiters respond to metrics — add ROI, reach, or conversion data.",
        specific_text: "Led marketing campaigns across multiple channels to drive brand awareness",
        suggested_text:
          "Led 12 cross-channel campaigns generating $2.4M in pipeline and a 34% YoY increase in qualified leads",
      },
      {
        category: "add_keywords",
        priority: "medium",
        title: "Include OKR methodology",
        description:
          "GrowthBridge operates on company-wide OKRs. Showing familiarity in your summary signals cultural alignment.",
        specific_text: null,
        suggested_text:
          "Results-driven marketing leader experienced in OKR-driven goal setting and quarterly performance tracking.",
      },
    ],
    total: 3,
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
