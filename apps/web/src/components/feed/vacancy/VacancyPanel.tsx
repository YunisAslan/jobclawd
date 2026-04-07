"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import {
  ExternalLink,
  Eye,
  Sparkles,
  PencilLine,
  Plus,
  X,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";
import SaveToggleButton from "@/components/ui/SaveToggleButton";
import VacancySummary from "./VacancySummary";
import MatchScoreBreakdown from "./MatchScoreBreakdown";
import CVSelector from "./CVSelector";
import CVWorkspaceDialog from "./CVWorkspaceDialog";
import { useVacancyPanel, type VacancyTab, type MultiCVEntry } from "@/hooks/use-vacancy-panel";
import type { JobListing } from "@/types";
import Link from "next/link";

interface VacancyPanelProps {
  job: JobListing | null;
  onClose: () => void;
}

export default function VacancyPanel({ job, onClose }: VacancyPanelProps) {
  const {
    detail,
    loadingDetail,
    resolvedApplyUrl,
    selectedCV,
    setSelectedCV,
    uploadCV,
    uploading,
    activeTab,
    setActiveTab,
    cvAnalysis,
    loadingAnalysis,
    errorAnalysis,
    suggestions,
    loadingSuggestions,
    suggestionActions,
    analyzed,
    acceptSuggestion,
    undoAcceptSuggestion,
    rejectSuggestion,
    resetSuggestion,
    cvData,
    originalCvData,
    updateCvData,
    resetCvData,
    generateAndDownloadPdf,
    loadingParse,
    generatingPdf,
    atsPreview,
    atsPreviewBaseline,
    loadingAtsPreview,
    previewAtsScore,
    dismissAtsPreview,
    multiCVResults,
    addCVToCompare,
    removeCVFromCompare,
    workspaceOpen,
    openWorkspace,
    analyzeAndOpen,
    closeWorkspace,
    isSaved,
    toggleSave,
    profile,
  } = useVacancyPanel(job);

  if (!job) return null;

  const isHigh = job.match_level === "high";
  const hasCV = !!selectedCV;

  return (
    <>
      <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-125 p-0 flex flex-col gap-0 overflow-hidden"
        >
          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/50 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-sm leading-snug line-clamp-2 pr-6">
                  {job.title}
                </SheetTitle>
                <SheetDescription className="text-xs mt-1 flex items-center gap-2">
                  {job.company}
                  <SourceBadge source={job.source} />
                </SheetDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {job.match_score > 0 && (
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5",
                      isHigh
                        ? "bg-match-high/10 border border-match-high/20"
                        : "bg-match-review/10 border border-match-review/20",
                    )}
                  >
                    <span
                      className={cn(
                        "text-base font-bold leading-none tabular-nums",
                        isHigh ? "text-match-high" : "text-match-review",
                      )}
                    >
                      {job.match_score}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as VacancyTab)}
            className="flex-1 min-h-0 flex flex-col"
          >
            <div className="px-5 pt-3 pb-0">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="gap-1.5 text-xs">
                  <Eye className="size-3.5" /> Overview
                </TabsTrigger>
                <TabsTrigger value="improve" className="gap-1.5 text-xs">
                  <Sparkles className="size-3.5" /> Improve CV
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="pl-5 pr-7 py-5">
                <TabsContent value="overview" className="mt-0 space-y-5">
                  <VacancySummary job={job} detail={detail ?? null} loadingDetail={loadingDetail} />
                  <MatchScoreBreakdown job={job} />
                </TabsContent>

                <TabsContent value="improve" className="mt-0 space-y-4">
                  {/* CV selector + add to compare */}
                  <div className="space-y-2">
                    <CVSelector
                      cvLinks={profile.cv_links ?? []}
                      selectedCV={selectedCV}
                      onChange={setSelectedCV}
                      onUpload={uploadCV}
                      uploading={uploading}
                    />
                    {hasCV && (
                      <Button
                        onClick={() => addCVToCompare(selectedCV!)}
                        className="w-full gap-2"
                        disabled={multiCVResults.some(
                          (e) => e.cv.url === selectedCV?.url && e.loading,
                        )}
                      >
                        <Plus className="size-4" />
                        Analyze CV
                      </Button>
                    )}
                    {!hasCV && (
                      <p className="text-center text-xs text-muted-foreground py-4">
                        Select or upload a CV above to get started.
                      </p>
                    )}
                  </div>

                  {/* Multi-CV results list */}
                  {multiCVResults.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="size-3 text-muted-foreground" />
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          Results · {multiCVResults.length} CV
                          {multiCVResults.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {[...multiCVResults]
                        .sort(
                          (a, b) =>
                            (b.analysis?.overall_score ?? -1) - (a.analysis?.overall_score ?? -1),
                        )
                        .map((entry, rank) => (
                          <MultiCVRow
                            key={entry.cv.url}
                            entry={entry}
                            rank={rank + 1}
                            onEdit={() => analyzeAndOpen(entry.cv)}
                            onRemove={() => removeCVFromCompare(entry.cv.url)}
                            onReanalyze={() => addCVToCompare(entry.cv)}
                          />
                        ))}
                    </div>
                  )}
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>

          {/* Footer */}
          <SheetFooter className="px-5 py-4 border-t border-border/50 gap-2">
            <div className="flex gap-2 w-full">
              <SaveToggleButton
                saved={isSaved}
                onToggle={() => toggleSave.mutate()}
                pending={toggleSave.isPending}
                size="md"
              />
              <Button asChild className="flex-1 gap-2">
                <Link href={resolvedApplyUrl || job.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" /> Open &amp; apply
                </Link>
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* CV Workspace Dialog */}
      <CVWorkspaceDialog
        open={workspaceOpen}
        onOpenChange={(open) => {
          if (!open) closeWorkspace();
        }}
        cvName={selectedCV?.name ?? ""}
        cvUrl={selectedCV?.url ?? ""}
        suggestions={suggestions}
        loadingSuggestions={loadingSuggestions}
        suggestionActions={suggestionActions}
        onAcceptSuggestion={acceptSuggestion}
        onUndoAcceptSuggestion={undoAcceptSuggestion}
        onRejectSuggestion={rejectSuggestion}
        onResetSuggestion={resetSuggestion}
        cvData={cvData}
        originalCvData={originalCvData}
        onCvDataChange={updateCvData}
        onCvDataReset={resetCvData}
        onGeneratePdf={generateAndDownloadPdf}
        loadingParse={loadingParse}
        generatingPdf={generatingPdf}
        cvAnalysis={cvAnalysis}
        loadingAnalysis={loadingAnalysis}
        atsPreview={atsPreview}
        atsPreviewBaseline={atsPreviewBaseline}
        loadingAtsPreview={loadingAtsPreview}
        onAtsPreview={previewAtsScore}
        onDismissAtsPreview={dismissAtsPreview}
      />
    </>
  );
}

/* ── Multi-CV comparison row ─────────────────────────────────────────────── */

function MultiCVRow({
  entry,
  rank,
  onEdit,
  onRemove,
  onReanalyze,
}: {
  entry: MultiCVEntry;
  rank: number;
  onEdit: () => void;
  onRemove: () => void;
  onReanalyze: () => void;
}) {
  const score = entry.analysis?.overall_score ?? null;
  const isHigh = score !== null && score >= 75;
  const isMid = score !== null && score >= 45 && score < 75;

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-3 space-y-2 transition-all",
        entry.loading && "opacity-70",
        score !== null && isHigh && "border-match-high/20",
        score !== null && isMid && "border-match-review/20",
        score !== null && !isHigh && !isMid && "border-destructive/15",
        !score && !entry.loading && !entry.error && "border-border/50",
      )}
    >
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className={cn(
          "absolute top-1/2 right-2 -translate-y-1/2 p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer",
          score ? "top-2 translate-0": ""
        )}
        aria-label="Remove"
      >
        <X className="size-3" />
      </button>

      {/* Header: rank + name + score */}
      <div className="flex items-center gap-2.5 pr-4">
        <span className="text-[10px] font-bold text-muted-foreground/60 tabular-nums w-4 shrink-0">
          #{rank}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{entry.cv.name}</p>
        </div>

        {entry.loading && (
          <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        {score !== null && (
          <div
            className={cn(
              "flex items-baseline gap-0.5 shrink-0 px-2 py-0.5 rounded-lg border",
              isHigh
                ? "bg-match-high/10 border-match-high/20"
                : isMid
                  ? "bg-match-review/10 border-match-review/20"
                  : "bg-destructive/10 border-destructive/20",
            )}
          >
            <span
              className={cn(
                "text-sm font-bold tabular-nums leading-none",
                isHigh ? "text-match-high" : isMid ? "text-match-review" : "text-destructive",
              )}
            >
              {score}
            </span>
          </div>
        )}
      </div>

      {/* Score bar */}
      {score !== null && (
        <div className="h-1 w-full rounded-full bg-border/30 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isHigh ? "bg-match-high" : isMid ? "bg-match-review" : "bg-destructive",
            )}
            style={{ width: `${Math.min(100, score)}%` }}
          />
        </div>
      )}

      {/* Summary */}
      {entry.analysis?.summary && (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
          {entry.analysis.summary}
        </p>
      )}

      {/* Error */}
      {entry.error && <p className="text-[11px] text-destructive">{entry.error}</p>}

      {/* Actions */}
      {!entry.loading && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <Button size="sm" className="flex-1 gap-1.5 h-7 text-[11px]" onClick={onEdit}>
            <PencilLine className="size-3" /> Edit CV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 h-7 text-[11px] px-2"
            onClick={onReanalyze}
            title="Re-analyze"
          >
            <RefreshCw className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
