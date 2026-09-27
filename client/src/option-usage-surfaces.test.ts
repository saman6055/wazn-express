import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's rule (Sep 2026), meant for every picker in the app: the
 * choices used most rise to the top, and among equals the one used last.
 *
 * A rule that reached one dropdown and not its neighbour is worse than no
 * rule — the operator learns one list behaves one way and the next does not.
 * So this pins that every attribute picker goes through the one component,
 * and that none of them has quietly grown its own hand-rolled list again.
 */

const SRC = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

/** Every screen that offers a product type, colour or size. */
const ATTRIBUTE_FORMS = [
  "pages/CommissionForm.tsx",
  "pages/FullPackageForm.tsx",
  "pages/BulkOrderForm.tsx",
];

describe("every attribute picker follows the one rule", () => {
  it("each form uses the shared component for type, colour and size", () => {
    for (const rel of ATTRIBUTE_FORMS) {
      const src = read(rel);
      expect(src, rel).toContain('import { AttributeSelect } from "@/components/AttributeSelect";');
      for (const key of ["productType", "color", "size"]) {
        expect(src, `${rel} → ${key}`).toContain(`usageKey="${key}"`);
      }
    }
  });

  it("none of them still hand-rolls an attribute list", () => {
    for (const rel of ATTRIBUTE_FORMS) {
      const src = read(rel);
      for (const attrs of ["typeAttrs?.map", "colorAttrs?.map", "sizeAttrs?.map"]) {
        expect(src, `${rel} → ${attrs}`).not.toContain(attrs);
      }
    }
  });

  it("the platform picker follows it too", () => {
    const src = read("components/PlatformSelect.tsx");
    expect(src).toContain('recordOptionUse("platform", p.value)');
    expect(src).toContain('readOptionUsage("platform")');
    expect(src).toContain("rankOptions(filtered, usage");
  });

  it("two screens picking the same list share what they learned", () => {
    // The key names the LIST, not the field or the screen — so a product
    // type chosen on the bulk form counts on the single form as well.
    const bulk = read("pages/BulkOrderForm.tsx");
    const single = read("pages/CommissionForm.tsx");
    expect(bulk).toContain('usageKey="productType"');
    expect(single).toContain('usageKey="productType"');
  });
});

describe("the component behaves the way the rule describes", () => {
  const src = read("components/AttributeSelect.tsx");

  it("it records the pick and re-reads the order for next time", () => {
    expect(src).toContain("recordOptionUse(usageKey, next)");
    expect(src).toContain("setUsageVersion((n) => n + 1)");
  });

  it("an empty pick is not counted as a use", () => {
    expect(src).toContain("if (next) {");
  });

  it("the promoted few are labelled, so the order explains itself", () => {
    // Built on the command list since 2026-09-27, so the list can be typed
    // into; the heading that explains the order is the same.
    expect(src).toContain("CommandGroup");
    expect(src).toContain("heading={pickLang(language, {");
    expect(src).toContain('ku: "زۆرترین بەکارهاتوو"');
  });

  it("can be typed into once the list is longer than a glance", () => {
    // The owner, 2026-09-27: «لێرەش سێرچ هەبێ» — a product-type list fifteen
    // long is one nobody reads to the end.
    expect(src).toContain("const SEARCH_FROM = 8;");
    expect(src).toContain("showSearch && (");
    expect(src).toContain("<CommandInput");
  });

  it("a list nobody has used yet renders exactly as before", () => {
    // rankOptions returns an empty `top` for untouched usage, and the group
    // only renders when something is in it.
    expect(src).toContain("{top.length > 0 && (");
    const lib = read("lib/optionUsage.ts");
    expect(lib).toContain("if (used.length === 0) return { top: [], rest: [...options] };");
  });

  it("the order does not shuffle under a finger already moving", () => {
    // Usage is read into a memo keyed on a version counter, not on every
    // render of the form around it.
    expect(src).toContain("const usage = useMemo(() => readOptionUsage(usageKey), [usageKey, usageVersion]);");
  });
});

describe("what the rule refuses to do", () => {
  const lib = read("lib/optionUsage.ts");

  it("a single pick never outranks a habit", () => {
    expect(lib).toContain("if (ub.count !== ua.count) return ub.count - ua.count;");
  });

  it("it promotes a handful, not the whole list", () => {
    expect(lib).toContain("export const TOP_COUNT = 5;");
    expect(lib).toContain("const top = ranked.slice(0, Math.max(0, topCount));");
  });

  it("the curated order of everything else is untouched", () => {
    expect(lib).toContain("return { top, rest: options.filter((o) => !promoted.has(valueOf(o))) };");
  });

  it("a browser that refuses storage still gets a working list", () => {
    expect(lib).toContain("} catch {");
    expect(lib).toContain("return {};");
  });
});

describe("the kind of goods is remembered", () => {
  /*
   * The owner, 2026-09-27: «جۆری کاڵا لە کڕین بە تێچوو و پاکێجی تەواو،
   * دوایین جۆر کە دیاری کرابوو لە بیری بمێنێ» — the same complaint that
   * kept the shipping type after a save. A shop sells the same kind of
   * thing all morning.
   */
  it("reads back the last one picked", () => {
    const lib = read("lib/optionUsage.ts");
    expect(lib).toContain("export function lastOptionUsed(list: string): string | null");
    expect(lib).toContain("if (use.last > bestAt)");
  });

  it("opens both order forms on it, and keeps it after a save", () => {
    for (const page of ["pages/CommissionForm.tsx", "pages/FullPackageForm.tsx"]) {
      const src = read(page);
      expect(src, page).toContain('lastOptionUsed("productType")');
      // Only a new order, only an empty field, and only a type still on the
      // list: one deleted from settings must not reappear as a dead word.
      expect(src, page).toContain("if (isEditMode) return;");
      expect(src, page).toContain("if (formData.productType) return;");
      expect(src, page).toContain("productType: keepProductType,");
    }
  });
});
