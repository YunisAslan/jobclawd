"use client";

import { useState } from "react";
import { Control, Controller } from "react-hook-form";
import { UserProfile } from "@/types";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import SelectBox from "@/components/SelectBox";
import SectionLabel from "@/components/profile/SectionLabel";

const AVAILABILITY_OPTIONS = [
  { value: "immediately", label: "Immediately" },
  { value: "2-weeks", label: "Within 2 weeks" },
  { value: "1-month", label: "Within 1 month" },
  { value: "3-months", label: "Within 3 months" },
  { value: "not-looking", label: "Not actively looking" },
];

interface Props {
  control: Control<UserProfile>;
}

export default function AvailabilitySection({ control }: Props) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <SectionLabel label="Availability" open={open} onToggle={() => setOpen((v) => !v)} />
      <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 peer-hover/header:translate-y-0.5 transition-transform duration-150 pt-0.5 pb-8">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Years of experience</Label>
              <Controller
                name="years_of_experience"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    placeholder="5"
                    min={0}
                    max={50}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Availability</Label>
              <Controller
                name="availability"
                control={control}
                render={({ field }) => (
                  <SelectBox
                    mode="single"
                    placeholder="When can you start?"
                    options={AVAILABILITY_OPTIONS}
                    value={field.value ?? ""}
                    onChange={field.onChange}
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
