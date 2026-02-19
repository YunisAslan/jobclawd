import type { Metadata } from "next";
import "../styles/globals.css";
import AppShell from "@/components/layout/AppShell";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { SidebarShellProvider } from "@/contexts/SidebarShellContext";
import { TooltipProvider } from "@/components/ui/Tooltip";
import SessionProviderWrapper from "@/components/layout/SessionProviderWrapper";

export const metadata: Metadata = {
  title: "JobClawd - Job Application Automation",
  description:
    "Automate your job search across jobsearch.az, LinkedIn, and Indeed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProviderWrapper>
          <TooltipProvider delayDuration={200}>
            <ProfileProvider>
              <SidebarShellProvider>
                <AppShell>
                  {children}
                </AppShell>
              </SidebarShellProvider>
            </ProfileProvider>
          </TooltipProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
