"use client";

import { useState, useEffect, useRef } from "react";
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
  PenLine,
  Eye,
  FileType,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import type { CVSuggestion, CVSuggestionsResponse, DocumentSession } from "@/types";
import { API_BASE_URL } from "@/lib/endpoints";
import WorkspaceSuggestions from "./WorkspaceSuggestions";

/* ── Props ── */

interface CVWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cvName: string;
  cvUrl: string;
  draftHtml: string;
  loading: boolean;
  downloading: boolean;
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
  documentSession: DocumentSession | null;
  loadingSession: boolean;
  convertingToDocs: boolean;
  errorSession: string | null;
  onConvertToDocx: () => void;
}

/* ── Component ── */

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
}: CVWorkspaceDialogProps) {
  const fileType = inferCVFileType(cvUrl);
  const isPdf = fileType === "pdf";
  const isDocx = fileType === "docx";
  const conversionDone = documentSession?.conversion_status === "done";

  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) setViewMode("edit");
  }

  function handleDownload() {
    if (documentSession?.session_id) {
      const a = document.createElement("a");
      a.href = `${API_BASE_URL}/api/document/export/${documentSession.session_id}`;
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
        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border/50 shrink-0 bg-background">
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

            {isDocx && <ViewToggle value={viewMode} onChange={setViewMode} />}

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
        </header>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-hidden flex">

          {/* Suggestions */}
          <WorkspaceSuggestions
            suggestions={suggestions}
            loading={loadingSuggestions}
            suggestionActions={suggestionActions}
            onAccept={onAcceptSuggestion}
            onUndo={onUndoAcceptSuggestion}
            onReject={onRejectSuggestion}
            onReset={onResetSuggestion}
          />

          {/* Document area */}
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-100">
            {isPdf && (
              <PdfFlow
                cvUrl={cvUrl}
                converting={convertingToDocs}
                conversionDone={conversionDone}
                conversionFailed={documentSession?.conversion_status === "failed"}
                error={errorSession}
                onConvert={onConvertToDocx}
              />
            )}

            {isDocx && viewMode === "edit" && (
              <DocxEditor
                draftHtml={draftHtml}
                loading={loading}
                loadingSession={loadingSession}
                error={errorSession}
                onDraftHtmlChange={onDraftHtmlChange}
              />
            )}

            {isDocx && viewMode === "preview" && (
              <DocxPreview cvUrl={cvUrl} />
            )}

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

/* ══════════════════════════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════════════════════════ */

function ViewToggle({ value, onChange }: { value: "edit" | "preview"; onChange: (v: "edit" | "preview") => void }) {
  return (
    <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5 gap-0.5">
      {([
        { key: "edit" as const, icon: PenLine, label: "Edit" },
        { key: "preview" as const, icon: Eye, label: "Preview original" },
      ]).map(({ key, icon: Icon, label }) => (
        <button key={key} type="button" onClick={() => onChange(key)}
          className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          <Icon className="size-3" />{label}
        </button>
      ))}
    </div>
  );
}

/* ── PDF flow ── */

function PdfFlow({
  cvUrl, converting, conversionDone, conversionFailed, error, onConvert,
}: {
  cvUrl: string;
  converting: boolean;
  conversionDone: boolean;
  conversionFailed: boolean;
  error: string | null;
  onConvert: () => void;
}) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Before conversion */}
      {!conversionDone && !converting && !conversionFailed && (
        <div className="px-4 py-2.5 flex items-center gap-3 text-xs shrink-0 bg-amber-50 border-b border-amber-100">
          <FileType className="size-3.5 text-amber-600 shrink-0" />
          <span className="text-amber-800 flex-1">PDFs cannot be edited directly. Convert to DOCX to enable editing.</span>
          <Button type="button" size="sm" className="h-6 text-[10px] gap-1 shrink-0" onClick={onConvert}>
            Convert to DOCX
          </Button>
        </div>
      )}

      {/* Converting */}
      {converting && (
        <div className="px-4 py-2.5 flex items-center gap-3 text-xs shrink-0 bg-amber-50 border-b border-amber-100">
          <Loader2 className="size-3.5 animate-spin text-amber-600 shrink-0" />
          <span className="text-amber-800">Converting PDF to editable DOCX… this may take a minute.</span>
        </div>
      )}

      {/* Failed */}
      {conversionFailed && !converting && (
        <div className="px-4 py-2.5 flex items-center gap-3 text-xs shrink-0 bg-red-50 border-b border-red-100">
          <AlertCircle className="size-3.5 text-red-500 shrink-0" />
          <span className="text-red-700 flex-1">Conversion failed.</span>
          <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={onConvert}>
            Retry
          </Button>
        </div>
      )}

      {/* Success */}
      {conversionDone && (
        <div className="px-4 py-2.5 flex items-center gap-3 text-xs shrink-0 bg-emerald-50 border-b border-emerald-100">
          <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
          <span className="text-emerald-800 flex-1">DOCX ready. Click Download to get your editable file.</span>
          <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-emerald-700"
            onClick={onConvert} disabled={converting}>
            <RefreshCw className="size-3" /> Reconvert
          </Button>
        </div>
      )}

      {/* PDF iframe preview (always visible) */}
      <div className="flex-1 overflow-hidden">
        <iframe src={resolveCVUrl(cvUrl)} className="w-full h-full border-0" title="CV Preview" />
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100 shrink-0">{error}</div>
      )}
    </div>
  );
}

/* ── DOCX editor (contentEditable HTML) ── */

function DocxEditor({
  draftHtml, loading, loadingSession, error, onDraftHtmlChange,
}: {
  draftHtml: string;
  loading: boolean;
  loadingSession: boolean;
  error: string | null;
  onDraftHtmlChange: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [syncedHtml, setSyncedHtml] = useState(draftHtml);
  if (syncedHtml !== draftHtml) {
    setSyncedHtml(draftHtml);
    setEditorKey((k) => k + 1);
  }

  if (loadingSession) return <Spinner label="Opening editor…" />;

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <Spinner label="Loading editor…" />
        ) : (
          <div className="px-6 py-8">
            <div className="mx-auto max-w-225 mb-3"><FallbackToolbar /></div>
            <div className="mx-auto max-w-225 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.09)] overflow-hidden">
              <div
                key={editorKey}
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => onDraftHtmlChange(editorRef.current?.innerHTML ?? "")}
                className="outline-none min-h-96 text-slate-900 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5 [&_img]:max-w-full [&_a]:underline"
                style={{ fontSize: "11pt", lineHeight: "1.5", color: "#111827" }}
                dangerouslySetInnerHTML={{ __html: draftHtml || "" }}
              />
            </div>
          </div>
        )}
      </div>
      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100 shrink-0">{error}</div>
      )}
    </div>
  );
}

/* ── DOCX preview (docx-preview) ── */

function DocxPreview({ cvUrl }: { cvUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cvUrl) return;
    let cancelled = false;
    setRendering(true);
    setError(null);

    (async () => {
      const res = await fetch(resolveCVUrl(cvUrl), { credentials: "include" });
      if (!res.ok) throw new Error(`Could not load file (HTTP ${res.status}).`);
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("text/html") || ct.includes("application/json"))
        throw new Error("Unexpected server response.");
      const buffer = await res.arrayBuffer();
      if (cancelled || !containerRef.current) return;
      const { renderAsync } = await import("docx-preview");
      containerRef.current.innerHTML = "";
      await renderAsync(buffer, containerRef.current, undefined, { inWrapper: false, ignoreWidth: true });
    })()
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to render."); })
      .finally(() => { if (!cancelled) setRendering(false); });

    return () => { cancelled = true; };
  }, [cvUrl]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-10 min-h-full">
        {rendering && <Spinner label="Rendering document…" />}
        {error && !rendering && (
          <div className="mx-auto max-w-175 flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="size-10 opacity-20" />
            <p className="text-sm font-medium">Preview unavailable</p>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">{error}</p>
            <Button type="button" size="sm" variant="outline" className="gap-1.5 mt-2"
              onClick={() => window.open(resolveCVUrl(cvUrl), "_blank")}>
              <ExternalLink className="size-3.5" /> Open in new tab
            </Button>
          </div>
        )}
        {!error && (
          <div ref={containerRef}
            className={cn("mx-auto max-w-175 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.09)] px-16 py-14",
              "[&_.docx-wrapper]:bg-transparent! [&_.docx-wrapper]:p-0!",
              rendering && "invisible")} />
        )}
      </div>
    </div>
  );
}

/* ── Shared ── */

function Spinner({ label = "Loading…" }: { label?: string }) {
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
