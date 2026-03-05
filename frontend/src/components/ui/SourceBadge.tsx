import React from "react";
import { JobSource } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Linkedin, Search } from "lucide-react";

function IndeedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="5" r="2.5" />
      <rect x="10" y="9.5" width="4" height="11" rx="2" />
    </svg>
  );
}

const SOURCE_CONFIG: Record<
  JobSource,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  jobsearch: {
    label: "JOBSEARCH",
    className: "bg-black text-white",
    icon: Search,
  },
  linkedin: {
    label: "LINKEDIN",
    className: "bg-[#0A66C2] text-white",
    icon: Linkedin,
  },
  indeed: {
    label: "INDEED",
    className: "bg-[#2557a7] text-white",
    icon: IndeedIcon,
  },
};

export default function SourceBadge({ source }: { source: JobSource }) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.jobsearch;
  const Icon = cfg.icon;
  return (
    <Badge
      className={cn(
        "border text-[9px] px-1.5 py-0 h-4.5 font-bold uppercase tracking-wider gap-1 cursor-default border-transparent",
        cfg.className,
      )}
    >
      <Icon className="size-2 shrink-0" />
      {cfg.label}
    </Badge>
  );
}
