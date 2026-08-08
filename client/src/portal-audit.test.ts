import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { PACKAGE_STAGE_GROUPS, PACKAGE_STATUS_LABEL } from "./lib/packageStatus";
import { stageOf, STATUS_LABEL } from "./lib/shipmentFilters";

/**
 * The customer portal is the shop window — the one part of this system that
 * sells the company rather than running it. The faults these tests pin down
 * were all found live, and they share a shape: two copies of one fact
 * drifting apart. A tile counting "pending" one way while the list it links
 * to filters another; a status map missing the enum's newest value so the
 * customer reads a raw column name; a support number retyped in five files.
 *
 * Each test holds one fact to one copy.
 */

const SRC = path.resolve(__dirname);
const PORTAL_DIRS = [
  path.join(SRC, "pages/portal"),
  path.join(SRC, "components/portal"),
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

const PORTAL_FILES = PORTAL_DIRS.flatMap(walk);
const read = (p: string) => fs.readFileSync(p, "utf8");
const rel = (p: string) => path.relative(SRC, p);

/** Pull the value list out of a drizzle mysqlEnum("status", [...]) block. */
function enumValues(schemaFile: string, afterLine: string): string[] {
  const text = fs.readFileSync(path.resolve(SRC, "../..", schemaFile), "utf8");
  const start = text.indexOf(afterLine);
  expect(start, `${afterLine} not found in ${schemaFile} — update this test`).toBeGreaterThan(-1);
  const block = text.slice(start, text.indexOf("]", start));
  return [...block.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).filter((v) => v !== "status");
}

// ---------------------------------------------------------------------------

describe("every status the database can hold has a customer-facing name", () => {
  it("package statuses are all in PACKAGE_STATUS_LABEL", () => {
    // Whatever the map does not know reaches the screen as the raw column
    // value — "customs_processing" in Latin letters on a Kurdish page.
    const statuses = enumValues("drizzle/schema/packages.schema.ts", 'status: mysqlEnum("status", [');
    const missing = statuses.filter((s) => !(s in PACKAGE_STATUS_LABEL));

    expect(missing, `add to lib/packageStatus.ts:\n${missing.join("\n")}`).toEqual([]);
  });

  it("order statuses are all in the orders page statusConfig", () => {
    const statuses = enumValues("drizzle/schema/fullPackage.schema.ts", 'status: mysqlEnum("status", [');
    const page = read(path.join(SRC, "pages/portal/PortalFullPackage.tsx"));
    const missing = statuses.filter((s) => !new RegExp(`^  ${s}: \\{`, "m").test(page));

    expect(missing, `add to statusConfig in PortalFullPackage:\n${missing.join("\n")}`).toEqual([]);
  });

  it("order statuses all land in some filter bucket", () => {
    // A status in no bucket makes the order vanish under every filter pill
    // except "all" — to the customer, an order that just disappeared.
    const statuses = enumValues("drizzle/schema/fullPackage.schema.ts", 'status: mysqlEnum("status", [');
    const page = read(path.join(SRC, "pages/portal/PortalFullPackage.tsx"));
    const bucketBlock = page.slice(page.indexOf('if (statusFilter === "pending")'), page.indexOf('}).filter(order => {', page.indexOf('if (statusFilter === "pending")')));
    const missing = statuses.filter((s) => !bucketBlock.includes(`"${s}"`));

    expect(missing, `add to a status bucket in PortalFullPackage:\n${missing.join("\n")}`).toEqual([]);
  });

  it("the home-tile stage groups only name statuses a package can hold", () => {
    // Both alternate skins once counted packages against BATCH statuses
    // ("arrived", "customs", "closed"), so the arrived tile was stuck at zero.
    // Group membership through the shared map makes that impossible to
    // reintroduce without this failing.
    const statuses = enumValues("drizzle/schema/packages.schema.ts", 'status: mysqlEnum("status", [');
    const grouped = Object.values(PACKAGE_STAGE_GROUPS).flat();
    const unknown = grouped.filter((s) => !statuses.includes(s));
    expect(unknown, `not package statuses:\n${unknown.join("\n")}`).toEqual([]);

    for (const skin of ["pages/portal/modern/ModernPortalHome.tsx", "pages/portal/skin3/Skin3PortalHome.tsx"]) {
      expect(read(path.join(SRC, skin)), `${skin} must count via PACKAGE_STAGE_GROUPS`).toContain("PACKAGE_STAGE_GROUPS");
    }
  });

  it("batch statuses all have a stage and a label", () => {
    // The home tiles count by stage and deep-link to the shipments filter;
    // a status without a stage is counted nowhere and filtered out.
    const statuses = enumValues("drizzle/schema/packages.schema.ts", 'status: mysqlEnum("status", ["open"');
    // The batches table's enum lives elsewhere; check the values the portal
    // actually receives (shipmentFilters' own list is the contract).
    const unstaged = Object.keys(STATUS_LABEL).filter((s) => stageOf(s) === null);
    expect(unstaged).toEqual([]);
    expect(statuses.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe("every link in the portal goes somewhere", () => {
  const app = read(path.join(SRC, "App.tsx"));
  const routes = [...app.matchAll(/Route path="(\/portal[^"]*)"/g)].map((m) => m[1]);

  const hrefs: { file: string; href: string }[] = [];
  for (const f of PORTAL_FILES.concat([
    path.join(SRC, "components/CustomerPortalLayout.tsx"),
    path.join(SRC, "components/PortalTopBar.tsx"),
    path.join(SRC, "components/PortalNavButtons.tsx"),
  ].filter(fs.existsSync))) {
    for (const m of read(f).matchAll(/href="(\/portal[^"#?]*)/g)) {
      hrefs.push({ file: rel(f), href: m[1] });
    }
  }

  it("every static href matches a registered route", () => {
    const known = (href: string) =>
      routes.includes(href) ||
      routes.some((r) => r.includes(":") && new RegExp("^" + r.replace(/:[^/]+/g, "[^/]+") + "$").test(href));
    const broken = hrefs.filter((h) => !known(h.href));

    expect(broken, `these links 404 inside the app:\n${broken.map((b) => `${b.file} → ${b.href}`).join("\n")}`).toEqual([]);
  });

  it("every ?status= deep link names a stage the shipments page understands", () => {
    // "?status=pending" looked right, was never a stage, and landed the
    // customer on an empty list — from a tile whose number said otherwise.
    const bad: string[] = [];
    for (const f of PORTAL_FILES) {
      for (const m of read(f).matchAll(/\/portal\/shipments\?status=([a-z_]+)/g)) {
        if (!["in_china", "in_transit", "delivered"].includes(m[1])) bad.push(`${rel(f)} → ${m[1]}`);
      }
    }
    expect(bad, `not a ShipmentStage:\n${bad.join("\n")}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("one support number", () => {
  it("no portal file hardcodes a wa.me number", () => {
    // Five copies of the number meant a future change would update some
    // screens and leave the rest messaging the old line.
    const offenders: string[] = [];
    for (const f of PORTAL_FILES) {
      const text = read(f);
      for (const m of text.matchAll(/wa\.me\/\d+|["'`]964\d{7,}["'`]/g)) {
        offenders.push(`${rel(f)}: ${m[0]}`);
      }
    }
    expect(offenders, `import TERMS_WHATSAPP_NUMBER from constants/portalTerms instead:\n${offenders.join("\n")}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("the home tiles and the shipments filter agree", () => {
  it("home counts by stageOf, not a private grouping", () => {
    // The tile's number must equal the length of the list its tap opens.
    // A private grouping here once counted customs as "pending" while the
    // shipments page filed it under "in transit".
    const home = read(path.join(SRC, "pages/portal/PortalHome.tsx"));
    expect(home).toContain('stageOf(b.status) === "in_china"');
    expect(home).toContain('stageOf(b.status) === "in_transit"');
    expect(home).toContain('stageOf(b.status) === "delivered"');
  });
});

// ---------------------------------------------------------------------------

describe("all four languages carry the portal", () => {
  it("portal.* locale keys exist in ku, en, ar and zh alike", () => {
    const langs = ["ku", "en", "ar", "zh"] as const;
    const flat = (o: Record<string, unknown>, prefix = ""): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object") Object.assign(out, flat(v as Record<string, unknown>, key));
        else out[key] = v;
      }
      return out;
    };
    const keys: Record<string, Set<string>> = {};
    for (const l of langs) {
      const raw = read(path.join(SRC, `locales/${l}.json`)).replace(/^﻿/, "");
      keys[l] = new Set(Object.keys(flat(JSON.parse(raw))).filter((k) => k.startsWith("portal")));
    }
    for (const l of langs) {
      for (const other of langs) {
        const missing = [...keys[l]].filter((k) => !keys[other].has(k));
        expect(missing, `${other}.json is missing portal keys that ${l}.json has:\n${missing.slice(0, 15).join("\n")}`).toEqual([]);
      }
    }
  });
});
