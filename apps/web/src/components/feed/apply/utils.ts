import { Mail, Zap, ExternalLink, MousePointerClick } from "lucide-react";
import { UserProfile, JobListing, JobDetail, ApplyMethod } from "@/types";
import { ApplyFormValues, ReadinessField } from "@/components/feed/types";

export function formFromProfile(profile: UserProfile): ApplyFormValues {
  return {
    fullName: `${profile.name} ${profile.surname}`.trim(),
    email: profile.email,
    phone: profile.phone ?? "",
    linkedin_url: profile.linkedin_url ?? "",
    portfolio_url: profile.portfolio_url ?? "",
    selectedCV: profile.cv_links.length > 0 ? profile.cv_links[0] : null,
  };
}

export function resolveApplyMethod(job: JobListing, detail: JobDetail | null): ApplyMethod {
  if (detail?.apply_method && detail.apply_method !== "direct") return detail.apply_method;
  if (detail?.email || job.hr_email) return "email";
  if (job.source === "linkedin") return "easy_apply";
  if (job.source === "indeed") return "external";
  return "direct";
}

export function getReadiness(form: ApplyFormValues): ReadinessField[] {
  return [
    { label: "Name", filled: form.fullName.trim().length > 0 },
    { label: "Email", filled: form.email.trim().length > 0 },
    { label: "Phone", filled: form.phone.trim().length > 0 },
    { label: "CV", filled: form.selectedCV !== null },
    { label: "LinkedIn", filled: form.linkedin_url.trim().length > 0 },
    { label: "Portfolio", filled: form.portfolio_url.trim().length > 0 },
  ];
}

export const METHOD_CONFIG: Record<
  ApplyMethod,
  { label: string; desc: string; color: string; icon: typeof Mail }
> = {
  email: {
    label: "Email Application",
    desc: "Send your application directly to the recruiter",
    color: "text-success",
    icon: Mail,
  },
  easy_apply: {
    label: "Quick Apply",
    desc: "Apply through the platform's built-in system",
    color: "text-[#0A66C2]",
    icon: Zap,
  },
  external: {
    label: "External Application",
    desc: "You'll be redirected to the company's application page",
    color: "text-warning",
    icon: ExternalLink,
  },
  direct: {
    label: "Direct Application",
    desc: "Apply on the job listing page",
    color: "text-muted-foreground",
    icon: MousePointerClick,
  },
};
