"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  Download,
  FileText,
  FileDown,
  ExternalLink,
  RotateCcw,
  PenLine,
  Eye,
  X,
  Zap,
  ScanEye,
  Save,
  Check,
} from "lucide-react";
import type { CVData, CVMatchAnalysis, CVSuggestion, CVSuggestionsResponse } from "@/types";
import { useTour } from "@/contexts/TourContext";
import { DEMO_BUNDLE } from "@/lib/tour-demo-data";
import WorkspaceSuggestions from "./WorkspaceSuggestions";
import CVStructuredEditor from "./CVStructuredEditor";
import CVMiniPreview from "./CVMiniPreview";
import ScoreImpactModal from "./ScoreImpactModal";

/* ── Magnifier constants ── */
const LENS_R = 80;
const LENS_SCALE = 0.9;
const PREVIEW_SCALE = 0.44;
const PREVIEW_W = 256;
const DOC_W = Math.round(PREVIEW_W / PREVIEW_SCALE);

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
  cvData: CVData | null;
  originalCvData?: CVData | null;
  onCvDataChange: (data: CVData) => void;
  onCvDataReset: () => void;
  onGeneratePdf: (name?: string) => void;
  onSaveCvData: () => void;
  savingCvData?: boolean;
  cvDataSaved?: boolean;
  loadingParse: boolean;
  generatingPdf: boolean;
  cvAnalysis?: CVMatchAnalysis | null;
  loadingAnalysis?: boolean;
  atsPreview: CVMatchAnalysis | null;
  atsPreviewBaseline: number | null;
  loadingAtsPreview: boolean;
  onAtsPreview: () => void;
  onDismissAtsPreview: () => void;
  onGenerateSuggestions?: () => void;
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
  originalCvData,
  onCvDataChange,
  onCvDataReset,
  onGeneratePdf,
  onSaveCvData,
  savingCvData,
  cvDataSaved,
  loadingParse,
  generatingPdf,
  cvAnalysis,
  loadingAnalysis,
  atsPreview,
  atsPreviewBaseline,
  loadingAtsPreview,
  onAtsPreview,
  onDismissAtsPreview,
  onGenerateSuggestions,
}: CVWorkspaceDialogProps) {
  const { active: tourActive, current: tourStep } = useTour();
  const tourLockOpen = tourActive && [
    "workspace_form", "workspace_ats", "workspace_suggestions", "workspace_check_impact",
  ].includes(tourStep?.id ?? "");

  const fileType = inferCVFileType(cvUrl);
  const isPdf = fileType === "pdf";
  const hasStructuredData = !!cvData;

  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [highlightSection, setHighlightSection] = useState<string | null>(null);
  const [miniPreviewOpen, setMiniPreviewOpen] = useState(true);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [lensPos, setLensPos] = useState<{ x: number; y: number } | null>(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadName, setDownloadName] = useState("");
  const cvPreviewInnerRef = useRef<HTMLDivElement>(null);
  const [scaledPreviewHeight, setScaledPreviewHeight] = useState(640);

  useEffect(() => {
    if (!cvPreviewInnerRef.current) return;
    const naturalH = cvPreviewInnerRef.current.scrollHeight;
    setScaledPreviewHeight(Math.ceil(naturalH * PREVIEW_SCALE));
  }, [cvData]);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setViewMode("edit");
      setHighlightSection(null);
      setLensPos(null);
    }
  }

  useEffect(() => {
    if (atsPreview && atsPreviewBaseline !== null) {
      setScoreModalOpen(true);
    }
  }, [atsPreview, atsPreviewBaseline]);

  const handleOpenDownload = useCallback(() => {
    setDownloadName(cvName.replace(/\.[^.]+$/, ""));
    setDownloadDialogOpen(true);
  }, [cvName]);

  const handleConfirmDownload = useCallback((name: string) => {
    setDownloadDialogOpen(false);
    onGeneratePdf(name.trim() || cvName);
  }, [onGeneratePdf, cvName]);

  const handleAppliedScrollTarget = useCallback((sectionId: string) => {
    setViewMode("edit");
    setTimeout(() => setHighlightSection(sectionId), 50);
  }, []);

  const handleHighlightDone = useCallback(() => setHighlightSection(null), []);

  const handleDismissScoreModal = useCallback(() => {
    setScoreModalOpen(false);
    onDismissAtsPreview();
  }, [onDismissAtsPreview]);

  const appliedCount = Object.values(suggestionActions).filter((v) => v === "accepted").length;

  const hasChanges = useMemo(() => {
    if (!cvData || !originalCvData) return false;
    const strip = (d: typeof cvData) => {
      const { photo: _p, ...pi } = d.personal_info;
      return { ...d, personal_info: pi };
    };
    return JSON.stringify(strip(cvData)) !== JSON.stringify(strip(originalCvData));
  }, [cvData, originalCvData]);

  const canCheckImpact = appliedCount > 0 || hasChanges;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-none w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] p-0 gap-0 overflow-hidden rounded-2xl flex flex-col"
          onPointerDownOutside={tourLockOpen ? (e) => e.preventDefault() : undefined}
          onInteractOutside={tourLockOpen ? (e) => e.preventDefault() : undefined}
        >

          {/* Header */}
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
                <ViewToggle value={viewMode} onChange={setViewMode} />
              )}

              <div className="h-4 w-px bg-border/40 hidden sm:block" />

              {hasStructuredData && (
                <Button type="button" size="sm" variant="outline" className="gap-1.5 cursor-pointer" onClick={onCvDataReset} disabled={savingCvData}>
                  <RotateCcw className="size-3.5" /><span className="hidden sm:inline">Reset</span>
                </Button>
              )}

              {hasStructuredData && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onSaveCvData}
                  disabled={savingCvData || (!hasChanges && !cvDataSaved)}
                  className={cn(
                    "gap-1.5 cursor-pointer transition-colors",
                    cvDataSaved
                      ? "border-match-high/40 text-match-high bg-match-high/5"
                      : hasChanges
                        ? "border-primary/50 text-primary bg-primary/5 hover:bg-primary/10"
                        : ""
                  )}
                >
                  {savingCvData ? (
                    <>
                      <div className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                      <span className="hidden sm:inline">Saving…</span>
                    </>
                  ) : cvDataSaved ? (
                    <>
                      <Check className="size-3.5" />
                      <span className="hidden sm:inline">Saved</span>
                    </>
                  ) : (
                    <>
                      <Save className="size-3.5" />
                      <span className="hidden sm:inline">Save{hasChanges ? " •" : ""}</span>
                    </>
                  )}
                </Button>
              )}

              {hasStructuredData && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "gap-1.5 cursor-pointer transition-colors",
                    miniPreviewOpen
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "hover:bg-muted/60"
                  )}
                  onClick={() => setMiniPreviewOpen((v) => !v)}
                  aria-label="Toggle ATS Preview"
                  data-tour="workspace-ats-btn"
                >
                  <ScanEye className="size-3.5" />
                  <span className="hidden sm:inline">ATS Preview</span>
                </Button>
              )}

              {hasStructuredData && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={onAtsPreview}
                  disabled={loadingAtsPreview || !canCheckImpact}
                  title={!canCheckImpact ? "Edit your CV first to check impact" : undefined}
                  data-tour="workspace-check-impact-btn"
                >
                  {loadingAtsPreview ? (
                    <>
                      <div className="size-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span className="hidden sm:inline">Analyzing…</span>
                    </>
                  ) : (
                    <>
                      <Zap className="size-3.5" />
                      <span className="hidden sm:inline">Check Impact</span>
                    </>
                  )}
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                className="gap-1.5 cursor-pointer"
                onClick={handleOpenDownload}
                disabled={!hasStructuredData || generatingPdf}
              >
                <Download className="size-3.5" />
                {generatingPdf ? "Generating…" : "Download PDF"}
              </Button>
            </div>
          </header>

          {/* Match Score Strip */}
          {(loadingAnalysis || cvAnalysis) && (
            <MatchScoreStrip cvAnalysis={cvAnalysis ?? null} loadingAnalysis={!!loadingAnalysis} />
          )}

          {/* Body */}
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
              onGenerateSuggestions={onGenerateSuggestions}
              cvData={cvData}
            />

            {/* Document area */}
            <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-muted/40" data-tour="workspace-cv-form">
              {loadingParse && !hasStructuredData && (
                <Spinner label="Parsing CV structure…" />
              )}
              {hasStructuredData && viewMode === "edit" && (
                <CVStructuredEditor
                  data={cvData!}
                  onChange={onCvDataChange}
                  highlightSection={highlightSection}
                  onHighlightDone={handleHighlightDone}
                />
              )}
              {hasStructuredData && viewMode === "preview" && (
                <OriginalFileView cvUrl={cvUrl} fileType={fileType} />
              )}
              {!hasStructuredData && !loadingParse && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <FileText className="size-10 opacity-30" />
                  <p>Could not parse CV structure. Try re-uploading.</p>
                </div>
              )}
            </div>

            {/* ATS Preview panel */}
            {miniPreviewOpen && cvData && (
              <div className="w-72 shrink-0 border-l border-border/50 bg-background flex flex-col overflow-hidden" data-tour="workspace-ats-panel">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <ScanEye className="size-3.5 text-primary" />
                    <span className="text-[11px] font-semibold text-foreground">ATS Preview</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 leading-none">Live</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setMiniPreviewOpen(false)}
                    className="size-6"
                    aria-label="Close preview"
                    data-tour="close-ats-panel"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/20 p-2">
                  <div
                    className="rounded shadow-sm mx-auto"
                    style={{ position: "relative", width: `${PREVIEW_W}px`, height: `${scaledPreviewHeight}px`, cursor: "crosshair" }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setLensPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }}
                    onMouseLeave={() => setLensPos(null)}
                  >
                    <div
                      ref={cvPreviewInnerRef}
                      style={{
                        position: "absolute", top: 0, left: 0,
                        transform: `scale(${PREVIEW_SCALE})`,
                        transformOrigin: "top left",
                        width: `${DOC_W}px`,
                        pointerEvents: "none",
                        userSelect: "none",
                      }}
                    >
                      <CVMiniPreview data={cvData} originalData={originalCvData ?? undefined} />
                    </div>

                    {lensPos && (
                      <div
                        style={{
                          position: "absolute",
                          left: lensPos.x - LENS_R,
                          top: lensPos.y - LENS_R,
                          width: LENS_R * 2,
                          height: LENS_R * 2,
                          borderRadius: "50%",
                          overflow: "hidden",
                          border: "2px solid rgba(255,255,255,0.9)",
                          boxShadow: "0 6px 28px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.08)",
                          pointerEvents: "none",
                          zIndex: 20,
                          backgroundColor: "white",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            transform: `scale(${LENS_SCALE})`,
                            transformOrigin: "top left",
                            width: `${DOC_W}px`,
                            left: LENS_R - (lensPos.x / PREVIEW_SCALE) * LENS_SCALE,
                            top: LENS_R - (lensPos.y / PREVIEW_SCALE) * LENS_SCALE,
                            pointerEvents: "none",
                            userSelect: "none",
                          }}
                        >
                          <CVMiniPreview data={cvData} originalData={originalCvData ?? undefined} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 px-3 py-2 border-t border-border/40 bg-background">
                  <p className="text-[10px] text-muted-foreground text-center">
                    Hover to magnify · updates live as you edit
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {atsPreview && atsPreviewBaseline !== null && (
        <ScoreImpactModal
          open={scoreModalOpen}
          baseline={atsPreviewBaseline}
          baselineAnalysis={cvAnalysis ?? undefined}
          result={atsPreview}
          onClose={handleDismissScoreModal}
          onDownload={handleOpenDownload}
          generatingPdf={generatingPdf}
        />
      )}

      <DownloadNameDialog
        open={downloadDialogOpen}
        name={downloadName}
        generatingPdf={generatingPdf}
        onNameChange={setDownloadName}
        onConfirm={handleConfirmDownload}
        onCancel={() => setDownloadDialogOpen(false)}
      />
    </>
  );
}

/* ── Sub-components ── */

function MatchScoreStrip({ cvAnalysis, loadingAnalysis }: { cvAnalysis: CVMatchAnalysis | null; loadingAnalysis: boolean }) {
  const catLabels: Record<string, string> = { skills: "Skills", experience: "Exp", education: "Edu", keywords: "KW" };

  return (
    <div className="px-6 py-3 border-b border-border/40 shrink-0 bg-muted/20 flex items-center gap-4">
      {loadingAnalysis ? (
        <div className="flex items-center gap-3 w-full">
          <div className="rounded-xl px-3 py-2 border border-border/40 bg-muted/40 shrink-0 flex flex-col items-center gap-1 animate-pulse">
            <div className="h-5 w-7 rounded bg-muted" />
            <div className="h-2 w-8 rounded bg-muted" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-muted animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ) : cvAnalysis && (() => {
        const isHigh = cvAnalysis.overall_score >= 75;
        const scoreColor = isHigh ? "text-match-high" : "text-match-review";
        const bgColor = isHigh ? "bg-match-high/10 border-match-high/20" : "bg-match-review/10 border-match-review/20";
        const barColor = isHigh ? "bg-match-high" : "bg-match-review";
        return (
          <>
            <div className={cn("flex flex-col items-center justify-center rounded-xl px-3 py-2 border shrink-0", bgColor)}>
              <span className={cn("text-xl font-bold leading-none tabular-nums", scoreColor)}>{cvAnalysis.overall_score}</span>
              <span className={cn("text-[9px] font-semibold uppercase tracking-wider mt-0.5 opacity-70", scoreColor)}>Match</span>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${Math.min(100, cvAnalysis.overall_score)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{cvAnalysis.summary}</p>
            </div>
            {cvAnalysis.categories.length > 0 && (
              <div className="hidden lg:flex items-center gap-3 shrink-0 pl-2 border-l border-border/40">
                {cvAnalysis.categories.map((cat) => {
                  const c = cat.score >= 75 ? "text-match-high" : cat.score >= 45 ? "text-match-review" : "text-destructive";
                  return (
                    <div key={cat.category} className="flex flex-col items-center gap-0.5">
                      <span className={cn("text-sm font-bold tabular-nums leading-none", c)}>{cat.score}</span>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{catLabels[cat.category] ?? cat.category}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

function OriginalFileView({ cvUrl, fileType }: { cvUrl: string; fileType: "pdf" | "docx" | "doc" | "link" }) {
  if (cvUrl === "__demo__") {
    return (
      <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950 p-8">
        <pre className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-mono max-w-2xl mx-auto">
          {DEMO_BUNDLE.draft.text}
        </pre>
      </div>
    );
  }

  const resolved = resolveCVUrl(cvUrl);

  if (fileType === "pdf") {
    return (
      <div className="flex-1 overflow-hidden">
        <iframe src={resolved} className="w-full h-full border-0" title="Original CV" />
      </div>
    );
  }

  if (fileType === "docx" || fileType === "doc") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 border border-border/50">
          <FileText className="size-6 opacity-50" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">{fileType.toUpperCase()} preview not available</p>
          <p className="text-xs text-muted-foreground">Browsers can&apos;t render Word documents inline.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href={resolved} download>
              <FileDown className="size-3.5" /> Download original
            </a>
          </Button>
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <a href={resolved} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" /> Open in new tab
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      <iframe src={cvUrl} className="w-full h-full border-0" title="Original CV" />
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: "edit" | "preview"; onChange: (v: "edit" | "preview") => void }) {
  return (
    <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5 gap-0.5">
      {([
        { key: "edit" as const, icon: PenLine, label: "Edit" },
        { key: "preview" as const, icon: Eye, label: "Original" },
      ]).map(({ key, icon: Icon, label }) => (
        <Button
          key={key}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(key)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 h-auto text-[11px] font-medium transition-colors",
            value === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-3" />{label}
        </Button>
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

function inferCVFileType(cvUrl: string): "pdf" | "docx" | "doc" | "link" {
  const path = (cvUrl || "").split("?")[0].toLowerCase();
  if (path.endsWith(".pdf")) return "pdf";
  if (path.endsWith(".docx")) return "docx";
  if (path.endsWith(".doc")) return "doc";
  return "link";
}

function DownloadNameDialog({
  open,
  name,
  generatingPdf,
  onNameChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  name: string;
  generatingPdf: boolean;
  onNameChange: (v: string) => void;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => { inputRef.current?.select(); }, 60);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Download className="size-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold leading-none">Download PDF</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Choose a name for your downloaded file.
              </DialogDescription>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">File name</label>
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer CV"
              className="h-10"
              disabled={generatingPdf}
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirm(name);
                if (e.key === "Escape") onCancel();
              }}
            />
            <p className="text-[11px] text-muted-foreground/60">
              The .pdf extension will be added automatically.
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={generatingPdf}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 gap-1.5"
              onClick={() => onConfirm(name)}
              disabled={generatingPdf || !name.trim()}
            >
              {generatingPdf ? (
                <div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              {generatingPdf ? "Generating…" : "Download"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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
