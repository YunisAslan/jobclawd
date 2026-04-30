"use client";

import Image from "next/image";
import logo from "@/assets/logo/jobclawd-logo.svg";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  Bookmark,
  BarChart2,
  Sparkles,
  Zap,
  TrendingUp,
  FileText,
  CheckCircle2,
  ArrowRight,
  Star,
  GitCompare,
  LayoutGrid,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Animated gradient headline ─────────────────────────────── */
function GradientText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("bg-clip-text text-transparent", className)}
      style={{
        backgroundImage: "linear-gradient(135deg, #a5a6ff 0%, #7b7cff 30%, #c084fc 60%, #7b7cff 100%)",
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

/* ─── Hero mockup ─────────────────────────────────────────────── */
const MOCK_JOBS = [
  {
    title: "Senior Frontend Engineer",
    company: "Kapital Bank",
    location: "Baku · Remote",
    score: 88,
    level: "HIGH" as const,
    tags: ["React", "TypeScript", "Next.js"],
    source: "LinkedIn",
  },
  {
    title: "Product Designer",
    company: "Pasha Holding",
    location: "Baku · Hybrid",
    score: 61,
    level: "REVIEW" as const,
    tags: ["Figma", "UX Research"],
    source: "Indeed",
  },
  {
    title: "Backend Developer",
    company: "AtaBank",
    location: "Baku · On-site",
    score: 34,
    level: "TRASH" as const,
    tags: ["Java", "Spring", "Microservices"],
    source: "jobsearch.az",
  },
];

const SCORE_CONFIG = {
  HIGH: { label: "High Match", bg: "bg-emerald-500/15", text: "text-emerald-400", ring: "#22c55e" },
  REVIEW: { label: "Needs Review", bg: "bg-amber-500/15", text: "text-amber-400", ring: "#f59e0b" },
  TRASH: { label: "Low Match", bg: "bg-zinc-700/50", text: "text-zinc-400", ring: "#6b7280" },
};

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
      />
      <text
        x="22"
        y="22"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="10"
        fontWeight="700"
        transform="rotate(90 22 22)"
      >
        {score}
      </text>
    </svg>
  );
}

function HeroMockup() {
  const [active, setActive] = useState(0);
  const job = MOCK_JOBS[active];
  const cfg = SCORE_CONFIG[job.level];

  return (
    <div
      className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 border border-white/10"
      style={{ animation: "float 6s ease-in-out infinite", background: "#11131a" }}
    >
      {/* window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8" style={{ background: "#0d0e15" }}>
        <span className="size-2.5 rounded-full bg-red-500/70" />
        <span className="size-2.5 rounded-full bg-yellow-500/70" />
        <span className="size-2.5 rounded-full bg-green-500/70" />
        <span className="ml-3 text-[11px] text-white/25 font-mono">JobClawd · Job Feed</span>
      </div>

      <div className="flex" style={{ minHeight: 320 }}>
        {/* job list */}
        <div className="flex-1 p-4 space-y-2.5 border-r border-white/8 overflow-hidden">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">3 positions found</p>
          {MOCK_JOBS.map((j, i) => {
            const c = SCORE_CONFIG[j.level];
            return (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={cn(
                  "w-full text-left rounded-xl p-3 border transition-all duration-200 cursor-pointer",
                  active === i
                    ? "border-primary/40 bg-primary/10"
                    : "border-white/6 bg-white/3 hover:bg-white/6",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{j.title}</p>
                    <p className="text-[10px] text-white/45 mt-0.5">{j.company} · {j.location}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                      c.bg, c.text,
                    )}
                  >
                    {c.label}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {j.tags.slice(0, 2).map((t) => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-white/50">
                      {t}
                    </span>
                  ))}
                  <span className="text-[9px] text-white/25 ml-auto">{j.source}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* cv panel */}
        <div className="w-48 p-4 flex flex-col gap-3" style={{ background: "#0d0e15" }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">CV Match</p>
            <ScoreRing score={job.score} color={cfg.ring} />
          </div>

          <div className="space-y-2">
            {[
              { label: "Skills", pct: Math.min(100, job.score + 8) },
              { label: "Experience", pct: Math.max(20, job.score - 10) },
              { label: "Keywords", pct: Math.min(100, job.score + 3) },
            ].map(({ label, pct }) => (
              <div key={label}>
                <div className="flex justify-between text-[9px] text-white/40 mb-1">
                  <span>{label}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: cfg.ring }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className={cn("mt-auto rounded-lg p-2.5", cfg.bg)}>
            <p className={cn("text-[10px] font-semibold", cfg.text)}>{cfg.label}</p>
            <p className="text-[9px] text-white/40 mt-0.5">
              {job.level === "HIGH"
                ? "Strong fit — tailor your intro"
                : job.level === "REVIEW"
                  ? "Partial match — boost keywords"
                  : "Low alignment — consider skipping"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Logo marquee ────────────────────────────────────────────── */
const SOURCES = [
  { name: "jobsearch.az", color: "#f59e0b", dot: true },
  { name: "LinkedIn", color: "#0077b5", dot: true },
  { name: "Indeed", color: "#2557a7", dot: true },
  { name: "jobsearch.az", color: "#f59e0b", dot: true },
  { name: "LinkedIn", color: "#0077b5", dot: true },
  { name: "Indeed", color: "#2557a7", dot: true },
];

function LogoStrip() {
  const items = [...SOURCES, ...SOURCES];
  return (
    <div className="relative overflow-hidden py-12">
      <div className="absolute inset-y-0 left-0 w-24 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right, var(--background), transparent)" }} />
      <div className="absolute inset-y-0 right-0 w-24 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to left, var(--background), transparent)" }} />

      <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-6">
        Searches across
      </p>
      <div className="flex" style={{ animation: "marquee 18s linear infinite", width: "max-content" }}>
        {items.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-6 py-2 mx-3 rounded-full border border-border/50 bg-card/60 backdrop-blur-sm"
          >
            <span className="size-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── How it works ────────────────────────────────────────────── */
const STEPS = [
  {
    icon: Search,
    title: "Search any role",
    desc: "Enter a job title, skills, or location. JobClawd queries jobsearch.az, LinkedIn, and Indeed simultaneously and returns a ranked, unified feed.",
  },
  {
    icon: Zap,
    title: "AI scores your fit",
    desc: "Every vacancy is scored 0–100 against your uploaded CV. High Match, Needs Review, and Low Match labels surface the right opportunities instantly.",
  },
  {
    icon: TrendingUp,
    title: "Optimize & apply",
    desc: "Get 8–14 targeted improvement suggestions per job. Accept them, check the score impact, then export a polished, ATS-ready CV.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 max-w-5xl mx-auto w-full">
      <div className="text-center mb-16">
        <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">
          How it works
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          From search to offer,{" "}
          <GradientText>in three steps</GradientText>
        </h2>
      </div>

      <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8">
        {/* connecting line */}
        <div className="hidden sm:block absolute top-10 left-[calc(16.7%+24px)] right-[calc(16.7%+24px)] h-px border-t-2 border-dashed border-border/60" />

        {STEPS.map(({ icon: Icon, title, desc }, i) => (
          <div key={title} className="flex flex-col items-center text-center relative">
            <div className="relative mb-6">
              <div className="size-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Icon className="size-7 text-primary" />
              </div>
              <span className="absolute -top-2 -right-2 size-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
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
  accent,
  children,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  large?: boolean;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-2xl border border-border bg-card overflow-hidden transition-all duration-300",
        "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/8",
        large ? "p-7" : "p-6",
      )}
    >
      {/* border glow on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: "inset 0 0 0 1px rgba(123,124,255,0.25)" }} />

      {accent && (
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top left, #7b7cff, transparent 70%)" }} />
      )}

      <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 border border-primary/15 mb-4">
        <Icon className="size-4.5 text-primary" />
      </div>

      <h3 className={cn("font-semibold text-foreground mb-2", large ? "text-lg" : "text-base")}>
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>

      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

/* ─── Features bento grid ─────────────────────────────────────── */
function Features() {
  return (
    <section className="py-24 px-6 max-w-6xl mx-auto w-full">
      <div className="text-center mb-14">
        <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">
          Features
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Everything you need to{" "}
          <GradientText>land the role</GradientText>
        </h2>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-sm">
          A complete toolkit — from finding the right vacancies to sending the perfect CV.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Large — spans 2 cols */}
        <div className="lg:col-span-2">
          <FeatureCard
            large
            accent
            icon={LayoutGrid}
            title="Multi-source job feed"
            desc="JobClawd pulls listings from jobsearch.az, LinkedIn, and Indeed in a single unified feed. Every result is ranked by AI match score so the best fits always appear first."
          >
            <div className="flex flex-wrap gap-2">
              {["jobsearch.az", "LinkedIn", "Indeed"].map((s, i) => (
                <span key={s} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-muted/40 text-muted-foreground">
                  <span className="size-1.5 rounded-full" style={{ background: ["#f59e0b", "#0077b5", "#2557a7"][i] }} />
                  {s}
                </span>
              ))}
            </div>
          </FeatureCard>
        </div>

        <FeatureCard
          icon={Zap}
          title="AI Match Scoring"
          desc="Each vacancy gets a 0–100 score relative to your CV. High Match, Needs Review, and Low Match labels make prioritisation instant."
        />

        <FeatureCard
          icon={FileText}
          title="CV Suggestions"
          desc="Upload your CV and get 8–14 targeted, job-specific improvement recommendations. Accept, reject, or tweak each suggestion."
        >
          <div className="space-y-1.5">
            {["Add 'TypeScript' to skills section", "Quantify team leadership (lead 5→12 engineers)", "Mirror 'distributed systems' from JD"].map((s) => (
              <div key={s} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <CheckCircle2 className="size-3 text-primary mt-0.5 shrink-0" />
                {s}
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard
          icon={TrendingUp}
          title="Check Impact"
          desc="Edit your CV, then run Check Impact to see exactly how your score changes before you send — no guesswork."
        />

        <FeatureCard
          icon={GitCompare}
          title="Multi-CV Comparison"
          desc="Score several CV versions against a single vacancy side-by-side. Find which version resonates best with each job."
        />

        <FeatureCard
          icon={BarChart2}
          title="Analytics Dashboard"
          desc="Track activity trends, score distributions, and source performance over time. Understand where your best opportunities come from."
        />
      </div>
    </section>
  );
}

/* ─── Stats strip ─────────────────────────────────────────────── */
const STATS = [
  { value: 3, suffix: " sources", label: "Job platforms searched simultaneously" },
  { value: 100, prefix: "0–", label: "Match score range per CV & vacancy" },
  { value: 14, prefix: "8–", label: "Tailored CV suggestions per job" },
  { value: 7, suffix: "-day cache", label: "Results cached for effortless re-runs" },
];

function Stats() {
  return (
    <section className="py-20 border-y border-border/50 bg-muted/20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-4 text-center">
          {STATS.map(({ value, prefix, suffix, label }) => (
            <div key={label}>
              <p className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                <NumberTicker value={value} prefix={prefix} suffix={suffix} />
              </p>
              <p className="text-xs text-muted-foreground mt-2 leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ───────────────────────────────────────────────── */
function FinalCTA({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="py-28 px-6 text-center">
      <div className="max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 border border-primary/25 bg-primary/8 text-primary">
          <Star className="size-3 fill-primary" />
          Free to start — no card required
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-5">
          Ready to find your{" "}
          <GradientText>next role?</GradientText>
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-10 text-sm leading-relaxed">
          Set up in under a minute. Search any role, score your CV, get suggestions, and apply with
          confidence.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={onGetStarted}
            size="lg"
            className="relative overflow-hidden px-8 h-12 text-base font-semibold shadow-lg shadow-primary/30 group"
          >
            <span className="relative z-10 flex items-center gap-2">
              Get Started Free
              <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
            {/* shimmer */}
            <span
              className="absolute inset-0 w-8 bg-white/25 -skew-x-12 pointer-events-none"
              style={{ animation: "shimmer 2.5s ease-in-out infinite" }}
            />
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

  function handleGetStarted() {
    router.push(user ? "/dashboard/feed" : "/auth/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-md bg-background/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src={logo}
              alt="JobClawd"
              width={30}
              height={30}
              className="dark:brightness-0 dark:invert shrink-0"
            />
            <span className="font-bold text-lg tracking-tight">
              Job<span className="text-primary">Clawd</span>
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link href="#how-it-works">How it works</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button onClick={handleGetStarted} size="sm" className="relative overflow-hidden">
              <span className="relative z-10">Get Started</span>
              <span
                className="absolute inset-0 w-6 bg-white/20 -skew-x-12 pointer-events-none"
                style={{ animation: "shimmer 3s ease-in-out infinite" }}
              />
            </Button>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-20 pb-16 px-6">
        {/* dot grid bg */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(123,124,255,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* radial glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-175 h-100 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, rgba(123,124,255,0.12) 0%, transparent 70%)",
          }}
        />

        <div className="relative max-w-5xl mx-auto text-center" style={{ animation: "fade-up 0.7s ease both" }}>
          {/* pill badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium mb-8 border border-primary/20 bg-primary/8 text-primary">
            <span
              className="size-1.5 rounded-full bg-primary"
              style={{ animation: "pulse-ring 1.5s ease-out infinite" }}
            />
            <span>✦ AI-Powered · jobsearch.az · LinkedIn · Indeed</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Land your next job,{" "}
            <GradientText>faster.</GradientText>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            JobClawd aggregates listings from multiple platforms, scores each vacancy against your
            CV with AI, and gives you targeted suggestions to optimize and apply with confidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="relative overflow-hidden px-8 h-12 text-base font-semibold shadow-lg shadow-primary/30 group"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started Free
                <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
              <span
                className="absolute inset-0 w-8 bg-white/25 -skew-x-12 pointer-events-none"
                style={{ animation: "shimmer 2.5s ease-in-out infinite" }}
              />
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
              <Link href="#how-it-works" className="flex items-center gap-2">
                See how it works
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>

          <HeroMockup />
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

      {/* ── Final CTA ── */}
      <FinalCTA onGetStarted={handleGetStarted} />

      {/* ── Footer ── */}
      <footer className="border-t border-border px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src={logo}
              alt="JobClawd"
              width={22}
              height={22}
              className="dark:brightness-0 dark:invert opacity-60"
            />
            <span className="text-sm text-muted-foreground font-medium">
              © {new Date().getFullYear()} JobClawd
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/auth/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">How it works</Link>
            <span className="text-muted-foreground/40">Built for job seekers.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
