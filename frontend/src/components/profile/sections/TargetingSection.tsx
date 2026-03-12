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
import InfoTooltip from "@/components/profile/InfoTooltip";

interface Props {
  control: Control<UserProfile>;
  setValue: UseFormSetValue<UserProfile>;
}

export default function TargetingSection({ control, setValue }: Props) {
  const [open, setOpen] = useState(true);
  const [titleInput, setTitleInput] = useState("");
  const desiredTitles = useWatch({ control, name: "desired_titles" }) ?? [];

  function addTitle() {
    const t = titleInput.trim();
    if (t && !desiredTitles.includes(t)) {
      setValue("desired_titles", [...desiredTitles, t], { shouldDirty: true });
      setTitleInput("");
    }
  }

  function removeTitle(title: string) {
    setValue(
      "desired_titles",
      desiredTitles.filter((t) => t !== title),
      { shouldDirty: true },
    );
  }

  return (
    <div>
      <SectionLabel
        label="Targeting"
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 peer-hover/header:translate-y-0.5 transition-transform duration-150 pt-0.5 pb-8">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Target job titles</Label>
              <InfoTooltip text="Helps find more relevant jobs during search." />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Sales Manager, HR Specialist..."
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTitle();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addTitle}
                className="shrink-0"
              >
                <Plus className="size-4" />
              </Button>
            </div>

            {desiredTitles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {desiredTitles.map((t, i) => (
                  <Badge
                    key={t}
                    variant="default"
                    className={`gap-1 pl-2.5 pr-1 py-0.5 text-xs font-normal ${i === 0 ? "border border-primary" : ""}`}
                  >
                    {t}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-3.5 p-0 hover:bg-transparent hover:text-muted text-white"
                      onClick={() => removeTitle(t)}
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
