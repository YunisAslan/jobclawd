"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, FileSearch, AlertCircle, RefreshCw } from "lucide-react";
import type { CVMatchAnalysis } from "@/types";

interface CVMatchResultsProps {
  analysis: CVMatchAnalysis | null;
  loading: boolean;
  error: string | null;
  analyzed: boolean;
  hasCV: boolean;
  onAnalyze: () => void;
}

const categoryLabels: Record<string, string> = {
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  keywords: "Keywords",
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-match-high" : score >= 45 ? "bg-match-review" : "bg-destructive";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

export default function CVMatchResults({
  analysis,
  loading,
  error,
  analyzed,
  hasCV,
  onAnalyze,
}: CVMatchResultsProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
          <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="text-xs text-primary">Analyzing your CV against the job requirements...</div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-14 rounded-xl" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-48" />
          </div>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2 p-3 rounded-lg border border-border/50">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-2.5 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error && analyzed) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-warning/20 bg-warning/5">
          <AlertCircle className="size-4 text-warning mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{error}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Make sure your CV is a valid PDF or DOCX file and try again.
            </p>
          </div>
        </div>
        <Button
          onClick={onAnalyze}
          size="sm"
          variant="outline"
          className="w-full gap-1.5 text-xs"
        >
          <RefreshCw className="size-3.5" />
          Retry analysis
        </Button>
      </div>
    );
  }

  // Not yet analyzed — show analyze prompt
  if (!analyzed && hasCV) {
    return (
      <div className="space-y-3 py-4">
        <div className="text-center space-y-2">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <FileSearch className="size-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Ready to analyze</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Compare your CV against this vacancy to see what matches, what's missing, and how to improve.
          </p>
        </div>
        <Button
          onClick={onAnalyze}
          className="w-full gap-2"
        >
          <FileSearch className="size-4" />
          Analyze CV Match
        </Button>
      </div>
    );
  }

  // No CV selected
  if (!hasCV) {
    return (
      <div className="text-center py-8 text-xs text-muted-foreground">
        Upload or select a CV above to analyze the match.
      </div>
    );
  }

  if (!analysis) return null;

  const isHigh = analysis.overall_score >= 75;

  return (
    <div className="space-y-4">
      {/* Overall score */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card">
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-xl px-4 py-3 shrink-0",
            isHigh
              ? "bg-match-high/10 border border-match-high/20"
              : "bg-match-review/10 border border-match-review/20",
          )}
        >
          <span
            className={cn(
              "text-2xl font-bold leading-none tabular-nums",
              isHigh ? "text-match-high" : "text-match-review",
            )}
          >
            {analysis.overall_score}
          </span>
          <span
            className={cn(
              "text-[10px] font-semibold mt-0.5 uppercase tracking-wide",
              isHigh ? "text-match-high/70" : "text-match-review/70",
            )}
          >
            CV Match
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">CV-Job Fit</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {analysis.summary}
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      {analysis.categories.map((cat) => (
        <div key={cat.category} className="p-3.5 rounded-xl border border-border/50 bg-card space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              {categoryLabels[cat.category] ?? cat.category}
            </span>
            <span
              className={cn(
                "text-xs font-bold tabular-nums",
                cat.score >= 75 ? "text-match-high" : cat.score >= 45 ? "text-match-review" : "text-destructive",
              )}
            >
              {cat.score}
            </span>
          </div>
          <ScoreBar score={cat.score} />

          {cat.matched.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {cat.matched.map((item) => (
                <Badge
                  key={item}
                  variant="outline"
                  className="text-[10px] font-medium bg-match-high/5 text-match-high border-match-high/20 gap-0.5"
                >
                  <CheckCircle2 className="size-2.5" />
                  {item}
                </Badge>
              ))}
            </div>
          )}

          {cat.missing.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {cat.missing.map((item) => (
                <Badge
                  key={item}
                  variant="outline"
                  className="text-[10px] font-medium bg-destructive/5 text-destructive border-destructive/20 gap-0.5"
                >
                  <XCircle className="size-2.5" />
                  {item}
                </Badge>
              ))}
            </div>
          )}

          {cat.reasoning && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {cat.reasoning}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
