import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { ReadinessField } from "../types";

export default function ReadinessBar({ fields }: { fields: ReadinessField[] }) {
  const filled = fields.filter((f) => f.filled).length;
  const total = fields.length;
  const pct = Math.round((filled / total) * 100);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Profile readiness
        </p>
        <span
          className={cn(
            "text-xs font-bold tabular-nums",
            pct === 100 ? "text-success" : pct >= 60 ? "text-foreground" : "text-warning",
          )}
        >
          {filled}/{total}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pct === 100 ? "bg-success" : pct >= 60 ? "bg-primary" : "bg-warning",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <span
            key={f.label}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border transition-colors",
              f.filled
                ? "bg-success/8 text-success border-success/20"
                : "bg-muted/50 text-muted-foreground/60 border-border/30",
            )}
          >
            {f.filled ? <Check className="size-2.5" /> : <X className="size-2.5" />}
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}
