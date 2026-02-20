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
          "bg-match-high/15 text-match-high border-match-high/30",
          "hover:bg-match-high/15"
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
        "bg-match-review/15 text-match-review border-match-review/30",
        "hover:bg-match-review/15"
      )}
    >
      <TriangleAlert className="size-3" />
      {score}% Review
    </Badge>
  );
}
