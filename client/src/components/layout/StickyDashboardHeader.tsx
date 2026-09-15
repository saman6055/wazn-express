import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One slim bar at the top of a dashboard: what the page is, how it stands,
 * and what you came to do — on one line, and still there after you scroll.
 *
 * The owner's note (Sep 2026): the old header was a tall coloured banner
 * with a second row of six stat cards under it, and together they took the
 * first two hundred pixels of every dashboard. On a list of 1,786 orders
 * that is the wrong two hundred pixels: the figures are read once and the
 * rows are read all day, yet the figures held the space and scrolled away
 * exactly when a long list made them worth glancing at.
 *
 * So the figures come INTO the bar as plain label-and-number pairs, the
 * banner loses its fill, and the whole thing sticks. Colour stops being
 * decoration and goes back to meaning one thing — the number it sits on.
 *
 * Deliberately not `PageHeader`: that one is the tall introduction a quiet
 * settings page still wants. This is for a screen whose job is a table.
 */

export interface HeaderStat {
  label: string;
  value: string | number;
  /** Tailwind text colour for the figure. Plain when a stat means nothing in particular. */
  tone?: string;
  /** Numbers read left-to-right even on an RTL page. */
  ltr?: boolean;
}

interface StickyDashboardHeaderProps {
  icon: LucideIcon;
  title: string;
  stats?: HeaderStat[];
  /** Buttons and menus, already sized small by the caller. */
  actions?: React.ReactNode;
  className?: string;
}

export function StickyDashboardHeader({
  icon: Icon,
  title,
  stats = [],
  actions,
  className,
}: StickyDashboardHeaderProps) {
  return (
    <div
      className={cn(
        // Sticks BELOW the layout's own navigation strip rather than behind
        // it. That strip is `sticky h-11` at top-0 on desktop and top-14 on
        // mobile (DashboardLayout), and the mobile breakpoint there is 768px
        // — Tailwind's `md` exactly. So: 56 + 44 = 100px on a phone, 44px on
        // a desktop. Sticking at top-0 would have parked this under it and
        // looked, from the outside, like the header had simply vanished.
        "sticky top-[100px] z-20 md:top-[44px]",
        // `-mx` + `px` so the bar's background reaches the full width of the
        // page padding (p-4 md:p-6) while its contents stay on the grid.
        "-mx-4 mb-4 px-4 py-2 md:-mx-6 md:px-6",
        "border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {/* Identity: small mark, one line of text, no subtitle. The subtitle
            said what the page manifestly is, in a smaller font. */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <h1 className="whitespace-nowrap text-[15px] font-semibold leading-none">{title}</h1>
        </div>

        {stats.length > 0 && (
          <>
            <span className="hidden h-5 w-px shrink-0 bg-border md:block" />
            {/* The figures. They scroll sideways rather than wrapping: a
                second line here would put the header back where it was. */}
            <div className="hidden min-w-0 flex-1 items-center gap-4 overflow-x-auto md:flex [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
              {stats.map((stat) => (
                <div key={stat.label} className="whitespace-nowrap" dir={stat.ltr ? "ltr" : undefined}>
                  <span className="text-[11px] text-muted-foreground">{stat.label} </span>
                  <span className={cn("text-sm font-semibold tabular-nums", stat.tone)}>{stat.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {actions && (
          <div className="ms-auto flex shrink-0 items-center gap-1.5 md:ms-0">{actions}</div>
        )}
      </div>

      {/* Below md the figures would squeeze the buttons off the bar, so they
          take a line of their own — still one compact strip, still sticky. */}
      {stats.length > 0 && (
        <div className="mt-1.5 flex items-center gap-4 overflow-x-auto md:hidden [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {stats.map((stat) => (
            <div key={stat.label} className="whitespace-nowrap" dir={stat.ltr ? "ltr" : undefined}>
              <span className="text-[11px] text-muted-foreground">{stat.label} </span>
              <span className={cn("text-sm font-semibold tabular-nums", stat.tone)}>{stat.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
