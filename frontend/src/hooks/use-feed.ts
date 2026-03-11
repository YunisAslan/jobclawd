import { useState, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { jobsService } from "@/services/jobs.service";
import { applyService } from "@/services/apply.service";
import { JobListing, JobSource } from "@/types";
import { useProfile } from "@/contexts/ProfileContext";

const FEED_JOBS_KEY = "jc_feed_jobs";

function loadCachedJobs(): { jobs: JobListing[]; hasSearched: boolean } {
  if (typeof window === "undefined") return { jobs: [], hasSearched: false };
  try {
    const raw = sessionStorage.getItem(FEED_JOBS_KEY);
    if (!raw) return { jobs: [], hasSearched: false };
    const parsed = JSON.parse(raw);
    return { jobs: parsed.jobs ?? [], hasSearched: parsed.hasSearched ?? false };
  } catch {
    return { jobs: [], hasSearched: false };
  }
}

function saveCachedJobs(jobs: JobListing[], hasSearched: boolean) {
  try {
    sessionStorage.setItem(FEED_JOBS_KEY, JSON.stringify({ jobs, hasSearched }));
  } catch {}
}

export function useFeed() {
  const { profile } = useProfile();
  const cached = loadCachedJobs();
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<JobSource[]>(["jobsearch", "linkedin"]);
  const [location, setLocation] = useState<any>();
  const [hasSearched, setHasSearched] = useState(cached.hasSearched);
  const [jobs, setJobs] = useState<JobListing[]>(cached.jobs);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerJob, setDrawerJob] = useState<JobListing | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);

  useEffect(() => {
    saveCachedJobs(jobs, hasSearched);
  }, [jobs, hasSearched]);

  const searchMutation = useMutation({
    mutationFn: ({
      q,
      srcs,
      loc,
      workModes,
      experience,
      jobTypes,
      datePosted,
      salaryMin,
      sortBy,
    }: {
      q: string;
      srcs: JobSource[];
      loc?: any;
      workModes?: string[];
      experience?: string[];
      jobTypes?: string[];
      datePosted?: string;
      salaryMin?: string;
      sortBy?: string;
    }) => {
      setHasSearched(true);
      return jobsService.search(q, srcs, loc, {
        workModes,
        experience,
        jobTypes,
        datePosted,
        salaryMin,
        sortBy,
      });
    },
    onSuccess: (data) => {
      setJobs(data.jobs);
      setSkipped(new Set());
      setSelected(new Set());
    },
  });

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

  const handleSearch = useCallback(
    (overrides?: {
      q?: string;
      srcs?: JobSource[];
      loc?: any;
      workModes?: string[];
      experience?: string[];
      jobTypes?: string[];
      datePosted?: string;
      salaryMin?: string;
      sortBy?: string;
    }) => {
      // Always use explicit overrides — never pollute new searches with stale state
      const finalQ = overrides?.q ?? query;
      const finalSrcs = overrides?.srcs ?? sources;
      const finalLoc = overrides?.loc !== undefined ? overrides.loc : location;

      if (
        !finalQ?.trim() &&
        !finalLoc &&
        !overrides?.workModes?.length &&
        !overrides?.experience?.length &&
        !overrides?.jobTypes?.length
      ) {
        return;
      }

      searchMutation.mutate({
        q: finalQ ?? "",
        srcs: finalSrcs,
        loc: finalLoc,
        // Always pass explicit filter values — empty array beats undefined (signals "no filter selected")
        workModes: overrides?.workModes ?? [],
        experience: overrides?.experience ?? [],
        jobTypes: overrides?.jobTypes ?? [],
        datePosted: overrides?.datePosted ?? "",
        salaryMin: overrides?.salaryMin ?? "",
        sortBy: overrides?.sortBy ?? "",
      });
    },
    [query, sources, location, searchMutation],
  );

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

  const handleBulkApply = async () => {
    setBulkApplying(true);
    const toApply = jobs.filter((j) => selected.has(j.url));
    await Promise.all(
      toApply.map((job) => applyMutation.mutateAsync(job).catch(() => {})),
    );
    setSkipped((prev) => new Set([...prev, ...toApply.map((j) => j.url)]));
    setSelected(new Set());
    setBulkApplying(false);
  };

  const visible = jobs.filter((j) => !skipped.has(j.url));
  const highMatch = visible.filter((j) => j.match_level === "high");
  const needsReview = visible.filter((j) => j.match_level === "review");
  const hasScoring = profile.name.length > 0;

  const errorMsg = searchMutation.error
    ? ((searchMutation.error as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? "Search error")
    : null;

  return {
    query,
    setQuery,
    sources,
    setSources,
    location,
    setLocation,
    jobs,
    loading: searchMutation.isPending,
    error: errorMsg,
    selected,
    drawerJob,
    setDrawerJob,
    bulkApplying,
    handleSearch,
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
    hasSearched,
  };
}
