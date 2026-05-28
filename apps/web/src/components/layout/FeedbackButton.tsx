"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { FeedbackDialog } from "@/components/layout/FeedbackDialog";
import { cn } from "@/lib/utils";

export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/") return null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Feedback"
          className={cn(
            "size-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
            "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95",
          )}
        >
          {open ? <X className="size-4.5" /> : <HelpCircle className="size-4.5" />}
        </button>
      </div>

      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
