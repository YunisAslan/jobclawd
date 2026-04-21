"use client";

import type { ScoreDistributionEntry } from "@/types";

interface ScoreDistributionProps {
  data: ScoreDistributionEntry[];
}

const BAND_COLOR: Record<string, string> = {
  "Strong (75+)": "bg-success",
  "Good (50–74)": "bg-primary",
  "Low (<50)": "bg-muted-foreground/40",
};

export default function ScoreDistribution({ data }: ScoreDistributionProps) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        No analyses yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((entry) => {
        const pct = Math.round((entry.count / total) * 100);
        return (
          <div key={entry.band} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{entry.band}</span>
              <span className="font-semibold tabular-nums">
                {entry.count}
                <span className="text-muted-foreground font-normal ml-1">({pct}%)</span>
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${BAND_COLOR[entry.band] ?? "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground pt-1">{total} analyses total</p>
    </div>
  );
}
