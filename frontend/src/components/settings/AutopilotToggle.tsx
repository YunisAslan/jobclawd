"use client";

import { useAutopilot } from "@/hooks/use-autopilot";
import { Switch } from "@/components/ui/Switch";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";

interface AutopilotToggleProps {
  enabled: boolean;
  onChanged: (enabled: boolean) => void;
}

export default function AutopilotToggle({ enabled, onChanged }: AutopilotToggleProps) {
  const { showModal, agreed, setAgreed, saving, handleToggle, handleConfirm, handleCancel } =
    useAutopilot(enabled, onChanged);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="autopilot-switch" className="text-sm font-medium cursor-pointer">
            Autopilot mode
          </Label>
          <p className="text-xs text-muted-foreground max-w-sm">
            When a high-match job has an HR email, an email is sent automatically.
            Requires SMTP configuration.
          </p>
        </div>
        <Switch
          id="autopilot-switch"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
      </div>

      <Dialog open={showModal} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enable autopilot?</DialogTitle>
            <DialogDescription>
              When autopilot is active, the system will automatically send emails
              on your behalf to matching jobs. This requires your SMTP settings
              to be correctly configured.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3 py-1">
            <Checkbox
              id="agree-checkbox"
              checked={agreed}
              onCheckedChange={(v) => setAgreed(!!v)}
            />
            <Label
              htmlFor="agree-checkbox"
              className="text-sm font-normal cursor-pointer leading-relaxed"
            >
              I understand and accept responsibility for automated email sending.
            </Label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            <Button disabled={!agreed} onClick={handleConfirm}>Enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
