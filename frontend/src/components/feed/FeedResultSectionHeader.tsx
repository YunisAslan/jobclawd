import { cn } from "@/lib/utils";
import { Badge } from "../ui/Badge";

interface FeedResultSectionHeaderProps {
  color: "primary" | "warning";
  label: string;
  count: number;
}

function FeedResultSectionHeader({
  color,
  label,
  count,
}: FeedResultSectionHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "size-2 rounded-full shrink-0",
          color === "primary" ? "bg-match-high" : "bg-match-review",
        )}
      />
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      <Badge
        className={cn(
          "text-xs h-5 px-1.5 hover:bg-inherit",
          color === "primary"
            ? "bg-match-high/10 text-match-high border-match-high/20"
            : "bg-match-review/10 text-match-review border-match-review/20",
        )}
      >
        {count}
      </Badge>
    </div>
  );
}

export default FeedResultSectionHeader;
