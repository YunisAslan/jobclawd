import { useState, useEffect } from "react";
import { JobListing, JobDetail, CVLink } from "@/types";
import { getJobDetails, applyToJob } from "@/lib/api";
import { useProfile } from "@/contexts/ProfileContext";
import { buildMailtoUrl } from "@/lib/mailto";

export function useJobDetail(job: JobListing | null, onApplied: () => void) {
  const { profile } = useProfile();
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedCV, setSelectedCV] = useState<CVLink | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!job) {
      setDetail(null);
      setMessage(null);
      return;
    }
    setDetail(null);
    setMessage(null);
    setLoadingDetail(true);
    getJobDetails(job.url)
      .then(setDetail)
      .catch((e: unknown) => setMessage(e instanceof Error ? e.message : "Failed to load details."))
      .finally(() => setLoadingDetail(false));
  }, [job?.url]);

  useEffect(() => {
    if (profile.cv_links.length > 0) setSelectedCV(profile.cv_links[0]);
  }, [profile.cv_links]);

  const handleApply = async () => {
    if (!job) return;
    setApplying(true);
    setMessage(null);
    try {
      const res = await applyToJob({
        job_url: job.url,
        job_title: job.title,
        company: job.company,
        source: job.source,
        hr_email: detail?.email ?? null,
        cv_name: selectedCV?.name ?? null,
        cv_url: selectedCV?.url ?? null,
        match_score: job.match_score,
        match_level: job.match_level,
        profile,
      });
      setMessage(res.message);
      if (detail?.email && !res.sent_via_smtp) {
        const mailto = buildMailtoUrl(profile, detail, selectedCV?.url);
        window.open(mailto, "_blank");
      }
      onApplied();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setApplying(false);
    }
  };

  return {
    profile,
    detail,
    loadingDetail,
    applying,
    selectedCV,
    setSelectedCV,
    message,
    handleApply,
  };
}
