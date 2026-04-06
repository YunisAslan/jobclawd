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
  FileText,
  RotateCcw,
  PenLine,
  Eye,
  FileType,
} from "lucide-react";
import type { CVData, CVSuggestion, CVSuggestionsResponse, DocumentSession } from "@/types";
import { API_BASE_URL } from "@/lib/endpoints";
import WorkspaceSuggestions from "./WorkspaceSuggestions";
import CVStructuredEditor from "./CVStructuredEditor";

/* ── Shared editor/preview styling ── */
const CV_EDITOR_CLASSES = [
  "outline-none min-h-96 px-10 py-8 text-slate-900",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5",
  "[&_img]:max-w-full [&_a]:underline",
  "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-0",
  "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-1.5 [&_h2]:mt-4 [&_h2]:text-slate-800",
  "[&_h2]:border-b [&_h2]:border-slate-200 [&_h2]:pb-1",
  "[&_p]:mb-0.5 [&_ul]:mb-2 [&_ol]:mb-2",
].join(" ");

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
  errorSession: string | null;
  // Structured CV data (for PDFs)
  cvData: CVData | null;
  onCvDataChange: (data: CVData) => void;
  onCvDataReset: () => void;
  onGeneratePdf: () => void;
  loadingParse: boolean;
  generatingPdf: boolean;
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
  errorSession,
  cvData,
  onCvDataChange,
  onCvDataReset,
  onGeneratePdf,
  loadingParse,
  generatingPdf,
}: CVWorkspaceDialogProps) {
  const fileType = inferCVFileType(cvUrl);
  const isPdf = fileType === "pdf";
  const isDocx = fileType === "docx";
  // PDF with structured data uses the section editor
  const pdfStructured = isPdf && !!cvData;
  // Fallback: PDF with HTML text (no structured data yet)
  const pdfEditable = isPdf && !cvData && !!draftHtml;

  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) setViewMode("edit");
  }

  function handleDownload() {
    if (pdfStructured) {
      onGeneratePdf();
    } else {
      onDownload();
    }
  }

  function handleReset() {
    if (pdfStructured) {
      onCvDataReset();
    } else {
      onReset();
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

            {(isDocx || pdfEditable || pdfStructured) && <ViewToggle value={viewMode} onChange={setViewMode} previewLabel={isPdf ? "View PDF" : "Preview original"} />}

            <div className="h-4 w-px bg-border/40 hidden sm:block" />
            {(isDocx || pdfEditable || pdfStructured) && (
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleReset} disabled={loading}>
                <RotateCcw className="size-3.5" /><span className="hidden sm:inline">Reset</span>
              </Button>
            )}
            <Button type="button" size="sm" className="gap-1.5" onClick={handleDownload}
              disabled={loading || downloading || generatingPdf}>
              <Download className="size-3.5" />
              {generatingPdf ? "Generating…" : downloading ? "Preparing…" : "Download"}
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
            {/* PDF: before parse completes, show iframe */}
            {isPdf && !pdfStructured && !pdfEditable && (
              loadingParse
                ? <Spinner label="Parsing CV structure…" />
                : <PdfFlow cvUrl={cvUrl} />
            )}

            {/* PDF structured editor (section-based) */}
            {pdfStructured && viewMode === "edit" && (
              <CVStructuredEditor data={cvData!} onChange={onCvDataChange} />
            )}

            {/* PDF fallback: raw HTML editor (if structured parse failed) */}
            {pdfEditable && viewMode === "edit" && (
              <DocxEditor
                draftHtml={draftHtml}
                loading={loading}
                loadingSession={loadingSession}
                error={errorSession}
                onDraftHtmlChange={onDraftHtmlChange}
              />
            )}

            {/* DOCX editor */}
            {isDocx && viewMode === "edit" && (
              <DocxEditor
                draftHtml={draftHtml}
                loading={loading}
                loadingSession={loadingSession}
                error={errorSession}
                onDraftHtmlChange={onDraftHtmlChange}
              />
            )}

            {/* Preview: DOCX shows read-only HTML, PDF shows native iframe */}
            {isDocx && viewMode === "preview" && (
              <DocxPreview draftHtml={draftHtml} />
            )}
            {(pdfStructured || pdfEditable) && viewMode === "preview" && (
              <div className="flex-1 overflow-hidden">
                <iframe src={resolveCVUrl(cvUrl)} className="w-full h-full border-0" title="CV Preview" />
              </div>
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

function ViewToggle({ value, onChange, previewLabel = "Preview original" }: { value: "edit" | "preview"; onChange: (v: "edit" | "preview") => void; previewLabel?: string }) {
  return (
    <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5 gap-0.5">
      {([
        { key: "edit" as const, icon: PenLine, label: "Edit" },
        { key: "preview" as const, icon: Eye, label: previewLabel },
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

/* ── PDF flow (shown before analysis extracts text) ── */

function PdfFlow({ cvUrl }: { cvUrl: string }) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-4 py-2.5 flex items-center gap-3 text-xs shrink-0 bg-amber-50 border-b border-amber-100">
        <FileType className="size-3.5 text-amber-600 shrink-0" />
        <span className="text-amber-800">Run CV analysis from the sidebar to enable editing.</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <iframe src={resolveCVUrl(cvUrl)} className="w-full h-full border-0" title="CV Preview" />
      </div>
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
  const lastExternalHtml = useRef(draftHtml);

  // When draftHtml changes externally (e.g. suggestion accepted), patch the DOM
  // without remounting so the cursor isn't destroyed during normal typing.
  useEffect(() => {
    if (!editorRef.current) return;
    if (draftHtml !== lastExternalHtml.current) {
      // Only overwrite DOM if the change didn't come from user input
      if (editorRef.current.innerHTML !== draftHtml) {
        editorRef.current.innerHTML = draftHtml || "";
      }
      lastExternalHtml.current = draftHtml;
    }
  }, [draftHtml]);

  // Set initial HTML on mount
  useEffect(() => {
    if (editorRef.current && draftHtml) {
      editorRef.current.innerHTML = draftHtml;
      lastExternalHtml.current = draftHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleInput() {
    const html = editorRef.current?.innerHTML ?? "";
    lastExternalHtml.current = html;
    onDraftHtmlChange(html);
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
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                className={CV_EDITOR_CLASSES}
                style={{ fontSize: "11pt", lineHeight: "1.5", color: "#111827" }}
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

/* ── DOCX preview (read-only HTML render) ── */

function DocxPreview({ draftHtml }: { draftHtml: string }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-8 min-h-full">
        <div className="mx-auto max-w-225 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.09)] overflow-hidden">
          <div
            className={CV_EDITOR_CLASSES}
            style={{ fontSize: "11pt", lineHeight: "1.5", color: "#111827" }}
            dangerouslySetInnerHTML={{ __html: draftHtml || "" }}
          />
        </div>
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
