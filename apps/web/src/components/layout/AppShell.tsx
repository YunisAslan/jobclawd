"use client";

import { useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import AppSidebar from "@/components/layout/Sidebar";
import TourOverlay from "@/components/onboarding/TourOverlay";
import { TourProvider, useTour } from "@/contexts/TourContext";
import { useAuth } from "@/contexts/AuthContext";

const APP_ROUTES = ["/dashboard", "/feed", "/saved", "/applications", "/profile", "/settings"];

function isAppRoute(pathname: string) {
  return APP_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

// Inner component — sits inside TourProvider so useTour() works here
function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isApp = isAppRoute(pathname);
  const { user } = useAuth();
  const { start } = useTour();

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

  // Auto-start tour on every visit
  useEffect(() => {
    if (isApp && user) {
      const t = setTimeout(start, 800);
      return () => clearTimeout(t);
    }
  }, [isApp, user, start]);

  if (!isApp) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      <TourOverlay />
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const handleTourFinish = useCallback(() => {
    // Remove demo search results so real searches fetch fresh data after the tour
    queryClient.removeQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "feed" && q.queryKey.includes("__demo__"),
    });
  }, [queryClient]);

  return (
    <TourProvider onFinish={handleTourFinish}>
      <AppShellInner>{children}</AppShellInner>
    </TourProvider>
  );
}
