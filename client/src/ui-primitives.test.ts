import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The shared controls every staff screen is built from.
 *
 * An audit in September 2026 found the defects that repeat across the whole
 * admin side living in a handful of these files: a select that ignored the
 * height a form asked for, dialogs that could never be wider than 512px or
 * taller than the screen, a switch whose knob left its track in Kurdish,
 * fields that never turned red, toasts that ignored the app's theme and came
 * in twos. Each is pinned here, so a regenerated component cannot bring one
 * back quietly.
 */

const SRC = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

describe("dialogs take the width they ask for and fit the screen", () => {
  for (const rel of ["components/ui/dialog.tsx", "components/ui/alert-dialog.tsx"]) {
    it(rel, () => {
      const src = read(rel);
      // sm:max-w-lg came later in the stylesheet than a page's max-w-2xl and
      // capped 45 dialogs at 512px; the phone margin lives on the width now.
      expect(src).not.toContain("sm:max-w-lg");
      expect(src).toContain("w-[calc(100%-2rem)] max-w-lg");
      // Tall content scrolls inside the dialog instead of pushing the title
      // and the buttons off the screen.
      expect(src).toContain("max-h-[calc(100dvh-2rem)] overflow-y-auto");
      // Kurdish and Arabic headers align to their own start.
      expect(src).toContain("sm:text-start");
      expect(src).not.toContain("sm:text-left");
    });
  }

  it("the close button follows the reading direction and is big enough to hit", () => {
    const src = read("components/ui/dialog.tsx");
    expect(src).toContain("absolute top-3 end-3 inline-flex size-8");
    expect(src).not.toContain("top-4 right-4");
  });
});

describe("form controls", () => {
  it("a select takes the height its form gives it", () => {
    const src = read("components/ui/select.tsx");
    // data-[size=default]:h-9 outranked a plain h-11, so 50 overrides did nothing.
    expect(src).not.toContain("data-[size=default]:h-9");
    expect(src).toContain(" h-9 data-[size=sm]:h-8");
    // The check mark and the padding follow the reading direction.
    expect(src).toContain("pe-8 ps-2");
    expect(src).toContain("absolute end-2");
  });

  it("a switch is laid out left to right, so its knob stays in its track", () => {
    expect(read("components/ui/switch.tsx")).toContain('dir="ltr"');
  });

  it("a required or out-of-range field turns red once the user leaves it that way", () => {
    for (const rel of ["components/ui/input.tsx", "components/ui/textarea.tsx"]) {
      expect(read(rel), rel).toContain("user-invalid:border-destructive");
    }
  });

  it("no colour in the stylesheet wraps an oklch token in hsl()", () => {
    // hsl(var(--foreground)) with an oklch value is invalid CSS: the date
    // field, placeholder and option fixes that used it did nothing.
    expect(read("index.css")).not.toMatch(/hsl\(var\(--/);
  });

  it("popovers use the Tailwind 4 spelling for the trigger's width", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx$/.test(e.name) && fs.readFileSync(p, "utf8").includes("w-[--radix")) offenders.push(p);
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });
});

describe("toasts", () => {
  it("follow the app's theme and direction, not the operating system's", () => {
    const src = read("components/ui/sonner.tsx");
    expect(src).not.toMatch(/from ["']next-themes["']/);
    expect(src).toContain('from "@/contexts/ThemeContext"');
    expect(src).toContain("dir={direction}");
  });

  it("are coloured by kind, can be closed, and stay clear of the corner controls", () => {
    const src = read("components/ui/sonner.tsx");
    expect(src).toContain("richColors");
    expect(src).toContain("closeButton");
    expect(src).toContain("offset={{ bottom: 80, right: isRTL ? 96 : 24 }}");
  });

  it("come one per action: the global toast stays quiet when the page has spoken", () => {
    const src = read("components/MutationToastHandler.tsx");
    expect(src).toContain("toast.getHistory().length > before");
    // Its pending timers are cleared with it.
    expect(src).toContain("timers.forEach((timer) => window.clearTimeout(timer))");
  });
});

describe("tables", () => {
  it("headers align to the reading direction, like the cells under them", () => {
    const src = read("components/ui/table.tsx");
    expect(src).toContain("h-10 px-2 text-start align-middle");
    expect(src).not.toContain("px-2 text-left");
    expect(src).not.toContain("[role=checkbox])]:pr-0");
  });

  it("the sticky header matches its card and keeps its rule while stuck", () => {
    expect(read("components/ui/table.tsx")).toContain("z-20 bg-card shadow-[inset_0_-1px_0_var(--border)]");
  });

  it("numeric cells keep the page direction, so text-end means the same in a cell and its header", () => {
    expect(read("index.css")).toContain('[dir="rtl"] :is(.font-mono, .tabular-nums):not([dir]):not(td, th)');
  });
});
