"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface SidebarShellContextValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const SidebarShellContext = createContext<SidebarShellContextValue>({
  open: false,
  toggle: () => {},
  close: () => {},
});

export function SidebarShellProvider({ children }: { children: ReactNode }) {
  // Default closed (mobile-safe). Desktop opens after mount to avoid SSR/mobile flash.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setOpen(true);
    }
  }, []);

  return (
    <SidebarShellContext.Provider
      value={{
        open,
        toggle: () => setOpen((o) => !o),
        close: () => setOpen(false),
      }}
    >
      {children}
    </SidebarShellContext.Provider>
  );
}

export function useSidebarShell() {
  return useContext(SidebarShellContext);
}
