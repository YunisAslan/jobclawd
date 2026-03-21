"use client";

import { ATSInfo } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Building2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

const FIELD_LABELS: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  resume: "Resume/CV",
  cover_letter: "Cover letter",
  linkedin_url: "LinkedIn",
  github_url: "GitHub",
  portfolio_url: "Portfolio",
  website: "Website",
  location: "Location",
  address: "Address",
  education: "Education",
  experience: "Experience",
  current_company: "Current company",
  current_title: "Current title",
  headline: "Headline",
  salary: "Salary",
  salary_expectation: "Salary expectation",
  work_authorization: "Work authorization",
  authorized_to_work: "Work authorization",
  sponsorship: "Sponsorship",
  visa: "Visa status",
  start_date: "Start date",
  availability: "Availability",
  notice_period: "Notice period",
  relocation: "Relocation",
  willing_to_relocate: "Relocation",
  skills: "Skills",
  summary: "Summary",
  how_did_you_hear: "How did you hear about us",
  additional_info: "Additional information",
  references: "References",
  portfolio: "Portfolio",
};

function friendlyField(field: string): string {
  return FIELD_LABELS[field] || field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  ats: ATSInfo;
}

export default function ATSInfoCard({ ats }: Props) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold">{ats.platform_label}</span>
          {ats.confidence >= 0.8 && (
            <Badge variant="outline" className="text-[10px] py-0 h-4 font-normal border-border">
              Detected
            </Badge>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        This company uses <strong>{ats.platform_label}</strong> for applications.
        {ats.prefillable_fields.length > 0 && " Some fields can be pre-filled from your profile."}
      </p>

      {/* Auto-fillable fields */}
      {ats.prefillable_fields.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
            <CheckCircle2 className="size-2.5 text-success" />
            Auto-fillable from profile
          </p>
          <div className="flex flex-wrap gap-1">
            {ats.prefillable_fields.map((f) => (
              <Badge
                key={f}
                variant="outline"
                className="text-[10px] py-0 h-5 font-normal border-success/25 text-success bg-success/5"
              >
                {friendlyField(f)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Fields requiring manual input */}
      {ats.missing_fields.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
            <AlertCircle className="size-2.5 text-warning" />
            May require manual input
          </p>
          <div className="flex flex-wrap gap-1">
            {ats.missing_fields.map((f) => (
              <Badge
                key={f}
                variant="outline"
                className="text-[10px] py-0 h-5 font-normal border-warning/25 text-warning bg-warning/5"
              >
                {friendlyField(f)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Direct apply link if detected */}
      {ats.apply_url && (
        <Button asChild variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8 mt-1">
          <Link href={ats.apply_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3" />
            Open application form
          </Link>
        </Button>
      )}
    </div>
  );
}
