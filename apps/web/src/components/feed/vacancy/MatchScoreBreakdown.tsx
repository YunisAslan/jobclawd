"use client";

import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Briefcase,
  MapPin,
  Laptop,
  GraduationCap,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { JobListing } from "@/types";

interface MatchScoreBreakdownProps {
  job: JobListing;
}

interface DerivedCategory {
  name: string;
  label: string;
  status: "match" | "partial" | "mismatch" | "unknown";
  detail: string;
  icon: React.ReactNode;
}

const statusConfig = {
  match: {
    icon: CheckCircle2,
    color: "text-match-high",
    bg: "bg-match-high/8",
    border: "border-match-high/20",
    label: "Match",
  },
  partial: {
    icon: AlertCircle,
    color: "text-match-review",
    bg: "bg-match-review/8",
    border: "border-match-review/20",
    label: "Partial",
  },
  mismatch: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/8",
    border: "border-destructive/20",
    label: "Mismatch",
  },
  unknown: {
    icon: HelpCircle,
    color: "text-muted-foreground",
    bg: "bg-muted/30",
    border: "border-border/50",
    label: "Unknown",
  },
};

function deriveCategories(job: JobListing): DerivedCategory[] {
  const categories: DerivedCategory[] = [];
  const flags = new Set(job.match_flags.map((f) => f.toLowerCase()));

  // Work mode
  if (job.work_mode_str) {
    const mismatch = flags.has("work mode mismatch");
    categories.push({
      name: "work_mode",
      label: "Work mode",
      status: mismatch ? "mismatch" : "match",
      detail: job.work_mode_str,
      icon: <Laptop className="size-3.5" />,
    });
  }

  // Experience
  if (job.seniority_str || job.experience_years_str) {
    const mismatch = flags.has("experience level mismatch");
    categories.push({
      name: "experience",
      label: "Experience",
      status: mismatch ? "mismatch" : "match",
      detail: [job.seniority_str, job.experience_years_str].filter(Boolean).join(" / "),
      icon: <GraduationCap className="size-3.5" />,
    });
  }

  // Location
  if (job.location_str) {
    categories.push({
      name: "location",
      label: "Location",
      status: "match",
      detail: job.location_str,
      icon: <MapPin className="size-3.5" />,
    });
  }

  // Job type
  if (job.job_type_str) {
    categories.push({
      name: "job_type",
      label: "Job type",
      status: "match",
      detail: job.job_type_str,
      icon: <Briefcase className="size-3.5" />,
    });
  }

  // Skills
  if (job.skills_str) {
    const count = job.skills_str.split(", ").length;
    categories.push({
      name: "skills",
      label: "Skills",
      status: "partial",
      detail: `${count} skill${count > 1 ? "s" : ""} listed`,
      icon: <Wrench className="size-3.5" />,
    });
  }

  return categories;
}

export default function MatchScoreBreakdown({ job }: MatchScoreBreakdownProps) {
  const isHigh = job.match_level === "high";
  const categories = deriveCategories(job);

  return (
    <div className="space-y-4">
      {/* Score display */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card">
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-xl px-4 py-3 shrink-0",
            isHigh
              ? "bg-match-high/10 border border-match-high/20"
              : "bg-match-review/10 border border-match-review/20",
          )}
        >
          <span
            className={cn(
              "text-2xl font-bold leading-none tabular-nums",
              isHigh ? "text-match-high" : "text-match-review",
            )}
          >
            {job.match_score}
          </span>
          <span
            className={cn(
              "text-[10px] font-semibold mt-0.5 uppercase tracking-wide",
              isHigh ? "text-match-high/70" : "text-match-review/70",
            )}
          >
            {isHigh ? "High Match" : "Needs Review"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Match Score</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Based on your profile preferences vs. job requirements
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Breakdown</p>
          <div className="space-y-1.5">
            {categories.map((cat) => {
              const cfg = statusConfig[cat.status];
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={cat.name}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg border",
                    cfg.bg,
                    cfg.border,
                  )}
                >
                  <span className="text-muted-foreground/60 shrink-0">{cat.icon}</span>
                  <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">
                    {cat.label}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-32">
                    {cat.detail}
                  </span>
                  <StatusIcon className={cn("size-3.5 shrink-0", cfg.color)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Match flags */}
      {job.match_flags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Signals</p>
          <div className="flex flex-wrap gap-1.5">
            {job.match_flags.map((flag, i) => (
              <Badge
                key={i}
                className="bg-warning/8 text-warning border border-warning/25 hover:bg-warning/8 gap-1 text-[11px] py-0.5 font-medium"
              >
                {flag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
