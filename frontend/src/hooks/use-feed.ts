import { useState, useCallback } from "react";
import { searchJobsWithProfile, applyToJob } from "@/lib/api";
import { JobListing, JobSource } from "@/types";
import { useProfile } from "@/contexts/ProfileContext";

export const ALL_SOURCES: { value: JobSource; label: string }[] = [
  { value: "jobsearch", label: "Jobsearch" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "indeed", label: "Indeed" },
];

export function useFeed() {
  const { profile } = useProfile();
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<JobSource[]>(["jobsearch"]);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerJob, setDrawerJob] = useState<JobListing | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setJobs([]);
    setSkipped(new Set());
    setSelected(new Set());
    try {
      const res = await searchJobsWithProfile(query, profile, sources);
      setJobs(res.jobs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search error");
    } finally {
      setLoading(false);
    }
  }, [query, profile, sources]);

  const toggleSource = (s: JobSource) =>
    setSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const toggleSelect = (url: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });

  const handleSkip = (url: string) => {
    setSkipped((prev) => new Set([...prev, url]));
    setSelected((prev) => { const n = new Set(prev); n.delete(url); return n; });
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
    for (const job of toApply) {
      try {
        await applyToJob({
          job_url: job.url, job_title: job.title, company: job.company,
          source: job.source, match_score: job.match_score, match_level: job.match_level, profile,
        });
      } catch { /* non-fatal */ }
    }
    setSkipped((prev) => new Set([...prev, ...toApply.map((j) => j.url)]));
    setSelected(new Set());
    setBulkApplying(false);
  };

  const visible = jobs.filter((j) => !skipped.has(j.url));
  const highMatch = visible.filter((j) => j.match_level === "high");
  const needsReview = visible.filter((j) => j.match_level === "review");
  const hasScoring = profile.name.length > 0;

  const clearSelected = () => setSelected(new Set());

  return {
    query,
    setQuery,
    sources,
    jobs,
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
    allVisible: hasScoring ? [] : visible,
  };
}
