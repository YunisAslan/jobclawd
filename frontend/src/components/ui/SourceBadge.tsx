import { JobSource } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Linkedin, Search, Briefcase } from "lucide-react";

const SOURCE_CONFIG: Record<
  JobSource,
  { label: string; className: string; icon: any }
> = {
  jobsearch: {
    label: "Jobsearch.az",
    className:
      "bg-[#F3F6F8] text-[#1E2532] border-[#E8ECEF] hover:bg-[#E8ECEF]",
    icon: Search,
  },
  linkedin: {
    label: "LinkedIn",
    className:
      "bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20 hover:bg-[#0A66C2]/15",
    icon: Linkedin,
  },
  indeed: {
    label: "Indeed",
    className:
      "bg-[#2164F4]/10 text-[#2164F4] border-[#2164F4]/20 hover:bg-[#2164F4]/15",
    icon: Briefcase,
  },
};

export default function SourceBadge({ source }: { source: JobSource }) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.jobsearch;
  const Icon = cfg.icon;
  return (
    <Badge
      className={cn(
        "border text-[11px] px-2 py-0.5 font-medium gap-1 cursor-default",
        cfg.className,
      )}
    >
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  );
}
