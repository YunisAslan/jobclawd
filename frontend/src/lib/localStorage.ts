import { UserProfile } from "@/types";

const PROFILE_KEY = "jobauto_profile";

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  surname: "",
  phone: "",
  email: "",
  current_employer: "",
  work_modes: ["hybrid"],
  experience_level: "mid",
  relocation: false,
  blacklist: [],
  cv_links: [],
  cvLink: "",
};

export function saveProfile(profile: UserProfile): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
}

export function loadProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle missing new fields (backward compat)
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return null;
  }
}

export function clearProfile(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(PROFILE_KEY);
  }
}
