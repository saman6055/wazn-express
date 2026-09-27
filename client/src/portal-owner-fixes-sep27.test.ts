import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's seven portal screenshots of 2026-09-27, each held in place.
 * Wording rules for air/sea live in lib/travelMode.test.ts.
 */

const SRC = __dirname;
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

describe("the owner's portal fixes, 2026-09-27", () => {
  it("1 · the language list is a popover kept inside the screen, not a hand-placed dropdown", () => {
    const src = read("components/portal/PortalHeaderControls.tsx");
    const picker = src.slice(src.indexOf("export function PortalLanguagePicker"), src.indexOf("export function PortalClock"));
    expect(picker.length).toBeGreaterThan(200);
    expect(picker).toContain("<PopoverContent");
    expect(picker).toContain("collisionPadding=");
    expect(picker).not.toContain("absolute end-0");
    expect(picker).toContain("useBackCloses(langOpen");
  });

  it("2 · a box in «My boxes» opens: its parcels, its receipt", () => {
    const boxes = read("components/portal/MyDeliveryBoxes.tsx");
    expect(boxes).toContain("boxSheet.openBox(box)");
    expect(boxes).toContain("{boxSheet.sheet}");
    // The hook is called before the list's early return (hooks-before-early-return).
    expect(boxes.indexOf("usePortalParcelSheet()")).toBeLessThan(boxes.indexOf("return null;"));
    const sheet = read("components/portal/PortalParcelSheet.tsx");
    expect(sheet).toContain("return { openParcel, openBox, itemFor, origins, sheet };");
    const detail = read("components/portal/PortalSearchDetail.tsx");
    expect(detail).toContain('data-testid="box-parcels"');
    // The chip no longer imports the component that now opens the sheet.
    expect(read("components/portal/portalSearchChip.ts")).toContain('from "@/lib/boxStatus"');
  });

  it("3 · «پاکەتەکانم نیشان بدە», not «ببینە»", () => {
    const page = read("pages/portal/PortalShipments.tsx");
    expect(page).toContain("پاکەتەکانم نیشان بدە (");
    expect(page).not.toContain("پاکەتەکانم ببینە");
  });

  it("6 · an order shows one total, never the purchase fee", () => {
    const page = read("pages/portal/PortalFullPackage.tsx");
    expect(page).not.toContain("commissionFeeUsd");
    expect(page).not.toContain("کرێی کڕین");
    const invoice = read("components/BatchInvoiceView.tsx");
    expect(invoice).not.toContain("commissionFee");
    expect(invoice).not.toContain("کرێی کڕین");
    expect(read("lib/portalMoney.ts")).not.toContain("کرێی کڕین");
  });

  it("7 · the order sheet scrolls on a phone — nothing at its foot is cut off", () => {
    const page = read("pages/portal/PortalFullPackage.tsx");
    const at = page.indexOf("<DialogContent", page.indexOf("Order Detail Dialog"));
    const open = page.slice(at, page.indexOf(">\n", page.indexOf(")}", at)));
    expect(open).toContain("overflow-y-auto");
    expect(open).not.toMatch(/["\s]overflow-hidden["\s]/);
    expect(open).toContain("max-sm:bottom-0");
    expect(open).toContain("showCloseButton={false}");
  });
});
