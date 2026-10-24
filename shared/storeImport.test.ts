import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ean13CheckDigit,
  headerKey,
  isValidEan13,
  readBarcode,
  rowsToStoreProducts,
} from "./storeImport";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("store catalogue from a spreadsheet", () => {
  it("reads two-language headers, Kurdish alone, and any case", () => {
    expect(headerKey("Barcode | بارکۆد")).toBe("barcode");
    expect(headerKey("بارکۆد")).toBe("barcode");
    expect(headerKey("NAME (KU) | ناوی کوردی")).toBe("nameKu");
    expect(headerKey("Size | قەبارە")).toBe("size");
    expect(headerKey("Variant group")).toBe("variantGroup");
    expect(headerKey("Something else")).toBeNull();
  });

  it("writes a 13-digit barcode Excel turned into a number back out in full", () => {
    expect(readBarcode(2090000100014)).toBe("2090000100014");
    expect(readBarcode(" 6 291 041 500 213 ")).toBe("6291041500213");
    expect(readBarcode("")).toBeNull();
  });

  it("checks EAN-13 the GS1 way", () => {
    expect(ean13CheckDigit("400638133393")).toBe(1);
    expect(isValidEan13("4006381333931")).toBe(true);
    expect(isValidEan13("4006381333932")).toBe(false);
  });

  it("makes a bed in M, L and XL three products with three barcodes", () => {
    const rows = ["M", "L", "XL"].map((size, i) => ({
      "Barcode | بارکۆد": `20900001000${i}5`,
      "Name (KU) | ناوی کوردی": `جێگای خەو - ${size}`,
      "Size | قەبارە": size,
      "Variant group": "BED-DONUT",
      "Price | نرخ": "25,000",
      "Currency | دراو": "iqd",
    }));
    const { products, problems } = rowsToStoreProducts(rows);
    expect(problems).toEqual([]);
    expect(products.map((p) => p.size)).toEqual(["M", "L", "XL"]);
    expect(new Set(products.map((p) => p.barcode)).size).toBe(3);
    expect(products[0].price).toBe(25000);
    expect(products[0].currency).toBe("IQD");
    expect(products[0].variantGroup).toBe("BED-DONUT");
  });

  it("keeps a row with no price, for the server to save hidden", () => {
    const { products } = rowsToStoreProducts([{ "Name (EN)": "Leash", Price: "" }]);
    expect(products[0].price).toBeNull();
  });

  it("names the row of a duplicate barcode, a missing name and a bad number", () => {
    const { products, problems } = rowsToStoreProducts([
      { Barcode: "111", "Name (EN)": "A" },
      { Barcode: "111", "Name (EN)": "B" },
      { Barcode: "222", "Name (EN)": "" },
      { Barcode: "333", "Name (EN)": "C", Price: "cheap" },
      { Barcode: "", "Name (EN)": "" },
    ]);
    expect(products.map((p) => p.nameEn)).toEqual(["A"]);
    expect(problems.map((p) => p.row)).toEqual([3, 4, 5]);
    expect(problems[0].message.en).toContain("row 2");
  });
});

describe("store products carry a barcode on every database", () => {
  it("a fresh table and an old one both get the columns and the unique index", () => {
    const m = read("server/_core/migrations.ts");
    expect(m).toContain("UNIQUE INDEX storeProducts_barcode_unique (barcode),");
    expect(m).toContain('{ name: "storeProducts.barcode", sql: "ALTER TABLE storeProducts ADD COLUMN barcode VARCHAR(64) NULL" },');
    expect(m).toContain('{ name: "storeProducts.size", sql: "ALTER TABLE storeProducts ADD COLUMN size VARCHAR(30) NULL" },');
    expect(m).toContain('CREATE UNIQUE INDEX storeProducts_barcode_unique ON storeProducts (barcode)');
  });

  it("an unpriced import is never put on sale", () => {
    const r = read("server/routers/store.router.ts");
    expect(r).toContain('status: unpriced ? ("hidden" as const) : (row.status ?? "active")');
  });
});
