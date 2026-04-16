import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/contexts/ProfileContext";
import { savedVacanciesService } from "@/services/saved-vacancies.service";
import { profileService } from "@/services/profile.service";
import { jobsService } from "@/services/jobs.service";
import { cvMatchService } from "@/services/cv-match.service";
import { useCVMatch } from "@/hooks/use-cv-match";
import type { JobListing, CVLink, CVMatchAnalysis } from "@/types";

export type VacancyTab = "overview" | "improve";

export interface MultiCVEntry {
  cv: CVLink;
  analysis: CVMatchAnalysis | null;
  loading: boolean;
  error: string | null;
}

export function useVacancyPanel(job: JobListing | null) {
  const { profile, setProfile } = useProfile();
  const qc = useQueryClient();

  const [selectedCV, setSelectedCV] = useState<CVLink | null>(null);
  const [activeTab, setActiveTab] = useState<VacancyTab>("overview");
  const [uploading, setUploading] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [multiCVResults, setMultiCVResults] = useState<MultiCVEntry[]>([]);
  // Tracks which job URL has already been hydrated from cache to avoid overwriting user-added entries
  const hydratedJobUrl = useRef<string | null>(null);

  const cvMatch = useCVMatch();

  // Reset state when job changes
  useEffect(() => {
    if (job) {
      setActiveTab("overview");
      const firstCV = profile.cv_links?.[0] ?? null;
      setSelectedCV(firstCV);
      cvMatch.reset();
      setWorkspaceOpen(false);
      setMultiCVResults([]);
      hydratedJobUrl.current = null;
    } else {
      setSelectedCV(null);
      setActiveTab("overview");
      cvMatch.reset();
      setWorkspaceOpen(false);
      setMultiCVResults([]);
      hydratedJobUrl.current = null;
    }
  }, [job?.url]);

  // If the profile loaded after the panel opened, selectedCV may still be null — auto-select first CV
  useEffect(() => {
    if (job?.url && !selectedCV && profile.cv_links?.[0]) {
      setSelectedCV(profile.cv_links[0]);
    }
  }, [profile.cv_links?.length]);

  // Job detail query
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["job-detail", job?.url],
    queryFn: () => jobsService.getDetail(job!.url),
    enabled: !!job?.url,
    staleTime: 5 * 60 * 1000,
  });

  // Load previously cached CV analyses for this vacancy
  const { data: cachedAnalyses } = useQuery({
    queryKey: ["cv-analyses-cache", job?.url],
    queryFn: () => cvMatchService.getCachedResults(job!.url),
    enabled: !!job?.url,
    staleTime: Infinity,
  });

  // Hydrate multiCVResults once per job URL from cached data
  useEffect(() => {
    if (!job?.url || !cachedAnalyses || hydratedJobUrl.current === job.url) return;
    hydratedJobUrl.current = job.url;
    if (cachedAnalyses.entries.length === 0) return;
    setMultiCVResults(
      cachedAnalyses.entries.map((entry) => {
        // Prefer the real name from profile (handles old cache entries with hash names)
        const profileCV = profile.cv_links?.find((cv) => cv.url === entry.cv_url);
        return {
          cv: { name: profileCV?.name ?? entry.cv_name, url: entry.cv_url },
          analysis: entry.analysis,
          loading: false,
          error: null,
        };
      }),
    );
  }, [job?.url, cachedAnalyses]);

  // Explicit analyze trigger
  const analyzeCV = useCallback(() => {
    if (!job?.url || !selectedCV?.url) return;
    cvMatch.analyze(job.url, selectedCV.url);
  }, [job?.url, selectedCV?.url]);

  // Open workspace: parse CV into structured JSON, then open dialog
  const openWorkspace = useCallback(async () => {
    if (!selectedCV?.url) return;
    setWorkspaceOpen(true);
    // Auto-parse into structured data for the section editor
    if (!cvMatch.cvData && !cvMatch.loadingParse) {
      cvMatch.parseCv(selectedCV.url);
    }
  }, [selectedCV?.url, cvMatch.cvData, cvMatch.loadingParse, cvMatch.parseCv]);

  // Single-click: trigger analysis + open workspace simultaneously (optional CV override for multi-CV list)
  const analyzeAndOpen = useCallback((cvOverride?: CVLink) => {
    const cv = cvOverride ?? selectedCV;
    if (!job?.url || !cv?.url) return;
    if (cvOverride) setSelectedCV(cvOverride);
    setWorkspaceOpen(true);
    cvMatch.parseCv(cv.url);
    // Reuse existing sidebar score if already computed — seeds score only, shows "Generate Suggestions"
    // button instead of auto-fetching so users who already applied aren't re-prompted.
    const existingEntry = multiCVResults.find((e) => e.cv.url === cv.url && e.analysis && !e.loading);
    if (existingEntry?.analysis) {
      cvMatch.seedAnalysis(existingEntry.analysis);
    } else {
      cvMatch.analyze(job.url, cv.url);
    }
  }, [job?.url, selectedCV, multiCVResults, cvMatch.analyze, cvMatch.seedAnalysis, cvMatch.parseCv]);

  // Multi-CV: analyze a CV and add result to comparison list
  const addCVToCompare = useCallback(async (cv: CVLink) => {
    if (!job?.url) return;
    setMultiCVResults((prev) => {
      const existing = prev.findIndex((e) => e.cv.url === cv.url);
      const entry: MultiCVEntry = { cv, analysis: null, loading: true, error: null };
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = entry;
        return next;
      }
      return [...prev, entry];
    });
    try {
      const bundle = await cvMatchService.getBundle(job.url, cv.url, cv.name);
      setMultiCVResults((prev) =>
        prev.map((e) => (e.cv.url === cv.url ? { ...e, loading: false, analysis: bundle.analysis } : e))
      );
      // Invalidate so next open of this vacancy reflects the newly cached entry
      qc.invalidateQueries({ queryKey: ["cv-analyses-cache", job.url] });
    } catch {
      setMultiCVResults((prev) =>
        prev.map((e) => (e.cv.url === cv.url ? { ...e, loading: false, error: "Analysis failed. Try again." } : e))
      );
    }
  }, [job?.url]);

  const removeCVFromCompare = useCallback((cvUrl: string) => {
    setMultiCVResults((prev) => prev.filter((e) => e.cv.url !== cvUrl));
    if (job?.url) {
      cvMatchService.deleteCachedResult(job.url, cvUrl).catch(() => {});
    }
  }, [job?.url]);

  const closeWorkspace = useCallback(() => {
    setWorkspaceOpen(false);
  }, []);

  // Fetch suggestions on demand (used when workspace was opened from an already-analyzed CV)
  const generateSuggestions = useCallback(() => {
    if (!job?.url || !selectedCV?.url) return;
    cvMatch.generateSuggestions(job.url, selectedCV.url);
  }, [job?.url, selectedCV?.url, cvMatch.generateSuggestions]);

  // When user changes CV, reset analysis
  const handleCVChange = useCallback((cv: CVLink | null) => {
    setSelectedCV(cv);
    cvMatch.reset();
  }, []);

  // Upload CV from within the panel
  const uploadCV = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const result = await profileService.uploadCV(file);
      const newCV: CVLink = { name: result.name, url: result.url };
      const updatedLinks = [...(profile.cv_links ?? []), newCV];
      const updatedProfile = { ...profile, cv_links: updatedLinks };
      setProfile(updatedProfile);
      await profileService.saveProfile(updatedProfile as any);
      setSelectedCV(newCV);
      cvMatch.reset();
      qc.invalidateQueries({ queryKey: ["profile"] });
      return newCV;
    } finally {
      setUploading(false);
    }
  }, [profile, setProfile, qc]);

  // Saved state check
  const { data: savedCheck } = useQuery({
    queryKey: ["saved-check-single", job?.url],
    queryFn: () => savedVacanciesService.batchCheck([job!.url]),
    enabled: !!job?.url,
    staleTime: 30_000,
  });
  const isSaved = savedCheck?.saved_urls?.includes(job?.url ?? "") ?? false;

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!job) return;
      if (isSaved) await savedVacanciesService.unsave(job.url);
      else await savedVacanciesService.save(job.url, job);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-check-single", job?.url] });
      qc.invalidateQueries({ queryKey: ["saved-vacancies"] });
      qc.invalidateQueries({ queryKey: ["saved-check"] });
    },
  });

  const resolvedApplyUrl = detail?.resolved_apply_url || job?.url || "";

  return {
    detail,
    loadingDetail,
    resolvedApplyUrl,
    selectedCV,
    setSelectedCV: handleCVChange,
    uploadCV,
    uploading,
    activeTab,
    setActiveTab,
    analyzeCV,
    // CV analysis
    cvAnalysis: cvMatch.analysis,
    loadingAnalysis: cvMatch.loadingAnalysis,
    errorAnalysis: cvMatch.errorAnalysis,
    suggestions: cvMatch.suggestions,
    loadingSuggestions: cvMatch.loadingSuggestions,
    errorSuggestions: cvMatch.errorSuggestions,
    draftText: cvMatch.draftText,
    originalDraftText: cvMatch.originalDraftText,
    loadingDraft: cvMatch.loadingDraft,
    errorDraft: cvMatch.errorDraft,
    downloadingDraft: cvMatch.downloadingDraft,
    draftFileName: cvMatch.draftFileName,
    suggestionActions: cvMatch.suggestionActions,
    analyzed: cvMatch.analyzed,
    updateDraft: cvMatch.updateDraft,
    resetDraft: cvMatch.resetDraft,
    acceptSuggestion: cvMatch.acceptSuggestion,
    undoAcceptSuggestion: cvMatch.undoAcceptSuggestion,
    rejectSuggestion: cvMatch.rejectSuggestion,
    resetSuggestion: cvMatch.resetSuggestion,
    downloadDraft: () => (selectedCV?.url ? cvMatch.downloadDraft(selectedCV.url) : Promise.resolve()),
    // Structured CV data
    cvData: cvMatch.cvData,
    originalCvData: cvMatch.originalCvData,
    updateCvData: cvMatch.updateCvData,
    resetCvData: cvMatch.resetCvData,
    generateAndDownloadPdf: cvMatch.generateAndDownloadPdf,
    saveCvData: () => (selectedCV?.url ? cvMatch.saveCvData(selectedCV.url) : Promise.resolve()),
    savingCvData: cvMatch.savingCvData,
    cvDataSaved: cvMatch.cvDataSaved,
    loadingParse: cvMatch.loadingParse,
    generatingPdf: cvMatch.generatingPdf,
    parseCv: cvMatch.parseCv,
    // ATS Preview
    atsPreview: cvMatch.atsPreview,
    atsPreviewBaseline: cvMatch.atsPreviewBaseline,
    loadingAtsPreview: cvMatch.loadingAtsPreview,
    previewAtsScore: () => (job?.url ? cvMatch.previewAtsScore(job.url) : Promise.resolve()),
    dismissAtsPreview: cvMatch.dismissAtsPreview,
    // Multi-CV comparison
    multiCVResults,
    addCVToCompare,
    removeCVFromCompare,
    // Workspace dialog control
    workspaceOpen,
    openWorkspace,
    analyzeAndOpen,
    closeWorkspace,
    generateSuggestions,
    isSaved,
    toggleSave,
    profile,
  };
}
