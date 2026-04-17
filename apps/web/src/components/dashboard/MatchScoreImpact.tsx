"use client";

import { cn } from "@/lib/utils";
import type { MatchBandEntry } from "@/types";

interface MatchScoreImpactProps {
  data: MatchBandEntry[];
}

const BAND_COLOR: Record<string, { bar: string; text: string }> = {
  "Strong (75+)": { bar: "bg-success", text: "text-success" },
  "Good (50–74)": { bar: "bg-amber-500", text: "text-amber-500" },
  "Low (<50)":    { bar: "bg-destructive/70", text: "text-destructive" },
  "Unscored":     { bar: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

export default function MatchScoreImpact({ data }: MatchScoreImpactProps) {
  const scored = data.filter((b) => b.band !== "Unscored");

  if (!data.length || data.every((b) => b.applied === 0)) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        Analyze your CVs against jobs to see match score impact.
      </p>
    );
  }

  const maxApplied = Math.max(...data.map((b) => b.applied), 1);

  return (
    <div className="space-y-4">
      {/* Bar chart: applied vs replied per band */}
      <div className="space-y-3">
        {data.map((band) => {
          const color = BAND_COLOR[band.band] ?? BAND_COLOR["Unscored"];
          const appliedW = (band.applied / maxApplied) * 100;
          const repliedW = band.applied > 0 ? (band.replied / band.applied) * appliedW : 0;

          return (
            <div key={band.band}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn("text-[11px] font-semibold", color.text)}>{band.band}</span>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                  <span>{band.applied} applied</span>
                  <span className="font-semibold text-foreground">{band.reply_rate}% reply</span>
                </div>
              </div>
              {/* Stacked bar: full width = applied, inner = replied */}
              <div className="relative h-2.5 bg-muted/40 rounded-full overflow-hidden">
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-full opacity-20 transition-all duration-700", color.bar)}
                  style={{ width: `${appliedW}%` }}
                />
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-700", color.bar)}
                  style={{ width: `${repliedW}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Insight */}
      {scored.length >= 2 && (() => {
        const strong = scored.find((b) => b.band === "Strong (75+)");
        const low = scored.find((b) => b.band === "Low (<50)");
        if (strong && low && strong.reply_rate > low.reply_rate) {
          const diff = Math.round(strong.reply_rate - low.reply_rate);
          return (
            <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 leading-relaxed">
              Jobs with a <span className="font-semibold text-success">strong match score</span> have a{" "}
              <span className="font-semibold text-foreground">{diff}pp higher</span> reply rate than low-scored ones.
              Use the AI CV editor to boost alignment before applying.
            </p>
          );
        }
        return null;
      })()}
    </div>
  );
}
