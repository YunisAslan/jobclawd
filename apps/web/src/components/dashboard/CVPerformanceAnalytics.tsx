"use client";

import { Trophy } from "lucide-react";
import type { CVAnalyticsEntry } from "@/types";

interface CVPerformanceAnalyticsProps {
  data: CVAnalyticsEntry[];
}

export default function CVPerformanceAnalytics({ data }: CVPerformanceAnalyticsProps) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        No CV analyses recorded yet.
      </p>
    );
  }

  const topScore = Math.max(...data.map((d) => d.avg_score));

  return (
    <div className="space-y-3">
      {data.map((entry) => {
        const isWinner = data.length > 1 && entry.avg_score === topScore && entry.analyses >= 2;
        const pct = Math.min(Math.round(entry.avg_score), 100);
        return (
          <div key={entry.cv_name} className="space-y-1">
            <div className="flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {isWinner && <Trophy className="size-3 text-amber-500 shrink-0" />}
                <span className="truncate text-muted-foreground">{entry.cv_name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 tabular-nums">
                <span className="text-muted-foreground">{entry.analyses}×</span>
                <span className="font-semibold">{entry.avg_score.toFixed(1)} avg</span>
                <span className="text-muted-foreground">best {entry.best_score}</span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
