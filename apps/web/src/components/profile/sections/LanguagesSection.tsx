"use client";

import { useState } from "react";
import { Control, useWatch, UseFormSetValue } from "react-hook-form";
import { UserProfile, LanguageEntry } from "@/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import SelectBox from "@/components/SelectBox";
import { Plus, Trash2 } from "lucide-react";
import SectionLabel from "@/components/profile/SectionLabel";

const LEVEL_OPTIONS = [
  { value: "native", label: "Native" },
  { value: "fluent", label: "Fluent" },
  { value: "advanced", label: "Advanced" },
  { value: "intermediate", label: "Intermediate" },
  { value: "basic", label: "Basic" },
];

interface Props {
  control: Control<UserProfile>;
  setValue: UseFormSetValue<UserProfile>;
}

export default function LanguagesSection({ control, setValue }: Props) {
  const [open, setOpen] = useState(true);
  const languages = useWatch({ control, name: "language_levels" }) ?? [];

  function addEntry() {
    setValue("language_levels", [...languages, { language: "", level: "" }], { shouldDirty: true });
  }

  function removeEntry(idx: number) {
    setValue(
      "language_levels",
      languages.filter((_, i) => i !== idx),
      { shouldDirty: true },
    );
  }

  function updateEntry(idx: number, field: keyof LanguageEntry, value: string) {
    const updated = languages.map((e, i) => (i === idx ? { ...e, [field]: value } : e));
    setValue("language_levels", updated, { shouldDirty: true });
  }

  return (
    <div>
      <SectionLabel label="Languages" open={open} onToggle={() => setOpen((v) => !v)} />
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 peer-hover/header:translate-y-0.5 transition-transform duration-150 pt-0.5 pb-8">
            {languages.map((entry, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Language</Label>
                  <Input
                    placeholder="e.g. English"
                    value={entry.language}
                    onChange={(e) => updateEntry(idx, "language", e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Level</Label>
                  <SelectBox
                    mode="single"
                    placeholder="Select level"
                    options={LEVEL_OPTIONS}
                    value={entry.level}
                    onChange={(v) => updateEntry(idx, "level", v as string)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeEntry(idx)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addEntry} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add language
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
