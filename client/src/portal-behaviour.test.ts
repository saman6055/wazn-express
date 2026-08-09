import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Behaviours a customer would notice, each one a bug that shipped.
 *
 * These are read off the source rather than rendered, because the portal has
 * no DOM test setup — but every assertion below names a specific thing that
 * was wrong on screen, so a regression fails here with the reason attached.
 */

const SRC = path.resolve(__dirname);
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8");

describe("the shipments screen, on all three skins", () => {
  const skins = [
    "pages/portal/modern/ModernPortalShipments.tsx",
    "pages/portal/skin3/Skin3PortalShipments.tsx",
  ];

  it("buckets a batch the same way the classic screen does", () => {
    // Each skin had its own grouping written out inline, and `at_depot` — a
    // parcel waiting for collection in Erbil — belonged to no tab in either,
    // so it was reachable only under "All".
    for (const f of skins) {
      const src = read(f);
      expect(src, `${f} must use the shared stage rule`).toContain("matchesStage(batch.status, statusFilter)");
      expect(src, `${f} must not re-list statuses inline`).not.toContain('["arrived", "customs"].includes');
    }
  });

  it("searching a tracking number does not empty the list", () => {
    // One box searched two things. It matched batch codes only, so typing a
    // tracking number showed the green "found" card with "no shipments"
    // directly underneath it.
    for (const f of skins) {
      expect(read(f), `${f} must match the found package's batch`).toContain("foundBatchId");
    }
  });
});

describe("the money screen", () => {
  const src = read("pages/portal/PortalFinancial.tsx");

  it("clears the balance when it reaches zero", () => {
    // The animation effect no-oped at zero, so a customer who had just paid in
    // full kept looking at the debt they had cleared.
    expect(src).toMatch(/if \(balance === 0\)/);
  });

  it("never renders a cleared account as a negative number", () => {
    // `{isDebt ? "" : "-"}` printed "-$0.00", in green, for a clear account.
    expect(src).not.toContain('{isDebt ? "" : "-"}');
  });

  it("does not accept a tab that does not exist", () => {
    // ?tab=invoices was read into state and rendered a header, two tabs and a
    // blank body — reachable by Back-navigation from a bookmark.
    expect(src).not.toContain('urlTab === "invoices"');
  });
});

describe("the orders screen", () => {
  it("opens a deep-linked order once, not on every refetch", () => {
    // The effect depended on the orders array's identity, so every refetch —
    // including on window refocus — re-opened the dialog the customer had
    // just closed, for as long as ?order= stayed in the URL.
    const src = read("pages/portal/PortalFullPackage.tsx");
    expect(src).toContain("openedDeepLink");
  });
});

describe("the tracking timeline", () => {
  it("does not show a cancelled parcel as on its way", () => {
    // Neither `returned` nor `cancelled` was in the stage map, so findIndex
    // returned -1, the index fell back to 0, and a cancelled parcel sat
    // cheerfully at step 1 of 5 — "Registered".
    const src = read("components/portal/PackageTrackingTimeline.tsx");
    expect(src).toMatch(/currentStatus === "returned"/);
    expect(src).toMatch(/currentStatus === "cancelled"/);
  });
});

describe("copying to the clipboard", () => {
  it("nowhere assumes there is a clipboard", () => {
    // navigator.clipboard is undefined on an insecure origin and inside the
    // Facebook and Instagram webviews — where a customer arriving from an
    // advert actually is. Calling it there throws inside the tap handler, and
    // several sites fired their "Copied!" toast regardless.
    const dirs = [path.join(SRC, "pages/portal"), path.join(SRC, "components/portal")];
    const files: string[] = [];
    const walk = (d: string) => {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".tsx")) files.push(p);
      }
    };
    dirs.forEach(walk);

    const offenders = files
      .filter((f) => /navigator\.clipboard\.writeText/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.basename(f));

    expect(offenders, `use copyText from lib/copyText:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the helper falls back rather than failing", () => {
    const src = read("lib/copyText.ts");
    expect(src).toContain("execCommand");
    expect(src).toMatch(/Promise<boolean>/);
  });
});

describe("dates say which month they mean", () => {
  it("no portal screen formats a date by hand", () => {
    // Eight different formats were in use — en-GB, en-US, ku-IQ, ar-IQ and
    // four bare toLocaleDateString() calls that follow the browser. On one
    // screen the transaction dates came out in Arabic-Indic digits and the
    // billing dates directly beneath them as dd/mm/yyyy. And "05/03" is two
    // different days to two different readers, which for a shipping company
    // is the difference between on time and late.
    const dirs = [path.join(SRC, "pages/portal"), path.join(SRC, "components/portal")];
    const files: string[] = [];
    const walk = (d: string) => {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".tsx")) files.push(p);
      }
    };
    dirs.forEach(walk);

    const offenders = files
      .filter((f) => /\.toLocaleDateString\(/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.basename(f));

    expect(offenders, `use formatPortalDate from lib/portalClock:\n${offenders.join("\n")}`).toEqual([]);
  });

  /**
   * Naming the month was the first answer to `05/03` meaning two different
   * days. It fixed that and introduced another: the Kurdish month names are
   * the Levantine Arabic set, and plenty of customers cannot say which month
   * تەممووز is without stopping to think. A date nobody reads at a glance is
   * no better than one two people read differently.
   *
   * The ambiguity came from *mixing* day-first and month-first, not from
   * digits. One padded, day-first, four-digit-year form, applied everywhere
   * through this one function, has neither problem.
   */
  it("the formatter writes one unambiguous numeric date", () => {
    const src = read("lib/portalClock.ts");
    expect(src).toContain("formatPortalDate");

    const fn = src.slice(src.indexOf("export function formatPortalDate"));
    // Day first, both parts padded, year always four digits.
    expect(fn).toMatch(/String\(date\.getDate\(\)\)\.padStart\(2, "0"\)/);
    expect(fn).toMatch(/String\(date\.getMonth\(\) \+ 1\)\.padStart\(2, "0"\)/);
    expect(fn).toMatch(/\$\{dd\}\/\$\{mm\}\/\$\{date\.getFullYear\(\)\}/);

    // Chinese keeps its own form: already digits, and the characters say which
    // number is which, so it is the least ambiguous of the four.
    expect(fn).toMatch(/年.*月.*日/);

    // Nothing here may go back to asking Intl for a locale-shaped date; that
    // is what produced Arabic-Indic digits above dd/mm/yyyy on one screen.
    expect(fn.slice(0, 900)).not.toMatch(/Intl\.DateTimeFormat/);
  });
});

describe("each skin keeps its own chrome", () => {
  it("the skin3 profile does not render in the modern skin", () => {
    // It imported ModernPortalLayout, so the bottom bar changed shape when a
    // customer opened their profile and changed back when they left.
    const src = read("pages/portal/skin3/Skin3PortalProfile.tsx");
    expect(src).not.toMatch(/<ModernPortalLayout>/);
    expect(src).toContain("Skin3PortalLayout");
  });
});

describe("a filter that leads nowhere does not invite a tap", () => {
  const SRC = fs.readFileSync(
    path.resolve(__dirname, "pages/portal/PortalShipments.tsx"), "utf8");

  /**
   * "On the way — 0" is worth showing: it is the answer to a question the
   * customer came to the page to ask. It was not worth tapping. The pill took
   * the tap, the list emptied, and the customer had to work out for themselves
   * that the filter they had just chosen was the reason it was empty.
   */
  it("an empty stage pill is dimmed and inert", () => {
    expect(SRC).toContain("const isEmpty = filter.count === 0 && !isActive");
    expect(SRC).toContain("disabled={isEmpty}");
    expect(SRC, "it must stay visible — the zero is information").toContain("opacity-45");
  });

  /**
   * Never disabled while it is the active filter, or a customer could select
   * a stage, watch the list empty, and have no way to switch it back off.
   */
  it("the active filter is never disabled", () => {
    expect(SRC).toMatch(/filter\.count === 0 && !isActive/);
  });
});
