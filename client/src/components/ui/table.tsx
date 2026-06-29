import * as React from "react";

import { cn } from "@/lib/utils";

function Table({
  className,
  containerClassName,
  stickyHeader = true,
  ...props
}: React.ComponentProps<"table"> & {
  /** Extra classes for the scroll container (e.g. a different max-height). */
  containerClassName?: string;
  /**
   * Freeze the column-title row while the body scrolls (default on). The
   * container is given a capped height so the table scrolls internally and the
   * header stays put. Pass `false` to opt a table out (e.g. tiny summary tables
   * that should always render in full).
   */
  stickyHeader?: boolean;
}) {
  return (
    <div
      data-slot="table-container"
      data-sticky-header={stickyHeader ? "" : undefined}
      className={cn(
        "relative w-full overflow-auto",
        // A capped height makes the container the vertical scroller so the
        // sticky header has something to stick to (the page itself scrolling
        // wouldn't freeze it). Short tables never reach the cap, so they're
        // unaffected.
        stickyHeader && "max-h-[70vh]",
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
        // Freeze the column titles at the top of the scroll container so they
        // stay visible no matter how far down the body is scrolled. An opaque
        // background keeps body rows from showing through as they pass under.
        "sticky top-0 z-20 bg-background",
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
