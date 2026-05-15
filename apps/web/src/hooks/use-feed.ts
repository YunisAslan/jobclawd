import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jobsService, SearchProgress } from "@/services/jobs.service";
import { JobListing, JobSource, LocationValue } from "@/types";
import { useProfile } from "@/contexts/ProfileContext";
import { extractApiError } from "@/lib/utils";
import { FeedFilterValues } from "@/validations/feed";
import { useTour } from "@/contexts/TourContext";

/** Cache timing constants — shared with FeedResults countdown */
export const FEED_STALE_TIME = 24 * 60 * 60 * 1000;
export const FEED_GC_TIME = 25 * 60 * 60 * 1000;

/** Default source set when the user hasn't picked any in filters. */
export const DEFAULT_SOURCES: JobSource[] = [
  "linkedin",
  "indeed",
  "glassdoor",
  "ziprecruiter",
  "remoteok",
  "simplify",
  "dice",
  "jobgether",
  "weworkremotely",
  "jobsearch",
];

/**
 * Build a stable React Query key from feed filters.
 * Arrays are sorted so ["az","tr"] and ["tr","az"] produce identical keys.
 */
function buildQueryKey(filters: Partial<FeedFilterValues>) {
  return [
    "feed",
    (filters.query ?? "").trim().toLowerCase(),
    [...(filters.sources ?? [])].sort(),
    [...(filters.workModes ?? [])].sort(),
    [...(filters.experience ?? [])].sort(),
    [...(filters.jobTypes ?? [])].sort(),
    filters.datePosted ?? "",
    filters.salaryMin ?? "",
    filters.sortBy ?? "",
    filters.location ?? null,
  ];
}

const CREDITS_KEY = ["credits"];

export function useFeed(filters: Partial<FeedFilterValues>) {
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const { active: tourActive, demoMode } = useTour();
  const isDemo = tourActive && demoMode;
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [panelJob, setPanelJob] = useState<JobListing | null>(null);
  const forceRefreshRef = useRef(false);
  const [progress, setProgress] = useState<SearchProgress | null>(null);

  // Pagination
  const [extraJobs, setExtraJobs] = useState<JobListing[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cacheKey, setCacheKey] = useState<string | null>(null);
  const [nextPage, setNextPage] = useState(2);
  const [loadingMore, setLoadingMore] = useState(false);

  // Streaming progress (per-source completion)
  const [completedSources, setCompletedSources] = useState<Set<string>>(new Set());
  const [searchStartedAt, setSearchStartedAt] = useState<number | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // Resolve the effective source list (used both for the request and the UI panel)
  const selectedSources = useMemo(
    () => ((filters.sources?.length ? filters.sources : DEFAULT_SOURCES) as JobSource[]),
    [filters.sources],
  );

  const normalizedSalaryMin = (() => {
    const raw = filters.salaryMin?.replace(/,/g, "");
    if (!raw) return undefined;
    const n = parseInt(raw, 10);
    if (isNaN(n)) return raw;
    if (filters.salaryPeriod === "monthly") return String(n * 12);
    if (filters.salaryPeriod === "hourly") return String(n * 2080);
    return raw;
  })();

  const hasQuery = !!filters.query?.trim();

  // Separate cache key for demo (tour) vs real searches so they never collide
  const feedQueryKey = useMemo(
    () => [...buildQueryKey(filters), isDemo ? "__demo__" : "__live__"],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(buildQueryKey(filters)), isDemo],
  );

  // Fetch credits from API
  const { data: creditsData } = useQuery({
    queryKey: CREDITS_KEY,
    queryFn: () => jobsService.getCredits(),
    staleTime: 30_000,
    retry: false,
  });

  const creditsLeft = creditsData?.credits ?? 10;
  const maxCredits = creditsData?.max_credits ?? 10;
  const outOfCredits = creditsLeft <= 0;

  const { data, isLoading, isFetching, isFetched, error, dataUpdatedAt } = useQuery({
    queryKey: feedQueryKey,
    queryFn: async () => {
      const shouldForce = forceRefreshRef.current;
      forceRefreshRef.current = false;
      setProgress(null);
      setCompletedSources(new Set());
      setSearchStartedAt(Date.now());

      try {
        const result = await jobsService.searchStream(
          filters.query ?? "",
          selectedSources,
          (filters.location as LocationValue) ?? undefined,
          {
            workModes: filters.workModes,
            experience: filters.experience,
            jobTypes: filters.jobTypes,
            datePosted: filters.datePosted,
            salaryMin: normalizedSalaryMin,
            sortBy: filters.sortBy,
          },
          shouldForce,
          (p) => setProgress(p),
          // onPartial: stream jobs into the React Query cache as each scraper
          // finishes, and track per-source completion so the live progress
          // panel can light up chips as each scraper returns. Final `done`
          // event overwrites with the complete response (cache_key, has_more,
          // total_all set).
          (partial, source) => {
            queryClient.setQueryData(feedQueryKey, (prev: typeof partial | undefined) => ({
              ...partial,
              cache_key: partial.cache_key ?? prev?.cache_key,
              has_more: partial.has_more ?? prev?.has_more ?? false,
              total_all: partial.total_all ?? prev?.total_all ?? partial.total ?? 0,
            }));
            if (source) {
              setCompletedSources((prev) => {
                if (prev.has(source)) return prev;
                const next = new Set(prev);
                next.add(source);
                return next;
              });
            }
          },
          isDemo,
        );
        // Refetch credits after search (backend deducts on cache miss)
        queryClient.invalidateQueries({ queryKey: CREDITS_KEY });
        return result;
      } finally {
        setProgress(null);
      }
    },

    enabled: hasQuery,
    staleTime: FEED_STALE_TIME,
    gcTime: FEED_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const prevKeyRef = useRef<string>("");
  const currentKey = JSON.stringify(feedQueryKey);
  useEffect(() => {
    if (prevKeyRef.current && prevKeyRef.current !== currentKey) {
      setSkipped(new Set());
      setExtraJobs([]);
      setHasMore(false);
      setCacheKey(null);
      setNextPage(2);
      setCompletedSources(new Set());
      setSearchStartedAt(null);
      setLoadMoreError(null);
    }
    prevKeyRef.current = currentKey;
  }, [currentKey]);

  // Sync pagination state from the initial search response
  useEffect(() => {
    if (data) {
      setHasMore(data.has_more ?? false);
      setCacheKey(data.cache_key ?? null);
      setExtraJobs([]);
      setNextPage(2);
    }
  }, [data]);

  const loadMore = useCallback(async () => {
    // Hard guard: nothing to load.
    if (!cacheKey || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await jobsService.loadPage(cacheKey, nextPage, filters.sortBy);
      setExtraJobs((prev) => [...prev, ...result.jobs]);
      setNextPage((p) => p + 1);
      setHasMore(result.has_more ?? false);
    } catch (err) {
      // Surface the error so the UI can show a retry affordance instead of
      // appearing dead. The most common cause is the 24h cache expiring —
      // backend returns 404 and the user needs to run a fresh search.
      const msg = extractApiError(err, "Couldn't load more results. Tap to retry.");
      setLoadMoreError(msg);
    } finally {
      setLoadingMore(false);
    }
  }, [cacheKey, loadingMore, hasMore, nextPage, filters.sortBy]);

  const handleSkip = (url: string) => {
    setSkipped((prev) => new Set([...prev, url]));
  };

  const realJobs = [...(data?.jobs ?? []), ...extraJobs];

  // ── DEV: inject a dummy vacancy so CV workspace can be tested without a real search ──
  const jobs: JobListing[] =
    realJobs.length === 0 && !hasQuery && process.env.NODE_ENV === "development"
      ? [
          {
            title: "Senior Frontend Developer (React / Next.js)",
            company: "Acme Corp",
            url: "https://example.com/jobs/acme-senior-frontend-dev",
            date_posted: new Date().toISOString(),
            source: "linkedin" as JobSource,
            match_score: 82,
            match_level: "high",
            match_flags: ["title-match", "skills-match", "experience-match"],
            location_str: "Remote (Europe)",
            work_mode_str: "Remote",
            seniority_str: "Senior",
            job_type_str: "Full-time",
            salary_str: "$90k – $130k",
            description_snippet:
              "We are looking for a Senior Frontend Developer to build and maintain our Next.js platform. You will work with React 19, TypeScript, Tailwind CSS, and a headless CMS. Experience with VTEX or similar e-commerce platforms is a plus.",
          },
        ]
      : realJobs;

  const visible = jobs.filter((j) => !skipped.has(j.url));
  const highMatch = visible.filter((j) => j.match_level === "high");
  const needsReview = visible.filter((j) => j.match_level === "review");
  const hasScoring = profile.name.length > 0;

  const invalidateFeed = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: feedQueryKey });
  }, [queryClient, feedQueryKey]);

  const refreshFeed = useCallback(() => {
    forceRefreshRef.current = true;
    queryClient.invalidateQueries({ queryKey: feedQueryKey });
  }, [queryClient, feedQueryKey]);
  const errorMsg = error ? extractApiError(error, "Search error") : null;

  return {
    jobs,
    loading: isLoading || isFetching,
    error: errorMsg,
    progress,
    panelJob,
    setPanelJob,
    handleSkip,
    visible,
    highMatch,
    needsReview,
    hasScoring,
    hasSearched: isFetched,
    isCached: data?.cached ?? false,
    creditsLeft,
    maxCredits,
    outOfCredits,
    dataUpdatedAt,
    invalidateFeed,
    refreshFeed,
    hasMore,
    loadMore,
    loadingMore,
    loadMoreError,
    totalAll: data?.total_all ?? 0,
    // Live streaming progress
    selectedSources,
    completedSources,
    searchStartedAt,
  };
}
