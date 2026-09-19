import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  PACKAGE_STATUS_LABEL,
  PACKAGE_STATUS_TONE,
  PARCEL_WHERE_WORDS,
  originCountriesOf,
  packageStatusTone,
  parcelStatusWords,
} from "./packageStatus";

describe("PACKAGE_STATUS_TONE", () => {
  it("colours every status the label map names", () => {
    for (const status of Object.keys(PACKAGE_STATUS_LABEL)) {
      expect(PACKAGE_STATUS_TONE[status], `${status} has no tone`).toBeTruthy();
    }
  });

  it("carries both themes in every entry", () => {
    for (const [status, tone] of Object.entries(PACKAGE_STATUS_TONE)) {
      expect(tone, `${status} lacks a dark background`).toMatch(/dark:bg-/);
      expect(tone, `${status} lacks a dark text colour`).toMatch(/dark:text-/);
    }
  });

  it("does not paint a returned or cancelled parcel the colour of nothing-to-see", () => {
    expect(PACKAGE_STATUS_TONE.returned).toContain("red");
    expect(PACKAGE_STATUS_TONE.cancelled).toContain("red");
    expect(PACKAGE_STATUS_TONE.ready_for_delivery).toContain("emerald");
    expect(packageStatusTone(undefined)).toBe(PACKAGE_STATUS_TONE.registered);
  });

  it("is what the screens use — no private colour switch on a package status", () => {
    // The search's cards, their sheet and a shipment's parcel list colour
    // their chips in one module (2026-09-19).
    for (const file of ["components/portal/portalSearchChip.ts", "pages/portal/PortalBatchDetail.tsx"]) {
      const src = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
      if (file.endsWith("PortalBatchDetail.tsx")) {
        // Its parcel chips come from the chip module now; it must not grow a
        // private colour switch back.
        expect(src).not.toMatch(/case "customs_processing":\s*\n\s*return ["'(]?(isDark|"bg-)/);
        continue;
      }
      expect(src, `${file} should use the shared tone`).toMatch(/packageStatusTone|PackageStatusChip/);
      expect(src, `${file} still colours a package status by hand`)
        .not.toMatch(/case "customs_processing":\s*\n\s*return ["'(]?(isDark|"bg-)/);
    }
  });
});

describe("where a parcel is, in the customer's words (owner, 2026-09-19)", () => {
  const none = new Set<number>();

  it("says the owner's three phrases, word for word", () => {
    expect(PARCEL_WHERE_WORDS.erbil.ku).toBe("گەیشتە هەولێر — ئامادەیە بۆ وەرگرتن");
    expect(PARCEL_WHERE_WORDS.onTheWay.ku).toBe("لە ڕێگادایە (لە فڕۆکە یان کەشتیدایە)");
    expect(PARCEL_WHERE_WORDS.china.ku).toBe("تۆمارکراوە لە کۆگای چین");
    expect(parcelStatusWords({ status: "ready_for_delivery" }, none)).toBe(PARCEL_WHERE_WORDS.erbil);
    expect(parcelStatusWords({ status: "in_transit" }, none)).toBe(PARCEL_WHERE_WORDS.onTheWay);
    for (const words of Object.values(PARCEL_WHERE_WORDS)) {
      expect(words.ku && words.en && words.ar && words.zh).toBeTruthy();
    }
  });

  it("keeps customs as «لە گومرگ», as the owner decided", () => {
    expect(parcelStatusWords({ status: "customs_processing" }, none)).toBe(PACKAGE_STATUS_LABEL.customs_processing);
    expect(PACKAGE_STATUS_LABEL.customs_processing.ku).toBe("لە گومرگ");
  });

  it("says China only when that is known — a parcel registered in Erbil never went there", () => {
    const origins = originCountriesOf([
      { status: "in_transit", batchId: 10, registeredInCountryId: 2 },
      { status: "registered", batchId: null, registeredInCountryId: 5 },
    ]);
    expect([...origins]).toEqual([2]);
    // Stamped with a country the customer's shipped parcels came from.
    expect(parcelStatusWords({ status: "registered", registeredInCountryId: 2 }, origins)).toBe(PARCEL_WHERE_WORDS.china);
    // Registered before the stamp existed: everything then came through China.
    expect(parcelStatusWords({ status: "registered", registeredInCountryId: null }, origins)).toBe(PARCEL_WHERE_WORDS.china);
    // Packed into a shipment: shipments leave from China.
    expect(parcelStatusWords({ status: "in_batch", registeredInCountryId: 5 }, none)).toBe(PARCEL_WHERE_WORDS.china);
    expect(parcelStatusWords({ status: "registered", batchId: 11, registeredInCountryId: 5 }, none)).toBe(PARCEL_WHERE_WORDS.china);
    // A country no shipped parcel came from — the Erbil depot: the neutral name.
    expect(parcelStatusWords({ status: "registered", registeredInCountryId: 5 }, origins)).toBe(PACKAGE_STATUS_LABEL.registered);
    expect(PACKAGE_STATUS_LABEL.registered.ku).not.toContain("چین");
  });

  it("a customer who has shipped nothing yet is told China — nearly every first parcel is registered there", () => {
    expect(parcelStatusWords({ status: "registered", registeredInCountryId: 2 }, none)).toBe(PARCEL_WHERE_WORDS.china);
  });

  it("names everything else by its exact name", () => {
    for (const status of ["out_for_delivery", "delivered", "returned", "cancelled"]) {
      expect(parcelStatusWords({ status }, none)).toBe(PACKAGE_STATUS_LABEL[status]);
    }
    expect(parcelStatusWords({ status: "something_new" }, none)).toBeNull();
  });
});
