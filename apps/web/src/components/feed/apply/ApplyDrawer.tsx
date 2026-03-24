"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Separator } from "@/components/ui/Separator";
import { cn } from "@/lib/utils";
import { Send, ExternalLink, CheckCircle2, Zap, AlertCircle } from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";
import { generateCoverLetter } from "@/lib/cover-letter";
import ReadinessBar from "./ReadinessBar";
import ApplicantDetails from "./ApplicantDetails";
import EmailComposeModal from "./EmailComposeModal";
import EasyApplyTierCard from "./EasyApplyTierCard";
import ATSInfoCard from "./ATSInfoCard";
import ApplySupportBadge from "./ApplySupportBadge";
import MissingInfoPanel from "./MissingInfoPanel";
import { useApplyDrawer } from "@/hooks/use-apply-drawer";
import { ApplyDrawerProps } from "../types";
import { METHOD_CONFIG } from "./utils";
import Link from "next/link";

export default function ApplyDrawer({ job, onClose, onApplied }: ApplyDrawerProps) {
  const {
    profile,
    form,
    coverLetter,
    setCoverLetter,
    emailSubject,
    setEmailSubject,
    message,
    success,
    showDetails,
    setShowDetails,
    showEmailModal,
    setShowEmailModal,
    extraFiles,
    setExtraFiles,
    smtpSettings,
    fromEmail,
    detail,
    loadingDetail,
    effectiveEmail,
    method,
    readiness,
    applyReadiness,
    isEdited,
    applyMutation,
    updateField,
    fillFromProfile,
  } = useApplyDrawer(job, onApplied);

  if (!job) return null;

  const methodCfg = METHOD_CONFIG[method];
  const MethodIcon = methodCfg.icon;
  const isHigh = job.match_level === "high";

  return (
    <>
      <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-125 p-0 flex flex-col gap-0 overflow-hidden"
        >
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

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-5">
              {loadingDetail ? (
                <div className="p-3.5 rounded-xl border border-border/50 bg-card">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                      <div className="h-2.5 w-40 rounded bg-muted animate-pulse" />
                    </div>
                    <span className="text-[11px] text-muted-foreground/60 italic shrink-0">
                      Detecting apply method…
                    </span>
                  </div>
                </div>
              ) : applyReadiness ? (
                <ApplySupportBadge
                  supportLevel={applyReadiness.support_level}
                  supportLabel={applyReadiness.support_label}
                  score={applyReadiness.score}
                />
              ) : (
                <div className="p-3.5 rounded-xl border border-border/50 bg-card">
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
                      <MethodIcon className={cn("size-4", methodCfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold", methodCfg.color)}>
                        {methodCfg.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{methodCfg.desc}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 4: Easy Apply tier classification */}
              {detail?.easy_apply && detail.easy_apply.tier !== "unknown" && (
                <EasyApplyTierCard analysis={detail.easy_apply} />
              )}

              {/* Phase 5: ATS platform detection */}
              {detail?.ats_info && detail.ats_info.platform && (
                <ATSInfoCard ats={detail.ats_info} />
              )}

              <ReadinessBar fields={readiness} />

              {applyReadiness && (
                <MissingInfoPanel
                  missingRequired={applyReadiness.missing_required}
                  missingOptional={applyReadiness.missing_optional}
                />
              )}

              <Separator />

              <ApplicantDetails
                form={form}
                profile={profile}
                showDetails={showDetails}
                setShowDetails={setShowDetails}
                isEdited={isEdited}
                fillFromProfile={fillFromProfile}
                updateField={updateField}
              />

              <Separator />

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Cover letter
                  </p>
                  {coverLetter !== generateCoverLetter(profile, job, detail ?? null) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] gap-1 text-primary hover:text-primary px-2"
                      onClick={() =>
                        setCoverLetter(generateCoverLetter(profile, job, detail ?? null))
                      }
                    >
                      Regenerate
                    </Button>
                  )}
                </div>
                <Textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="min-h-35 text-sm leading-relaxed resize-none"
                  placeholder="Write your cover letter here..."
                />
              </div>

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

          <SheetFooter className="px-5 py-4 border-t border-border/50 gap-2">
            {method === "email" ? (
              <Button
                onClick={() => setShowEmailModal(true)}
                disabled={success}
                className="w-full gap-2"
              >
                {success ? (
                  <>
                    <CheckCircle2 className="size-3.5" /> Sent
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" /> Compose &amp; send
                  </>
                )}
              </Button>
            ) : method === "easy_apply" ? (
              <div className="flex gap-2 w-full">
                <TrackButton
                  isPending={applyMutation.isPending}
                  success={success}
                  onClick={() => applyMutation.mutate()}
                />
                <Button asChild className="flex-1 gap-2">
                  <Link href={job.url} target="_blank" rel="noopener noreferrer">
                    <Zap className="size-3.5" />
                    {job.source === "linkedin" ? "Apply on LinkedIn" : "Quick Apply"}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 w-full">
                <TrackButton
                  isPending={applyMutation.isPending}
                  success={success}
                  onClick={() => applyMutation.mutate()}
                />
                <Button asChild className="flex-1 gap-2">
                  <Link href={job.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" /> Apply on site
                  </Link>
                </Button>
              </div>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <EmailComposeModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        fromEmail={fromEmail as string}
        smtpUsername={smtpSettings?.username}
        effectiveEmail={effectiveEmail}
        emailSubject={emailSubject}
        setEmailSubject={setEmailSubject}
        coverLetter={coverLetter}
        setCoverLetter={setCoverLetter}
        form={form}
        extraFiles={extraFiles}
        setExtraFiles={setExtraFiles}
        message={message}
        success={success}
        applyMutation={applyMutation}
        profile={profile}
        job={job}
        detail={detail}
      />
    </>
  );
}

function TrackButton({
  isPending,
  success,
  onClick,
}: {
  isPending: boolean;
  success: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={isPending || success}
      variant="outline"
      className="flex-1 gap-2"
    >
      {isPending ? (
        <>
          <div className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />{" "}
          Saving...
        </>
      ) : success ? (
        <>
          <CheckCircle2 className="size-3.5" /> Tracked
        </>
      ) : (
        <>
          <Send className="size-3.5" /> Save &amp; track
        </>
      )}
    </Button>
  );
}
