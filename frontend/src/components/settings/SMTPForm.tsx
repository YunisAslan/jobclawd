"use client";

import { useState } from "react";
import { useSMTPForm } from "@/hooks/use-smtp-form";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  EyeIcon,
  EyeOffIcon,
  CheckCircle2,
  Mail,
  ExternalLink,
  Lock,
  Pencil,
  Unplug,
  Wifi,
  AlertTriangle,
} from "lucide-react";

export default function SMTPForm() {
  const {
    form,
    loading,
    savedUsername,
    passwordSaved,
    editingPassword,
    setEditingPassword,
    showPassword,
    setShowPassword,
    saving,
    saved,
    disconnecting,
    error,
    update,
    handleSave,
    handleDisconnect,
  } = useSMTPForm();

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-24" />
      </div>
    );
  }

  const isConfigured = passwordSaved && !!savedUsername;

  return (
    <div className="space-y-5">

      {/* ── Status card ── */}
      {isConfigured ? (
        <div className="rounded-xl border border-success/25 bg-success/5 overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <div className="size-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <Wifi className="size-4 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-success leading-none mb-0.5">Connected</p>
              <p className="text-xs text-muted-foreground truncate">{savedUsername}</p>
            </div>
            {!confirmDisconnect && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/8 shrink-0"
                onClick={() => setConfirmDisconnect(true)}
              >
                <Unplug className="size-3.5" />
                Disconnect
              </Button>
            )}
          </div>
          {/* Inline disconnect confirm */}
          {confirmDisconnect && (
            <div className="px-4 pb-4 pt-0 border-t border-success/15 bg-destructive/5 space-y-3">
              <div className="flex items-start gap-2 pt-3">
                <AlertTriangle className="size-4 text-destructive shrink-0 mt-px" />
                <p className="text-xs text-foreground leading-relaxed">
                  Your SMTP credentials will be removed. Emails will continue to be delivered via the JobClawd official account.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setConfirmDisconnect(false)}
                  disabled={disconnecting}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  disabled={disconnecting}
                  onClick={async () => {
                    await handleDisconnect();
                    setConfirmDisconnect(false);
                  }}
                >
                  <Unplug className="size-3.5" />
                  {disconnecting ? "Disconnecting..." : "Yes, disconnect"}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-muted/30">
          <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Mail className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-none mb-0.5">Not connected</p>
            <p className="text-xs text-muted-foreground">Emails sent via the JobClawd official account</p>
          </div>
        </div>
      )}

      {/* ── How-to instructions ── */}
      <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
        <p className="font-semibold text-foreground">How to get a Gmail App Password</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Enable 2-Step Verification on your Google account</li>
          <li>
            Go to{" "}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary inline-flex items-center gap-0.5"
            >
              myaccount.google.com/apppasswords
              <ExternalLink className="size-2.5" />
            </a>
          </li>
          <li>Create a new app password → copy and paste it below</li>
        </ol>
      </div>

      {/* ── Fields ── */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="smtp-user" className="flex items-center gap-1.5 text-sm">
            <Mail className="size-3.5 text-muted-foreground" />
            Gmail address
          </Label>
          <Input
            id="smtp-user"
            type="email"
            placeholder="you@gmail.com"
            value={form.username ?? ""}
            onChange={(e) => update("username", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="smtp-pass" className="flex items-center gap-1.5 text-sm">
            <Lock className="size-3.5 text-muted-foreground" />
            App password
          </Label>

          {passwordSaved && !editingPassword ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 h-9 rounded-lg border border-border/50 bg-muted/40 text-sm">
                <span className="text-muted-foreground tracking-widest text-xs select-none">
                  ●●●● ●●●● ●●●● ●●●●
                </span>
                <span className="ml-auto text-[10px] text-success font-medium">Saved</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => setEditingPassword(true)}
              >
                <Pencil className="size-3" />
                Change
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                id="smtp-pass"
                type={showPassword ? "text" : "password"}
                placeholder="xxxx xxxx xxxx xxxx"
                value={form.password ?? ""}
                onChange={(e) => update("password", e.target.value)}
                className="pr-10"
                autoFocus={editingPassword}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-muted-foreground"
                onClick={() => setShowPassword((v: boolean) => !v)}
              >
                {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </Button>
            </div>
          )}

          {(!passwordSaved || editingPassword) && (
            <p className="text-[11px] text-muted-foreground">
              The 16-character password from Google — not your regular Gmail password.
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? "Saving..." : isConfigured ? "Update" : "Connect Gmail"}
        </Button>
        {editingPassword && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingPassword(false);
              update("password", "");
            }}
          >
            Cancel
          </Button>
        )}
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" />
            {isConfigured ? "Settings updated" : "Gmail connected"}
          </span>
        )}
      </div>

    </div>
  );
}
