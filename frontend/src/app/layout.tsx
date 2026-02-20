import type { Metadata } from "next";
import "../styles/globals.css";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import AppShell from "@/components/layout/AppShell";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});
import { ProfileProvider } from "@/contexts/ProfileContext";
import { SidebarShellProvider } from "@/contexts/SidebarShellContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import QueryProvider from "@/components/providers/QueryProvider";

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
    <html lang="en" className={`dark ${sansFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <QueryProvider>
        <AuthProvider>
          <ThemeProvider>
            <TooltipProvider delayDuration={200}>
              <ProfileProvider>
                <SidebarShellProvider>
                  <AppShell>
                    {children}
                  </AppShell>
                </SidebarShellProvider>
              </ProfileProvider>
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
