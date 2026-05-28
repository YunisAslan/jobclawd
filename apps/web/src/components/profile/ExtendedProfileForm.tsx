"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { UserProfile } from "@/types";
import { useProfile } from "@/contexts/ProfileContext";
import { DEFAULT_PROFILE } from "@/contexts/ProfileContext";
import { useMetaFilters } from "@/hooks/use-meta";
import { useProfileQuery, useSaveProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/Button";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ProfileIdentityCard from "@/components/profile/ProfileIdentityCard";
import IdentitySection from "@/components/profile/sections/IdentitySection";
import PreferencesSection from "@/components/profile/sections/PreferencesSection";
import DocumentsSection from "@/components/profile/sections/DocumentsSection";

export default function ExtendedProfileForm() {
  const { profile, setProfile } = useProfile();
  const { data: meta } = useMetaFilters();
  const { data: profileData } = useProfileQuery();
  const { mutateAsync: saveProfile, isPending: saving, isSuccess: saveSuccess } = useSaveProfile();
  const [saved, setSaved] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { isDirty },
  } = useForm<UserProfile>({
    defaultValues: DEFAULT_PROFILE,
  });

  // Populate form when API data arrives
  useEffect(() => {
    if (profileData) {
      reset(profileData);
    }
  }, [profileData, reset]);

  // Brief saved indicator after success
  useEffect(() => {
    if (saveSuccess) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [saveSuccess]);

  async function onSubmit(values: UserProfile) {
    setProfile(values);
    await saveProfile(values);
    reset(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Extra bottom padding on mobile so the fixed save bar never overlaps content */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 sm:gap-8 items-start pb-20 lg:pb-0">
        {/* LEFT: sticky identity card */}
        <ProfileIdentityCard control={control} setValue={setValue} saving={saving} saved={saved} isDirty={isDirty} />

        {/* RIGHT: form sections */}
        <div className="space-y-3 bg-card border border-border/60 shadow-sm rounded-xl p-4 sm:p-6">
          <IdentitySection control={control} email={profile.email} />
          <PreferencesSection control={control} meta={meta} />
          <DocumentsSection control={control} />
        </div>
      </div>

      {/* Fixed save bar — always visible on mobile so users never lose track of save */}
      <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden border-t border-border/60 bg-background/95 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {saving ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin shrink-0" />
              Saving...
            </span>
          ) : saved ? (
            <span className="flex items-center gap-1.5 text-xs text-success font-medium">
              <Check className="size-3.5 shrink-0" />
              Saved
            </span>
          ) : isDirty ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
              Unsaved changes
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/40">Profile</span>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={saving || !isDirty}
          className={cn(
            "gap-1.5 min-w-28 transition-all",
            isDirty && !saving && "shadow-md",
          )}
        >
          {saving ? (
            <><Loader2 className="size-3.5 animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check className="size-3.5" /> Saved</>
          ) : (
            "Save profile"
          )}
        </Button>
      </div>
    </form>
  );
}
