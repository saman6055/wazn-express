import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner, 2026-09-27: every place a language is chosen — portal and
 * office — shows Kurdistan for Kurdish, Iraq for Arabic, China for Chinese.
 * Drawn by components/LanguageFlag; emoji flags print as letters on Windows
 * and Kurdistan has none.
 */

const SRC = __dirname;
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

const PICKERS = [
  "components/portal/PortalHeaderControls.tsx",
  "pages/portal/PortalProfile.tsx",
  "components/topbar/QuickSettings.tsx",
  "components/LanguageSwitcher.tsx",
  "components/delivery/BoxDetailPanel.tsx",
  "components/delivery/BoxTable.tsx",
  "pages/Settings.tsx",
];

describe("language flags", () => {
  it("every language picker draws the shared flag", () => {
    for (const file of PICKERS) {
      expect(read(file), file).toContain("<LanguageFlag");
    }
  });

  it("no picker prints the emoji field any more", () => {
    for (const file of PICKERS) {
      expect(read(file), file).not.toMatch(/\{\s*(l|lang|info\?|languageInfo)\.flag\s*\}/);
    }
  });

  it("each language has the owner's flag", () => {
    const flag = read("components/LanguageFlag.tsx");
    const ku = flag.slice(flag.indexOf('case "ku":'), flag.indexOf('case "ar":'));
    expect(ku).toContain("#ED2024"); // red
    expect(ku).toContain("#278E43"); // green
    expect(ku).toContain("KURDISTAN_SUN");
    expect(flag).toContain("starPoints(15, 10, 5.1, 2.9, 21)"); // the 21-ray sun
    const ar = flag.slice(flag.indexOf('case "ar":'), flag.indexOf('case "zh":'));
    expect(ar).toContain("الله أكبر"); // Iraq
    expect(ar).toContain("#000000");
    const zh = flag.slice(flag.indexOf('case "zh":'), flag.indexOf('case "en":'));
    expect(zh).toContain("CHINA_BIG");
    expect(zh).toContain("CHINA_SMALL");
  });
});
