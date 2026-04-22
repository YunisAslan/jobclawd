"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/Chart";
import type { WeeklyChartEntry } from "@/types";

interface ActivityTrendProps {
  data: WeeklyChartEntry[];
  days?: number;
}

const chartConfig = {
  count: {
    label: "Analyses",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split("T")[0];
  });
}

export default function ActivityTrend({ data, days = 30 }: ActivityTrendProps) {
  const points = useMemo(() => {
    const allDays = getLast30Days().slice(-days);
    const byDate: Record<string, number> = {};
    data.forEach((e) => { byDate[e.date] = e.count; });
    return allDays.map((date) => ({
      date,
      count: byDate[date] ?? 0,
      label: new Date(date + "T12:00:00").toLocaleDateString("en", { month: "short", day: "numeric" }),
    }));
  }, [data, days]);

  const total = points.reduce((s, p) => s + p.count, 0);

  if (total === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        No analysis activity in the last {days} days.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ChartContainer config={chartConfig} className="h-35 w-full">
        <AreaChart data={points} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            interval={Math.floor(points.length / 5)}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} allowDecimals={false} />
          <ChartTooltip
            content={<ChartTooltipContent indicator="dot" hideLabel={false} labelKey="label" />}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--color-count)"
            strokeWidth={2}
            fill="url(#fillCount)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ChartContainer>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
        <span>{total} analyses in {days} days</span>
        <span>avg {(total / days).toFixed(1)}/day</span>
      </div>
    </div>
  );
}
