import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The portal must not change shape as a customer walks through it.
 *
 * The skin is a global admin setting, but only five of twenty-seven screens
 * ever asked what it was — every other page imported the classic layout
 * directly. So a customer on the modern skin tapped "Messages" and landed on a
 * page with a different bottom bar, a different header and a search field that
 * appeared from nowhere. Each screen looked fine; walking between them did
 * not.
 */

const PORTAL = path.resolve(__dirname, "pages/portal");

/** These four have genuine per-skin designs and branch on the skin themselves. */
const SKIN_AWARE = new Set([
  "PortalHome.tsx",
  "PortalShipments.tsx",
  "PortalFinancial.tsx",
  "PortalProfile.tsx",
  "PortalInvoiceReports.tsx",
]);

function pages(): string[] {
  return fs
    .readdirSync(PORTAL, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".tsx"))
    .map((e) => e.name);
}

describe("every portal page wears the chosen skin", () => {
  it("no page imports the classic layout directly", () => {
    const offenders = pages()
      .filter((name) => !SKIN_AWARE.has(name))
      .filter((name) =>
        /from "@\/components\/CustomerPortalLayout"/.test(fs.readFileSync(path.join(PORTAL, name), "utf8")),
      );

    expect(
      offenders,
      `use PortalLayout from components/portal/PortalLayout — it follows the admin's skin setting:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("the wrapper covers all three skins", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "components/portal/PortalLayout.tsx"), "utf8");
    expect(src).toContain("ModernPortalLayout");
    expect(src).toContain("Skin3PortalLayout");
    expect(src).toContain("CustomerPortalLayout");
  });
});

describe("things that existed on only one skin", () => {
  it("the prohibited-decision alert reaches all three homes", () => {
    // A parcel held at the depot awaiting a return-or-destroy decision, with
    // storage accruing. It was on the classic home only; the other two skins
    // linked to the static policy page instead of the customer's own parcels.
    for (const home of [
      "PortalHome.tsx",
      "modern/ModernPortalHome.tsx",
      "skin3/Skin3PortalHome.tsx",
    ]) {
      const src = fs.readFileSync(path.join(PORTAL, home), "utf8");
      expect(src, `${home} must surface the pending decision`).toMatch(
        /ProhibitedDecisionAlert|prohibited\.getMine/,
      );
    }
  });

  it("the welcome card reaches all three homes", () => {
    for (const home of [
      "PortalHome.tsx",
      "modern/ModernPortalHome.tsx",
      "skin3/Skin3PortalHome.tsx",
    ]) {
      const src = fs.readFileSync(path.join(PORTAL, home), "utf8");
      expect(src, `${home} must welcome a new customer`).toContain("PortalWelcomeCard");
    }
  });
});

describe("no route is a dead end", () => {
  it("every portal route is linked from somewhere", () => {
    // /portal/services and /portal/invoice-reports were finished pages — 271
    // and 614 lines — that nothing in the app linked to.
    const app = fs.readFileSync(path.resolve(__dirname, "App.tsx"), "utf8");
    const routes = [...app.matchAll(/path="(\/portal\/[a-z-]+)"/g)].map((m) => m[1]);

    const linked = new Set<string>();
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx$/.test(e.name) && e.name !== "App.tsx") {
          for (const m of fs.readFileSync(p, "utf8").matchAll(/["'`](\/portal\/[a-z-]+)/g)) linked.add(m[1]);
        }
      }
    };
    walk(path.resolve(__dirname, "pages"));
    walk(path.resolve(__dirname, "components"));

    const orphans = routes.filter((r) => r !== "/portal" && !linked.has(r));
    expect(orphans, `nothing links to these:\n${orphans.join("\n")}`).toEqual([]);
  });
});
