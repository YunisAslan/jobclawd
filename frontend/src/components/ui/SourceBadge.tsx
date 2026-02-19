import { JobSource } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const SOURCE_CONFIG: Record<JobSource, { label: string; className: string }> = {
  jobsearch: {
    label: "Jobsearch",
    className: "bg-secondary/10 text-secondary border-secondary/25 hover:bg-secondary/10",
  },
  linkedin: {
    label: "LinkedIn",
    className: "bg-primary/10 text-primary border-primary/25 hover:bg-primary/10",
  },
  indeed: {
    label: "Indeed",
    className: "bg-muted text-muted-foreground border-border hover:bg-muted",
  },
};

export default function SourceBadge({ source }: { source: JobSource }) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.jobsearch;
  return (
    <Badge className={cn("border text-xs", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
