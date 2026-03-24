"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, HelpCircle, AlertTriangle, XCircle } from "lucide-react";

const SUPPORT_CONFIG: Record<
  string,
  { icon: typeof CheckCircle2; color: string; bg: string; border: string }
> = {
  auto: {
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/8",
    border: "border-success/20",
  },
  assisted: {
    icon: HelpCircle,
    color: "text-primary",
    bg: "bg-primary/8",
    border: "border-primary/20",
  },
  manual: {
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning/8",
    border: "border-warning/20",
  },
  unsupported: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/8",
    border: "border-destructive/20",
  },
};

interface ApplySupportBadgeProps {
  supportLevel: string;
  supportLabel: string;
  score: number;
}

export default function ApplySupportBadge({
  supportLevel,
  supportLabel,
  score,
}: ApplySupportBadgeProps) {
  const cfg = SUPPORT_CONFIG[supportLevel] || SUPPORT_CONFIG.manual;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 p-3 rounded-xl border",
        cfg.bg,
        cfg.border,
      )}
    >
      <div
        className={cn(
          "size-9 rounded-lg flex items-center justify-center shrink-0",
          cfg.bg,
        )}
      >
        <Icon className={cn("size-5", cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", cfg.color)}>
          {supportLabel}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Readiness: {score}%
        </p>
      </div>
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 shrink-0 min-w-12",
          cfg.bg,
        )}
      >
        <span className={cn("text-lg font-bold leading-none tabular-nums", cfg.color)}>
          {score}
        </span>
        <span className={cn("text-[9px] font-semibold mt-0.5 uppercase tracking-wide", cfg.color + "/70")}>
          Ready
        </span>
      </div>
    </div>
  );
}
