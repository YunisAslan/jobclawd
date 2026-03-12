import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { JobListing, CVLink } from "@/types";
import { jobsService } from "@/services/jobs.service";
import { applyService } from "@/services/apply.service";
import { useProfile } from "@/contexts/ProfileContext";
import { extractApiError } from "@/lib/utils";
import { buildMailtoUrl } from "@/lib/mailto";

export function useJobDetail(job: JobListing | null, onApplied: () => void) {
  const { profile } = useProfile();
  const [selectedCV, setSelectedCV] = useState<CVLink | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["job-detail", job?.url],
    queryFn: () => jobsService.getDetail(job!.url),
    enabled: !!job?.url,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (profile.cv_links.length > 0) setSelectedCV(profile.cv_links[0]);
  }, [profile.cv_links]);

  useEffect(() => {
    setMessage(null);
  }, [job?.url]);

  const applyMutation = useMutation({
    mutationFn: () =>
      applyService.apply({
        job_url: job!.url,
        job_title: job!.title,
        company: job!.company,
        source: job!.source,
        hr_email: detail?.email ?? null,
        cv_name: selectedCV?.name ?? null,
        cv_url: selectedCV?.url ?? null,
        match_score: job!.match_score,
        match_level: job!.match_level,
        profile,
      }),
    onSuccess: (res) => {
      setMessage(res.message);
      if (detail?.email && !res.sent_via_smtp) {
        const mailto = buildMailtoUrl(profile, detail, selectedCV?.url);
        window.open(mailto, "_blank");
      }
      onApplied();
    },
    onError: (err: unknown) => {
      setMessage(extractApiError(err));
    },
  });

  return {
    profile,
    detail: detail ?? null,
    loadingDetail,
    applying: applyMutation.isPending,
    selectedCV,
    setSelectedCV,
    message,
    handleApply: () => {
      if (job) applyMutation.mutate();
    },
  };
}
