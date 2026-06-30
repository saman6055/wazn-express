import * as React from "react";

import { cn } from "@/lib/utils";

function Table({
  className,
  containerClassName,
  stickyHeader = true,
  pageSticky = false,
  ...props
}: React.ComponentProps<"table"> & {
  /** Extra classes for the scroll container (e.g. a different max-height). */
  containerClassName?: string;
  /**
   * Freeze the column-title row while the body scrolls inside the table's own
   * capped-height box (default on). Pass `false` to opt a table out (e.g. tiny
   * summary tables that should always render in full).
   */
  stickyHeader?: boolean;
  /**
   * Freeze the header to the PAGE instead — it parks just under the app's top
   * bar and stays put while the whole page scrolls, even for short tables.
   * The wrapper is kept overflow-visible (an overflow ancestor would trap the
   * sticky), so use this only for tables narrow enough not to need a horizontal
   * scrollbar. Takes precedence over stickyHeader.
   */
  pageSticky?: boolean;
}) {
  return (
    <div
      data-slot="table-container"
      data-sticky-header={stickyHeader ? "" : undefined}
      className={cn(
        "relative w-full",
        // pageSticky exposes the top-bar height (44px desktop / 100px mobile)
        // so the header parks just below it, and stays overflow-visible so the
        // sticky can reach the page scroll. Otherwise the table is its own
        // capped scroll box and the header sticks to the top of that box.
        pageSticky
          ? "[--tbl-sticky-top:100px] md:[--tbl-sticky-top:44px]"
          : cn("overflow-auto", stickyHeader && "max-h-[70vh]"),
        containerClassName,
      )}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b",
        // Freeze the column titles. `--tbl-sticky-top` is 0 by default (header
        // pins to the top of the table's own scroll box); pageSticky tables set
        // it to the top-bar height so the header pins to the page instead. The
        // opaque background hides rows passing underneath.
        "sticky top-[var(--tbl-sticky-top,0px)] z-20 bg-background",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
