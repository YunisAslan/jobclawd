"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserProfile } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { profileService } from "@/services/profile.service";
import { PROFILE_QUERY_KEY } from "@/hooks/use-profile";

export const DEFAULT_PROFILE: UserProfile = {
  name: "",
  surname: "",
  email: "",
  work_modes: ["hybrid"],
  experience_level: [],
  relocation: false,
  blacklist: [],
  cv_links: [],
  headline: "",
  job_types: [],
  preferred_location: undefined,
  salary_min: "",
  salary_period: "annual",
};

interface ProfileContextValue {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: DEFAULT_PROFILE,
  setProfile: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfileState] = useState<UserProfile>(DEFAULT_PROFILE);

  // Load from API via react-query — shared cache with useProfileQuery()
  const { data: apiProfile } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => profileService.getProfile(),
    enabled: !!user,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (apiProfile && user) {
      setProfileState({ ...DEFAULT_PROFILE, ...apiProfile, email: user.email });
    } else if (user) {
      setProfileState((prev) => ({
        ...prev,
        email: user.email,
        name: prev.name || user.name || "",
      }));
    }
  }, [apiProfile, user]);

  const setProfile = (p: UserProfile) => {
    setProfileState({ ...p, email: user?.email ?? p.email });
  };

  return (
    <ProfileContext.Provider value={{ profile, setProfile }}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
