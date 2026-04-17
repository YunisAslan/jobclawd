"use client";

import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import type { CVPerformanceEntry } from "@/types";

interface CVComparisonProps {
  data: CVPerformanceEntry[];
}

export default function CVComparison({ data }: CVComparisonProps) {
  if (!data.length) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        No CV performance data yet. Apply to jobs with different CVs to compare.
      </p>
    );
  }

  const withRate = data.map((cv) => ({
    ...cv,
    rate: cv.sent > 0 ? Math.round((cv.replies / cv.sent) * 100) : 0,
  }));

  // Sort by rate descending, then by sent
  const sorted = [...withRate].sort((a, b) => b.rate - a.rate || b.sent - a.sent);
  const maxRate = Math.max(...sorted.map((c) => c.rate), 1);
  const winner = sorted.find((c) => c.sent >= 3); // minimum 3 sends to qualify

  return (
    <div className="space-y-3">
      {sorted.map((cv, i) => {
        const isWinner = winner && cv.cv_name === winner.cv_name;
        const barWidth = maxRate > 0 ? (cv.rate / maxRate) * 100 : 0;

        return (
          <div key={cv.cv_name} className={cn(
            "rounded-xl border p-3 space-y-2 transition-colors",
            isWinner ? "border-success/30 bg-success/5" : "border-border/50",
          )}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {isWinner && <Trophy className="size-3.5 text-success shrink-0" />}
                <span className="text-xs font-semibold text-foreground truncate">{cv.cv_name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-[11px] text-muted-foreground tabular-nums">
                <span>{cv.sent} sent</span>
                <span>{cv.replies} replied</span>
                <span className={cn(
                  "font-bold text-xs",
                  cv.rate >= 20 ? "text-success" : cv.rate >= 10 ? "text-amber-500" : "text-muted-foreground",
                )}>
                  {cv.rate}%
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  isWinner ? "bg-success" : i === 1 ? "bg-primary" : "bg-muted-foreground/40",
                )}
                style={{ width: `${Math.max(barWidth, cv.rate > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}

      {winner && (
        <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 leading-relaxed">
          <span className="font-semibold text-foreground">{winner.cv_name}</span> is your top-performing CV
          with a <span className="font-semibold text-success">{winner.rate}%</span> reply rate.
          Use it for future applications.
        </p>
      )}
    </div>
  );
}
