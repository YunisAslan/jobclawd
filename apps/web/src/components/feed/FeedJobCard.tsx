"use client";

import { useState, type ReactNode } from "react";

import { JobListing } from "@/types";
import SourceBadge from "@/components/ui/SourceBadge";
import SaveToggleButton from "@/components/ui/SaveToggleButton";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { cn, formatDate } from "@/lib/utils";
import {
  Banknote,
  Bot,
  Briefcase,
  ExternalLink,
  Eye,
  GraduationCap,
  Laptop,
  MapPin,
  MoreHorizontal,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

interface FeedJobCardProps {
  job: JobListing;
  saved: boolean;
  onToggleSave: () => void;
  savePending?: boolean;
  onDetails: () => void;
  onHideCompany?: (company: string) => void;
  detailsTourTarget?: string;
}

function CompanyAvatar({ company, logoUrl }: { company: string; logoUrl?: string | null }) {
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

function MatchScore({ score, level }: { score: number; level: "high" | "review" | "trash" }) {
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

function MetaChip({
  icon,
  children,
  className,
  source,
}: {
  icon: ReactNode;
  children: ReactNode;
  className: string;
  source?: string | null;
}) {
  const isAI = source === "openai" || source === "gemini" || source === "ai";
  return (
    <span className={className}>
      {icon}
      {children}
      {isAI && (
        <span
          className="inline-flex items-center gap-0.5 rounded-sm bg-primary/10 px-1 py-px text-[9px] font-semibold text-primary"
          title="Extracted by AI"
        >
          <Bot className="size-2" />
          AI
        </span>
      )}
    </span>
  );
}

export default function FeedJobCard({
  job,
  saved,
  onToggleSave,
  savePending,
  onDetails,
  onHideCompany,
  detailsTourTarget,
}: FeedJobCardProps) {
  const isHigh = job.match_level === "high";
  const experienceChip = !job.seniority_str && !job.experience_years_str ? job.experience_str : null;

  const salaryBadge = job.badges?.includes("Salary Listed");

  return (
    <Card
      className={cn(
        "gap-0 py-0 transition-all duration-200 overflow-hidden hover:shadow-md hover:-translate-y-0.5 flex flex-col",
        isHigh && "border-match-high/30",
      )}
    >
      <CardContent className="px-4 pt-4 pb-4 flex flex-col flex-1 gap-0">
        {/* Top row: avatar + info + score */}
        <div className="flex items-start gap-3">
          <CompanyAvatar company={job.company} logoUrl={job.logo_url} />
          <div className="flex-1 min-w-0">
            {/* Title — always 2 lines */}
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground mb-1.5 pr-2">
              {job.title}
            </h3>
            {/* Company · date · source */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium truncate max-w-35">{job.company}</span>
              {job.date_posted && (
                <>
                  <span className="text-muted-foreground/30 text-xs select-none">•</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDate(job.date_posted)}
                  </span>
                </>
              )}
              <span className="text-muted-foreground/30 text-xs select-none">•</span>
              <SourceBadge source={job.source} />
            </div>
            {/* Location — always one line, fixed height */}
            <div className="h-5 flex items-center mt-1">
              {job.location_str ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3 text-muted-foreground/60 shrink-0" />
                  <span className="text-xs text-muted-foreground/70 truncate max-w-55">
                    {job.location_str}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/30">—</span>
              )}
            </div>
            {/* Meta chips — wrap on mobile, single row + horizontal scroll on larger screens */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 mt-1.5 sm:h-6 sm:overflow-y-hidden sm:overflow-x-scroll scrollbar-none">
              {job.seniority_str && (
                <MetaChip
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 border border-border/60 rounded-md px-1.5 py-0.5 shrink-0"
                  icon={<GraduationCap className="size-2.5" />}
                  source={job.seniority_src}
                >
                  {job.seniority_str}
                </MetaChip>
              )}
              {job.experience_years_str && (
                <MetaChip
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 border border-border/60 rounded-md px-1.5 py-0.5 shrink-0"
                  icon={<GraduationCap className="size-2.5" />}
                  source={job.experience_years_src}
                >
                  {job.experience_years_str}
                </MetaChip>
              )}
              {experienceChip && (
                <MetaChip
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 border border-border/60 rounded-md px-1.5 py-0.5 shrink-0"
                  icon={<GraduationCap className="size-2.5" />}
                  source={job.experience_src}
                >
                  {experienceChip}
                </MetaChip>
              )}
              {job.job_type_str && (
                <MetaChip
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 border border-border/60 rounded-md px-1.5 py-0.5 shrink-0"
                  icon={<Briefcase className="size-2.5" />}
                  source={job.job_type_src}
                >
                  {job.job_type_str}
                </MetaChip>
              )}
              {job.work_mode_str && (
                <MetaChip
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 border border-border/60 rounded-md px-1.5 py-0.5 shrink-0"
                  icon={<Laptop className="size-2.5" />}
                  source={job.work_mode_src}
                >
                  {job.work_mode_str}
                </MetaChip>
              )}
              {job.salary_str && !/^\$?0(\.0+)?(\/\w+)?$/.test(job.salary_str.trim()) && (
                <MetaChip
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-500/8 border border-emerald-500/20 rounded-md px-1.5 py-0.5 shrink-0"
                  icon={<Banknote className="size-2.5" />}
                  source={job.salary_src}
                >
                  {job.salary_str}
                </MetaChip>
              )}
              {salaryBadge && !job.salary_str && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-500/8 border border-emerald-500/20 rounded-md px-1.5 py-0.5 shrink-0">
                  <ShieldCheck className="size-2.5" />
                  Salary Listed
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <MatchScore score={job.match_score} level={job.match_level} />
          </div>
        </div>

        {/* Action buttons — always at the bottom */}
        <div className="flex items-center gap-2 mt-3.5">
          <Button onClick={onDetails} size="sm" className="flex-1 h-8 text-xs font-medium gap-1.5" {...(detailsTourTarget ? { "data-tour": detailsTourTarget } : {})}>
            <Eye className="size-3.5" />
            View Details
          </Button>
          <Button asChild size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5">
            <Link href={job.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Open
            </Link>
          </Button>
          <SaveToggleButton
            saved={saved}
            onToggle={onToggleSave}
            pending={savePending}
            size="sm"
          />
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
              <DropdownMenuItem onSelect={() => onHideCompany?.(job.company)} className="text-xs">
                Hide company
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
