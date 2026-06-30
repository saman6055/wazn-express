import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StickyFormBarProps {
  children: ReactNode;
  className?: string;
}

/**
 * Presentational action bar that sticks to the bottom of the viewport inside a
 * form. Right-aligned (logical end) action area, top border, blurred card
 * background, above content and hidden on print.
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
      <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
        {children}
      </div>
    </div>
  );
}
