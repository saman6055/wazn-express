import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Two floating controls, one corner.
 *
 * The width switch floats at `bottom-24 start-3`. The orders page's new-order
 * button floated at `bottom-24 start-6`, on top of it — in Kurdish and Arabic
 * at the bottom right, in English at the bottom left — and wore a chat bubble,
 * so it read as the support chat covering the switch. The button now asks the
 * switch's own visibility rule and moves above it while it shows.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

describe("the new-order button never covers the width switch", () => {
  const sw = read("components/portal/PortalWidthSwitch.tsx");
  const page = read("pages/portal/PortalFullPackage.tsx");

  it("the switch renders by one exported rule", () => {
    expect(sw).toContain("export function usePortalWidthSwitchShown()");
    expect(sw).toContain("const shown = usePortalWidthSwitchShown();");
    // Where the switch sits; if this moves, the lift below must be rechecked.
    expect(sw).toContain('"fixed bottom-24 start-3');
  });

  it("the orders button asks that rule and lifts above the switch", () => {
    expect(page).toContain("const widthSwitchShown = usePortalWidthSwitchShown();");
    expect(page).toContain('widthSwitchShown ? "bottom-40" : "bottom-24"');
    expect(page, "the button must not be pinned to the switch's spot unconditionally")
      .not.toContain('"fixed bottom-24 start-6');
  });

  it("the orders button does not look like the support chat", () => {
    const at = page.indexOf("Floating Action Button");
    expect(at, "the floating button has moved or gone").toBeGreaterThan(-1);
    const block = page.slice(at, page.indexOf("</button>", at));
    expect(block).toContain("<Plus");
    expect(block).not.toContain("<MessageCircle");
  });
});
