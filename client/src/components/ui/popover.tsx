/**
 * Popover (Radix) with three content variants:
 * - default: medium padding, rounded-2xl, for general dropdowns.
 * - compact: smaller padding, for menus or short lists.
 * - panel: no padding, overflow scroll, for forms/lists (e.g. Finance, Services).
 * Positioning and slide direction follow Radix; in RTL (e.g. Arabic/Kurdish),
 * use align="start" or "end" if you need to flip the preferred side.
 */
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

const popoverVariants = {
  default:
    "min-w-[16rem] max-w-[20rem] p-4 rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-md shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06),0_10px_30px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.2),0_20px_40px_-12px_rgba(0,0,0,0.4)]",
  compact:
    "min-w-[8rem] p-2.5 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md shadow-lg dark:shadow-xl dark:shadow-black/20",
  panel:
    "p-0 rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-md shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06),0_20px_40px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.2),0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden max-h-[min(70vh,28rem)]",
} as const;

type PopoverContentVariant = keyof typeof popoverVariants;

function PopoverContent({
  className,
  align = "center",
  sideOffset = 8,
  variant = "default",
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  variant?: PopoverContentVariant;
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        data-variant={variant}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "text-popover-foreground outline-hidden",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:duration-150 data-[state=open]:duration-200",
          "data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-100",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          "z-50 origin-[var(--radix-popover-content-transform-origin)]",
          popoverVariants[variant],
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
export type { PopoverContentVariant };
