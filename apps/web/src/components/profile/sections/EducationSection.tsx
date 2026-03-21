"use client";

import { useState } from "react";
import { Control, useWatch, UseFormSetValue } from "react-hook-form";
import { UserProfile, EducationEntry } from "@/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Plus, Trash2 } from "lucide-react";
import SectionLabel from "@/components/profile/SectionLabel";

interface Props {
  control: Control<UserProfile>;
  setValue: UseFormSetValue<UserProfile>;
}

const EMPTY_ENTRY: EducationEntry = {
  institution: "",
  degree: "",
  field_of_study: "",
  start_year: null,
  end_year: null,
};

export default function EducationSection({ control, setValue }: Props) {
  const [open, setOpen] = useState(true);
  const education = useWatch({ control, name: "education" }) ?? [];

  function addEntry() {
    setValue("education", [...education, { ...EMPTY_ENTRY }], { shouldDirty: true });
  }

  function removeEntry(idx: number) {
    setValue(
      "education",
      education.filter((_, i) => i !== idx),
      { shouldDirty: true },
    );
  }

  function updateEntry(idx: number, field: keyof EducationEntry, value: string | number | null) {
    const updated = education.map((e, i) => (i === idx ? { ...e, [field]: value } : e));
    setValue("education", updated, { shouldDirty: true });
  }

  return (
    <div>
      <SectionLabel label="Education" open={open} onToggle={() => setOpen((v) => !v)} />
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 peer-hover/header:translate-y-0.5 transition-transform duration-150 pt-0.5 pb-8">
            {education.map((entry, idx) => (
              <div key={idx} className="border border-border/60 rounded-lg p-3 space-y-3 relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeEntry(idx)}
                >
                  <Trash2 className="size-3.5" />
                </Button>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Institution</Label>
                  <Input
                    placeholder="University / School name"
                    value={entry.institution}
                    onChange={(e) => updateEntry(idx, "institution", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Degree</Label>
                    <Input
                      placeholder="e.g. Bachelor's"
                      value={entry.degree}
                      onChange={(e) => updateEntry(idx, "degree", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Field of study</Label>
                    <Input
                      placeholder="e.g. Computer Science"
                      value={entry.field_of_study}
                      onChange={(e) => updateEntry(idx, "field_of_study", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Start year</Label>
                    <Input
                      type="number"
                      placeholder="2018"
                      min={1950}
                      max={2030}
                      value={entry.start_year ?? ""}
                      onChange={(e) => updateEntry(idx, "start_year", e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">End year</Label>
                    <Input
                      type="number"
                      placeholder="2022"
                      min={1950}
                      max={2030}
                      value={entry.end_year ?? ""}
                      onChange={(e) => updateEntry(idx, "end_year", e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addEntry} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add education
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
