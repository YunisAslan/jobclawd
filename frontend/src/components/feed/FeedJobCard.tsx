"use client";

import { JobListing } from "@/types";
import MatchBadge from "@/components/ui/MatchBadge";
import SourceBadge from "@/components/ui/SourceBadge";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface FeedJobCardProps {
  job: JobListing;
  selected: boolean;
  onToggleSelect: () => void;
  onApply: () => void;
  onSkip: () => void;
  onDetails: () => void;
}

function CompanyAvatar({ company, logoUrl }: { company: string; logoUrl?: string | null }) {
  const initials = company
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={company}
        className="size-10 rounded-lg object-cover shrink-0 border"
        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
      />
    );
  }

  return (
    <div className="size-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-secondary text-secondary-foreground border">
      {initials || "?"}
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

export default function FeedJobCard({
  job,
  selected,
  onToggleSelect,
  onApply,
  onSkip,
  onDetails,
}: FeedJobCardProps) {
  return (
    <Card className={cn("gap-0 py-4 transition-all", selected && "ring-2 ring-primary")}>
      <CardContent className="px-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            className="mt-0.5 shrink-0"
          />
          <CompanyAvatar company={job.company} logoUrl={job.logo_url} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                {job.title}
              </h3>
              <MatchBadge score={job.match_score} level={job.match_level} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">{job.company}</span>
              <SourceBadge source={job.source} />
              {job.date_posted && (
                <span className="text-xs text-muted-foreground">{formatDate(job.date_posted)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Warning flags */}
        {job.match_flags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {job.match_flags.map((flag, i) => (
              <Badge
                key={i}
                className="bg-warning/10 text-warning border border-warning/30 hover:bg-warning/10 gap-1"
              >
                ⚠ {flag}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={onApply} size="sm" className="flex-1 h-8 text-xs">
            Apply
          </Button>
          <Button onClick={onSkip} size="sm" variant="outline" className="h-8 text-xs px-3">
            Skip
          </Button>
          <Button onClick={onDetails} size="sm" variant="outline" className="h-8 text-xs px-3">
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
