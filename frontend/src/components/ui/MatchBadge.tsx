import { CircleCheck, TriangleAlert } from "lucide-react";
import { MatchLevel } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface MatchBadgeProps {
  score: number;
  level: MatchLevel;
}

export default function MatchBadge({ score, level }: MatchBadgeProps) {
  if (level === "trash") return null;

  if (level === "high") {
    return (
      <Badge
        className={cn(
          "gap-1 border",
          "bg-primary/15 text-primary border-primary/30",
          "hover:bg-primary/15"
        )}
      >
        <CircleCheck className="size-3" />
        {score}% Match
      </Badge>
    );
  }

  return (
    <Badge
      className={cn(
        "gap-1 border",
        "bg-warning/15 text-warning border-warning/30",
        "hover:bg-warning/15"
      )}
    >
      <TriangleAlert className="size-3" />
      {score}% Review
    </Badge>
  );
}
