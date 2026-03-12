"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import AppSidebar from "@/components/layout/Sidebar";

const APP_ROUTES = ["/dashboard", "/feed", "/applications", "/profile", "/settings"];

function isAppRoute(pathname: string) {
  return APP_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isApp = isAppRoute(pathname);

  useEffect(() => {
    if (isApp) {
      document.body.style.overflow = "hidden";
      document.body.style.height = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.height = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, [isApp]);

  if (!isApp) {
    // Landing page, auth pages — render without sidebar
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}
