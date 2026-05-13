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

      try {
        const result = await jobsService.searchStream(
          filters.query ?? "",
          (filters.sources?.length
            ? filters.sources
            : [
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
              ]) as JobSource[],
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
          undefined,
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
    }
    prevKeyRef.current = currentKey;
  }, [currentKey]);

  const handleSkip = (url: string) => {
    setSkipped((prev) => new Set([...prev, url]));
  };

  const realJobs = data?.jobs ?? [];

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
  };
}
