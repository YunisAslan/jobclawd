import React from "react";
import { JobSource } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Linkedin, Search, Building2, Globe, Code2, Briefcase, Sparkles } from "lucide-react";

function IndeedIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
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
  glassdoor: {
    label: "GLASSDOOR",
    className: "bg-[#0CAA41] text-white",
    icon: Building2,
  },
  ziprecruiter: {
    label: "ZIPRECRUITER",
    className: "bg-[#1F7A29] text-white",
    icon: Briefcase,
  },
  remoteok: {
    label: "REMOTEOK",
    className: "bg-[#FF4742] text-white",
    icon: Globe,
  },
  simplify: {
    label: "SIMPLIFY",
    className: "bg-[#7C3AED] text-white",
    icon: Sparkles,
  },
  dice: {
    label: "DICE",
    className: "bg-[#E1261C] text-white",
    icon: Code2,
  },
  jobgether: {
    label: "JOBICY",
    className: "bg-[#0E7C66] text-white",
    icon: Globe,
  },
  weworkremotely: {
    label: "WWR",
    className: "bg-[#EE2A24] text-white",
    icon: Globe,
  },
  remotive: {
    label: "REMOTIVE",
    className: "bg-[#6D28D9] text-white",
    icon: Globe,
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
