"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserProfile } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  surname: "",
  email: "",
  current_employer: "",
  work_modes: ["hybrid"],
  experience_level: "mid",
  relocation: false,
  blacklist: [],
  cv_links: [],
  cvLink: "",
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

  // Seed from auth user when it becomes available
  useEffect(() => {
    if (user) {
      setProfileState((prev) => ({
        ...prev,
        email: user.email,
        name: prev.name || user.name || "",
      }));
    }
  }, [user]);

  const setProfile = (p: UserProfile) => {
    // Always keep email in sync with auth
    setProfileState({ ...p, email: user?.email ?? p.email });
  };

  return (
    <ProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
