"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";
import type { CVExperienceEntry, CVEducationEntry, CVSkillGroup } from "@/types";
import { Field, BulletList, RemoveButton } from "./CVEditorPrimitives";

/* ── Experience card ── */

export function ExperienceCard({ entry, onChange, onRemove, handle }: {
  entry: CVExperienceEntry;
  onChange: (e: CVExperienceEntry) => void;
  onRemove: () => void;
  handle: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-start gap-2 p-4 pb-3">
        <div className="mt-2">{handle}</div>
        <div className="flex-1 grid grid-cols-2 gap-2.5">
          <Field label="Job Title" value={entry.title}
            onChange={(v) => onChange({ ...entry, title: v })} />
          <Field label="Company" value={entry.company}
            onChange={(v) => onChange({ ...entry, company: v })} />
          <Field label="Location" value={entry.location}
            onChange={(v) => onChange({ ...entry, location: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start Date" value={entry.start_date} placeholder="MM/YYYY"
              onChange={(v) => onChange({ ...entry, start_date: v })} />
            <Field label="End Date" value={entry.end_date} placeholder="Present"
              onChange={(v) => onChange({ ...entry, end_date: v })} />
          </div>
        </div>
        <RemoveButton onClick={onRemove} className="mt-1" />
      </div>
      <div className="px-4 pb-4">
        <BulletList
          items={entry.bullets}
          onChange={(bullets) => onChange({ ...entry, bullets })}
          placeholder="Add accomplishment or responsibility..."
        />
      </div>
    </div>
  );
}

/* ── Education card ── */

export function EducationCard({ entry, onChange, onRemove, handle }: {
  entry: CVEducationEntry;
  onChange: (e: CVEducationEntry) => void;
  onRemove: () => void;
  handle: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-start gap-2 p-4 pb-3">
        <div className="mt-2">{handle}</div>
        <div className="flex-1 grid grid-cols-2 gap-2.5">
          <Field label="Institution" value={entry.institution}
            onChange={(v) => onChange({ ...entry, institution: v })} />
          <Field label="Degree" value={entry.degree}
            onChange={(v) => onChange({ ...entry, degree: v })} />
          <Field label="Field of Study" value={entry.field_of_study}
            onChange={(v) => onChange({ ...entry, field_of_study: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start Date" value={entry.start_date} placeholder="YYYY"
              onChange={(v) => onChange({ ...entry, start_date: v })} />
            <Field label="End Date" value={entry.end_date} placeholder="YYYY or Present"
              onChange={(v) => onChange({ ...entry, end_date: v })} />
          </div>
        </div>
        <RemoveButton onClick={onRemove} className="mt-1" />
      </div>
      <div className="px-4 pb-4">
        <BulletList
          items={entry.details}
          onChange={(details) => onChange({ ...entry, details })}
          placeholder="Add detail or achievement..."
        />
      </div>
    </div>
  );
}

/* ── Skill group card ── */

function isKeywordItem(item: string): boolean {
  const words = item.trim().split(/\s+/);
  return words.length <= 5 && item.length <= 40;
}

export function SkillGroupCard({ group, onChange, onRemove, handle }: {
  group: CVSkillGroup;
  onChange: (g: CVSkillGroup) => void;
  onRemove: () => void;
  handle: React.ReactNode;
}) {
  const pillItems     = group.items.map((item, i) => ({ item, i })).filter(({ item }) =>  isKeywordItem(item));
  const sentenceItems = group.items.map((item, i) => ({ item, i })).filter(({ item }) => !isKeywordItem(item));

  function updateItem(i: number, value: string) {
    const next = [...group.items];
    next[i] = value;
    onChange({ ...group, items: next });
  }

  function removeItem(i: number) {
    onChange({ ...group, items: group.items.filter((_, j) => j !== i) });
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        {handle}
        <Input
          value={group.category}
          onChange={(e) => onChange({ ...group, category: e.target.value })}
          placeholder="Category (e.g. Frontend, Tools, Frameworks)"
          className="flex-1 text-sm font-semibold"
        />
        <RemoveButton onClick={onRemove} />
      </div>

      {/* Short keywords → pill tags */}
      {(pillItems.length > 0 || sentenceItems.length === 0) && (
        <div className="flex flex-wrap gap-1.5">
          {pillItems.map(({ item, i }) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-background border border-border text-xs text-foreground"
            >
              <Input
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                className="bg-transparent border-0 shadow-none outline-none p-0 h-auto min-w-[3ch] text-xs text-foreground focus-visible:ring-0"
                style={{ width: `${Math.max(3, Math.min(item.length, 30))}ch` }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(i)}
                className="size-4 text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="size-3" />
              </Button>
            </span>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...group, items: [...group.items, ""] })}
            className="h-7 px-2.5 text-xs border-dashed text-muted-foreground hover:text-primary"
          >
            <Plus className="size-3" /> Add skill
          </Button>
        </div>
      )}

      {/* Long sentences → full-width input rows */}
      {sentenceItems.length > 0 && (
        <div className="space-y-1.5">
          {sentenceItems.map(({ item, i }) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                className="flex-1 min-w-0 text-xs h-8"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(i)}
                className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          {pillItems.length === 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...group, items: [...group.items, ""] })}
              className="h-7 px-2.5 text-xs border-dashed text-muted-foreground hover:text-primary"
            >
              <Plus className="size-3" /> Add skill
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
