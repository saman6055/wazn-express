import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CORNER_CLEARANCE } from "@/lib/floatingCorner";

export interface StickyFormBarProps {
  children: ReactNode;
  className?: string;
}

/**
 * Presentational action bar that sticks to the bottom of the viewport inside a
 * form. Right-aligned (logical end) action area, top border, blurred card
 * background, above content and hidden on print.
 *
 * It keeps out of the bottom-right corner, because the chat bubble and the
 * tips lamp live there and float above everything (lib/floatingCorner). Left
 * to itself the bar ran under them, and on Quick Register — where the weight
 * box is the first thing on it — the two landed on top of each other.
 */
export function StickyFormBar({ children, className }: StickyFormBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-px mt-4 border-t border-border",
        "bg-card/80 supports-[backdrop-filter]:bg-card/60 backdrop-blur",
        "print:hidden",
        className
      )}
    >
      <div className={cn("flex flex-wrap items-center justify-end gap-2 px-4 py-3", CORNER_CLEARANCE)}>
        {children}
      </div>
    </div>
  );
}
