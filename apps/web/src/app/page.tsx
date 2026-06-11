"use client";

import Link from "next/link";
import { JobClawdLogo } from "@/assets/JobClawdLogo";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Accordion";
import { CreditComingSoonModal } from "@/components/credits/CreditComingSoonModal";
import LandingFooter from "@/components/layout/LandingFooter";
import { Marquee } from "@/registry/magicui/marquee";

/* ─── Hero product video — inline (muted/looped), click to expand ─ */
function HeroVideo() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded]);

  return (
    <>
      {/* Inline: autoplaying, muted, looped — no controls. Click to expand. */}
      <Button
        variant="ghost"
        onClick={() => setExpanded(true)}
        aria-label="Expand product walkthrough video"
        className="group relative block w-full h-auto p-0 aspect-video overflow-hidden rounded-2xl border border-border bg-muted/20 cursor-zoom-in hover:bg-muted/20"
      >
        <video
          src="/jobclawd-intro.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="size-full object-cover pointer-events-none"
        />
        <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />
      </Button>

      {/* Expanded: only the video, blurred backdrop, with controls.
          Rendered via a portal to <body> so the fixed overlay isn't trapped
          by the hero container's transform (the fade-up animation). */}
      {expanded &&
        createPortal(
          <div
            onClick={() => setExpanded(false)}
            className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-12 bg-background/70 backdrop-blur-xl animate-in fade-in duration-200"
          >
            <video
              src="/jobclawd-intro.mp4"
              autoPlay
              muted
              loop
              playsInline
              controls
              onClick={(e) => e.stopPropagation()}
              className="max-h-[82vh] w-auto max-w-[85vw] rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
            />
          </div>,
          document.body,
        )}
    </>
  );
}

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
      label: "Discover",
      icon: Search,
      title: "Search every job board in one place",
      pain: "Instead of opening LinkedIn, Indeed, Glassdoor and 7 more tabs",
      desc: "One search scans 10+ job boards in parallel and streams the results into a single feed — already ranked by how well each role fits you. The best matches rise to the top automatically.",
      preview: <StepSearchPreview />,
    },
    {
      num: "02",
      label: "Evaluate",
      icon: BarChart2,
      title: "See your real fit before you apply",
      pain: "Instead of guessing whether you're qualified",
      desc: "Upload your CV once. Every vacancy gets a 0–100 Match Score broken down by skills, experience, fit and the exact ATS keywords you're missing — so you only spend effort on roles you can actually win.",
      preview: <StepScorePreview />,
    },
    {
      num: "03",
      label: "Optimize",
      icon: TrendingUp,
      title: "Tailor your CV to beat the ATS",
      pain: "Instead of wondering why you never hear back",
      desc: "Get targeted one-click fixes for each role and watch your score climb with Check Impact. Then export a clean PDF structured the way ATS software actually parses it — more CVs through the filter, more interviews.",
      preview: <StepSuggestPreview />,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="text-center mb-16 sm:mb-20 max-w-2xl mx-auto">
        <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">
          How it works
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          From scattered search to <GradientText>interview-ready</GradientText>
        </h2>
        <p className="mt-4 text-muted-foreground text-base leading-relaxed">
          JobClawd takes over the tedious, uncertain parts of the hunt — finding roles, judging fit,
          and fixing your CV — so your time goes where it counts.
        </p>
      </div>

      {/* Connected timeline */}
      <div className="relative">
        {steps.map(({ num, label, icon: Icon, title, pain, desc, preview }) => (
          <div key={num} className="relative pl-16 sm:pl-20 pb-14">
            {/* connector line down to the next node */}
            <span
              aria-hidden
              className="absolute left-6 sm:left-8 top-12 bottom-0 w-px -translate-x-1/2 bg-linear-to-b from-primary/30 to-border"
            />
            {/* node */}
            <div className="absolute left-6 sm:left-8 top-0 -translate-x-1/2 z-10">
              <div className="flex items-center justify-center size-12 rounded-full border border-primary/25 bg-background text-primary shadow-sm ring-4 ring-background">
                <Icon className="size-5" />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12 lg:items-center">
              {/* Text */}
              <div>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">
                    Step {num}
                  </span>
                  <span className="h-3 w-px bg-border" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm font-medium text-foreground/55 line-through decoration-border decoration-1">
                  {pain}
                </p>
                <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed max-w-md">{desc}</p>
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                {preview}
              </div>
            </div>
          </div>
        ))}

        {/* Outcome capstone */}
        <div className="relative pl-16 sm:pl-20">
          <div className="absolute left-6 sm:left-8 top-0 -translate-x-1/2 z-10">
            <div className="flex items-center justify-center size-12 rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-4 ring-background">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
          <div className="pt-1">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">The result</span>
            <h3 className="mt-2 text-xl font-semibold text-foreground">
              More interviews, far less busywork
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md">
              No more lost hours across job-board tabs or CVs that vanish into an ATS. Every step above
              points at one outcome — getting you in front of recruiters faster.
            </p>
          </div>
        </div>
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
            <span>Stop jumping between job sites and guessing — find, match, get hired</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
            Land your next job{" "}
            <GradientText>faster, smarter.</GradientText>
          </h1>

          <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            Search 10+ job sites in one place, see how well each role fits your CV before you
            apply, and get simple edits that help your application get past the screening software
            companies use — and in front of a real person.
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

        <div className="relative max-w-7xl mx-auto mt-14" style={{ animation: "fade-up 0.6s ease 0.15s both" }}>
          <div className="absolute -inset-6 rounded-3xl bg-primary/5 blur-2xl pointer-events-none" />
          {/* Product walkthrough video */}
          <HeroVideo />
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
