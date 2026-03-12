import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface SectionLabelProps {
  label: string;
  open?: boolean;
  onToggle?: () => void;
}

export default function SectionLabel({ label, open = true, onToggle }: SectionLabelProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      onClick={onToggle}
      className="peer/header flex items-center gap-3 mb-4 w-full text-left group cursor-pointer rounded-md hover:bg-muted transition-colors px-1 py-1 -mx-1"
    >
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0 group-hover:text-foreground transition-colors">
        {label}
      </span>
      <div className="flex-1 h-px bg-border group-hover:bg-border transition-colors" />
      {open ? (
        <ChevronUp className="size-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
      ) : (
        <ChevronDown className="size-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
      )}
    </Button>
  );
}
