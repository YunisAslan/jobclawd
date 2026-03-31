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
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Separator } from "@/components/ui/Separator";
import { cn } from "@/lib/utils";
import { Send, ExternalLink, CheckCircle2, AlertCircle, ArrowUpRight, LogIn } from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";
import ReadinessBar from "./ReadinessBar";
import ApplicantDetails from "./ApplicantDetails";
import ApplySupportBadge from "./ApplySupportBadge";
import MissingInfoPanel from "./MissingInfoPanel";
import { useApplyDrawer } from "@/hooks/use-apply-drawer";
import { ApplyDrawerProps } from "../types";
import Link from "next/link";

export default function ApplyDrawer({ job, onClose, onApplied }: ApplyDrawerProps) {
  const {
    profile,
    form,
    message,
    success,
    showDetails,
    setShowDetails,
    detail,
    loadingDetail,
    resolvedApplyUrl,
    readiness,
    applyReadiness,
    isEdited,
    applyMutation,
    updateField,
    fillFromProfile,
  } = useApplyDrawer(job, onApplied);

  if (!job) return null;
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
                      Preparing application page…
                    </span>
                  </div>
                </div>
              ) : applyReadiness ? (
                <ApplySupportBadge
                  readinessLevel={applyReadiness.readiness_level}
                  readinessLabel={applyReadiness.readiness_label}
                  score={applyReadiness.score}
                />
              ) : null}

              {/* Resolved apply URL indicator */}
              {!loadingDetail && detail && resolvedApplyUrl && resolvedApplyUrl !== job.url && (
                <div className={cn(
                  "flex items-start gap-2.5 p-3 rounded-lg border",
                  detail.apply_requires_login
                    ? "border-warning/15 bg-warning/5"
                    : "border-primary/15 bg-primary/5",
                )}>
                  {detail.apply_requires_login ? (
                    <LogIn className="size-4 text-warning mt-0.5 shrink-0" />
                  ) : (
                    <ArrowUpRight className="size-4 text-primary mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-xs font-medium text-foreground">
                      {detail.apply_requires_login
                        ? "Application requires login"
                        : "Direct application link found"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{resolvedApplyUrl}</p>
                    {detail.apply_requires_login ? (
                      <p className="text-[10px] text-warning font-medium mt-1">
                        You may need to sign in to complete your application
                      </p>
                    ) : null}
                  </div>
                </div>
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
            <div className="flex gap-2 w-full">
              <TrackButton
                isPending={applyMutation.isPending}
                success={success}
                onClick={() => applyMutation.mutate()}
              />
              <Button asChild className="flex-1 gap-2">
                <Link href={resolvedApplyUrl || job.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" /> Open &amp; apply
                </Link>
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
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
