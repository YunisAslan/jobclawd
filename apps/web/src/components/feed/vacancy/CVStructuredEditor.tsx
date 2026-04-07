"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  X,
  GripVertical,
  User,
  Briefcase,
  GraduationCap,
  Zap,
  Globe,
  Award,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  CVData,
  CVExperienceEntry,
  CVEducationEntry,
  CVSkillGroup,
} from "@/types";

/* ── Props ── */

interface CVStructuredEditorProps {
  data: CVData;
  onChange: (data: CVData) => void;
  highlightSection?: string | null;
  onHighlightDone?: () => void;
}

/* ── Section icon map ── */

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "Personal Information": <User className="size-3.5" />,
  "Work Experience":      <Briefcase className="size-3.5" />,
  Education:              <GraduationCap className="size-3.5" />,
  Skills:                 <Zap className="size-3.5" />,
  Languages:              <Globe className="size-3.5" />,
  Certifications:         <Award className="size-3.5" />,
};

type SectionKey = "personal" | "experience" | "education" | "skills" | "languages" | "certifications" | string;
const BASE_ORDER: SectionKey[] = ["personal", "experience", "education", "skills", "languages", "certifications"];

/* ── Utility ── */

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/* ── Main component ── */

export default function CVStructuredEditor({ data, onChange, highlightSection, onHighlightDone }: CVStructuredEditorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const update = useCallback(
    (patch: Partial<CVData>) => onChange({ ...data, ...patch }),
    [data, onChange],
  );

  // Section ordering (local state — not persisted to CVData)
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(() => {
    const extras = Object.keys(data.additional_sections ?? {});
    return [...BASE_ORDER, ...extras];
  });

  // Section-level drag state
  const [secDragFrom, setSecDragFrom] = useState<number | null>(null);
  const [secDragOver, setSecDragOver] = useState<number | null>(null);

  // Scroll-to + highlight
  useEffect(() => {
    if (!highlightSection) return;
    const el = document.getElementById(highlightSection);
    if (!el) { onHighlightDone?.(); return; }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("cv-section-highlight");
    const timer = setTimeout(() => {
      el.classList.remove("cv-section-highlight");
      onHighlightDone?.();
    }, 1800);
    return () => clearTimeout(timer);
  }, [highlightSection, onHighlightDone]);

  // Render a section by its key
  function renderSectionContent(key: SectionKey, dragHandle: React.ReactNode) {
    switch (key) {
      case "personal":
        return (
          <Section
            key="personal"
            title="Personal Information"
            id="cv-section-personal"
            dragHandle={dragHandle}
            forceOpen={highlightSection === "cv-section-personal"}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" value={data.personal_info.full_name}
                onChange={(v) => update({ personal_info: { ...data.personal_info, full_name: v } })} />
              <Field label="Email" value={data.personal_info.email}
                onChange={(v) => update({ personal_info: { ...data.personal_info, email: v } })} />
              <Field label="Phone" value={data.personal_info.phone}
                onChange={(v) => update({ personal_info: { ...data.personal_info, phone: v } })} />
              <Field label="Location" value={data.personal_info.location}
                onChange={(v) => update({ personal_info: { ...data.personal_info, location: v } })} />
              <Field label="LinkedIn" value={data.personal_info.linkedin}
                onChange={(v) => update({ personal_info: { ...data.personal_info, linkedin: v } })} />
              <Field label="Portfolio" value={data.personal_info.portfolio}
                onChange={(v) => update({ personal_info: { ...data.personal_info, portfolio: v } })} />
            </div>
            <div className="mt-1">
              <FieldLabel>Summary</FieldLabel>
              <Textarea
                value={data.personal_info.summary}
                onChange={(e) => update({ personal_info: { ...data.personal_info, summary: e.target.value } })}
                rows={3}
                className="text-sm resize-none bg-background border-input focus:border-primary focus:ring-0 transition-colors placeholder:text-muted-foreground rounded-lg"
                placeholder="Write a short professional summary..."
              />
            </div>
          </Section>
        );

      case "experience":
        return (
          <Section
            key="experience"
            title="Work Experience"
            id="cv-section-experience"
            dragHandle={dragHandle}
            forceOpen={highlightSection === "cv-section-experience"}
            onAdd={() => update({ experience: [...data.experience, emptyExperience()] })}
          >
            <SortableList
              items={data.experience}
              onReorder={(next) => update({ experience: next })}
              className="space-y-3"
              renderItem={(entry, i, handle) => (
                <ExperienceCard
                  entry={entry}
                  handle={handle}
                  onChange={(updated) => {
                    const next = [...data.experience];
                    next[i] = updated;
                    update({ experience: next });
                  }}
                  onRemove={() => update({ experience: data.experience.filter((_, j) => j !== i) })}
                />
              )}
            />
            {data.experience.length === 0 && <EmptyState label="No experience added yet" />}
          </Section>
        );

      case "education":
        return (
          <Section
            key="education"
            title="Education"
            id="cv-section-education"
            dragHandle={dragHandle}
            forceOpen={highlightSection === "cv-section-education"}
            onAdd={() => update({ education: [...data.education, emptyEducation()] })}
          >
            <SortableList
              items={data.education}
              onReorder={(next) => update({ education: next })}
              className="space-y-3"
              renderItem={(entry, i, handle) => (
                <EducationCard
                  entry={entry}
                  handle={handle}
                  onChange={(updated) => {
                    const next = [...data.education];
                    next[i] = updated;
                    update({ education: next });
                  }}
                  onRemove={() => update({ education: data.education.filter((_, j) => j !== i) })}
                />
              )}
            />
            {data.education.length === 0 && <EmptyState label="No education added yet" />}
          </Section>
        );

      case "skills":
        return (
          <Section
            key="skills"
            title="Skills"
            id="cv-section-skills"
            dragHandle={dragHandle}
            forceOpen={highlightSection === "cv-section-skills"}
            onAdd={() => update({ skills: [...data.skills, { category: "", items: [] }] })}
          >
            <SortableList
              items={data.skills}
              onReorder={(next) => update({ skills: next })}
              className="space-y-3"
              renderItem={(group, i, handle) => (
                <SkillGroupCard
                  group={group}
                  handle={handle}
                  onChange={(updated) => {
                    const next = [...data.skills];
                    next[i] = updated;
                    update({ skills: next });
                  }}
                  onRemove={() => update({ skills: data.skills.filter((_, j) => j !== i) })}
                />
              )}
            />
            {data.skills.length === 0 && <EmptyState label="No skills added yet" />}
          </Section>
        );

      case "languages":
        return (
          <Section
            key="languages"
            title="Languages"
            id="cv-section-languages"
            dragHandle={dragHandle}
            forceOpen={highlightSection === "cv-section-languages"}
            onAdd={() => update({ languages: [...data.languages, { language: "", level: "" }] })}
          >
            <div className="space-y-2">
              {data.languages.map((lang, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Field label="Language" value={lang.language}
                      onChange={(v) => { const next = [...data.languages]; next[i] = { ...lang, language: v }; update({ languages: next }); }} />
                    <Field label="Proficiency" value={lang.level} placeholder="e.g. Fluent, B2, Native"
                      onChange={(v) => { const next = [...data.languages]; next[i] = { ...lang, level: v }; update({ languages: next }); }} />
                  </div>
                  <div className="mt-5.5">
                    <RemoveButton onClick={() => update({ languages: data.languages.filter((_, j) => j !== i) })} />
                  </div>
                </div>
              ))}
              {data.languages.length === 0 && <EmptyState label="No languages added yet" />}
            </div>
          </Section>
        );

      case "certifications":
        return (
          <Section
            key="certifications"
            title="Certifications"
            id="cv-section-certifications"
            dragHandle={dragHandle}
            forceOpen={highlightSection === "cv-section-certifications"}
            onAdd={() => update({ certifications: [...data.certifications, emptyCertification()] })}
          >
            <div className="space-y-2">
              {data.certifications.map((cert, i) => (
                <div key={cert.id} className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Field label="Certificate Name" value={cert.name} placeholder="e.g. AWS Solutions Architect"
                      onChange={(v) => { const next = [...data.certifications]; next[i] = { ...cert, name: v }; update({ certifications: next }); }} />
                    <Field label="Issuer" value={cert.issuer} placeholder="e.g. Amazon"
                      onChange={(v) => { const next = [...data.certifications]; next[i] = { ...cert, issuer: v }; update({ certifications: next }); }} />
                    <Field label="Date" value={cert.date} placeholder="e.g. 2024-03"
                      onChange={(v) => { const next = [...data.certifications]; next[i] = { ...cert, date: v }; update({ certifications: next }); }} />
                  </div>
                  <div className="mt-5.5">
                    <RemoveButton onClick={() => update({ certifications: data.certifications.filter((_, j) => j !== i) })} />
                  </div>
                </div>
              ))}
              {data.certifications.length === 0 && <EmptyState label="No certifications added yet" />}
            </div>
          </Section>
        );

      default: {
        // Additional sections
        const name = key;
        const items = data.additional_sections?.[name] ?? [];
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        return (
          <Section
            key={name}
            title={displayName}
            id={`cv-section-${name}`}
            dragHandle={dragHandle}
            icon={<LayoutGrid className="size-3.5" />}
          >
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Field
                    className="flex-1"
                    label={`Item ${i + 1}`}
                    value={item}
                    onChange={(v) => {
                      const next = { ...data.additional_sections };
                      next[name] = [...items];
                      next[name][i] = v;
                      update({ additional_sections: next });
                    }}
                  />
                  <div className="mt-5.5">
                    <RemoveButton onClick={() => {
                      const next = { ...data.additional_sections };
                      next[name] = items.filter((_, j) => j !== i);
                      if (next[name].length === 0) delete next[name];
                      update({ additional_sections: next });
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        );
      }
    }
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-muted/40">
      <div className="px-5 py-6">
        <div className="mx-auto max-w-225 space-y-4">
          {sectionOrder.map((key, i) => {
            const isDragging = secDragFrom === i;
            const isDragOver = secDragOver === i && secDragFrom !== null && secDragFrom !== i;

            // Drag handle node passed into each section header
            const dragHandle = (
              <div
                draggable
                onDragStart={(e) => { e.stopPropagation(); setSecDragFrom(i); e.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={() => { setSecDragFrom(null); setSecDragOver(null); }}
                onClick={(e) => e.stopPropagation()}
                className="cursor-grab active:cursor-grabbing p-1 rounded text-muted-foreground/30 hover:text-muted-foreground/70 hover:bg-muted/50 transition-colors shrink-0"
                title="Drag to reorder section"
              >
                <GripVertical className="size-4" />
              </div>
            );

            return (
              <div
                key={key}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setSecDragOver(i); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSecDragOver(null); }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  if (secDragFrom !== null && secDragFrom !== i) {
                    setSectionOrder((prev) => reorder(prev, secDragFrom, i));
                  }
                  setSecDragFrom(null); setSecDragOver(null);
                }}
                className={cn(
                  "transition-all duration-150",
                  isDragging && "opacity-40",
                  isDragOver && "ring-2 ring-primary/50 rounded-2xl",
                )}
              >
                {renderSectionContent(key, dragHandle)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── SortableList — generic drag-to-reorder wrapper ── */

function SortableList<T>({
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

function Section({
  title,
  children,
  onAdd,
  icon,
  id,
  forceOpen,
  dragHandle,
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
  icon?: React.ReactNode;
  id?: string;
  forceOpen?: boolean;
  dragHandle?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const resolvedIcon = icon ?? SECTION_ICONS[title];
  const effectiveOpen = isOpen || !!forceOpen;

  return (
    <div
      id={id}
      className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm transition-shadow duration-500 [&.cv-section-highlight]:ring-2 [&.cv-section-highlight]:ring-primary [&.cv-section-highlight]:shadow-[0_0_20px_rgba(123,124,255,0.15)]"
    >
      {/* Header — toggle + drag handle */}
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
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/70 text-muted-foreground transition-colors cursor-pointer"
            >
              <Plus className="size-3" /> Add
            </button>
          )}
          {effectiveOpen
            ? <ChevronUp className="size-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          }
        </div>
      </div>

      {/* Body — smooth collapse */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-in-out",
          effectiveOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="p-5 space-y-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Experience card ── */

function ExperienceCard({ entry, onChange, onRemove, handle }: {
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
        <button
          type="button"
          onClick={onRemove}
          className="mt-1 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
        >
          <Trash2 className="size-3.5" />
        </button>
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

function EducationCard({ entry, onChange, onRemove, handle }: {
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
        <button
          type="button"
          onClick={onRemove}
          className="mt-1 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
        >
          <Trash2 className="size-3.5" />
        </button>
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

/** Short skill keywords → pill tag. Long sentences → full-width input row. */
function isKeywordItem(item: string): boolean {
  const words = item.trim().split(/\s+/);
  return words.length <= 5 && item.length <= 40;
}

function SkillGroupCard({ group, onChange, onRemove, handle }: {
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
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Short keywords → pill tags */}
      {(pillItems.length > 0 || sentenceItems.length === 0) && (
        <div className="flex flex-wrap gap-1.5">
          {pillItems.map(({ item, i }) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-background border border-border text-xs text-foreground"
            >
              <input
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                className="bg-transparent outline-none min-w-[3ch] text-foreground"
                style={{ width: `${Math.max(3, Math.min(item.length, 30))}ch` }}
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="flex items-center justify-center size-4 rounded text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...group, items: [...group.items, ""] })}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
          >
            <Plus className="size-3" /> Add skill
          </button>
        </div>
      )}

      {/* Long sentences → full-width input rows */}
      {sentenceItems.length > 0 && (
        <div className="space-y-1.5">
          {sentenceItems.map(({ item, i }) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {pillItems.length === 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...group, items: [...group.items, ""] })}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
            >
              <Plus className="size-3" /> Add skill
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Field (label + input) ── */

function Field({
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

/* ── Field label ── */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
      {children}
    </label>
  );
}

/* ── Bullet list with drag-to-reorder ── */

function BulletList({ items, onChange, placeholder }: {
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
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
      >
        <Plus className="size-3" /> Add item
      </button>
    </div>
  );
}

/* ── Empty state ── */

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
      {label}
    </div>
  );
}

/* ── Remove button ── */

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

/* ── Factory functions ── */

function uid() { return Math.random().toString(36).slice(2, 14); }

function emptyExperience(): CVExperienceEntry {
  return { id: uid(), company: "", title: "", location: "", start_date: "", end_date: "", bullets: [] };
}

function emptyEducation(): CVEducationEntry {
  return { id: uid(), institution: "", degree: "", field_of_study: "", start_date: "", end_date: "", details: [] };
}

function emptyCertification() {
  return { id: uid(), name: "", issuer: "", date: "" };
}
