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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedResultsProps {
  highMatch: JobListing[];
  needsReview: JobListing[];
  loading?: boolean;
  hasSearched?: boolean;
  activeFilterCount?: number;
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
      {/* Ghost skeleton cards — background layer */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 pointer-events-none select-none">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-5 border border-border/30 rounded-2xl space-y-4 bg-card/40 h-36 flex flex-col justify-between opacity-[0.12]"
          >
            <div className="space-y-3">
              <div className="h-3.5 bg-foreground/70 rounded animate-pulse" style={{ width: `${50 + ((i * 13) % 35)}%` }} />
              <div className="h-2.5 bg-muted-foreground/50 rounded animate-pulse" style={{ width: `${25 + ((i * 7) % 20)}%` }} />
            </div>
            <div className="flex gap-2.5">
              <div className="h-7 w-16 bg-muted-foreground/30 rounded-full animate-pulse" />
              <div className="h-7 w-20 bg-muted-foreground/30 rounded-full animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Progress card — overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full max-w-sm p-5 sm:p-6 rounded-2xl bg-card/95 border border-border/60 shadow-xl backdrop-blur-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center size-8 shrink-0">
              <div className="absolute inset-0 border border-border/60 rounded-full" />
              <div className="absolute inset-0 border-2 border-transparent border-t-primary rounded-full animate-spin" style={{ animationDuration: "1.5s" }} />
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
                  className={cn("flex items-center gap-3.5 transition-all duration-500", upcoming && "opacity-35")}
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
                  <span className={cn(
                    "text-[13px] transition-all duration-500",
                    done ? "text-muted-foreground/50" : active ? "font-semibold text-foreground" : "text-muted-foreground/70 font-medium",
                  )}>
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

export default function FeedResults({
  highMatch,
  needsReview,
  loading,
  hasSearched,
  activeFilterCount = 0,
  selected,
  onToggleSelect,
  onApply,
  onSkip,
  onHideCompany,
}: FeedResultsProps) {
  if (!hasSearched && !loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in zoom-in duration-300">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Compass className="size-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          Ready to explore
        </h3>
        <p className="max-w-sm text-sm mb-5">
          Enter a role or skill, then refine with filters.{" "}
          <span className="text-muted-foreground/60">
            More specific inputs → more relevant matches.
          </span>
        </p>

        {/* Filter tips */}
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
            <div
              key={tip}
              className="flex items-start gap-2.5 text-xs text-muted-foreground/70"
            >
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
      <div className="py-24 flex flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in zoom-in duration-300">
        <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Inbox className="size-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">
          No matches found
        </h3>
        <p className="max-w-xs text-sm">
          Try adjusting your search criteria or removing some filters to see
          more results.
        </p>
      </div>
    );
  }

  const totalVisible = highMatch.length + needsReview.length;

  return (
    <div className="space-y-6">
      {/* Results meta bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/40 pb-2.5">
        <span>
          {totalVisible} position{totalVisible !== 1 ? "s" : ""} found
        </span>
        {activeFilterCount > 0 && (
          <span className="flex items-center gap-1.5 text-primary/80 transition-all duration-200">
            <SlidersHorizontal className="size-3" />
            {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
          </span>
        )}
      </div>

      {highMatch.length > 0 && (
        <section className="space-y-3">
          <FeedResultSectionHeader
            color="primary"
            label="High Match"
            count={highMatch.length}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {highMatch.map((job) => (
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
      )}

      {needsReview.length > 0 && (
        <section className="space-y-3">
          <FeedResultSectionHeader
            color="warning"
            label="Needs Review"
            count={needsReview.length}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {needsReview.map((job) => (
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
      )}
    </div>
  );
}
