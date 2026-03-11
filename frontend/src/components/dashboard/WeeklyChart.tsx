"use client";

import { WeeklyChartEntry } from "@/components/dashboard/types";

const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getLastSevenDays(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

interface WeeklyChartProps {
  data: WeeklyChartEntry[];
}

export default function WeeklyChart({ data }: WeeklyChartProps) {
  const last7 = getLastSevenDays();
  const countByDate: Record<string, number> = {};
  data.forEach((e) => { countByDate[e.date] = e.count; });

  const bars = last7.map((dateStr) => ({
    dateStr,
    dayLabel: EN_DAYS[(new Date(dateStr).getDay())],
    count: countByDate[dateStr] || 0,
  }));

  const maxVal = Math.max(...bars.map((b) => b.count), 1);

  return (
    <div>
      <div className="flex items-end gap-2 h-32">
        {bars.map((bar, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-muted font-medium">{bar.count > 0 ? bar.count : ""}</span>
            <div className="w-full flex items-end" style={{ height: 96 }}>
              <div
                className="w-full rounded-t transition-all duration-500"
                style={{
                  height: `${Math.max((bar.count / maxVal) * 100, bar.count > 0 ? 8 : 0)}%`,
                  background: bar.count > 0 ? "var(--primary)" : "var(--border)",
                  minHeight: bar.count > 0 ? 4 : 0,
                }}
              />
            </div>
            <span className="text-xs text-muted">{bar.dayLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
