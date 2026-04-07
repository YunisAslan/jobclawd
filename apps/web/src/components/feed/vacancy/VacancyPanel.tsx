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
import { Badge } from "@/components/ui/Badge";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import { ExternalLink, Eye, Sparkles, PencilLine } from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";
import SaveToggleButton from "@/components/ui/SaveToggleButton";
import VacancySummary from "./VacancySummary";
import MatchScoreBreakdown from "./MatchScoreBreakdown";
import CVSelector from "./CVSelector";
import CVMatchResults from "./CVMatchResults";
import SuggestionsList from "./SuggestionsList";
import CVWorkspaceDialog from "./CVWorkspaceDialog";
import { useVacancyPanel, type VacancyTab } from "@/hooks/use-vacancy-panel";
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
    analyzeCV,
    cvAnalysis,
    loadingAnalysis,
    errorAnalysis,
    suggestions,
    loadingSuggestions,
    errorSuggestions,
    draftText,
    loadingDraft,
    downloadingDraft,
    suggestionActions,
    analyzed,
    updateDraft,
    resetDraft,
    acceptSuggestion,
    undoAcceptSuggestion,
    rejectSuggestion,
    resetSuggestion,
    downloadDraft,
    cvData,
    updateCvData,
    resetCvData,
    generateAndDownloadPdf,
    loadingParse,
    generatingPdf,
    workspaceOpen,
    openWorkspace,
    closeWorkspace,
    isSaved,
    toggleSave,
    profile,
  } = useVacancyPanel(job);

  if (!job) return null;

  const isHigh = job.match_level === "high";
  const hasCV = !!selectedCV;
  const suggestionCount = suggestions?.suggestions?.length ?? 0;
  const showSuggestionsSection = analyzed && suggestionCount > 0;
  const canOpenWorkspace = analyzed && hasCV;

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
                  <div className={cn(
                    "flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5",
                    isHigh
                      ? "bg-match-high/10 border border-match-high/20"
                      : "bg-match-review/10 border border-match-review/20",
                  )}>
                    <span className={cn(
                      "text-base font-bold leading-none tabular-nums",
                      isHigh ? "text-match-high" : "text-match-review",
                    )}>
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
                  <CVSelector
                    cvLinks={profile.cv_links ?? []}
                    selectedCV={selectedCV}
                    onChange={setSelectedCV}
                    onUpload={uploadCV}
                    uploading={uploading}
                  />

                  <CVMatchResults
                    analysis={cvAnalysis}
                    loading={loadingAnalysis}
                    error={errorAnalysis}
                    analyzed={analyzed}
                    hasCV={hasCV}
                    onAnalyze={analyzeCV}
                  />

                  {showSuggestionsSection && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-border/50" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          Suggestions
                        </span>
                        <Badge variant="outline" className="text-[10px] font-semibold px-1.5 py-0 h-4">
                          {suggestionCount}
                        </Badge>
                      </div>
                      <div className="flex-1 h-px bg-border/50" />
                    </div>
                  )}

                  <SuggestionsList
                    data={suggestions}
                    loading={loadingSuggestions}
                    error={errorSuggestions}
                    analyzed={analyzed}
                    hasCV={hasCV}
                    onAnalyze={analyzeCV}
                    suggestionActions={suggestionActions}
                    onAcceptSuggestion={acceptSuggestion}
                    onUndoAcceptSuggestion={undoAcceptSuggestion}
                    onRejectSuggestion={rejectSuggestion}
                    onResetSuggestion={resetSuggestion}
                  />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>

          {/* Sticky action bar */}
          {activeTab === "improve" && analyzed && (
            <div className="px-5 py-3 border-t border-border/40 bg-background shrink-0 flex gap-2">
              {canOpenWorkspace && (
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={openWorkspace}
                  disabled={loadingParse}
                >
                  <PencilLine className="size-3.5" />
                  <span className="text-xs">
                    {loadingParse ? "Parsing…" : "Edit CV"}
                  </span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={analyzeCV}
                disabled={loadingAnalysis || !hasCV}
              >
                <span className="text-xs">Re-analyze</span>
              </Button>
            </div>
          )}

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
        onOpenChange={(open) => { if (!open) closeWorkspace(); }}
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
        onCvDataChange={updateCvData}
        onCvDataReset={resetCvData}
        onGeneratePdf={generateAndDownloadPdf}
        loadingParse={loadingParse}
        generatingPdf={generatingPdf}
      />
    </>
  );
}
