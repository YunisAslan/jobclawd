"use client";

import { useState } from "react";
import { Control, Controller } from "react-hook-form";
import { UserProfile } from "@/types";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import SectionLabel from "@/components/profile/SectionLabel";
import InfoTooltip from "@/components/profile/InfoTooltip";
import ChangeEmailSection from "@/components/settings/ChangeEmailSection";

interface Props {
  control: Control<UserProfile>;
  email?: string;
}

export default function IdentitySection({ control }: Props) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <SectionLabel label="Identity" open={open} onToggle={() => setOpen((v) => !v)} />
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 peer-hover/header:translate-y-0.5 transition-transform duration-150 pt-0.5 pb-8">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">First name</Label>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => <Input placeholder="Jordan" {...field} />}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Last name</Label>
                <Controller
                  name="surname"
                  control={control}
                  render={({ field }) => <Input placeholder="Smith" {...field} />}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <ChangeEmailSection />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">Professional headline</Label>
                <InfoTooltip text="Used as the default search query when filling the feed from your profile." />
              </div>
              <Controller
                name="headline"
                control={control}
                render={({ field }) => (
                  <Input
                    placeholder="e.g. Marketing Manager, Sales Lead"
                    {...field}
                    value={field.value ?? ""}
                  />
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
