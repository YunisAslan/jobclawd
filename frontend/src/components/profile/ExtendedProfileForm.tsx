"use client";

import { useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { WorkMode, ExperienceLevel } from "@/types";
import { Switch } from "@/components/ui/Switch";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Checkbox } from "@/components/ui/Checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import CVLinkManager from "./CVLinkManager";
import BlacklistManager from "./BlacklistManager";
import { CheckIcon } from "lucide-react";

const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const EXP_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Manager" },
];

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export default function ExtendedProfileForm() {
  const { profile, setProfile } = useProfile();
  const [saved, setSaved] = useState(false);

  const update = (field: string, value: unknown) => {
    setProfile({ ...profile, [field]: value });
    setSaved(false);
  };

  const toggleWorkMode = (mode: WorkMode) => {
    const modes = profile.work_modes.includes(mode)
      ? profile.work_modes.filter((m) => m !== mode)
      : [...profile.work_modes, mode];
    update("work_modes", modes.length > 0 ? modes : [mode]);
  };

  const handleSave = () => {
    setProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-5">
      <FormSection title="Personal information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">First name</Label>
            <Input id="name" placeholder="Your first name" value={profile.name}
              onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="surname">Last name</Label>
            <Input id="surname" placeholder="Your last name" value={profile.surname}
              onChange={(e) => update("surname", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@email.com" value={profile.email}
              onChange={(e) => update("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" placeholder="+1 555 000 0000" value={profile.phone}
              onChange={(e) => update("phone", e.target.value)} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Current status">
        <div className="space-y-2">
          <Label htmlFor="employer">Current employer</Label>
          <Input id="employer" placeholder="Leave blank if unemployed"
            value={profile.current_employer}
            onChange={(e) => update("current_employer", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp-level">Experience level</Label>
          <Select
            value={profile.experience_level}
            onValueChange={(v) => update("experience_level", v as ExperienceLevel)}
          >
            <SelectTrigger id="exp-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXP_LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormSection>

      <FormSection title="Job preferences">
        <div className="space-y-2">
          <Label>Work mode</Label>
          <div className="flex flex-wrap gap-4">
            {WORK_MODES.map((m) => (
              <div key={m.value} className="flex items-center gap-2">
                <Checkbox
                  id={`wm-${m.value}`}
                  checked={profile.work_modes.includes(m.value)}
                  onCheckedChange={() => toggleWorkMode(m.value)}
                />
                <Label htmlFor={`wm-${m.value}`} className="font-normal cursor-pointer">
                  {m.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="relocation"
            checked={profile.relocation}
            onCheckedChange={(v) => update("relocation", v)}
          />
          <Label htmlFor="relocation" className="font-normal cursor-pointer">
            Open to relocation
          </Label>
        </div>
      </FormSection>

      <FormSection
        title="CV links"
        description="Google Drive, Dropbox, or any public link."
      >
        <CVLinkManager
          cvLinks={profile.cv_links}
          onChange={(links) => update("cv_links", links)}
        />
      </FormSection>

      <FormSection
        title="Blacklist"
        description="Jobs from these companies will be automatically filtered out."
      >
        <BlacklistManager
          blacklist={profile.blacklist}
          onChange={(list) => update("blacklist", list)}
        />
      </FormSection>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} className="px-6">
          Save
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckIcon className="size-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
