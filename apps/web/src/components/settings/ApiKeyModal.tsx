"use client";

import { useEffect, useState } from "react";
import { KeyRound, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { apiKeysService } from "@/services/api-keys.service";

interface ApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ApiKeyModal({ open, onOpenChange, onSaved }: ApiKeyModalProps) {
  const [key, setKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setKey("");
      setError("");
    }
  }, [open]);

  async function handleSave() {
    const trimmed = key.trim();
    if (!trimmed.startsWith("sk-")) {
      setError("That doesn't look like an OpenAI key (it should start with “sk-”).");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await apiKeysService.saveKey(trimmed);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Could not save the key. Please try again.";
      setError(typeof msg === "string" ? msg : "Could not save the key. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <div className="h-1 w-full bg-linear-to-r from-primary/60 via-primary to-primary/60" />

        <div className="p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 border border-primary/20 mb-3">
              <KeyRound className="size-6 text-primary" />
            </div>
            <DialogTitle className="text-base font-semibold">
              Add your OpenAI API key
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground leading-relaxed">
            JobClawd runs its AI features — CV match scoring, suggestions, analysis, and
            search enrichment — on your own OpenAI key. Add one to unlock them.
          </p>

          <div className="mt-4 space-y-2">
            <Input
              type="password"
              placeholder="sk-..."
              value={key}
              autoComplete="off"
              onChange={(e) => { setKey(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="h-10 font-mono text-sm"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="size-3" />
              Get an API key from OpenAI
            </a>
          </div>

          <div className="rounded-lg bg-muted/50 border border-border p-3 mt-4 flex items-start gap-2.5">
            <ShieldCheck className="size-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Your key is validated with OpenAI, stored encrypted, and used only for your
              own requests. You can remove it any time in Settings.
            </p>
          </div>

          <div className="flex gap-2 mt-5">
            <Button variant="outline" className="flex-1 h-10" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1 h-10" onClick={handleSave} disabled={submitting}>
              {submitting ? (
                <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                "Save key"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
