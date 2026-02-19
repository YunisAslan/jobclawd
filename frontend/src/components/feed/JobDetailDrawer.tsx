"use client";

import { Mail } from "lucide-react";
import { JobListing } from "@/types";
import { useJobDetail } from "@/hooks/use-job-detail";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";
import { Label } from "@/components/ui/Label";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Separator } from "@/components/ui/Separator";
import { Skeleton } from "@/components/ui/Skeleton";

interface JobDetailDrawerProps {
  job: JobListing | null;
  onClose: () => void;
  onApplied: () => void;
}

export default function JobDetailDrawer({ job, onClose, onApplied }: JobDetailDrawerProps) {
  const {
    profile, detail, loadingDetail, applying,
    selectedCV, setSelectedCV, message, handleApply,
  } = useJobDetail(job, onApplied);

  return (
    <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col gap-0">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="text-sm">{job?.title ?? ""}</SheetTitle>
          <SheetDescription className="text-xs">{job?.company ?? ""}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Email status */}
            {loadingDetail ? (
              <Skeleton className="h-10 w-full rounded-lg" />
            ) : detail?.email ? (
              <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-success/10 text-success border border-success/30">
                <Mail className="size-4 shrink-0" />
                <span>
                  HR email: <strong>{detail.email}</strong>
                </span>
              </div>
            ) : (
              <div className="text-sm p-3 rounded-lg bg-warning/10 text-warning border border-warning/30">
                {detail?.error_message ?? "No email found — apply directly on the site."}
              </div>
            )}

            {/* CV selector */}
            {profile.cv_links.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                  Select CV
                </Label>
                <RadioGroup
                  value={selectedCV?.url ?? ""}
                  onValueChange={(url) => {
                    const cv = profile.cv_links.find((c) => c.url === url) ?? null;
                    setSelectedCV(cv);
                  }}
                  className="space-y-1.5"
                >
                  {profile.cv_links.map((cv) => (
                    <div key={cv.url} className="flex items-center gap-2">
                      <RadioGroupItem value={cv.url} id={`cv-${cv.url}`} />
                      <Label htmlFor={`cv-${cv.url}`} className="font-normal cursor-pointer">
                        {cv.name}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            <Separator />

            {/* Description */}
            {detail?.description && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  About the role
                </p>
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                  {detail.description.slice(0, 800)}
                  {detail.description.length > 800 ? "..." : ""}
                </p>
              </div>
            )}

            {/* Feedback message */}
            {message && (
              <Badge variant="secondary" className="w-full justify-center py-2 text-xs">
                {message}
              </Badge>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="px-5 py-4 border-t">
          <Button onClick={handleApply} disabled={applying} className="w-full">
            {applying ? "Sending..." : "Apply"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
