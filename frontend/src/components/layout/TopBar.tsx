"use client";

import { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Separator } from "@/components/ui/Separator";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useSidebarShell } from "@/contexts/SidebarShellContext";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

interface TopBarProps {
  title: string;
  action?: ReactNode;
  autopilotEnabled?: boolean;
  className?: string;
}

export default function TopBar({
  title,
  action,
  autopilotEnabled,
  className,
}: TopBarProps) {
  const { open, toggle } = useSidebarShell();

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between px-4 py-0 h-14.25 bg-background sticky top-0 z-10",
          className
        )}
      >
        <div className="flex items-center gap-3">
          {/* Sidebar toggle — sits right at the edge of the content, top-left */}
          <Button
            onClick={toggle}
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
            aria-label="Toggle sidebar"
          >
            {open ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
          </Button>

          <h1 className="text-base font-semibold tracking-tight">{title}</h1>

          {autopilotEnabled && (
            <Badge className="gap-1.5 bg-primary/15 text-primary border border-primary/30 hover:bg-primary/15">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Autopilot active
            </Badge>
          )}
        </div>
        {action && <div className="pr-2">{action}</div>}
      </div>
      <Separator />
    </>
  );
}
