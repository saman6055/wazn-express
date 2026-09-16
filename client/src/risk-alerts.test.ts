import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The warehouse's standing risks — parcels stuck in the China warehouse and
 * volumetric parcels nobody has explained — are seen where the day starts,
 * and every part of them leads somewhere (owner, 2026-09-16).
 *
 * What would undo it: the cards dropping off a dashboard, a row that is only
 * text again, a link that opens a page the reader may not open, the levels
 * decided twice, or the details panel quietly moving a parcel into a batch
 * (which charges shipping on a priced batch).
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

const stale = read("components/registrations/StaleDepotCard.tsx");
const volumetric = read("components/registrations/VolumetricWatchCard.tsx");
const sheet = read("components/registrations/AlertParcelSheet.tsx");

describe("the risks are on the dashboards", () => {
  for (const file of ["pages/Dashboard.tsx", "pages/StaffDashboard.tsx"]) {
    it(`${path.basename(file)} shows both cards, for whoever may open the list`, () => {
      const src = read(file);
      expect(src).toContain('<StaleDepotCard variant="dashboard" />');
      expect(src).toContain('<VolumetricWatchCard variant="dashboard" />');
      expect(src).toContain('canViewPath("/packages/registrations") && (');
      // No empty frame when both are silent.
      expect(src).toMatch(/grid gap-3 empty:hidden/);
    });
  }

  it("the owner's dashboard puts them right under the morning brief", () => {
    const src = read("pages/Dashboard.tsx");
    const brief = src.indexOf("<DailyBrief language={language} />");
    const cards = src.indexOf('<StaleDepotCard variant="dashboard" />');
    expect(brief).toBeGreaterThan(-1);
    expect(cards).toBeGreaterThan(brief);
    expect(cards - brief).toBeLessThan(900);
  });

  it("the registrations page keeps them too", () => {
    const src = read("pages/Registrations.tsx");
    expect(src).toContain("<VolumetricWatchCard />");
    expect(src).toContain("<StaleDepotCard />");
  });
});

describe("every part of a card leads somewhere", () => {
  for (const [name, src, alert] of [
    ["StaleDepotCard", stale, "stale"],
    ["VolumetricWatchCard", volumetric, "volumetric"],
  ] as const) {
    it(`${name}: the customer opens their page, when the reader may`, () => {
      expect(src).toContain("canCustomers && r.customerId ? (");
      expect(src).toContain("<Link href={`/customers/${r.customerId}`}");
    });

    it(`${name}: the tracking opens the parcel's details`, () => {
      expect(src).toMatch(/onClick=\{\(\) => setOpenId\(r\.id\)\}[\s\S]{0,200}\{r\.trackingNumber \?\? r\.packageCode\}/);
      expect(src).toContain("<AlertParcelSheet");
    });

    it(`${name}: the title and the count lead to the whole list`, () => {
      expect(src).toContain(`"/packages/registrations?alert=${alert}"`);
      expect(src).toContain('variant === "dashboard" && canList ? (');
    });

    it(`${name}: arriving by that link opens the whole list and brings it into view`, () => {
      expect(src).toContain(`new URLSearchParams(search).get("alert") === "${alert}"`);
      expect(src).toContain("setShowAll(true)");
      expect(src).toContain("scrollIntoView(");
    });

    it(`${name}: is coloured by the shared levels, not its own`, () => {
      expect(src).toMatch(/from "@shared\/riskRules"/);
      expect(src).toContain("RISK_LEVEL_LABEL[worst]");
    });
  }

  it("the stale card's days follow the owner's 30-day line", () => {
    expect(stale).toContain("staleDepotLevel(r.daysInDepot)");
  });

  it("the volumetric card's figures follow the owner's ×3 line", () => {
    expect(volumetric).toContain("volumetricLevel(r.ratio)");
  });
});

describe("the parcel's details", () => {
  it("lead to the customer, their parcels, the parcel in the list and its batch", () => {
    expect(sheet).toContain("<Link href={`/customers/${parcel.customerId}`}");
    expect(sheet).toContain("packagesHref({ search: code })");
    expect(sheet).toContain("packagesHref({ search: tracking })");
    expect(sheet).toContain("`/batches?edit=${parcel.batchId}`");
  });

  it("offer a link only where the reader may go", () => {
    for (const path of ['"/customers"', '"/packages/all"', '"/batches"', '"/batch-assignment-scanner"']) {
      expect(sheet).toContain(`canViewPath(${path})`);
    }
  });

  it("show what happened to the parcel", () => {
    expect(sheet).toContain("trpc.scanning.getStatusHistory.useQuery(");
    expect(sheet).toContain("trpc.packages.getById.useQuery(");
  });

  it("never move a parcel into a batch themselves — that charges shipping", () => {
    expect(sheet).not.toMatch(/assignToBatch|useMutation/);
    expect(sheet).toContain('href="/batch-assignment-scanner"');
  });

  it("the stale parcel's customer can be written to", () => {
    expect(stale).toContain("buildWhatsAppLink(open.customerMobile, staleMessage(open))");
    const server = fs.readFileSync(path.resolve(SRC, "../../server/db/packages.db.ts"), "utf8");
    const fn = server.slice(server.indexOf("export async function getStaleDepotPackages"));
    expect(fn.slice(0, 1400)).toContain("customerMobile: customers.mobileNumber");
  });
});

describe("one rule for the 15 days", () => {
  it("the server's stale list reads the shared threshold", () => {
    const server = fs.readFileSync(path.resolve(SRC, "../../server/db/packages.db.ts"), "utf8");
    expect(server).toContain("import { STALE_IN_DEPOT_AFTER_DAYS } from '@shared/riskRules';");
    expect(server).not.toMatch(/export const STALE_IN_DEPOT_AFTER_DAYS = \d+/);
  });
});
