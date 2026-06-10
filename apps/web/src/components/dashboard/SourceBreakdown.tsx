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
  LinkedIn:           "#0A66C2",
  Indeed:             "#2557A7",
  Glassdoor:          "#0CAA41",
  ZipRecruiter:       "#4A90D9",
  RemoteOK:           "#00B2A9",
  Simplify:           "#6366F1",
  Dice:               "#D0333C",
  Jobicy:             "#FF7A00",
  "We Work Remotely": "#1DBF73",
  Remotive:           "#404BBF",
  "JobSearch.az":     "#10B981",
  Other:              "#6B7280",
};

function colorFor(source: string) {
  return SOURCE_COLORS[source] ?? "#6B7280";
}

function BarList({ data, total }: { data: SourceBreakdownEntry[]; total: number }) {
  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
        const color = colorFor(d.source);
        return (
          <div key={d.source}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-foreground truncate">{d.source}</span>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground ml-3 shrink-0">
                {d.count} <span className="text-muted-foreground/60">({pct}%)</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SourceBreakdown({ data }: SourceBreakdownProps) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return <p className="text-xs text-muted-foreground text-center py-8">No analyses recorded yet.</p>;
  }

  if (data.length > 4) {
    return <BarList data={data} total={total} />;
  }

  const chartConfig = Object.fromEntries(
    data.map((d) => [d.source, { label: d.source, color: colorFor(d.source) }])
  ) satisfies ChartConfig;

  const chartData = data.map((d) => ({
    source: d.source,
    count: d.count,
    pct: Math.round((d.count / total) * 100),
    fill: colorFor(d.source),
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
          content={({ payload }) => <ChartLegendContent payload={payload} nameKey="source" />}
          verticalAlign="bottom"
        />
      </PieChart>
    </ChartContainer>
  );
}
