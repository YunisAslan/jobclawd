"use client";

import { useState } from "react";
import { Control, Controller } from "react-hook-form";
import { UserProfile } from "@/types";
import { MetaFiltersResponse } from "@/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import SelectBox from "@/components/SelectBox";
import LocationPicker from "@/components/feed/LocationPicker";
import { DollarSign } from "lucide-react";
import SectionLabel from "@/components/profile/SectionLabel";
import { SALARY_PERIOD_OPTIONS } from "@/constants";

interface Props {
  control: Control<UserProfile>;
  meta: MetaFiltersResponse | undefined;
}

export default function PreferencesSection({ control, meta }: Props) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <SectionLabel
        label="Preferences"
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 peer-hover/header:translate-y-0.5 transition-transform duration-150 pt-0.5 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Work mode
                </Label>
                <Controller
                  name="work_modes"
                  control={control}
                  render={({ field }) => (
                    <SelectBox
                      key={meta?.work_modes?.join(",")}
                      mode="multiple"
                      placeholder="Remote, Hybrid, On-site"
                      options={meta?.work_modes ?? []}
                      value={field.value as string[]}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Experience level
                </Label>
                <Controller
                  name="experience_level"
                  control={control}
                  render={({ field }) => (
                    <SelectBox
                      key={meta?.experience_levels?.join(",")}
                      mode="multiple"
                      placeholder="Select level"
                      options={meta?.experience_levels ?? []}
                      value={(field.value ?? []) as string[]}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Job type
                </Label>
                <Controller
                  name="job_types"
                  control={control}
                  render={({ field }) => (
                    <SelectBox
                      key={meta?.job_types?.join(",")}
                      mode="multiple"
                      placeholder="Full-time, Contract..."
                      options={meta?.job_types ?? []}
                      value={(field.value ?? []) as string[]}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Preferred location
                </Label>
                <Controller
                  name="preferred_location"
                  control={control}
                  render={({ field }) => (
                    <LocationPicker
                      value={field.value}
                      onChange={field.onChange}
                      countries={meta?.countries ?? []}
                    />
                  )}
                />
              </div>
            </div>

            {/* Salary */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Minimum salary expectation
              </Label>
              <div className="flex items-center gap-2 rounded-md border border-input dark:bg-input/30 bg-transparent px-3 h-9 focus-within:border-ring transition-colors">
                <DollarSign className="size-4 text-muted-foreground shrink-0" />
                <Controller
                  name="salary_min"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      autoComplete="off"
                      placeholder="70,000"
                      className="dark:bg-transparent rounded-none h-full w-full border-none p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        if (!raw) {
                          field.onChange("");
                          return;
                        }
                        field.onChange(
                          new Intl.NumberFormat("en-US").format(Number(raw)),
                        );
                      }}
                    />
                  )}
                />
                <div className="flex items-center gap-0.5 border-l border-border pl-2 shrink-0">
                  <Controller
                    name="salary_period"
                    control={control}
                    render={({ field: pf }) => (
                      <>
                        {SALARY_PERIOD_OPTIONS.map(({ value, label }) => (
                          <Button
                            key={value}
                            type="button"
                            variant={
                              (pf.value ?? "annual") === value
                                ? "secondary"
                                : "ghost"
                            }
                            className="h-5 min-w-0 px-1.5 text-[10px] font-semibold rounded-sm"
                            onClick={() => pf.onChange(value)}
                          >
                            {label}
                          </Button>
                        ))}
                      </>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
