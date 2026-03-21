"use client";

import { useState } from "react";
import { Control, useWatch, UseFormSetValue } from "react-hook-form";
import { UserProfile, CoverLetterTemplate } from "@/types";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Plus, Trash2 } from "lucide-react";
import SectionLabel from "@/components/profile/SectionLabel";

interface Props {
  control: Control<UserProfile>;
  setValue: UseFormSetValue<UserProfile>;
}

export default function CoverLetterTemplatesSection({ control, setValue }: Props) {
  const [open, setOpen] = useState(true);
  const templates = useWatch({ control, name: "cover_letter_templates" }) ?? [];

  function addTemplate() {
    setValue("cover_letter_templates", [...templates, { name: "", body: "" }], { shouldDirty: true });
  }

  function removeTemplate(idx: number) {
    setValue(
      "cover_letter_templates",
      templates.filter((_, i) => i !== idx),
      { shouldDirty: true },
    );
  }

  function updateTemplate(idx: number, field: keyof CoverLetterTemplate, value: string) {
    const updated = templates.map((e, i) => (i === idx ? { ...e, [field]: value } : e));
    setValue("cover_letter_templates", updated, { shouldDirty: true });
  }

  return (
    <div>
      <SectionLabel label="Cover Letter Templates" open={open} onToggle={() => setOpen((v) => !v)} />
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 peer-hover/header:translate-y-0.5 transition-transform duration-150 pt-0.5 pb-8">
            {templates.map((tpl, idx) => (
              <div key={idx} className="border border-border/60 rounded-lg p-3 space-y-3 relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTemplate(idx)}
                >
                  <Trash2 className="size-3.5" />
                </Button>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Template name</Label>
                  <Input
                    placeholder="e.g. General, Tech, Creative"
                    value={tpl.name}
                    onChange={(e) => updateTemplate(idx, "name", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cover letter body</Label>
                  <Textarea
                    placeholder="Dear hiring manager..."
                    rows={5}
                    value={tpl.body}
                    onChange={(e) => updateTemplate(idx, "body", e.target.value)}
                    className="resize-y min-h-24"
                  />
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addTemplate} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add template
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
