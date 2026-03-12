"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/contexts/AuthContext";

export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => authService.deleteAccount(),
    onSuccess: () => {
      logout();
      router.push("/auth/login");
    },
  });

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Delete account</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Permanently remove your account and all associated data. This cannot be undone.
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">
            Delete account
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">Delete account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account, profile, CV data, and all settings. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive px-1">
              {(error as Error).message || "Something went wrong. Please try again."}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => mutate()} disabled={isPending}>
              {isPending ? "Deleting…" : "Yes, delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
