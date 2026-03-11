"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { JobListing } from "@/types";
import { jobsService } from "@/services/jobs.service";
import { applyService } from "@/services/apply.service";
import { settingsService } from "@/services/settings.service";
import { profileService } from "@/services/profile.service";
import { useProfile } from "@/contexts/ProfileContext";
import { generateCoverLetter, generateEmailSubject } from "@/lib/cover-letter";
import { ApplyFormValues } from "@/components/feed/types";
import { formFromProfile, resolveApplyMethod, getReadiness } from "@/components/feed/apply/utils";

export function useApplyDrawer(job: JobListing | null, onApplied: () => void) {
  const { profile } = useProfile();

  const [form, setForm] = useState<ApplyFormValues>(() => formFromProfile(profile));
  const [coverLetter, setCoverLetter] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);

  const { data: smtpSettings } = useQuery({
    queryKey: ["smtp-settings"],
    queryFn: () => settingsService.getSMTP(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["job-detail", job?.url],
    queryFn: () => jobsService.getDetail(job!.url),
    enabled: !!job?.url,
    staleTime: 5 * 60 * 1000,
  });

  const effectiveEmail = detail?.email ?? job?.hr_email ?? null;
  const fromEmail = smtpSettings?.username || form.email;

  const method = useMemo(
    () => (job ? resolveApplyMethod(job, detail ?? null) : "direct"),
    [job, detail],
  );

  useEffect(() => {
    if (job) {
      setForm(formFromProfile(profile));
      setMessage(null);
      setSuccess(false);
      setShowDetails(false);
      setShowEmailModal(false);
      setExtraFiles([]);
    }
  }, [job?.url, profile]);

  useEffect(() => {
    if (job && detail) {
      setCoverLetter(generateCoverLetter(profile, job, detail));
      setEmailSubject(generateEmailSubject(profile, job));
    }
  }, [job?.url, detail?.description, profile]);

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

      const extraUrls: string[] = [];
      for (const file of extraFiles) {
        const result = await profileService.uploadCV(file);
        extraUrls.push(result.url);
      }

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
        cover_letter: method === "email" ? coverLetter : null,
        email_subject: method === "email" ? emailSubject : null,
        extra_cv_urls: extraUrls.length > 0 ? extraUrls : null,
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
    onSuccess: (res) => {
      setMessage(res.message);
      setSuccess(true);
      if (method === "email") {
        toast.success("Application sent!", {
          description: `Your email was delivered to ${effectiveEmail}.`,
        });
        setShowEmailModal(false);
      } else {
        window.open(job!.url, "_blank");
      }
      onApplied();
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : "An error occurred.");
      setMessage(msg);
      setSuccess(false);
    },
  });

  const updateField = <K extends keyof ApplyFormValues>(key: K, value: ApplyFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fillFromProfile = () => setForm(formFromProfile(profile));

  return {
    profile,
    form,
    coverLetter,
    setCoverLetter,
    emailSubject,
    setEmailSubject,
    message,
    success,
    showDetails,
    setShowDetails,
    showEmailModal,
    setShowEmailModal,
    extraFiles,
    setExtraFiles,
    smtpSettings,
    fromEmail,
    detail,
    loadingDetail,
    effectiveEmail,
    method,
    readiness,
    isEdited,
    applyMutation,
    updateField,
    fillFromProfile,
  };
}
