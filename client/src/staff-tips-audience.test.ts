import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { STAFF_TIPS, tipsFor, type TipLang } from "./constants/staffTips";

const LANGS: TipLang[] = ["ku", "en", "ar", "zh"];
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-06, about Ako in the China warehouse: the tips card should
 * show HIS work - «کە سیستەم بووە زمانی چینی، یانی لە چین و مەخزەنی چین کاری
 * پێدەکرێ». Chinese is the warehouse, every other language is the office.
 */
describe("who sees which tips", () => {
  const china = STAFF_TIPS.filter((t) => t.audience === "china");
  const office = STAFF_TIPS.filter((t) => t.audience === "office");
  const everybody = STAFF_TIPS.filter((t) => !t.audience);

  it("there are tips for each of the three", () => {
    expect(china.length).toBeGreaterThanOrEqual(15);
    expect(office.length).toBeGreaterThanOrEqual(40);
    expect(everybody.length).toBeGreaterThanOrEqual(10);
  });

  it("in Chinese: the warehouse's own tips and the ones for everybody - none of the office's", () => {
    const shown = tipsFor("zh");
    expect(shown.some((t) => t.audience === "office")).toBe(false);
    expect(shown.filter((t) => t.audience === "china")).toHaveLength(china.length);
    expect(shown).toHaveLength(china.length + everybody.length);
    // The warehouse's tips come first, so the first card of the day is one of them.
    expect(shown[0].audience).toBe("china");
  });

  it("in every other language: the office's tips and the ones for everybody - none of the warehouse's", () => {
    for (const lang of ["ku", "en", "ar"] as const) {
      const shown = tipsFor(lang);
      expect(shown.some((t) => t.audience === "china"), lang).toBe(false);
      expect(shown, lang).toHaveLength(office.length + everybody.length);
    }
  });

  it("the office lost none of the tips it had", () => {
    const ids = new Set(tipsFor("ku").map((t) => t.id));
    for (let n = 1; n <= 68; n++) expect(ids.has(`tip-${n}`), `tip-${n}`).toBe(true);
  });

  it("the card asks this one question, and takes its tip from the answer", () => {
    const card = read("components/StaffTips.tsx");
    expect(card).toContain("const tips = useMemo(() => tipsFor(lang), [lang]);");
    expect(card).toContain("const tip = tips[((index % tips.length) + tips.length) % tips.length];");
    expect(card).not.toContain("STAFF_TIPS");
    // Declared before the early return - a hook under it breaks the page.
    expect(card.indexOf("const tips = useMemo(")).toBeLessThan(card.indexOf("if (!onStaffArea || tips.length === 0) {"));
  });
});

describe("every tip can be read in every language", () => {
  it("no id is used twice", () => {
    const ids = STAFF_TIPS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each part that exists is written in all four languages", () => {
    for (const tip of STAFF_TIPS) {
      for (const part of [tip.short, tip.detail, tip.example]) {
        if (!part) continue;
        for (const lang of LANGS) {
          expect(String(part[lang] ?? "").trim().length, `${tip.id} ${lang}`).toBeGreaterThan(5);
        }
      }
    }
  });

  it("the warehouse's tips are really in Chinese, and digits stay 0-9", () => {
    for (const tip of STAFF_TIPS.filter((t) => t.audience === "china")) {
      expect(tip.short.zh, tip.id).toMatch(/[\u4e00-\u9fff]/);
      for (const part of [tip.short, tip.detail, tip.example]) {
        if (!part) continue;
        for (const lang of LANGS) expect(part[lang], `${tip.id} ${lang}`).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
      }
    }
  });

  it("a dollar figure stays left to right inside a Kurdish or Arabic line", () => {
    // Without the isolate "$165" is drawn "165$" in a right-to-left sentence.
    for (const tip of STAFF_TIPS.filter((t) => t.audience === "china")) {
      for (const part of [tip.short, tip.detail, tip.example]) {
        if (!part) continue;
        for (const lang of ["ku", "ar"] as const) {
          const bare = part[lang].replace(/\u2066\$[0-9.,]+\u2069/g, "");
          expect(bare, `${tip.id} ${lang}`).not.toContain("$");
        }
      }
    }
  });
});

describe("what the owner asked the warehouse to be told", () => {
  const byId = new Map(STAFF_TIPS.map((t) => [t.id, t]));

  it("an unregistered carton in a batch: double-check before it leaves", () => {
    // «جاروبار لەناو باچ پاکەتی تۆمارنەکراو هەیە، تکایە دەبڵ چێک بکە — کارتۆنی بێ
    // تۆمار کێشەیە».
    const tip = byId.get("cn-14");
    expect(tip?.audience).toBe("china");
    expect(tip?.short.ku).toContain("کارتۆنی بێ تۆمار کێشەیە");
    expect(tip?.short.zh).toContain("未登记");
    expect(tip?.detail?.zh).toContain("批次分配");
    expect(tip?.example?.en).toContain("48 cartons");
  });

  it("air: where measuring starts", () => {
    const tip = byId.get("cn-7");
    for (const lang of LANGS) expect(tip?.short[lang], lang).toContain("30");
    // The example is the system's own rule: 40 x 40 x 40 / 6000 = 10.67 kg.
    expect(tip?.example?.en).toContain("about 10.7 kg");
  });

  it("the example matches the divisor the system charges by", () => {
    const rule = fs.readFileSync(path.resolve(__dirname, "../../shared/chargeableWeight.ts"), "utf8");
    expect(rule).toContain("export const DEFAULT_VOLUMETRIC_DIVISOR = 6000;");
    expect(((40 * 40 * 40) / 6000).toFixed(1)).toBe("10.7");
    expect(((30 * 30 * 30) / 6000).toFixed(1)).toBe("4.5");
  });

  it("names the screens by the words on the Chinese menu", () => {
    const menu = JSON.parse(read("locales/zh.json").replace(/^\uFEFF/, "")).nav as Record<string, string>;
    const said = STAFF_TIPS.filter((t) => t.audience === "china")
      .flatMap((t) => [t.short.zh, t.detail?.zh ?? "", t.example?.zh ?? ""]).join("\n");
    for (const key of ["quickRegister", "batchAssignment", "registrations", "awaitingArrival", "allPackages"]) {
      expect(menu[key], key).toBeTruthy();
      expect(said, key).toContain(`「${menu[key]}」`);
    }
  });
});
