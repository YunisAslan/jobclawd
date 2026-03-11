import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { jobsService } from "@/services/jobs.service";
import { applyService } from "@/services/apply.service";
import { JobListing, JobSource, LocationValue } from "@/types";
import { useProfile } from "@/contexts/ProfileContext";
import { extractApiError } from "@/lib/utils";
import { FeedFilterValues } from "@/validations/feed";

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

export function useFeed(filters: Partial<FeedFilterValues>) {
  const { profile } = useProfile();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerJob, setDrawerJob] = useState<JobListing | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);

  const normalizedSalaryMin = (() => {
    const raw = filters.salaryMin?.replace(/,/g, "");
    if (!raw) return undefined;
    const n = parseInt(raw, 10);
    if (isNaN(n)) return raw;
    if (filters.salaryPeriod === "monthly") return String(n * 12);
    if (filters.salaryPeriod === "hourly") return String(n * 2080);
    return raw;
  })();

  const hasQuery = !!(filters.query?.trim());

  const { data, isLoading, isFetching, isFetched, error } = useQuery({
    queryKey: buildQueryKey(filters),
    queryFn: () =>
      jobsService.search(
        filters.query ?? "",
        ((filters.sources?.length ? filters.sources : ["jobsearch", "linkedin", "indeed"]) as JobSource[]),
        (filters.location as LocationValue) ?? undefined,
        {
          workModes: filters.workModes,
          experience: filters.experience,
          jobTypes: filters.jobTypes,
          datePosted: filters.datePosted,
          salaryMin: normalizedSalaryMin,
          sortBy: filters.sortBy,
        },
      ),

    enabled: hasQuery,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const prevKeyRef = useRef<string>("");
  const currentKey = JSON.stringify(buildQueryKey(filters));
  useEffect(() => {
    if (prevKeyRef.current && prevKeyRef.current !== currentKey) {
      setSkipped(new Set());
      setSelected(new Set());
    }
    prevKeyRef.current = currentKey;
  }, [currentKey]);

  const applyMutation = useMutation({
    mutationFn: (job: JobListing) =>
      applyService.apply({
        job_url: job.url,
        job_title: job.title,
        company: job.company,
        source: job.source,
        match_score: job.match_score,
        match_level: job.match_level,
        profile,
      }),
  });

  const toggleSelect = (url: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });

  const handleSkip = (url: string) => {
    setSkipped((prev) => new Set([...prev, url]));
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(url);
      return n;
    });
  };

  const handleApplied = () => {
    if (drawerJob) {
      setSkipped((prev) => new Set([...prev, drawerJob.url]));
      setDrawerJob(null);
    }
  };

  const handleBulkApply = useCallback(async () => {
    if (!data?.jobs) return;
    setBulkApplying(true);
    const toApply = data.jobs.filter((j) => selected.has(j.url));
    await Promise.all(
      toApply.map((job) => applyMutation.mutateAsync(job).catch(() => {})),
    );
    setSkipped((prev) => new Set([...prev, ...toApply.map((j) => j.url)]));
    setSelected(new Set());
    setBulkApplying(false);
  }, [data?.jobs, selected, applyMutation]);

  const jobs = data?.jobs ?? [];
  const visible = jobs.filter((j) => !skipped.has(j.url));
  const highMatch = visible.filter((j) => j.match_level === "high");
  const needsReview = visible.filter((j) => j.match_level === "review");
  const hasScoring = profile.name.length > 0;

  const errorMsg = error ? extractApiError(error, "Search error") : null;

  return {
    jobs,
    loading: isLoading || isFetching,
    error: errorMsg,
    selected,
    drawerJob,
    setDrawerJob,
    bulkApplying,
    toggleSelect,
    handleSkip,
    handleApplied,
    handleBulkApply,
    clearSelected: () => setSelected(new Set()),
    visible,
    highMatch,
    needsReview,
    hasScoring,
    allVisible: hasScoring ? [] : visible,
    hasSearched: isFetched,
    isCached: data?.cached ?? false,
  };
}
