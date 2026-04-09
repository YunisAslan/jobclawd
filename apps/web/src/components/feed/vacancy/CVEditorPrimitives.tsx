"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Link2,
  ArrowUpRight,
} from "lucide-react";

/* ── Utility ── */

export function reorder<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function uid() { return Math.random().toString(36).slice(2, 14); }

/* ── SortableList — generic drag-to-reorder wrapper ── */

export function SortableList<T>({
  items,
  onReorder,
  className,
  renderItem,
}: {
  items: T[];
  onReorder: (newItems: T[]) => void;
  className?: string;
  renderItem: (item: T, index: number, dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  return (
    <div className={className}>
      {items.map((item, i) => {
        const isDragging = dragFrom === i;
        const isDragOver = dragOver === i && dragFrom !== null && dragFrom !== i;

        const handle = (
          <div
            draggable
            onDragStart={(e) => { e.stopPropagation(); setDragFrom(i); e.dataTransfer.effectAllowed = "move"; }}
            onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing p-1 rounded text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/50 transition-colors shrink-0"
          >
            <GripVertical className="size-4" />
          </div>
        );

        return (
          <div
            key={i}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(i); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              if (dragFrom !== null && dragFrom !== i) onReorder(reorder(items, dragFrom, i));
              setDragFrom(null); setDragOver(null);
            }}
            className={cn(
              "transition-all duration-150",
              isDragging && "opacity-40",
              isDragOver && "ring-2 ring-primary/50 rounded-xl",
            )}
          >
            {renderItem(item, i, handle)}
          </div>
        );
      })}
    </div>
  );
}

/* ── Section wrapper ── */

const SECTION_ICONS_MAP: Record<string, React.ReactNode> = {};

export function Section({
  title,
  children,
  onAdd,
  icon,
  id,
  forceOpen,
  dragHandle,
  sectionIconsMap = SECTION_ICONS_MAP,
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
  icon?: React.ReactNode;
  id?: string;
  forceOpen?: boolean;
  dragHandle?: React.ReactNode;
  sectionIconsMap?: Record<string, React.ReactNode>;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const resolvedIcon = icon ?? sectionIconsMap[title];
  const effectiveOpen = isOpen || !!forceOpen;

  return (
    <div
      id={id}
      className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm transition-shadow duration-500 [&.cv-section-highlight]:ring-2 [&.cv-section-highlight]:ring-primary [&.cv-section-highlight]:shadow-[0_0_20px_rgba(123,124,255,0.15)]"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((v) => !v)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setIsOpen((v) => !v)}
        className={cn(
          "flex items-center justify-between px-4 py-3.5 transition-colors cursor-pointer hover:bg-muted/40 select-none",
          effectiveOpen && "border-b border-border/60",
        )}
      >
        <div className="flex items-center gap-2">
          {dragHandle}
          {resolvedIcon && (
            <span className="flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary shrink-0">
              {resolvedIcon}
            </span>
          )}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>

        <div className="flex items-center gap-2">
          {onAdd && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3" /> Add
            </Button>
          )}
          {effectiveOpen
            ? <ChevronUp className="size-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          }
        </div>
      </div>

      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-in-out", effectiveOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="p-5 space-y-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Field (label + input) ── */

export function Field({
  label,
  value,
  onChange,
  className,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="text-sm h-9"
      />
    </div>
  );
}

/* ── LinkedField (display text + separate link URL row) ── */

export function LinkedField({
  label,
  value,
  onChange,
  link,
  onLinkChange,
  linkPlaceholder,
  className,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  link: string;
  onLinkChange: (v: string) => void;
  linkPlaceholder?: string;
  className?: string;
  placeholder?: string;
}) {
  const canOpen = !!link.trim();

  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="text-sm h-9"
      />
      <div className="flex items-center gap-1.5 mt-1">
        <Link2 className="size-3.5 text-muted-foreground/30 shrink-0" />
        <div className="relative flex-1">
          <Input
            value={link}
            onChange={(e) => onLinkChange(e.target.value)}
            placeholder={linkPlaceholder || "https://"}
            className={cn(
              "h-7 text-[11px] border-border/40 bg-muted/30 placeholder:text-muted-foreground/40",
              canOpen && "pr-7",
            )}
          />
          {canOpen && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              title="Open link"
              className="absolute right-0 top-0 h-7 w-7 flex items-center justify-center text-muted-foreground/40 hover:text-primary transition-colors"
            >
              <ArrowUpRight className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Field label ── */

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
      {children}
    </label>
  );
}

/* ── Bullet list with drag-to-reorder ── */

export function BulletList({ items, onChange, placeholder }: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {items.length > 0 && <FieldLabel>Responsibilities &amp; Achievements</FieldLabel>}
      {items.map((item, i) => {
        const isDragging = dragFrom === i;
        const isDragOver = dragOver === i && dragFrom !== null && dragFrom !== i;
        return (
          <div
            key={i}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(i); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              if (dragFrom !== null && dragFrom !== i) onChange(reorder(items, dragFrom, i));
              setDragFrom(null); setDragOver(null);
            }}
            className={cn(
              "flex items-center gap-2 transition-all duration-150",
              isDragging && "opacity-40",
              isDragOver && "ring-2 ring-primary/50 rounded-lg",
            )}
          >
            <div
              draggable
              onDragStart={(e) => { e.stopPropagation(); setDragFrom(i); e.dataTransfer.effectAllowed = "move"; }}
              onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
              onClick={(e) => e.stopPropagation()}
              className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors shrink-0"
            >
              <GripVertical className="size-3.5" />
            </div>
            <Textarea
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              rows={1}
              placeholder={placeholder}
              className="text-sm flex-1 resize-none min-h-9 bg-background border-input focus:border-primary focus:ring-0 transition-colors placeholder:text-muted-foreground rounded-lg"
            />
            <RemoveButton onClick={() => onChange(items.filter((_, j) => j !== i))} />
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, ""])}
        className="h-7 px-3 text-xs border-dashed text-muted-foreground hover:text-primary"
      >
        <Plus className="size-3" /> Add item
      </Button>
    </div>
  );
}

/* ── Empty state ── */

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
      {label}
    </div>
  );
}

/* ── Remove button ── */

export function RemoveButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn("size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0", className)}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
