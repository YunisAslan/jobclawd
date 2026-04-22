"use client";

import type { TopJobTitleEntry } from "@/types";

interface TopJobTitlesProps {
  data: TopJobTitleEntry[];
}

export default function TopJobTitles({ data }: TopJobTitlesProps) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        No job analyses recorded yet.
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2.5">
      {data.map((entry, i) => (
        <div key={entry.title} className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground/60 w-4 shrink-0 text-right">{i + 1}</span>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-muted-foreground">{entry.title}</span>
              <span className="font-semibold tabular-nums ml-2 shrink-0">{entry.count}×</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round((entry.count / max) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
