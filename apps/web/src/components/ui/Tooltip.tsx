"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * Tooltip that opens on hover (desktop) AND tap (mobile/touch).
 * Pass `open`/`onOpenChange` to control externally, otherwise it manages
 * its own state and adds touch-tap support automatically.
 */
function Tooltip({
  children,
  delayDuration = 300,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  ...restProps
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) {
  const [touchOpen, setTouchOpen] = React.useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp! : touchOpen;

  function handleOpenChange(next: boolean) {
    if (controlled) onOpenChangeProp?.(next);
    else setTouchOpen(next);
  }

  return (
    <TooltipPrimitive.Root
      delayDuration={delayDuration}
      open={open}
      onOpenChange={handleOpenChange}
      {...restProps}
    >
      {/* Intercept touch/pen pointer-down to toggle tooltip on tap */}
      <span
        onPointerDown={(e) => {
          if ((e.pointerType === "touch" || e.pointerType === "pen") && !controlled) {
            e.preventDefault();
            setTouchOpen((v) => !v);
          }
        }}
        style={{ display: "contents" }}
      >
        {children}
      </span>
    </TooltipPrimitive.Root>
  );
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-[220px] rounded-md border border-border/60 bg-popover px-3 py-2 text-[11px] leading-relaxed text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
