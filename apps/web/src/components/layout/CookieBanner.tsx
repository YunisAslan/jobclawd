"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Cookie, ShieldCheck, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  {
    id: "necessary",
    icon: ShieldCheck,
    label: "Strictly Necessary",
    description:
      "These cookies are essential for the website to function. They include your authentication session and your saved cookie preference. They cannot be disabled.",
    always: true,
  },
  {
    id: "analytics",
    icon: BarChart2,
    label: "Analytics",
    description:
      "These cookies help us understand how visitors interact with the platform by collecting aggregated, anonymised data — such as analyses run and suggestions applied. No personal data is shared with third parties.",
    always: false,
  },
];

function CategoryRow({
  cat,
  enabled,
  onToggle,
}: {
  cat: (typeof CATEGORIES)[number];
  enabled: boolean;
  onToggle?: (val: boolean) => void;
}) {
  const [open, setOpen] = useState(cat.always);
  const Icon = cat.icon;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5 bg-muted/40 hover:bg-muted/70 transition-colors">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen((v) => !v)}
          className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
        >
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200 shrink-0",
              open && "rotate-180",
            )}
          />
          <Icon className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground">{cat.label}</span>
        </div>
        <Switch
          checked={enabled}
          disabled={cat.always}
          onCheckedChange={onToggle}
          size="default"
          className={cat.always ? "opacity-60" : ""}
          aria-label={cat.label}
        />
      </div>

      {open && (
        <div className="px-4 py-3 border-t border-border bg-background">
          <p className="text-xs text-muted-foreground leading-relaxed">{cat.description}</p>
          {cat.always && (
            <p className="text-[11px] text-muted-foreground/60 mt-1.5 font-medium">
              Always active
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PreferencesModal({
  open,
  onClose,
  onAcceptAll,
  onRejectAll,
}: {
  open: boolean;
  onClose: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}) {
  const { consent, savePreferences } = useCookieConsent();
  const [analyticsOn, setAnalyticsOn] = useState(consent === "accepted");

  function handleSave() {
    savePreferences({ analytics: analyticsOn });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-lg p-0 gap-0 overflow-hidden"
        showCloseButton
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-base font-semibold">Cookie preferences</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Your Privacy</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When you visit our website, we may store or retrieve information on your browser,
              mostly in the form of cookies. This information might be about you, your preferences,
              or your device and is used to make the site work as you expect it to. It does not
              usually directly identify you, but it can give you a more personalised experience.{" "}
              <Link href="/privacy" className="text-primary hover:underline underline-offset-2">
                Privacy Policy
              </Link>
            </p>
          </div>

          <div className="space-y-2.5">
            {CATEGORIES.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                enabled={cat.always ? true : analyticsOn}
                onToggle={cat.always ? undefined : setAnalyticsOn}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => { onAcceptAll(); onClose(); }}
            className="h-9 px-4 text-xs font-semibold"
          >
            Accept all
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { onRejectAll(); onClose(); }}
            className="h-9 px-4 text-xs"
          >
            Reject all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            className="h-9 px-4 text-xs ml-auto"
          >
            Save preferences
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CookieBanner() {
  const { consent, resolved, accept, decline } = useCookieConsent();
  const [modalOpen, setModalOpen] = useState(false);

  if (!resolved || consent !== null) return null;

  return (
    <>
      <div
        className={cn(
          "fixed bottom-4 left-1/2 -translate-x-1/2 z-9999",
          "w-[calc(100%-2rem)] max-w-2xl",
          "bg-card border border-border rounded-2xl shadow-xl",
          "px-5 py-4",
        )}
        role="dialog"
        aria-label="Cookie consent"
      >
        <div className="flex items-start gap-3 mb-3.5">
          <Cookie className="size-4.5 shrink-0 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-0.5">We use cookies</p>
            <p className="text-xs text-muted-foreground leading-snug">
              We use essential cookies for site functionality and optional analytics cookies to
              understand how you use our site. You can accept all cookies or customise your
              preferences.{" "}
              <Link
                href="/privacy"
                className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={accept} className="h-8 px-4 text-xs font-semibold">
            Accept all
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={decline}
            className="h-8 px-4 text-xs"
          >
            Reject all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setModalOpen(true)}
            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            Manage preferences
          </Button>
        </div>
      </div>

      <PreferencesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAcceptAll={accept}
        onRejectAll={decline}
      />
    </>
  );
}
