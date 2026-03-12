"use client";

import { ApplicationStatus } from "./types";
import { Badge } from "@/components/ui/Badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "lucide-react";

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; className: string }> = {
  sent: {
    label: "Sent",
    className: "bg-primary/15 text-primary border-primary/30 hover:bg-primary/15",
  },
  replied: {
    label: "Replied",
    className: "bg-success/15 text-success border-success/30 hover:bg-success/15",
  },
  rejected: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/10",
  },
  withdrawn: {
    label: "Withdrawn",
    className: "bg-muted text-muted-foreground border-border hover:bg-muted",
  },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as ApplicationStatus[];

interface StatusBadgeProps {
  status: ApplicationStatus;
  onChange: (s: ApplicationStatus) => void;
}

export default function StatusBadge({ status, onChange }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.sent;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="h-auto rounded-full p-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <Badge className={cn("border gap-1 cursor-pointer", cfg.className)}>
            {cfg.label}
            <ChevronDownIcon className="size-3" />
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ALL_STATUSES.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onChange(s)}>
            <Badge className={cn("border mr-2", STATUS_CONFIG[s].className)}>
              {STATUS_CONFIG[s].label}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
