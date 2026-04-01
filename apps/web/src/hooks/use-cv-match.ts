import { useState } from "react";
import { cvMatchService } from "@/services/cv-match.service";
import type { CVMatchAnalysis, CVSuggestion, CVSuggestionsResponse } from "@/types";

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
  draftHtml: string;
  originalDraftHtml: string;
  draftFileName: string;
  suggestionActions: Record<number, "accepted" | "rejected">;
  /** Draft snapshot saved before each acceptance — used for undo */
  preAcceptSnapshots: Record<number, string>;
  preAcceptHtmlSnapshots: Record<number, string>;
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
    draftHtml: "",
    originalDraftHtml: "",
    draftFileName: "",
    suggestionActions: {},
    preAcceptSnapshots: {},
    preAcceptHtmlSnapshots: {},
  });

  /** Run both analysis and suggestions in parallel. Called explicitly by user action. */
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
      analysis:
        bundle.status === "fulfilled" ? bundle.value.analysis : null,
      suggestions:
        bundle.status === "fulfilled" ? bundle.value.suggestions : null,
      loadingAnalysis: false,
      loadingSuggestions: false,
      loadingDraft: false,
      errorAnalysis:
        bundle.status === "rejected"
          ? "Failed to analyze CV match. Please try again."
          : bundle.value.error_analysis ||
            (bundle.value.analysis.overall_score === 0 &&
            bundle.value.analysis.categories.length === 0
              ? bundle.value.analysis.summary || "Could not generate analysis."
              : null),
      errorSuggestions:
        bundle.status === "rejected"
          ? "Failed to generate suggestions. Please try again."
          : bundle.value.error_suggestions || null,
      draftText: bundle.status === "fulfilled" ? bundle.value.draft.text : "",
      originalDraftText: bundle.status === "fulfilled" ? bundle.value.draft.text : "",
      draftHtml: bundle.status === "fulfilled" ? (bundle.value.draft.html || "") : "",
      originalDraftHtml: bundle.status === "fulfilled" ? (bundle.value.draft.html || "") : "",
      draftFileName: bundle.status === "fulfilled" ? bundle.value.draft.file_name : "",
      errorDraft:
        bundle.status === "rejected"
          ? "Could not load the CV draft for editing."
          : bundle.value.error_draft || null,
    }));
  }

  function updateDraft(text: string) {
    setState((s) => ({ ...s, draftText: text }));
  }

  function updateDraftHtml(html: string) {
    setState((s) => ({ ...s, draftHtml: html }));
  }

  function resetDraft() {
    setState((s) => ({
      ...s,
      draftText: s.originalDraftText,
      draftHtml: s.originalDraftHtml,
      suggestionActions: {},
      preAcceptSnapshots: {},
      preAcceptHtmlSnapshots: {},
    }));
  }

  function acceptSuggestion(index: number, suggestion: CVSuggestion, overrideText?: string) {
    setState((s) => {
      const suggestedText = overrideText ?? suggestion.suggested_text ?? "";
      const nextDraft = applySuggestionToDraft(
        s.draftText,
        suggestion,
        suggestedText,
      );
      const nextDraftHtml = applySuggestionToHtml(
        s.draftHtml,
        suggestion,
        suggestedText,
      );
      return {
        ...s,
        draftText: nextDraft,
        draftHtml: nextDraftHtml,
        suggestionActions: { ...s.suggestionActions, [index]: "accepted" },
        // Snapshot the draft state BEFORE this acceptance so we can undo it
        preAcceptSnapshots: { ...s.preAcceptSnapshots, [index]: s.draftText },
        preAcceptHtmlSnapshots: { ...s.preAcceptHtmlSnapshots, [index]: s.draftHtml },
      };
    });
  }

  /** Restores the draft to the state it was in before suggestion[index] was accepted. */
  function undoAcceptSuggestion(index: number) {
    setState((s) => {
      const snapshot = s.preAcceptSnapshots[index];
      if (snapshot === undefined) return s;
      const htmlSnapshot = s.preAcceptHtmlSnapshots[index];
      const nextSnapshots = { ...s.preAcceptSnapshots };
      delete nextSnapshots[index];
      const nextHtmlSnapshots = { ...s.preAcceptHtmlSnapshots };
      delete nextHtmlSnapshots[index];
      const nextActions = { ...s.suggestionActions };
      delete nextActions[index];
      return {
        ...s,
        draftText: snapshot,
        draftHtml: htmlSnapshot !== undefined ? htmlSnapshot : s.draftHtml,
        suggestionActions: nextActions,
        preAcceptSnapshots: nextSnapshots,
        preAcceptHtmlSnapshots: nextHtmlSnapshots,
      };
    });
  }

  function rejectSuggestion(index: number) {
    setState((s) => ({
      ...s,
      suggestionActions: { ...s.suggestionActions, [index]: "rejected" },
    }));
  }

  /** Clears the action for a suggestion, returning it to the pending (undecided) state. */
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
      const content = state.draftHtml || state.draftText;
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
      draftHtml: "",
      originalDraftHtml: "",
      draftFileName: "",
      suggestionActions: {},
      preAcceptSnapshots: {},
      preAcceptHtmlSnapshots: {},
    });
  }

  return {
    ...state,
    analyze,
    updateDraft,
    updateDraftHtml,
    resetDraft,
    acceptSuggestion,
    undoAcceptSuggestion,
    rejectSuggestion,
    resetSuggestion,
    downloadDraft,
    reset,
  };
}

// Section keyword groups used to find the insertion point for "add" type suggestions
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

  // Replace mode: specific text is provided
  if (target && current.includes(target)) {
    return current.replace(target, replacement || target);
  }

  if (!replacement) return current;

  // Add mode: try to insert after the relevant section heading
  const hint = `${suggestion.title} ${suggestion.description}`;
  const sectionHeadings = findTargetSectionHeadings(hint);

  for (const heading of sectionHeadings) {
    const lines = current.split("\n");
    const headingIndex = lines.findIndex((l) =>
      l.trim().toLowerCase().replace(/:$/, "") === heading,
    );
    if (headingIndex === -1) continue;

    // Find the next section heading after this one (ALL_CAPS or known heading)
    const sectionEnd = lines.findIndex(
      (l, i) => i > headingIndex && i > headingIndex + 1 && isPlainTextHeadingLine(l),
    );
    const insertAt = sectionEnd === -1 ? lines.length : sectionEnd;
    lines.splice(insertAt, 0, replacement);
    return lines.join("\n");
  }

  // Fallback: append at the end
  const separator = current.trim() ? "\n\n" : "";
  return `${current}${separator}${replacement}`.trim();
}

function applySuggestionToHtml(html: string, suggestion: CVSuggestion, suggestedText: string): string {
  const current = html || "";
  const replacement = suggestedText.trim();
  const target = (suggestion.specific_text || "").trim();

  // Replace mode
  if (target && current.includes(target)) {
    return current.replace(target, replacement || target);
  }

  if (!replacement) return current;

  // Add mode: find the relevant section in HTML and insert inside it
  const hint = `${suggestion.title} ${suggestion.description}`;
  const sectionHeadings = findTargetSectionHeadings(hint);

  for (const heading of sectionHeadings) {
    // Match <h1>Skills</h1> or <h2>Technical Skills</h2> etc.
    const pattern = new RegExp(
      `(<h[1-6][^>]*>[^<]*${escapeRegex(heading)}[^<]*<\/h[1-6]>)`,
      "i",
    );
    const match = current.match(pattern);
    if (!match || match.index === undefined) continue;

    const afterHeadingPos = match.index + match[0].length;
    const rest = current.slice(afterHeadingPos);

    // Try inserting into the last <li> before the closing </ul> or </ol>
    const listCloseMatch = rest.match(/<\/(ul|ol)>/);
    if (listCloseMatch && listCloseMatch.index !== undefined) {
      const insertPos = afterHeadingPos + listCloseMatch.index;
      return current.slice(0, insertPos) + `<li>${replacement}</li>` + current.slice(insertPos);
    }

    // No list — insert as <p> before the next heading or end of section
    const nextHeadingMatch = rest.match(/<h[1-6]/);
    const blockEnd = nextHeadingMatch?.index ?? rest.length;
    const insertPos = afterHeadingPos + blockEnd;
    return current.slice(0, insertPos) + `<p>${replacement}</p>` + current.slice(insertPos);
  }

  // Fallback: append at the end
  return current + `<p>${replacement}</p>`;
}

function isPlainTextHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.length > 40) return false;
  if (/^[A-Z][A-Z\s&/+\-]+:?$/.test(t)) return true;
  const known = ["skills", "experience", "education", "projects", "certifications", "languages", "achievements", "summary", "profile", "work experience", "technical skills"];
  return known.includes(t.toLowerCase().replace(/:$/, "").trim());
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
