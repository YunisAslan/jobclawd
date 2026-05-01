"use client";

import Image from "next/image";
import logo from "@/assets/logo/jobclawd-logo.svg";
import Link from "next/link";
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
  ArrowRight,
  Star,
  GitCompare,
  LayoutGrid,
  ChevronRight,
  MapPin,
  Bookmark,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Marquee } from "@/registry/magicui/marquee";

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
  feed: 2800,
  detail: 3200,
  improve: 1800,
  analyzing: 2300,
  suggestions: 5000,
};

type DemoJob = { title: string; company: string; location: string; date: string; score: number; tags: string[] };

const DEMO_FEED_JOBS: DemoJob[] = [
  { title: "Senior Back-End Web Developer",         company: "White Rose Education",   location: "Halifax, England, UK",  date: "Apr 24", score: 65, tags: ["Senior", "Full-time", "£50,000", "Hybrid"] },
  { title: "Senior Back-End Web Developer",         company: "White Rose Education",   location: "Leeds, England, UK",    date: "Apr 24", score: 65, tags: ["Senior", "Full-time", "£50,000", "Hybrid"] },
  { title: "PHP Developer (Remote)",                company: "Quik Hire Staffing",     location: "United States",         date: "May 1",  score: 55, tags: ["Remote"] },
  { title: "PHP Laravel Developer (Remote/USA)",    company: "Telemundo Atlanta",      location: "Gauteng, South Africa", date: "Apr 6",  score: 55, tags: ["Remote"] },
];

function DemoJobCard({ job, highlighted, onClick }: { job: DemoJob; highlighted?: boolean; onClick?: () => void }) {
  const initials = job.company.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border bg-card space-y-2 cursor-pointer transition-all duration-300",
        highlighted
          ? "border-primary/40 shadow-md shadow-primary/10 ring-1 ring-primary/20 -translate-y-0.5"
          : "border-border hover:border-border/80",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="size-9 rounded-lg flex items-center justify-center text-[11px] font-bold bg-secondary text-secondary-foreground shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2">{job.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{job.company} · {job.date}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="size-2.5 text-muted-foreground/60 shrink-0" />
            <span className="text-[11px] text-muted-foreground/70 truncate">{job.location}</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg px-2 py-1.5 bg-match-review/10 border border-match-review/20 shrink-0">
          <span className="text-sm font-bold text-match-review leading-none">{job.score}</span>
          <span className="text-[8px] font-semibold text-match-review/70 uppercase mt-0.5">Rev</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {job.tags.map((t) => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">{t}</span>
        ))}
      </div>
      <span className="block text-[10px] text-match-review bg-match-review/8 border border-match-review/15 rounded px-1.5 py-0.5 w-fit">Work mode mismatch</span>
      <div className="flex gap-1.5">
        <Button size="sm" className="flex-1 h-7 text-[11px]">View Details</Button>
        <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5">Open</Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground shrink-0">
          <Bookmark className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function PanelDetailOverview({ onImprove }: { onImprove: () => void }) {
  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-3 duration-300">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-start gap-2 mb-1">
          <p className="text-sm font-semibold text-foreground leading-snug flex-1">Senior Back-End Web Developer</p>
          <span className="text-[10px] font-bold text-match-review bg-match-review/10 border border-match-review/20 rounded px-1.5 py-0.5 shrink-0">65 match</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">White Rose Education</span>
          <span className="text-[10px] px-1.5 py-px rounded border border-blue-500/30 bg-blue-500/10 text-blue-500 font-medium">LinkedIn</span>
        </div>
      </div>
      <div className="flex border-b border-border">
        <div className="flex-1 py-2 text-center text-xs font-semibold text-primary border-b-2 border-primary">Overview</div>
        <div className="flex-1 py-2 text-center text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors" onClick={onImprove}>Improve CV</div>
      </div>
      <div className="px-4 py-3 space-y-2 border-b border-border text-xs">
        {([["Location","Halifax, England, United Kingdom"],["Work mode","Hybrid"],["Salary","£50,000"],["Seniority","Senior"],["Job type","Full-time"],["Posted","Apr 24"]] as const).map(([l, v]) => (
          <div key={l} className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground shrink-0">{l}</span>
            <span className="text-foreground font-medium text-right">{v}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-match-review/5 border border-match-review/15">
          <div className="flex flex-col items-center justify-center rounded-xl px-3 py-2 bg-match-review/10 border border-match-review/20 shrink-0">
            <span className="text-xl font-bold text-match-review leading-none">65</span>
            <span className="text-[9px] font-semibold text-match-review/70 uppercase mt-0.5">Needs Review</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Match Score</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Based on your profile preferences vs. job requirements</p>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 flex-1 overflow-hidden">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Breakdown</p>
        <div className="space-y-1.5">
          {([
            { label: "Work mode", value: "Hybrid",    ok: false },
            { label: "Experience", value: "Senior",   ok: true  },
            { label: "Location",   value: "Halifax",  ok: true  },
            { label: "Job type",   value: "Full-time",ok: true  },
          ]).map(({ label, value, ok }) => (
            <div key={label} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
              <span className="text-muted-foreground">{label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-foreground">{value}</span>
                <span className={cn("size-4 rounded-full flex items-center justify-center text-[10px] font-bold", ok ? "bg-match-high/10 text-match-high" : "bg-destructive/10 text-destructive")}>{ok ? "✓" : "✗"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 py-3 border-t border-border flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">Save</Button>
        <Button size="sm" className="flex-1 h-8 text-xs">Open &amp; apply</Button>
      </div>
    </div>
  );
}

function PanelImprove({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-3 duration-300">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-start gap-2 mb-1">
          <p className="text-sm font-semibold text-foreground leading-snug flex-1">Senior Back-End Web Developer</p>
          <span className="text-[10px] font-bold text-match-review bg-match-review/10 border border-match-review/20 rounded px-1.5 py-0.5 shrink-0">65 match</span>
        </div>
        <span className="text-xs text-muted-foreground">White Rose Education</span>
      </div>
      <div className="flex border-b border-border">
        <div className="flex-1 py-2 text-center text-xs text-muted-foreground">Overview</div>
        <div className="flex-1 py-2 text-center text-xs font-semibold text-primary border-b-2 border-primary">Improve CV</div>
      </div>
      <div className="flex-1 flex flex-col justify-center px-5 py-6 space-y-4">
        <p className="text-xs font-medium text-muted-foreground">Select CV to analyze</p>
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5">
          <FileText className="size-4 text-primary shrink-0" />
          <span className="text-sm text-foreground font-medium flex-1">Asim_Alisultanov_CV</span>
          <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">PDF</span>
        </div>
        <Button onClick={onAnalyze} className="w-full gap-2 h-10">
          <Zap className="size-4" /> Analyze CV
        </Button>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          AI will review your CV against this job and suggest targeted improvements.
        </p>
      </div>
    </div>
  );
}

function PanelAnalyzing() {
  return (
    <div className="flex flex-col h-full items-center justify-center px-6 space-y-5 animate-in fade-in duration-300">
      <div className="size-14 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
      <div className="text-center space-y-1.5">
        <p className="text-sm font-semibold text-foreground">Analyzing your CV…</p>
        <p className="text-xs text-muted-foreground">Scoring against job requirements</p>
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ animation: "fill-bar 2.3s linear forwards" }} />
      </div>
      <p className="text-[11px] text-muted-foreground/50">This usually takes a few seconds</p>
    </div>
  );
}

function PanelSuggestions() {
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-3 duration-300">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">AI Suggestions</span>
        <Badge variant="outline" className="text-[10px] h-5 px-2">8 pending</Badge>
      </div>
      <div className="px-4 py-3 border-b border-border bg-muted/10">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground mb-1.5 truncate">Asim_Alisultanov_CV</p>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-match-review" style={{ width: "78%" }} />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg px-2.5 py-2 bg-match-review/10 border border-match-review/20 shrink-0">
            <span className="text-base font-bold text-match-review leading-none">78</span>
            <span className="text-[8px] font-semibold text-match-review/70 uppercase">match</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">Strong match for a Senior Back-End role due to 4+ years of PHP/Laravel experience, REST APIs and real-time WebSocket architecture.</p>
      </div>
      <div className={cn("px-4 py-3 border-b border-border transition-colors duration-300", accepted && "bg-emerald-50/30 dark:bg-emerald-950/20")}>
        <div className="flex items-start gap-2 mb-2">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border/40 bg-background text-muted-foreground/70">
            <Search className="size-3" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              {accepted
                ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400"><CheckCircle2 className="size-3" />Applied</span>
                : <span className="inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold border bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400"><span className="size-1.5 rounded-full bg-red-500 shrink-0" />High</span>
              }
              <span className="text-[10px] text-muted-foreground border border-border/40 rounded-full px-2 py-px">Keywords</span>
            </div>
            <p className="text-xs font-semibold text-foreground">Add &apos;TypeScript&apos; to skills section</p>
          </div>
        </div>
        {!accepted && (
          <div className="flex gap-1.5">
            <Button size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => setAccepted(true)}>
              <CheckCircle2 className="size-3" /> Apply
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-3">Decline</Button>
          </div>
        )}
      </div>
      <div className="px-4 py-3 flex-1 overflow-hidden">
        <div className="flex items-start gap-2 mb-2">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border/40 bg-background text-muted-foreground/70">
            <TrendingUp className="size-3" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold border bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400">
                <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />Medium
              </span>
              <span className="text-[10px] text-muted-foreground border border-border/40 rounded-full px-2 py-px">Experience</span>
            </div>
            <p className="text-xs font-semibold text-foreground">Quantify your team impact</p>
          </div>
        </div>
        <div className="rounded-md border overflow-hidden text-[11px] font-mono mb-2">
          <div className="flex gap-2 px-2.5 py-1.5 bg-red-50 border-b border-red-100 dark:bg-red-950/30 dark:border-red-900/40">
            <span className="text-red-400 font-bold shrink-0">−</span>
            <span className="text-red-600/80 dark:text-red-400/70 line-through">Led team on several projects</span>
          </div>
          <div className="flex gap-2 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30">
            <span className="text-emerald-500 font-bold shrink-0">+</span>
            <span className="text-emerald-700/90 dark:text-emerald-400/80">Led cross-functional team of 8 engineers</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" className="flex-1 h-7 text-xs gap-1"><CheckCircle2 className="size-3" /> Apply</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-3">Decline</Button>
        </div>
      </div>
    </div>
  );
}

function HeroInteractiveDemo() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const scene = DEMO_SCENES[sceneIdx];

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => {
      setSceneIdx((i) => (i + 1) % DEMO_SCENES.length);
    }, SCENE_DURATIONS[scene]);
    return () => clearTimeout(timer);
  }, [paused, scene, sceneIdx]);

  function jumpTo(s: DemoScene) {
    setSceneIdx(DEMO_SCENES.indexOf(s));
    setPaused(true);
  }

  const showPanel = scene !== "feed";

  return (
    <div
      className="w-full rounded-xl overflow-hidden border border-border shadow-2xl shadow-primary/10 bg-background"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 h-10 bg-card border-b border-border shrink-0">
        <span className="size-3 rounded-full bg-red-400/80" />
        <span className="size-3 rounded-full bg-amber-400/80" />
        <span className="size-3 rounded-full bg-green-400/80" />
        <div className="flex-1 mx-4 h-6 rounded-md bg-muted/50 flex items-center px-3">
          <span className="text-xs text-muted-foreground/60">app.jobclawd.com/dashboard/feed</span>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all duration-300 shrink-0",
          paused ? "border-primary/30 bg-primary/8 text-primary" : "border-border/50 bg-muted/30 text-muted-foreground",
        )}>
          <span className={cn("size-1.5 rounded-full transition-colors", paused ? "bg-primary" : "bg-muted-foreground/50")} />
          {paused ? "Interactive" : "Auto-playing"}
        </div>
      </div>

      {/* App layout */}
      <div className="flex" style={{ height: 540 }}>
        {/* Sidebar */}
        <div className="w-44 border-r border-border bg-sidebar flex flex-col shrink-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Image src={logo} width={16} height={16} alt="" className="dark:brightness-0 dark:invert opacity-70 shrink-0" />
            <span className="text-sm font-bold">Job<span className="text-primary">Clawd</span></span>
          </div>
          <nav className="flex-1 py-2 px-2 space-y-0.5">
            {([
              { icon: LayoutGrid, label: "Job Feed",  active: true  },
              { icon: Bookmark,   label: "Saved Jobs",active: false },
              { icon: BarChart2,  label: "Analytics", active: false },
              { icon: User,       label: "Profile",   active: false },
            ]).map(({ icon: Icon, label, active }) => (
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
              <span className="font-medium">438/10</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-4/5 rounded-full bg-primary" />
            </div>
            <p className="text-[11px] text-primary/70 cursor-pointer hover:text-primary">+ Get more credits</p>
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-3 px-4 h-11 border-b border-border bg-background shrink-0">
            <span className="text-sm font-semibold flex-1">Job Feed</span>
            <div className="size-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">Y</div>
          </div>
          <div className="px-4 py-3 border-b border-border space-y-2 shrink-0">
            <div className="flex items-center gap-3 h-9 px-3 rounded-lg border border-border bg-muted/20">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground flex-1">backend php developer</span>
              <Button size="sm" className="h-6 px-3 text-xs shrink-0">Search</Button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {["Remote ×", "Hybrid ×", "Worldwide", "Lead/Manager ×", "Full-time ×", "Contract ×"].map((f) => (
                <span key={f} className="text-[11px] px-2 py-0.5 rounded-md border border-border bg-background text-muted-foreground">{f}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-muted/10 text-xs shrink-0">
            <span className="text-muted-foreground">5 positions found <span className="text-primary font-medium">· 5 filters active</span></span>
            <span className="text-muted-foreground">Cached · <span className="text-primary font-medium">438/10 credits left</span></span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="size-2 rounded-full bg-match-review shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground">Needs Review</span>
              <span className="text-xs text-muted-foreground/50">5</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {DEMO_FEED_JOBS.map((job, i) => (
                <DemoJobCard
                  key={i}
                  job={job}
                  highlighted={i === 0 && scene === "feed"}
                  onClick={() => jumpTo("detail")}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {showPanel && (
          <div className="w-80 border-l border-border flex flex-col bg-background shrink-0 overflow-hidden">
            {scene === "detail"      && <PanelDetailOverview onImprove={() => jumpTo("improve")} />}
            {scene === "improve"     && <PanelImprove onAnalyze={() => jumpTo("analyzing")} />}
            {scene === "analyzing"   && <PanelAnalyzing />}
            {scene === "suggestions" && <PanelSuggestions />}
          </div>
        )}
      </div>

      {/* Scene tabs */}
      <div className="flex items-center gap-0 border-t border-border bg-card">
        {DEMO_SCENES.map((s, i) => (
          <button
            key={s}
            onClick={() => jumpTo(s)}
            className={cn(
              "flex-1 py-2 text-[11px] font-medium transition-all duration-200 border-b-2 capitalize",
              scene === s
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-accent",
            )}
          >
            {s === "analyzing" ? "Analyzing" : s === "suggestions" ? "Suggestions" : s === "detail" ? "Overview" : s === "improve" ? "Improve CV" : "Feed"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Sources marquee ─────────────────────────────────────────── */
const PLATFORM_ROWS: { name: string; accent: string }[][] = [
  [
    { name: "jobsearch.az", accent: "bg-amber-400" },
    { name: "LinkedIn", accent: "bg-blue-500" },
    { name: "Indeed", accent: "bg-indigo-500" },
    { name: "Glassdoor", accent: "bg-green-500" },
    { name: "Monster", accent: "bg-violet-500" },
    { name: "Stepstone", accent: "bg-orange-500" },
  ],
  [
    { name: "CareerBuilder", accent: "bg-blue-400" },
    { name: "SimplyHired", accent: "bg-red-400" },
    { name: "ZipRecruiter", accent: "bg-green-400" },
    { name: "Workday", accent: "bg-cyan-500" },
    { name: "Hired", accent: "bg-pink-500" },
    { name: "Jora", accent: "bg-teal-500" },
  ],
  [
    { name: "Seek", accent: "bg-sky-500" },
    { name: "Remote.co", accent: "bg-emerald-500" },
    { name: "Snagajob", accent: "bg-yellow-500" },
    { name: "Wellfound", accent: "bg-purple-500" },
    { name: "Otta", accent: "bg-rose-500" },
    { name: "Greenhouse", accent: "bg-lime-500" },
  ],
];

const ROW_DURATIONS = ["[--duration:72s]", "[--duration:76s]", "[--duration:84s]"];

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

/* ─── How it works — detailed previews using dash components ─── */

function StepSearchPreview() {
  return (
    <div className="space-y-2">
      {/* search input — mirrors FeedFilterForm */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background">
        <Search className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground flex-1">Frontend Engineer</span>
        <Button size="sm" className="h-6 px-2.5 text-[11px]">
          Search
        </Button>
      </div>
      {/* active filter chips — mirrors the filter badge row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {["Baku", "Remote", "Senior"].map((f) => (
          <Badge key={f} variant="secondary" className="text-[11px] h-5 px-2 font-normal">
            {f}
          </Badge>
        ))}
      </div>
      {/* source indicator row */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-border">
        <span className="text-[11px] text-muted-foreground/60">
          Searching across all platforms…
        </span>
      </div>
    </div>
  );
}

function StepScorePreview() {
  const jobs = [
    { title: "Senior Frontend Eng.", company: "Kapital Bank", score: 88, level: "HIGH" as const },
    { title: "Product Designer", company: "Pasha Holding", score: 61, level: "REVIEW" as const },
    { title: "Backend Developer", company: "AtaBank", score: 34, level: "TRASH" as const },
  ];
  return (
    <div className="space-y-1.5">
      {jobs.map((j) => (
        <div
          key={j.title}
          className={cn(
            "flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border bg-background",
            j.level === "HIGH" ? "border-match-high/30" : "border-border",
          )}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{j.title}</p>
            <p className="text-[11px] text-muted-foreground">{j.company}</p>
          </div>
          {j.level !== "TRASH" ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-lg px-2.5 py-1 shrink-0 min-w-12",
                j.level === "HIGH"
                  ? "bg-match-high/10 border border-match-high/20"
                  : "bg-match-review/10 border border-match-review/20",
              )}
            >
              <span
                className={cn(
                  "text-sm font-bold leading-none tabular-nums",
                  j.level === "HIGH" ? "text-match-high" : "text-match-review",
                )}
              >
                {j.score}
              </span>
              <span
                className={cn(
                  "text-[9px] font-semibold mt-0.5 uppercase tracking-wide",
                  j.level === "HIGH" ? "text-match-high/70" : "text-match-review/70",
                )}
              >
                {j.level === "HIGH" ? "High" : "Review"}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground/50 shrink-0">Low</span>
          )}
        </div>
      ))}
    </div>
  );
}

function StepSuggestPreview() {
  return (
    <div className="space-y-2">
      {/* suggestion card — mirrors SuggestionCard */}
      <Card className="gap-0 py-0 border-border/60">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border/40 bg-background text-muted-foreground/70">
              <Search className="size-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold border bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
                  <span className="size-1.5 rounded-full bg-red-500 shrink-0" />
                  High
                </span>
                <span className="text-[10px] text-muted-foreground border border-border/40 rounded-full px-2 py-px">
                  Keywords
                </span>
              </div>
              <p className="text-xs font-semibold text-foreground">
                Add &apos;TypeScript&apos; to skills
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                This role requires TypeScript — it&apos;s missing from your skills section.
              </p>
            </div>
          </div>
          {/* diff view */}
          <div className="rounded-md border overflow-hidden text-[11px] font-mono">
            <div className="flex gap-2 px-3 py-1.5 bg-red-50 border-b border-red-100 dark:bg-red-950/30 dark:border-red-900/40">
              <span className="text-red-400 font-bold select-none shrink-0">−</span>
              <span className="text-red-600/80 dark:text-red-400/80 line-through">
                JavaScript, Python
              </span>
            </div>
            <div className="flex gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30">
              <span className="text-emerald-500 font-bold select-none shrink-0">+</span>
              <span className="text-emerald-700/90 dark:text-emerald-400/90">
                TypeScript, JavaScript, Python
              </span>
            </div>
          </div>
          {/* actions */}
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs flex-1 gap-1">
              <CheckCircle2 className="size-3" /> Accept
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1">
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* score impact row */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-background">
        <span className="text-[11px] text-muted-foreground">CV match score</span>
        <span className="text-[11px] font-semibold text-match-high">72 → 91 ↑</span>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 max-w-5xl mx-auto w-full">
      <div className="text-center mb-12">
        <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">
          How it works
        </Badge>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          From search to offer, <GradientText>in three steps</GradientText>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
        {[
          {
            num: "01",
            icon: Search,
            title: "Search any role",
            desc: "Enter a role, skills, or location. JobClawd searches across all major job platforms simultaneously and returns a unified, ranked feed.",
            preview: <StepSearchPreview />,
          },
          {
            num: "02",
            icon: Zap,
            title: "AI scores your fit",
            desc: "Every vacancy is scored 0–100 against your uploaded CV. High Match, Needs Review, and Low Match labels surface the right opportunities instantly.",
            preview: <StepScorePreview />,
          },
          {
            num: "03",
            icon: TrendingUp,
            title: "Optimize & apply",
            desc: "Get 8–14 targeted suggestions per job. Accept edits, check the score impact, then export an ATS-ready CV and apply.",
            preview: <StepSuggestPreview />,
          },
        ].map(({ num, icon: Icon, title, desc, preview }) => (
          <Card key={num} className="gap-0 py-0">
            <CardContent className="px-5 pt-5 pb-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 border border-primary/15">
                  <Icon className="size-4 text-primary" />
                </div>
                <span className="text-xs font-bold text-muted-foreground/30 tabular-nums">
                  {num}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
              <div className="border-t border-border pt-4">{preview}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ─── Feature card — same Card/CardContent as dashboard ──────── */
function FeatureCard({
  icon: Icon,
  title,
  desc,
  large,
  children,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  large?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0 h-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <CardContent className={cn("space-y-3", large ? "px-6 pt-6 pb-6" : "px-5 pt-5 pb-5")}>
        <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 border border-primary/15">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <h3 className={cn("font-semibold text-foreground mb-1", large ? "text-base" : "text-sm")}>
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
          Everything you need to <GradientText>land the role</GradientText>
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
            icon={LayoutGrid}
            title="Multi-source job feed"
            desc="JobClawd pulls listings from multiple job platforms into a single unified feed. Every result is ranked by AI match score so the best fits always appear first."
          ></FeatureCard>
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
            {[
              "Add 'TypeScript' to skills section",
              "Quantify team leadership (lead 5→12 engineers)",
              "Mirror 'distributed systems' from JD",
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
  { value: 9, suffix: "+ platforms", label: "Job platforms searched simultaneously" },
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
    <section id="pricing" className="py-28 px-6 text-center">
      <div className="max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 border border-primary/25 bg-primary/8 text-primary">
          <Star className="size-3 fill-primary" />
          Free to start — no card required
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-5">
          Ready to find your <GradientText>next role?</GradientText>
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-10 text-sm leading-relaxed">
          Set up in under a minute. Search any role, score your CV, get suggestions, and apply with
          confidence.
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleGetStarted() {
    router.push(user ? "/dashboard/feed" : "/auth/login");
  }

  return (
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
          <div className="flex items-center gap-2.5 flex-1">
            <Image
              src={logo}
              alt="JobClawd"
              width={28}
              height={28}
              className="dark:brightness-0 dark:invert shrink-0"
            />
            <span className="font-bold text-base tracking-tight">
              Job<span className="text-primary">Clawd</span>
            </span>
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
            <span>Find jobs &amp; improve your CV with AI</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
            Land your next job{" "}
            <GradientText>faster, smarter.</GradientText>
          </h1>

          <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
            Search every major job platform at once, get AI match scores against your CV, and receive
            targeted suggestions to optimize and apply with confidence.
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
            {["Free to start", "No card required", "2 min setup"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3 text-success shrink-0" />
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto mt-14" style={{ animation: "fade-up 0.6s ease 0.15s both" }}>
          <div className="absolute -inset-6 rounded-3xl bg-primary/5 blur-2xl pointer-events-none" />
          <HeroInteractiveDemo />
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
            <Link href="/auth/login" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">
              How it works
            </Link>
            <span className="text-muted-foreground/40">Built for job seekers.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
