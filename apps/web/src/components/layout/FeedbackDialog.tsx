"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { feedbackService } from "@/services/feedback.service";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  initialMessage?: string;
}

export function FeedbackDialog({
  open,
  onOpenChange,
  title = "Send feedback",
  description = "Help us improve JobClawd",
  initialMessage = "",
}: FeedbackDialogProps) {
  const [message, setMessage] = useState(initialMessage);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      feedbackService.submit({ message: message.trim(), email: email.trim() || undefined }),
    onSuccess: () => {
      setDone(true);
      setTimeout(() => {
        onOpenChange(false);
        setDone(false);
        setMessage("");
        setEmail("");
      }, 2500);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    mutation.mutate();
  }

  function handleOpenChange(val: boolean) {
    if (!val) {
      setDone(false);
      setMessage(initialMessage);
      setEmail("");
      mutation.reset();
    }
    onOpenChange(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-border bg-muted/30">
          <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </DialogHeader>

        {done ? (
          <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center mb-1">
              <Send className="size-4 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Thanks for your feedback!</p>
            <p className="text-xs text-muted-foreground">We&apos;ll review it shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your feedback, bug, or idea..."
                required
                rows={4}
                className="text-xs resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Your email{" "}
                <span className="text-muted-foreground font-normal">(optional — for replies)</span>
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-8 text-xs"
              />
            </div>

            {mutation.isError && (
              <p className="text-xs text-destructive">Failed to send. Please try again.</p>
            )}

            <Button
              type="submit"
              disabled={!message.trim() || mutation.isPending}
              className="w-full h-8 text-xs font-semibold"
            >
              {mutation.isPending ? "Sending…" : "Send feedback"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
