import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

describe("every page downloads only what it uses", () => {
  it("the logo's chain (logo → brand → contact channels) no longer pulls in the terms text", () => {
    expect(read("constants/contactChannels.ts")).toContain('from "./whatsapp"');
    expect(read("constants/contactChannels.ts")).not.toContain("portalTerms");
    expect(read("lib/brand.ts")).not.toContain("portalTerms");
  });

  it("the number has one home, and portalTerms still offers it", () => {
    expect(read("constants/whatsapp.ts")).toContain('export const TERMS_WHATSAPP_NUMBER = "9647709183535"');
    const terms = read("constants/portalTerms.ts");
    expect(terms).not.toMatch(/export const TERMS_WHATSAPP_NUMBER\s*=/);
    expect(terms).toContain("export { TERMS_WHATSAPP_NUMBER };");
  });

  it("the camera scanner library loads only when the camera is chosen", () => {
    const src = read("components/scanner/ScanInput.tsx");
    expect(src).toContain('lazy(() => import("@/components/BarcodeScanner"))');
    expect(src).not.toMatch(/^import BarcodeScanner from/m);
  });

  it("the legacy static pages are not compiled into the app's stylesheet", () => {
    expect(read("index.css")).toContain('@source not "../public/site";');
  });
});

describe("a clock does not re-render a page", () => {
  it("the orders dashboard ticks a LiveClock, not its own state", () => {
    const src = read("pages/UnifiedOrdersDashboard.tsx");
    expect(src).not.toContain("setInterval");
    expect(src).toContain("<LiveClock");
    expect(src).toMatch(/const allOrders: any\[\] = useMemo\(/);
  });
});
