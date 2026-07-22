"use client";

import { Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";

interface PaymentInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Informational modal shown when a user taps any "buy credits" action.
 * Paid credit purchases are disabled: payment processors currently restrict
 * job-aggregation platforms, so this portfolio project ships with free credits.
 */
export function PaymentInfoModal({ open, onOpenChange }: PaymentInfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0">
        <div className="h-1 w-full bg-linear-to-r from-primary/60 via-primary to-primary/60" />

        <div className="p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 border border-primary/20 mb-3">
              <Info className="size-6 text-primary" />
            </div>
            <DialogTitle className="text-base font-semibold">
              Payments are currently unavailable
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground leading-relaxed">
            JobClawd is a job-aggregation platform, and payment providers currently
            restrict this category — so credit purchases aren&apos;t available right now.
          </p>

          <Button className="w-full h-10 mt-5" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
