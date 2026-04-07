"use client";

import { useState, useCallback, useEffect } from "react";
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
  FileDown,
  ExternalLink,
  RotateCcw,
  PenLine,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Zap,
  ScanEye,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import type { CVData, CVMatchAnalysis, CVSuggestion, CVSuggestionsResponse } from "@/types";
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
  cvData: CVData | null;
  originalCvData?: CVData | null;
  onCvDataChange: (data: CVData) => void;
  onCvDataReset: () => void;
  onGeneratePdf: () => void;
  loadingParse: boolean;
  generatingPdf: boolean;
  // CV match score (from panel analysis)
  cvAnalysis?: CVMatchAnalysis | null;
  loadingAnalysis?: boolean;
  // Score impact
  atsPreview: CVMatchAnalysis | null;
  atsPreviewBaseline: number | null;
  loadingAtsPreview: boolean;
  onAtsPreview: () => void;
  onDismissAtsPreview: () => void;
}

/* ── Magnifier constants ── */
const LENS_R = 80;      // lens radius in px
const LENS_SCALE = 0.9; // content scale inside the lens (> 0.44 = zoomed in vs main view)

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
  loadingParse,
  generatingPdf,
  cvAnalysis,
  loadingAnalysis,
  atsPreview,
  atsPreviewBaseline,
  loadingAtsPreview,
  onAtsPreview,
  onDismissAtsPreview,
}: CVWorkspaceDialogProps) {
  const fileType = inferCVFileType(cvUrl);
  const isPdf = fileType === "pdf";
  const hasStructuredData = !!cvData;

  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [highlightSection, setHighlightSection] = useState<string | null>(null);
  const [miniPreviewOpen, setMiniPreviewOpen] = useState(true);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [lensPos, setLensPos] = useState<{ x: number; y: number } | null>(null);

  // Reset on close — keep mini preview open for next session
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setViewMode("edit");
      setHighlightSection(null);
      setLensPos(null);
    }
  }

  // Auto-open score modal when result arrives
  useEffect(() => {
    if (atsPreview && atsPreviewBaseline !== null) {
      setScoreModalOpen(true);
    }
  }, [atsPreview, atsPreviewBaseline]);

  const handleAppliedScrollTarget = useCallback((sectionId: string) => {
    setViewMode("edit");
    setTimeout(() => setHighlightSection(sectionId), 50);
  }, []);

  const handleHighlightDone = useCallback(() => setHighlightSection(null), []);

  const handleDismissScoreModal = useCallback(() => {
    setScoreModalOpen(false);
    onDismissAtsPreview();
  }, [onDismissAtsPreview]);

  return (
    <>
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
                <ViewToggle value={viewMode} onChange={setViewMode} />
              )}

              <div className="h-4 w-px bg-border/40 hidden sm:block" />

              {hasStructuredData && (
                <Button type="button" size="sm" variant="outline" className="gap-1.5 cursor-pointer" onClick={onCvDataReset}>
                  <RotateCcw className="size-3.5" /><span className="hidden sm:inline">Reset</span>
                </Button>
              )}

              {/* ATS Preview — live mini CV panel toggle */}
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
                >
                  <ScanEye className="size-3.5" />
                  <span className="hidden sm:inline">ATS Preview</span>
                </Button>
              )}

              {/* Check Impact — score analysis */}
              {hasStructuredData && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/5 cursor-pointer"
                  onClick={onAtsPreview}
                  disabled={loadingAtsPreview}
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
                onClick={() => onGeneratePdf()}
                disabled={!hasStructuredData || generatingPdf}
              >
                <Download className="size-3.5" />
                {generatingPdf ? "Generating…" : "Download PDF"}
              </Button>
            </div>
          </header>


          {/* ── Match Score Strip ── */}
          {(loadingAnalysis || cvAnalysis) && (
            <div className="px-6 py-3 border-b border-border/40 shrink-0 bg-muted/20 flex items-center gap-4">
              {loadingAnalysis && !cvAnalysis ? (
                <>
                  <div className="size-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-xs text-muted-foreground">Analyzing CV match…</span>
                </>
              ) : cvAnalysis && (() => {
                const isHigh = cvAnalysis.overall_score >= 75;
                const scoreColor = isHigh ? "text-match-high" : "text-match-review";
                const bgColor = isHigh ? "bg-match-high/10 border-match-high/20" : "bg-match-review/10 border-match-review/20";
                const barColor = isHigh ? "bg-match-high" : "bg-match-review";
                const catLabels: Record<string, string> = { skills: "Skills", experience: "Exp", education: "Edu", keywords: "KW" };
                return (
                  <>
                    {/* Score badge */}
                    <div className={cn("flex flex-col items-center justify-center rounded-xl px-3 py-2 border shrink-0", bgColor)}>
                      <span className={cn("text-xl font-bold leading-none tabular-nums", scoreColor)}>
                        {cvAnalysis.overall_score}
                      </span>
                      <span className={cn("text-[9px] font-semibold uppercase tracking-wider mt-0.5 opacity-70", scoreColor)}>
                        Match
                      </span>
                    </div>

                    {/* Progress + summary */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", barColor)}
                          style={{ width: `${Math.min(100, cvAnalysis.overall_score)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {cvAnalysis.summary}
                      </p>
                    </div>

                    {/* Category mini-scores */}
                    {cvAnalysis.categories.length > 0 && (
                      <div className="hidden lg:flex items-center gap-3 shrink-0 pl-2 border-l border-border/40">
                        {cvAnalysis.categories.map((cat) => {
                          const c = cat.score >= 75 ? "text-match-high" : cat.score >= 45 ? "text-match-review" : "text-destructive";
                          return (
                            <div key={cat.category} className="flex flex-col items-center gap-0.5">
                              <span className={cn("text-sm font-bold tabular-nums leading-none", c)}>
                                {cat.score}
                              </span>
                              <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                                {catLabels[cat.category] ?? cat.category}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
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

            {/* ── ATS Preview: live mini CV panel ── */}
            {miniPreviewOpen && cvData && (
              <div className="w-72 shrink-0 border-l border-border/50 bg-background flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <ScanEye className="size-3.5 text-primary" />
                    <span className="text-[11px] font-semibold text-foreground">ATS Preview</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 leading-none">Live</Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMiniPreviewOpen(false)}
                    className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                    aria-label="Close preview"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto bg-muted/20 p-2">
                  {/* Clip container — magnifying glass follows cursor */}
                  <div
                    className="rounded shadow-sm mx-auto"
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      width: "256px",
                      height: "620px",
                      cursor: "crosshair",
                    }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setLensPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }}
                    onMouseLeave={() => setLensPos(null)}
                  >
                    {/* Scaled-down CV document */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        transform: "scale(0.44)",
                        transformOrigin: "top left",
                        width: `${Math.round(256 / 0.44)}px`,
                        pointerEvents: "none",
                        userSelect: "none",
                      }}
                    >
                      <CVMiniPreview data={cvData} originalData={originalCvData ?? undefined} />
                    </div>

                    {/* Magnifying glass lens */}
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
                            width: `${Math.round(256 / 0.44)}px`,
                            left: LENS_R - (lensPos.x / 0.44) * LENS_SCALE,
                            top: LENS_R - (lensPos.y / 0.44) * LENS_SCALE,
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

      {/* ── Score Impact Modal ── */}
      {atsPreview && atsPreviewBaseline !== null && (
        <ScoreImpactModal
          open={scoreModalOpen}
          baseline={atsPreviewBaseline}
          result={atsPreview}
          onClose={handleDismissScoreModal}
          onDownload={onGeneratePdf}
          generatingPdf={generatingPdf}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Score Impact Modal
   ══════════════════════════════════════════════════════════════════════════════ */

function ScoreImpactModal({
  open,
  baseline,
  result,
  onClose,
  onDownload,
  generatingPdf,
}: {
  open: boolean;
  baseline: number;
  result: CVMatchAnalysis;
  onClose: () => void;
  onDownload: () => void;
  generatingPdf: boolean;
}) {
  const delta = result.overall_score - baseline;
  const improved = delta > 0;
  const unchanged = delta === 0;
  const strongImprove = delta >= 10;

  const accentColor = improved ? "emerald" : unchanged ? "slate" : "orange";

  const accentText = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    slate: "text-muted-foreground",
    orange: "text-orange-600 dark:text-orange-400",
  }[accentColor];

  const accentBg = {
    emerald: "bg-emerald-500/10",
    slate: "bg-muted/60",
    orange: "bg-orange-500/10",
  }[accentColor];

  const accentBorder = {
    emerald: "border-emerald-500/25",
    slate: "border-border",
    orange: "border-orange-500/25",
  }[accentColor];

  const headline = strongImprove
    ? "Outstanding! Your CV is significantly stronger."
    : improved
    ? "Nice work! Your match score improved."
    : unchanged
    ? "No change yet — keep applying suggestions."
    : "Score dropped — review the suggestions panel.";

  const TrendIcon = improved ? TrendingUp : unchanged ? Minus : TrendingDown;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl">

        {/* Top accent bar */}
        <div className={cn("h-1 w-full", improved ? "bg-emerald-500" : unchanged ? "bg-border" : "bg-orange-500")} />

        <div className="px-7 pt-6 pb-7 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-bold leading-snug">{headline}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {improved
                  ? "Your edits made a measurable difference."
                  : unchanged
                  ? "Apply more suggestions from the sidebar to see improvement."
                  : "Some content changes may have reduced relevance."}
              </DialogDescription>
            </div>
          </div>

          {/* Score comparison */}
          <div className={cn("flex items-center justify-center gap-4 rounded-xl border px-6 py-5", accentBg, accentBorder)}>

            {/* Before */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Before</span>
              <span className="text-5xl font-black tabular-nums text-foreground leading-none">{baseline}</span>
              <span className="text-sm text-muted-foreground font-medium">%</span>
            </div>

            {/* Arrow + delta */}
            <div className="flex flex-col items-center gap-1 px-2">
              <TrendIcon className={cn("size-6", accentText)} />
              {!unchanged && (
                <span className={cn("text-sm font-bold tabular-nums", accentText)}>
                  {delta > 0 ? "+" : ""}{delta} pts
                </span>
              )}
              {unchanged && (
                <span className="text-xs text-muted-foreground">no change</span>
              )}
            </div>

            {/* After */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">After</span>
              <span className={cn("text-5xl font-black tabular-nums leading-none", accentText)}>{result.overall_score}</span>
              <span className={cn("text-sm font-medium", accentText)}>%</span>
            </div>
          </div>

          {/* Category breakdown */}
          {result.categories.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category Breakdown</p>
              <div className="space-y-2.5">
                {result.categories.map((cat) => {
                  const pct = Math.max(0, Math.min(100, cat.score));
                  const barColor = pct >= 75 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-500" : "bg-red-500";
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs capitalize font-medium text-foreground">{cat.category}</span>
                        <span className="text-xs font-bold tabular-nums text-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", barColor)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary */}
          {result.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-border pl-3 italic">
              {result.summary}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 cursor-pointer"
              onClick={onClose}
            >
              Keep Editing
            </Button>
            {improved && (
              <Button
                type="button"
                size="sm"
                className={cn(
                  "flex-1 gap-2 cursor-pointer",
                  "bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                )}
                onClick={() => { onClose(); onDownload(); }}
                disabled={generatingPdf}
              >
                {generatingPdf ? (
                  <div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                Download Updated CV
                {!generatingPdf && <ArrowRight className="size-3.5" />}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ATS Preview — live mini CV renderer
   ══════════════════════════════════════════════════════════════════════════════ */

/* Compute which text strings are new/changed vs original CV */
function computeChangedTexts(original: CVData, current: CVData): Set<string> {
  const changed = new Set<string>();

  // Summary changed
  if (current.personal_info.summary && current.personal_info.summary !== original.personal_info.summary) {
    changed.add(current.personal_info.summary);
  }

  // New/changed experience bullets
  const origBullets = new Set(original.experience.flatMap((e) => e.bullets));
  for (const entry of current.experience) {
    for (const bullet of entry.bullets) {
      if (bullet && !origBullets.has(bullet)) changed.add(bullet);
    }
  }

  // New skill items
  const origSkillItems = new Set(original.skills.flatMap((g) => g.items));
  for (const group of current.skills) {
    for (const item of group.items) {
      if (item && !origSkillItems.has(item)) changed.add(item);
    }
  }

  // New certifications
  const origCertNames = new Set(original.certifications.map((c) => c.name));
  for (const cert of current.certifications) {
    if (cert.name && !origCertNames.has(cert.name)) changed.add(cert.name);
  }

  return changed;
}

const HIGHLIGHT_STYLE: React.CSSProperties = {
  background: "rgba(34, 197, 94, 0.18)",
  borderRadius: "2px",
  padding: "0 2px",
  outline: "1px solid rgba(34, 197, 94, 0.35)",
};

function H({ text, changed }: { text: string; changed: Set<string> }) {
  if (!changed.has(text)) return <>{text}</>;
  return <span style={HIGHLIGHT_STYLE}>{text}</span>;
}

function CVMiniPreview({ data, originalData }: { data: CVData; originalData?: CVData }) {
  const pi = data.personal_info;
  const changed = originalData ? computeChangedTexts(originalData, data) : new Set<string>();
  const hasChanges = changed.size > 0;

  return (
    <div
      className="bg-white text-gray-900 p-8"
      style={{ fontFamily: "'Arial', 'Helvetica', sans-serif", fontSize: "14px", lineHeight: "1.5", minHeight: "900px" }}
    >
      {/* Change legend */}
      {hasChanges && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", padding: "4px 8px", background: "rgba(34,197,94,0.08)", borderRadius: "6px", border: "1px solid rgba(34,197,94,0.2)" }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", background: "rgba(34,197,94,0.4)", flexShrink: 0 }} />
          <span style={{ fontSize: "10px", color: "#16a34a", fontWeight: 600 }}>
            {changed.size} change{changed.size !== 1 ? "s" : ""} highlighted
          </span>
        </div>
      )}

      {/* Name + contact */}
      <div style={{ borderBottom: "2px solid #1e3a5f", paddingBottom: "12px", marginBottom: "14px" }}>
        <div style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
          {pi.full_name || "Your Name"}
        </div>
        <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {pi.email && <span>{pi.email}</span>}
          {pi.phone && <span>{pi.phone}</span>}
          {pi.location && <span>{pi.location}</span>}
          {pi.linkedin && <span>{pi.linkedin}</span>}
        </div>
        {pi.summary && (
          <p style={{ fontSize: "12px", color: "#334155", marginTop: "8px", lineHeight: "1.6" }}>
            <H text={pi.summary} changed={changed} />
          </p>
        )}
      </div>

      {/* Experience */}
      {data.experience.length > 0 && (
        <section style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1e3a5f", borderBottom: "1px solid #e2e8f0", paddingBottom: "3px", marginBottom: "10px" }}>
            Experience
          </div>
          {data.experience.map((e) => (
            <div key={e.id} style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{e.title}</span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>{e.start_date} – {e.end_date || "Present"}</span>
              </div>
              <div style={{ fontSize: "12px", color: "#475569", marginBottom: "4px" }}>
                {e.company}{e.location ? `, ${e.location}` : ""}
              </div>
              {e.bullets.map((b, i) => (
                <div key={i} style={{ fontSize: "12px", color: "#334155", paddingLeft: "12px", position: "relative", marginBottom: "2px" }}>
                  <span style={{ position: "absolute", left: 0 }}>•</span>
                  <H text={b} changed={changed} />
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {/* Skills */}
      {data.skills.length > 0 && (
        <section style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1e3a5f", borderBottom: "1px solid #e2e8f0", paddingBottom: "3px", marginBottom: "10px" }}>
            Skills
          </div>
          {data.skills.map((g, i) => (
            <div key={i} style={{ fontSize: "12px", color: "#334155", marginBottom: "3px" }}>
              <span style={{ fontWeight: 700 }}>{g.category}: </span>
              {g.items.map((item, j) => (
                <span key={j}>
                  {j > 0 && ", "}
                  <H text={item} changed={changed} />
                </span>
              ))}
            </div>
          ))}
        </section>
      )}

      {/* Education */}
      {data.education.length > 0 && (
        <section style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1e3a5f", borderBottom: "1px solid #e2e8f0", paddingBottom: "3px", marginBottom: "10px" }}>
            Education
          </div>
          {data.education.map((e) => (
            <div key={e.id} style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                  {e.degree}{e.field_of_study ? ` in ${e.field_of_study}` : ""}
                </span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>{e.end_date || e.start_date}</span>
              </div>
              <div style={{ fontSize: "12px", color: "#475569" }}>{e.institution}</div>
            </div>
          ))}
        </section>
      )}

      {/* Languages */}
      {data.languages.length > 0 && (
        <section style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1e3a5f", borderBottom: "1px solid #e2e8f0", paddingBottom: "3px", marginBottom: "10px" }}>
            Languages
          </div>
          <div style={{ fontSize: "12px", color: "#334155" }}>
            {data.languages.map((l) => `${l.language} (${l.level})`).join(" · ")}
          </div>
        </section>
      )}

      {/* Certifications */}
      {data.certifications.length > 0 && (
        <section style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1e3a5f", borderBottom: "1px solid #e2e8f0", paddingBottom: "3px", marginBottom: "10px" }}>
            Certifications
          </div>
          {data.certifications.map((c) => (
            <div key={c.id} style={{ fontSize: "12px", color: "#334155", marginBottom: "3px" }}>
              <span style={{ fontWeight: 700 }}><H text={c.name} changed={changed} /></span>
              {c.issuer && <span style={{ color: "#475569" }}> — {c.issuer}</span>}
              {c.date && <span style={{ color: "#64748b" }}> ({c.date})</span>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════════════════════════ */

function OriginalFileView({ cvUrl, fileType }: { cvUrl: string; fileType: "pdf" | "docx" | "link" }) {
  const resolved = resolveCVUrl(cvUrl);

  if (fileType === "pdf") {
    return (
      <div className="flex-1 overflow-hidden">
        <iframe src={resolved} className="w-full h-full border-0" title="Original CV" />
      </div>
    );
  }

  if (fileType === "docx") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 border border-border/50">
          <FileText className="size-6 opacity-50" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">DOCX preview not available</p>
          <p className="text-xs text-muted-foreground">Browsers can't render Word documents inline.</p>
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

  // External link — best-effort iframe
  return (
    <div className="flex-1 overflow-hidden">
      <iframe src={cvUrl} className="w-full h-full border-0" title="Original CV" />
    </div>
  );
}

function ViewToggle({ value, onChange }: {
  value: "edit" | "preview";
  onChange: (v: "edit" | "preview") => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5 gap-0.5">
      {([
        { key: "edit" as const, icon: PenLine, label: "Edit" },
        { key: "preview" as const, icon: Eye, label: "Original" },
      ]).map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
            value === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
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
