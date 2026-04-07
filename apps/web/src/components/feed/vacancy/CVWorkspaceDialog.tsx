"use client";

import { useState, useCallback } from "react";
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
  Sparkles,
} from "lucide-react";
import type { CVData, CVSuggestion, CVSuggestionsResponse } from "@/types";
import WorkspaceSuggestions from "./WorkspaceSuggestions";
import CVStructuredEditor from "./CVStructuredEditor";

/* ── Props ── */

interface CVWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cvName: string;
  cvUrl: string;
  suggestions: CVSuggestionsResponse | null;
  loadingSuggestions: boolean;
  suggestionActions: Record<number, "accepted" | "rejected">;
  onAcceptSuggestion: (index: number, suggestion: CVSuggestion, overrideText?: string) => void;
  onUndoAcceptSuggestion: (index: number) => void;
  onRejectSuggestion: (index: number) => void;
  onResetSuggestion: (index: number) => void;
  // Structured CV data
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
  suggestions,
  loadingSuggestions,
  suggestionActions,
  onAcceptSuggestion,
  onUndoAcceptSuggestion,
  onRejectSuggestion,
  onResetSuggestion,
  cvData,
  onCvDataChange,
  onCvDataReset,
  onGeneratePdf,
  loadingParse,
  generatingPdf,
}: CVWorkspaceDialogProps) {
  const fileType = inferCVFileType(cvUrl);
  const isPdf = fileType === "pdf";
  const hasStructuredData = !!cvData;

  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [highlightSection, setHighlightSection] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) { setViewMode("edit"); setHighlightSection(null); }
  }

  const handleAppliedScrollTarget = useCallback((sectionId: string) => {
    // Ensure we're in edit mode so the editor is visible
    setViewMode("edit");
    // Use a small delay to let React re-render if switching from preview
    setTimeout(() => setHighlightSection(sectionId), 50);
  }, []);

  const handleHighlightDone = useCallback(() => {
    setHighlightSection(null);
  }, []);

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
              {isPdf ? "PDF" : fileType === "docx" ? "DOCX" : "External"}
            </Badge>

            {hasStructuredData && (
              <ViewToggle value={viewMode} onChange={setViewMode} previewLabel={isPdf ? "View PDF" : "Preview"} />
            )}

            <div className="h-4 w-px bg-border/40 hidden sm:block" />
            {hasStructuredData && (
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onCvDataReset}>
                <RotateCcw className="size-3.5" /><span className="hidden sm:inline">Reset</span>
              </Button>
            )}
            <Button type="button" size="sm" className="gap-1.5" onClick={() => onGeneratePdf()}
              disabled={!hasStructuredData || generatingPdf}>
              <Download className="size-3.5" />
              {generatingPdf ? "Generating…" : "Download PDF"}
            </Button>
          </div>
        </header>

        {/* ── ATS info banner ── */}
        {hasStructuredData && viewMode === "edit" && (
          <div className="flex items-start gap-3 px-5 py-3 bg-primary/5 border-b border-primary/10 shrink-0">
            <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground mb-1.5">
                Your CV is parsed — here's what you can do:
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {[
                  { num: "1", text: "Edit fields below → Download a clean ATS-friendly PDF" },
                  { num: "2", text: "Copy any suggestion → Paste into your own CV file" },
                  { num: "3", text: "Read the reasoning → Rewrite your CV in your own words" },
                ].map(({ num, text }) => (
                  <div key={num} className="flex items-center gap-1.5">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                      {num}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-hidden flex">

          {/* Suggestions sidebar */}
          <WorkspaceSuggestions
            suggestions={suggestions}
            loading={loadingSuggestions}
            suggestionActions={suggestionActions}
            onAccept={onAcceptSuggestion}
            onUndo={onUndoAcceptSuggestion}
            onReject={onRejectSuggestion}
            onReset={onResetSuggestion}
            onAppliedScrollTarget={handleAppliedScrollTarget}
          />

          {/* Document area */}
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-muted/40">
            {/* Loading: parsing CV structure */}
            {loadingParse && !hasStructuredData && (
              <Spinner label="Parsing CV structure…" />
            )}

            {/* Structured editor */}
            {hasStructuredData && viewMode === "edit" && (
              <CVStructuredEditor
                data={cvData!}
                onChange={onCvDataChange}
                highlightSection={highlightSection}
                onHighlightDone={handleHighlightDone}
              />
            )}

            {/* PDF preview */}
            {hasStructuredData && viewMode === "preview" && (
              <div className="flex-1 overflow-hidden">
                <iframe src={resolveCVUrl(cvUrl)} className="w-full h-full border-0" title="CV Preview" />
              </div>
            )}

            {/* No data and not loading */}
            {!hasStructuredData && !loadingParse && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <FileText className="size-10 opacity-30" />
                <p>Could not parse CV structure. Try re-uploading.</p>
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

function ViewToggle({ value, onChange, previewLabel = "Preview" }: { value: "edit" | "preview"; onChange: (v: "edit" | "preview") => void; previewLabel?: string }) {
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

function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
      <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
      {label}
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
