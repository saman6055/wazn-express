import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import * as corner from "@/lib/floatingCorner";
import { CORNER_PANEL } from "@/lib/floatingCorner";
import { askForTip, onTipAsked, TIP_WORD } from "@/lib/tipsLamp";

const ROOT = path.resolve(__dirname, "..", "..", "client", "src");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

function slice(src: string, start: string, end: string, label: string): string {
  const a = src.indexOf(start);
  expect(a, `${label}: start marker not found`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `${label}: end marker not found after start`).toBeGreaterThan(a);
  return src.slice(a, b);
}

/**
 * The chat bubble and the tips lamp, and the page they used to stand on.
 *
 * 2026-09-27 the owner asked for them on the right-hand side; 2026-09-30 the
 * lamp sat on Quick Register's weight box; 2026-10-07, with a picture of both
 * over a customer's code: «ئەو دوو ئایکۆنە زۆر بەکەڵکن بەڵام جێگا دەگرن،
 * دەکەونە سەر نووسین و شت لە سیستەمدا». In a right-to-left page the
 * bottom-right corner is the first column of every list, and at the end of a
 * page a row cannot be scrolled out from under a button that does not scroll.
 *
 * He chose, from a drawing of three ways: the foot of the menu rail on a
 * desktop; on a phone, messages beside the bells and the lamp inside «زیاتر».
 *
 * Looked at in the local app:
 *
 *   1440x900, Kurdish   the rail's foot is its last 121px: lamp, then the
 *                       bubble with its count; no fixed button anywhere on
 *                       the page. A tip opens 16px beside the rail and 80px
 *                       up; the chat panel in the same place.
 *   1366x650, Quick     the form bar is its whole width again, the weight box
 *   Register            at its end, and a panel's foot is above the bar's top
 *   Chinese             the rail and its foot are on the left; the card opens
 *                       beside them, not across the screen
 *   375x812             the bubble is between search and the bells, with its
 *                       count; an amber dot on «زیاتر»; the row there puts
 *                       the sheet away and shows a tip; nothing floats above
 *                       the tab bar and nothing scrolls sideways
 *   full screen         the rail slides away and takes the lamp with it
 *
 * What it costs: on a short window the rail's own icons give up some height
 * for the foot (28px tall at a 650px window, 38px before).
 */
describe("nothing of theirs floats over the page", () => {
  const chat = read("components/chat/StaffChat.tsx");
  const tips = read("components/StaffTips.tsx");

  it("the corner hands out no place over the page any more", () => {
    // No slots, no reserve: the one thing left is where a panel opens.
    expect(Object.keys(corner)).toEqual(["CORNER_PANEL"]);
  });

  it("the chat draws its button into a place the layout keeps", () => {
    const drawn = slice(chat, "{slot &&\n        createPortal(", "\n        )}", "the bubble");
    expect(drawn).toContain('data-testid="staff-chat-bubble"');
    expect(drawn.trimEnd().endsWith("slot,")).toBe(true);
    // The bubble is positioned by the place it is put in, never by itself.
    expect(drawn).not.toMatch(/\bfixed\b/);
    expect(chat).not.toContain("cornerSlot");
  });

  it("the tips card draws no lamp of its own", () => {
    expect(tips).toContain("if (!open) return overlay;");
    expect(tips).not.toContain("cornerSlot");
    // It hears a lamp instead - and listens before the early return, or the
    // hook count changes between renders and the page breaks.
    const listens = tips.indexOf("useEffect(() => onTipAsked(showNextTip), [showNextTip]);");
    expect(listens).toBeGreaterThan(-1);
    expect(listens).toBeLessThan(tips.indexOf("if (!onStaffArea || tips.length === 0) {"));
  });

  it("neither puts anything at the foot of the window but its panel", () => {
    for (const src of [chat, tips, read("components/TipsLamp.tsx")]) {
      expect(src).not.toMatch(/\bfixed\b[^"`\n]*\bbottom-/);
    }
  });
});

describe("where they live instead", () => {
  const layout = read("components/DashboardLayout.tsx");
  const shell = read("components/mobile/MobileAppShell.tsx");

  it("desktop: the foot of the menu rail, the lamp over the messages", () => {
    const foot = slice(layout, 'data-testid="rail-foot"', "</div>", "the rail's foot");
    expect(foot).toContain("<TipsLamp />");
    expect(foot).toContain('<span ref={setRailChatSlot} className="contents" />');
    expect(foot.indexOf("<TipsLamp />")).toBeLessThan(foot.indexOf("setRailChatSlot"));
    // The rail's list scrolls above it; the foot never moves or shrinks.
    const open = slice(layout, "{compact && (\n          <div\n", 'data-testid="rail-foot"', "the foot's own element");
    expect(open).toContain("shrink-0");
  });

  it("phone: messages beside the bells, before them", () => {
    const bells = slice(layout, "bells={", "\n          }", "the phone's bells");
    expect(bells).toContain('<span ref={setBarChatSlot} className="contents" />');
    expect(bells.indexOf("setBarChatSlot")).toBeLessThan(bells.indexOf("<TaskBell"));
  });

  it("one chat, told which of the two places it has", () => {
    expect(layout).toContain(
      '{!fullScreen && <StaffChat slot={isMobile ? barChatSlot : railChatSlot} placement={isMobile ? "bar" : "rail"} />}',
    );
    // Two places, never both: the rail's foot is not drawn on a phone.
    expect(layout).toContain("{compact && (\n          <div\n");
    expect(layout).toContain("const compact = !isMobile;");
  });

  it("phone: the lamp is a named row in «زیاتر», and the tab says it is there", () => {
    const row = slice(shell, 'data-testid="mobile-more-tips"', "</button>", "the lamp's row");
    // A name beside the icon: a bare icon tells nobody anything (owner, 2026-09-17).
    expect(row).toContain("{L(TIP_WORD)}");
    expect(row).toContain("{L(W.tipsHint)}");
    expect(shell).toContain('{t.key === "more" && (');
    expect(shell).toContain('data-testid="mobile-tab-more-lamp"');
  });

  it("phone: the sheet is put away before the tip is asked for", () => {
    // The sheet is above the card; a tip shown under it is a tip nobody sees.
    const ask = slice(layout, "onTips={() => {", "}}", "the lamp's row, pressed");
    expect(ask.indexOf("mobileSheet.setSheet(null);")).toBeGreaterThan(-1);
    expect(ask.indexOf("mobileSheet.setSheet(null);")).toBeLessThan(ask.indexOf("askForTip();"));
  });
});

describe("asking for a tip", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reaches the card, and stops reaching it once the card is gone", () => {
    vi.stubGlobal("window", new EventTarget());
    const show = vi.fn();
    const stop = onTipAsked(show);
    askForTip();
    askForTip();
    expect(show).toHaveBeenCalledTimes(2);
    stop();
    askForTip();
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("is named in every language", () => {
    for (const lang of ["ku", "en", "ar", "zh"] as const) expect(TIP_WORD[lang].length).toBeGreaterThan(0);
  });

  it("costs the first paint nothing: the tips stay a lazy chunk", () => {
    // Every tip's text is in that chunk. Whatever draws a lamp must not pull
    // it in just to ask it a question.
    expect(read("lib/tipsLamp.ts")).not.toMatch(/^import /m);
    for (const file of ["components/TipsLamp.tsx", "components/DashboardLayout.tsx", "components/mobile/MobileAppShell.tsx"]) {
      const src = read(file);
      expect(src, file).not.toContain("constants/staffTips");
      expect(src, file).not.toContain("components/StaffTips");
    }
    expect(read("App.tsx")).toContain('const StaffTips = lazy(() => import("./components/StaffTips")');
  });
});

describe("the panel either of them opens", () => {
  it("opens beside the rail, on the rail's side in every language", () => {
    // `start`: the right in Kurdish - the corner he asked for - and the left
    // in English or Chinese, next to the button that was pressed.
    expect(CORNER_PANEL).toContain("start-4 md:start-24");
    expect(CORNER_PANEL).not.toMatch(/(?:^|\s)(?:md:)?(?:left|right|end)-/);
  });

  it("stands above a form's own bar", () => {
    // 5rem up on a desktop; the bar on Quick Register is 65px. The tips card
    // arrives by itself twice a day and must not land on the weight box.
    expect(CORNER_PANEL).toContain("md:bottom-20");
    expect(CORNER_PANEL).toContain("bottom-[calc(9rem+env(safe-area-inset-bottom))]");
  });

  it("is placed in one module, for both", () => {
    expect(read("components/chat/StaffChat.tsx")).toContain("CORNER_PANEL,");
    expect(read("components/StaffTips.tsx")).toContain("className={`${CORNER_PANEL} w-80 max-w-[calc(100vw-2rem)]");
  });

  it("left the form bar its whole width", () => {
    // It kept 8rem of its end clear while the two buttons floated there.
    const bar = read("components/forms/sticky-form-bar.tsx");
    expect(bar).not.toContain("CORNER_CLEARANCE");
    expect(bar).not.toContain("@/lib/floatingCorner");
    expect(bar).not.toMatch(/\bp[re]-\d/);
    expect(bar).toContain('<div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">');
  });
});

/**
 * And the next one. Three times in ten days something pinned to a bottom
 * corner of the window ended up on top of what the office was reading, and
 * each time the thing underneath was moved. This is the list of everything
 * that may still sit there, each with its reason; a new entry fails here, so
 * whoever adds it reads lib/floatingCorner first and puts it in the layout's
 * furniture instead.
 */
describe("what may still sit in a bottom corner of the window", () => {
  const MAY: Record<string, { count: number; why: string }> = {
    "lib/floatingCorner.ts": { count: 1, why: "the panel the chat or the lamp opens: opened on purpose, closed again" },
    "components/DashboardLayout.tsx": { count: 2, why: "full screen only: the way out and the zoom, when the rail and the bars are gone" },
    "components/entry/EntryWidgets.tsx": { count: 1, why: "a read-out that takes no clicks (pointer-events-none)" },
    "components/portal/PortalWidthSwitch.tsx": { count: 1, why: "the customer's portal, not the office's pages" },
  };

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (fs.statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
    }
    return out;
  }

  /** Pinned to the foot of the window and to ONE side of it: a corner. */
  function inACorner(classes: string): boolean {
    if (!/(?:^|\s)(?:[a-z-]+:)*bottom-/.test(classes)) return false;
    const sides = new Set<string>();
    for (const m of classes.matchAll(/(?:^|\s)(?:[a-z-]+:)*(start|end|left|right|inset-x)-(\S+)/g)) {
      // Centred, and moved back by half its own width: no side.
      if (m[2] !== "1/2") sides.add(m[1]);
    }
    // Both edges, or `inset-x`, is a bar across the window - it has no corner.
    return sides.size === 1 && !sides.has("inset-x");
  }

  const found: Record<string, number> = {};
  for (const file of walk(ROOT)) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/["`]([^"`\n]*\bfixed\b[^"`\n]*)["`]/g)) {
      if (inACorner(m[1])) found[rel] = (found[rel] ?? 0) + 1;
    }
  }

  it("finds the ones that are there", () => {
    // Guard the guard: a pattern that matches nothing would pass the next test.
    expect(Object.keys(found).length).toBeGreaterThanOrEqual(4);
    expect(found["lib/floatingCorner.ts"]).toBe(1);
  });

  it("is this list and nothing more", () => {
    const allowed = Object.fromEntries(Object.entries(MAY).map(([file, v]) => [file, v.count]));
    expect(found, "pinned to a bottom corner: sooner or later it sits on a list. See lib/floatingCorner.ts").toEqual(allowed);
  });
});
