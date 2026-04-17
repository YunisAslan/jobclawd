"use client";

import { cn } from "@/lib/utils";
import type { FunnelEntry } from "@/types";

interface ApplicationFunnelProps {
  data: FunnelEntry[];
}

const STAGE_COLORS = [
  { bar: "bg-primary", text: "text-primary", bg: "bg-primary/10" },
  { bar: "bg-blue-500", text: "text-blue-500", bg: "bg-blue-500/10" },
  { bar: "bg-amber-500", text: "text-amber-500", bg: "bg-amber-500/10" },
  { bar: "bg-success", text: "text-success", bg: "bg-success/10" },
];

export default function ApplicationFunnel({ data }: ApplicationFunnelProps) {
  if (!data.length) return (
    <p className="text-xs text-muted-foreground text-center py-6">No application data yet.</p>
  );

  const total = data[0]?.count ?? 1;

  return (
    <div className="space-y-3">
      {data.map((stage, i) => {
        const color = STAGE_COLORS[i] ?? STAGE_COLORS[STAGE_COLORS.length - 1];
        const width = total > 0 ? (stage.count / total) * 100 : 0;
        // Conversion rate from previous stage
        const prevCount = i === 0 ? total : (data[i - 1]?.count ?? total);
        const conversion = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 0;

        return (
          <div key={stage.label}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className={cn("text-[11px] font-semibold", color.text)}>
                  {stage.label}
                </span>
                {i > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                    {conversion}% of prev
                  </span>
                )}
              </div>
              <span className="text-sm font-bold tabular-nums">{stage.count}</span>
            </div>
            <div className="h-2.5 w-full bg-muted/40 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", color.bar)}
                style={{ width: `${Math.max(width, stage.count > 0 ? 2 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* Action tip */}
      {data.length >= 4 && total > 0 && (() => {
        const replyPct = data[3]?.pct ?? 0;
        if (replyPct < 10) {
          return (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2 mt-2 leading-relaxed">
              Your reply rate is low. Try improving keyword alignment using the AI CV editor.
            </p>
          );
        }
        if (replyPct >= 25) {
          return (
            <p className="text-[11px] text-success bg-success/8 border border-success/20 rounded-lg px-3 py-2 mt-2 leading-relaxed">
              Great reply rate! Keep applying with your best-performing CV.
            </p>
          );
        }
        return null;
      })()}
    </div>
  );
}
