"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  GripVertical,
  User,
  Briefcase,
  GraduationCap,
  Zap,
  Globe,
  Award,
  LayoutGrid,
  Camera,
} from "lucide-react";
import type { CVData, CVExperienceEntry, CVEducationEntry } from "@/types";
import {
  Section,
  SortableList,
  Field,
  FieldLabel,
  EmptyState,
  RemoveButton,
  reorder,
  uid,
} from "./CVEditorPrimitives";
import { ExperienceCard, EducationCard, SkillGroupCard } from "./CVEditorCards";

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

/* ── Main component ── */

export default function CVStructuredEditor({ data, onChange, highlightSection, onHighlightDone }: CVStructuredEditorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const update = useCallback(
    (patch: Partial<CVData>) => onChange({ ...data, ...patch }),
    [data, onChange],
  );

  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(() => {
    const extras = Object.keys(data.additional_sections ?? {});
    return [...BASE_ORDER, ...extras];
  });

  const [secDragFrom, setSecDragFrom] = useState<number | null>(null);
  const [secDragOver, setSecDragOver] = useState<number | null>(null);

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

  function renderSectionContent(key: SectionKey, dragHandle: React.ReactNode) {
    switch (key) {
      case "personal":
        return (
          <Section
            key="personal"
            title="Personal Information"
            id="cv-section-personal"
            dragHandle={dragHandle}
            sectionIconsMap={SECTION_ICONS}
            forceOpen={highlightSection === "cv-section-personal"}
          >
            <div className="flex items-start gap-4">
              {/* Photo upload */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className="relative size-16 rounded-full overflow-hidden border-2 border-dashed border-border bg-muted/40 flex items-center justify-center cursor-pointer group"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => update({ personal_info: { ...data.personal_info, photo: reader.result as string } });
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  }}
                >
                  {data.personal_info.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.personal_info.photo} alt="CV photo" className="size-full object-cover" />
                  ) : (
                    <Camera className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="size-4 text-white" />
                  </div>
                </div>
                {data.personal_info.photo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => update({ personal_info: { ...data.personal_info, photo: undefined } })}
                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </Button>
                )}
                {!data.personal_info.photo && (
                  <span className="text-[10px] text-muted-foreground">Photo</span>
                )}
              </div>

              <div className="flex-1 grid grid-cols-2 gap-3">
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
            sectionIconsMap={SECTION_ICONS}
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
            sectionIconsMap={SECTION_ICONS}
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
            sectionIconsMap={SECTION_ICONS}
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
            sectionIconsMap={SECTION_ICONS}
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
            sectionIconsMap={SECTION_ICONS}
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

/* ── Factory functions ── */

function emptyExperience(): CVExperienceEntry {
  return { id: uid(), company: "", title: "", location: "", start_date: "", end_date: "", bullets: [] };
}

function emptyEducation(): CVEducationEntry {
  return { id: uid(), institution: "", degree: "", field_of_study: "", start_date: "", end_date: "", details: [] };
}

function emptyCertification() {
  return { id: uid(), name: "", issuer: "", date: "" };
}
