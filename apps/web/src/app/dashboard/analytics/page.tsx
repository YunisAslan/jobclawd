"use client";

import Link from "next/link";
import {
  Search, ScanSearch, Wand2, Layers, Bookmark,
  TrendingUp, BarChart2, Target, ArrowUpDown, ListOrdered,
  Globe, Sparkles,
} from "lucide-react";
import { useAnalytics } from "@/hooks/use-analytics";
import TopBar from "@/components/layout/TopBar";
import StatsCard from "@/components/dashboard/StatsCard";
import ActivityTrend from "@/components/dashboard/ActivityTrend";
import ScoreDistribution from "@/components/dashboard/ScoreDistribution";
import CVPerformanceAnalytics from "@/components/dashboard/CVPerformanceAnalytics";
import TopJobTitles from "@/components/dashboard/TopJobTitles";
import SourceBreakdown from "@/components/dashboard/SourceBreakdown";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/* ── Skeleton helpers ── */

function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-52 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Summary banner ── */

function SummaryBanner({
  totalAnalyses,
  avgScore,
  totalSuggestions,
}: {
  totalAnalyses: number;
  avgScore: number;
  totalSuggestions: number;
}) {
  let headline = "";
  if (totalAnalyses === 0) {
    headline = "Analyze your first CV against a job to unlock Career Insights.";
  } else if (avgScore >= 75) {
    headline = `Strong profile! Your average match score is ${avgScore}% across ${totalAnalyses} analyses.`;
  } else if (avgScore >= 50) {
    headline = `Solid start — ${avgScore}% avg match score across ${totalAnalyses} analyses. Keep refining.`;
  } else {
    headline = `${totalAnalyses} jobs analyzed. Focus on CV alignment to push your match scores higher.`;
  }

  return (
    <div className={cn(
      "rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3",
      avgScore >= 75
        ? "border-success/25 bg-success/5"
        : avgScore >= 50
          ? "border-primary/20 bg-primary/5"
          : "border-border/60 bg-muted/20",
    )}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
        <Sparkles className="size-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">{headline}</p>
        {totalAnalyses > 0 && totalSuggestions > 0 && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            You have applied{" "}
            <span className="font-semibold text-foreground">{totalSuggestions}</span>{" "}
            AI suggestions to your CV.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Check Impact card ── */

function CheckImpactCard({
  totalChecks,
  avgDelta,
}: {
  totalChecks: number;
  avgDelta: number;
}) {
  const isPositive = avgDelta > 0;
  const isNegative = avgDelta < 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl border",
          isPositive ? "bg-success/10 border-success/20" : isNegative ? "bg-destructive/10 border-destructive/20" : "bg-muted/40 border-border/40",
        )}>
          <ArrowUpDown className={cn(
            "size-5",
            isPositive ? "text-success" : isNegative ? "text-destructive" : "text-muted-foreground",
          )} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Avg score change</p>
          <p className={cn(
            "text-2xl font-bold tracking-tight",
            isPositive ? "text-success" : isNegative ? "text-destructive" : "text-muted-foreground",
          )}>
            {isPositive ? "+" : ""}{avgDelta.toFixed(1)} pts
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {totalChecks === 0
          ? "Run Check Impact after accepting suggestions to see your score change here."
          : `Based on ${totalChecks} Check Impact ${totalChecks === 1 ? "run" : "runs"}.`}
      </p>
    </div>
  );
}

/* ── Empty state ── */

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 border border-border/50">
          <BarChart2 className="size-7 text-muted-foreground/50" />
        </div>
        <div className="space-y-1 max-w-sm">
          <p className="text-sm font-semibold text-foreground">No data yet</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Open a vacancy, select your CV, and run an analysis to start building your career insights.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/feed">Browse job feed</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── Page ── */

export default function AnalyticsPage() {
  const { data, isLoading } = useAnalytics();

  const isEmpty = !isLoading && (data?.total_analyses ?? 0) === 0;

  return (
    <div>
      <TopBar title="Analytics" />
      <div className="p-6 space-y-6">

        {/* Summary banner */}
        {isLoading ? (
          <Skeleton className="h-18 w-full rounded-2xl" />
        ) : (
          <SummaryBanner
            totalAnalyses={data?.total_analyses ?? 0}
            avgScore={data?.avg_match_score ?? 0}
            totalSuggestions={data?.total_suggestions_applied ?? 0}
          />
        )}

        {isEmpty && <EmptyState />}

        {/* KPI cards */}
        {!isEmpty && (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="gap-0 py-5">
                  <CardContent className="px-5 space-y-3">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="size-9 rounded-lg" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <StatsCard
                  label="Total analyses"
                  value={data?.total_analyses ?? 0}
                  tone="primary"
                  icon={<ScanSearch className="size-5" />}
                />
                <StatsCard
                  label="Searched jobs"
                  value={data?.total_searched_jobs ?? 0}
                  tone="secondary"
                  icon={<Search className="size-5" />}
                />
                <StatsCard
                  label="Suggestions applied"
                  value={data?.total_suggestions_applied ?? 0}
                  tone="success"
                  icon={<Wand2 className="size-5" />}
                />
                <StatsCard
                  label="CVs compared"
                  value={data?.cvs_compared ?? 0}
                  tone="muted"
                  icon={<Layers className="size-5" />}
                />
                <StatsCard
                  label="Saved jobs"
                  value={data?.total_saved ?? 0}
                  tone="muted"
                  icon={<Bookmark className="size-5" />}
                />
                <StatsCard
                  label="Avg match score"
                  value={`${data?.avg_match_score ?? 0}%`}
                  tone="primary"
                  icon={<Target className="size-5" />}
                />
              </>
            )}
          </div>
        )}

        {/* Row 1: Activity Trend + Check Impact */}
        {!isEmpty && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {isLoading ? (
              <>
                <div className="xl:col-span-2"><CardSkeleton rows={3} /></div>
                <CardSkeleton rows={2} />
              </>
            ) : (
              <>
                <Card className="xl:col-span-2">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Activity Trend</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">
                      Daily CV analyses — last 30 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ActivityTrend data={data?.trend_30d ?? []} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Check Impact</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">
                      Average score change after applying suggestions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CheckImpactCard
                      totalChecks={data?.total_impact_checks ?? 0}
                      avgDelta={data?.avg_score_delta ?? 0}
                    />
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Row 2: Score Distribution + Source Breakdown */}
        {!isEmpty && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {isLoading ? (
              <>
                <CardSkeleton rows={3} />
                <CardSkeleton rows={3} />
              </>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Score Distribution</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">
                      How your CV scores across all analyzed jobs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScoreDistribution data={data?.score_distribution ?? []} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Source Breakdown</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">
                      Which job boards you analyze from most
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SourceBreakdown data={data?.source_breakdown ?? []} />
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Row 3: CV Performance + Top Job Titles */}
        {!isEmpty && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {isLoading ? (
              <>
                <CardSkeleton rows={3} />
                <CardSkeleton rows={4} />
              </>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">CV Performance</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">
                      Average match score per CV version
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CVPerformanceAnalytics data={data?.cv_performance ?? []} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Top Job Titles</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">
                      Roles you analyze most — your actual targets
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TopJobTitles data={data?.top_job_titles ?? []} />
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
