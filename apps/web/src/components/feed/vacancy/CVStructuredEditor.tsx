"use client";

import { useCallback, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  GripVertical,
  User,
  Briefcase,
  GraduationCap,
  Zap,
  Globe,
  Award,
  LayoutGrid,
} from "lucide-react";
import type {
  CVData,
  CVExperienceEntry,
  CVEducationEntry,
  CVSkillGroup,
  CVLanguageEntry,
  CVCertificationEntry,
} from "@/types";

/* ── Props ── */

interface CVStructuredEditorProps {
  data: CVData;
  onChange: (data: CVData) => void;
  /** When set, the editor scrolls to this section and highlights it briefly, then clears. */
  highlightSection?: string | null;
  onHighlightDone?: () => void;
}

/* ── Section icon map ── */

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "Personal Information": <User className="size-3.5" />,
  "Work Experience": <Briefcase className="size-3.5" />,
  Education: <GraduationCap className="size-3.5" />,
  Skills: <Zap className="size-3.5" />,
  Languages: <Globe className="size-3.5" />,
  Certifications: <Award className="size-3.5" />,
};

/* ── Main component ── */

export default function CVStructuredEditor({ data, onChange, highlightSection, onHighlightDone }: CVStructuredEditorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const update = useCallback(
    (patch: Partial<CVData>) => onChange({ ...data, ...patch }),
    [data, onChange],
  );

  // Scroll to and highlight section when highlightSection changes
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

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-muted/40">
      <div className="px-5 py-6">
        <div className="mx-auto max-w-225 space-y-4">

          {/* Personal Information */}
          <Section title="Personal Information" id="cv-section-personal">
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

          {/* Work Experience */}
          <Section
            title="Work Experience"
            id="cv-section-experience"
            onAdd={() => update({ experience: [...data.experience, emptyExperience()] })}
          >
            <div className="space-y-3">
              {data.experience.map((entry, i) => (
                <ExperienceCard
                  key={entry.id}
                  entry={entry}
                  onChange={(updated) => {
                    const next = [...data.experience];
                    next[i] = updated;
                    update({ experience: next });
                  }}
                  onRemove={() => update({ experience: data.experience.filter((_, j) => j !== i) })}
                />
              ))}
              {data.experience.length === 0 && <EmptyState label="No experience added yet" />}
            </div>
          </Section>

          {/* Education */}
          <Section
            title="Education"
            id="cv-section-education"
            onAdd={() => update({ education: [...data.education, emptyEducation()] })}
          >
            <div className="space-y-3">
              {data.education.map((entry, i) => (
                <EducationCard
                  key={entry.id}
                  entry={entry}
                  onChange={(updated) => {
                    const next = [...data.education];
                    next[i] = updated;
                    update({ education: next });
                  }}
                  onRemove={() => update({ education: data.education.filter((_, j) => j !== i) })}
                />
              ))}
              {data.education.length === 0 && <EmptyState label="No education added yet" />}
            </div>
          </Section>

          {/* Skills */}
          <Section
            title="Skills"
            id="cv-section-skills"
            onAdd={() => update({ skills: [...data.skills, { category: "", items: [] }] })}
          >
            <div className="space-y-3">
              {data.skills.map((group, i) => (
                <SkillGroupCard
                  key={i}
                  group={group}
                  onChange={(updated) => {
                    const next = [...data.skills];
                    next[i] = updated;
                    update({ skills: next });
                  }}
                  onRemove={() => update({ skills: data.skills.filter((_, j) => j !== i) })}
                />
              ))}
              {data.skills.length === 0 && <EmptyState label="No skills added yet" />}
            </div>
          </Section>

          {/* Languages */}
          <Section
            title="Languages"
            id="cv-section-languages"
            onAdd={() => update({ languages: [...data.languages, { language: "", level: "" }] })}
          >
            <div className="space-y-2">
              {data.languages.map((lang, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Field
                      label="Language"
                      value={lang.language}
                      onChange={(v) => {
                        const next = [...data.languages];
                        next[i] = { ...lang, language: v };
                        update({ languages: next });
                      }}
                    />
                    <Field
                      label="Proficiency"
                      value={lang.level}
                      onChange={(v) => {
                        const next = [...data.languages];
                        next[i] = { ...lang, level: v };
                        update({ languages: next });
                      }}
                      placeholder="e.g. Fluent, B2, Native"
                    />
                  </div>
                  <RemoveButton onClick={() => update({ languages: data.languages.filter((_, j) => j !== i) })} />
                </div>
              ))}
              {data.languages.length === 0 && <EmptyState label="No languages added yet" />}
            </div>
          </Section>

          {/* Certifications */}
          <Section
            title="Certifications"
            id="cv-section-certifications"
            onAdd={() => update({ certifications: [...data.certifications, emptyCertification()] })}
          >
            <div className="space-y-2">
              {data.certifications.map((cert, i) => (
                <div key={cert.id} className="flex items-end gap-2">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Field label="Certificate Name" value={cert.name} placeholder="e.g. AWS Solutions Architect"
                      onChange={(v) => {
                        const next = [...data.certifications];
                        next[i] = { ...cert, name: v };
                        update({ certifications: next });
                      }} />
                    <Field label="Issuer" value={cert.issuer} placeholder="e.g. Amazon"
                      onChange={(v) => {
                        const next = [...data.certifications];
                        next[i] = { ...cert, issuer: v };
                        update({ certifications: next });
                      }} />
                    <Field label="Date" value={cert.date} placeholder="e.g. 2024-03"
                      onChange={(v) => {
                        const next = [...data.certifications];
                        next[i] = { ...cert, date: v };
                        update({ certifications: next });
                      }} />
                  </div>
                  <div className="pb-0.5">
                    <RemoveButton onClick={() => update({ certifications: data.certifications.filter((_, j) => j !== i) })} />
                  </div>
                </div>
              ))}
              {data.certifications.length === 0 && <EmptyState label="No certifications added yet" />}
            </div>
          </Section>

          {/* Additional sections */}
          {Object.entries(data.additional_sections).map(([name, items]) => (
            <Section key={name} title={name.charAt(0).toUpperCase() + name.slice(1)} icon={<LayoutGrid className="size-3.5" />}>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Field
                      label={`Item ${i + 1}`}
                      value={item}
                      onChange={(v) => {
                        const next = { ...data.additional_sections };
                        next[name] = [...items];
                        next[name][i] = v;
                        update({ additional_sections: next });
                      }}
                    />
                    <div className="pt-5">
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
          ))}

        </div>
      </div>
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
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
  icon?: React.ReactNode;
  id?: string;
}) {
  const resolvedIcon = icon ?? SECTION_ICONS[title];

  return (
    <div id={id} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm transition-shadow duration-500 [&.cv-section-highlight]:ring-2 [&.cv-section-highlight]:ring-primary [&.cv-section-highlight]:shadow-[0_0_20px_rgba(123,124,255,0.15)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          {resolvedIcon && (
            <span className="flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary">
              {resolvedIcon}
            </span>
          )}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/70 text-muted-foreground transition-colors cursor-pointer"
          >
            <Plus className="size-3" /> Add
          </button>
        )}
      </div>
      {/* Body */}
      <div className="p-5 space-y-3">{children}</div>
    </div>
  );
}

/* ── Experience card ── */

function ExperienceCard({ entry, onChange, onRemove }: {
  entry: CVExperienceEntry;
  onChange: (e: CVExperienceEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      {/* Card header row */}
      <div className="flex items-start gap-2 p-4 pb-3">
        <GripVertical className="size-4 text-muted-foreground/40 mt-2.5 shrink-0 cursor-grab" />
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
      {/* Bullets */}
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

function EducationCard({ entry, onChange, onRemove }: {
  entry: CVEducationEntry;
  onChange: (e: CVEducationEntry) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-start gap-2 p-4 pb-3">
        <GripVertical className="size-4 text-muted-foreground/40 mt-2.5 shrink-0 cursor-grab" />
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

function SkillGroupCard({ group, onChange, onRemove }: {
  group: CVSkillGroup;
  onChange: (g: CVSkillGroup) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
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

      <div className="flex flex-wrap gap-1.5">
        {group.items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-background border border-border text-xs text-foreground"
          >
            <input
              value={item}
              onChange={(e) => {
                const next = [...group.items];
                next[i] = e.target.value;
                onChange({ ...group, items: next });
              }}
              className="bg-transparent outline-none min-w-[3ch] text-foreground"
              style={{ width: `${Math.max(3, item.length)}ch` }}
            />
            <button
              type="button"
              onClick={() => onChange({ ...group, items: group.items.filter((_, j) => j !== i) })}
              className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer leading-none"
            >
              ×
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

/* ── Bullet list ── */

function BulletList({ items, onChange, placeholder }: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <FieldLabel>Responsibilities &amp; Achievements</FieldLabel>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-primary mt-2.5 text-xs shrink-0 font-bold">•</span>
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
            className="mt-1.5 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
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

function emptyCertification(): CVCertificationEntry {
  return { id: uid(), name: "", issuer: "", date: "" };
}
