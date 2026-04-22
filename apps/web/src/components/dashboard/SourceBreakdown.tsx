"use client";

import { Pie, PieChart, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/Chart";
import type { SourceBreakdownEntry } from "@/types";

interface SourceBreakdownProps {
  data: SourceBreakdownEntry[];
}

const SOURCE_COLORS: Record<string, string> = {
  LinkedIn:     "#0A66C2",
  Indeed:       "#8B5CF6",
  "JobSearch.az": "#10B981",
};

export default function SourceBreakdown({ data }: SourceBreakdownProps) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return <p className="text-xs text-muted-foreground text-center py-8">No analyses recorded yet.</p>;
  }

  const chartConfig = Object.fromEntries(
    data.map((d) => [
      d.source,
      { label: d.source, color: SOURCE_COLORS[d.source] ?? "#6B7280" },
    ])
  ) satisfies ChartConfig;

  const chartData = data.map((d) => ({
    source: d.source,
    count: d.count,
    pct: Math.round((d.count / total) * 100),
    fill: SOURCE_COLORS[d.source] ?? "#6B7280",
  }));

  return (
    <ChartContainer config={chartConfig} className="h-52 w-full">
      <PieChart>
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0].payload;
            return (
              <div className="grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-muted-foreground">{item.source}</span>
                  <span className="font-mono font-medium tabular-nums text-foreground ml-auto">
                    {item.count} ({item.pct}%)
                  </span>
                </div>
              </div>
            );
          }}
        />
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="source"
          cx="50%"
          cy="50%"
          innerRadius="40%"
          outerRadius="65%"
          paddingAngle={3}
          strokeWidth={2}
          stroke="hsl(var(--background))"
        >
          {chartData.map((entry) => (
            <Cell key={entry.source} fill={entry.fill} />
          ))}
        </Pie>
        <ChartLegend
          content={<ChartLegendContent nameKey="source" />}
          verticalAlign="bottom"
        />
      </PieChart>
    </ChartContainer>
  );
}
