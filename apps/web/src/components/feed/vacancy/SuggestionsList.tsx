"use client";

import { useState } from "react";
import {
  Search,
  Code2,
  Layout,
  ArrowUp,
  Scissors,
  FileText,
  AlertTriangle,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Check,
  Undo2,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import type { CVSuggestion, CVSuggestionsResponse } from "@/types";

interface SuggestionsListProps {
  data: CVSuggestionsResponse | null;
  loading: boolean;
  error: string | null;
  analyzed: boolean;
  hasCV: boolean;
  onAnalyze: () => void;
  suggestionActions: Record<number, "accepted" | "rejected">;
  onAcceptSuggestion: (index: number, suggestion: CVSuggestion, overrideText?: string) => void;
  onUndoAcceptSuggestion: (index: number) => void;
  onRejectSuggestion: (index: number) => void;
  onResetSuggestion: (index: number) => void;
}

const priorityConfig = {
  high: {
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
    label: "High",
  },
  medium: {
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-400",
    label: "Medium",
  },
  low: {
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    dot: "bg-slate-400",
    label: "Low",
  },
};

const categoryIcons: Record<string, React.ReactNode> = {
  add_keywords: <Search className="size-3.5" />,
  rewrite_bullets: <FileText className="size-3.5" />,
  elevate_experience: <ArrowUp className="size-3.5" />,
  reduce_irrelevant: <Scissors className="size-3.5" />,
  improve_headline: <Layout className="size-3.5" />,
  address_requirements: <AlertTriangle className="size-3.5" />,
  address_gaps:         <AlertTriangle className="size-3.5" />,
};

const categoryLabels: Record<string, string> = {
  add_keywords: "Keywords",
  rewrite_bullets: "Bullets",
  elevate_experience: "Experience",
  reduce_irrelevant: "Reduce",
  improve_headline: "Headline",
  address_requirements: "Requirements",
  address_gaps:         "Gap Fill",
};

function SuggestionCard({
  suggestion,
  action,
  editedText,
  onEditedTextChange,
  onAccept,
  onUndo,
  onDecline,
  onReconsider,
}: {
  suggestion: CVSuggestion;
  action?: "accepted" | "rejected";
  editedText: string;
  onEditedTextChange: (value: string) => void;
  onAccept: () => void;
  onUndo: () => void;
  onDecline: () => void;
  onReconsider: () => void;
}) {
  const pri = priorityConfig[suggestion.priority] ?? priorityConfig.medium;
  const icon = categoryIcons[suggestion.category] ?? <Code2 className="size-3.5" />;
  const isAccepted = action === "accepted";
  const isDeclined = action === "rejected";

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden py-0 transition-all border",
        isAccepted && "border-emerald-200 bg-emerald-50/30",
        isDeclined && "border-border/30 opacity-60",
        !isAccepted && !isDeclined && "border-border/50",
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border/40 bg-background text-muted-foreground/70">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold border",
                  pri.bg,
                  pri.color,
                  pri.border,
                )}
              >
                <span className={cn("size-1.5 rounded-full shrink-0", pri.dot)} />
                {pri.label}
              </span>
              <span className="text-[10px] text-muted-foreground border border-border/40 rounded-full px-2 py-px">
                {categoryLabels[suggestion.category] ?? suggestion.category}
              </span>
              {isAccepted && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 border border-emerald-200 rounded-full px-2 py-px bg-emerald-50">
                  <CheckCircle2 className="size-3" /> Applied
                </span>
              )}
              {isDeclined && (
                <span className="text-[10px] text-muted-foreground border border-border/40 rounded-full px-2 py-px">
                  Declined
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-foreground leading-snug">
              {suggestion.title}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {suggestion.description}
            </p>
          </div>
        </div>

        {/* Diff view — only shown when pending or accepted */}
        {!isDeclined && (suggestion.specific_text || suggestion.suggested_text) && (
          <div className="rounded-md border overflow-hidden text-[11px] font-mono">
            {suggestion.specific_text && (
              <div className="flex gap-2 px-3 py-2 bg-red-50 border-b border-red-100">
                <span className="text-red-400 font-bold select-none shrink-0 leading-5">−</span>
                <span className="text-red-600/80 line-through wrap-break-word leading-5">
                  {suggestion.specific_text}
                </span>
              </div>
            )}
            {suggestion.suggested_text && (
              <div className="flex gap-2 px-3 py-2 bg-emerald-50">
                <span className="text-emerald-500 font-bold select-none shrink-0 leading-5">+</span>
                <span className="text-emerald-700/90 wrap-break-word leading-5">
                  {suggestion.suggested_text}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Editable override — only when pending and there's a suggestion */}
        {!isAccepted && !isDeclined && suggestion.suggested_text && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Edit before applying
            </p>
            <Textarea
              value={editedText}
              onChange={(e) => onEditedTextChange(e.target.value)}
              className="min-h-16 text-[11px] leading-relaxed"
              placeholder="Adjust the suggested text before applying…"
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isAccepted ? (
            <>
              <p className="flex-1 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="size-3.5" /> Applied to draft
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-7"
                onClick={onUndo}
              >
                <Undo2 className="size-3" /> Undo
              </Button>
            </>
          ) : isDeclined ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground h-7"
              onClick={onReconsider}
            >
              Reconsider
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={onAccept}
              >
                <Check className="size-3.5" /> Apply
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={onDecline}
              >
                Decline
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuggestionsList({
  data,
  loading,
  error,
  analyzed,
  hasCV,
  onAnalyze,
  suggestionActions,
  onAcceptSuggestion,
  onUndoAcceptSuggestion,
  onRejectSuggestion,
  onResetSuggestion,
}: SuggestionsListProps) {
  // Derived-state pattern: sync editedSuggestions when data changes
  const [syncedData, setSyncedData] = useState(data);
  const [editedSuggestions, setEditedSuggestions] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const [i, s] of (data?.suggestions ?? []).entries()) {
      init[i] = s.suggested_text ?? "";
    }
    return init;
  });
  if (syncedData !== data) {
    setSyncedData(data);
    const next: Record<number, string> = {};
    for (const [i, s] of (data?.suggestions ?? []).entries()) {
      next[i] = s.suggested_text ?? "";
    }
    setEditedSuggestions(next);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
          <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="text-xs text-primary">Generating optimization suggestions…</div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3.5 rounded-xl border border-border/50 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="h-4 w-18 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error && analyzed) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-warning/20 bg-warning/5">
          <AlertCircle className="size-4 text-warning mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{error}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ensure the AI service is configured and your CV is a valid document.
            </p>
          </div>
        </div>
        <Button onClick={onAnalyze} size="sm" variant="outline" className="w-full gap-1.5 text-xs">
          <RefreshCw className="size-3.5" /> Retry
        </Button>
      </div>
    );
  }

  if (!analyzed && hasCV) {
    return (
      <div className="space-y-3 py-4">
        <div className="text-center space-y-2">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="size-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">CV optimization</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Get specific, actionable suggestions to improve your CV for this role.
          </p>
        </div>
        <Button onClick={onAnalyze} className="w-full justify-between">
          <span className="flex items-center gap-2"><Sparkles className="size-4" /> Get Suggestions</span>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold bg-white/15 dark:bg-white/10 rounded px-1.5 py-0.5 leading-none">3 <Zap className="size-3" /></span>
        </Button>
      </div>
    );
  }

  if (!hasCV) {
    return (
      <div className="text-center py-8 text-xs text-muted-foreground">
        Upload or select a CV above to get optimization suggestions.
      </div>
    );
  }

  if (!data || data.suggestions.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {data.total} suggestion{data.total !== 1 ? "s" : ""} to improve your CV for this role
      </p>
      {data.suggestions.map((suggestion, i) => (
        <SuggestionCard
          key={i}
          suggestion={suggestion}
          action={suggestionActions[i]}
          editedText={editedSuggestions[i] ?? suggestion.suggested_text ?? ""}
          onEditedTextChange={(value) =>
            setEditedSuggestions((prev) => ({ ...prev, [i]: value }))
          }
          onAccept={() => onAcceptSuggestion(i, suggestion, editedSuggestions[i])}
          onUndo={() => onUndoAcceptSuggestion(i)}
          onDecline={() => onRejectSuggestion(i)}
          onReconsider={() => onResetSuggestion(i)}
        />
      ))}
      <Button
        onClick={onAnalyze}
        size="sm"
        variant="ghost"
        className="w-full gap-1.5 text-xs text-muted-foreground"
      >
        <RefreshCw className="size-3" /> Re-analyze
      </Button>
    </div>
  );
}
