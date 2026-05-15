"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchProgress } from "@/services/jobs.service";

const STAGE_CONFIG: Record<string, { label: string; detail: string; order: number }> = {
  scraping: {
    label: "Searching job sources",
    detail: "Scanning LinkedIn, Indeed, Glassdoor, ZipRecruiter, Dice, Simplify, RemoteOK, Jobicy, Remotive, WWR and more…",
    order: 0,
  },
  found: { label: "Positions found", detail: "Deduplicating across sources", order: 1 },
  analyzing: { label: "Extracting metadata", detail: "Parsing salary, work mode, seniority…", order: 2 },
  filtering: { label: "Scoring and ranking", detail: "Matching each role against your CV", order: 3 },
};

// Thresholds relaxed: streaming UX (LiveSearchPanel + BottomStreamingIndicator)
// keeps users engaged, so we don't need to apologise after 15s.
const SLOW_THRESHOLD_MS = 25_000;
const TIMEOUT_THRESHOLD_MS = 75_000;

function useElapsedTime(running: boolean) {
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(id);
  }, [running, startTime]);

  return elapsed;
}

interface FeedLoadingProgressProps {
  progress?: SearchProgress | null;
}

export default function FeedLoadingProgress({ progress }: FeedLoadingProgressProps) {
  const currentStage = progress?.stage ?? "scraping";
  const elapsed = useElapsedTime(true);

  const isSlow = elapsed >= SLOW_THRESHOLD_MS;
  const isTimeout = elapsed >= TIMEOUT_THRESHOLD_MS;

  const completedStages = useMemo(() => {
    if (!progress) return new Set<string>();
    const currentOrder = STAGE_CONFIG[progress.stage]?.order ?? 0;
    const done = new Set<string>();
    for (const [key, config] of Object.entries(STAGE_CONFIG)) {
      if (config.order < currentOrder) done.add(key);
    }
    return done;
  }, [progress]);

  const stages = Object.entries(STAGE_CONFIG);
  const elapsedSec = Math.floor(elapsed / 1000);
  const elapsedLabel = elapsedSec < 60
    ? `${elapsedSec}s`
    : `${Math.floor(elapsedSec / 60)}m ${(elapsedSec % 60).toString().padStart(2, "0")}s`;

  return (
    <div className="relative animate-in fade-in duration-700">
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

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full max-w-sm p-5 sm:p-6 rounded-2xl bg-card/95 border border-border/60 shadow-xl backdrop-blur-sm space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center size-8 shrink-0">
              <div className="absolute inset-0 border border-border/60 rounded-full" />
              <div
                className={cn("absolute inset-0 border-2 border-transparent rounded-full animate-spin", isTimeout ? "border-t-warning" : "border-t-primary")}
                style={{ animationDuration: "1.5s" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold tracking-tight text-foreground/90">Curating your feed</h3>
              <span className={cn("text-[11px] tabular-nums", isTimeout ? "text-warning" : isSlow ? "text-muted-foreground/60" : "text-muted-foreground/40")}>
                {elapsedLabel} elapsed
              </span>
            </div>
          </div>

          {/* Pipeline stages */}
          <div className="space-y-3 px-1">
            {stages.map(([key, config]) => {
              const done = completedStages.has(key);
              const active = key === currentStage;
              const upcoming = !done && !active;

              let label = config.label;
              let detail: string | null = null;

              if (key === "found" && progress?.stage === "found" && progress.current > 0) {
                label = `${progress.current} positions found`;
                detail = "Deduplicating across sources";
              } else if (key === "found" && (currentStage === "analyzing" || currentStage === "filtering") && progress?.total) {
                label = `${progress.total} positions found`;
              }

              if (key === "analyzing" && active) {
                if (progress?.message?.includes("AI enriching")) {
                  label = "AI enrichment";
                  detail = progress.message;
                } else {
                  detail = config.detail;
                }
                if (progress?.total && progress.total > 0) {
                  label = `Enriching metadata · ${progress.current}/${progress.total}`;
                }
              }

              if (key === "filtering" && active) detail = config.detail;
              if (key === "scraping" && active) detail = config.detail;

              return (
                <div key={key} className={cn("flex items-center gap-3.5 transition-all duration-500", upcoming && "opacity-30")}>
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
                  <div className="flex-1 min-w-0">
                    <span className={cn("text-[13px] transition-all duration-500 block", done ? "text-muted-foreground/50" : active ? "font-semibold text-foreground" : "text-muted-foreground/70 font-medium")}>
                      {label}
                    </span>
                    {active && detail && (
                      <span className="text-[11px] text-muted-foreground/50 block mt-0.5 animate-in fade-in duration-500">{detail}</span>
                    )}
                    {key === "analyzing" && active && progress?.total && progress.total > 0 && (
                      <div className="mt-1.5 w-full h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isTimeout && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20 animate-in fade-in slide-in-from-bottom-1 duration-300">
              <AlertTriangle className="size-3.5 text-warning shrink-0" />
              <p className="text-[11px] text-warning leading-tight">
                This is taking longer than expected. Some sources may be slow to respond.
              </p>
            </div>
          )}
          {isSlow && !isTimeout && (
            <p className="text-[11px] text-muted-foreground/40 text-center px-4 animate-in fade-in duration-700">
              Results will start streaming in shortly — first jobs typically arrive within a few seconds.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
