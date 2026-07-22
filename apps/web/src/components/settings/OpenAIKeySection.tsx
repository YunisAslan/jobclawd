"use client";

import { useState } from "react";
import { KeyRound, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useApiKey } from "@/contexts/ApiKeyContext";
import { apiKeysService } from "@/services/api-keys.service";
import { cn } from "@/lib/utils";

export default function OpenAIKeySection() {
  const { hasKey, keyHint, isLoading, openModal, refetch } = useApiKey();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      await apiKeysService.deleteKey();
      refetch();
    } finally {
      setRemoving(false);
    }
  }

  if (isLoading) {
    return <div className="h-10 rounded-lg bg-muted/40 animate-pulse" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex items-center justify-center size-9 rounded-lg shrink-0",
              hasKey ? "bg-emerald-500/10" : "bg-muted",
            )}
          >
            <KeyRound className={cn("size-4.5", hasKey ? "text-emerald-500" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0">
            {hasKey ? (
              <>
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-500" />
                  Key connected
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">sk-{keyHint}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">No key connected</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AI features are disabled until you add a key.
                </p>
              </>
            )}
          </div>
        </div>

        <Button variant={hasKey ? "outline" : "default"} size="sm" onClick={openModal} className="shrink-0">
          {hasKey ? "Change" : "Add key"}
        </Button>
      </div>

      {hasKey && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          disabled={removing}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
        >
          <Trash2 className="size-3.5" />
          {removing ? "Removing…" : "Remove key"}
        </Button>
      )}
    </div>
  );
}
