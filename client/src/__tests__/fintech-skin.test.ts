/** «فینتێک»: the admin's optional dark skin — office pages only, per browser, its own ink (owner, 2026-11-07). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");
describe("fintech skin", () => {
  const theme = read("client/src/contexts/ThemeContext.tsx");
  const layout = read("client/src/components/DashboardLayout.tsx");
  it("shows only while an office page says so, and reads as dark there", () => {
    expect(theme).toContain('const fintech = skin === "fintech" && skinScope;');
    expect(theme).toContain('const shownTheme: Theme = fintech ? "dark" : theme;');
    expect(layout).toContain("setSkinScope(true);");
    expect(layout).toContain("return () => setSkinScope(false);");
  });
  it("is the warm light look unless this browser chose otherwise", () => {
    expect(theme).toContain('localStorage.getItem(SKIN_KEY) === "fintech" ? "fintech" : "classic"');
  });
  it("the portal never mounts the office layout's switch", () => {
    expect(read("client/src/pages/portal/PortalFinancial.tsx")).not.toContain("setSkinScope");
  });
  it("a chosen text colour does not paint the skin", () => {
    expect(read("client/src/contexts/AppearanceContext.tsx")).toContain('const text = fintech ? null :');
  });
  it("its colours carry meaning: cash, debt, road, discount", () => {
    const css = read("client/src/fintechSkin.css");
    for (const hex of ["#0B0F19", "#111827", "#10B981", "#F43F5E", "#F59E0B", "#06B6D4"]) expect(css).toContain(hex);
    expect(css).toContain("prefers-reduced-motion");
  });
});
