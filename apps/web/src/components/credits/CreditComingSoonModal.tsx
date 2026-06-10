"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { creditsService } from "@/services/credits.service";
import { cn } from "@/lib/utils";

type ModalView = "notify" | "success" | "duplicate";

interface CreditComingSoonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

export function CreditComingSoonModal({
  open,
  onOpenChange,
  defaultEmail = "",
}: CreditComingSoonModalProps) {
  const [view, setView] = useState<ModalView>("notify");
  const [email, setEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setView("notify");
      setEmail(defaultEmail);
      setError("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleNotify() {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await creditsService.joinWaitlist(trimmed);
      setView(result.already_registered ? "duplicate" : "success");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "success" || view === "duplicate") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0">
          <div className="h-1 w-full bg-linear-to-r from-primary/60 via-primary to-primary/60" />
          <div className="p-6 flex flex-col items-center text-center gap-3">
            <div className={cn(
              "flex items-center justify-center size-12 rounded-full border",
              view === "success"
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-primary/10 border-primary/20",
            )}>
              {view === "success"
                ? <CheckCircle2 className="size-6 text-emerald-500" />
                : <Bell className="size-6 text-primary" />
              }
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {view === "success" ? "You're on the list!" : "Already registered"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {view === "success"
                  ? "We'll email you the moment credits are available to purchase."
                  : "We already have your email. We'll notify you as soon as it's ready."}
              </p>
            </div>
            <Button variant="outline" size="sm" className="mt-1" onClick={() => onOpenChange(false)}>
              {view === "success" ? "Done" : "Got it"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0">
        <div className="h-1 w-full bg-linear-to-r from-primary/60 via-primary to-primary/60" />

        <div className="p-6">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-base font-semibold">Get notified</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Secure payment processing is being finalised. We&apos;ll let you know the moment it goes live.
            </p>
          </DialogHeader>

          <div className="rounded-lg bg-muted/50 border border-border p-3 mb-4 flex items-start gap-2.5">
            <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              You&apos;re interested in purchasing credits — great. Enter your email below
              and you&apos;ll be first to know when payment launches.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Lock className="size-3 text-muted-foreground" />
              Your email
            </label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleNotify()}
              className="h-10"
              autoFocus={!defaultEmail}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1 h-10" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1 h-10" onClick={handleNotify} disabled={submitting}>
              {submitting ? (
                <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="flex items-center gap-1.5">
                  <Bell className="size-3.5 shrink-0" />
                  Notify me
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
