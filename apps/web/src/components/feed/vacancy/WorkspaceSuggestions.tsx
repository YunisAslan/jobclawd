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

function buildCopyText(suggestion: CVSuggestion, editedText: string): string {
  const parts: string[] = [];

  parts.push(`💡 ${suggestion.title}`);
  parts.push(`Why: ${suggestion.description}`);

  if (suggestion.specific_text) {
    parts.push(`\nReplace:\n"${suggestion.specific_text}"`);
  }

  const replacement = editedText || suggestion.suggested_text || "";
  if (replacement) {
    parts.push(suggestion.specific_text ? `With:\n"${replacement}"` : `Add:\n"${replacement}"`);
  }

  return parts.join("\n");
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
      next[i] = s.specific_text
        ? (s.suggested_text ?? "")
        : extractQuotedValue(s.suggested_text ?? "");
    }
    setEdited(next);
  }

  const appliedCount  = Object.values(suggestionActions).filter((v) => v === "accepted").length;
  const declinedCount = Object.values(suggestionActions).filter((v) => v === "rejected").length;

  function handleAccept(index: number, suggestion: CVSuggestion, overrideText?: string) {
    onAccept(index, suggestion, overrideText);
    onAppliedScrollTarget?.(getTargetSectionId(suggestion.category));
  }

  return (
    <aside className="w-80 flex-none border-r border-border/50 flex flex-col overflow-hidden bg-background">

      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-border/40 shrink-0 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">AI Suggestions</p>
          <div className="flex items-center gap-1.5">
            {appliedCount > 0 && (
              <Badge className="text-[10px] font-medium bg-success/10 text-success border-success/20 border">
                {appliedCount} applied
              </Badge>
            )}
            {list.length > 0 && (
              <Badge variant="outline" className="text-[10px] font-medium">{list.length}</Badge>
            )}
          </div>
        </div>

        {/* How-to tip */}
        {!loading && list.length > 0 && (
          <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-primary">Three ways to use these:</p>
            <ul className="space-y-1">
              {[
                { icon: "✦", text: 'Click "Apply" to update your ATS CV automatically' },
                { icon: "⎘", text: 'Click "Copy" and paste into your own CV' },
                { icon: "→", text: "Read the reasoning and rewrite it your own way" },
              ].map(({ icon, text }) => (
                <li key={text} className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
                  <span className="text-primary shrink-0 mt-px">{icon}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
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

  const hasCopyableText =
    !!(editedText || suggestion.suggested_text || suggestion.specific_text);

  function handleCopy() {
    const text = buildCopyText(suggestion, editedText);
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

      {/* Title + copy */}
      <div className="flex items-start gap-1.5">
        <span className={cn("mt-1.5 size-1.5 rounded-full shrink-0", priorityDot)} />
        <p className="text-xs font-semibold text-foreground leading-snug flex-1 min-w-0">
          {suggestion.title}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {isAccepted && (
            <Badge className="text-[9px] font-semibold px-1.5 py-0 bg-success/10 text-success border border-success/20">
              Applied
            </Badge>
          )}
          {hasCopyableText && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copy suggestion to clipboard"
              className={cn(
                "p-1 rounded-md transition-colors cursor-pointer",
                copied
                  ? "text-success bg-success/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {copied
                ? <ClipboardCheck className="size-3" />
                : <Copy className="size-3" />}
            </button>
          )}
        </div>
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
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-success/5">
            <span className="text-success font-bold shrink-0">+</span>
            {isAddType ? (
              <input
                type="text"
                value={editedText}
                onChange={(e) => onEditChange(e.target.value)}
                placeholder="Type text to add…"
                className="flex-1 bg-transparent outline-none text-success placeholder:text-success/40 text-[10px] leading-4"
              />
            ) : (
              <span className="text-success/80 wrap-break-word leading-4">
                {suggestion.suggested_text}
              </span>
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
