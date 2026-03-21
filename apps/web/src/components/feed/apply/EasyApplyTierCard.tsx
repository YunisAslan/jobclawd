"use client";

import { EasyApplyAnalysis } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, HelpCircle, FileText, MessageSquare, Upload } from "lucide-react";

const TIER_CONFIG = {
  A: {
    color: "text-success",
    bg: "bg-success/8 border-success/20",
    icon: CheckCircle2,
    badge: "bg-success/10 text-success border-success/25",
  },
  B: {
    color: "text-warning",
    bg: "bg-warning/8 border-warning/20",
    icon: AlertTriangle,
    badge: "bg-warning/10 text-warning border-warning/25",
  },
  C: {
    color: "text-destructive",
    bg: "bg-destructive/8 border-destructive/20",
    icon: AlertTriangle,
    badge: "bg-destructive/10 text-destructive border-destructive/25",
  },
  unknown: {
    color: "text-muted-foreground",
    bg: "bg-muted/50 border-border",
    icon: HelpCircle,
    badge: "bg-muted text-muted-foreground border-border",
  },
} as const;

interface Props {
  analysis: EasyApplyAnalysis;
}

export default function EasyApplyTierCard({ analysis }: Props) {
  const tier = analysis.tier as keyof typeof TIER_CONFIG;
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.unknown;
  const TierIcon = cfg.icon;

  return (
    <div className={cn("rounded-lg border p-3 space-y-2.5", cfg.bg)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TierIcon className={cn("size-4", cfg.color)} />
          <span className={cn("text-xs font-semibold", cfg.color)}>
            Tier {tier === "unknown" ? "?" : tier}
          </span>
        </div>
        {analysis.safe_to_auto_submit && (
          <Badge className="bg-success/10 text-success border-success/25 text-[10px] py-0 h-5">
            Safe to auto-submit
          </Badge>
        )}
      </div>

      <p className="text-xs text-foreground/80">{analysis.tier_label}</p>

      <div className="flex flex-wrap gap-1.5">
        {analysis.step_count > 0 && (
          <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 font-normal border-border">
            {analysis.step_count} {analysis.step_count === 1 ? "step" : "steps"}
          </Badge>
        )}
        {analysis.has_resume_upload && (
          <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 font-normal border-border">
            <Upload className="size-2.5" /> Resume
          </Badge>
        )}
        {analysis.has_cover_letter && (
          <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 font-normal border-border">
            <FileText className="size-2.5" /> Cover letter
          </Badge>
        )}
        {analysis.has_custom_questions && (
          <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 font-normal border-border text-warning">
            <MessageSquare className="size-2.5" /> Custom questions
          </Badge>
        )}
      </div>

      {analysis.unknown_fields.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            May need your input
          </p>
          <div className="flex flex-wrap gap-1">
            {analysis.unknown_fields.map((f, i) => (
              <span key={i} className="text-[10px] bg-background/60 border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                {f.length > 60 ? f.slice(0, 57) + "..." : f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
