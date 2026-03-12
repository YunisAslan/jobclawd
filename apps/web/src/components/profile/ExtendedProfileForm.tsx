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
import ProfileIdentityCard from "@/components/profile/ProfileIdentityCard";
import IdentitySection from "@/components/profile/sections/IdentitySection";
import TargetingSection from "@/components/profile/sections/TargetingSection";
import PreferencesSection from "@/components/profile/sections/PreferencesSection";
import AvailabilitySection from "@/components/profile/sections/AvailabilitySection";
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
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 items-start">
        {/* LEFT: sticky identity card */}
        <ProfileIdentityCard control={control} saving={saving} saved={saved} isDirty={isDirty} />

        {/* RIGHT: form sections */}
        <div className="space-y-3 bg-card border border-border/60 shadow-sm rounded-xl p-6">
          <IdentitySection control={control} email={profile.email} />
          <TargetingSection control={control} setValue={setValue} />
          <PreferencesSection control={control} meta={meta} />
          <AvailabilitySection control={control} />
          <DocumentsSection control={control} />

          {/* Mobile save */}
          <div className="flex items-center justify-end gap-3 lg:hidden pb-2">
            {isDirty && !saving && !saved && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />
                Unsaved changes
              </p>
            )}
            <Button type="submit" className="gap-2 min-w-30" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving...
                </>
              ) : saved ? (
                <>
                  <Check className="size-4" /> Saved
                </>
              ) : (
                "Save profile"
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
