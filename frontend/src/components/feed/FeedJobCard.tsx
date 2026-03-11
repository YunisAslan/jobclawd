"use client";

import { useState } from "react";

import { JobListing } from "@/types";
import SourceBadge from "@/components/ui/SourceBadge";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { cn, formatDate } from "@/lib/utils";
import {
  CircleCheck,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  X,
} from "lucide-react";

interface FeedJobCardProps {
  job: JobListing;
  selected: boolean;
  onToggleSelect: () => void;
  onApply: () => void;
  onSkip: () => void;
  onDetails: () => void;
  onHideCompany?: (company: string) => void;
}

function CompanyAvatar({
  company,
  logoUrl,
}: {
  company: string;
  logoUrl?: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const initials = company
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const fallback = (
    <div className="size-11 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 bg-linear-to-br from-secondary/80 to-secondary text-white shadow-sm">
      {initials || "?"}
    </div>
  );

  if (!logoUrl || imgFailed) return fallback;

  return (
    <img
      src={logoUrl}
      alt={company}
      className="size-11 rounded-xl object-cover shrink-0 border border-border/50 shadow-sm"
      onError={() => setImgFailed(true)}
    />
  );
}

function MatchScore({
  score,
  level,
}: {
  score: number;
  level: "high" | "review" | "trash";
}) {
  if (level === "trash" || score === 0) return null;

  const isHigh = level === "high";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-14.5 shrink-0",
        isHigh
          ? "bg-match-high/10 border border-match-high/20"
          : "bg-match-review/10 border border-match-review/20",
      )}
    >
      <span
        className={cn(
          "text-lg font-bold leading-none tabular-nums",
          isHigh ? "text-match-high" : "text-match-review",
        )}
      >
        {score}
      </span>
      <span
        className={cn(
          "text-[10px] font-semibold mt-0.5 uppercase tracking-wide",
          isHigh ? "text-match-high/70" : "text-match-review/70",
        )}
      >
        {isHigh ? "High" : "Review"}
      </span>
    </div>
  );
}

export default function FeedJobCard({
  job,
  selected,
  onToggleSelect,
  onApply,
  onSkip,
  onDetails,
  onHideCompany,
}: FeedJobCardProps) {
  const isHigh = job.match_level === "high";

  return (
    <Card
      className={cn(
        "gap-0 py-0 transition-all duration-200 overflow-hidden",
        selected
          ? "ring-2 ring-primary shadow-md"
          : "hover:shadow-md hover:-translate-y-0.5",
        isHigh && "border-match-high/30",
      )}
    >
      <CardContent className="px-4 pt-4 pb-4 space-y-3.5 relative">
        <div className="absolute top-2 right-2">
          <SourceBadge source={job.source} />
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            className="mt-1 shrink-0"
          />
          <CompanyAvatar company={job.company} logoUrl={job.logo_url} />
          <div className="flex-1 min-w-0 pr-8">
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground mb-1.5 pr-8">
              {job.title}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">
                {job.company}
              </span>
              {job.date_posted && (
                <>
                  <span className="text-muted-foreground/30 text-xs select-none">
                    •
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(job.date_posted)}
                  </span>
                </>
              )}
            </div>
            {job.location_str && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="size-3 text-muted-foreground/60 shrink-0" />
                <span className="text-xs text-muted-foreground/70 truncate">
                  {job.location_str}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0 pt-6">
            <MatchScore score={job.match_score} level={job.match_level} />
          </div>
        </div>

        {job.match_flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.match_flags.map((flag, i) => (
              <Badge
                key={i}
                className="bg-warning/8 text-warning border border-warning/25 hover:bg-warning/8 gap-1 text-[11px] py-0.5 font-medium"
              >
                ⚠ {flag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          <Button
            onClick={onApply}
            size="sm"
            className="flex-1 h-8 text-xs font-medium gap-1.5"
          >
            <CircleCheck className="size-3.5" />
            Apply
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1.5"
          >
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Details
            </a>
          </Button>
          <Button
            onClick={onSkip}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            title="Skip"
          >
            <X className="size-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0"
                aria-label="More actions"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6}>
              <DropdownMenuItem
                onSelect={() => onHideCompany?.(job.company)}
                className="text-xs"
              >
                Hide company
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
