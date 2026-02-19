"use client";

import { usePathname } from "next/navigation";
import AppSidebar from "@/components/layout/Sidebar";

const APP_ROUTES = ["/dashboard", "/feed", "/applications", "/profile", "/settings"];

function isAppRoute(pathname: string) {
  return APP_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isAppRoute(pathname)) {
    // Landing page, auth pages — render without sidebar
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
