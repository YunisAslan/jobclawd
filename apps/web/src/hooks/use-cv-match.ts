import { useState } from "react";
import { cvMatchService } from "@/services/cv-match.service";
import { documentService } from "@/services/document.service";
import type { CVData, CVMatchAnalysis, CVSuggestion, CVSuggestionsResponse } from "@/types";

interface CVMatchState {
  analysis: CVMatchAnalysis | null;
  suggestions: CVSuggestionsResponse | null;
  loadingAnalysis: boolean;
  loadingSuggestions: boolean;
  loadingDraft: boolean;
  downloadingDraft: boolean;
  errorAnalysis: string | null;
  errorSuggestions: string | null;
  errorDraft: string | null;
  analyzed: boolean;
  draftText: string;
  originalDraftText: string;
  draftFileName: string;
  suggestionActions: Record<number, "accepted" | "rejected">;
  preAcceptSnapshots: Record<number, string>;
  preAcceptCvSnapshots: Record<number, CVData>;
  // ── Structured CV data ──
  cvData: CVData | null;
  originalCvData: CVData | null;
  loadingParse: boolean;
  generatingPdf: boolean;
}

export function useCVMatch() {
  const [state, setState] = useState<CVMatchState>({
    analysis: null,
    suggestions: null,
    loadingAnalysis: false,
    loadingSuggestions: false,
    loadingDraft: false,
    downloadingDraft: false,
    errorAnalysis: null,
    errorSuggestions: null,
    errorDraft: null,
    analyzed: false,
    draftText: "",
    originalDraftText: "",
    draftFileName: "",
    suggestionActions: {},
    preAcceptSnapshots: {},
    preAcceptCvSnapshots: {},
    cvData: null,
    originalCvData: null,
    loadingParse: false,
    generatingPdf: false,
  });

  async function analyze(jobUrl: string, cvUrl: string) {
    setState((s) => ({
      ...s,
      loadingAnalysis: true,
      loadingSuggestions: true,
      loadingDraft: true,
      errorAnalysis: null,
      errorSuggestions: null,
      errorDraft: null,
      analyzed: true,
      suggestionActions: {},
    }));

    const bundleResult = await Promise.allSettled([cvMatchService.getBundle(jobUrl, cvUrl)]);
    const bundle = bundleResult[0];

    setState((s) => ({
      ...s,
      analysis: bundle.status === "fulfilled" ? bundle.value.analysis : null,
      suggestions: bundle.status === "fulfilled" ? bundle.value.suggestions : null,
      loadingAnalysis: false,
      loadingSuggestions: false,
      loadingDraft: false,
      errorAnalysis:
        bundle.status === "rejected"
          ? "Failed to analyze CV match. Please try again."
          : bundle.value.error_analysis ||
            (bundle.value.analysis.overall_score === 0 && bundle.value.analysis.categories.length === 0
              ? bundle.value.analysis.summary || "Could not generate analysis."
              : null),
      errorSuggestions:
        bundle.status === "rejected"
          ? "Failed to generate suggestions. Please try again."
          : bundle.value.error_suggestions || null,
      draftText: bundle.status === "fulfilled" ? bundle.value.draft.text : "",
      originalDraftText: bundle.status === "fulfilled" ? bundle.value.draft.text : "",
      draftFileName: bundle.status === "fulfilled" ? bundle.value.draft.file_name : "",
      errorDraft:
        bundle.status === "rejected"
          ? "Could not load the CV draft for editing."
          : bundle.value.error_draft || null,
    }));
  }

  // ── Structured CV parsing & generation ──────────────────────────────────

  async function parseCv(cvUrl: string) {
    setState((s) => ({ ...s, loadingParse: true }));
    try {
      const { data, cv_name } = await documentService.parseCv(cvUrl);
      setState((s) => ({
        ...s,
        cvData: data,
        originalCvData: data,
        draftFileName: cv_name || s.draftFileName,
        loadingParse: false,
      }));
    } catch {
      setState((s) => ({ ...s, loadingParse: false }));
    }
  }

  function updateCvData(data: CVData) {
    setState((s) => ({ ...s, cvData: data }));
  }

  function resetCvData() {
    setState((s) => ({ ...s, cvData: s.originalCvData }));
  }

  async function generateAndDownloadPdf(fileName?: string) {
    if (!state.cvData) return;
    setState((s) => ({ ...s, generatingPdf: true }));
    try {
      await documentService.generatePdf(state.cvData, fileName || state.draftFileName || "cv");
    } finally {
      setState((s) => ({ ...s, generatingPdf: false }));
    }
  }

  // ── Draft editing ──────────────────────────────────────────────────────

  function updateDraft(text: string) {
    setState((s) => ({ ...s, draftText: text }));
  }

  function resetDraft() {
    setState((s) => ({
      ...s,
      draftText: s.originalDraftText,
      cvData: s.originalCvData,
      suggestionActions: {},
      preAcceptSnapshots: {},
      preAcceptCvSnapshots: {},
    }));
  }

  function acceptSuggestion(index: number, suggestion: CVSuggestion, overrideText?: string) {
    setState((s) => {
      const suggestedText = overrideText ?? suggestion.suggested_text ?? "";
      const nextDraft = applySuggestionToDraft(s.draftText, suggestion, suggestedText);
      const nextCvData = s.cvData ? applySuggestionToCvData(s.cvData, suggestion, suggestedText) : s.cvData;
      return {
        ...s,
        draftText: nextDraft,
        cvData: nextCvData,
        suggestionActions: { ...s.suggestionActions, [index]: "accepted" },
        preAcceptSnapshots: { ...s.preAcceptSnapshots, [index]: s.draftText },
        preAcceptCvSnapshots: s.cvData ? { ...s.preAcceptCvSnapshots, [index]: s.cvData } : s.preAcceptCvSnapshots,
      };
    });
  }

  function undoAcceptSuggestion(index: number) {
    setState((s) => {
      const snapshot = s.preAcceptSnapshots[index];
      if (snapshot === undefined) return s;
      const cvSnapshot = s.preAcceptCvSnapshots[index];
      const nextSnapshots = { ...s.preAcceptSnapshots };
      delete nextSnapshots[index];
      const nextCvSnapshots = { ...s.preAcceptCvSnapshots };
      delete nextCvSnapshots[index];
      const nextActions = { ...s.suggestionActions };
      delete nextActions[index];
      return {
        ...s,
        draftText: snapshot,
        cvData: cvSnapshot ?? s.cvData,
        suggestionActions: nextActions,
        preAcceptSnapshots: nextSnapshots,
        preAcceptCvSnapshots: nextCvSnapshots,
      };
    });
  }

  function rejectSuggestion(index: number) {
    setState((s) => ({ ...s, suggestionActions: { ...s.suggestionActions, [index]: "rejected" } }));
  }

  function resetSuggestion(index: number) {
    setState((s) => {
      const nextActions = { ...s.suggestionActions };
      delete nextActions[index];
      return { ...s, suggestionActions: nextActions };
    });
  }

  async function downloadDraft(cvUrl: string) {
    setState((s) => ({ ...s, downloadingDraft: true }));
    try {
      const content = state.draftText;
      const result = await cvMatchService.exportDraft(cvUrl, content, state.draftFileName);
      const objectUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setState((s) => ({ ...s, downloadingDraft: false }));
    }
  }

  function reset() {
    setState({
      analysis: null,
      suggestions: null,
      loadingAnalysis: false,
      loadingSuggestions: false,
      loadingDraft: false,
      downloadingDraft: false,
      errorAnalysis: null,
      errorSuggestions: null,
      errorDraft: null,
      analyzed: false,
      draftText: "",
      originalDraftText: "",
      draftFileName: "",
      suggestionActions: {},
      preAcceptSnapshots: {},
      preAcceptCvSnapshots: {},
      cvData: null,
      originalCvData: null,
      loadingParse: false,
      generatingPdf: false,
    });
  }

  return {
    ...state,
    analyze,
    updateDraft,
    resetDraft,
    acceptSuggestion,
    undoAcceptSuggestion,
    rejectSuggestion,
    resetSuggestion,
    downloadDraft,
    parseCv,
    updateCvData,
    resetCvData,
    generateAndDownloadPdf,
    reset,
  };
}

// ── Section-aware suggestion application ────────────────────────────────────

const SECTION_GROUPS: [string[], string[]][] = [
  [["skill", "technical", "technology", "tech stack", "tool", "vtex", "platform"], ["skills", "technical skills", "technologies", "tech stack", "tools", "core skills"]],
  [["experience", "work history", "employment", "career", "job"], ["experience", "work experience", "professional experience", "career history"]],
  [["education", "academic", "degree", "university", "school"], ["education", "academic background"]],
  [["project"], ["projects", "personal projects", "side projects"]],
  [["certification", "certificate", "course", "license"], ["certifications", "certificates", "courses", "licenses"]],
  [["language", "linguistic"], ["languages", "language skills"]],
  [["achievement", "award", "honor", "recognition"], ["achievements", "awards", "honors"]],
  [["summary", "objective", "profile", "about", "headline"], ["summary", "profile", "objective", "about me"]],
];

function findTargetSectionHeadings(hint: string): string[] {
  const lower = hint.toLowerCase();
  for (const [triggers, headings] of SECTION_GROUPS) {
    if (triggers.some((t) => lower.includes(t))) return headings;
  }
  return [];
}

function applySuggestionToDraft(draft: string, suggestion: CVSuggestion, suggestedText: string) {
  const current = draft || "";
  const replacement = suggestedText.trim();
  const target = (suggestion.specific_text || "").trim();

  if (target && current.includes(target)) {
    return current.replace(target, replacement || target);
  }
  if (!replacement) return current;

  const hint = `${suggestion.title} ${suggestion.description}`;
  const sectionHeadings = findTargetSectionHeadings(hint);
  for (const heading of sectionHeadings) {
    const lines = current.split("\n");
    const headingIndex = lines.findIndex((l) => l.trim().toLowerCase().replace(/:$/, "") === heading);
    if (headingIndex === -1) continue;
    const sectionEnd = lines.findIndex((l, i) => i > headingIndex && i > headingIndex + 1 && isPlainTextHeadingLine(l));
    const insertAt = sectionEnd === -1 ? lines.length : sectionEnd;
    lines.splice(insertAt, 0, replacement);
    return lines.join("\n");
  }
  const separator = current.trim() ? "\n\n" : "";
  return `${current}${separator}${replacement}`.trim();
}

function isPlainTextHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 40) return false;
  if (/^[A-Z][A-Z\s&/+\-]+:?$/.test(t)) return true;
  const known = ["skills", "experience", "education", "projects", "certifications", "languages", "achievements", "summary", "profile", "work experience", "technical skills"];
  return known.includes(t.toLowerCase().replace(/:$/, "").trim());
}

// ── Apply suggestion to structured CVData ─────────────────────────────────

function applySuggestionToCvData(data: CVData, suggestion: CVSuggestion, suggestedText: string): CVData {
  const text = suggestedText.trim();
  if (!text) return data;

  const cat = suggestion.category;
  const hint = `${suggestion.title} ${suggestion.description}`.toLowerCase();
  const target = (suggestion.specific_text || "").trim();

  // add_keywords → add skills to the most relevant skill group (or create "General")
  if (cat === "add_keywords") {
    const newItems = text.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (newItems.length === 0) return data;
    const skills = [...data.skills];
    if (skills.length > 0) {
      // Add to the first group (usually "General" or the broadest)
      const bestIdx = skills.findIndex((g) =>
        hint.includes(g.category.toLowerCase())
      );
      const idx = bestIdx >= 0 ? bestIdx : 0;
      skills[idx] = { ...skills[idx], items: [...skills[idx].items, ...newItems] };
    } else {
      skills.push({ category: "General", items: newItems });
    }
    return { ...data, skills };
  }

  // rewrite_bullets → find and replace matching bullet in experience
  if (cat === "rewrite_bullets" && target) {
    const experience = data.experience.map((entry) => {
      const bulletIdx = entry.bullets.findIndex((b) => b.includes(target) || target.includes(b));
      if (bulletIdx === -1) return entry;
      const bullets = [...entry.bullets];
      bullets[bulletIdx] = text;
      return { ...entry, bullets };
    });
    return { ...data, experience };
  }

  // improve_headline → update summary
  if (cat === "improve_headline") {
    return {
      ...data,
      personal_info: { ...data.personal_info, summary: text },
    };
  }

  // address_requirements → add as a bullet to the most recent experience entry
  if (cat === "address_requirements") {
    if (data.experience.length === 0) return data;
    const experience = [...data.experience];
    experience[0] = {
      ...experience[0],
      bullets: [...experience[0].bullets, text],
    };
    return { ...data, experience };
  }

  // elevate_experience → add as a bullet to first experience entry
  if (cat === "elevate_experience") {
    if (data.experience.length === 0) return data;
    const experience = [...data.experience];
    experience[0] = {
      ...experience[0],
      bullets: [text, ...experience[0].bullets],
    };
    return { ...data, experience };
  }

  // reduce_irrelevant → try to find and remove matching bullet
  if (cat === "reduce_irrelevant" && target) {
    const experience = data.experience.map((entry) => ({
      ...entry,
      bullets: entry.bullets.filter((b) => !b.includes(target) && !target.includes(b)),
    }));
    return { ...data, experience };
  }

  // Fallback: if hint mentions skills → add to skills, otherwise add as experience bullet
  if (hint.includes("skill") || hint.includes("keyword") || hint.includes("technolog")) {
    const skills = [...data.skills];
    const newItems = text.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (skills.length > 0) {
      skills[0] = { ...skills[0], items: [...skills[0].items, ...newItems] };
    } else {
      skills.push({ category: "General", items: newItems });
    }
    return { ...data, skills };
  }

  if (hint.includes("summary") || hint.includes("profile") || hint.includes("headline")) {
    return { ...data, personal_info: { ...data.personal_info, summary: text } };
  }

  return data;
}
