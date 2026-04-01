"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDate } from "@/lib/utils";
import {
  MapPin,
  ExternalLink,
  Eye,
  Trash2,
  Clock,
  Loader2,
} from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";
import type { SavedVacancy } from "@/types";
import Link from "next/link";

interface SavedJobCardProps {
  vacancy: SavedVacancy;
  onOpen: () => void;
  onRemove: () => void;
  removing?: boolean;
}

function CompanyAvatar({ company }: { company: string }) {
  const initials = company
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="size-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 bg-linear-to-br from-secondary/80 to-secondary text-white shadow-sm">
      {initials || "?"}
    </div>
  );
}

function daysUntilExpiry(expiresAt: string): number {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function SavedJobCard({ vacancy, onOpen, onRemove, removing }: SavedJobCardProps) {
  const job = vacancy.job_data;
  const isHigh = job.match_level === "high";
  const daysLeft = daysUntilExpiry(vacancy.expires_at);
  const isExpiringSoon = daysLeft <= 2;

  return (
    <Card
      className={cn(
        "gap-0 py-0 transition-all duration-200 overflow-hidden hover:shadow-md hover:-translate-y-0.5",
        isHigh && "border-match-high/30",
      )}
    >
      <CardContent className="px-4 pt-4 pb-4 space-y-3">
        <div className="flex items-start gap-3">
          <CompanyAvatar company={job.company} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground mb-1">
              {job.title}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">{job.company}</span>
              <span className="text-muted-foreground/30 text-xs select-none">•</span>
              <SourceBadge source={job.source} />
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
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {job.match_score > 0 && (
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5",
                  isHigh
                    ? "bg-match-high/10 border border-match-high/20"
                    : "bg-match-review/10 border border-match-review/20",
                )}
              >
                <span
                  className={cn(
                    "text-base font-bold leading-none tabular-nums",
                    isHigh ? "text-match-high" : "text-match-review",
                  )}
                >
                  {job.match_score}
                </span>
              </div>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium gap-1",
                isExpiringSoon
                  ? "text-warning border-warning/25 bg-warning/8"
                  : "text-muted-foreground border-border/50",
              )}
            >
              <Clock className="size-2.5" />
              {daysLeft}d left
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <Button onClick={onOpen} size="sm" className="flex-1 h-8 text-xs font-medium gap-1.5">
            <Eye className="size-3.5" />
            View Details
          </Button>
          <Button asChild size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5">
            <Link href={job.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Open
            </Link>
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            disabled={removing}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            title="Remove from saved"
          >
            {removing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
