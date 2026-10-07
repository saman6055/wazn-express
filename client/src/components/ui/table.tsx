import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A horizontal scrollbar pinned to the bottom of the viewport that mirrors a
 * wide table's own scroll. It only appears when the table actually overflows
 * sideways AND the table's real (bottom-edge) scrollbar is scrolled off-screen,
 * so staff can always reach left/right without hunting for the bar far below.
 */
function FloatingHScroll({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) {
  const barRef = React.useRef<HTMLDivElement>(null);
  const syncingRef = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);
  const [geo, setGeo] = React.useState({ show: false, left: 0, width: 0, scrollWidth: 0 });

  React.useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const measure = () => {
      rafRef.current = null;
      const rect = el.getBoundingClientRect();
      const overflows = el.scrollWidth - el.clientWidth > 2;
      const realBarHidden = rect.bottom > window.innerHeight + 1; // own scrollbar off-screen
      const onScreen = rect.top < window.innerHeight && rect.bottom > 0 && rect.width > 0;
      const show = overflows && realBarHidden && onScreen;
      setGeo((prev) =>
        prev.show === show &&
        Math.abs(prev.left - rect.left) < 0.5 &&
        Math.abs(prev.width - rect.width) < 0.5 &&
        prev.scrollWidth === el.scrollWidth
          ? prev
          : { show, left: rect.left, width: rect.width, scrollWidth: el.scrollWidth },
      );
      if (barRef.current && !syncingRef.current) barRef.current.scrollLeft = el.scrollLeft;
    };

    const schedule = () => {
      if (rafRef.current == null) rafRef.current = window.requestAnimationFrame(measure);
    };
    const onContainerScroll = () => {
      if (barRef.current && !syncingRef.current) {
        syncingRef.current = true;
        barRef.current.scrollLeft = el.scrollLeft;
        syncingRef.current = false;
      }
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    el.addEventListener("scroll", onContainerScroll, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      el.removeEventListener("scroll", onContainerScroll);
      ro.disconnect();
    };
  }, [targetRef]);

  const onBarScroll = () => {
    const el = targetRef.current;
    if (!el || !barRef.current) return;
    syncingRef.current = true;
    el.scrollLeft = barRef.current.scrollLeft;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  if (!geo.show) return null;
  return (
    <div
      ref={barRef}
      onScroll={onBarScroll}
      aria-hidden
      className="fixed bottom-0 z-30 h-4 overflow-x-auto overflow-y-hidden border-t border-border bg-background/85 backdrop-blur-sm shadow-[0_-2px_6px_rgba(0,0,0,0.06)]"
      style={{ left: geo.left, width: geo.width }}
    >
      <div style={{ width: geo.scrollWidth, height: 1 }} />
    </div>
  );
}

/**
 * Gives every body cell the title of its column as `data-label`, for the
 * phone's card layout to print beside the value. Kept up to date as rows
 * come and go; a cell that set its own label keeps it; spanned columns are
 * counted so the labels line up.
 */
function useCardLabels(ref: React.RefObject<HTMLTableElement | null>, on: boolean) {
  React.useEffect(() => {
    const table = ref.current;
    if (!on || !table) return;
    const apply = () => {
      const heads = Array.from(table.querySelectorAll(":scope > thead > tr:last-child > th")).map((th) =>
        (th.textContent ?? "").trim(),
      );
      table.querySelectorAll(":scope > tbody > tr").forEach((tr) => {
        let col = 0;
        Array.from(tr.children).forEach((cell) => {
          const el = cell as HTMLElement;
          const span = Number(el.getAttribute("colspan") ?? 1) || 1;
          if (span === 1 && !el.hasAttribute("data-label-own")) {
            const label = heads[col] ?? "";
            if (el.getAttribute("data-label") !== label) el.setAttribute("data-label", label);
          }
          col += span;
        });
      });
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(table, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [ref, on]);
}

function Table({
  className,
  containerClassName,
  stickyHeader = true,
  pageSticky = false,
  mobileCards = false,
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
  /**
   * On a phone, every row becomes a card and every cell a labelled line
   * (owner, 2026-09-27: the system on a phone like the portal app). The
   * labels are the column titles, read from the header, so a table opts in
   * with this one prop. The first cell is the card's title. Desktop is
   * untouched. See `table[data-mobile-cards]` in index.css.
   */
  mobileCards?: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  useCardLabels(tableRef, mobileCards);
  return (
    <>
      <div
        ref={containerRef}
        data-slot="table-container"
        data-sticky-header={stickyHeader ? "" : undefined}
        className={cn(
          "relative w-full",
          // pageSticky exposes the top-bar height (44px desktop / 100px mobile)
          // so the header parks just below it, and stays overflow-visible so the
          // sticky can reach the page scroll. Otherwise the table is its own
          // capped scroll box and the header sticks to the top of that box.
          pageSticky
            // A phone has one app bar now (components/mobile), under the notch.
            // Below xl a table wider than the screen scrolls inside itself —
            // the page-level safety net would otherwise cut its last columns
            // (tablet, 2026-09-28). The header then sticks within the table.
            // xl, not lg: a tablet on its side is 1024-1194px wide, and there
            // the batches and box tables (about 1160px) pushed the whole page
            // sideways (owner, 2026-10-07: the system on an iPad, both ways).
            // The 44px (the top bar's height) is for xl only: where the table
            // scrolls inside itself its header sticks to the table's own top,
            // and an offset there pushed the header down over the first row.
            ? "xl:[--tbl-sticky-top:44px] max-xl:overflow-x-auto"
            : cn("overflow-auto", stickyHeader && "max-h-[70vh]"),
          containerClassName,
        )}
      >
        <table
          ref={tableRef}
          data-slot="table"
          data-mobile-cards={mobileCards ? "" : undefined}
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
      <FloatingHScroll targetRef={containerRef} />
    </>
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
        "sticky top-[var(--tbl-sticky-top,0px)] z-20 bg-card shadow-[inset_0_-1px_0_var(--border)]",
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
        "text-foreground h-10 px-2 text-start align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]",
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
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0 [&>[role=checkbox]]:translate-y-[2px]",
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
