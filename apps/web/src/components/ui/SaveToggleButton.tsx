"use client";

import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface SaveToggleButtonProps {
  saved: boolean;
  onToggle: () => void;
  pending?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export default function SaveToggleButton({
  saved,
  onToggle,
  pending,
  size = "sm",
  className,
}: SaveToggleButtonProps) {
  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <Button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={pending}
      variant={saved ? "default" : "outline"}
      size="sm"
      className={cn(
        "gap-1.5 shrink-0",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
        saved && "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15",
        className,
      )}
      title={saved ? "Remove from saved" : "Save for later"}
    >
      {pending ? (
        <Loader2 className={cn(iconSize, "animate-spin")} />
      ) : saved ? (
        <BookmarkCheck className={iconSize} />
      ) : (
        <Bookmark className={iconSize} />
      )}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
