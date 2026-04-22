"use client";

import { cn } from "@/lib/utils";
import type { ScoreDistributionEntry } from "@/types";

interface ScoreDistributionProps {
  data: ScoreDistributionEntry[];
}

const BAND: Record<string, { bar: string; badge: string; dot: string; label: string }> = {
  "Strong (75+)": {
    bar:   "bg-[#22c55e]",
    badge: "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20",
    dot:   "bg-[#22c55e]",
    label: "Strong",
  },
  "Good (50–74)": {
    bar:   "bg-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
    dot:   "bg-primary",
    label: "Good",
  },
  "Low (<50)": {
    bar:   "bg-muted-foreground/40",
    badge: "bg-muted/60 text-muted-foreground border-border/40",
    dot:   "bg-muted-foreground/40",
    label: "Low",
  },
};

export default function ScoreDistribution({ data }: ScoreDistributionProps) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">No analyses yet.</p>
    );
  }

  const dominant = data.reduce((a, b) => (a.count >= b.count ? a : b));
  const dominantCfg = BAND[dominant.band];
  const dominantPct = Math.round((dominant.count / total) * 100);

  return (
    <div className="space-y-5">

      {/* Overview strip */}
      <div className="flex h-2.5 w-full rounded-full overflow-hidden gap-px">
        {data.map((entry) => {
          const pct = (entry.count / total) * 100;
          const cfg = BAND[entry.band];
          return (
            <div
              key={entry.band}
              className={cn("h-full transition-all", cfg?.bar ?? "bg-muted")}
              style={{ width: `${pct}%` }}
              title={`${entry.band}: ${entry.count}`}
            />
          );
        })}
      </div>

      {/* Dominant insight */}
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3">
        <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", dominantCfg?.badge)}>
          <span className="text-xs font-bold">{dominantPct}%</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight">
            {dominantCfg?.label} matches lead
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {dominant.count} of {total} analyses scored in the <span className="font-medium">{dominant.band}</span> range
          </p>
        </div>
      </div>

      {/* Per-band bars */}
      <div className="space-y-3">
        {data.map((entry) => {
          const pct = Math.round((entry.count / total) * 100);
          const cfg = BAND[entry.band];
          return (
            <div key={entry.band} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full shrink-0", cfg?.dot)} />
                  <span className="text-muted-foreground">{entry.band}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", cfg?.badge)}>
                    {pct}%
                  </span>
                  <span className="font-semibold tabular-nums w-4 text-right">{entry.count}</span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", cfg?.bar ?? "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">{total} analyses total</p>
    </div>
  );
}
