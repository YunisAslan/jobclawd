"use client";

import { SMTPSettings } from "@/types";
import { useSMTPForm } from "@/hooks/use-smtp-form";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { EyeIcon, EyeOffIcon, CheckIcon } from "lucide-react";

interface SMTPFormProps {
  initial: SMTPSettings | null;
}

export default function SMTPForm({ initial }: SMTPFormProps) {
  const {
    form,
    showPassword,
    setShowPassword,
    saving,
    saved,
    error,
    update,
    handleSave,
  } = useSMTPForm(initial);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="smtp-host">SMTP Server</Label>
          <Input
            id="smtp-host"
            placeholder="smtp.gmail.com"
            value={form.host}
            onChange={(e) => update("host", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-port">Port</Label>
          <Input
            id="smtp-port"
            type="number"
            value={form.port}
            onChange={(e) => update("port", parseInt(e.target.value) || 587)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-user">Username (email)</Label>
          <Input
            id="smtp-user"
            type="email"
            placeholder="you@gmail.com"
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smtp-pass">Password</Label>
          <div className="relative">
            <Input
              id="smtp-pass"
              type={showPassword ? "text" : "password"}
              placeholder="App password..."
              value={form.password ?? ""}
              onChange={(e) => update("password", e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-muted-foreground"
              onClick={() => setShowPassword((v: boolean) => !v)}
            >
              {showPassword ? (
                <EyeOffIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="smtp-from">Sender name</Label>
          <Input
            id="smtp-from"
            placeholder="JobClawd"
            value={form.from_name}
            onChange={(e) => update("from_name", e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckIcon className="size-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
