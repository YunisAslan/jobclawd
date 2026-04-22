"use client";

import { useState } from "react";
import { Mail, CheckCircle2, Loader2, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/auth.service";
import { cn } from "@/lib/utils";

type Step =
  | "idle"
  | "reauth"          // prompt: "send code to current email"
  | "code_loading"    // sending OTP
  | "code_form"       // enter OTP + new email
  | "loading"         // submitting change request
  | "sent"            // verification link dispatched to new email
  | "error";

export default function ChangeEmailSection() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [otp, setOtp] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setStep("idle");
    setOtp("");
    setNewEmail("");
    setError("");
  }

  function clearError() {
    if (error) setError("");
  }

  async function sendCode() {
    setError("");
    setStep("code_loading");
    try {
      await authService.sendReauthCode();
      setStep("code_form");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Failed to send code. Please try again.";
      setError(detail);
      setStep("reauth");
    }
  }

  async function handleSubmit() {
    setError("");

    const trimmedOtp = otp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Please enter a new email address.");
      return;
    }
    if (trimmedEmail === user?.email?.toLowerCase()) {
      setError("New email must be different from your current email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setStep("loading");
    try {
      await authService.requestEmailChange(trimmedEmail, trimmedOtp);
      setStep("sent");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Something went wrong. Please try again.";
      setError(detail);
      setStep("code_form");
    }
  }

  // ── Sent ─────────────────────────────────────────────────────────────────
  if (step === "sent") {
    return (
      <div className="flex items-start gap-4 rounded-xl border border-success/20 bg-success/5 px-4 py-4">
        <div className="size-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
          <CheckCircle2 className="size-4 text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Verification email sent</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-foreground">{newEmail}</span>.
            Click it to complete the change. It expires in 30 minutes.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Didn't receive it?{" "}
            <button
              type="button"
              onClick={() => { setStep("reauth"); setOtp(""); setError(""); }}
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              Start over
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (step === "idle") {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center shrink-0">
            <Mail className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Current email</p>
            <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setStep("reauth")} className="shrink-0">
          Change email
        </Button>
      </div>
    );
  }

  // ── Re-auth prompt ────────────────────────────────────────────────────────
  if (step === "reauth" || step === "code_loading") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3.5">
          <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Verify it's you first</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              We'll send a 6-digit code to{" "}
              <span className="font-medium text-foreground">{user?.email}</span>{" "}
              to confirm it's really you before making any changes.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <X className="size-3 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={sendCode}
            disabled={step === "code_loading"}
          >
            {step === "code_loading" && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
            {step === "code_loading" ? "Sending…" : "Send code"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={step === "code_loading"}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Code + new email form ─────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <CheckCircle2 className="size-3.5 text-success shrink-0" />
        Code sent to{" "}
        <span className="font-medium text-foreground">{user?.email}</span>
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="otp" className="text-xs font-medium">
          Verification code
        </Label>
        <Input
          id="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          value={otp}
          onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); clearError(); }}
          disabled={step === "loading"}
          className={cn(
            "font-mono tracking-widest text-base",
            error && "border-destructive focus-visible:ring-destructive/30",
          )}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-email" className="text-xs font-medium">
          New email address
        </Label>
        <Input
          id="new-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={newEmail}
          onChange={(e) => { setNewEmail(e.target.value); clearError(); }}
          disabled={step === "loading"}
          className={cn(error && "border-destructive focus-visible:ring-destructive/30")}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        />
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1.5 mt-1">
            <X className="size-3 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        A verification link will be sent to the new address. Your email won't change
        until you click that link.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" size="sm" disabled={step === "loading"} onClick={handleSubmit}>
          {step === "loading" && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
          {step === "loading" ? "Sending…" : "Send verification link"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={step === "loading"}>
          Cancel
        </Button>
        <button
          type="button"
          onClick={() => { sendCode(); setOtp(""); }}
          disabled={step === "loading"}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50 ml-auto"
        >
          Resend code
        </button>
      </div>
    </div>
  );
}
