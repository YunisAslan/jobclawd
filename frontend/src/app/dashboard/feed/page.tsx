"use client";

import {
  Search,
  Sparkles,
  Briefcase,
  GraduationCap,
  Monitor,
  Ban,
  LayoutGrid,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import FeedJobCard from "@/components/feed/FeedJobCard";
import JobDetailDrawer from "@/components/feed/JobDetailDrawer";
import BulkActionBar from "@/components/feed/BulkActionBar";
import SkeletonCard from "@/components/ui/SkeletonCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { useFeed, ALL_SOURCES } from "@/hooks/use-feed";
import { useProfile } from "@/contexts/ProfileContext";
import { cn } from "@/lib/utils";

const EXP_LABELS: Record<string, string> = {
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead / Manager",
};

const WORK_MODE_LABELS: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

function ActiveContextBar() {
  const { profile } = useProfile();
  const selectedCV = profile.cv_links[0]?.name;
  const workModeText = profile.work_modes.map((m) => WORK_MODE_LABELS[m] || m).join(", ");

  return (
    <div className="flex items-center gap-2 flex-wrap pt-3.5 border-t border-border/60">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
        Scoring context:
      </span>

      {/* CV chip */}
      <Badge
        variant="outline"
        className="gap-1.5 py-0.5 px-2.5 text-[11px] font-medium bg-primary/5 border-primary/20 text-primary hover:bg-primary/5"
      >
        <Briefcase className="size-3 shrink-0" />
        {selectedCV ?? "No CV selected"}
      </Badge>

      {/* Experience chip */}
      <Badge
        variant="outline"
        className="gap-1.5 py-0.5 px-2.5 text-[11px] font-medium bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/5"
      >
        <GraduationCap className="size-3 shrink-0" />
        {EXP_LABELS[profile.experience_level] ?? profile.experience_level}
      </Badge>

      {/* Work mode chip */}
      <Badge
        variant="outline"
        className="gap-1.5 py-0.5 px-2.5 text-[11px] font-medium hover:bg-background"
      >
        <Monitor className="size-3 shrink-0" />
        {workModeText || "Any mode"}
      </Badge>

      {/* Blacklist chip */}
      {profile.blacklist.length > 0 && (
        <Badge
          variant="outline"
          className="gap-1.5 py-0.5 px-2.5 text-[11px] font-medium bg-destructive/5 border-destructive/20 text-destructive hover:bg-destructive/5"
        >
          <Ban className="size-3 shrink-0" />
          {profile.blacklist.length} blocked
        </Badge>
      )}
    </div>
  );
}

function SectionHeader({
  color,
  label,
  count,
}: {
  color: "primary" | "warning";
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "size-2 rounded-full shrink-0",
          color === "primary" ? "bg-match-high" : "bg-match-review"
        )}
      />
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      <Badge
        className={cn(
          "text-xs h-5 px-1.5 hover:bg-inherit",
          color === "primary"
            ? "bg-match-high/10 text-match-high border-match-high/20"
            : "bg-match-review/10 text-match-review border-match-review/20"
        )}
      >
        {count}
      </Badge>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {icon && (
        <div className="text-muted-foreground/40">{icon}</div>
      )}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}

export default function FeedPage() {
  const {
    query,
    setQuery,
    sources,
    loading,
    error,
    selected,
    drawerJob,
    setDrawerJob,
    bulkApplying,
    handleSearch,
    toggleSource,
    toggleSelect,
    handleSkip,
    handleApplied,
    handleBulkApply,
    clearSelected,
    visible,
    highMatch,
    needsReview,
    hasScoring,
    allVisible,
    jobs,
  } = useFeed();

  const hasResults = !loading && visible.length > 0;
  const allSkipped = !loading && jobs.length > 0 && visible.length === 0;
  const noResults = !loading && jobs.length === 0 && !!query.trim();
  const isInitial = !loading && jobs.length === 0 && !query.trim();

  return (
    <div>
      <TopBar title="Job Feed" />
      <div className="p-6 space-y-5">

        {/* ── Smart Search & Configuration Hub ── */}
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-4 space-y-4">

            {/* Search row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="e.g. Frontend Developer, Product Manager, UX Designer..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="gap-2 px-5 shrink-0"
              >
                {loading ? (
                  <>
                    <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Search
                  </>
                )}
              </Button>
            </div>

            {/* Source toggle pills */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground shrink-0">Sources:</span>
              <div className="flex gap-1.5 flex-wrap">
                {ALL_SOURCES.map((s) => (
                  <Button
                    key={s.value}
                    size="sm"
                    variant={sources.includes(s.value) ? "default" : "outline"}
                    onClick={() => toggleSource(s.value)}
                    className={cn(
                      "h-7 px-3 text-xs rounded-full transition-all",
                      !sources.includes(s.value) && "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Active Context Bar */}
            <ActiveContextBar />
          </CardContent>
        </Card>

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-center gap-3 text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
            <span className="shrink-0">⚠</span>
            {error}
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* ── Results ── */}
        {hasResults && (
          <div className="space-y-6">
            {hasScoring ? (
              <>
                {highMatch.length > 0 && (
                  <section className="space-y-3">
                    <SectionHeader color="primary" label="High Match" count={highMatch.length} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {highMatch.map((job) => (
                        <FeedJobCard
                          key={job.url}
                          job={job}
                          selected={selected.has(job.url)}
                          onToggleSelect={() => toggleSelect(job.url)}
                          onApply={() => setDrawerJob(job)}
                          onSkip={() => handleSkip(job.url)}
                          onDetails={() => setDrawerJob(job)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {needsReview.length > 0 && (
                  <section className="space-y-3">
                    <SectionHeader color="warning" label="Needs Review" count={needsReview.length} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {needsReview.map((job) => (
                        <FeedJobCard
                          key={job.url}
                          job={job}
                          selected={selected.has(job.url)}
                          onToggleSelect={() => toggleSelect(job.url)}
                          onApply={() => setDrawerJob(job)}
                          onSkip={() => handleSkip(job.url)}
                          onDetails={() => setDrawerJob(job)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {highMatch.length === 0 && needsReview.length === 0 && (
                  <EmptyState
                    icon={<LayoutGrid className="size-8" />}
                    title="No matching jobs found"
                    description="Try adjusting your profile preferences or search with a different query."
                  />
                )}
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allVisible.map((job) => (
                  <FeedJobCard
                    key={job.url}
                    job={job}
                    selected={selected.has(job.url)}
                    onToggleSelect={() => toggleSelect(job.url)}
                    onApply={() => setDrawerJob(job)}
                    onSkip={() => handleSkip(job.url)}
                    onDetails={() => setDrawerJob(job)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Empty states ── */}
        {allSkipped && (
          <EmptyState
            title="All jobs have been skipped"
            description="Search again with a different query to find more opportunities."
          />
        )}

        {noResults && (
          <EmptyState
            icon={<Search className="size-8" />}
            title={`No results found for "${query}"`}
            description="Try a different job title or check your source selections above."
          />
        )}

        {/* ── Initial / hero state ── */}
        {isInitial && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Search className="size-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Start your job search</p>
              <p className="text-sm text-muted-foreground mt-1">
                Enter a job title above — we&apos;ll score results against your profile automatically.
              </p>
            </div>
          </div>
        )}
      </div>

      <JobDetailDrawer
        job={drawerJob}
        onClose={() => setDrawerJob(null)}
        onApplied={handleApplied}
      />
      <BulkActionBar
        count={selected.size}
        onApplyAll={handleBulkApply}
        onClear={clearSelected}
        applying={bulkApplying}
      />
    </div>
  );
}
