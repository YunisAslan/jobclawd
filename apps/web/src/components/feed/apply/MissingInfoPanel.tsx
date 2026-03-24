"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, Info } from "lucide-react";
import type { MissingFieldInfo } from "../types";

interface MissingInfoPanelProps {
  missingRequired: MissingFieldInfo[];
  missingOptional: MissingFieldInfo[];
}

export default function MissingInfoPanel({
  missingRequired,
  missingOptional,
}: MissingInfoPanelProps) {
  if (missingRequired.length === 0 && missingOptional.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2.5">
      {missingRequired.length > 0 && (
        <div className="p-3 rounded-xl border border-destructive/20 bg-destructive/5 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-3.5 text-destructive shrink-0" />
            <p className="text-xs font-semibold text-destructive">
              Required — complete before applying
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missingRequired.map((f) => (
              <span
                key={f.field}
                className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/15"
              >
                {f.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {missingOptional.length > 0 && (
        <div className="p-3 rounded-xl border border-border/50 bg-muted/30 space-y-2">
          <div className="flex items-center gap-2">
            <Info className="size-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs font-semibold text-muted-foreground">
              Recommended — improves your application
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missingOptional.map((f) => (
              <span
                key={f.field}
                className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground border border-border/30"
              >
                {f.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
