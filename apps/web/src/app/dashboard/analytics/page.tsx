"use client";

import Link from "next/link";
import {
  Send, MessageSquare, TrendingUp, Percent,
  BarChart2, GitFork, Layers, Sparkles,
} from "lucide-react";
import { useAnalytics } from "@/hooks/use-analytics";
import TopBar from "@/components/layout/TopBar";
import StatsCard from "@/components/dashboard/StatsCard";
import ApplicationFunnel from "@/components/dashboard/ApplicationFunnel";
import CVComparison from "@/components/dashboard/CVComparison";
import MatchScoreImpact from "@/components/dashboard/MatchScoreImpact";
import ActivityTrend from "@/components/dashboard/ActivityTrend";
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
            <Skeleton className="h-2.5 w-full rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Summary banner ── */

function SummaryBanner({
  total, replies, replyRate, bestCv, bestRate,
}: {
  total: number;
  replies: number;
  replyRate: number;
  bestCv: string | null;
  bestRate: number | null;
}) {
  let headline = "";
  if (total === 0) {
    headline = "Apply to your first 5 jobs to unlock your Career Insights.";
  } else if (replyRate >= 25) {
    headline = `Outstanding! A ${replyRate}% reply rate puts you well ahead of most applicants.`;
  } else if (replyRate >= 10) {
    headline = `You have a ${replyRate}% reply rate across ${total} applications — solid progress.`;
  } else {
    headline = `You've applied to ${total} jobs. Focus on stronger CV alignment to boost replies.`;
  }

  return (
    <div className={cn(
      "rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3",
      replyRate >= 25
        ? "border-success/25 bg-success/5"
        : replyRate >= 10
          ? "border-primary/20 bg-primary/5"
          : "border-border/60 bg-muted/20",
    )}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
        <Sparkles className="size-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">{headline}</p>
        {bestCv && bestRate !== null && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Your best CV is <span className="font-semibold text-foreground">{bestCv}</span> with a{" "}
            <span className="font-semibold text-success">{bestRate}%</span> reply rate.
          </p>
        )}
      </div>
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
            Apply to your first 5 jobs to unlock your Career Insights — funnel analytics,
            CV comparison, and match score impact.
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

  const isEmpty = !isLoading && (data?.total_applied ?? 0) === 0;

  return (
    <div>
      <TopBar title="Analytics" />
      <div className="p-6 space-y-6">

        {/* Summary banner */}
        {isLoading ? (
          <Skeleton className="h-18 w-full rounded-2xl" />
        ) : (
          <SummaryBanner
            total={data?.total_applied ?? 0}
            replies={data?.total_replies ?? 0}
            replyRate={data?.reply_rate ?? 0}
            bestCv={data?.best_cv_name ?? null}
            bestRate={data?.best_cv_reply_rate ?? null}
          />
        )}

        {isEmpty && <EmptyState />}

        {/* KPI cards */}
        {!isEmpty && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
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
                  label="Total applied"
                  value={data?.total_applied ?? 0}
                  tone="primary"
                  icon={<Send className="size-5" />}
                />
                <StatsCard
                  label="Replies received"
                  value={data?.total_replies ?? 0}
                  tone="success"
                  icon={<MessageSquare className="size-5" />}
                />
                <StatsCard
                  label="Reply rate"
                  value={`${data?.reply_rate ?? 0}%`}
                  tone="secondary"
                  icon={<Percent className="size-5" />}
                />
                <StatsCard
                  label="CVs compared"
                  value={data?.cv_performance.length ?? 0}
                  tone="muted"
                  icon={<Layers className="size-5" />}
                />
              </>
            )}
          </div>
        )}

        {/* Row 1: Funnel + Activity Trend */}
        {!isEmpty && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {isLoading ? (
              <>
                <CardSkeleton rows={4} />
                <CardSkeleton rows={3} />
              </>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <GitFork className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Application Funnel</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">
                      Conversion at each stage of your job search
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ApplicationFunnel data={data?.funnel ?? []} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">Activity Trend</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">
                      Daily application velocity — last 30 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ActivityTrend data={data?.trend_30d ?? []} />
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Row 2: CV A/B + Match Score Impact */}
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
                      <Layers className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">CV A/B Comparison</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">
                      Reply rates across your CV versions — find the winner
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CVComparison data={data?.cv_performance ?? []} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">AI Match Score Impact</CardTitle>
                    </div>
                    <CardDescription className="text-[11px]">
                      How your AI match score correlates with actual replies
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MatchScoreImpact data={data?.match_bands ?? []} />
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
