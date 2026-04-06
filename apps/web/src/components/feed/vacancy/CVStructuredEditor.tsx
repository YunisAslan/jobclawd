"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Plus, Trash2, GripVertical } from "lucide-react";
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
}

/* ── Main component ── */

export default function CVStructuredEditor({ data, onChange }: CVStructuredEditorProps) {
  const update = useCallback(
    (patch: Partial<CVData>) => onChange({ ...data, ...patch }),
    [data, onChange],
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-8">
        <div className="mx-auto max-w-225 space-y-6">
          {/* Personal Info */}
          <Section title="Personal Information">
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
            <div className="mt-3">
              <Label className="text-[11px] text-muted-foreground mb-1 block">Summary</Label>
              <Textarea
                value={data.personal_info.summary}
                onChange={(e) => update({ personal_info: { ...data.personal_info, summary: e.target.value } })}
                rows={3}
                className="text-sm resize-none"
                placeholder="Professional summary..."
              />
            </div>
          </Section>

          {/* Experience */}
          <Section
            title="Work Experience"
            onAdd={() => update({
              experience: [...data.experience, emptyExperience()],
            })}
          >
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
          </Section>

          {/* Education */}
          <Section
            title="Education"
            onAdd={() => update({
              education: [...data.education, emptyEducation()],
            })}
          >
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
          </Section>

          {/* Skills */}
          <Section
            title="Skills"
            onAdd={() => update({
              skills: [...data.skills, { category: "", items: [] }],
            })}
          >
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
          </Section>

          {/* Languages */}
          <Section
            title="Languages"
            onAdd={() => update({
              languages: [...data.languages, { language: "", level: "" }],
            })}
          >
            <div className="space-y-2">
              {data.languages.map((lang, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={lang.language}
                    onChange={(e) => {
                      const next = [...data.languages];
                      next[i] = { ...lang, language: e.target.value };
                      update({ languages: next });
                    }}
                    placeholder="Language"
                    className="text-sm flex-1"
                  />
                  <Input
                    value={lang.level}
                    onChange={(e) => {
                      const next = [...data.languages];
                      next[i] = { ...lang, level: e.target.value };
                      update({ languages: next });
                    }}
                    placeholder="Level (e.g. Fluent, B2)"
                    className="text-sm flex-1"
                  />
                  <RemoveButton onClick={() => update({ languages: data.languages.filter((_, j) => j !== i) })} />
                </div>
              ))}
            </div>
          </Section>

          {/* Certifications */}
          <Section
            title="Certifications"
            onAdd={() => update({
              certifications: [...data.certifications, emptyCertification()],
            })}
          >
            {data.certifications.map((cert, i) => (
              <div key={cert.id} className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <Input value={cert.name} placeholder="Certification name"
                    className="text-sm"
                    onChange={(e) => {
                      const next = [...data.certifications];
                      next[i] = { ...cert, name: e.target.value };
                      update({ certifications: next });
                    }} />
                  <Input value={cert.issuer} placeholder="Issuer"
                    className="text-sm"
                    onChange={(e) => {
                      const next = [...data.certifications];
                      next[i] = { ...cert, issuer: e.target.value };
                      update({ certifications: next });
                    }} />
                  <Input value={cert.date} placeholder="Date"
                    className="text-sm"
                    onChange={(e) => {
                      const next = [...data.certifications];
                      next[i] = { ...cert, date: e.target.value };
                      update({ certifications: next });
                    }} />
                </div>
                <RemoveButton onClick={() => update({ certifications: data.certifications.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </Section>

          {/* Additional sections */}
          {Object.entries(data.additional_sections).map(([name, items]) => (
            <Section key={name} title={name.charAt(0).toUpperCase() + name.slice(1)}>
              <div className="space-y-1.5">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={item}
                      className="text-sm flex-1"
                      onChange={(e) => {
                        const next = { ...data.additional_sections };
                        next[name] = [...items];
                        next[name][i] = e.target.value;
                        update({ additional_sections: next });
                      }}
                    />
                    <RemoveButton onClick={() => {
                      const next = { ...data.additional_sections };
                      next[name] = items.filter((_, j) => j !== i);
                      if (next[name].length === 0) delete next[name];
                      update({ additional_sections: next });
                    }} />
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

function Section({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <div className="bg-white rounded-xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {onAdd && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onAdd}>
            <Plus className="size-3" /> Add
          </Button>
        )}
      </div>
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
    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-3">
      <div className="flex items-start gap-2">
        <GripVertical className="size-4 text-slate-300 mt-2 shrink-0" />
        <div className="flex-1 grid grid-cols-2 gap-2">
          <Field label="Job Title" value={entry.title}
            onChange={(v) => onChange({ ...entry, title: v })} />
          <Field label="Company" value={entry.company}
            onChange={(v) => onChange({ ...entry, company: v })} />
          <Field label="Location" value={entry.location}
            onChange={(v) => onChange({ ...entry, location: v })} />
          <div className="flex gap-2">
            <Field label="Start" value={entry.start_date} className="flex-1"
              onChange={(v) => onChange({ ...entry, start_date: v })} />
            <Field label="End" value={entry.end_date} className="flex-1"
              onChange={(v) => onChange({ ...entry, end_date: v })} />
          </div>
        </div>
        <RemoveButton onClick={onRemove} />
      </div>
      <BulletList
        items={entry.bullets}
        onChange={(bullets) => onChange({ ...entry, bullets })}
        placeholder="Add accomplishment or responsibility..."
      />
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
    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-3">
      <div className="flex items-start gap-2">
        <GripVertical className="size-4 text-slate-300 mt-2 shrink-0" />
        <div className="flex-1 grid grid-cols-2 gap-2">
          <Field label="Institution" value={entry.institution}
            onChange={(v) => onChange({ ...entry, institution: v })} />
          <Field label="Degree" value={entry.degree}
            onChange={(v) => onChange({ ...entry, degree: v })} />
          <Field label="Field of Study" value={entry.field_of_study}
            onChange={(v) => onChange({ ...entry, field_of_study: v })} />
          <div className="flex gap-2">
            <Field label="Start" value={entry.start_date} className="flex-1"
              onChange={(v) => onChange({ ...entry, start_date: v })} />
            <Field label="End" value={entry.end_date} className="flex-1"
              onChange={(v) => onChange({ ...entry, end_date: v })} />
          </div>
        </div>
        <RemoveButton onClick={onRemove} />
      </div>
      <BulletList
        items={entry.details}
        onChange={(details) => onChange({ ...entry, details })}
        placeholder="Add detail..."
      />
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
    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={group.category}
          onChange={(e) => onChange({ ...group, category: e.target.value })}
          placeholder="Category (e.g. Frontend, Tools)"
          className="text-sm font-medium flex-1"
        />
        <RemoveButton onClick={onRemove} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-700">
            <input
              value={item}
              onChange={(e) => {
                const next = [...group.items];
                next[i] = e.target.value;
                onChange({ ...group, items: next });
              }}
              className="bg-transparent outline-none w-auto min-w-[3ch]"
              style={{ width: `${Math.max(3, item.length)}ch` }}
            />
            <button type="button" onClick={() => onChange({ ...group, items: group.items.filter((_, j) => j !== i) })}
              className="text-slate-400 hover:text-red-500 transition-colors">
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...group, items: [...group.items, ""] })}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-dashed border-slate-300 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors"
        >
          <Plus className="size-3" /> Add
        </button>
      </div>
    </div>
  );
}

/* ── Shared primitives ── */

function Field({ label, value, onChange, className, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-[11px] text-muted-foreground mb-1 block">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm"
        placeholder={placeholder || label}
      />
    </div>
  );
}

function BulletList({ items, onChange, placeholder }: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5 pl-6">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="text-slate-400 mt-2 text-xs shrink-0">•</span>
          <Textarea
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            rows={1}
            className="text-sm flex-1 resize-none min-h-[32px]"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-slate-400 hover:text-red-500 mt-1.5 shrink-0 transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground"
        onClick={() => onChange([...items, ""])}>
        <Plus className="size-3" /> Add item
      </Button>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="text-slate-400 hover:text-red-500 p-1 shrink-0 transition-colors">
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
