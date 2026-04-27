import { useState } from "react";
import { cvMatchService } from "@/services/cv-match.service";
import { documentService } from "@/services/document.service";
import { analyticsEventsService } from "@/services/analytics-events.service";
import { useTour } from "@/contexts/TourContext";
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
  savingCvData: boolean;
  cvDataSaved: boolean;
  // ── ATS Preview ──
  atsPreview: CVMatchAnalysis | null;
  atsPreviewBaseline: number | null;
  loadingAtsPreview: boolean;
  // ── Context (for analytics tracking) ──
  jobUrl: string;
  cvUrl: string;
  cvName: string;
}

export function useCVMatch() {
  const { active: tourActive } = useTour();
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
    savingCvData: false,
    cvDataSaved: false,
    atsPreview: null,
    atsPreviewBaseline: null,
    loadingAtsPreview: false,
    jobUrl: "",
    cvUrl: "",
    cvName: "",
  });

  async function analyze(jobUrl: string, cvUrl: string, cvName?: string) {
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
      jobUrl,
      cvUrl,
      cvName: cvName ?? s.cvName,
    }));

    const bundleResult = await Promise.allSettled([cvMatchService.getBundle(jobUrl, cvUrl, undefined, tourActive)]);
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

    if (bundle.status === "fulfilled") {
      analyticsEventsService.trackCvAnalyzed({
        cv_url: cvUrl,
        cv_name: cvName ?? "",
        job_url: jobUrl,
        job_title: bundle.value.suggestions?.job_title ?? "",
        company: bundle.value.suggestions?.job_company ?? "",
        overall_score: bundle.value.analysis.overall_score,
        match_level: bundle.value.analysis.match_level,
      });
    }
  }

  /**
   * Use a pre-computed analysis (e.g. from the sidebar comparison list) and only
   * fetch suggestions + draft text — avoids a redundant scoring API call.
   */
  async function analyzeWithSeededResult(jobUrl: string, cvUrl: string, seededAnalysis: CVMatchAnalysis, cvName?: string) {
    setState((s) => ({
      ...s,
      analysis: seededAnalysis,
      loadingAnalysis: false,
      loadingSuggestions: true,
      loadingDraft: true,
      errorAnalysis: null,
      errorSuggestions: null,
      errorDraft: null,
      analyzed: true,
      suggestionActions: {},
      jobUrl,
      cvUrl,
      cvName: cvName ?? s.cvName,
    }));

    const [suggestionsResult, draftResult] = await Promise.allSettled([
      cvMatchService.getSuggestions(jobUrl, cvUrl),
      cvMatchService.getDraft(cvUrl),
    ]);

    setState((s) => ({
      ...s,
      suggestions: suggestionsResult.status === "fulfilled" ? suggestionsResult.value : null,
      loadingSuggestions: false,
      errorSuggestions:
        suggestionsResult.status === "rejected"
          ? "Failed to generate suggestions. Please try again."
          : null,
      draftText: draftResult.status === "fulfilled" ? draftResult.value.text : "",
      originalDraftText: draftResult.status === "fulfilled" ? draftResult.value.text : "",
      draftFileName: draftResult.status === "fulfilled" ? draftResult.value.file_name : "",
      loadingDraft: false,
      errorDraft: draftResult.status === "rejected" ? "Could not load the CV draft for editing." : null,
    }));

    analyticsEventsService.trackCvAnalyzed({
      cv_url: cvUrl,
      cv_name: cvName ?? "",
      job_url: jobUrl,
      job_title: suggestionsResult.status === "fulfilled" ? (suggestionsResult.value?.job_title ?? "") : "",
      company: suggestionsResult.status === "fulfilled" ? (suggestionsResult.value?.job_company ?? "") : "",
      overall_score: seededAnalysis.overall_score,
      match_level: seededAnalysis.match_level,
    });
  }

  // ── Structured CV parsing & generation ──────────────────────────────────

  async function parseCv(cvUrl: string) {
    setState((s) => ({ ...s, loadingParse: true }));
    try {
      const { data, cv_name } = await documentService.parseCv(cvUrl, tourActive);
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
    setState((s) => ({
      ...s,
      cvData: s.originalCvData
        ? { ...s.originalCvData, personal_info: { ...s.originalCvData.personal_info, photo: s.cvData?.personal_info.photo } }
        : s.cvData,
    }));
  }

  async function previewAtsScore(jobUrl: string) {
    if (!state.cvData || !state.analysis) return;
    const editedText = cvDataToText(state.cvData);
    // Determine which CV match categories were actually touched by accepted suggestions
    const touchedMatchCategories = new Set<string>();
    for (const [idx, action] of Object.entries(state.suggestionActions)) {
      if (action !== "accepted") continue;
      const suggestion = state.suggestions?.suggestions[Number(idx)];
      if (!suggestion) continue;
      switch (suggestion.category) {
        case "add_keywords":
          touchedMatchCategories.add("keywords");
          touchedMatchCategories.add("skills");
          break;
        case "rewrite_bullets":
        case "elevate_experience":
        case "reduce_irrelevant":
        case "address_requirements":
        case "address_gaps":
          touchedMatchCategories.add("experience");
          break;
        case "improve_headline":
          touchedMatchCategories.add("skills");
          break;
      }
    }
    setState((s) => ({ ...s, loadingAtsPreview: true, atsPreview: null, atsPreviewBaseline: null }));
    try {
      const previewResult = await cvMatchService.matchFromText(jobUrl, editedText);
      // Pin untouched categories to the baseline to prevent spurious drift
      const baselineCategories = state.analysis.categories;
      const correctedCategories = previewResult.categories.map((cat) => {
        if (touchedMatchCategories.has(cat.category)) return cat;
        const baseline = baselineCategories.find((b) => b.category === cat.category);
        return baseline ? { ...cat, score: baseline.score } : cat;
      });
      // Recompute overall as average of corrected category scores (same weight as backend)
      const correctedOverall = correctedCategories.length > 0
        ? Math.round(correctedCategories.reduce((sum, c) => sum + c.score, 0) / correctedCategories.length)
        : previewResult.overall_score;
      setState((s) => {
        analyticsEventsService.trackImpactChecked({
          cv_name: s.cvName,
          job_url: jobUrl,
          score_before: s.analysis!.overall_score,
          score_after: correctedOverall,
        });
        return {
          ...s,
          atsPreviewBaseline: s.analysis!.overall_score,
          atsPreview: { ...previewResult, categories: correctedCategories, overall_score: correctedOverall },
          loadingAtsPreview: false,
        };
      });
    } catch {
      setState((s) => ({ ...s, loadingAtsPreview: false }));
    }
  }

  function dismissAtsPreview() {
    setState((s) => ({ ...s, atsPreview: null, atsPreviewBaseline: null }));
  }

  /** Seed only the analysis score into state — does NOT fetch suggestions or draft. */
  function seedAnalysis(analysis: CVMatchAnalysis) {
    setState((s) => ({
      ...s,
      analysis,
      loadingAnalysis: false,
      loadingSuggestions: false,
      loadingDraft: false,
      errorAnalysis: null,
      errorSuggestions: null,
      analyzed: true,
      suggestions: null, // cleared so UI shows the "Generate" CTA
    }));
  }

  /** Fetch fresh suggestions on demand (bypasses bundle cache — uses /cv-suggestions directly). */
  async function generateSuggestions(jobUrl: string, cvUrl: string) {
    setState((s) => ({ ...s, loadingSuggestions: true, errorSuggestions: null, suggestions: null }));
    try {
      const result = await cvMatchService.getSuggestions(jobUrl, cvUrl);
      setState((s) => ({ ...s, suggestions: result, loadingSuggestions: false }));
    } catch {
      setState((s) => ({
        ...s,
        loadingSuggestions: false,
        errorSuggestions: "Failed to generate suggestions. Please try again.",
      }));
    }
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

  async function saveCvData(cvUrl: string) {
    if (!state.cvData) return;
    setState((s) => ({ ...s, savingCvData: true, cvDataSaved: false }));
    try {
      await documentService.saveCvData(cvUrl, state.cvData, state.draftFileName);
      setState((s) => ({ ...s, savingCvData: false, cvDataSaved: true, originalCvData: s.cvData }));
      setTimeout(() => setState((s) => ({ ...s, cvDataSaved: false })), 3000);
    } catch {
      setState((s) => ({ ...s, savingCvData: false }));
    }
  }

  /**
   * Re-score the current (saved) CV against the job and update state.analysis.
   * Call this after saveCvData resolves to reflect the new score in the workspace header and sidebar.
   */
  async function rescoreAfterSave(jobUrl: string): Promise<CVMatchAnalysis | null> {
    if (!state.cvData) return null;
    const editedText = cvDataToText(state.cvData);
    try {
      const result = await cvMatchService.matchFromText(jobUrl, editedText);
      setState((s) => ({ ...s, analysis: result }));
      return result;
    } catch {
      return null;
    }
  }

  // ── Draft editing ──────────────────────────────────────────────────────

  function updateDraft(text: string) {
    setState((s) => ({ ...s, draftText: text }));
  }

  function resetDraft() {
    setState((s) => {
      const currentPhoto = s.cvData?.personal_info.photo;
      return {
        ...s,
        draftText: s.originalDraftText,
        cvData: s.originalCvData
          ? { ...s.originalCvData, personal_info: { ...s.originalCvData.personal_info, photo: currentPhoto } }
          : s.cvData,
        suggestionActions: {},
        preAcceptSnapshots: {},
        preAcceptCvSnapshots: {},
      };
    });
  }

  function acceptSuggestion(index: number, suggestion: CVSuggestion, overrideText?: string) {
    setState((s) => {
      // Clean AI instruction prefixes only when using the original suggestion text,
      // not when the user has manually edited the field.
      const suggestedText = overrideText != null
        ? overrideText
        : cleanSuggestionText(suggestion.suggested_text ?? "");
      const nextDraft = applySuggestionToDraft(s.draftText, suggestion, suggestedText);
      const nextCvData = s.cvData ? applySuggestionToCvData(s.cvData, suggestion, suggestedText) : s.cvData;
      analyticsEventsService.trackSuggestionApplied({
        cv_name: s.cvName,
        job_url: s.jobUrl,
        category: suggestion.category,
        priority: suggestion.priority,
      });
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
      // Preserve the current photo across undo — photo is never part of suggestions
      const currentPhoto = s.cvData?.personal_info.photo;
      const restoredCv = cvSnapshot
        ? { ...cvSnapshot, personal_info: { ...cvSnapshot.personal_info, photo: currentPhoto } }
        : s.cvData;
      return {
        ...s,
        draftText: snapshot,
        cvData: restoredCv,
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
      savingCvData: false,
      cvDataSaved: false,
      atsPreview: null,
      atsPreviewBaseline: null,
      loadingAtsPreview: false,
      jobUrl: "",
      cvUrl: "",
      cvName: "",
    });
  }

  return {
    ...state,
    analyze,
    analyzeWithSeededResult,
    seedAnalysis,
    generateSuggestions,
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
    saveCvData,
    rescoreAfterSave,
    previewAtsScore,
    dismissAtsPreview,
    reset,
  };
}

// ── CVData → plain text (for ATS re-analysis) ───────────────────────────────

function cvDataToText(data: CVData): string {
  const lines: string[] = [];
  const pi = data.personal_info;
  if (pi.full_name) lines.push(pi.full_name);
  if (pi.summary) lines.push(`\nSummary\n${pi.summary}`);

  if (data.experience.length > 0) {
    lines.push("\nExperience");
    for (const e of data.experience) {
      lines.push(`${e.title} at ${e.company} (${e.start_date} – ${e.end_date || "Present"})`);
      for (const b of e.bullets) lines.push(`- ${b}`);
    }
  }

  if (data.education.length > 0) {
    lines.push("\nEducation");
    for (const e of data.education) {
      const field = e.field_of_study ? ` in ${e.field_of_study}` : "";
      lines.push(`${e.degree}${field} at ${e.institution}`);
    }
  }

  if (data.skills.length > 0) {
    lines.push("\nSkills");
    for (const g of data.skills) {
      lines.push(`${g.category}: ${g.items.join(", ")}`);
    }
  }

  if (data.languages.length > 0) {
    lines.push("\nLanguages");
    lines.push(data.languages.map((l) => `${l.language} (${l.level})`).join(", "));
  }

  if (data.certifications.length > 0) {
    lines.push("\nCertifications");
    for (const c of data.certifications) {
      lines.push(`${c.name} — ${c.issuer}${c.date ? ` (${c.date})` : ""}`);
    }
  }

  for (const [section, entries] of Object.entries(data.additional_sections ?? {})) {
    if (!Array.isArray(entries) || entries.length === 0) continue;
    lines.push(`\n${section}`);
    for (const entry of entries) {
      const header = [entry.title, entry.subtitle, entry.date].filter(Boolean).join(" · ");
      if (header) lines.push(header);
      for (const bullet of entry.bullets ?? []) lines.push(`- ${bullet}`);
    }
  }

  return lines.join("\n");
}

// ── Suggestion text sanitisation ────────────────────────────────────────────

/**
 * Strip AI instruction prefixes that the backend sometimes includes in
 * suggestion text verbatim.
 *
 * Examples:
 *   "Add to skills: React"              → "React"
 *   "Add the following skills: Agile"   → "Agile"
 *   "Include: Next.js"                  → "Next.js"
 *   "Consider adding: Docker"           → "Docker"
 *   "Add to experience: Led a team…"    → "Led a team…"
 */
const BULLET_GLYPH_CHARS = "\\u25A0\\u25A1\\u25AA\\u25AB\\u25CF\\u25CB\\u25C6\\u25C7\\u25B8\\u25B6\\u25BA\\u2B1B\\u2B1C\\u2756\\u00B7";
const BULLET_GLYPH_RE = new RegExp(`[${BULLET_GLYPH_CHARS}]`, "g");
const BULLET_SPLIT_RE = new RegExp(`\\s*[${BULLET_GLYPH_CHARS}]\\s*|\\s*\\n+\\s*`, "g");
const LEADING_LABEL_RE = /^[A-Z][A-Z0-9\s&/+\-]{2,}?(?:\s{2,}|[:—–-]\s+|\s(?=[A-Z][a-z]))/;

function cleanSuggestionText(text: string): string {
  let out = text
    .replace(BULLET_GLYPH_RE, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[-•*]\s+/, "")
    .replace(/^add\s+to\s+\w[\w\s]*\s*:\s*/i, "")
    .replace(/^(?:add|include|consider\s+adding)\s+(?:the\s+)?(?:following\s+)?(?:skills?|keywords?|items?|bullet[s]?)\s*:\s*/i, "")
    .replace(/^include\s*:\s*/i, "")
    .replace(/^consider\s+adding\s*:\s*/i, "")
    .trim();
  const labelMatch = out.match(LEADING_LABEL_RE);
  if (labelMatch && labelMatch[0].length < out.length - 10) {
    out = out.slice(labelMatch[0].length).trim();
  }
  return out;
}

function splitBulletText(text: string): string[] {
  if (!text) return [];
  return text
    .split(BULLET_SPLIT_RE)
    .map((s) => cleanSuggestionText(s))
    .filter((s) => s.length > 0);
}

function dedupeBullet(existing: string[], candidate: string): boolean {
  const norm = candidate.trim().toLowerCase();
  if (!norm) return false;
  return !existing.some((b) => {
    const n = b.trim().toLowerCase();
    return n === norm || n.includes(norm) || norm.includes(n);
  });
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

  // For experience-targeting categories, if the text is headline-like,
  // route it to the Summary section in the draft instead.
  const cat = suggestion.category;
  let hint = `${suggestion.title} ${suggestion.description}`;
  if (
    (cat === "elevate_experience" || cat === "address_requirements" || cat === "address_gaps") &&
    isHeadlineLike(replacement) &&
    !isExperienceBullet(replacement)
  ) {
    hint = "summary profile";
  }

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

/**
 * Detect whether a piece of suggested text reads like a professional
 * summary/headline rather than an experience bullet point.
 *
 * Examples that return true:
 *   "Frontend Developer with 2.5 years of experience…"
 *   "A passionate software engineer skilled in…"
 *   "5+ years of experience building…"
 */
function isHeadlineLike(text: string): boolean {
  const t = text.trim();
  // Contains "X years of experience"
  if (/\d+\.?\d*\+?\s+years?\s+of\s+experience/i.test(t)) return true;
  // Starts with a job title
  if (/^(frontend|back-?end|full[- ]stack|senior|junior|lead|principal|staff|software|web)\s+(developer|engineer|designer|architect)/i.test(t)) return true;
  // Starts with self-description phrases
  if (/^(i am|i'm|a dedicated|an experienced|a passionate|a skilled|a results?-driven|a motivated)/i.test(t.toLowerCase())) return true;
  return false;
}

/**
 * Detect whether text is a genuine experience bullet:
 * starts with a strong action verb and describes a concrete achievement.
 */
function isExperienceBullet(text: string): boolean {
  const actionVerbs = /^(designed|developed|built|created|implemented|led|managed|architected|delivered|optimized|improved|reduced|increased|launched|migrated|refactored|automated|integrated|established|drove|owned|scaled|shipped)/i;
  return actionVerbs.test(text.trim());
}

function applySuggestionToCvData(data: CVData, suggestion: CVSuggestion, suggestedText: string): CVData {
  const text = cleanSuggestionText(suggestedText);
  if (!text) return data;

  const cat = suggestion.category;
  const hint = `${suggestion.title} ${suggestion.description}`.toLowerCase();
  const target = (suggestion.specific_text || "").trim();

  // add_keywords → add skills to the most relevant skill group (or create "General")
  if (cat === "add_keywords") {
    const rawItems = text.split(/[,;]/).map((s) => cleanSuggestionText(s)).filter(Boolean);
    const filtered = rawItems.filter((s) => s.split(/\s+/).length <= 5 && s.length <= 50);
    const existingAll = new Set(
      data.skills.flatMap((g) => g.items.map((i) => i.trim().toLowerCase()))
    );
    const newItems = filtered.filter((s) => !existingAll.has(s.trim().toLowerCase()));
    if (newItems.length === 0) return data;
    const skills = [...data.skills];
    if (skills.length > 0) {
      const bestIdx = skills.findIndex((g) => hint.includes(g.category.toLowerCase()));
      const idx = bestIdx >= 0 ? bestIdx : 0;
      skills[idx] = { ...skills[idx], items: [...skills[idx].items, ...newItems] };
    } else {
      skills.push({ category: "General", items: newItems });
    }
    return { ...data, skills };
  }

  // rewrite_bullets → replace matched bullet; if text contains multiple bullets, insert the rest right after
  if (cat === "rewrite_bullets" && target) {
    const pieces = splitBulletText(text);
    if (pieces.length === 0) return data;
    const experience = data.experience.map((entry) => {
      const bulletIdx = entry.bullets.findIndex((b) => b.includes(target) || target.includes(b));
      if (bulletIdx === -1) return entry;
      const bullets = [...entry.bullets];
      const [first, ...rest] = pieces;
      bullets[bulletIdx] = first;
      const insertions = rest.filter((p) => dedupeBullet(bullets, p));
      bullets.splice(bulletIdx + 1, 0, ...insertions);
      return { ...entry, bullets };
    });
    return { ...data, experience };
  }

  // improve_headline → always update summary (single clean paragraph)
  if (cat === "improve_headline") {
    return { ...data, personal_info: { ...data.personal_info, summary: text } };
  }

  // address_requirements / address_gaps → append bullets to the most recent experience entry.
  // If the text reads like a headline/summary, route it to the summary field instead.
  if (cat === "address_requirements" || cat === "address_gaps") {
    if (isHeadlineLike(text) && !isExperienceBullet(text)) {
      return { ...data, personal_info: { ...data.personal_info, summary: text } };
    }
    if (data.experience.length === 0) return data;
    const pieces = splitBulletText(text);
    if (pieces.length === 0) return data;
    const experience = [...data.experience];
    const current = [...experience[0].bullets];
    for (const p of pieces) {
      if (dedupeBullet(current, p)) current.push(p);
    }
    experience[0] = { ...experience[0], bullets: current };
    return { ...data, experience };
  }

  // elevate_experience → prepend bullets to the most recent experience entry.
  if (cat === "elevate_experience") {
    if (isHeadlineLike(text) && !isExperienceBullet(text)) {
      return { ...data, personal_info: { ...data.personal_info, summary: text } };
    }
    if (data.experience.length === 0) return data;
    const pieces = splitBulletText(text);
    if (pieces.length === 0) return data;
    const experience = [...data.experience];
    const current = [...experience[0].bullets];
    const fresh = pieces.filter((p) => dedupeBullet(current, p));
    experience[0] = { ...experience[0], bullets: [...fresh, ...current] };
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

  // Fallback: route by content shape
  if (isHeadlineLike(text)) {
    return { ...data, personal_info: { ...data.personal_info, summary: text } };
  }

  if (hint.includes("skill") || hint.includes("keyword") || hint.includes("technolog")) {
    const newItems = text.split(/[,;]/).map((s) => cleanSuggestionText(s)).filter(Boolean)
      .filter((s) => s.split(/\s+/).length <= 5 && s.length <= 50);
    if (newItems.length === 0) return data;
    const existingAll = new Set(
      data.skills.flatMap((g) => g.items.map((i) => i.trim().toLowerCase()))
    );
    const fresh = newItems.filter((s) => !existingAll.has(s.trim().toLowerCase()));
    if (fresh.length === 0) return data;
    const skills = [...data.skills];
    if (skills.length > 0) {
      skills[0] = { ...skills[0], items: [...skills[0].items, ...fresh] };
    } else {
      skills.push({ category: "General", items: fresh });
    }
    return { ...data, skills };
  }

  if (hint.includes("summary") || hint.includes("profile") || hint.includes("headline")) {
    return { ...data, personal_info: { ...data.personal_info, summary: text } };
  }

  return data;
}
