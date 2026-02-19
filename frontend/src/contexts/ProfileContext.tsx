"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { UserProfile } from "@/types";
import { loadProfile, saveProfile } from "@/lib/localStorage";

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

interface ProfileContextValue {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: DEFAULT_PROFILE,
  setProfile: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    const stored = loadProfile();
    if (stored) setProfileState(stored);
  }, []);

  const setProfile = (p: UserProfile) => {
    setProfileState(p);
    saveProfile(p);
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
