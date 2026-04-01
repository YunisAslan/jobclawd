"use client";

import {
  MapPin,
  Laptop,
  Banknote,
  GraduationCap,
  Briefcase,
  Wrench,
  Globe,
  Clock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { JobListing, JobDetail } from "@/types";

interface VacancySummaryProps {
  job: JobListing;
  detail: JobDetail | null;
  loadingDetail: boolean;
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground/60 shrink-0">{icon}</span>
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-foreground font-medium truncate">{value}</span>
    </div>
  );
}

export default function VacancySummary({ job, detail, loadingDetail }: VacancySummaryProps) {
  return (
    <div className="space-y-4">
      {/* Structured metadata */}
      <div className="space-y-2 p-3.5 rounded-xl border border-border/50 bg-card">
        {job.location_str && (
          <MetaRow icon={<MapPin className="size-3.5" />} label="Location" value={job.location_str} />
        )}
        {job.work_mode_str && (
          <MetaRow icon={<Laptop className="size-3.5" />} label="Work mode" value={job.work_mode_str} />
        )}
        {job.salary_str && (
          <MetaRow icon={<Banknote className="size-3.5" />} label="Salary" value={job.salary_str} />
        )}
        {job.seniority_str && (
          <MetaRow icon={<GraduationCap className="size-3.5" />} label="Seniority" value={job.seniority_str} />
        )}
        {job.experience_years_str && (
          <MetaRow icon={<Clock className="size-3.5" />} label="Experience" value={job.experience_years_str} />
        )}
        {job.job_type_str && (
          <MetaRow icon={<Briefcase className="size-3.5" />} label="Job type" value={job.job_type_str} />
        )}
        {job.date_posted && (
          <MetaRow icon={<Clock className="size-3.5" />} label="Posted" value={formatDate(job.date_posted)} />
        )}
      </div>

      {/* Skills */}
      {job.skills_str && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Wrench className="size-3.5" />
            Skills mentioned
          </div>
          <div className="flex flex-wrap gap-1.5">
            {job.skills_str.split(", ").map((skill) => (
              <Badge
                key={skill}
                variant="outline"
                className="text-[11px] font-medium bg-muted/30"
              >
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Languages */}
      {job.languages_str && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Globe className="size-3.5" />
            Languages
          </div>
          <div className="flex flex-wrap gap-1.5">
            {job.languages_str.split(", ").map((lang) => (
              <Badge
                key={lang}
                variant="outline"
                className="text-[11px] font-medium bg-muted/30"
              >
                {lang}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced detail: requirements */}
      {loadingDetail ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ) : detail?.requirements && detail.requirements.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Requirements</p>
          <ul className="space-y-1">
            {detail.requirements.map((req, i) => (
              <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                <span className="text-primary shrink-0 mt-0.5">-</span>
                {req}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Nice to haves */}
      {detail?.nice_to_haves && detail.nice_to_haves.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Nice to have</p>
          <ul className="space-y-1">
            {detail.nice_to_haves.map((item, i) => (
              <li key={i} className="text-xs text-foreground/60 flex gap-1.5">
                <span className="text-muted-foreground/40 shrink-0 mt-0.5">-</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Job summary */}
      {detail?.job_summary && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Summary</p>
          <p className="text-xs text-foreground/70 leading-relaxed">{detail.job_summary}</p>
        </div>
      )}
    </div>
  );
}
