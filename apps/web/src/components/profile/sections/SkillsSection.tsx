"use client";

import { useState } from "react";
import { Control, useWatch, UseFormSetValue } from "react-hook-form";
import { UserProfile } from "@/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Label } from "@/components/ui/Label";
import { Plus, X } from "lucide-react";
import SectionLabel from "@/components/profile/SectionLabel";

interface Props {
  control: Control<UserProfile>;
  setValue: UseFormSetValue<UserProfile>;
}

export default function SkillsSection({ control, setValue }: Props) {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const skills = useWatch({ control, name: "skills" }) ?? [];

  function addSkill() {
    const s = input.trim();
    if (s && !skills.includes(s)) {
      setValue("skills", [...skills, s], { shouldDirty: true });
      setInput("");
    }
  }

  function removeSkill(skill: string) {
    setValue(
      "skills",
      skills.filter((s) => s !== skill),
      { shouldDirty: true },
    );
  }

  return (
    <div>
      <SectionLabel label="Skills" open={open} onToggle={() => setOpen((v) => !v)} />
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 peer-hover/header:translate-y-0.5 transition-transform duration-150 pt-0.5 pb-8">
            <Label className="text-xs text-muted-foreground">Add your key skills</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. React, Python, SQL..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addSkill} className="shrink-0">
                <Plus className="size-4" />
              </Button>
            </div>

            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1 pl-2.5 pr-1 py-0.5 text-xs font-normal">
                    {s}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-3.5 p-0 hover:bg-transparent hover:text-destructive"
                      onClick={() => removeSkill(s)}
                    >
                      <X className="size-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
