"use client";

import { useEffect, useState } from "react";
import { JobListing } from "@/types";
import FeedJobCard from "@/components/feed/FeedJobCard";
import FeedResultSectionHeader from "@/components/feed/FeedResultSectionHeader";
import {
  Compass,
  Inbox,
  CheckCircle2,
  MapPin,
  GraduationCap,
  Monitor,
  SlidersHorizontal,
  Zap,
  Clock,
  AlertTriangle,
  Info,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FEED_STALE_TIME } from "@/hooks/use-feed";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip";

interface FeedResultsProps {
  highMatch: JobListing[];
  needsReview: JobListing[];
  loading?: boolean;
  hasSearched?: boolean;
  flash?: boolean;
  activeFilterCount?: number;
  creditsLeft?: number;
  maxCredits?: number;
  outOfCredits?: boolean;
  dataUpdatedAt?: number;
  onRefresh?: () => void;
  selected?: Set<string>;
  onToggleSelect?: (url: string) => void;
  onApply?: (job: JobListing) => void;
  onSkip?: (url: string) => void;
  onHideCompany?: (company: string) => void;
}

const STAGES = [
  { id: 0, label: "Connecting to job sources", duration: 2500 },
  { id: 1, label: "Scanning available roles", duration: 8000 },
  { id: 2, label: "Filtering relevant positions", duration: 5000 },
  { id: 3, label: "Smart analysis in progress", duration: 6000 },
  { id: 4, label: "Ranking top opportunities", duration: 3000 },
];

function LoadingStages() {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let total = 0;
    STAGES.forEach((_, i) => {
      if (i === 0) return;
      total += STAGES[i - 1].duration;
      timers.push(setTimeout(() => setCurrentStage(i), total));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative animate-in fade-in duration-700">
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 pointer-events-none select-none">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-5 border border-border/30 rounded-2xl space-y-4 bg-card/40 h-36 flex flex-col justify-between opacity-[0.12]"
          >
            <div className="space-y-3">
              <div
                className="h-3.5 bg-foreground/70 rounded animate-pulse"
                style={{ width: `${50 + ((i * 13) % 35)}%` }}
              />
              <div
                className="h-2.5 bg-muted-foreground/50 rounded animate-pulse"
                style={{ width: `${25 + ((i * 7) % 20)}%` }}
              />
            </div>
            <div className="flex gap-2.5">
              <div className="h-7 w-16 bg-muted-foreground/30 rounded-full animate-pulse" />
              <div className="h-7 w-20 bg-muted-foreground/30 rounded-full animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full max-w-sm p-5 sm:p-6 rounded-2xl bg-card/95 border border-border/60 shadow-xl backdrop-blur-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center size-8 shrink-0">
              <div className="absolute inset-0 border border-border/60 rounded-full" />
              <div
                className="absolute inset-0 border-2 border-transparent border-t-primary rounded-full animate-spin"
                style={{ animationDuration: "1.5s" }}
              />
            </div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground/90">
              Curating your feed
            </h3>
          </div>

          <div className="space-y-3.5 px-1">
            {STAGES.map((stage) => {
              const done = stage.id < currentStage;
              const active = stage.id === currentStage;
              const upcoming = stage.id > currentStage;
              return (
                <div
                  key={stage.id}
                  className={cn(
                    "flex items-center gap-3.5 transition-all duration-500",
                    upcoming && "opacity-35",
                  )}
                >
                  <div className="relative flex items-center justify-center shrink-0 w-5 h-5">
                    {done ? (
                      <div className="text-primary animate-in zoom-in duration-300 flex items-center justify-center">
                        <CheckCircle2 className="size-4" strokeWidth={2.5} />
                      </div>
                    ) : active ? (
                      <div className="relative flex items-center justify-center">
                        <div className="absolute size-2 bg-primary rounded-full animate-ping opacity-60" />
                        <div className="size-2 bg-primary rounded-full relative z-10" />
                      </div>
                    ) : (
                      <div className="size-1.5 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[13px] transition-all duration-500",
                      done
                        ? "text-muted-foreground/50"
                        : active
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground/70 font-medium",
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function useCacheCountdown(dataUpdatedAt?: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!dataUpdatedAt) return;
    setNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect -- sync reset on new data
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [dataUpdatedAt]);

  if (!dataUpdatedAt) return null;
  const remaining = Math.max(0, FEED_STALE_TIME - (now - dataUpdatedAt));
  if (remaining <= 0) return null;
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function CreditsExhaustedBanner({ maxCredits }: { maxCredits: number }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-in fade-in slide-in-from-top-1 duration-300">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span>You&apos;ve used all {maxCredits} searches. Cached results are still available.</span>
    </div>
  );
}

function CreditsBadge({ creditsLeft, maxCredits }: { creditsLeft: number; maxCredits: number }) {
  const ratio = creditsLeft / maxCredits;
  const color =
    ratio > 0.5
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : ratio > 0.2
        ? "bg-warning/15 text-warning border-warning/25"
        : "bg-destructive/15 text-destructive border-destructive/25";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border cursor-help",
            color,
          )}
        >
          <Zap className="size-3" />
          {creditsLeft}/{maxCredits} credits left
          <Info className="size-3 opacity-60" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        You have {creditsLeft} of {maxCredits} searches left. Repeating the same search with the
        same filters won&apos;t use a credit — cached results are free.
      </TooltipContent>
    </Tooltip>
  );
}

function CacheTimer({
  countdown,
  onRefresh,
  loading,
}: {
  countdown: string;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {onRefresh && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="h-auto gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
              Refresh · 1 credit
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Fetch fresh results now. This will use 1 search credit.
          </TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary/80 border border-primary/15 cursor-help">
            <Clock className="size-3" />
            Cached · refreshes in {countdown}
            <Info className="size-3 opacity-60" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          These results are cached. Fresh data will be fetched after the timer expires.
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

export default function FeedResults({
  highMatch,
  needsReview,
  loading,
  hasSearched,
  flash,
  activeFilterCount = 0,
  creditsLeft = 10,
  maxCredits = 10,
  outOfCredits = false,
  dataUpdatedAt,
  onRefresh,
  selected,
  onToggleSelect,
  onApply,
  onSkip,
  onHideCompany,
}: FeedResultsProps) {
  const cacheCountdown = useCacheCountdown(dataUpdatedAt);
  if (!hasSearched && !loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in zoom-in duration-300">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Compass className="size-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">Ready to explore</h3>
        <p className="max-w-sm text-sm mb-5">
          Enter a role or skill, then refine with filters.{" "}
          <span className="text-muted-foreground/60">
            More specific inputs → more relevant matches.
          </span>
        </p>

        <div className="flex flex-col gap-2.5 text-left max-w-xs w-full">
          <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
            Tips for better results
          </p>
          {[
            {
              icon: MapPin,
              tip: "Add a location to get region-specific listings",
            },
            {
              icon: GraduationCap,
              tip: "Set experience level to filter out mismatched seniority",
            },
            {
              icon: Monitor,
              tip: "Pick a work mode — remote, hybrid, or on-site",
            },
          ].map(({ icon: Icon, tip }) => (
            <div key={tip} className="flex items-start gap-2.5 text-xs text-muted-foreground/70">
              <Icon className="size-3.5 shrink-0 mt-0.5 text-muted-foreground/40" />
              {tip}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingStages />;
  }

  if (highMatch.length === 0 && needsReview.length === 0) {
    return (
      <div className="space-y-3">
        {outOfCredits && <CreditsExhaustedBanner maxCredits={maxCredits} />}
        <div className="flex items-center justify-between pb-2.5 border-b border-border/40">
          <span className="text-xs text-muted-foreground">No matches found</span>
          <div className="flex items-center gap-2">
            {cacheCountdown && (
              <CacheTimer countdown={cacheCountdown} onRefresh={onRefresh} loading={loading} />
            )}
            <CreditsBadge creditsLeft={creditsLeft} maxCredits={maxCredits} />
          </div>
        </div>
        <div
          className={cn(
            "py-24 flex flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in zoom-in rounded-xl transition-colors duration-500",
            flash && "bg-muted/40",
          )}
        >
          <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Inbox className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">No matches found</h3>
          <p className="max-w-xs text-sm">
            Try adjusting your search criteria or removing some filters to see more results.
          </p>
        </div>
      </div>
    );
  }

  const totalVisible = highMatch.length + needsReview.length;

  return (
    <div
      className={cn("space-y-6 rounded-xl transition-colors duration-500", flash && "bg-muted/40")}
    >
      {outOfCredits && <CreditsExhaustedBanner maxCredits={maxCredits} />}
      <div className="flex flex-wrap items-center justify-between gap-y-1.5 border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {totalVisible} position{totalVisible !== 1 ? "s" : ""} found
          </span>
          {activeFilterCount > 0 && (
            <span className="flex items-center gap-1.5 text-primary/80">
              <SlidersHorizontal className="size-3" />
              {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cacheCountdown && (
            <CacheTimer countdown={cacheCountdown} onRefresh={onRefresh} loading={loading} />
          )}
          <CreditsBadge creditsLeft={creditsLeft} maxCredits={maxCredits} />
        </div>
      </div>

      {[
        { jobs: highMatch, color: "primary" as const, label: "High Match" },
        { jobs: needsReview, color: "warning" as const, label: "Needs Review" },
      ].map(
        ({ jobs: sectionJobs, color, label }) =>
          sectionJobs.length > 0 && (
            <section key={label} className="space-y-3">
              <FeedResultSectionHeader color={color} label={label} count={sectionJobs.length} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sectionJobs.map((job) => (
                  <FeedJobCard
                    key={job.url}
                    job={job}
                    selected={selected?.has(job.url) ?? false}
                    onToggleSelect={() => onToggleSelect?.(job.url)}
                    onApply={() => onApply?.(job)}
                    onSkip={() => onSkip?.(job.url)}
                    onDetails={() => onApply?.(job)}
                    onHideCompany={(c) => onHideCompany?.(c)}
                  />
                ))}
              </div>
            </section>
          ),
      )}
    </div>
  );
}
