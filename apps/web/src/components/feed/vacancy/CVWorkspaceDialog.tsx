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
  FileType,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { CVSuggestion, CVSuggestionsResponse, DocumentSession } from "@/types";
import dynamic from "next/dynamic";
import { documentService } from "@/services/document.service";
import { API_BASE_URL } from "@/lib/endpoints";

const DocumentEditor = dynamic(() => import("./DocumentEditor"), { ssr: false });

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
  // Document session
  documentSession: DocumentSession | null;
  loadingSession: boolean;
  convertingToDocs: boolean;
  errorSession: string | null;
  onConvertToDocx: (converter?: "auto" | "libreoffice" | "pdf2docx") => void;
  onSessionUpdated: (session: DocumentSession) => void;
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
  documentSession,
  loadingSession,
  convertingToDocs,
  errorSession,
  onConvertToDocx,
  onSessionUpdated,
}: CVWorkspaceDialogProps) {
  const fileType = inferCVFileType(cvUrl);

  // ── Converter selection ──
  const [converter, setConverter] = useState<"auto" | "libreoffice" | "pdf2docx">("auto");

  // ── View mode ──
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");

  // ── Editor fallback (contentEditable) ──
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const prevDraftHtmlRef = useRef(draftHtml);
  if (prevDraftHtmlRef.current !== draftHtml) {
    prevDraftHtmlRef.current = draftHtml;
    setEditorResetKey((k) => k + 1);
  }

  // ── Preview (docx-preview) ──
  const [previewRendering, setPreviewRendering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewMode !== "preview" || !cvUrl || fileType !== "docx") return;
    let cancelled = false;
    setPreviewRendering(true);
    setPreviewError(null);
    const resolvedUrl = resolveCVUrl(cvUrl);
    async function render() {
      const response = await fetch(resolvedUrl, { credentials: "include" });
      if (!response.ok) throw new Error(`Could not load file (HTTP ${response.status}).`);
      const ct = response.headers.get("content-type") ?? "";
      if (ct.includes("text/html") || ct.includes("application/json"))
        throw new Error("Unexpected server response — not a document file.");
      const buffer = await response.arrayBuffer();
      if (cancelled || !previewRef.current) return;
      const { renderAsync } = await import("docx-preview");
      previewRef.current.innerHTML = "";
      await renderAsync(buffer, previewRef.current, undefined, { inWrapper: false, ignoreWidth: true });
    }
    render()
      .catch((err: unknown) => { if (!cancelled) setPreviewError(err instanceof Error ? err.message : "Failed to render."); })
      .finally(() => { if (!cancelled) setPreviewRendering(false); });
    return () => { cancelled = true; };
  }, [viewMode, cvUrl, fileType]);

  useEffect(() => { if (!open) setViewMode("edit"); }, [open]);

  // ── Suggestions ──
  const [syncedSuggestions, setSyncedSuggestions] = useState(suggestions);
  const [editedSuggestions, setEditedSuggestions] = useState<Record<number, string>>({});
  if (syncedSuggestions !== suggestions) {
    setSyncedSuggestions(suggestions);
    const next: Record<number, string> = {};
    for (const [i, s] of (suggestions?.suggestions ?? []).entries()) {
      next[i] = s.specific_text ? (s.suggested_text ?? "") : extractQuotedValue(s.suggested_text ?? "");
    }
    setEditedSuggestions(next);
  }

  const appliedCount = Object.values(suggestionActions).filter((v) => v === "accepted").length;
  const declinedCount = Object.values(suggestionActions).filter((v) => v === "rejected").length;
  const suggestionList = suggestions?.suggestions ?? [];
  const isPdf = fileType === "pdf";
  const isDocx = fileType === "docx";
  const hasOO = !!documentSession?.onlyoffice_config;
  const conversionDone = documentSession?.conversion_status === "done";
  const conversionFailed = documentSession?.conversion_status === "failed";

  // Download from ONLYOFFICE session or fallback
  function handleDownload() {
    if (documentSession?.session_id) {
      const url = `${API_BASE_URL}/api/document/export/${documentSession.session_id}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cvName || "cv"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      onDownload();
    }
  }

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
              {isPdf ? "PDF" : isDocx ? "DOCX" : "External"}
            </Badge>

            {/* Edit / Preview toggle — only for DOCX */}
            {isDocx && (
              <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5 gap-0.5">
                <button type="button" onClick={() => setViewMode("edit")}
                  className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    viewMode === "edit" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  <PenLine className="size-3" /> Edit
                </button>
                <button type="button" onClick={() => setViewMode("preview")}
                  className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    viewMode === "preview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  <Eye className="size-3" /> Preview original
                </button>
              </div>
            )}

            <div className="h-4 w-px bg-border/40 hidden sm:block" />
            {!isPdf && (
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onReset} disabled={loading}>
                <RotateCcw className="size-3.5" /><span className="hidden sm:inline">Reset</span>
              </Button>
            )}
            <Button type="button" size="sm" className="gap-1.5" onClick={handleDownload}
              disabled={loading || downloading || (isPdf && !conversionDone)}>
              <Download className="size-3.5" />
              {downloading ? "Preparing…" : "Download"}
            </Button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-hidden flex">

          {/* ── Suggestions panel ── */}
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
                  <Badge variant="outline" className="text-[10px] font-medium">{suggestionList.length}</Badge>
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
              {/* For DOCX with ONLYOFFICE, show note that suggestions show as reference */}
              {!loadingSuggestions && hasOO && suggestionList.length > 0 && (
                <p className="text-[10px] text-muted-foreground bg-amber-50 border border-amber-100 rounded px-2 py-1.5 leading-relaxed">
                  Apply suggestions manually in the document editor on the right.
                </p>
              )}
              {suggestionList.map((suggestion, index) => {
                const action = suggestionActions[index];
                const isAccepted = action === "accepted";
                const isDeclined = action === "rejected";
                const priorityDot = suggestion.priority === "high" ? "bg-red-500" : suggestion.priority === "medium" ? "bg-amber-400" : "bg-slate-400";
                return (
                  <div key={index} className={cn("rounded-lg border p-3 space-y-2 transition-all",
                    isAccepted && "border-emerald-200 bg-emerald-50/40",
                    isDeclined && "opacity-50 border-border/30",
                    !isAccepted && !isDeclined && "border-border/50")}>
                    <div className="flex items-start gap-1.5">
                      <span className={cn("mt-1.5 size-1.5 rounded-full shrink-0", priorityDot)} />
                      <p className="text-xs font-semibold text-foreground leading-snug flex-1 min-w-0">{suggestion.title}</p>
                      {isAccepted && (
                        <Badge className="shrink-0 text-[9px] font-semibold px-1.5 py-0 bg-emerald-100 text-emerald-700 border border-emerald-200">Applied</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 pl-3">{suggestion.description}</p>
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
                            <span className="text-emerald-700/80 wrap-break-word leading-4">{suggestion.suggested_text}</span>
                          ) : (
                            <input type="text" value={editedSuggestions[index] ?? ""}
                              onChange={(e) => setEditedSuggestions((prev) => ({ ...prev, [index]: e.target.value }))}
                              placeholder="Type text to add…"
                              className="flex-1 bg-transparent outline-none text-emerald-700 placeholder:text-emerald-400/60 text-[10px] leading-4" />
                          )}
                        </div>
                      </div>
                    )}
                    {/* Only show Apply/Decline for non-ONLYOFFICE mode */}
                    {!hasOO && (
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
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-border/40 shrink-0">
              <p className="text-[11px] text-muted-foreground">{appliedCount} applied · {declinedCount} declined</p>
            </div>
          </aside>

          {/* ── Right: Document area ── */}
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-100">

            {/* ════════════════════════════════════════
                PDF FLOW
                Preview always visible.
                Conversion banner + Edit when done.
            ════════════════════════════════════════ */}
            {isPdf && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Conversion banner */}
                {!conversionDone && (
                  <div className={cn(
                    "px-4 py-2.5 flex items-center gap-3 text-xs shrink-0",
                    conversionFailed ? "bg-red-50 border-b border-red-100" : "bg-amber-50 border-b border-amber-100",
                  )}>
                    {convertingToDocs ? (
                      <><Loader2 className="size-3.5 animate-spin text-amber-600 shrink-0" /><span className="text-amber-800">Converting PDF to editable DOCX… this may take a minute.</span></>
                    ) : conversionFailed ? (
                      <><AlertCircle className="size-3.5 text-red-500 shrink-0" /><span className="text-red-700">Conversion failed. LibreOffice may not be installed.</span>
                        <Button type="button" size="sm" variant="outline" className="ml-auto h-6 text-[10px]" onClick={() => onConvertToDocx(converter)}>Retry</Button>
                      </>
                    ) : (
                      <>
                        <FileType className="size-3.5 text-amber-600 shrink-0" />
                        <span className="text-amber-800 flex-1">
                          PDFs cannot be edited directly. Convert to DOCX to enable editing.
                        </span>
                        <div className="ml-auto flex items-center gap-1.5 shrink-0">
                          <select
                            value={converter}
                            onChange={(e) => setConverter(e.target.value as typeof converter)}
                            className="h-6 rounded border border-amber-300 bg-amber-50 text-[10px] text-amber-800 px-1 outline-none cursor-pointer"
                          >
                            <option value="auto">Auto</option>
                            <option value="libreoffice">LibreOffice</option>
                            <option value="pdf2docx">pdf2docx</option>
                          </select>
                          <Button type="button" size="sm" className="h-6 text-[10px] gap-1" onClick={() => onConvertToDocx(converter)} disabled={convertingToDocs}>
                            Convert to DOCX
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* After conversion: show ONLYOFFICE or success message */}
                {conversionDone && hasOO && documentSession?.onlyoffice_config && (
                  <div className="flex-1 min-h-0">
                    <DocumentEditor config={documentSession.onlyoffice_config} />
                  </div>
                )}

                {conversionDone && !hasOO && (
                  <div className="px-4 py-2.5 flex items-center gap-3 text-xs shrink-0 bg-emerald-50 border-b border-emerald-100">
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                    <span className="text-emerald-800">DOCX ready. Click Download to get your editable file.</span>
                  </div>
                )}

                {/* PDF preview always visible (unless ONLYOFFICE took over) */}
                {!(conversionDone && hasOO) && (
                  <div className="flex-1 overflow-hidden">
                    <iframe src={resolveCVUrl(cvUrl)} className="w-full h-full border-0" title="CV Preview" />
                  </div>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════
                DOCX FLOW
                Edit tab: ONLYOFFICE (if configured) or contentEditable fallback
                Preview tab: docx-preview
            ════════════════════════════════════════ */}
            {isDocx && (
              <>
                {/* ── Edit tab ── */}
                {viewMode === "edit" && (
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    {loadingSession && <EditorLoadingSpinner label="Opening document editor…" />}

                    {!loadingSession && hasOO && documentSession?.onlyoffice_config && (
                      <Suspense fallback={<EditorLoadingSpinner />}>
                        <DocumentEditor config={documentSession.onlyoffice_config} />
                      </Suspense>
                    )}

                    {!loadingSession && !hasOO && (
                      /* Fallback: contentEditable HTML preview */
                      <div className="flex-1 overflow-y-auto">
                        {loading ? (
                          <EditorLoadingSpinner label="Loading editor…" />
                        ) : (
                          <div className="px-6 py-8">
                            <div className="mx-auto max-w-[900px] mb-3">
                              <FallbackToolbar />
                            </div>
                            <div className="mx-auto max-w-[900px] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.09)] overflow-hidden">
                              <div
                                key={editorResetKey}
                                ref={editorRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={() => { onDraftHtmlChange(editorRef.current?.innerHTML ?? ""); }}
                                className="outline-none min-h-96 text-slate-900 relative [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5 [&_img]:max-w-full [&_a]:underline"
                                style={{ fontSize: "11pt", lineHeight: "1.5", color: "#111827" }}
                                dangerouslySetInnerHTML={{ __html: draftHtml || "" }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {errorSession && (
                      <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100 shrink-0">
                        {errorSession}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Preview tab ── */}
                {viewMode === "preview" && (
                  <div className="flex-1 overflow-auto">
                    <div className="px-8 py-10 min-h-full">
                      {previewRendering && (
                        <div className="flex items-center justify-center h-40 gap-2 text-sm text-muted-foreground">
                          <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Rendering document…
                        </div>
                      )}
                      {previewError && !previewRendering && (
                        <div className="mx-auto max-w-175 flex flex-col items-center gap-3 py-16 text-center">
                          <FileText className="size-10 opacity-20" />
                          <p className="text-sm font-medium">Preview unavailable</p>
                          <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">{previewError}</p>
                          <Button type="button" size="sm" variant="outline" className="gap-1.5 mt-2"
                            onClick={() => window.open(resolveCVUrl(cvUrl), "_blank")}>
                            <ExternalLink className="size-3.5" /> Open in new tab
                          </Button>
                        </div>
                      )}
                      {!previewError && (
                        <div ref={previewRef}
                          className={cn("mx-auto max-w-175 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.09)] px-16 py-14",
                            "[&_.docx-wrapper]:bg-transparent! [&_.docx-wrapper]:p-0!",
                            previewRendering && "invisible")} />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* External CV */}
            {fileType === "link" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <FileText className="size-10 opacity-30" />
                <p>Preview is not available for externally linked CVs.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Sub-components ── */

function EditorLoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
      <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
      {label}
    </div>
  );
}

function FallbackToolbar() {
  return (
    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm w-fit">
      {[
        { label: "B", cmd: "bold", style: "font-bold" },
        { label: "I", cmd: "italic", style: "italic" },
        { label: "U", cmd: "underline", style: "underline" },
      ].map(({ label, cmd, style }) => (
        <button key={cmd} type="button"
          onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); }}
          className={`w-7 h-7 rounded text-xs border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center ${style}`}>
          {label}
        </button>
      ))}
      <div className="w-px h-4 bg-slate-200 mx-1" />
      {[
        { label: "• List", cmd: "insertUnorderedList" },
        { label: "1. List", cmd: "insertOrderedList" },
      ].map(({ label, cmd }) => (
        <button key={cmd} type="button"
          onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); }}
          className="px-2 h-7 rounded text-xs border border-slate-200 hover:bg-slate-100 text-slate-600">
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Utilities ── */

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

function resolveCVUrl(cvUrl: string): string {
  if (!cvUrl) return "";
  if (cvUrl.startsWith("http")) {
    try {
      const url = new URL(cvUrl);
      if (url.pathname.startsWith("/api/files/")) return url.pathname;
    } catch { /* ignore */ }
  }
  return cvUrl;
}
