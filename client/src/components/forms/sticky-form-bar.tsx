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
 *
 * It has its whole width again. It used to keep 8rem of its end clear for
 * the chat bubble and the tips lamp, which floated over the bottom corner and
 * landed on Quick Register's weight box; they are in the menu rail's foot
 * now and no longer reach here (lib/floatingCorner). The panel either of
 * them opens stands above this bar, not on it.
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
