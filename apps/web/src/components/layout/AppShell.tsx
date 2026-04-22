"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AppSidebar from "@/components/layout/Sidebar";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";

const APP_ROUTES = ["/dashboard", "/feed", "/saved", "/applications", "/profile", "/settings"];

function isAppRoute(pathname: string) {
  return APP_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isApp = isAppRoute(pathname);
  const { user } = useAuth();
  const { profile } = useProfile();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const showOnboarding =
    isApp &&
    !!user &&
    profile.email !== "" &&
    !profile.onboarding_completed &&
    !onboardingDismissed;

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
      {showOnboarding && (
        <OnboardingModal
          userName={user.name || user.email}
          onClose={() => setOnboardingDismissed(true)}
        />
      )}
    </div>
  );
}
