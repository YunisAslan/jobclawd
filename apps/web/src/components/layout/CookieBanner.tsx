"use client";

import { useState } from "react";
import Link from "next/link";
import { Cookie, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { cn } from "@/lib/utils";

const COOKIE_DETAILS = [
  {
    name: "Session",
    category: "Essential",
    purpose: "Keeps you signed in — required for all authenticated features.",
    duration: "30 days",
    always: true,
  },
  {
    name: "Cookie preference",
    category: "Essential",
    purpose: "Remembers your cookie choice so this banner doesn't appear on future visits.",
    duration: "1 year",
    always: true,
  },
  {
    name: "Usage analytics",
    category: "Analytics",
    purpose: "Tracks aggregated activity (analyses run, suggestions applied, CVs compared) to improve the platform. No personal data is shared with third parties.",
    duration: "Session",
    always: false,
  },
  {
    name: "Platform stats",
    category: "Analytics",
    purpose: "Contributes your anonymised usage to the public counters shown on the sign-in page.",
    duration: "Session",
    always: false,
  },
];

export default function CookieBanner() {
  const { consent, resolved, accept, decline } = useCookieConsent();
  const [expanded, setExpanded] = useState(false);

  if (!resolved || consent !== null) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-2xl",
        "bg-card border border-border rounded-2xl shadow-xl",
      )}
      role="dialog"
      aria-label="Cookie consent"
    >
      {/* Main row */}
      <div className="flex items-start sm:items-center gap-4 px-5 py-4">
        <Cookie className="size-4.5 shrink-0 text-primary mt-0.5 sm:mt-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground leading-snug">
            We use essential cookies for authentication and, if you agree, analytics to improve the platform.{" "}
            <Link
              href="/privacy"
              className="text-foreground underline underline-offset-2 hover:text-primary transition-colors whitespace-nowrap"
            >
              Privacy Policy
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={decline}
            className="text-muted-foreground hover:text-foreground h-8 px-3 text-xs"
          >
            Essential only
          </Button>
          <Button
            size="sm"
            onClick={accept}
            className="h-8 px-4 text-xs font-semibold"
          >
            Accept all
          </Button>
        </div>
      </div>

      {/* Details toggle */}
      <div className="border-t border-border">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="cursor-pointer w-full flex items-center gap-1.5 px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform duration-200", expanded && "rotate-180")}
          />
          {expanded ? "Hide" : "Show"} what we store
        </button>

        {expanded && (
          <div className="px-5 pb-4 space-y-2">
            {COOKIE_DETAILS.map((c) => (
              <div
                key={c.name}
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 rounded-lg bg-muted/50 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{c.name}</span>
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      c.always
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {c.category}
                  </span>
                  {c.always && (
                    <span className="text-[10px] text-muted-foreground">always on</span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground text-right">{c.duration}</span>
                <p className="text-[11px] text-muted-foreground leading-snug col-span-2 mt-0.5">
                  {c.purpose}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
