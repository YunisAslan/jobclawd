"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  Download,
  ExternalLink,
  FileText,
  RotateCcw,
  Check,
  Undo2,
  CheckCircle2,
  PenLine,
  Eye,
} from "lucide-react";
import type { CVSuggestion, CVSuggestionsResponse } from "@/types";

interface CVWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cvName: string;
  cvUrl: string;
  draftText: string;
  draftHtml: string;
  loading: boolean;
  downloading: boolean;
  onDraftChange: (text: string) => void;
  onDraftHtmlChange: (html: string) => void;
  onReset: () => void;
  onDownload: () => void | Promise<void>;
  suggestions: CVSuggestionsResponse | null;
  loadingSuggestions: boolean;
  suggestionActions: Record<number, "accepted" | "rejected">;
  onAcceptSuggestion: (index: number, suggestion: CVSuggestion, overrideText?: string) => void;
  onUndoAcceptSuggestion: (index: number) => void;
  onRejectSuggestion: (index: number) => void;
  onResetSuggestion: (index: number) => void;
}

export default function CVWorkspaceDialog({
  open,
  onOpenChange,
  cvName,
  cvUrl,
  draftHtml,
  loading,
  downloading,
  onDraftHtmlChange,
  onReset,
  onDownload,
  suggestions,
  loadingSuggestions,
  suggestionActions,
  onAcceptSuggestion,
  onUndoAcceptSuggestion,
  onRejectSuggestion,
  onResetSuggestion,
}: CVWorkspaceDialogProps) {
  const fileType = inferCVFileType(cvUrl);

  // ── Editor ref and reset key ──
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const prevDraftHtmlRef = useRef(draftHtml);

  // Detect when draftHtml changes externally (suggestion applied) and force editor remount
  if (prevDraftHtmlRef.current !== draftHtml) {
    prevDraftHtmlRef.current = draftHtml;
    setEditorResetKey((k) => k + 1);
  }

  // ── Suggestions local state sync ──
  const [syncedSuggestions, setSyncedSuggestions] = useState(suggestions);
  const [editedSuggestions, setEditedSuggestions] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const [i, s] of (suggestions?.suggestions ?? []).entries()) {
      // For "add" suggestions (no specific_text), pre-fill with the extracted quoted value
      init[i] = s.specific_text ? (s.suggested_text ?? "") : extractQuotedValue(s.suggested_text ?? "");
    }
    return init;
  });
  if (syncedSuggestions !== suggestions) {
    setSyncedSuggestions(suggestions);
    const next: Record<number, string> = {};
    for (const [i, s] of (suggestions?.suggestions ?? []).entries()) {
      next[i] = s.specific_text ? (s.suggested_text ?? "") : extractQuotedValue(s.suggested_text ?? "");
    }
    setEditedSuggestions(next);
  }

  // ── Preview mode ──
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [previewRendering, setPreviewRendering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewMode !== "preview" || !cvUrl) return;
    if (fileType !== "docx") return; // PDF handled by <iframe>

    let cancelled = false;
    setPreviewRendering(true);
    setPreviewError(null);

    const resolvedUrl = resolveCVUrl(cvUrl);

    async function render() {
      const response = await fetch(resolvedUrl, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Could not load file (HTTP ${response.status}). Make sure the file exists and try again.`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html") || contentType.includes("application/json")) {
        throw new Error("The server returned an unexpected response instead of the document file.");
      }
      const buffer = await response.arrayBuffer();
      if (cancelled || !previewRef.current) return;
      const { renderAsync } = await import("docx-preview");
      previewRef.current.innerHTML = "";
      await renderAsync(buffer, previewRef.current, undefined, {
        inWrapper: false,
        ignoreWidth: true,
      });
    }

    render()
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to render document.";
          setPreviewError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewMode, cvUrl, fileType]);

  // Reset to edit mode when dialog closes
  useEffect(() => {
    if (!open) setViewMode("edit");
  }, [open]);

  const appliedCount = Object.values(suggestionActions).filter((v) => v === "accepted").length;
  const declinedCount = Object.values(suggestionActions).filter((v) => v === "rejected").length;
  const suggestionList = suggestions?.suggestions ?? [];

  const canPreview = fileType === "docx" || fileType === "pdf";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-none w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border/50 shrink-0 bg-background">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold leading-none">CV Editor</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1 truncate max-w-xs">
                {cvName}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pr-8">
            <Badge variant="outline" className="text-[10px] font-medium hidden sm:inline-flex">
              {labelForFileType(fileType)}
            </Badge>

            {/* Edit / Preview toggle */}
            {canPreview && (
              <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("edit")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    viewMode === "edit"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <PenLine className="size-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    viewMode === "preview"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Eye className="size-3" /> Preview original
                </button>
              </div>
            )}

            <div className="h-4 w-px bg-border/40 hidden sm:block" />
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onReset} disabled={loading}>
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={onDownload} disabled={loading || downloading}>
              <Download className="size-3.5" />
              {downloading ? "Preparing…" : "Download"}
            </Button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-hidden flex">

          {/* ── Left: Suggestions panel ── */}
          <aside className="w-80 flex-none border-r border-border/50 flex flex-col overflow-hidden bg-background">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-2 shrink-0">
              <p className="text-xs font-semibold text-foreground">Suggestions</p>
              <div className="flex items-center gap-1.5">
                {appliedCount > 0 && (
                  <Badge className="text-[10px] font-medium bg-emerald-100 text-emerald-700 border-emerald-200 border">
                    {appliedCount} applied
                  </Badge>
                )}
                {suggestionList.length > 0 && (
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {suggestionList.length}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
              {loadingSuggestions && (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                  <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                  Loading suggestions…
                </div>
              )}

              {!loadingSuggestions && suggestionList.length === 0 && (
                <div className="text-center py-10 px-4 text-xs text-muted-foreground">
                  Run CV analysis from the panel to see suggestions here.
                </div>
              )}

              {suggestionList.map((suggestion, index) => {
                const action = suggestionActions[index];
                const isAccepted = action === "accepted";
                const isDeclined = action === "rejected";
                const priorityDot =
                  suggestion.priority === "high" ? "bg-red-500"
                  : suggestion.priority === "medium" ? "bg-amber-400"
                  : "bg-slate-400";

                return (
                  <div
                    key={index}
                    className={cn(
                      "rounded-lg border p-3 space-y-2 transition-all",
                      isAccepted && "border-emerald-200 bg-emerald-50/40",
                      isDeclined && "opacity-50 border-border/30",
                      !isAccepted && !isDeclined && "border-border/50",
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className={cn("mt-1.5 size-1.5 rounded-full shrink-0", priorityDot)} />
                      <p className="text-xs font-semibold text-foreground leading-snug flex-1 min-w-0">
                        {suggestion.title}
                      </p>
                      {isAccepted && (
                        <Badge className="shrink-0 text-[9px] font-semibold px-1.5 py-0 bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Applied
                        </Badge>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 pl-3">
                      {suggestion.description}
                    </p>

                    {!isDeclined && (suggestion.specific_text || suggestion.suggested_text) && (
                      <div className="rounded border overflow-hidden text-[10px] font-mono ml-3">
                        {suggestion.specific_text && (
                          <div className="flex gap-1.5 px-2 py-1.5 bg-red-50 border-b border-red-100">
                            <span className="text-red-400 font-bold shrink-0">−</span>
                            <span className="text-red-600/70 line-through wrap-break-word leading-4">{suggestion.specific_text}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-50">
                          <span className="text-emerald-500 font-bold shrink-0">+</span>
                          {suggestion.specific_text ? (
                            // Replace type: show static text
                            <span className="text-emerald-700/80 wrap-break-word leading-4">{suggestion.suggested_text}</span>
                          ) : (
                            // Add type: show editable input so user types exactly what to insert
                            <input
                              type="text"
                              value={editedSuggestions[index] ?? ""}
                              onChange={(e) => setEditedSuggestions((prev) => ({ ...prev, [index]: e.target.value }))}
                              placeholder="Type text to add…"
                              className="flex-1 bg-transparent outline-none text-emerald-700 placeholder:text-emerald-400/60 text-[10px] leading-4"
                            />
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-1.5 pl-3">
                      {isAccepted ? (
                        <>
                          <p className="flex-1 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Applied
                          </p>
                          <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2"
                            onClick={() => onUndoAcceptSuggestion(index)}>
                            <Undo2 className="size-2.5" /> Undo
                          </Button>
                        </>
                      ) : isDeclined ? (
                        <Button type="button" size="sm" variant="ghost"
                          className="text-[10px] text-muted-foreground h-6 px-2"
                          onClick={() => onResetSuggestion(index)}>
                          Reconsider
                        </Button>
                      ) : (
                        <>
                          <Button type="button" size="sm" className="flex-1 h-6 text-[10px] gap-1"
                            onClick={() => onAcceptSuggestion(index, suggestion, editedSuggestions[index] ?? suggestion.suggested_text ?? "")}>
                            <Check className="size-3" /> Apply
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="flex-1 h-6 text-[10px]"
                            onClick={() => onRejectSuggestion(index)}>
                            Decline
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-border/40 shrink-0">
              <p className="text-[11px] text-muted-foreground">
                {appliedCount} applied · {declinedCount} declined
              </p>
            </div>
          </aside>

          {/* ── Right: Document area ── */}
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-100">

            {/* ── Edit mode ── */}
            {viewMode === "edit" && (
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Loading editor…
                  </div>
                ) : (
                  <div className="px-8 py-10">
                    <div className="mx-auto max-w-175 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.09)]">

                      {/* Document header */}
                      <div className="px-16 pt-14 pb-8 border-b border-slate-100">
                        <p
                          className="text-xl font-bold text-slate-900 leading-tight"
                          style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
                        >
                          {cvName}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <PaperBadge>{labelForFileType(fileType)}</PaperBadge>
                        </div>
                      </div>

                      {/* Editor area */}
                      <div className="px-16 pt-10 pb-16">
                        {/* Formatting toolbar */}
                        <div className="flex items-center gap-1 mb-4 pb-3 border-b border-slate-100">
                          {[
                            { label: "B", cmd: "bold", style: "font-bold" },
                            { label: "I", cmd: "italic", style: "italic" },
                            { label: "U", cmd: "underline", style: "underline" },
                          ].map(({ label, cmd, style }) => (
                            <button
                              key={cmd}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); }}
                              className={`w-7 h-7 rounded text-xs border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center ${style}`}
                            >
                              {label}
                            </button>
                          ))}
                          <div className="w-px h-4 bg-slate-200 mx-1" />
                          {[
                            { label: "• List", cmd: "insertUnorderedList" },
                            { label: "1. List", cmd: "insertOrderedList" },
                          ].map(({ label, cmd }) => (
                            <button
                              key={cmd}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); }}
                              className="px-2 h-7 rounded text-xs border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center"
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* Contenteditable HTML editor */}
                        <div
                          key={editorResetKey}
                          ref={editorRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={() => {
                            const html = editorRef.current?.innerHTML ?? "";
                            onDraftHtmlChange(html);
                          }}
                          className="outline-none min-h-48 text-slate-800 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_strong]:font-bold [&_em]:italic"
                          style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: "13.5px", lineHeight: "1.7" }}
                          dangerouslySetInnerHTML={{ __html: draftHtml || "" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Preview mode ── */}
            {viewMode === "preview" && (
              <div className="flex-1 overflow-auto">
                {fileType === "pdf" && (
                  <iframe
                    src={resolveCVUrl(cvUrl)}
                    className="w-full h-full border-0"
                    title="CV Preview"
                  />
                )}

                {fileType === "docx" && (
                  <div className="px-8 py-10 min-h-full">
                    {previewRendering && (
                      <div className="flex items-center justify-center h-40 gap-2 text-sm text-muted-foreground">
                        <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Rendering document…
                      </div>
                    )}
                    {previewError && !previewRendering && (
                      <div className="mx-auto max-w-175 flex flex-col items-center justify-center gap-3 py-16 px-8 text-center">
                        <FileText className="size-10 opacity-20" />
                        <p className="text-sm font-medium text-foreground">Preview unavailable</p>
                        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">{previewError}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5 mt-2"
                          onClick={() => window.open(resolveCVUrl(cvUrl), "_blank")}
                        >
                          <ExternalLink className="size-3.5" /> Open in new tab
                        </Button>
                      </div>
                    )}
                    {!previewError && (
                      <div
                        ref={previewRef}
                        className={cn(
                          "mx-auto max-w-175 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.09)] px-16 py-14",
                          "[&_.docx-wrapper]:bg-transparent! [&_.docx-wrapper]:p-0!",
                          previewRendering && "invisible",
                        )}
                      />
                    )}
                  </div>
                )}

                {fileType === "link" && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-sm text-muted-foreground">
                    <FileText className="size-10 opacity-30" />
                    <p>Preview is not available for externally linked CVs.</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Sub-components ── */

function PaperBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
      {children}
    </span>
  );
}

/* ── Utilities ── */

/** Extract the first quoted value from a description like "Add 'VTEX' to skills" → "VTEX" */
function extractQuotedValue(text: string): string {
  const match = text.match(/'([^']+)'|"([^"]+)"/);
  return match ? (match[1] || match[2] || "") : "";
}

function inferCVFileType(cvUrl: string): "pdf" | "docx" | "link" {
  const path = (cvUrl || "").split("?")[0].toLowerCase();
  if (path.endsWith(".pdf")) return "pdf";
  if (path.endsWith(".docx")) return "docx";
  return "link";
}

function labelForFileType(fileType: string) {
  if (fileType === "pdf") return "PDF";
  if (fileType === "docx") return "DOCX";
  return "External CV";
}

function resolveCVUrl(cvUrl: string): string {
  if (!cvUrl) return "";
  if (cvUrl.startsWith("http")) {
    try {
      const url = new URL(cvUrl);
      if (url.pathname.startsWith("/api/files/")) {
        return url.pathname; // Use as relative path — Next.js rewrite handles it
      }
    } catch {
      // ignore
    }
  }
  return cvUrl; // Already relative or external
}
