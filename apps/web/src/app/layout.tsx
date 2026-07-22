import type { Metadata } from "next";
import "../styles/globals.css";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import AppShell from "@/components/layout/AppShell";
import CookieBanner from "@/components/layout/CookieBanner";
import FeedbackButton from "@/components/layout/FeedbackButton";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { SidebarShellProvider } from "@/contexts/SidebarShellContext";
import { FeedUrlProvider } from "@/contexts/FeedUrlContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { ApiKeyProvider } from "@/contexts/ApiKeyContext";
import QueryProvider from "@/components/providers/QueryProvider";
import { Toaster } from "sonner";
import { generateOrganizationSchema, generateWebSiteSchema, BASE_URL } from "@/lib/seo";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
  adjustFontFallback: false,
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "JobClawd — AI-Powered Job Search",
    template: "%s | JobClawd",
  },
  description:
    "Search 10+ job boards simultaneously — AI scores every vacancy against your CV. Find the right job faster with AI-driven match scoring and CV optimization.",
  keywords: [
    "job search",
    "AI job matching",
    "job board aggregator",
    "CV optimizer",
    "career",
    "job application",
    "ATS",
    "resume scoring",
  ],
  authors: [{ name: "JobClawd" }],
  creator: "JobClawd",
  openGraph: {
    type: "website",
    siteName: "JobClawd",
    title: "JobClawd — AI-Powered Job Search",
    description: "Search 10+ job boards simultaneously — AI scores every vacancy against your CV.",
    url: BASE_URL,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "JobClawd — AI-Powered Job Search",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JobClawd — AI-Powered Job Search",
    description: "Search 10+ job boards simultaneously — AI scores every vacancy against your CV.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sansFont.variable} ${monoFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Blocking script — runs before paint to prevent theme flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('jc_theme');var d=s==='dark'||((!s||s==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateOrganizationSchema()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateWebSiteSchema()),
          }}
        />
      </head>
      <body className="antialiased">
        <CookieConsentProvider>
          <QueryProvider>
            <AuthProvider>
              <ThemeProvider>
                <TooltipProvider delayDuration={200}>
                  <CreditsProvider>
                    <ApiKeyProvider>
                      <ProfileProvider>
                        <SidebarShellProvider>
                          <FeedUrlProvider>
                            <AppShell>{children}</AppShell>
                          </FeedUrlProvider>
                          <Toaster position="top-center" richColors />
                          <FeedbackButton />
                        </SidebarShellProvider>
                      </ProfileProvider>
                    </ApiKeyProvider>
                  </CreditsProvider>
                </TooltipProvider>
              </ThemeProvider>
            </AuthProvider>
          </QueryProvider>
          <CookieBanner />
        </CookieConsentProvider>
      </body>
    </html>
  );
}
