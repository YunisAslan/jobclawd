"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import type { CVMatchAnalysis } from "@/types";

interface ScoreImpactModalProps {
  open: boolean;
  baseline: number;
  baselineAnalysis?: CVMatchAnalysis;
  result: CVMatchAnalysis;
  onClose: () => void;
  onDownload: () => void;
  generatingPdf: boolean;
}

export default function ScoreImpactModal({
  open,
  baseline,
  baselineAnalysis,
  result,
  onClose,
  onDownload,
  generatingPdf,
}: ScoreImpactModalProps) {
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
  const catLabels: Record<string, string> = {
    skills: "Skills",
    experience: "Experience",
    fit: "Fit",
    keywords: "Keywords",
  };

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
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Before</span>
              <span className="text-5xl font-black tabular-nums text-foreground leading-none">{baseline}</span>
              <span className="text-sm text-muted-foreground font-medium">%</span>
            </div>

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
                  const after = Math.max(0, Math.min(100, cat.score));
                  const beforeCat = baselineAnalysis?.categories.find((c) => c.category === cat.category);
                  const before = beforeCat ? Math.max(0, Math.min(100, beforeCat.score)) : after;
                  const diff = after - before;
                  const barColor = after >= 75 ? "bg-emerald-500" : after >= 45 ? "bg-amber-500" : "bg-red-500";
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs capitalize font-medium text-foreground">{catLabels[cat.category] ?? cat.category}</span>
                        <div className="flex items-center gap-1.5">
                          {beforeCat && before !== after && (
                            <span className="text-[10px] tabular-nums text-muted-foreground line-through">{before}%</span>
                          )}
                          <span className="text-xs font-bold tabular-nums text-foreground">{after}%</span>
                          {diff !== 0 && (
                            <span className={cn("text-[10px] font-semibold tabular-nums", diff > 0 ? "text-emerald-500" : "text-orange-500")}>
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        {beforeCat && before !== after && (
                          <div
                            className="absolute h-full rounded-full bg-muted-foreground/25 transition-all duration-500"
                            style={{ width: `${before}%` }}
                          />
                        )}
                        <div
                          className={cn("absolute h-full rounded-full transition-all duration-500", barColor)}
                          style={{ width: `${after}%` }}
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
                className="flex-1 gap-2 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white border-0"
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
