"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  JobListing,
  JobDetail,
  CVLink,
  UserProfile,
  ApplyMethod,
} from "@/types";
import { jobsService } from "@/services/jobs.service";
import { applyService } from "@/services/apply.service";
import { settingsService } from "@/services/settings.service";
import { profileService } from "@/services/profile.service";
import { useProfile } from "@/contexts/ProfileContext";
import { API_BASE_URL } from "@/lib/endpoints";
import { generateCoverLetter, generateEmailSubject } from "@/lib/cover-letter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/Sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Skeleton } from "@/components/ui/Skeleton";
import { Separator } from "@/components/ui/Separator";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Mail,
  UserRound,
  Phone,
  Linkedin,
  Globe,
  FileText,
  RotateCcw,
  Send,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Zap,
  MousePointerClick,
  ArrowRight,
  Check,
  X,
  PenLine,
} from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApplyDrawerProps {
  job: JobListing | null;
  onClose: () => void;
  onApplied: () => void;
}

interface ApplyFormValues {
  fullName: string;
  email: string;
  phone: string;
  linkedin_url: string;
  portfolio_url: string;
  selectedCV: CVLink | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formFromProfile(profile: UserProfile): ApplyFormValues {
  return {
    fullName: `${profile.name} ${profile.surname}`.trim(),
    email: profile.email,
    phone: profile.phone ?? "",
    linkedin_url: profile.linkedin_url ?? "",
    portfolio_url: profile.portfolio_url ?? "",
    selectedCV: profile.cv_links.length > 0 ? profile.cv_links[0] : null,
  };
}

/** Resolve apply method from available data — detail takes priority, then job.hr_email, then source. */
function resolveApplyMethod(
  job: JobListing,
  detail: JobDetail | null,
): ApplyMethod {
  if (detail?.apply_method && detail.apply_method !== "direct") return detail.apply_method;
  if (detail?.email || job.hr_email) return "email";
  if (job.source === "linkedin") return "easy_apply";
  if (job.source === "indeed") return "external";
  return "direct";
}

const METHOD_CONFIG: Record<
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

// ─── Profile Readiness ───────────────────────────────────────────────────────

interface ReadinessField {
  label: string;
  filled: boolean;
}

function getReadiness(form: ApplyFormValues): ReadinessField[] {
  return [
    { label: "Name", filled: form.fullName.trim().length > 0 },
    { label: "Email", filled: form.email.trim().length > 0 },
    { label: "Phone", filled: form.phone.trim().length > 0 },
    { label: "CV", filled: form.selectedCV !== null },
    { label: "LinkedIn", filled: form.linkedin_url.trim().length > 0 },
    { label: "Portfolio", filled: form.portfolio_url.trim().length > 0 },
  ];
}

function ReadinessBar({ fields }: { fields: ReadinessField[] }) {
  const filled = fields.filter((f) => f.filled).length;
  const total = fields.length;
  const pct = Math.round((filled / total) * 100);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Profile readiness
        </p>
        <span
          className={cn(
            "text-xs font-bold tabular-nums",
            pct === 100
              ? "text-success"
              : pct >= 60
                ? "text-foreground"
                : "text-warning",
          )}
        >
          {filled}/{total}
        </span>
      </div>
      {/* Progress track */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pct === 100
              ? "bg-success"
              : pct >= 60
                ? "bg-primary"
                : "bg-warning",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Chips */}
      <div className="flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <span
            key={f.label}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border transition-colors",
              f.filled
                ? "bg-success/8 text-success border-success/20"
                : "bg-muted/50 text-muted-foreground/60 border-border/30",
            )}
          >
            {f.filled ? (
              <Check className="size-2.5" />
            ) : (
              <X className="size-2.5" />
            )}
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ApplyDrawer({
  job,
  onClose,
  onApplied,
}: ApplyDrawerProps) {
  const { profile } = useProfile();
  const [form, setForm] = useState<ApplyFormValues>(() =>
    formFromProfile(profile),
  );
  const [coverLetter, setCoverLetter] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);

  // Fetch SMTP settings to show correct From address
  const { data: smtpSettings } = useQuery({
    queryKey: ["smtp-settings"],
    queryFn: () => settingsService.getSMTP(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const fromEmail = smtpSettings?.username || form.email;

  // Fetch job detail
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["job-detail", job?.url],
    queryFn: () => jobsService.getDetail(job!.url),
    enabled: !!job?.url,
    staleTime: 5 * 60 * 1000,
  });

  // Effective email: use detail email first, fall back to job.hr_email from search
  const effectiveEmail = detail?.email ?? job?.hr_email ?? null;

  // Resolve apply method
  const method = useMemo(
    () => (job ? resolveApplyMethod(job, detail ?? null) : "direct"),
    [job, detail],
  );
  const methodCfg = METHOD_CONFIG[method];
  const MethodIcon = methodCfg.icon;

  // Reset form + close email modal when switching jobs
  useEffect(() => {
    if (job) {
      const newForm = formFromProfile(profile);
      setForm(newForm);
      setMessage(null);
      setSuccess(false);
      setShowDetails(false);
      setShowEmailModal(false);
      setExtraFiles([]);
    }
  }, [job?.url, profile]);

  // Generate cover letter once detail is loaded
  useEffect(() => {
    if (job && detail) {
      setCoverLetter(generateCoverLetter(profile, job, detail));
      setEmailSubject(generateEmailSubject(profile, job));
    }
  }, [job?.url, detail?.description, profile]);

  // Readiness
  const readiness = useMemo(() => getReadiness(form), [form]);

  // Edited check
  const profileDefaults = useMemo(() => formFromProfile(profile), [profile]);
  const isEdited = useMemo(
    () =>
      form.fullName !== profileDefaults.fullName ||
      form.email !== profileDefaults.email ||
      form.phone !== profileDefaults.phone ||
      form.linkedin_url !== profileDefaults.linkedin_url ||
      form.portfolio_url !== profileDefaults.portfolio_url ||
      form.selectedCV?.url !== profileDefaults.selectedCV?.url,
    [form, profileDefaults],
  );

  // Apply mutation — uploads any extra files first, then sends
  const applyMutation = useMutation({
    mutationFn: async () => {
      const [firstName = "", ...rest] = form.fullName.trim().split(" ");
      const lastName = rest.join(" ");

      // Upload extra attachments and collect their URLs
      const extraUrls: string[] = [];
      for (const file of extraFiles) {
        const result = await profileService.uploadCV(file);
        extraUrls.push(result.url);
      }

      return applyService.apply({
        job_url: job!.url,
        job_title: job!.title,
        company: job!.company,
        source: job!.source,
        hr_email: effectiveEmail,
        cv_name: form.selectedCV?.name ?? null,
        cv_url: form.selectedCV?.url ?? null,
        match_score: job!.match_score,
        match_level: job!.match_level,
        cover_letter: method === "email" ? coverLetter : null,
        email_subject: method === "email" ? emailSubject : null,
        extra_cv_urls: extraUrls.length > 0 ? extraUrls : null,
        profile: {
          ...profile,
          name: firstName,
          surname: lastName,
          email: form.email,
          phone: form.phone,
          linkedin_url: form.linkedin_url,
          portfolio_url: form.portfolio_url,
        },
      });
    },
    onSuccess: (res) => {
      setMessage(res.message);
      setSuccess(true);
      if (method === "email") {
        toast.success("Application sent!", {
          description: `Your email was delivered to ${effectiveEmail}.`,
        });
        setShowEmailModal(false);
      } else {
        window.open(job!.url, "_blank");
      }
      onApplied();
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ??
        (err instanceof Error ? err.message : "An error occurred.");
      setMessage(msg);
      setSuccess(false);
    },
  });

  const updateField = <K extends keyof ApplyFormValues>(
    key: K,
    value: ApplyFormValues[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const fillFromProfile = () => setForm(formFromProfile(profile));

  if (!job) return null;

  const isHigh = job.match_level === "high";

  return (
    <>
    <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[500px] p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* ── Header ── */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/50 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-sm leading-snug line-clamp-2 pr-6">
                {job.title}
              </SheetTitle>
              <SheetDescription className="text-xs mt-1 flex items-center gap-2">
                {job.company}
                <SourceBadge source={job.source} />
              </SheetDescription>
            </div>
            {job.match_score > 0 && (
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 shrink-0",
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
          </div>
        </SheetHeader>

        {/* ── Content ── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            {/* Apply method indicator */}
            {loadingDetail ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : (
              <div className="p-3.5 rounded-xl border border-border/50 bg-card space-y-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "size-8 rounded-lg flex items-center justify-center shrink-0",
                      method === "email" && "bg-success/10",
                      method === "easy_apply" && "bg-[#0A66C2]/10",
                      method === "external" && "bg-warning/10",
                      method === "direct" && "bg-muted",
                    )}
                  >
                    <MethodIcon
                      className={cn("size-4", methodCfg.color)}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold", methodCfg.color)}>
                      {methodCfg.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {methodCfg.desc}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Profile readiness */}
            <ReadinessBar fields={readiness} />

            <Separator />

            {/* ── Application Details ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  <ArrowRight
                    className={cn(
                      "size-3 transition-transform duration-200",
                      showDetails && "rotate-90",
                    )}
                  />
                  Your details
                </button>
                <div className="flex items-center gap-1.5">
                  {isEdited && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] gap-1 text-primary hover:text-primary px-2"
                      onClick={fillFromProfile}
                    >
                      <RotateCcw className="size-2.5" />
                      Reset
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] gap-1 text-muted-foreground px-2"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    <PenLine className="size-2.5" />
                    {showDetails ? "Collapse" : "Edit"}
                  </Button>
                </div>
              </div>

              {/* Collapsed summary */}
              {!showDetails && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs px-1">
                  {form.fullName && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <UserRound className="size-3 shrink-0 opacity-50" />
                      <span className="truncate text-foreground">
                        {form.fullName}
                      </span>
                    </div>
                  )}
                  {form.email && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="size-3 shrink-0 opacity-50" />
                      <span className="truncate text-foreground">
                        {form.email}
                      </span>
                    </div>
                  )}
                  {form.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="size-3 shrink-0 opacity-50" />
                      <span className="truncate text-foreground">
                        {form.phone}
                      </span>
                    </div>
                  )}
                  {form.selectedCV && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="size-3 shrink-0 opacity-50" />
                      <span className="truncate text-foreground">
                        {form.selectedCV.name}
                      </span>
                    </div>
                  )}
                  {form.linkedin_url && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Linkedin className="size-3 shrink-0 opacity-50" />
                      <span className="truncate text-foreground">
                        {form.linkedin_url}
                      </span>
                    </div>
                  )}
                  {form.portfolio_url && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Globe className="size-3 shrink-0 opacity-50" />
                      <span className="truncate text-foreground">
                        {form.portfolio_url}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Expanded form */}
              {showDetails && (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <UserRound className="size-3" />
                        Full name
                      </Label>
                      <Input
                        value={form.fullName}
                        onChange={(e) =>
                          updateField("fullName", e.target.value)
                        }
                        placeholder="Alex Johnson"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Mail className="size-3" />
                        Email
                      </Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        placeholder="you@email.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Phone className="size-3" />
                        Phone
                      </Label>
                      <Input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        placeholder="+994 50 123 4567"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Linkedin className="size-3" />
                        LinkedIn
                      </Label>
                      <Input
                        value={form.linkedin_url}
                        onChange={(e) =>
                          updateField("linkedin_url", e.target.value)
                        }
                        placeholder="linkedin.com/in/you"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Globe className="size-3" />
                        Portfolio
                      </Label>
                      <Input
                        value={form.portfolio_url}
                        onChange={(e) =>
                          updateField("portfolio_url", e.target.value)
                        }
                        placeholder="yoursite.com"
                      />
                    </div>
                    <div className="space-y-1.5" />
                  </div>

                  {/* CV selector */}
                  {profile.cv_links.length > 0 ? (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FileText className="size-3" />
                        Resume / CV
                      </Label>
                      <RadioGroup
                        value={form.selectedCV?.url ?? ""}
                        onValueChange={(url) => {
                          const cv =
                            profile.cv_links.find((c) => c.url === url) ??
                            null;
                          updateField("selectedCV", cv);
                        }}
                        className="space-y-1"
                      >
                        {profile.cv_links.map((cv) => (
                          <div
                            key={cv.url}
                            className={cn(
                              "flex items-center gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer",
                              form.selectedCV?.url === cv.url
                                ? "border-primary/30 bg-primary/5"
                                : "border-border/50 hover:border-border",
                            )}
                          >
                            <RadioGroupItem
                              value={cv.url}
                              id={`apply-cv-${cv.url}`}
                            />
                            <Label
                              htmlFor={`apply-cv-${cv.url}`}
                              className="font-normal cursor-pointer text-sm flex-1 truncate"
                            >
                              {cv.name}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-muted/50 border border-border/40 text-xs text-muted-foreground text-center">
                      No CV uploaded yet — add one in your{" "}
                      <span className="font-medium text-foreground">
                        Profile
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* ── Cover Letter ── */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Cover letter
                </p>
                {coverLetter !==
                  generateCoverLetter(
                    profile,
                    job,
                    detail ?? null,
                  ) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] gap-1 text-primary hover:text-primary px-2"
                    onClick={() =>
                      setCoverLetter(
                        generateCoverLetter(profile, job, detail ?? null),
                      )
                    }
                  >
                    <RotateCcw className="size-2.5" />
                    Regenerate
                  </Button>
                )}
              </div>
              <Textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                className="min-h-[140px] text-sm leading-relaxed resize-none"
                placeholder="Write your cover letter here..."
              />
            </div>

            {/* Feedback message */}
            {message && (
              <div
                className={cn(
                  "flex items-center gap-2 text-sm p-3 rounded-xl border",
                  success
                    ? "bg-success/8 text-success border-success/20"
                    : "bg-destructive/8 text-destructive border-destructive/20",
                )}
              >
                {success ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : (
                  <AlertCircle className="size-4 shrink-0" />
                )}
                {message}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Footer: adapts to apply method ── */}
        <SheetFooter className="px-5 py-4 border-t border-border/50 gap-2">
          {method === "email" ? (
            /* Email route: open compose modal */
            <Button
              onClick={() => setShowEmailModal(true)}
              disabled={success}
              className="w-full gap-2"
            >
              {success ? (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Sent
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Compose &amp; send
                </>
              )}
            </Button>
          ) : method === "easy_apply" ? (
            /* Easy apply: save + redirect to platform */
            <div className="flex gap-2 w-full">
              <Button
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending || success}
                variant="outline"
                className="flex-1 gap-2"
              >
                {applyMutation.isPending ? (
                  <>
                    <div className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Tracked
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    Save & track
                  </>
                )}
              </Button>
              <Button asChild className="flex-1 gap-2">
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <Zap className="size-3.5" />
                  {job.source === "linkedin" ? "Apply on LinkedIn" : "Quick Apply"}
                </a>
              </Button>
            </div>
          ) : (
            /* External / direct: save + open page */
            <div className="flex gap-2 w-full">
              <Button
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending || success}
                variant="outline"
                className="flex-1 gap-2"
              >
                {applyMutation.isPending ? (
                  <>
                    <div className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Tracked
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    Save & track
                  </>
                )}
              </Button>
              <Button asChild className="flex-1 gap-2">
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  Apply on site
                </a>
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>

    {/* ── Email Compose Modal ── */}
    <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
      <DialogContent className="sm:max-w-[540px] flex flex-col overflow-hidden p-0 gap-0 max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4 text-success" />
            Compose application email
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
        <div className="space-y-4 py-4">
          {/* From */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              value={fromEmail}
              disabled
              className="text-sm bg-muted/40"
            />
            {!smtpSettings?.username && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <AlertCircle className="size-3 inline-block mr-1 text-warning -translate-y-px" />
                Using JobClawd&apos;s email for now — want to send from yours?{" "}
                <Link
                  href="/dashboard/settings"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => setShowEmailModal(false)}
                >
                  Connect your Gmail
                </Link>
              </p>
            )}
          </div>

          {/* To */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              value={effectiveEmail ?? ""}
              disabled
              className="text-sm bg-muted/40"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="text-sm"
              placeholder="Job application: ..."
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Message</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] gap-1 text-primary hover:text-primary px-2"
                onClick={() =>
                  setCoverLetter(generateCoverLetter(profile, job!, detail ?? null))
                }
              >
                <RotateCcw className="size-2.5" />
                Regenerate
              </Button>
            </div>
            <Textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="min-h-[200px] text-sm leading-relaxed resize-none"
              placeholder="Write your cover letter here..."
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Attachments</Label>

            {/* CV row */}
            {form.selectedCV ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50 text-xs">
                <FileText className="size-3.5 shrink-0 text-primary" />
                <span className="truncate font-medium text-foreground flex-1">{form.selectedCV.name}</span>
                <span className="text-muted-foreground/50 shrink-0">CV</span>
                <a
                  href={`${API_BASE_URL}${form.selectedCV.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="size-3" />
                  Open
                </a>
              </div>
            ) : (
              <div className="px-3 py-2 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground text-center">
                No CV attached — add one in your Profile
              </div>
            )}

            {/* Extra files */}
            {extraFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50 text-xs">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-foreground flex-1">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-5 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setExtraFiles((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}

            {/* Add extra file picker */}
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border/50 hover:border-border text-xs text-muted-foreground cursor-pointer transition-colors hover:bg-muted/30">
              <FileText className="size-3.5 shrink-0" />
              <span>{extraFiles.length === 0 ? "Attach cover letter or extra file" : "Add another file"}</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setExtraFiles((prev) => [...prev, file]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {/* Feedback */}
          {message && (
            <div
              className={cn(
                "flex items-center gap-2 text-sm p-3 rounded-xl border",
                success
                  ? "bg-success/8 text-success border-success/20"
                  : "bg-destructive/8 text-destructive border-destructive/20",
              )}
            >
              {success ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              {message}
            </div>
          )}
        </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 border-t border-border/50 flex-col items-stretch gap-2 shrink-0">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEmailModal(false)}
              disabled={applyMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending || success || !effectiveEmail}
              className="flex-1 gap-2"
            >
              {applyMutation.isPending ? (
                <>
                  <div className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Sent
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Send email
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
