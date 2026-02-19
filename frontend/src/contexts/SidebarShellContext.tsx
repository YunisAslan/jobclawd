"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SidebarShellContextValue {
  open: boolean;
  toggle: () => void;
}

const SidebarShellContext = createContext<SidebarShellContextValue>({
  open: false,
  toggle: () => {},
});

export function SidebarShellProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <SidebarShellContext.Provider value={{ open, toggle: () => setOpen((o) => !o) }}>
      {children}
    </SidebarShellContext.Provider>
  );
}

export function useSidebarShell() {
  return useContext(SidebarShellContext);
}
