"use client";

import { JobListing, JobSource } from "@/types";
import FeedJobCard from "@/components/feed/FeedJobCard";
import FeedResultSectionHeader from "@/components/feed/FeedResultSectionHeader";
import {
  Compass,
  Inbox,
  MapPin,
  GraduationCap,
  Monitor,
  SlidersHorizontal,
  Zap,
  Clock,
  AlertTriangle,
  Info,
  RefreshCw,
  Check,
  Sparkles,
} from "lucide-react";
import FeedLoadingProgress from "@/components/feed/FeedLoadingProgress";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { FEED_STALE_TIME } from "@/hooks/use-feed";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip";
import { SearchProgress } from "@/services/jobs.service";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

interface FeedResultsProps {
  highMatch: JobListing[];
  needsReview: JobListing[];
  loading?: boolean;
  progress?: SearchProgress | null;
  hasSearched?: boolean;
  flash?: boolean;
  activeFilterCount?: number;
  creditsLeft?: number;
  maxCredits?: number;
  outOfCredits?: boolean;
  dataUpdatedAt?: number;
  onRefresh?: () => void;
  savedUrls: Set<string>;
  onToggleSave: (job: JobListing) => void;
  savePending?: string | null;
  onDetails: (job: JobListing) => void;
  onHideCompany?: (company: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreError?: string | null;
  onLoadMore?: () => void;
  totalAll?: number;
  // Live streaming progress
  selectedSources?: JobSource[];
  completedSources?: Set<string>;
  searchStartedAt?: number | null;
  allJobs?: JobListing[];
}


// Pretty labels for source chips — falls back to upper-cased source key.
const SOURCE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  ziprecruiter: "ZipRecruiter",
  remoteok: "RemoteOK",
  simplify: "Simplify",
  dice: "Dice",
  jobgether: "Jobicy",
  weworkremotely: "WWR",
  jobsearch: "Jobsearch",
  remotive: "Remotive",
};

function useElapsedSeconds(startedAt: number | null | undefined, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running || !startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running, startedAt]);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/**
 * Rich live-search panel shown while scrapers are streaming in.
 * Replaces the older single-line StreamingNotice — keeps the user engaged with
 * concrete per-source progress, an animated progress bar, and an elapsed clock.
 */
function LiveSearchPanel({
  selectedSources,
  completedSources,
  jobs,
  totalVisible,
  searchStartedAt,
  progress,
}: {
  selectedSources: JobSource[];
  completedSources: Set<string>;
  jobs: JobListing[];
  totalVisible: number;
  searchStartedAt: number | null | undefined;
  progress?: SearchProgress | null;
}) {
  const elapsedSec = useElapsedSeconds(searchStartedAt, true);
  const elapsedLabel = elapsedSec < 60
    ? `${elapsedSec}s`
    : `${Math.floor(elapsedSec / 60)}m ${(elapsedSec % 60).toString().padStart(2, "0")}s`;

  // Job count per source — derived from the live jobs array so it updates
  // automatically as new partials stream in.
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const j of jobs) {
      const s = String(j.source);
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [jobs]);

  const totalSelected = selectedSources.length || 1;
  const completedCount = completedSources.size;
  const pct = Math.min(100, Math.round((completedCount / totalSelected) * 100));

  // Show completed chips first, then pending — easier to scan progress.
  const orderedSources = useMemo(() => {
    const done: JobSource[] = [];
    const pending: JobSource[] = [];
    for (const src of selectedSources) {
      if (completedSources.has(String(src))) done.push(src);
      else pending.push(src);
    }
    return [...done, ...pending];
  }, [selectedSources, completedSources]);

  const stageDetail = progress?.message;

  return (
    <div className="rounded-xl border border-primary/20 bg-linear-to-br from-primary/6 via-primary/4 to-transparent p-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inset-0 rounded-full bg-primary/60 animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <span className="text-sm font-medium text-foreground">Live search</span>
          <span className="text-muted-foreground/60 text-sm">·</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            <span className="font-medium text-foreground">{totalVisible}</span> job{totalVisible !== 1 ? "s" : ""} from{" "}
            <span className="font-medium text-foreground">{completedCount}</span> of {totalSelected} source{totalSelected !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3 text-primary/70" />
          <span className="tabular-nums">{elapsedLabel}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-1 w-full bg-primary/10 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={totalSelected}
        aria-label="Search progress"
      >
        <div
          className="h-full bg-linear-to-r from-primary/80 to-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Source chips */}
      <div className="flex flex-wrap gap-1.5">
        {orderedSources.map((src) => {
          const key = String(src);
          const done = completedSources.has(key);
          const count = sourceCounts[key] ?? 0;
          const label = SOURCE_LABELS[key] ?? key;
          return (
            <span
              key={key}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border transition-all duration-300",
                done
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/40 bg-muted/30 text-muted-foreground/55",
              )}
            >
              {done ? (
                <Check className="size-2.5" />
              ) : (
                <RefreshCw className="size-2.5 animate-spin opacity-50" style={{ animationDuration: "2s" }} />
              )}
              <span>{label}</span>
              {done && count > 0 && (
                <span className="opacity-70 tabular-nums">· {count}</span>
              )}
            </span>
          );
        })}
      </div>

      {stageDetail && (
        <p className="text-[11px] text-muted-foreground/80 italic">{stageDetail}</p>
      )}
    </div>
  );
}

function useCacheCountdown(dataUpdatedAt?: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!dataUpdatedAt) return;
    setNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect -- sync reset on new data
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [dataUpdatedAt]);

  if (!dataUpdatedAt) return null;
  const remaining = Math.max(0, FEED_STALE_TIME - (now - dataUpdatedAt));
  if (remaining <= 0) return null;
  const totalSecs = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

/**
 * Compact "still searching…" strip rendered at the BOTTOM of the visible cards
 * while scrapers are still streaming in but pagination isn't yet available.
 * The top LiveSearchPanel can scroll out of view on long result lists — this
 * keeps the user oriented at the end of what they're reading.
 */
function BottomStreamingIndicator({
  selectedSources,
  completedSources,
}: {
  selectedSources: JobSource[];
  completedSources: Set<string>;
}) {
  const pending = selectedSources.filter((s) => !completedSources.has(String(s)));
  if (pending.length === 0) return null;

  const completedCount = completedSources.size;
  const totalCount = selectedSources.length;
  const previewNames = pending
    .slice(0, 3)
    .map((s) => SOURCE_LABELS[String(s)] ?? String(s));
  const moreCount = pending.length - previewNames.length;
  const waitingList =
    moreCount > 0
      ? `${previewNames.join(", ")} and ${moreCount} more`
      : previewNames.join(", ");

  return (
    <div className="border-t border-border/40 pt-4 pb-1 mt-2">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
          {/* Live "ping" dot — more attention-grabbing than a static spinner */}
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inset-0 rounded-full bg-primary/60 animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <span>
            Streaming results from{" "}
            <span className="text-foreground">{pending.length}</span> more source{pending.length !== 1 ? "s" : ""}
            <span className="text-muted-foreground/70">
              {" "}· {completedCount} of {totalCount} done
            </span>
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          Waiting on: {waitingList}
        </p>
        {/* Slim progress bar to mirror the top panel */}
        <div
          className="h-0.5 w-full max-w-xs bg-primary/10 rounded-full overflow-hidden mt-1"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
        >
          <div
            className="h-full bg-primary/70 transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(100, (completedCount / totalCount) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Shimmering placeholder cards rendered just below the bottom streaming
 * indicator. Telegraphs "more cards will land here, don't bother scrolling"
 * during the phase when load-more isn't yet wired up (cache_key only becomes
 * valid after the search completes). Grid layout matches the real FeedJobCard
 * grid so the visual transition feels seamless when real cards arrive.
 */
function StreamingSkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pointer-events-none select-none"
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 border border-border/30 rounded-2xl space-y-3 bg-card/30"
        >
          {/* Header: logo square + title lines */}
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-lg bg-muted-foreground/15 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div
                className="h-3 rounded bg-muted-foreground/25 animate-pulse"
                style={{ width: `${55 + ((i * 11) % 30)}%` }}
              />
              <div
                className="h-2.5 rounded bg-muted-foreground/15 animate-pulse"
                style={{ width: `${30 + ((i * 7) % 25)}%` }}
              />
            </div>
          </div>
          {/* Tag chips row */}
          <div className="flex gap-1.5 pt-1">
            <div className="h-5 w-14 rounded-full bg-muted-foreground/15 animate-pulse" />
            <div className="h-5 w-20 rounded-full bg-muted-foreground/15 animate-pulse" />
            <div className="h-5 w-12 rounded-full bg-muted-foreground/10 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CreditsExhaustedBanner({ maxCredits }: { maxCredits: number }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-in fade-in slide-in-from-top-1 duration-300">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span>You&apos;ve used all {maxCredits} searches. Cached results are still available.</span>
    </div>
  );
}

function CacheTimer({
  countdown,
  onRefresh,
  loading,
}: {
  countdown: string;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {onRefresh && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="h-auto gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
              Refresh · 1 credit
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Fetch fresh results now. This will use 1 search credit.
          </TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary/80 border border-primary/15 cursor-help">
            <Clock className="size-3" />
            Cached · refreshes in {countdown}
            <Info className="size-3 opacity-60" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          These results are cached. Fresh data will be fetched after the timer expires.
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

export default function FeedResults({
  highMatch,
  needsReview,
  loading,
  progress,
  hasSearched,
  flash,
  activeFilterCount = 0,
  creditsLeft = 10,
  maxCredits = 10,
  outOfCredits = false,
  dataUpdatedAt,
  onRefresh,
  savedUrls,
  onToggleSave,
  savePending,
  onDetails,
  onHideCompany,
  hasMore = false,
  loadingMore = false,
  loadMoreError = null,
  onLoadMore,
  totalAll = 0,
  selectedSources = [],
  completedSources,
  searchStartedAt,
  allJobs = [],
}: FeedResultsProps) {
  const sentinelRef = useInfiniteScroll({
    hasMore,
    // Block the observer while ANY load is in flight (initial search or page
    // fetch). Without `loading`, scrolling during streaming would fire the
    // sentinel and call loadMore() — which silently bails on `!cacheKey`.
    loading: loadingMore || !!loading,
    onLoadMore: onLoadMore ?? (() => {}),
    rootMargin: "600px",
    enabled: !!onLoadMore && !loading,
  });
  const cacheCountdown = useCacheCountdown(dataUpdatedAt);
  const totalVisible = highMatch.length + needsReview.length;

  if (!hasSearched && !loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in zoom-in duration-300">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Compass className="size-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-1">Ready to explore</h3>
        <p className="max-w-sm text-sm mb-5">
          Enter a role or skill, then refine with filters.{" "}
          <span className="text-muted-foreground/60">
            More specific inputs → more relevant matches.
          </span>
        </p>

        <div className="flex flex-col gap-2.5 text-left max-w-xs w-full">
          <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
            Tips for better results
          </p>
          {[
            {
              icon: MapPin,
              tip: "Add a location to get region-specific listings",
            },
            {
              icon: GraduationCap,
              tip: "Set experience level to filter out mismatched seniority",
            },
            {
              icon: Monitor,
              tip: "Pick a work mode — remote, hybrid, or on-site",
            },
          ].map(({ icon: Icon, tip }) => (
            <div key={tip} className="flex items-start gap-2.5 text-xs text-muted-foreground/70">
              <Icon className="size-3.5 shrink-0 mt-0.5 text-muted-foreground/40" />
              {tip}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading && totalVisible === 0) {
    return <FeedLoadingProgress progress={progress} />;
  }

  if (highMatch.length === 0 && needsReview.length === 0) {
    return (
      <div className="space-y-3">
        {outOfCredits && <CreditsExhaustedBanner maxCredits={maxCredits} />}
        <div className="flex items-center justify-between pb-2.5 border-b border-border/40">
          <span className="text-xs text-muted-foreground">No matches found</span>
          <div className="flex items-center gap-2">
            {cacheCountdown && (
              <CacheTimer countdown={cacheCountdown} onRefresh={onRefresh} loading={loading} />
            )}
          </div>
        </div>
        <div
          className={cn(
            "py-24 flex flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in zoom-in rounded-xl transition-colors duration-500",
            flash && "bg-muted/40",
          )}
        >
          <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Inbox className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">No matches found</h3>
          <p className="max-w-xs text-sm">
            Try adjusting your search criteria or removing some filters to see more results.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-6 rounded-xl transition-colors duration-500", flash && "bg-muted/40")}
    >
      {outOfCredits && <CreditsExhaustedBanner maxCredits={maxCredits} />}
      {loading && totalVisible > 0 && (
        selectedSources.length > 0 && completedSources ? (
          <LiveSearchPanel
            selectedSources={selectedSources}
            completedSources={completedSources}
            jobs={allJobs.length ? allJobs : [...highMatch, ...needsReview]}
            totalVisible={totalVisible}
            searchStartedAt={searchStartedAt}
            progress={progress}
          />
        ) : (
          // Fallback for cases where source metadata isn't available
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-primary/8 border border-primary/15 text-xs text-primary/90 animate-in fade-in slide-in-from-top-1 duration-300">
            <RefreshCw className="size-3.5 shrink-0 animate-spin" />
            <span>
              Showing {totalVisible} result{totalVisible !== 1 ? "s" : ""} so far. {progress?.message || "Collecting more results from the remaining sources…"}
            </span>
          </div>
        )
      )}
      <div className="flex flex-wrap items-center justify-between gap-y-1.5 border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {hasMore && totalAll > 0
              ? `${totalVisible} of ${totalAll} position${totalAll !== 1 ? "s" : ""} loaded`
              : `${totalVisible} position${totalVisible !== 1 ? "s" : ""} found`}
          </span>
          {activeFilterCount > 0 && (
            <span className="flex items-center gap-1.5 text-primary/80">
              <SlidersHorizontal className="size-3" />
              {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cacheCountdown && (
            <CacheTimer countdown={cacheCountdown} onRefresh={onRefresh} loading={loading} />
          )}
        </div>
      </div>

      {[
        { jobs: highMatch, color: "primary" as const, label: "High Match" },
        { jobs: needsReview, color: "warning" as const, label: "Needs Review" },
      ].map(
        ({ jobs: sectionJobs, color, label }, sectionIdx) =>
          sectionJobs.length > 0 && (
            <section key={label} className="space-y-3">
              <FeedResultSectionHeader color={color} label={label} count={sectionJobs.length} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sectionJobs.map((job, idx) => {
                  const isFirstCard = idx === 0 && (sectionIdx === 0 || highMatch.length === 0);
                  return (
                    <div key={job.url} {...(isFirstCard ? { "data-tour": "first-job-card" } : {})}>
                      <FeedJobCard
                        job={job}
                        saved={savedUrls.has(job.url)}
                        onToggleSave={() => onToggleSave(job)}
                        savePending={savePending === job.url}
                        onDetails={() => onDetails(job)}
                        onHideCompany={(c) => onHideCompany?.(c)}
                        {...(isFirstCard ? { detailsTourTarget: "view-details-btn" } : {})}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ),
      )}

      {/* Bottom streaming indicator + skeleton placeholder cards — shown
          WHENEVER the search is still streaming, regardless of has_more.
          Preview responses can include has_more=true once >30 jobs are
          collected, which would otherwise let the "Load more" button render
          during streaming. We gate both bottom blocks on `loading` so they're
          mutually exclusive by phase, not by leaky backend state. */}
      {loading && totalVisible > 0 && completedSources && selectedSources.length > 0 && (
        <>
          <BottomStreamingIndicator
            selectedSources={selectedSources}
            completedSources={completedSources}
          />
          <StreamingSkeletonRow count={4} />
        </>
      )}

      {/* Pagination UI — only renders AFTER the search completes (loading=false).
          This prevents the misleading "Load more" button (which can't actually
          load anything until cache_key is populated by the final response) from
          appearing during the streaming phase. */}
      {!loading && (hasMore || loadingMore) && (
        <>
          {/* Auto-load trigger — IntersectionObserver fires onLoadMore as this
              element scrolls into view (or within rootMargin px of it). */}
          <div ref={sentinelRef} aria-hidden className="h-px w-full" />

          <div className="flex flex-col items-center gap-2 pt-2 pb-1">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="size-3.5 animate-spin" />
                Loading more jobs…
              </div>
            ) : loadMoreError ? (
              // Surface load-more failures with a retry affordance — clicking
              // the button always feeling "dead" was a real complaint.
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="size-3.5" />
                  <span>{loadMoreError}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLoadMore}
                  disabled={!hasMore}
                  className="gap-2 text-xs h-7"
                >
                  <RefreshCw className="size-3" />
                  Retry
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadMore}
                disabled={!hasMore}
                className="gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Load more jobs
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
