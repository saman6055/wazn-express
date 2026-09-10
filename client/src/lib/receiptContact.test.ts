import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import type { CompanyInfo } from "@/hooks/useCompanyInfo";
import { companyContact } from "./brand";
import { receiptContactHtml } from "./deliveryBoxPrintUtils";

/**
 * The owner's list for the foot of every receipt: the address, the mobile
 * numbers, the customer portal and the website — so a customer holding the
 * paper knows where to find us, and where to follow the next parcel.
 */

const COMPANY: CompanyInfo = {
  name: "Wazn Express",
  nameKu: "وەزن ئێکسپرێس",
  nameAr: "وزن اكسبريس",
  address: "Iraq, Erbil, 32 Park",
  addressKu: "هەولێر، ٣٢ پارک",
  addressAr: "أربيل، 32 بارك",
  phone: "07709183535",
  phone2: "07509183535",
  email: "info@waznexpress.com",
  website: "https://waznexpress.com/",
  logoUrl: "",
};

const t = (key: string) => key;

describe("the contact details, in the receipt's language", () => {
  it("takes the Kurdish name and address for a Kurdish receipt", () => {
    const c = companyContact(COMPANY, "ku");
    expect(c.name).toBe("وەزن ئێکسپرێس");
    expect(c.address).toBe("هەولێر، ٣٢ پارک");
  });

  it("the Arabic ones for Arabic, the Latin ones for English and Chinese", () => {
    expect(companyContact(COMPANY, "ar").name).toBe("وزن اكسبريس");
    expect(companyContact(COMPANY, "en").address).toBe("Iraq, Erbil, 32 Park");
    expect(companyContact(COMPANY, "zh").name).toBe("Wazn Express");
  });

  it("writes the site and the portal as a person would type them", () => {
    const c = companyContact(COMPANY, "ku");
    expect(c.website).toBe("waznexpress.com");
    expect(c.portal).toBe("waznexpress.com/portal");
    expect(c.phones).toEqual(["07709183535", "07509183535"]);
  });

  it("falls back to the public site when Settings has none, and skips an empty phone", () => {
    const c = companyContact({ ...COMPANY, website: "", phone2: "" }, "ku");
    expect(c.website).toBe("waznexpress.com");
    expect(c.phones).toEqual(["07709183535"]);
  });

  it("prints another language's address rather than none at all", () => {
    expect(companyContact({ ...COMPANY, addressKu: "" }, "ku").address).toBe("Iraq, Erbil, 32 Park");
  });
});

describe("the block at the foot of the receipt", () => {
  const html = receiptContactHtml(companyContact(COMPANY, "ku"), t);

  it("has all four lines the owner asked for", () => {
    for (const label of ["delivery.address", "delivery.phone", "delivery.customerPortal", "delivery.website"]) {
      expect(html).toContain(`<b>${label}:</b>`);
    }
  });

  it("keeps numbers and web addresses left-to-right inside a Kurdish line", () => {
    expect(html).toContain('<bdi dir="ltr">07709183535 · 07509183535</bdi>');
    expect(html).toContain('<bdi dir="ltr">waznexpress.com/portal</bdi>');
  });

  it("prints Settings text as text, never as markup", () => {
    const hostile = receiptContactHtml(
      { ...companyContact(COMPANY, "en"), address: '<img src=x onerror="alert(1)">' },
      t,
    );
    expect(hostile).not.toContain("<img");
    expect(hostile).toContain("&lt;img");
  });

  it("is left out entirely without company details", () => {
    expect(receiptContactHtml(undefined, t)).toBe("");
  });
});

describe("both receipts carry it, from every place that prints one", () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

  it("the A4 receipt and the compact label both print the block", () => {
    const src = read("lib/deliveryBoxPrintUtils.ts");
    expect(src.split("receiptContactHtml(options?.company, t)").length - 1).toBe(2);
  });

  it("every caller hands over the company details", () => {
    for (const rel of [
      "components/delivery/BoxTable.tsx",
      "components/delivery/BoxDetailPanel.tsx",
      "components/delivery/BatchPrintBoxesSection.tsx",
    ]) {
      expect(read(rel), rel).toContain("companyContact(company,");
    }
  });

  it("the labels exist in all four languages", () => {
    for (const lang of ["ku", "en", "ar", "zh"]) {
      const text = read(`locales/${lang}.json`);
      const raw = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
      const delivery = JSON.parse(raw).delivery ?? {};
      for (const key of ["address", "phone", "customerPortal", "website"]) {
        expect(delivery[key], `${lang}.delivery.${key}`).toBeTruthy();
      }
    }
  });
});
