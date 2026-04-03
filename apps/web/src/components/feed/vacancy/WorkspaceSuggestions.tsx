"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Check, Undo2, CheckCircle2 } from "lucide-react";
import type { CVSuggestion, CVSuggestionsResponse } from "@/types";

interface WorkspaceSuggestionsProps {
  suggestions: CVSuggestionsResponse | null;
  loading: boolean;
  suggestionActions: Record<number, "accepted" | "rejected">;
  onAccept: (index: number, suggestion: CVSuggestion, overrideText?: string) => void;
  onUndo: (index: number) => void;
  onReject: (index: number) => void;
  onReset: (index: number) => void;
  /** When true, Apply/Decline buttons are hidden (user edits manually in ONLYOFFICE) */
  readOnly?: boolean;
}

/** Extract the first quoted value: "Add 'VTEX' to skills" → "VTEX" */
function extractQuotedValue(text: string): string {
  const match = text.match(/'([^']+)'|"([^"]+)"/);
  return match ? (match[1] || match[2] || "") : "";
}

export default function WorkspaceSuggestions({
  suggestions,
  loading,
  suggestionActions,
  onAccept,
  onUndo,
  onReject,
  onReset,
  readOnly = false,
}: WorkspaceSuggestionsProps) {
  const list = suggestions?.suggestions ?? [];

  // Track user edits for "add" type suggestions (no specific_text)
  const [syncedSuggestions, setSyncedSuggestions] = useState(suggestions);
  const [edited, setEdited] = useState<Record<number, string>>({});
  if (syncedSuggestions !== suggestions) {
    setSyncedSuggestions(suggestions);
    const next: Record<number, string> = {};
    for (const [i, s] of list.entries()) {
      next[i] = s.specific_text ? (s.suggested_text ?? "") : extractQuotedValue(s.suggested_text ?? "");
    }
    setEdited(next);
  }

  const appliedCount = Object.values(suggestionActions).filter((v) => v === "accepted").length;
  const declinedCount = Object.values(suggestionActions).filter((v) => v === "rejected").length;

  return (
    <aside className="w-80 flex-none border-r border-border/50 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-2 shrink-0">
        <p className="text-xs font-semibold text-foreground">Suggestions</p>
        <div className="flex items-center gap-1.5">
          {appliedCount > 0 && (
            <Badge className="text-[10px] font-medium bg-emerald-100 text-emerald-700 border-emerald-200 border">
              {appliedCount} applied
            </Badge>
          )}
          {list.length > 0 && (
            <Badge variant="outline" className="text-[10px] font-medium">{list.length}</Badge>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
        {loading && (
          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            Loading suggestions…
          </div>
        )}
        {!loading && list.length === 0 && (
          <div className="text-center py-10 px-4 text-xs text-muted-foreground">
            Run CV analysis from the panel to see suggestions here.
          </div>
        )}
        {readOnly && !loading && list.length > 0 && (
          <p className="text-[10px] text-muted-foreground bg-amber-50 border border-amber-100 rounded px-2 py-1.5 leading-relaxed">
            Apply suggestions manually in the document editor.
          </p>
        )}

        {list.map((suggestion, index) => (
          <SuggestionCard
            key={index}
            index={index}
            suggestion={suggestion}
            action={suggestionActions[index]}
            editedText={edited[index] ?? ""}
            onEditChange={(v) => setEdited((prev) => ({ ...prev, [index]: v }))}
            onAccept={onAccept}
            onUndo={onUndo}
            onReject={onReject}
            onReset={onReset}
            readOnly={readOnly}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/40 shrink-0">
        <p className="text-[11px] text-muted-foreground">{appliedCount} applied · {declinedCount} declined</p>
      </div>
    </aside>
  );
}

/* ── Suggestion card ── */

interface SuggestionCardProps {
  index: number;
  suggestion: CVSuggestion;
  action?: "accepted" | "rejected";
  editedText: string;
  onEditChange: (value: string) => void;
  onAccept: (index: number, suggestion: CVSuggestion, overrideText?: string) => void;
  onUndo: (index: number) => void;
  onReject: (index: number) => void;
  onReset: (index: number) => void;
  readOnly: boolean;
}

function SuggestionCard({
  index, suggestion, action, editedText, onEditChange,
  onAccept, onUndo, onReject, onReset, readOnly,
}: SuggestionCardProps) {
  const isAccepted = action === "accepted";
  const isDeclined = action === "rejected";
  const priorityDot =
    suggestion.priority === "high" ? "bg-red-500"
    : suggestion.priority === "medium" ? "bg-amber-400"
    : "bg-slate-400";
  const isAddType = !suggestion.specific_text;

  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-2 transition-all",
      isAccepted && "border-emerald-200 bg-emerald-50/40",
      isDeclined && "opacity-50 border-border/30",
      !isAccepted && !isDeclined && "border-border/50",
    )}>
      {/* Title row */}
      <div className="flex items-start gap-1.5">
        <span className={cn("mt-1.5 size-1.5 rounded-full shrink-0", priorityDot)} />
        <p className="text-xs font-semibold text-foreground leading-snug flex-1 min-w-0">{suggestion.title}</p>
        {isAccepted && (
          <Badge className="shrink-0 text-[9px] font-semibold px-1.5 py-0 bg-emerald-100 text-emerald-700 border border-emerald-200">Applied</Badge>
        )}
      </div>

      {/* Description */}
      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 pl-3">{suggestion.description}</p>

      {/* Diff view */}
      {!isDeclined && (suggestion.specific_text || suggestion.suggested_text) && (
        <div className="rounded border overflow-hidden text-[10px] font-mono ml-3">
          {suggestion.specific_text && (
            <div className="flex gap-1.5 px-2 py-1.5 bg-red-50 border-b border-red-100">
              <span className="text-red-400 font-bold shrink-0">−</span>
              <span className="text-red-600/70 line-through wrap-break-word leading-4">{suggestion.specific_text}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-50">
            <span className="text-emerald-500 font-bold shrink-0">+</span>
            {isAddType ? (
              <input
                type="text"
                value={editedText}
                onChange={(e) => onEditChange(e.target.value)}
                placeholder="Type text to add…"
                className="flex-1 bg-transparent outline-none text-emerald-700 placeholder:text-emerald-400/60 text-[10px] leading-4"
              />
            ) : (
              <span className="text-emerald-700/80 wrap-break-word leading-4">{suggestion.suggested_text}</span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {!readOnly && (
        <div className="flex gap-1.5 pl-3">
          {isAccepted ? (
            <>
              <p className="flex-1 text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Applied
              </p>
              <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2"
                onClick={() => onUndo(index)}>
                <Undo2 className="size-2.5" /> Undo
              </Button>
            </>
          ) : isDeclined ? (
            <Button type="button" size="sm" variant="ghost"
              className="text-[10px] text-muted-foreground h-6 px-2"
              onClick={() => onReset(index)}>
              Reconsider
            </Button>
          ) : (
            <>
              <Button type="button" size="sm" className="flex-1 h-6 text-[10px] gap-1"
                onClick={() => onAccept(index, suggestion, editedText || suggestion.suggested_text || "")}>
                <Check className="size-3" /> Apply
              </Button>
              <Button type="button" size="sm" variant="outline" className="flex-1 h-6 text-[10px]"
                onClick={() => onReject(index)}>
                Decline
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
