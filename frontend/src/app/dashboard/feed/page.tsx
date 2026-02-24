"use client";

import {
  Search,
  Sparkles,
  DollarSign,
  CalendarDays,
  ArrowUpDown,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import FeedJobCard from "@/components/feed/FeedJobCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  FEED_DATE_OPTIONS,
  FEED_EXPERIENCE_OPTIONS,
  FEED_JOBS_MOCK,
  FEED_LOCATION_OPTIONS,
  FEED_SORT_OPTIONS,
  FEED_SOURCE_OPTIONS,
  FEED_WORK_MODE_OPTIONS,
  FEED_JOB_TYPE_OPTIONS,
} from "@/lib/data";
import FeedResultSectionHeader from "@/components/feed/FeedResultSectionHeader";
import SelectBox from "@/components/SelectBox";

const noop = () => {};

export default function FeedPage() {
  const highMatch = FEED_JOBS_MOCK.filter((job) => job.match_level === "high");
  const needsReview = FEED_JOBS_MOCK.filter(
    (job) => job.match_level === "review",
  );

  return (
    <div>
      <TopBar title="Job Feed" />

      <div className="p-6 space-y-5">
        <Card className="py-0 shadow-sm border-border/60">
          <CardContent className="pt-5 pb-4 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Job title, skill, or company..."
                  className="pl-10 h-12 text-[15px]"
                />
              </div>
              <Button className="gap-2 px-6 h-12 shrink-0">
                <Sparkles className="size-4" />
                Search
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
              <SelectBox
                placeholder="Source"
                options={FEED_SOURCE_OPTIONS}
                mode="multiple"
              />
              <SelectBox
                placeholder="Work mode"
                options={FEED_WORK_MODE_OPTIONS}
                mode="multiple"
              />
              <SelectBox
                placeholder="Experience"
                options={FEED_EXPERIENCE_OPTIONS}
                mode="multiple"
              />
              <SelectBox
                placeholder="Location"
                options={FEED_LOCATION_OPTIONS}
              />

              <SelectBox
                icon={<CalendarDays className="size-4 text-muted-foreground" />}
                placeholder="Date posted"
                options={FEED_DATE_OPTIONS}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2 border-t border-border/60 pt-3.5">
              <div className="inline-flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs">
                <DollarSign className="size-4 text-muted-foreground shrink-0" />
                <Input
                  name="salary_min"
                  autoComplete="off"
                  placeholder="Minimum salary"
                  className="rounded-none h-5 w-full border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
                />
                <span className="text-sm text-muted-foreground">AZN</span>
              </div>

              <SelectBox
                placeholder="Job type"
                options={FEED_JOB_TYPE_OPTIONS}
                mode="multiple"
              />

              <SelectBox
                icon={
                  <ArrowUpDown className="size-3.5 text-muted-foreground" />
                }
                placeholder="Sort by"
                options={FEED_SORT_OPTIONS}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <section className="space-y-3">
            <FeedResultSectionHeader
              color="primary"
              label="High Match"
              count={highMatch.length}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {highMatch.map((job) => (
                <FeedJobCard
                  key={job.url}
                  job={job}
                  selected={false}
                  onToggleSelect={noop}
                  onApply={noop}
                  onSkip={noop}
                  onDetails={noop}
                  onHideCompany={noop}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <FeedResultSectionHeader
              color="warning"
              label="Needs Review"
              count={needsReview.length}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {needsReview.map((job) => (
                <FeedJobCard
                  key={job.url}
                  job={job}
                  selected={false}
                  onToggleSelect={noop}
                  onApply={noop}
                  onSkip={noop}
                  onDetails={noop}
                  onHideCompany={noop}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
