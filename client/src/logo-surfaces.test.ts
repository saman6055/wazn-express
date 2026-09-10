import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The mark sits straight on its card — no white tile — the owner's request
 * (September 2026). That only works if every place says which ink it needs:
 * black on a light surface, the white-ink twin on a dark one.
 */

const SRC = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

describe("the company mark without its white tile", () => {
  const logo = read("components/CompanyLogo.tsx");

  it("follows the theme by default: black in light, white ink in dark", () => {
    expect(logo).toContain('surface = "theme"');
    expect(logo).toContain('"object-contain dark:hidden"');
    expect(logo).toContain('darkMark("hidden dark:block")');
    expect(logo).toContain("BRAND_LOGO_ON_DARK_URL");
  });

  it("keeps the white tile only where it is asked for, or where the white mark failed", () => {
    expect(logo).toContain('const tile = surface === "tile" || (surface !== "light" && darkFailed);');
    expect(logo.split('background: "#fff"').length - 1).toBe(1);
  });

  it("the two login pages sit on a dark gradient, so they ask for white ink and no tile", () => {
    for (const rel of ["pages/StaffLogin.tsx", "pages/CustomerLogin.tsx"]) {
      const src = read(rel);
      expect(src, rel).toContain('surface="dark"');
      expect(src, rel).not.toContain("bg-white dark:bg-card rounded-2xl shadow-lg p-2");
    }
  });

  it("the public site passes its own theme, since it is not the app theme", () => {
    for (const rel of ["pages/Home.tsx", "pages/HomeClassic.tsx", "pages/HomeMinimal.tsx"]) {
      const src = read(rel);
      const tags = src.match(/<CompanyLogo\b/g) ?? [];
      const themed = src.match(/<CompanyLogo surface=\{landingTheme === "light" \? "light" : "dark"\}/g) ?? [];
      expect(themed.length, rel).toBe(tags.length);
    }
  });

  it("no shadow is drawn around a transparent mark", () => {
    expect(read("components/DashboardLayout.tsx")).not.toContain("shadow-lg shadow-emerald-500/25");
  });
});
