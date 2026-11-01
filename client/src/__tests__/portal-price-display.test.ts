import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * No portal screen prints a parcel price of its own accord.
 *
 * The classic self-order card showed "$1.65" against a shipment whose rate had
 * not been decided. That figure comes from the general route rule stored at
 * registration, which is not what the customer is billed — the bill comes from
 * the shipment's own rate, set later. A customer who has seen a precise number
 * will argue for it, and customs, a rate change before loading, or storage
 * while the shipment waits can all move it.
 *
 * So the decision of what may be shown lives in shared/parcelPrice.ts, and
 * these guards stop the next screen from answering it privately again.
 */

const PORTAL_DIRS = [
  path.resolve(__dirname, "pages/portal"),
  path.resolve(__dirname, "components/portal"),
];

function tsxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(p));
    else if (entry.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const FILES = PORTAL_DIRS.flatMap(tsxFiles);

describe("the portal files this is guarding", () => {
  it("found them", () => {
    // A path typo here would make every guard below pass on an empty list.
    expect(FILES.length).toBeGreaterThan(20);
  });
});

describe("nobody prints a parcel price on their own authority", () => {
  it("no screen renders calculatedCostUsd without going through the rule", () => {
    const offenders = FILES.filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      if (!/calculatedCostUsd/.test(src)) return false;
      // Sorting or filtering by the stored figure is fine — it shows nobody
      // a number. Rendering one is what needs the rule.
      const renders = /\{[^}]*calculatedCostUsd[^}]*\}/.test(src)
        && /calculatedCostUsd[\s\S]{0,120}toFixed\(2\)/.test(src);
      return renders && !/parcelPriceDisplay/.test(src);
    }).map((f) => path.basename(f));

    expect(
      offenders,
      `import parcelPriceDisplay from @shared/parcelPrice — the stored figure is the route rule, not the bill:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("no screen reads the stored figure into a number it then shows", () => {
    // The self-order card did it this way: `parseFloat(pkg.calculatedCostUsd)`
    // into a local, then `${cost.toFixed(2)}`. The check above never saw it,
    // because by render time the field name was gone.
    const derives = /(?:parseFloat|Number)\s*\([^)]*calculatedCostUsd/;
    const offenders = FILES.filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      if (/parcelPriceDisplay/.test(src)) return false;
      return src.split("\n").some((line) => {
        if (!derives.test(line)) return false;
        // Ordering a list by price shows nobody a number, so it needs no rule.
        return !/sortBy/.test(line) && !/-\s*(?:parseFloat|Number)\s*\(/.test(line);
      });
    }).map((f) => path.basename(f));

    expect(
      offenders,
      `import parcelPriceDisplay from @shared/parcelPrice:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("no screen gates a price on the amount alone", () => {
    // `cost > 0` was the whole bug: a positive number proves a route rule
    // existed, not that the shipment has been rated.
    const offenders = FILES.filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return /\bcalculatedCostUsd\s*>\s*0\b/.test(src)
        || /\bcost\s*>\s*0\s*&&/.test(src);
    }).map((f) => path.basename(f));

    expect(
      offenders,
      `ask parcelPriceDisplay whether the shipment has a rate:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("an estimate says it is one", () => {
  const usingRule = FILES.filter((f) =>
    /parcelPriceDisplay/.test(fs.readFileSync(f, "utf8")),
  );

  it("every screen that shows a price uses the rule", () => {
    // The three surfaces that print a parcel price today. If a fourth
    // appears it must be here too.
    const names = usingRule.map((f) => path.basename(f)).sort();
    expect(names).toContain("SelfOrderCard.tsx");
    expect(names).toContain("ModernPortalShipments.tsx");
    expect(names).toContain("Skin3PortalShipments.tsx");
  });

  it("every screen that shows a price labels the estimate", () => {
    // Showing the number without the word is how a customer comes to believe
    // the estimate was a quote.
    const silent = usingRule.filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return !/ESTIMATE_EXCLUDES/.test(src) && !/خەمڵێنراو/.test(src);
    }).map((f) => path.basename(f));

    expect(
      silent,
      `say the price is an estimate, and what is not in it:\n${silent.join("\n")}`,
    ).toEqual([]);
  });
});

describe("the shipment's rate reaches the screens that need it", () => {
  it("the self-order query carries it", () => {
    // parcelPriceDisplay cannot tell a rated shipment from an unrated one
    // without these, and silently returns "pending" for everything if they
    // stop being selected — hiding every price rather than failing loudly.
    // Normalised: the markers span lines, and a CRLF working copy would make
    // every "\n}" miss — a slice that finds nothing asserts nothing.
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../server/db/portal.db.ts"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const start = src.indexOf("export async function getSelfOrderPackages");
    expect(start, "getSelfOrderPackages not found").toBeGreaterThan(-1);
    const end = src.indexOf("\n}\n", start);
    expect(end, "end of getSelfOrderPackages not found").toBeGreaterThan(start);

    const fn = src.slice(start, end);
    expect(fn.length).toBeGreaterThan(200);
    expect(fn).toContain("batchPricePerKg");
    expect(fn).toContain("batchPricePerCbm");
  });
});
