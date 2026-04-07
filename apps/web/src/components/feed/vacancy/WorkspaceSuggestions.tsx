"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  Check,
  Undo2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Copy,
  ClipboardCheck,
  Wand2,
  PenLine,
  ChevronsRight,
} from "lucide-react";
import type { CVSuggestion, CVSuggestionsResponse, SuggestionCategory } from "@/types";

/* ── Target section mapping ── */

const CATEGORY_TARGET: Record<SuggestionCategory, { label: string; sectionId: string }> = {
  add_keywords:         { label: "Skills",      sectionId: "cv-section-skills" },
  rewrite_bullets:      { label: "Experience",  sectionId: "cv-section-experience" },
  elevate_experience:   { label: "Experience",  sectionId: "cv-section-experience" },
  reduce_irrelevant:    { label: "Experience",  sectionId: "cv-section-experience" },
  improve_headline:     { label: "Summary",     sectionId: "cv-section-personal" },
  address_requirements: { label: "Experience",  sectionId: "cv-section-experience" },
};

export function getTargetSectionId(category: SuggestionCategory): string {
  return CATEGORY_TARGET[category]?.sectionId ?? "cv-section-personal";
}

/* ── Props ── */

interface WorkspaceSuggestionsProps {
  suggestions: CVSuggestionsResponse | null;
  loading: boolean;
  suggestionActions: Record<number, "accepted" | "rejected">;
  onAccept: (index: number, suggestion: CVSuggestion, overrideText?: string) => void;
  onUndo: (index: number) => void;
  onReject: (index: number) => void;
  onReset: (index: number) => void;
  readOnly?: boolean;
  onAppliedScrollTarget?: (sectionId: string) => void;
}

function extractQuotedValue(text: string): string {
  const match = text.match(/'([^']+)'|"([^"]+)"/);
  return match ? (match[1] || match[2] || "") : "";
}

/** Strip AI instruction prefixes that sometimes appear verbatim in suggestion text. */
function cleanSuggestionText(text: string): string {
  return text
    .replace(/^add\s+to\s+\w[\w\s]*\s*:\s*/i, "")
    .replace(/^(?:add|include|consider\s+adding)\s+(?:the\s+)?(?:following\s+)?(?:skills?|keywords?|items?|bullet[s]?)\s*:\s*/i, "")
    .replace(/^include\s*:\s*/i, "")
    .replace(/^consider\s+adding\s*:\s*/i, "")
    .trim();
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
  onAppliedScrollTarget,
}: WorkspaceSuggestionsProps) {
  const list = suggestions?.suggestions ?? [];

  const [syncedSuggestions, setSyncedSuggestions] = useState(suggestions);
  const [edited, setEdited] = useState<Record<number, string>>({});
  if (syncedSuggestions !== suggestions) {
    setSyncedSuggestions(suggestions);
    const next: Record<number, string> = {};
    for (const [i, s] of list.entries()) {
      const raw = s.suggested_text ?? "";
      next[i] = s.specific_text
        ? cleanSuggestionText(raw)
        : cleanSuggestionText(extractQuotedValue(raw) || raw);
    }
    setEdited(next);
  }

  const appliedCount  = Object.values(suggestionActions).filter((v) => v === "accepted").length;
  const declinedCount = Object.values(suggestionActions).filter((v) => v === "rejected").length;
  const pendingCount  = list.filter((_, i) => !suggestionActions[i]).length;

  function handleAccept(index: number, suggestion: CVSuggestion, overrideText?: string) {
    onAccept(index, suggestion, overrideText);
    onAppliedScrollTarget?.(getTargetSectionId(suggestion.category));
  }

  function handleApplyAll() {
    list.forEach((suggestion, index) => {
      if (!suggestionActions[index]) {
        onAccept(index, suggestion, edited[index] || suggestion.suggested_text || "");
      }
    });
  }

  function handleUndoAll() {
    // Undo in reverse application order so each snapshot correctly unwinds the previous
    list
      .map((_, i) => i)
      .filter((i) => suggestionActions[i] === "accepted")
      .reverse()
      .forEach((i) => onUndo(i));
  }

  return (
    <aside className="w-80 flex-none border-r border-border/50 flex flex-col overflow-hidden bg-background">

      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-border/40 shrink-0 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-foreground">AI Suggestions</p>
            {list.length > 0 && (
              <Badge variant="outline" className="text-[10px] font-medium">{list.length}</Badge>
            )}
          </div>
          {appliedCount > 0 && (
            <Badge className="text-[10px] font-medium bg-success/10 text-success border-success/20 border">
              {appliedCount} applied
            </Badge>
          )}
        </div>

        {/* Apply All / Undo All */}
        {!readOnly && !loading && list.length > 0 && (
          <div className="flex items-center gap-1.5">
            {pendingCount > 0 && (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 h-7 text-[11px] px-2.5 cursor-pointer flex-1"
                onClick={handleApplyAll}
              >
                <Wand2 className="size-3" />
                Apply all ({pendingCount})
              </Button>
            )}
            {appliedCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-[11px] px-2.5 cursor-pointer flex-1"
                onClick={handleUndoAll}
              >
                <Undo2 className="size-3" />
                Undo all ({appliedCount})
              </Button>
            )}
          </div>
        )}

        {/* How-to guide */}
        {!loading && list.length > 0 && (
          <div className="rounded-lg border border-border/50 overflow-hidden divide-y divide-border/40">
            {([
              { Icon: Wand2,   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", title: "Apply",   desc: "Rewrites your CV field automatically" },
              { Icon: Copy,    color: "text-blue-600 dark:text-blue-400",        bg: "bg-blue-500/10",   title: "Copy",    desc: "Paste the text into your own document" },
              { Icon: PenLine, color: "text-amber-600 dark:text-amber-400",      bg: "bg-amber-500/10",  title: "Rewrite", desc: "Read the reasoning, write it yourself" },
            ] as const).map(({ Icon, color, bg, title, desc }) => (
              <div key={title} className="flex items-center gap-2.5 px-2.5 py-2 bg-background">
                <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", bg)}>
                  <Icon className={cn("size-3", color)} />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-foreground">{title}</span>
                  <span className="text-[10px] text-muted-foreground"> — {desc}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
        {loading && (
          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            Generating suggestions…
          </div>
        )}
        {!loading && list.length === 0 && (
          <div className="text-center py-10 px-4 text-xs text-muted-foreground">
            Run CV analysis from the panel to see suggestions here.
          </div>
        )}

        {list.map((suggestion, index) => (
          <SuggestionCard
            key={index}
            index={index}
            suggestion={suggestion}
            action={suggestionActions[index]}
            editedText={edited[index] ?? ""}
            onEditChange={(v) => setEdited((prev) => ({ ...prev, [index]: v }))}
            onAccept={handleAccept}
            onUndo={onUndo}
            onReject={onReject}
            onReset={onReset}
            readOnly={readOnly}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border/40 shrink-0">
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
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);

  const priorityDot =
    suggestion.priority === "high"   ? "bg-destructive"
    : suggestion.priority === "medium" ? "bg-warning"
    : "bg-muted-foreground/40";

  const isAddType = !suggestion.specific_text;
  const target    = CATEGORY_TARGET[suggestion.category];

  function handleCopyPlusText(text: string) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-2 transition-all",
      isAccepted && "border-success/30 bg-success/5",
      isDeclined && "opacity-50 border-border/30",
      !isAccepted && !isDeclined && "border-border/50",
    )}>

      {/* Title row */}
      <div className="flex items-start gap-1.5">
        <span className={cn("mt-1.5 size-1.5 rounded-full shrink-0", priorityDot)} />
        <p className="text-xs font-semibold text-foreground leading-snug flex-1 min-w-0">
          {suggestion.title}
        </p>
        {isAccepted && (
          <Badge className="text-[9px] font-semibold px-1.5 py-0 bg-success/10 text-success border border-success/20 shrink-0">
            Applied
          </Badge>
        )}
      </div>

      {/* Target section */}
      {target && (
        <div className="flex items-center gap-1.5 pl-3">
          <ArrowRight className="size-3 text-primary/50" />
          <span className="text-[10px] font-medium text-primary/70">
            {target.label} section
          </span>
        </div>
      )}

      {/* Description — expandable */}
      <div className="pl-3">
        <p className={cn(
          "text-[11px] text-muted-foreground leading-relaxed",
          !expanded && "line-clamp-2",
        )}>
          {suggestion.description}
        </p>
        {suggestion.description.length > 100 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium mt-0.5 hover:underline cursor-pointer"
          >
            {expanded
              ? <><ChevronUp className="size-3" /> Less</>
              : <><ChevronDown className="size-3" /> Read more</>}
          </button>
        )}
      </div>

      {/* Diff block */}
      {!isDeclined && (suggestion.specific_text || suggestion.suggested_text) && (
        <div className="rounded border border-border overflow-hidden text-[10px] font-mono ml-3">
          {suggestion.specific_text && (
            <div className="flex gap-1.5 px-2 py-1.5 bg-destructive/5 border-b border-destructive/10">
              <span className="text-destructive/60 font-bold shrink-0">−</span>
              <span className="text-destructive/50 line-through wrap-break-word leading-4">
                {suggestion.specific_text}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 px-2 py-1.5 bg-success/5">
            <span className="text-success font-bold shrink-0">+</span>
            {isAddType ? (
              <>
                <input
                  type="text"
                  value={editedText}
                  onChange={(e) => onEditChange(e.target.value)}
                  placeholder="Type text to add…"
                  className="flex-1 bg-transparent outline-none text-success placeholder:text-success/40 text-[10px] leading-4 min-w-0"
                />
                {editedText && (
                  <button
                    type="button"
                    onClick={() => handleCopyPlusText(editedText)}
                    title="Copy to clipboard"
                    className={cn(
                      "shrink-0 p-0.5 rounded transition-colors cursor-pointer",
                      copied ? "text-success" : "text-success/40 hover:text-success",
                    )}
                  >
                    {copied ? <ClipboardCheck className="size-3" /> : <Copy className="size-3" />}
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="text-success/80 wrap-break-word leading-4 flex-1 min-w-0">
                  {suggestion.suggested_text}
                </span>
                {suggestion.suggested_text && (
                  <button
                    type="button"
                    onClick={() => handleCopyPlusText(suggestion.suggested_text ?? "")}
                    title="Copy to clipboard"
                    className={cn(
                      "shrink-0 p-0.5 rounded transition-colors cursor-pointer ml-1",
                      copied ? "text-success" : "text-success/40 hover:text-success",
                    )}
                  >
                    {copied ? <ClipboardCheck className="size-3" /> : <Copy className="size-3" />}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {!readOnly && (
        <div className="flex gap-1.5 pl-3">
          {isAccepted ? (
            <>
              <p className="flex-1 text-[10px] text-success font-medium flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Applied to {target?.label ?? "CV"}
              </p>
              <Button
                type="button" size="sm" variant="outline"
                className="h-6 text-[10px] gap-1 px-2"
                onClick={() => onUndo(index)}
              >
                <Undo2 className="size-2.5" /> Undo
              </Button>
            </>
          ) : isDeclined ? (
            <Button
              type="button" size="sm" variant="ghost"
              className="text-[10px] text-muted-foreground h-6 px-2"
              onClick={() => onReset(index)}
            >
              Reconsider
            </Button>
          ) : (
            <>
              <Button
                type="button" size="sm"
                className="flex-1 h-6 text-[10px] gap-1"
                onClick={() => onAccept(index, suggestion, editedText || suggestion.suggested_text || "")}
              >
                <Check className="size-3" /> Apply to {target?.label ?? "CV"}
              </Button>
              <Button
                type="button" size="sm" variant="outline"
                className="h-6 text-[10px] px-2"
                onClick={() => onReject(index)}
              >
                Decline
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
