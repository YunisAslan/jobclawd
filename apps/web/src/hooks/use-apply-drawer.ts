"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { JobListing } from "@/types";
import { jobsService } from "@/services/jobs.service";
import { applyService } from "@/services/apply.service";
import type { ApplyReadinessResponse } from "@/types";
import { useProfile } from "@/contexts/ProfileContext";
import { extractApiError } from "@/lib/utils";
import { ApplyFormValues } from "@/components/feed/types";
import { formFromProfile, getReadiness } from "@/components/feed/apply/utils";

export function useApplyDrawer(job: JobListing | null, onApplied: () => void) {
  const { profile } = useProfile();

  const [form, setForm] = useState<ApplyFormValues>(() => formFromProfile(profile));
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["job-detail", job?.url],
    queryFn: () => jobsService.getDetail(job!.url),
    enabled: !!job?.url,
    staleTime: 5 * 60 * 1000,
  });

  const { data: applyReadiness } = useQuery({
    queryKey: ["apply-readiness", job?.url, profile?.email],
    queryFn: () => applyService.getReadiness(job!, profile),
    enabled: !!job?.url,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const effectiveEmail = detail?.email ?? job?.hr_email ?? null;

  // Resolved apply URL: prefer resolver's output, fall back to original
  const resolvedApplyUrl = useMemo(() => {
    if (detail?.resolved_apply_url) return detail.resolved_apply_url;
    return job?.url ?? "";
  }, [detail, job]);

  useEffect(() => {
    if (job) {
      setForm(formFromProfile(profile));
      setMessage(null);
      setSuccess(false);
      setShowDetails(false);
    }
  }, [job?.url, profile]);

  const readiness = useMemo(() => getReadiness(form), [form]);

  const profileDefaults = useMemo(() => formFromProfile(profile), [profile]);
  const isEdited = useMemo(
    () =>
      form.fullName !== profileDefaults.fullName ||
      form.email !== profileDefaults.email ||
      form.phone !== profileDefaults.phone ||
      form.linkedin_url !== profileDefaults.linkedin_url ||
      form.portfolio_url !== profileDefaults.portfolio_url ||
      form.selectedCV?.url !== profileDefaults.selectedCV?.url,
    [form, profileDefaults],
  );

  const applyMutation = useMutation({
    mutationFn: async () => {
      const [firstName = "", ...rest] = form.fullName.trim().split(" ");
      const lastName = rest.join(" ");

      return applyService.apply({
        job_url: job!.url,
        job_title: job!.title,
        company: job!.company,
        source: job!.source,
        hr_email: effectiveEmail,
        cv_name: form.selectedCV?.name ?? null,
        cv_url: form.selectedCV?.url ?? null,
        match_score: job!.match_score,
        match_level: job!.match_level,
        profile: {
          ...profile,
          name: firstName,
          surname: lastName,
          email: form.email,
          phone: form.phone,
          linkedin_url: form.linkedin_url,
          portfolio_url: form.portfolio_url,
        },
      });
    },
    onSuccess: async (res) => {
      setMessage(res.message);
      setSuccess(true);
      window.open(resolvedApplyUrl, "_blank");
      onApplied();
    },
    onError: (err: Error) => {
      setMessage(extractApiError(err));
      setSuccess(false);
    },
  });

  const updateField = <K extends keyof ApplyFormValues>(key: K, value: ApplyFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fillFromProfile = () => setForm(formFromProfile(profile));

  return {
    profile,
    form,
    message,
    success,
    showDetails,
    setShowDetails,
    detail,
    loadingDetail,
    effectiveEmail,
    resolvedApplyUrl,
    readiness,
    applyReadiness,
    isEdited,
    applyMutation,
    updateField,
    fillFromProfile,
  };
}
