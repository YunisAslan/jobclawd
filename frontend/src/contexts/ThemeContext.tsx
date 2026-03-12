"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemePreference = "dark" | "light" | "system";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: "dark" | "light";
  setTheme: (t: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolved: "dark",
  setTheme: () => {},
});

function resolveTheme(pref: ThemePreference): "dark" | "light" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = (localStorage.getItem("jc_theme") as ThemePreference | null) ?? "system";
    const r = resolveTheme(stored);
    setPreference(stored);
    setResolved(r);
    document.documentElement.classList.toggle("dark", r === "dark");

    // Keep "system" in sync with OS changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const pref = (localStorage.getItem("jc_theme") as ThemePreference | null) ?? "system";
      if (pref === "system") {
        const next = mq.matches ? "dark" : "light";
        setResolved(next);
        document.documentElement.classList.toggle("dark", next === "dark");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function setTheme(t: ThemePreference) {
    const r = resolveTheme(t);
    setPreference(t);
    setResolved(r);
    localStorage.setItem("jc_theme", t);
    document.documentElement.classList.toggle("dark", r === "dark");
  }

  return (
    <ThemeContext.Provider value={{ preference, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
