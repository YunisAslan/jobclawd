"use client";

import type { SourceBreakdownEntry } from "@/types";

interface SourceBreakdownProps {
  data: SourceBreakdownEntry[];
}

const SOURCE_COLOR: Record<string, string> = {
  "LinkedIn": "bg-blue-500",
  "Indeed": "bg-violet-500",
  "JobSearch.az": "bg-primary",
};

export default function SourceBreakdown({ data }: SourceBreakdownProps) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        No analyses recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-3 w-full rounded-full overflow-hidden gap-px">
        {data.map((entry) => (
          <div
            key={entry.source}
            className={`h-full transition-all ${SOURCE_COLOR[entry.source] ?? "bg-muted-foreground"}`}
            style={{ width: `${(entry.count / total) * 100}%` }}
            title={`${entry.source}: ${entry.count}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {data.map((entry) => {
          const pct = Math.round((entry.count / total) * 100);
          return (
            <div key={entry.source} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-sm ${SOURCE_COLOR[entry.source] ?? "bg-muted-foreground"}`}
                />
                <span className="text-muted-foreground">{entry.source}</span>
              </div>
              <span className="font-semibold tabular-nums">
                {entry.count}
                <span className="text-muted-foreground font-normal ml-1">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
