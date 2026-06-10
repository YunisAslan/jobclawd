"use client";

import Link from "next/link";
import { JobClawdLogo } from "@/assets/JobClawdLogo";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  BarChart2,
  Zap,
  TrendingUp,
  FileText,
  CheckCircle2,
  Check,
  ArrowRight,
  Star,
  GitCompare,
  LayoutGrid,
  ChevronRight,
  MapPin,
  Bookmark,
  User,
  Eye,
  Sparkles,
  ExternalLink,
  PencilLine,
  RefreshCw,
  Copy,
  Wand2,
  GraduationCap,
  Briefcase,
  DollarSign,
  CalendarDays,
  ArrowUpDown,
  RotateCcw,
  Clock,
  Globe2,
  Monitor,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Accordion";
import { CreditComingSoonModal } from "@/components/credits/CreditComingSoonModal";
import LandingFooter from "@/components/layout/LandingFooter";
import { Marquee } from "@/registry/magicui/marquee";
import CVStructuredEditor from "@/components/feed/vacancy/CVStructuredEditor";
import CVMiniPreview from "@/components/feed/vacancy/CVMiniPreview";
import FeedJobCard from "@/components/feed/FeedJobCard";
import VacancySummary from "@/components/feed/vacancy/VacancySummary";
import MatchScoreBreakdown from "@/components/feed/vacancy/MatchScoreBreakdown";
import CVSelector from "@/components/feed/vacancy/CVSelector";
import SelectBox from "@/components/SelectBox";
import type { CVData, JobListing, CVMatchAnalysis, JobDetail } from "@/types";

/* ─── Animated gradient headline ─────────────────────────────── */
function GradientText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("bg-clip-text text-transparent", className)}
      style={{
        backgroundImage:
          "linear-gradient(135deg, #a5a6ff 0%, #7b7cff 30%, #c084fc 60%, #7b7cff 100%)",
        backgroundSize: "200% 200%",
        animation: "gradient-x 4s ease infinite",
      }}
    >
      {children}
    </span>
  );
}

/* ─── Number ticker ───────────────────────────────────────────── */
function NumberTicker({
  value,
  prefix = "",
  suffix = "",
  duration = 1800,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    const raf = (t: number) => {
      const progress = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(raf);
      else setCount(value);
    };
    requestAnimationFrame(raf);
  }, [started, value, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {count}
      {suffix}
    </span>
  );
}

/* ─── Interactive hero demo ───────────────────────────────────── */
const DEMO_SCENES = ["feed", "detail", "improve", "analyzing", "suggestions"] as const;
type DemoScene = (typeof DEMO_SCENES)[number];

const SCENE_DURATIONS: Record<DemoScene, number> = {
  feed:        2000,
  detail:      2800,
  improve:     1800,
  analyzing:   2500,
  suggestions: 4000,
};

const CURSOR_TARGETS: Record<DemoScene, { x: number; y: number }> = {
  feed:        { x: 610,  y: 390 },
  detail:      { x: 1400, y: 117 },
  improve:     { x: 1300, y: 248 },
  analyzing:   { x: 1178, y: 478 },
  suggestions: { x: 198,  y: 305 },
};

const PHASE_DURATIONS = { cursorMove: 750, click: 500, fade: 480 } as const;
type AnimPhase = "display" | "cursor-moving" | "clicking" | "fading";


const DEMO_SELECTED_JOB: JobListing = {
  title: "Senior Project Manager",
  company: "Deloitte",
  url: "https://linkedin.com/jobs/view/demo-123",
  date_posted: "2025-04-28",
  source: "linkedin",
  match_score: 72,
  match_level: "review",
  match_flags: ["Work mode mismatch"],
  location_str: "London, England, UK",
  work_mode_str: "Hybrid",
  salary_str: "£70,000 – £85,000/yr",
  seniority_str: "Senior",
  job_type_str: "Full-time",
  description_snippet: "Deloitte is seeking a Senior Project Manager to lead digital transformation initiatives across financial services and retail sectors.",
  skills_str: "Agile, Scrum, JIRA, Stakeholder Management, Risk Management, MS Project",
};

const DEMO_JOB_LISTINGS: JobListing[] = [
  DEMO_SELECTED_JOB,
  {
    title: "IT Project Manager",
    company: "Accenture",
    url: "https://linkedin.com/jobs/view/demo-124",
    date_posted: "2025-04-25",
    source: "linkedin",
    match_score: 68,
    match_level: "review",
    match_flags: [],
    location_str: "Manchester, UK",
    work_mode_str: "Hybrid",
    seniority_str: "Senior",
    job_type_str: "Full-time",
  },
  {
    title: "Agile Project Manager",
    company: "IBM",
    url: "https://indeed.com/jobs/view/demo-125",
    date_posted: "2025-05-01",
    source: "indeed",
    match_score: 60,
    match_level: "review",
    match_flags: [],
    location_str: "Remote — Worldwide",
    work_mode_str: "Remote",
    job_type_str: "Contract",
  },
  {
    title: "Digital Transformation PM",
    company: "PwC",
    url: "https://indeed.com/jobs/view/demo-126",
    date_posted: "2025-04-18",
    source: "indeed",
    match_score: 55,
    match_level: "review",
    match_flags: [],
    location_str: "Birmingham, UK",
    work_mode_str: "Hybrid",
    job_type_str: "Full-time",
  },
];

const DEMO_CV_DATA: CVData = {
  personal_info: {
    full_name: "Alex Johnson",
    email: "alex.johnson@email.com",
    phone: "+44 7700 900 000",
    location: "London, United Kingdom",
    linkedin: "linkedin.com/in/alexjohnson",
    portfolio: "",
    summary: "Senior Project Manager with 5+ years delivering complex digital transformation projects across financial services and retail sectors.",
  },
  experience: [
    {
      id: "exp1",
      company: "TechCorp Ltd",
      title: "Senior Project Manager",
      location: "London, UK",
      start_date: "Jan 2020",
      end_date: "Present",
      bullets: [
        "Managed multiple projects successfully across the portfolio",
        "Led cross-functional teams of 8–12 people across 5 departments",
        "Coordinated with key stakeholders to align project deliverables",
      ],
    },
    {
      id: "exp2",
      company: "Accenture",
      title: "Project Manager",
      location: "Manchester, UK",
      start_date: "Jun 2018",
      end_date: "Dec 2019",
      bullets: [
        "Delivered digital transformation projects for FTSE 100 clients on schedule",
        "Managed project budgets up to £500K with full financial accountability",
      ],
    },
  ],
  education: [
    {
      id: "edu1",
      institution: "University of Manchester",
      degree: "BSc (Hons)",
      field_of_study: "Business Management",
      start_date: "2014",
      end_date: "2018",
      details: ["First Class Honours"],
    },
  ],
  skills: [
    { category: "Project Management", items: ["Agile", "Scrum", "JIRA", "MS Project", "Stakeholder Management", "Risk Management"] },
    { category: "Tools & Certifications", items: ["Confluence", "Trello", "Budget Planning"] },
  ],
  languages: [
    { language: "English", level: "Native" },
    { language: "French", level: "Conversational" },
  ],
  certifications: [],
  additional_sections: {},
};

/* ─── Full-size demo layout constants ─────────────────────────── */
const DEMO_FULL_W = 1600;
const DEMO_FULL_H = 720;
const DEMO_PANEL_W = 560;
const DEMO_SIDEBAR_W = 260;

/* CV editor ATS preview column */
const EDITOR_PREVIEW_W = 280;
const EDITOR_DOC_W = 600;
const EDITOR_PREVIEW_SCALE = EDITOR_PREVIEW_W / EDITOR_DOC_W;

/* ─── Demo mock detail + analysis data ────────────────────────── */
const DEMO_CV_LINK = { name: "My_Resume_2024", url: "__demo__" };

const DEMO_JOB_DETAIL: JobDetail = {
  title: "Senior Project Manager",
  company: "Deloitte",
  description: "",
  email: null,
  email_found: false,
  apply_url: null,
  error_message: null,
  resolved_apply_url: null,
  apply_url_confidence: 0,
  apply_requires_login: false,
  fallback_urls: [],
  requirements: [
    "5+ years project management experience in financial services",
    "PMP or Prince2 certification (preferred)",
    "Strong Agile/Scrum delivery background",
    "Excellent stakeholder management skills",
    "Budget management experience up to £1M+",
    "Experience leading cross-functional teams",
  ],
  nice_to_haves: [
    "Exposure to digital transformation programmes",
    "Familiarity with JIRA and Confluence",
    "MBA or equivalent business qualification",
  ],
  required_skills: ["Agile", "Scrum", "JIRA", "Risk Management", "Stakeholder Management"],
  job_summary: "Deloitte is seeking a Senior Project Manager to lead complex digital transformation programmes across financial services clients. You will own delivery end-to-end, manage senior stakeholders, and drive cross-functional teams.",
};

const DEMO_MATCH_ANALYSIS: CVMatchAnalysis = {
  overall_score: 72,
  match_level: "review",
  categories: [
    {
      category: "Skills",
      score: 78,
      matched: ["Agile", "Scrum", "JIRA", "Stakeholder Management", "Risk Management"],
      missing: ["PMP Certification", "Prince2"],
      reasoning: "Strong Agile/Scrum foundation. Missing PMP certification mentioned in requirements.",
    },
    {
      category: "Experience",
      score: 75,
      matched: ["5+ years PM experience", "Digital transformation", "Cross-functional teams"],
      missing: ["Financial services background", "Budget >£1M"],
      reasoning: "Solid PM experience. Lacks direct financial services and large-budget exposure.",
    },
    {
      category: "Fit",
      score: 80,
      matched: ["Strong career trajectory", "Relevant seniority level"],
      missing: [],
      reasoning: "Overall profile and career progression aligns well with a senior PM role at a major consultancy.",
    },
    {
      category: "Keywords",
      score: 58,
      matched: ["JIRA", "MS Project", "Stakeholder", "Risk Management"],
      missing: ["PMP", "Prince2", "Agile certification"],
      reasoning: "Key industry keywords partially present. Missing certifications reduce score.",
    },
  ],
  summary: "Strong project management profile with solid Agile/Scrum experience. Key gaps are PMP certification and direct financial services background — both worth addressing to lift the score.",
};

function CVEditorWorkspace() {
  const [cvData, setCvData] = useState<CVData>(DEMO_CV_DATA);
  const [kwAccepted, setKwAccepted] = useState(false);
  const [bulletApplied, setBulletApplied] = useState(false);

  function acceptKeyword() {
    setKwAccepted(true);
    setCvData((prev) => ({
      ...prev,
      skills: prev.skills.map((g, i) =>
        i === 1 ? { ...g, items: [...g.items, "PMP Certification"] } : g,
      ),
    }));
  }

  function acceptBullet() {
    setBulletApplied(true);
    setCvData((prev) => ({
      ...prev,
      experience: prev.experience.map((e, i) =>
        i === 0
          ? { ...e, bullets: ["Delivered 12 projects on time, saving £2M+ across budget", ...e.bullets.slice(1)] }
          : e,
      ),
    }));
  }

  const pendingCount = (kwAccepted ? 0 : 1) + (bulletApplied ? 0 : 1) + 6;

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full animate-in fade-in duration-300 overflow-hidden">

      {/* ── Match Score Strip (mirrors real MatchScoreStrip) ─────── */}
      <div className="px-6 py-3 border-b border-border/40 shrink-0 bg-muted/20 flex items-center gap-4">
        <div className="flex flex-col items-center justify-center rounded-xl px-3 py-2 border shrink-0 bg-match-review/10 border-match-review/20">
          <span className="text-xl font-bold leading-none tabular-nums text-match-review">72</span>
          <span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5 opacity-70 text-match-review">Match</span>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
            <div className="h-full rounded-full bg-match-review" style={{ width: "72%" }} />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{DEMO_MATCH_ANALYSIS.summary}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 pl-2 border-l border-border/40">
          {DEMO_MATCH_ANALYSIS.categories.map((cat) => {
            const c = cat.score >= 75 ? "text-match-high" : "text-match-review";
            const catShort: Record<string, string> = { Skills: "Skills", Experience: "Exp", Fit: "Fit", Keywords: "KW" };
            return (
              <div key={cat.category} className="flex flex-col items-center gap-0.5">
                <span className={cn("text-sm font-bold tabular-nums leading-none", c)}>{cat.score}</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{catShort[cat.category] ?? cat.category}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">

        {/* Suggestions panel — mirrors WorkspaceSuggestions */}
        <aside className="w-80 flex-none border-r border-border/50 flex flex-col overflow-hidden bg-muted/20">

          {/* Header */}
          <div className="px-4 pt-3.5 pb-3 border-b border-border/40 shrink-0 space-y-2.5 bg-background">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-foreground">AI Suggestions</p>
                <Badge variant="outline" className="text-[10px] font-medium">8</Badge>
              </div>
              <Button type="button" variant="ghost" size="icon" className="size-6 text-muted-foreground/60 hover:text-foreground">
                <RefreshCw className="size-3.5" />
              </Button>
            </div>
            {/* Apply all */}
            <div className="flex items-center gap-1.5">
              <Button type="button" size="sm" className="gap-1.5 h-7 text-[11px] px-2.5 flex-1">
                <Wand2 className="size-3" /> Apply all ({pendingCount})
              </Button>
            </div>
            {/* How-to pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Wand2 className="size-2.5" /> Apply
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400">
                <Copy className="size-2.5" /> Copy
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400">
                <PencilLine className="size-2.5" /> Rewrite
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="px-4 py-1.5 shrink-0">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              {pendingCount} pending · {kwAccepted || bulletApplied ? (kwAccepted ? 1 : 0) + (bulletApplied ? 1 : 0) : 0} applied · 0 declined
            </span>
          </div>

          {/* Suggestion list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">

            {/* Suggestion 1 — Add PMP */}
            <div className={cn("rounded-lg border p-3 space-y-2 transition-all", kwAccepted ? "border-success/30 bg-success/5" : "border-border/50")}>
              <div className="flex items-start gap-1.5">
                <span className="mt-1.5 size-1.5 rounded-full shrink-0 bg-destructive" />
                <p className="text-xs font-semibold text-foreground leading-snug flex-1 min-w-0">Add &apos;PMP Certification&apos;</p>
                {kwAccepted && (
                  <Badge className="text-[9px] font-semibold px-1.5 py-0 bg-success/10 text-success border border-success/20 shrink-0">Applied</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 pl-3">
                <ArrowRight className="size-3 text-primary/50" />
                <span className="text-[10px] font-medium text-primary/70">Tools &amp; Certifications section</span>
              </div>
              <div className="pl-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">Adding PMP certification directly addresses the required qualification and significantly boosts your keyword score.</p>
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-[10px] text-primary font-medium mt-0.5 gap-0.5">
                  <ChevronRight className="size-3" /> Read more
                </Button>
              </div>
              {!kwAccepted && (
                <div className="rounded border overflow-hidden text-[11px] font-mono ml-3">
                  <div className="flex gap-1.5 px-2 py-1.5 bg-success/5">
                    <span className="text-success font-bold shrink-0">+</span>
                    <span className="text-success/80 leading-normal flex-1 min-w-0">PMP Certification</span>
                  </div>
                </div>
              )}
              {!kwAccepted && (
                <div className="flex gap-1.5 pl-3">
                  <Button size="sm" className="flex-1 h-7 text-[11px] gap-1" onClick={acceptKeyword}>
                    <Wand2 className="size-3" /> Apply to Skills
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5">Decline</Button>
                </div>
              )}
            </div>

            {/* Suggestion 2 — Quantify impact */}
            <div className={cn("rounded-lg border p-3 space-y-2 transition-all", bulletApplied ? "border-success/30 bg-success/5" : "border-border/50")}>
              <div className="flex items-start gap-1.5">
                <span className="mt-1.5 size-1.5 rounded-full shrink-0 bg-warning" />
                <p className="text-xs font-semibold text-foreground leading-snug flex-1 min-w-0">Quantify delivery impact</p>
                {bulletApplied && (
                  <Badge className="text-[9px] font-semibold px-1.5 py-0 bg-success/10 text-success border border-success/20 shrink-0">Applied</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 pl-3">
                <ArrowRight className="size-3 text-primary/50" />
                <span className="text-[10px] font-medium text-primary/70">Experience section</span>
              </div>
              <div className="pl-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">This bullet is currently framed generically. Adding specific metrics strengthens impact and ATS scoring.</p>
              </div>
              {!bulletApplied && (
                <div className="rounded border border-border overflow-hidden text-[11px] font-mono ml-3">
                  <div className="flex gap-1.5 px-2 py-1.5 bg-destructive/5 border-b border-destructive/10">
                    <span className="text-destructive/60 font-bold shrink-0">−</span>
                    <span className="text-destructive/50 line-through leading-normal flex-1">Managed multiple projects successfully</span>
                  </div>
                  <div className="flex gap-1 px-2 py-1.5 bg-success/5">
                    <span className="text-success font-bold shrink-0 mt-px">+</span>
                    <span className="text-success/80 leading-normal flex-1">Delivered 12 projects on time, saving £2M+</span>
                  </div>
                </div>
              )}
              {!bulletApplied && (
                <div className="flex gap-1.5 pl-3">
                  <Button size="sm" className="flex-1 h-7 text-[11px] gap-1" onClick={acceptBullet}>
                    <Wand2 className="size-3" /> Apply to Experience
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5">Decline</Button>
                </div>
              )}
            </div>

            {/* Suggestion 3 — Address requirements (static preview) */}
            <div className="rounded-lg border border-border/50 p-3 space-y-2">
              <div className="flex items-start gap-1.5">
                <span className="mt-1.5 size-1.5 rounded-full shrink-0 bg-warning" />
                <p className="text-xs font-semibold text-foreground leading-snug flex-1 min-w-0">Highlight stakeholder experience</p>
              </div>
              <div className="flex items-center gap-1.5 pl-3">
                <ArrowRight className="size-3 text-primary/50" />
                <span className="text-[10px] font-medium text-primary/70">Summary section</span>
              </div>
              <div className="pl-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">The job requires senior stakeholder management. Make this more explicit in your headline and summary.</p>
              </div>
            </div>

          </div>
        </aside>

        {/* Real CV Editor */}
        <div className="flex-1 overflow-y-auto border-r border-border min-w-0">
          <CVStructuredEditor data={cvData} onChange={setCvData} />
        </div>

        {/* ATS Preview — compact */}
        <div className="shrink-0 flex flex-col bg-muted/5 border-l border-border/40" style={{ width: EDITOR_PREVIEW_W }}>
          <div className="px-3 py-2 border-b border-border bg-card flex items-center justify-between shrink-0">
            <span className="text-[11px] font-semibold text-muted-foreground">ATS Preview</span>
            <span className="text-[10px] font-bold text-match-review bg-match-review/10 border border-match-review/20 rounded px-1.5 py-0.5">72%</span>
          </div>
          <div className="flex-1 overflow-hidden" style={{ width: EDITOR_PREVIEW_W }}>
            <div
              style={{
                width: EDITOR_DOC_W,
                transform: `scale(${EDITOR_PREVIEW_SCALE})`,
                transformOrigin: "top left",
                pointerEvents: "none",
              }}
            >
              <CVMiniPreview data={cvData} originalData={DEMO_CV_DATA} />
            </div>
          </div>
          <div className="px-3 py-2 border-t border-border/40 bg-card shrink-0">
            <p className="text-[10px] text-muted-foreground text-center">Hover to magnify · updates live as you edit</p>
          </div>
        </div>

      </div>
    </div>
  );
}


function HeroInteractiveDemo({ onOpenWaitlist }: { onOpenWaitlist?: () => void }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [phase, setPhase] = useState<AnimPhase>("display");
  const [cursorPos, setCursorPos] = useState({ x: 700, y: 360 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const scene = DEMO_SCENES[sceneIdx];
  const showPanel = scene !== "feed" && scene !== "suggestions";
  const scaledH = Math.round(DEMO_FULL_H * scale);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.offsetWidth / DEMO_FULL_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const s = DEMO_SCENES[sceneIdx];
    const target = CURSOR_TARGETS[s];
    const { cursorMove, click, fade } = PHASE_DURATIONS;
    const hold = SCENE_DURATIONS[s];
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => {
      setPhase("cursor-moving");
      setCursorPos(target);
    }, hold));

    timers.push(setTimeout(() => {
      setPhase("clicking");
    }, hold + cursorMove));

    timers.push(setTimeout(() => {
      setPhase("fading");
    }, hold + cursorMove + click));

    timers.push(setTimeout(() => {
      setSceneIdx((i) => (i + 1) % DEMO_SCENES.length);
      setPhase("display");
    }, hold + cursorMove + click + fade));

    return () => timers.forEach(clearTimeout);
  }, [sceneIdx]);

  const isFading = phase === "fading";
  const isClicking = phase === "clicking";
  const isCursorMoving = phase === "cursor-moving";

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden border border-border/60 shadow-2xl shadow-black/12 ring-1 ring-border/30 bg-background pointer-events-none select-none"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-3 h-8 bg-card border-b border-border shrink-0">
        <span className="size-2 rounded-full bg-red-400/80" />
        <span className="size-2 rounded-full bg-amber-400/80" />
        <span className="size-2 rounded-full bg-green-400/80" />
        <div className="flex-1 mx-3 h-5 rounded bg-muted/50 flex items-center px-2.5">
          <span className="text-[10px] text-muted-foreground/60">app.jobclawd.com/dashboard/feed</span>
        </div>
      </div>

      {/* Scaled app layout */}
      <div style={{ height: scaledH, overflow: "hidden" }}>
        <div
          style={{
            width: DEMO_FULL_W,
            height: DEMO_FULL_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            display: "flex",
            position: "relative",
            opacity: isFading ? 0 : 1,
            transition: isFading
              ? "opacity 0.48s cubic-bezier(0.4,0,0.6,1)"
              : "opacity 0.52s cubic-bezier(0.0,0,0.2,1)",
          }}
        >
          {/* ── Fake cursor ─────────────────────────────────────── */}
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              transform: "translate(-2px, -1px)",
              opacity: phase === "display" ? 0 : 1,
              transition: isCursorMoving
                ? "left 0.75s cubic-bezier(0.25,0.46,0.45,0.94), top 0.75s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.22s ease"
                : "opacity 0.3s ease",
              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))",
            }}
          >
            {/* Click ripple rings */}
            {isClicking && (
              <>
                <div
                  className="absolute rounded-full border-2 border-primary"
                  style={{
                    width: 48, height: 48, left: -24, top: -24,
                    opacity: 0.7,
                    animation: "ping 0.5s cubic-bezier(0,0,0.2,1) 1 forwards",
                  }}
                />
                <div
                  className="absolute rounded-full bg-primary/25"
                  style={{
                    width: 30, height: 30, left: -15, top: -15,
                    animation: "ping 0.38s cubic-bezier(0,0,0.2,1) 0.07s 1 forwards",
                  }}
                />
              </>
            )}
            {/* Cursor SVG — standard arrow pointer */}
            <svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M2.5 1.5L2.5 16.5L6.5 12.5L9.2 19.5L11.6 18.6L8.9 11.5H15.5L2.5 1.5Z"
                fill="white"
                stroke="#18181b"
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Sidebar */}
          {scene !== "suggestions" && (
            <div
              className="border-r border-border bg-sidebar flex flex-col shrink-0"
              style={{ width: DEMO_SIDEBAR_W }}
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <JobClawdLogo size={13} className="text-foreground opacity-80" />
              </div>
              <nav className="flex-1 py-2 px-2 space-y-0.5">
                {([
                  { icon: LayoutGrid, label: "Job Feed",   active: true  },
                  { icon: Bookmark,   label: "Saved Jobs", active: false },
                  { icon: BarChart2,  label: "Analytics",  active: false },
                  { icon: User,       label: "Profile",    active: false },
                ] as const).map(({ icon: Icon, label, active }) => (
                  <div key={label} className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors",
                    active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}>
                    <Icon className="size-4 shrink-0" />{label}
                  </div>
                ))}
              </nav>
              <div className="px-4 py-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Credits</span>
                  <span className="font-medium">438</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-4/5 rounded-full bg-primary" />
                </div>
                <p
                  className="text-xs text-primary/70 cursor-pointer hover:text-primary"
                  onClick={onOpenWaitlist}
                >
                  + Get more credits
                </p>
              </div>
            </div>
          )}

          {/* Main content */}
          {scene === "suggestions" ? (
            <CVEditorWorkspace />
          ) : (
            <>
              {/* Feed column */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 px-4 h-11 border-b border-border bg-background shrink-0">
                  <span className="text-sm font-semibold flex-1">Job Feed</span>
                  <div className="size-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">A</div>
                </div>
                {/* Search bar */}
                <div className="px-4 pt-2.5 pb-2 border-b border-border space-y-2 shrink-0">
                  <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-muted/20">
                    <Search className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground flex-1">project manager</span>
                    <button className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 mr-1">
                      <Sparkles className="size-3" /> Fill from profile
                    </button>
                    <Button size="sm" className="h-6 px-2.5 text-xs shrink-0">Search</Button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 pointer-events-none">
                    <SelectBox icon={<Globe2 className="size-4 text-muted-foreground" />} placeholder="Source" options={[]} mode="multiple" />
                    <SelectBox icon={<Monitor className="size-4 text-muted-foreground" />} placeholder="Work mode" options={[]} mode="multiple" />
                    <SelectBox icon={<MapPin className="size-4 text-muted-foreground" />} placeholder="Country/City" options={[]} />
                    <SelectBox icon={<GraduationCap className="size-4 text-muted-foreground" />} placeholder="Experience" options={[]} mode="multiple" />
                    <SelectBox icon={<Briefcase className="size-4 text-muted-foreground" />} placeholder="Job type" options={[]} mode="multiple" />
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 pointer-events-none">
                    <div className="col-span-3 flex items-center gap-2 rounded-md border border-input bg-transparent dark:bg-input/30 px-3 py-0 h-9 text-sm shadow-xs">
                      <DollarSign className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground text-sm">Minimum salary</span>
                    </div>
                    <SelectBox icon={<CalendarDays className="size-4 text-muted-foreground" />} placeholder="Date posted" options={[]} />
                    <SelectBox icon={<ArrowUpDown className="size-4 text-muted-foreground" />} placeholder="Sort by" options={[]} />
                  </div>
                </div>
                {/* Results bar */}
                <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-muted/10 text-xs shrink-0 flex-wrap">
                  <span className="text-muted-foreground flex-1">5 positions found</span>
                  <button className="flex items-center gap-1 text-muted-foreground">
                    <RotateCcw className="size-3" /> Refresh <span className="text-foreground font-medium">· 1 credit</span>
                  </button>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600">
                    <Clock className="size-3" /> Cached · refreshes in 2h 3m
                  </span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                    438/500 credits
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="size-2 rounded-full bg-match-review shrink-0" />
                    <span className="text-sm font-semibold text-muted-foreground">Needs Review</span>
                    <span className="text-xs text-muted-foreground/50">4</span>
                  </div>
                  {DEMO_JOB_LISTINGS.map((job, idx) => (
                    <FeedJobCard
                      key={idx}
                      job={job}
                      saved={false}
                      onToggleSave={() => {}}
                      onDetails={() => {}}
                    />
                  ))}
                </div>
              </div>

              {/* Detail panel */}
              {showPanel && (
                <div
                  className="border-l border-border flex flex-col bg-background shrink-0 overflow-hidden"
                  style={{ width: DEMO_PANEL_W }}
                >
                  <div className="px-5 pt-4 pb-4 border-b border-border/50 shrink-0">
                    <div className="flex items-start gap-2">
                      <p className="text-sm leading-snug line-clamp-2 flex-1 min-w-0 pt-0.5 font-semibold">Senior Project Manager</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center gap-1 rounded-lg px-2 py-1 border bg-match-review/10 border-match-review/20">
                          <span className="text-xs font-bold tabular-nums leading-none text-match-review">72</span>
                          <span className="text-[9px] font-medium opacity-70 text-match-review">match</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs flex items-center gap-2 mt-0.5 text-muted-foreground">
                      <span>Deloitte</span>
                      <span className="text-[10px] px-1.5 py-px rounded border border-blue-500/30 bg-blue-500/10 text-blue-500 font-medium uppercase tracking-wide">LinkedIn</span>
                    </div>
                  </div>

                  <div className="px-5 pt-3 pb-0 shrink-0">
                    <div className="inline-flex w-full h-9 items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
                      <button className={cn(
                        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-all",
                        scene === "detail"
                          ? "bg-background text-foreground shadow-sm dark:bg-input/30 dark:text-foreground dark:border-input"
                          : "text-foreground/60",
                      )}>
                        <Eye className="size-3.5" /> Overview
                      </button>
                      <button className={cn(
                        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-all",
                        (scene === "improve" || scene === "analyzing")
                          ? "bg-background text-foreground shadow-sm dark:bg-input/30 dark:text-foreground dark:border-input"
                          : "text-foreground/60",
                      )}>
                        <Sparkles className="size-3.5" /> Improve CV
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {scene === "detail" && (
                      <div className="px-5 py-5 space-y-5">
                        <VacancySummary job={DEMO_SELECTED_JOB} detail={DEMO_JOB_DETAIL} loadingDetail={false} />
                        <MatchScoreBreakdown job={DEMO_SELECTED_JOB} />
                      </div>
                    )}
                    {scene === "improve" && (
                      <div className="px-5 py-5 space-y-4">
                        <CVSelector cvLinks={[DEMO_CV_LINK]} selectedCV={DEMO_CV_LINK} onChange={() => {}} />
                        <Button className="w-full gap-2">Analyze CV</Button>
                      </div>
                    )}
                    {scene === "analyzing" && (
                      <div className="px-5 py-5 space-y-4">
                        <CVSelector cvLinks={[DEMO_CV_LINK]} selectedCV={DEMO_CV_LINK} onChange={() => {}} />
                        <Button className="w-full gap-2">Analyze CV</Button>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="size-3 text-muted-foreground" />
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Results · 1 CV</span>
                          </div>
                          <div className="relative rounded-xl border bg-card p-3 space-y-2 border-match-review/20">
                            <div className="flex items-center gap-2.5 pr-6">
                              <span className="text-[10px] font-bold text-muted-foreground/60 tabular-nums w-4 shrink-0">#1</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">My_Resume_2024</p>
                              </div>
                              <div className="flex items-baseline gap-0.5 shrink-0 px-2 py-0.5 rounded-lg border mr-2 bg-match-review/10 border-match-review/20">
                                <span className="text-sm font-bold tabular-nums leading-none text-match-review">72</span>
                              </div>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                              <div className="h-full rounded-full bg-match-review" style={{ width: "72%" }} />
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">Strong PM profile with solid Agile/Scrum experience. Key gaps: PMP certification and direct financial services background.</p>
                            <div className="flex gap-2 pt-0.5">
                              <Button className="flex-1 h-8 gap-1.5 text-xs">
                                <PencilLine className="size-3.5" /> Edit CV
                              </Button>
                              <Button variant="outline" size="icon" className="size-8 shrink-0">
                                <RefreshCw className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-4 border-t border-border/50 flex gap-2 shrink-0">
                    <Button variant="outline" className="gap-2 shrink-0">
                      <Bookmark className="size-3.5" /> Save
                    </Button>
                    <Button className="flex-1 gap-2">
                      <ExternalLink className="size-3.5" /> Open &amp; apply
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}




/* ─── Sources marquee ─────────────────────────────────────────── */
const PLATFORM_ROWS: { name: string; accent: string }[][] = [
  [
    { name: "LinkedIn", accent: "bg-blue-500" },
    { name: "Indeed", accent: "bg-indigo-500" },
    { name: "Glassdoor", accent: "bg-green-500" },
    { name: "Simplify", accent: "bg-violet-500" },
    { name: "ZipRecruiter", accent: "bg-green-400" },
  ],
  [
    { name: "RemoteOK", accent: "bg-teal-500" },
    { name: "Dice", accent: "bg-orange-500" },
    { name: "WeWorkRemotely", accent: "bg-sky-500" },
    { name: "Remotive", accent: "bg-rose-500" },
    { name: "Jobgether", accent: "bg-pink-500" },
  ],
];

const ROW_DURATIONS = ["[--duration:30s]", "[--duration:34s]"];

function PlatformChip({ name, accent }: { name: string; accent: string }) {
  return (
    <div className="group flex items-center gap-2 px-3.5 py-2 mx-1.5 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground whitespace-nowrap select-none shadow-sm transition-all duration-200 hover:border-border hover:text-foreground hover:shadow-md cursor-default">
      <span
        className={cn(
          "size-1.5 rounded-full shrink-0 opacity-70 group-hover:opacity-100 transition-opacity duration-200",
          accent,
        )}
      />
      {name}
    </div>
  );
}

function LogoStrip() {
  return (
    <div className="py-14 border-y border-border/40 bg-muted/10">
      <p className="text-center text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.2em] mb-8">
        We search everywhere, so you don&apos;t have to
      </p>

      <div className="relative max-w-4xl mx-auto overflow-hidden space-y-2.5">
        {/* fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 z-10 bg-linear-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 z-10 bg-linear-to-l from-background to-transparent" />

        {PLATFORM_ROWS.map((row, i) => (
          <Marquee
            key={i}
            reverse={i === 1}
            pauseOnHover
            repeat={2}
            className={cn("[--gap:0px]", ROW_DURATIONS[i])}
          >
            {row.map(({ name, accent }) => (
              <PlatformChip key={name} name={name} accent={accent} />
            ))}
          </Marquee>
        ))}
      </div>
    </div>
  );
}

/* ─── How it works — step preview mini-mockups ──────────────────── */

function StepSearchPreview() {
  const jobs = [
    { title: "Product Manager", company: "Stripe", location: "Remote", score: 88, high: true },
    { title: "Marketing Manager", company: "Shopify", location: "Remote", score: 71, high: false },
    { title: "Program Manager", company: "Notion", location: "Remote", score: 54, high: false },
  ];
  return (
    <div className="space-y-2.5">
      {/* Search bar */}
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5">
        <Search className="size-3 text-muted-foreground/60 shrink-0" />
        <span className="text-[11px] text-foreground/80 flex-1">Product Manager</span>
        <span className="text-[9px] font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5">Search</span>
      </div>
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1">
        {[
          { label: "Remote", icon: "🌍" },
          { label: "Senior", icon: "⭐" },
        ].map(({ label, icon }) => (
          <span key={label} className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground">
            <span>{icon}</span>{label}
          </span>
        ))}
      </div>
      {/* Results */}
      <p className="text-[9px] text-muted-foreground/60 pl-0.5">3 positions found · scored by CV match</p>
      {jobs.map((j) => (
        <div key={j.title} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border bg-background">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground leading-tight">{j.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{j.company} · {j.location}</p>
          </div>
          <div className={cn(
            "shrink-0 flex flex-col items-center px-2 py-0.5 rounded-md border tabular-nums",
            j.high ? "bg-match-high/10 border-match-high/20" : j.score >= 65 ? "bg-match-review/10 border-match-review/20" : "bg-muted/40 border-border",
          )}>
            <span className={cn("text-xs font-bold leading-tight",
              j.high ? "text-match-high" : j.score >= 65 ? "text-match-review" : "text-muted-foreground"
            )}>{j.score}</span>
            <span className={cn("text-[8px] font-semibold uppercase tracking-wide",
              j.high ? "text-match-high/70" : j.score >= 65 ? "text-match-review/70" : "text-muted-foreground/50"
            )}>{j.high ? "High" : j.score >= 65 ? "Review" : "Low"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StepScorePreview() {
  const categories = [
    { label: "Skills",      score: 85, color: "bg-match-high" },
    { label: "Experience",  score: 72, color: "bg-match-review" },
    { label: "Fit",         score: 80, color: "bg-match-high" },
    { label: "Keywords",    score: 58, color: "bg-amber-400" },
  ];
  return (
    <div className="space-y-3">
      {/* Overall score circle */}
      <div className="flex items-center gap-3">
        <div className="relative size-14 shrink-0">
          <svg className="size-14 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--match-review))" strokeWidth="2.5"
              strokeDasharray={`${78 * 0.974} 100`} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-match-review tabular-nums">78</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Needs Review</p>
          <p className="text-[10px] text-muted-foreground leading-snug">Good fit — a few keyword gaps</p>
        </div>
      </div>
      {/* Category bars */}
      <div className="space-y-1.5">
        {categories.map(({ label, score, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-border/40 overflow-hidden">
              <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
            </div>
            <span className="text-[10px] font-medium tabular-nums text-foreground/70 w-5 text-right">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepSuggestPreview() {
  return (
    <div className="space-y-2">
      {/* Suggestion card */}
      <div className="rounded-lg border border-border/60 bg-background p-2.5 space-y-2">
      
        {/* Diff */}
        <div className="rounded border overflow-hidden text-[10px] font-mono">
          <div className="flex gap-1.5 px-2 py-1.5 bg-red-50 dark:bg-red-950/30">
            <span className="text-red-400 font-bold shrink-0 mt-0.5">−</span>
            <span className="text-red-600/80 line-through dark:text-red-400/80 leading-snug">Managed a team and worked on product improvements</span>
          </div>
          <div className="flex gap-1.5 px-2 py-1.5 bg-emerald-50 dark:bg-emerald-950/30">
            <span className="text-emerald-500 font-bold shrink-0 mt-0.5">+</span>
            <span className="text-emerald-700/90 dark:text-emerald-400/90 leading-snug">Led cross-functional team of 8, improving delivery velocity by <strong>34%</strong> via Agile &amp; OKR alignment</span>
          </div>
        </div>
        {/* Apply / Decline buttons */}
        <div className="flex items-center gap-2 pointer-events-none">
          <Button size="sm" className="flex-1 gap-1.5 h-7 text-[11px]">
            <Check className="size-3.5" /> Apply
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-7 text-[11px]">
            Decline
          </Button>
        </div>
      </div>
      {/* Score impact */}
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-match-high/8 border border-match-high/20 text-[10px]">
        <span className="text-muted-foreground">Match after edits</span>
        <span className="font-bold text-match-high">72 → 91 ↑</span>
      </div>
      {/* ATS export */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-primary/25 bg-primary/5 text-[10px]">
        <FileText className="size-3 text-primary shrink-0" />
        <span className="text-foreground/70 flex-1">ATS-optimized PDF ready</span>
        <span className="text-primary font-semibold">Export ↓</span>
      </div>
    </div>
  );
}

/* ─── How it works ───────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: Search,
      title: "Search across every platform",
      desc: "Enter a job title, skills, or location. JobClawd searches 10+ platforms simultaneously — every result scored in real time against your CV so you see fit, not noise.",
      preview: <StepSearchPreview />,
    },
    {
      num: "02",
      icon: Zap,
      title: "Upload once, scored forever",
      desc: "Upload your CV once. Every vacancy gets a 0–100 breakdown across skills, experience, fit, and keywords — including which ATS keywords you're missing — so you know exactly where you stand before applying.",
      preview: <StepScorePreview />,
    },
    {
      num: "03",
      icon: TrendingUp,
      title: "Fix your CV — then export ATS-ready",
      desc: "Get 8–14 targeted suggestions per role: missing ATS keywords, weak bullets, wrong framing. Accept in one click, then export a PDF structured the way ATS software actually reads it — clean sections, keyword-matched, no parsing errors. More CVs that clear the filter means more interviews.",
      preview: <StepSuggestPreview />,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="text-center mb-20">
        <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">
          How it works
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          From search to interview, <GradientText>in three steps</GradientText>
        </h2>
        <p className="mt-3 text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
          JobClawd eliminates the guesswork so you spend your time where it matters — in interviews.
        </p>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border/40">
        {steps.map(({ num, icon: Icon, title, desc, preview }) => (
          <div
            key={num}
            className="grid grid-cols-1 lg:grid-cols-[1fr_256px] gap-6 lg:gap-14 py-12 items-center"
          >
            {/* Left: number + content */}
            <div className="flex items-start gap-6 lg:gap-8">
              {/* Outlined watermark number */}
              <div className="hidden sm:flex shrink-0 w-12 pt-1 justify-end">
                <span
                  className="text-6xl font-black tabular-nums leading-none select-none"
                  style={{ color: "transparent", WebkitTextStroke: "1.5px hsl(var(--border))" }}
                >
                  {num}
                </span>
              </div>
              {/* Text */}
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-9 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{title}</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm max-w-md">{desc}</p>
              </div>
            </div>

            {/* Right: preview */}
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              {preview}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Feature card ────────────────────────────────────────────── */
function FeatureCard({
  icon: Icon,
  title,
  desc,
  large,
  highlight,
  children,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  large?: boolean;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0 h-full border-border/50 overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      {highlight && (
        <div className="h-0.5 w-full bg-linear-to-r from-transparent via-primary/60 to-transparent shrink-0" />
      )}
      <CardContent className={cn(
        "space-y-3 h-full",
        large ? "px-6 pt-5 pb-6" : "px-5 pt-5 pb-5",
        highlight && "bg-primary/2",
      )}>
        <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 border border-primary/15">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <h3 className={cn("font-semibold text-foreground mb-1.5", large ? "text-base" : "text-sm")}>
            {title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
        </div>
        {children && <div className="pt-1">{children}</div>}
      </CardContent>
    </Card>
  );
}

/* ─── Features bento grid ─────────────────────────────────────── */
function Features() {
  return (
    <section id="features" className="py-24 px-6 max-w-6xl mx-auto w-full">
      <div className="text-center mb-14">
        <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">
          Features
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Everything you need to <GradientText>get the interview</GradientText>
        </h2>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-sm">
          From finding the right roles to sending CVs that pass ATS filters and get you invited to interview.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Large — spans 2 cols */}
        <div className="lg:col-span-2">
          <FeatureCard
            large
            highlight
            icon={LayoutGrid}
            title="One Feed. Every Job."
            desc="Stop platform-hopping. Search 10+ job platforms simultaneously — every result ranked by how well it matches your CV."
          />
        </div>

        <FeatureCard
          icon={Zap}
          title="Know Before You Apply"
          desc="Every vacancy gets an instant 0–100 match score across skills, experience, and ATS keywords. Spend your energy on roles where you have a real shot at an interview — not ones that will filter you out."
        />

        <FeatureCard
          highlight
          icon={FileText}
          title="Fix What's Costing You Interviews"
          desc="Get 8–14 targeted edits per role — ATS keywords you're missing, weak bullets, wrong framing. Accept in one click and export an ATS-optimized CV. Better CVs get more interviews."
        >
          <div className="space-y-1.5">
            {[
              "Add 'TypeScript' — missing ATS keyword",
              "Quantify impact: led 5 → 12 engineers",
              "Add 'distributed systems' from job description",
            ].map((s) => (
              <div key={s} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <CheckCircle2 className="size-3 text-primary mt-0.5 shrink-0" />
                {s}
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard
          icon={TrendingUp}
          title="See Your Score Live"
          desc="Edit your CV, hit Check Impact. See exactly how your changes affect your match score and ATS keyword coverage — before any recruiter sees it."
        />

        <FeatureCard
          icon={GitCompare}
          title="Find Your Winning CV"
          desc="Test multiple CV versions against any vacancy. See which gets the highest ATS score — then apply with the version most likely to land an interview."
        />

        <FeatureCard
          icon={BarChart2}
          title="Track What's Working"
          desc="Spot trends in scores, top sources, and activity over time. Double down on what gets you interviews."
        />
      </div>
    </section>
  );
}

/* ─── Stats strip ─────────────────────────────────────────────── */
import { platformStatsService } from "@/services/platform-stats.service";

function Stats() {
  const [stats, setStats] = useState<{
    total_analyses: number;
    suggestions_applied: number;
    cvs_compared: number;
    searched_jobs: number;
  } | null>(null);

  useEffect(() => {
    platformStatsService.getStats().then(setStats).catch(() => {});
  }, []);

  const items = [
    { value: stats?.total_analyses ?? 0,      suffix: "+", label: "CV analyses run" },
    { value: stats?.suggestions_applied ?? 0, suffix: "+", label: "Suggestions applied" },
    { value: stats?.cvs_compared ?? 0,        suffix: "+", label: "CVs compared" },
    { value: stats?.searched_jobs ?? 0,       suffix: "+", label: "Jobs searched" },
  ];

  return (
    <section className="py-20 border-y border-border/50 bg-muted/20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-4 text-center">
          {items.map(({ value, suffix, label }) => (
            <div key={label}>
              <p className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                <NumberTicker value={value} suffix={suffix} />
              </p>
              <p className="text-xs text-muted-foreground mt-2 leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ─────────────────────────────────────────────────── */
const LANDING_PLANS = [
  {
    id: "free",
    name: "Free",
    price_usd: 0,
    credits: 10,
    description: "Start exploring, no card required",
    popular: false,
    free: true,
  },
  {
    id: "starter",
    name: "Starter",
    price_usd: 1.99,
    credits: 20,
    description: "Good for a short job hunt",
    popular: false,
    free: false,
  },
  {
    id: "value",
    name: "Value",
    price_usd: 4.99,
    credits: 60,
    description: "Most popular for active seekers",
    popular: true,
    free: false,
  },
  {
    id: "power",
    name: "Power",
    price_usd: 10.99,
    credits: 150,
    description: "For serious, full-time job hunting",
    popular: false,
    free: false,
  },
];

function planCapabilities(credits: number) {
  return [
    { label: "Fresh searches",  count: Math.floor(credits / 1) },
    { label: "CV analyses",     count: Math.floor(credits / 2) },
    { label: "Suggestion runs", count: Math.floor(credits / 3) },
  ];
}

function Pricing({ onGetStarted, onOpenWaitlist }: { onGetStarted: () => void; onOpenWaitlist: () => void }) {
  return (
    <section id="pricing" className="py-24 px-6 bg-muted/10 border-y border-border/40">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">
            Pricing
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Simple, <GradientText>credit-based pricing</GradientText>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto text-sm">
            Start free. Top up when you need more. No subscriptions, no surprises — pay only for what you use.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-3">
          {LANDING_PLANS.map((plan) => {
            const perCredit = plan.free ? null : (plan.price_usd / plan.credits).toFixed(3);
            const capabilities = planCapabilities(plan.credits);
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-xl border p-6 transition-all duration-200",
                  plan.popular
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3 py-0.5 text-xs font-semibold shadow-sm">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <div className="mb-5">
                  <p className="text-base font-semibold text-foreground">{plan.name}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold text-foreground">
                      {plan.free ? "Free" : `$${plan.price_usd.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Zap className="size-3.5 text-primary" />
                    <span className="text-sm font-semibold text-foreground">{plan.credits} credits</span>
                    {perCredit && (
                      <span className="text-xs text-muted-foreground">· ${perCredit} each</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {capabilities.map(({ label, count }) => (
                    <li key={label} className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center size-5 rounded-md bg-primary/10 shrink-0">
                        <Check className="size-3 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Up to <span className="font-semibold text-foreground">{count}</span>{" "}
                        {label.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={plan.free ? onGetStarted : onOpenWaitlist}
                  variant={plan.popular ? "default" : plan.free ? "default" : "outline"}
                  className={cn("w-full h-10 text-sm font-medium", plan.popular && "shadow-sm")}
                >
                  {plan.free ? (
                    "Get Started Free"
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Bell className="size-3.5 shrink-0" />
                      Notify me
                    </span>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          All prices in USD · Credits never expire · No recurring charges
        </p>
      </div>
    </section>
  );
}

/* ─── FAQs ─────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "What is JobClawd?",
    a: "JobClawd is an AI-powered job search platform that searches 10+ job boards simultaneously and scores every vacancy against your CV. Our AI identifies what is holding your CV back — missing ATS keywords, weak phrasing, formatting issues — and generates targeted edits that significantly increase your chances of getting invited to interview.",
  },
  {
    q: "Why are your CVs ATS-friendly?",
    a: "ATS (Applicant Tracking Systems) are used by nearly all large employers to automatically filter CVs before a human ever reads them. Our PDF export uses clean structured formatting, proper section headers, and avoids tables, images, or multi-column layouts that ATS parsers misread. More importantly, we match the exact language of each job description, so your CV contains the keywords the ATS is scanning for. The result: more of your applications clear the first gate and reach a recruiter.",
  },
  {
    q: "How does the AI match scoring work?",
    a: "Our AI compares your CV against each job listing across four dimensions: Skills, Experience, Fit, and Keywords — including the ATS-critical keywords the employer's software will scan for. Each dimension gets a 0–100 score. A low Keywords score is one of the most common reasons strong CVs get filtered out before a human reads them. JobClawd shows you exactly where the gap is and how to close it.",
  },
  {
    q: "Will this actually increase my chances of getting an interview?",
    a: "Yes — and here is why. Most CVs are rejected automatically by ATS software before a recruiter ever sees them, often due to missing keywords or poor formatting rather than a lack of qualifications. JobClawd ensures your CV contains the right keywords for each specific role and is formatted in a way ATS can parse correctly. Combined with AI-matched content and quantified bullet points, our users consistently see higher response rates after applying JobClawd's suggestions.",
  },
  {
    q: "What are credits and how are they used?",
    a: "Credits power JobClawd's AI features. A fresh job search costs 1 credit, a full CV analysis costs 2 credits, and a suggestion run costs 3 credits. You start with 10 free credits — enough to explore the platform — and can top up in one-time packs whenever you need more.",
  },
  {
    q: "Do credits expire?",
    a: "No. Credits never expire. Top up at your own pace and use them whenever you are ready for your next job search sprint.",
  },
  {
    q: "Can I use multiple CVs?",
    a: "Yes. You can upload multiple CV versions and run them all against any vacancy at once. The multi-CV comparison feature shows which version gets the highest ATS score so you can apply with the one most likely to land an interview.",
  },
  {
    q: "Is my data secure?",
    a: "Your data is stored securely and is never shared with third parties or used to train AI models. You can delete your account and all associated data at any time from your profile settings.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Every new account starts with 10 free credits — no credit card required. This is enough to run your first searches, score a few CVs, and see how the platform works before deciding to top up.",
  },
];

function FAQs() {
  return (
    <section id="faqs" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">
            FAQs
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Everything you need to know about <GradientText>JobClawd</GradientText>
          </h2>
          <p className="mt-4 text-sm text-muted-foreground max-w-md mx-auto">
            Can&apos;t find what you&apos;re looking for?{" "}
            <a href="mailto:support@jobclawd.com" className="text-primary hover:underline">
              Email our support team
            </a>
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline hover:text-foreground text-left cursor-pointer">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* ─── Final CTA ───────────────────────────────────────────────── */
function FinalCTA({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="py-28 px-6 text-center bg-muted/10 border-t border-border/40">
      <div className="max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 border border-primary/25 bg-primary/8 text-primary">
          <Star className="size-3 fill-primary" />
          Free to start — no card required
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-5">
          Ready to find your <GradientText>next role?</GradientText>
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-10 text-sm leading-relaxed">
          Set up in under a minute. Find roles that match your profile, fix your CV with ATS-optimized suggestions, and send applications built to get you interviews.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={onGetStarted}
            size="lg"
            className="group px-8 h-12 text-base font-semibold"
          >
            Get Started Free
            <ArrowRight className="size-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </Button>

          <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
            <Link href="#how-it-works" className="flex items-center gap-2">
              See how it works
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ─── Main landing page ───────────────────────────────────────── */
export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleGetStarted() {
    router.push(user ? "/dashboard/feed" : "/auth/login");
  }

  return (
    <>
      <CreditComingSoonModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        defaultEmail={user?.email ?? ""}
      />
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* ── Nav ── */}
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-300 ease-in-out",
          scrolled ? "py-4 px-4" : "border-b border-border/40 bg-background/80 backdrop-blur-md",
        )}
      >
        <div
          className={cn(
            "mx-auto flex items-center transition-all duration-300 ease-in-out",
            scrolled
              ? "max-w-5xl h-14 px-5 rounded-2xl border border-border/60 bg-background/85 backdrop-blur-xl shadow-lg shadow-black/8"
              : "max-w-7xl h-16 px-6",
          )}
        >
          {/* Logo — left */}
          <div className="flex items-center flex-1">
            <JobClawdLogo size={22} className="text-foreground" />
          </div>

          {/* Links — center */}
          <nav className="hidden sm:flex items-center gap-0.5">
            {[
              { label: "Home", href: "#" },
              { label: "How it Works", href: "#how-it-works" },
              { label: "Features", href: "#features" },
              { label: "Pricing", href: "#pricing" },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors duration-150"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Buttons — right */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button onClick={handleGetStarted} size="sm">
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 pt-12 pb-16">
        {/* dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(123,124,255,0.10) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* glow — top-left to complement the right-side visual */}
        <div
          className="absolute top-0 left-0 w-175 h-100 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at top left, rgba(123,124,255,0.14) 0%, transparent 60%)",
          }}
        />

        <div className="relative max-w-5xl mx-auto text-center" style={{ animation: "fade-up 0.6s ease both" }}>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium mb-8 border border-primary/20 bg-primary/8 text-primary">
            <span style={{ animation: "star-blink 2s ease-in-out infinite" }}>✦</span>
            <span>AI that gets your CV past ATS — and into interviews</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
            Land your next job{" "}
            <GradientText>faster, smarter.</GradientText>
          </h1>

          <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            Search 10+ job platforms at once, get AI match scores against your CV, and receive
            targeted edits that produce ATS-friendly CVs — so more of your applications reach a
            human and your chances of getting invited to interview go up.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-7">
            <Button onClick={handleGetStarted} size="lg" className="group px-8 h-12 text-base font-semibold">
              Get Started Free
              <ArrowRight className="size-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
              <Link href="#how-it-works" className="flex items-center gap-2">
                See how it works
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>

          {/* Trust line */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
            {["Free to start", "No card required", "ATS-optimized CVs"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3 text-success shrink-0" />
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto mt-14 hidden md:block" style={{ animation: "fade-up 0.6s ease 0.15s both" }}>
          <div className="absolute -inset-6 rounded-3xl bg-primary/5 blur-2xl pointer-events-none" />
          <HeroInteractiveDemo onOpenWaitlist={() => setWaitlistOpen(true)} />
        </div>
      </section>

      {/* ── Logo strip ── */}
      <LogoStrip />

      {/* ── How it works ── */}
      <HowItWorks />

      {/* ── Features ── */}
      <Features />

      {/* ── Stats ── */}
      <Stats />

      {/* ── Pricing ── */}
      <Pricing onGetStarted={handleGetStarted} onOpenWaitlist={() => setWaitlistOpen(true)} />

      {/* ── FAQs ── */}
      <FAQs />

      {/* ── Final CTA ── */}
      <FinalCTA onGetStarted={handleGetStarted} />

      {/* ── Footer ── */}
      <LandingFooter />
    </div>
    </>
  );
}
