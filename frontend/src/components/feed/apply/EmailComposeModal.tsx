"use client";

import { UseMutationResult } from "@tanstack/react-query";
import { JobListing, JobDetail, UserProfile, ApplyResponse } from "@/types";
import { API_BASE_URL } from "@/lib/endpoints";
import { generateCoverLetter } from "@/lib/cover-letter";
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
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Mail, FileText, RotateCcw, Send, ExternalLink,
  AlertCircle, CheckCircle2, X,
} from "lucide-react";
import { ApplyFormValues } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  fromEmail: string;
  smtpUsername?: string;
  effectiveEmail: string | null;
  emailSubject: string;
  setEmailSubject: (v: string) => void;
  coverLetter: string;
  setCoverLetter: (v: string) => void;
  form: ApplyFormValues;
  extraFiles: File[];
  setExtraFiles: (fn: (prev: File[]) => File[]) => void;
  message: string | null;
  success: boolean;
  applyMutation: UseMutationResult<ApplyResponse, Error, void>;
  profile: UserProfile;
  job: JobListing;
  detail: JobDetail | null | undefined;
}

export default function EmailComposeModal({
  open,
  onClose,
  fromEmail,
  smtpUsername,
  effectiveEmail,
  emailSubject,
  setEmailSubject,
  coverLetter,
  setCoverLetter,
  form,
  extraFiles,
  setExtraFiles,
  message,
  success,
  applyMutation,
  profile,
  job,
  detail,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[540px] flex flex-col overflow-hidden p-0 gap-0 max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4 text-success" />
            Compose application email
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input value={fromEmail} disabled className="text-sm bg-muted/40" />
              {!smtpUsername && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <AlertCircle className="size-3 inline-block mr-1 text-warning -translate-y-px" />
                  Using JobClawd&apos;s email for now — want to send from yours?{" "}
                  <Link
                    href="/dashboard/settings"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={onClose}
                  >
                    Connect your Gmail
                  </Link>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input value={effectiveEmail ?? ""} disabled className="text-sm bg-muted/40" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="text-sm"
                placeholder="Job application: ..."
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Message</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] gap-1 text-primary hover:text-primary px-2"
                  onClick={() => setCoverLetter(generateCoverLetter(profile, job, detail ?? null))}
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

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Attachments</Label>

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

            {message && (
              <div
                className={cn(
                  "flex items-center gap-2 text-sm p-3 rounded-xl border",
                  success
                    ? "bg-success/8 text-success border-success/20"
                    : "bg-destructive/8 text-destructive border-destructive/20",
                )}
              >
                {success ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
                {message}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 border-t border-border/50 flex-col items-stretch gap-2 shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={applyMutation.isPending}>
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
  );
}
