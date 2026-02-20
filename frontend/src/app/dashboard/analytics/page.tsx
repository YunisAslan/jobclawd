"use client";

import Link from "next/link";
import { Send, List, CircleCheck, TrendingUp } from "lucide-react";
import { useStats } from "@/hooks/use-stats";
import { StatsResponse } from "@/types";
import TopBar from "@/components/layout/TopBar";
import StatsCard from "@/components/dashboard/StatsCard";
import WeeklyChart from "@/components/dashboard/WeeklyChart";
import CVPerformanceTable from "@/components/dashboard/CVPerformanceTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";

const EMPTY_STATS: StatsResponse = {
  today_count: 0,
  total_sent: 0,
  total_replies: 0,
  weekly_chart: [],
  cv_performance: [],
};

const ICON_SEND  = <Send        className="size-5" />;
const ICON_LIST  = <List        className="size-5" />;
const ICON_CHECK = <CircleCheck className="size-5" />;
const ICON_CHART = <TrendingUp  className="size-5" />;

export default function AnalyticsPage() {
  const { data: stats = EMPTY_STATS, isLoading: loading } = useStats();

  return (
    <div>
      <TopBar title="Analytics" />
      <div className="p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {loading ? (
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
              <StatsCard label="Sent today" value={stats.today_count} tone="primary" icon={ICON_SEND} />
              <StatsCard label="Total applications" value={stats.total_sent} tone="secondary" icon={ICON_LIST} />
              <StatsCard label="Replies received" value={stats.total_replies} tone="success" icon={ICON_CHECK} />
              <StatsCard
                label="Reply rate"
                value={stats.total_sent > 0 ? `${Math.round((stats.total_replies / stats.total_sent) * 100)}%` : "0%"}
                tone="primary"
                icon={ICON_CHART}
              />
            </>
          )}
        </div>

        {/* Chart + CV table */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Last 7 days</CardTitle>
            </CardHeader>
            <CardContent>
              <WeeklyChart data={stats.weekly_chart} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">CV performance</CardTitle>
            </CardHeader>
            <CardContent>
              <CVPerformanceTable data={stats.cv_performance} />
            </CardContent>
          </Card>
        </div>

        {stats.total_sent === 0 && !loading && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <p className="text-muted-foreground text-sm">
                You haven&apos;t sent any applications yet.
              </p>
              <Button asChild>
                <Link href="/dashboard/feed">Browse job feed</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
