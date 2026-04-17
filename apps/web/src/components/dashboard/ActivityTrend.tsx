"use client";

import type { WeeklyChartEntry } from "@/types";

interface ActivityTrendProps {
  data: WeeklyChartEntry[];
  days?: number;
}

function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split("T")[0];
  });
}

export default function ActivityTrend({ data, days = 30 }: ActivityTrendProps) {
  const allDays = getLast30Days().slice(-days);
  const byDate: Record<string, number> = {};
  data.forEach((e) => { byDate[e.date] = e.count; });

  const points = allDays.map((d) => ({ date: d, count: byDate[d] ?? 0 }));
  const maxVal = Math.max(...points.map((p) => p.count), 1);

  const W = 600;
  const H = 80;
  const PAD = 4;

  // Build SVG polyline points
  const coords = points.map((p, i) => {
    const x = PAD + (i / (points.length - 1)) * (W - PAD * 2);
    const y = H - PAD - (p.count / maxVal) * (H - PAD * 2);
    return { x, y, ...p };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");

  // Fill area under curve
  const areaPath = [
    `M ${coords[0]?.x ?? 0},${H}`,
    ...coords.map((c) => `L ${c.x},${c.y}`),
    `L ${coords[coords.length - 1]?.x ?? W},${H}`,
    "Z",
  ].join(" ");

  const total = points.reduce((s, p) => s + p.count, 0);

  if (total === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        No application activity in the last {days} days.
      </p>
    );
  }

  // Month labels (show at start of each month or every ~7 days)
  const labels: { x: number; label: string }[] = [];
  let lastLabel = "";
  coords.forEach((c, i) => {
    const d = new Date(c.date + "T12:00:00");
    const label = d.toLocaleDateString("en", { month: "short", day: "numeric" });
    if (i === 0 || i === coords.length - 1 || (i % 7 === 0 && label !== lastLabel)) {
      labels.push({ x: c.x, label });
      lastLabel = label;
    }
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H + 20}`}
        className="w-full overflow-visible"
        style={{ height: 100 }}
        aria-label="30-day activity trend"
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill="url(#trendFill)" />

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots for non-zero days */}
        {coords.map((c, i) =>
          c.count > 0 ? (
            <circle key={i} cx={c.x} cy={c.y} r="2.5" fill="var(--primary)" />
          ) : null
        )}

        {/* X-axis labels */}
        {labels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={H + 16}
            textAnchor="middle"
            fontSize="9"
            fill="var(--muted-foreground)"
          >
            {l.label}
          </text>
        ))}
      </svg>

      <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
        <span>{total} applications in {days} days</span>
        <span>avg {(total / days).toFixed(1)}/day</span>
      </div>
    </div>
  );
}
