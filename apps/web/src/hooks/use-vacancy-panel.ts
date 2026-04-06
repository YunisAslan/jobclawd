import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/contexts/ProfileContext";
import { savedVacanciesService } from "@/services/saved-vacancies.service";
import { profileService } from "@/services/profile.service";
import { jobsService } from "@/services/jobs.service";
import { useCVMatch } from "@/hooks/use-cv-match";
import type { JobListing, CVLink, DocumentSession } from "@/types";

export type VacancyTab = "overview" | "improve";

export function useVacancyPanel(job: JobListing | null) {
  const { profile, setProfile } = useProfile();
  const qc = useQueryClient();

  const [selectedCV, setSelectedCV] = useState<CVLink | null>(null);
  const [activeTab, setActiveTab] = useState<VacancyTab>("overview");
  const [uploading, setUploading] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const cvMatch = useCVMatch();

  // Reset state when job changes
  useEffect(() => {
    if (job) {
      setActiveTab("overview");
      const firstCV = profile.cv_links?.[0] ?? null;
      setSelectedCV(firstCV);
      cvMatch.reset();
      setWorkspaceOpen(false);
    } else {
      setSelectedCV(null);
      setActiveTab("overview");
      cvMatch.reset();
      setWorkspaceOpen(false);
    }
  }, [job?.url]);

  // Job detail query
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["job-detail", job?.url],
    queryFn: () => jobsService.getDetail(job!.url),
    enabled: !!job?.url,
    staleTime: 5 * 60 * 1000,
  });

  // Explicit analyze trigger
  const analyzeCV = useCallback(() => {
    if (!job?.url || !selectedCV?.url) return;
    cvMatch.analyze(job.url, selectedCV.url);
  }, [job?.url, selectedCV?.url]);

  // Open workspace: create document session then open dialog
  const openWorkspace = useCallback(async () => {
    if (!selectedCV?.url) return;
    setWorkspaceOpen(true);
    // Create a new session if none exists or if the CV changed
    const existingSession = cvMatch.documentSession;
    if (!existingSession || existingSession.preview_url !== selectedCV.url) {
      await cvMatch.openDocumentSession(selectedCV.url);
    }
    // Auto-parse PDF into structured data for the section editor
    const isPdf = selectedCV.url.toLowerCase().endsWith(".pdf");
    if (isPdf && !cvMatch.cvData && !cvMatch.loadingParse) {
      cvMatch.parseCv(selectedCV.url);
    }
  }, [selectedCV?.url, cvMatch.documentSession, cvMatch.openDocumentSession, cvMatch.cvData, cvMatch.loadingParse, cvMatch.parseCv]);

  const closeWorkspace = useCallback(() => {
    setWorkspaceOpen(false);
  }, []);

  // When user changes CV, reset analysis + clear session
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
    draftHtml: cvMatch.draftHtml,
    loadingDraft: cvMatch.loadingDraft,
    errorDraft: cvMatch.errorDraft,
    downloadingDraft: cvMatch.downloadingDraft,
    draftFileName: cvMatch.draftFileName,
    suggestionActions: cvMatch.suggestionActions,
    analyzed: cvMatch.analyzed,
    updateDraft: cvMatch.updateDraft,
    updateDraftHtml: cvMatch.updateDraftHtml,
    resetDraft: cvMatch.resetDraft,
    acceptSuggestion: cvMatch.acceptSuggestion,
    undoAcceptSuggestion: cvMatch.undoAcceptSuggestion,
    rejectSuggestion: cvMatch.rejectSuggestion,
    resetSuggestion: cvMatch.resetSuggestion,
    downloadDraft: () => (selectedCV?.url ? cvMatch.downloadDraft(selectedCV.url) : Promise.resolve()),
    // Document session
    documentSession: cvMatch.documentSession,
    loadingSession: cvMatch.loadingSession,
    convertingToDocs: cvMatch.convertingToDocs,
    errorSession: cvMatch.errorSession,
    convertSessionToDocx: cvMatch.convertSessionToDocx,
    onSessionUpdated: cvMatch.refreshDocumentSession,
    // Structured CV data (for PDFs)
    cvData: cvMatch.cvData,
    updateCvData: cvMatch.updateCvData,
    resetCvData: cvMatch.resetCvData,
    generateAndDownloadPdf: cvMatch.generateAndDownloadPdf,
    loadingParse: cvMatch.loadingParse,
    generatingPdf: cvMatch.generatingPdf,
    parseCv: cvMatch.parseCv,
    // Workspace dialog control
    workspaceOpen,
    openWorkspace,
    closeWorkspace,
    isSaved,
    toggleSave,
    profile,
  };
}
