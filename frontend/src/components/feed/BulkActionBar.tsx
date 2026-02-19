"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface BulkActionBarProps {
  count: number;
  onApplyAll: () => void;
  onClear: () => void;
  applying: boolean;
}

export default function BulkActionBar({
  count,
  onApplyAll,
  onClear,
  applying,
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl bg-foreground text-background min-w-72">
      <Badge variant="secondary" className="shrink-0">
        {count}
      </Badge>
      <span className="text-sm font-medium flex-1">jobs selected</span>
      <Button
        size="sm"
        variant="ghost"
        className="text-background/70 hover:text-background hover:bg-white/10 h-7 px-2"
        onClick={onClear}
      >
        Clear
      </Button>
      <Button
        size="sm"
        disabled={applying}
        className="h-7 text-xs"
        onClick={onApplyAll}
      >
        {applying ? "Sending..." : "Apply to all"}
      </Button>
    </div>
  );
}
