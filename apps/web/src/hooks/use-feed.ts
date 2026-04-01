import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jobsService, SearchProgress } from "@/services/jobs.service";
import { JobListing, JobSource, LocationValue } from "@/types";
import { useProfile } from "@/contexts/ProfileContext";
import { extractApiError } from "@/lib/utils";
import { FeedFilterValues } from "@/validations/feed";

/** Cache timing constants — shared with FeedResults countdown */
export const FEED_STALE_TIME = 60 * 60 * 1000;
export const FEED_GC_TIME = 2 * 60 * 60 * 1000;

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
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [panelJob, setPanelJob] = useState<JobListing | null>(null);
  const forceRefreshRef = useRef(false);
  const [progress, setProgress] = useState<SearchProgress | null>(null);

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
    queryKey: buildQueryKey(filters),
    queryFn: async () => {
      const shouldForce = forceRefreshRef.current;
      forceRefreshRef.current = false;
      setProgress(null);

      try {
        const result = await jobsService.searchStream(
          filters.query ?? "",
          (filters.sources?.length
            ? filters.sources
            : ["jobsearch", "linkedin", "indeed"]) as JobSource[],
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
  const currentKey = JSON.stringify(buildQueryKey(filters));
  useEffect(() => {
    if (prevKeyRef.current && prevKeyRef.current !== currentKey) {
      setSkipped(new Set());
    }
    prevKeyRef.current = currentKey;
  }, [currentKey]);

  const handleSkip = (url: string) => {
    setSkipped((prev) => new Set([...prev, url]));
  };

  const jobs = data?.jobs ?? [];
  const visible = jobs.filter((j) => !skipped.has(j.url));
  const highMatch = visible.filter((j) => j.match_level === "high");
  const needsReview = visible.filter((j) => j.match_level === "review");
  const hasScoring = profile.name.length > 0;

  const invalidateFeed = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: buildQueryKey(filters) });
  }, [queryClient, filters]);

  const refreshFeed = useCallback(() => {
    forceRefreshRef.current = true;
    queryClient.invalidateQueries({ queryKey: buildQueryKey(filters) });
  }, [queryClient, filters]);
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
  };
}
