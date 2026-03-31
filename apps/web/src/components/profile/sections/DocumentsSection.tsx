"use client";

import { useState } from "react";
import { Control, Controller } from "react-hook-form";
import { UserProfile } from "@/types";
import { Label } from "@/components/ui/Label";
import CVLinkManager from "@/components/profile/CVLinkManager";
import BlacklistManager from "@/components/profile/BlacklistManager";
import SectionLabel from "@/components/profile/SectionLabel";
import InfoTooltip from "@/components/profile/InfoTooltip";

interface Props {
  control: Control<UserProfile>;
}

export default function DocumentsSection({ control }: Props) {
  const [cvsOpen, setCvsOpen] = useState(true);
  const [blockOpen, setBlockOpen] = useState(true);
  return (
    <>
      <div>
        <SectionLabel
          label="CVs & Documents"
          open={cvsOpen}
          onToggle={() => setCvsOpen((v) => !v)}
        />
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${cvsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="overflow-hidden">
            <div className="peer-hover/header:translate-y-0.5 transition-transform duration-150 pt-0.5 pb-8">
              <Controller
                name="cv_links"
                control={control}
                render={({ field }) => (
                  <CVLinkManager cvLinks={field.value ?? []} onChange={field.onChange} />
                )}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel label="Blocklist" open={blockOpen} onToggle={() => setBlockOpen((v) => !v)} />
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${blockOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="overflow-hidden">
            <div className="space-y-4 peer-hover/header:translate-y-0.5 transition-transform duration-150 pt-0.5 pb-8">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Blocked companies</Label>
                  <InfoTooltip text="Jobs from these companies will be excluded from your search results." />
                </div>
                <Controller
                  name="blacklist"
                  control={control}
                  render={({ field }) => (
                    <BlacklistManager blacklist={field.value ?? []} onChange={field.onChange} />
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
