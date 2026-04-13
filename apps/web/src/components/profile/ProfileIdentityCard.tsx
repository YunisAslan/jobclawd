"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useWatch, Control, UseFormSetValue } from "react-hook-form";
import { UserProfile } from "@/types";
import { useMetaFilters } from "@/hooks/use-meta";
import { profileService } from "@/services/profile.service";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Separator } from "@/components/ui/Separator";
import {
  Check,
  Monitor,
  GraduationCap,
  Briefcase,
  DollarSign,
  FileText,
  Loader2,
  Camera,
  MapPin,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/endpoints";

interface ProfileIdentityCardProps {
  control: Control<UserProfile>;
  setValue: UseFormSetValue<UserProfile>;
  saving: boolean;
  saved: boolean;
  isDirty: boolean;
}

function getPreferredLocationLabel(
  value: UserProfile["preferred_location"],
  countries: NonNullable<ReturnType<typeof useMetaFilters>["data"]>["countries"] | undefined,
): string | null {
  if (!value?.value && !value?.values?.length) return null;

  if (value.values?.length) {
    const allCities = (countries || []).flatMap((country) => country.cities);
    return value.values
      .map((entry) => {
        const city = allCities.find((item) => item.value === entry);
        if (city) return city.label;
        const country = (countries || []).find((item) => item.value === entry);
        if (country) return country.label;
        return entry;
      })
      .join(", ");
  }

  if (!value.value) return null;
  if (value.value === "worldwide") return "Worldwide";

  for (const country of countries || []) {
    if (country.value === value.value) return country.label;
    const city = country.cities.find((item) => item.value === value.value);
    if (city) return `${city.label}, ${country.label}`;
  }

  return value.value;
}

export default function ProfileIdentityCard({
  control,
  setValue,
  saving,
  saved,
  isDirty,
}: ProfileIdentityCardProps) {
  const { data: meta } = useMetaFilters();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const name = useWatch({ control, name: "name" }) ?? "";
  const surname = useWatch({ control, name: "surname" }) ?? "";
  const email = useWatch({ control, name: "email" }) ?? "";
  const avatarUrl = useWatch({ control, name: "avatar_url" }) ?? "";
  const headline = useWatch({ control, name: "headline" }) ?? "";
  const workModes = useWatch({ control, name: "work_modes" }) ?? [];
  const expLevel = useWatch({ control, name: "experience_level" }) ?? [];
  const jobTypes = useWatch({ control, name: "job_types" }) ?? [];
  const salaryMin = useWatch({ control, name: "salary_min" }) ?? "";
  const preferredLocation = useWatch({ control, name: "preferred_location" });
  const cvLinks = useWatch({ control, name: "cv_links" }) ?? [];
  const preferredLocationLabel = getPreferredLocationLabel(preferredLocation, meta?.countries);

  const emailHandle = (email || "").split("@")[0]?.trim() || "";
  const initials =
    [name, surname]
      .filter(Boolean)
      .map((s) => s[0].toUpperCase())
      .join("") ||
    emailHandle.charAt(0).toUpperCase() ||
    "J";
  const displayName = name || surname ? `${name} ${surname}`.trim() : emailHandle || "Your account";
  const avatarSrc = avatarUrl
    ? avatarUrl.startsWith("http")
      ? avatarUrl
      : `${API_BASE_URL}${avatarUrl}`
    : null;

  return (
    <div className="lg:sticky lg:top-20.25 lg:self-start flex flex-col gap-4">
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="h-0.75 bg-primary" />

        <div className="p-5 space-y-5">
          {/* Avatar + name */}
          <div className="flex flex-col items-center text-center gap-3 pt-1">
            <div className="relative group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setUploading(true);
                    const { url } = await profileService.uploadAvatar(file);
                    setValue("avatar_url", url);
                  } catch {
                    // upload failed silently
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="size-15 p-0 rounded-2xl overflow-hidden relative"
              >
                {avatarSrc ? (
                  <Image
                    src={avatarSrc}
                    alt="Profile"
                    fill
                    className="object-cover"
                    unoptimized
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjN2I3Y2ZmIiBvcGFjaXR5PSIwLjMiLz48L3N2Zz4="
                  />
                ) : (
                  <div className="size-full bg-primary flex items-center justify-center text-[22px] font-bold text-white select-none tracking-tight">
                    {initials}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  {uploading ? (
                    <Loader2 className="size-4 text-white animate-spin opacity-0 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <Camera className="size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </Button>
            </div>
            <div className="space-y-0.5 min-w-0 w-full">
              <p className="font-semibold text-sm leading-tight truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground leading-snug truncate px-2">
                {headline || "Add a professional headline"}
              </p>
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Preferences preview */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium block">
              Preferences
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {workModes.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {workModes.map((m) => (
                    <Badge
                      key={m}
                      variant="outline"
                      className="text-[10px] gap-1 border-border px-1.5 py-0 font-normal h-5"
                    >
                      <Monitor className="size-2.5 text-primary" />
                      {m}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">No preferences set</p>
              )}

              {expLevel.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {expLevel.map((lvl) => (
                    <Badge
                      key={lvl}
                      variant="outline"
                      className="text-[10px] gap-1 border-border px-1.5 py-0 font-normal h-5"
                    >
                      <GraduationCap className="size-2.5 text-primary" />
                      {meta?.experience_levels?.find((e) => e.value === lvl)?.label ?? lvl}
                    </Badge>
                  ))}
                </div>
              )}

              {jobTypes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {jobTypes.map((jt) => (
                    <Badge
                      key={jt}
                      variant="outline"
                      className="text-[10px] gap-1 border-border px-1.5 py-0 font-normal h-5"
                    >
                      <Briefcase className="size-2.5 text-muted-foreground" />
                      {jt}
                    </Badge>
                  ))}
                </div>
              )}

              {preferredLocationLabel && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 border-border px-1.5 py-0 font-normal h-5"
                >
                  <MapPin className="size-2.5 text-primary" />
                  {preferredLocationLabel}
                </Badge>
              )}

              {salaryMin && (
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 border-border px-1.5 py-0 font-normal h-5"
                >
                  <DollarSign className="size-2.5 text-success" />
                  {salaryMin}+
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop save button */}
      <div className="hidden lg:flex flex-col gap-1.5">
        <Button type="submit" className="w-full gap-2 justify-center" disabled={saving}>
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
        {isDirty && !saving && !saved && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground justify-center">
            <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />
            Unsaved changes
          </p>
        )}
      </div>
    </div>
  );
}
