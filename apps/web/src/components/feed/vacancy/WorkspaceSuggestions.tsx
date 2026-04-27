"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
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
  Sparkles,
  RefreshCw,
} from "lucide-react";
import type { CVData, CVSuggestion, CVSuggestionsResponse, SuggestionCategory } from "@/types";

/* ── Target section mapping ── */

const CATEGORY_TARGET: Record<SuggestionCategory, { label: string; sectionId: string }> = {
  add_keywords:         { label: "Skills",      sectionId: "cv-section-skills" },
  rewrite_bullets:      { label: "Experience",  sectionId: "cv-section-experience" },
  elevate_experience:   { label: "Experience",  sectionId: "cv-section-experience" },
  reduce_irrelevant:    { label: "Experience",  sectionId: "cv-section-experience" },
  improve_headline:     { label: "Summary",     sectionId: "cv-section-personal" },
  address_requirements: { label: "Experience",  sectionId: "cv-section-experience" },
  address_gaps:         { label: "Experience",  sectionId: "cv-section-experience" },
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
  onGenerateSuggestions?: () => void;
  cvData?: CVData | null;
}

/**
 * Resolve the *current* text in the CV for a suggestion's "before" slot.
 * This prevents the diff from showing stale text that was captured at analysis
 * time but has since been edited by the user.
 *
 * Returns null if the text no longer exists in the CV (e.g. a bullet was
 * already removed), which hides the minus row entirely.
 */
function resolveCurrentBeforeText(suggestion: CVSuggestion, cvData: CVData | null | undefined): string | null {
  if (!suggestion.specific_text) return null; // add-type: no "before"
  if (!cvData) return suggestion.specific_text;

  const target = suggestion.specific_text.trim();

  switch (suggestion.category) {
    case "improve_headline":
      // Always show the CURRENT summary so the user sees what will be replaced.
      return cvData.personal_info.summary || target;

    case "rewrite_bullets":
    case "elevate_experience":
    case "address_requirements":
    case "address_gaps": {
      // Find the bullet that still contains the original text.
      for (const entry of cvData.experience) {
        const match = entry.bullets.find((b) => b.includes(target) || target.includes(b));
        if (match) return match;
      }
      // Bullet no longer exists — was already applied or removed. Hide minus row.
      return null;
    }

    case "reduce_irrelevant": {
      for (const entry of cvData.experience) {
        const match = entry.bullets.find((b) => b.includes(target) || target.includes(b));
        if (match) return match;
      }
      return null; // Already removed.
    }

    default:
      return target;
  }
}

function extractQuotedValue(text: string): string {
  const match = text.match(/'([^']+)'|"([^"]+)"/);
  return match ? (match[1] || match[2] || "") : "";
}

const BULLET_GLYPH_RE = /[\u25A0\u25A1\u25AA\u25AB\u25CF\u25CB\u25C6\u25C7\u25B8\u25B6\u25BA\u2B1B\u2B1C\u2756\u00B7]/g;
const LEADING_LABEL_RE = /^[A-Z][A-Z0-9\s&/+\-]{2,}?(?:\s{2,}|[:—–-]\s+|\s(?=[A-Z][a-z]))/;

/** Strip AI instruction prefixes, bullet glyphs, and ALL-CAPS labels from suggestion text. */
function cleanSuggestionText(text: string): string {
  let out = text
    .replace(BULLET_GLYPH_RE, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[-•*]\s+/, "")
    .replace(/^add\s+to\s+\w[\w\s]*\s*:\s*/i, "")
    .replace(/^(?:add|include|consider\s+adding)\s+(?:the\s+)?(?:following\s+)?(?:skills?|keywords?|items?|bullet[s]?)\s*:\s*/i, "")
    .replace(/^include\s*:\s*/i, "")
    .replace(/^consider\s+adding\s*:\s*/i, "")
    .trim();
  const labelMatch = out.match(LEADING_LABEL_RE);
  if (labelMatch && labelMatch[0].length < out.length - 10) {
    out = out.slice(labelMatch[0].length).trim();
  }
  return out;
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
  onGenerateSuggestions,
  cvData,
}: WorkspaceSuggestionsProps) {
  const list = suggestions?.suggestions ?? [];

  const [syncedSuggestions, setSyncedSuggestions] = useState(suggestions);
  const [edited, setEdited] = useState<Record<number, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrollBelow, setHasScrollBelow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setHasScrollBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [list.length]);
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
    <aside className="w-80 flex-none border-r border-border/50 flex flex-col overflow-hidden bg-muted/20" data-tour="workspace-suggestions">

      {/* Header — fixed, slightly elevated */}
      <div className="px-4 pt-3.5 pb-3 border-b border-border/40 shrink-0 space-y-2.5 bg-background">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-foreground">AI Suggestions</p>
            {list.length > 0 && (
              <Badge variant="outline" className="text-[10px] font-medium">{list.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {appliedCount > 0 && (
              <Badge className="text-[10px] font-medium bg-success/10 text-success border-success/20 border">
                {appliedCount} applied
              </Badge>
            )}
            {!loading && list.length > 0 && onGenerateSuggestions && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onGenerateSuggestions}
                className="size-6 text-muted-foreground/60 hover:text-foreground"
                title="Regenerate suggestions"
              >
                <RefreshCw className="size-3.5" />
              </Button>
            )}
          </div>
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
                data-tour="apply-all-btn"
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

        {/* How-to guide — always visible, compact inline pills */}
        {!loading && list.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { Icon: Wand2,   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", title: "Apply" },
              { Icon: Copy,    color: "text-blue-600 dark:text-blue-400",        bg: "bg-blue-500/10 border-blue-500/20",       title: "Copy"  },
              { Icon: PenLine, color: "text-amber-600 dark:text-amber-400",      bg: "bg-amber-500/10 border-amber-500/20",     title: "Rewrite" },
            ] as const).map(({ Icon, color, bg, title }) => (
              <div key={title} className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium", bg, color)}>
                <Icon className="size-2.5" />
                {title}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scroll label */}
      {list.length > 0 && !loading && (
        <div className="px-4 py-1.5 shrink-0 flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {pendingCount} pending · {appliedCount} applied · {declinedCount} declined
          </span>
          {hasScrollBelow && (
            <span className="text-[10px] text-muted-foreground animate-pulse">↓ scroll</span>
          )}
        </div>
      )}

      {/* List — distinct background so it reads as a scrollable region */}
      <div className="flex-1 min-h-0 relative">
        {hasScrollBelow && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 z-10 bg-linear-to-t from-muted/40 to-transparent" />
        )}
        <div ref={scrollRef} className="h-full overflow-y-auto px-3 pt-1 pb-3 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              Generating suggestions…
            </div>
          )}
          {!loading && list.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 px-4 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Get AI suggestions</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  AI will review your CV against this job and suggest targeted improvements.
                </p>
              </div>
              {onGenerateSuggestions && (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 mt-1"
                  onClick={onGenerateSuggestions}
                  data-tour="generate-suggestions-btn"
                >
                  <Sparkles className="size-3.5" />
                  Generate suggestions
                </Button>
              )}
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
              cvData={cvData}
            />
          ))}
        </div>
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
  cvData?: CVData | null;
}

function SuggestionCard({
  index, suggestion, action, editedText, onEditChange,
  onAccept, onUndo, onReject, onReset, readOnly, cvData,
}: SuggestionCardProps) {
  const isAccepted = action === "accepted";
  const isDeclined = action === "rejected";
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);

  const priorityDot =
    suggestion.priority === "high"   ? "bg-destructive"
    : suggestion.priority === "medium" ? "bg-warning"
    : "bg-muted-foreground/40";

  const isAddType     = !suggestion.specific_text;
  const target        = CATEGORY_TARGET[suggestion.category];
  const currentBefore = resolveCurrentBeforeText(suggestion, cvData);

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
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-auto p-0 text-[10px] text-primary font-medium mt-0.5 gap-0.5"
          >
            {expanded
              ? <><ChevronUp className="size-3" /> Less</>
              : <><ChevronDown className="size-3" /> Read more</>}
          </Button>
        )}
      </div>

      {/* Diff block */}
      {!isDeclined && (currentBefore !== null || !isAddType || suggestion.suggested_text) && (
        <div className="rounded border border-border overflow-hidden text-[11px] font-mono ml-3">
          {currentBefore !== null && (
            <div className="flex gap-1.5 px-2 py-1.5 bg-destructive/5 border-b border-destructive/10">
              <span className="text-destructive/60 font-bold shrink-0">−</span>
              <span className="text-destructive/50 line-through wrap-break-word leading-normal flex-1 min-w-0">
                {currentBefore}
              </span>
            </div>
          )}
          <div className="flex items-start gap-1 px-2 py-1.5 bg-success/5">
            <span className="text-success font-bold shrink-0 mt-px">+</span>
            {isAddType ? (
              <>
                <Input
                  type="text"
                  value={editedText}
                  onChange={(e) => onEditChange(e.target.value)}
                  placeholder="Type text to add…"
                  className="flex-1 bg-transparent border-0 shadow-none p-0 h-auto text-success placeholder:text-success/40 text-[11px] leading-normal min-w-0 focus-visible:ring-0"
                />
                {editedText && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyPlusText(editedText)}
                    title="Copy to clipboard"
                    className={cn("size-5 shrink-0", copied ? "text-success" : "text-success/40 hover:text-success")}
                  >
                    {copied ? <ClipboardCheck className="size-3" /> : <Copy className="size-3" />}
                  </Button>
                )}
              </>
            ) : (
              <>
                <span className="text-success/80 wrap-break-word leading-normal flex-1 min-w-0">
                  {editedText}
                </span>
                {editedText && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyPlusText(editedText)}
                    title="Copy to clipboard"
                    className={cn("size-5 shrink-0 ml-1", copied ? "text-success" : "text-success/40 hover:text-success")}
                  >
                    {copied ? <ClipboardCheck className="size-3" /> : <Copy className="size-3" />}
                  </Button>
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
