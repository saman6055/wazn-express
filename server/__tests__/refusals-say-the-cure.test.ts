import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { hasFix } from "../shared/fixAdvice";

/**
 * The owner's standing rule, 2026-09-24, unprompted: «کاتێ شتێکێ هەڵە هەیە لە
 * ئاگاداری هۆکارەکە بڵێت و ڕێکاری دروستی حەڵکردنی کێشەکەش بڵێت … بۆ هەموو
 * سیستەم» — when something is wrong, the notice must say the reason *and* the
 * steps to solve it, everywhere.
 *
 * He asked, a day later, whether it had been done. It had not: three
 * refusals out of a hundred and thirty-five. This is the ratchet — the
 * number of refusals still without a cure may fall and may never rise, and
 * the screens a refusal has to pass through must keep being able to show one.
 */

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const KURDISH = /[؀-ۿ]/;

/** Every refusal in the server that speaks to a person, and whether it cures. */
function refusals(): Array<{ file: string; line: number; cured: boolean }> {
  const found: Array<{ file: string; line: number; cured: boolean }> = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(rel);
        continue;
      }
      if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
      const lines = read(rel).split("\n");
      lines.forEach((ln, i) => {
        if (!ln.includes("throw new TRPCError(") && !ln.includes("throw new Error(")) return;
        const chunk = lines.slice(i, i + 8).join("\n");
        if (!KURDISH.test(chunk)) return;
        // Two shapes of cure: one written by hand, and the one every
        // vanished record shares (shared/fixAdvice vanishedFix).
        // Three shapes of cure: one written by hand, the one every vanished
        // record shares, and the one for a failure nobody at the screen caused.
        found.push({ file: rel, line: i + 1, cured: /withFix\(|vanishedFix\(|retryFix\(/.test(chunk) });
      });
    }
  };
  walk("server");
  walk("shared");
  return found;
}

/**
 * What is left, so the number can only fall.
 *
 * It began at 135 and the sweep finished on 2026-09-25. The seven that
 * remain are not refusals at all: three charge descriptions in
 * prohibited.router, two "Database not available" in English, a batch
 * lookup in English, and a payment note — each caught only because a
 * Kurdish string sits within eight lines of a throw.
 *
 * Lower it when something else is swept; never raise it. A new refusal
 * written without a cure fails this test, which is the point.
 */
const STILL_UNCURED = 7;

describe("every refusal says how to put it right", () => {
  const all = refusals();

  it("is a number that only goes down", () => {
    const uncured = all.filter((r) => !r.cured);
    expect(
      uncured.length,
      `refusals with no cure:\n${uncured.slice(0, 40).map((r) => `  ${r.file}:${r.line}`).join("\n")}`,
    ).toBeLessThanOrEqual(STILL_UNCURED);
  });

  it("has swept the counter's own screen", () => {
    // Where the boxes are filled, sealed, sent and taken apart again.
    const router = read("server/routers/scanning.router.ts");
    for (const cause of [
      "داخراوە — پاکەتی نوێی تێناکرێت",          // adding to a closed box
      "لە سیستەمدا نییە",                          // a tracking nobody registered
      "لەسەر کڕیارێکی ترە",                        // somebody else's parcel
      "یەک پاکەت لە دوو بۆکسدا نابێت",             // already in another box
      "بەتاڵە — بۆکسێکی بەتاڵ ناداخرێت",           // sealing an empty box
      "هەڵوەشێنراوەتەوە — بۆکسی هەڵوەشێنراوە ناکرێتەوە",
      "تەنها بە دەستی ئادمینە",                    // reopening a sent box
      "هێشتا داخراو نییە",                         // sending an open box
      "گەیەنراوە بە کڕیار",                        // cancelling a delivered box
      "ئیتر بەتاڵ نییە",                           // deleting a box that filled up
    ]) {
      const at = router.indexOf(cause);
      expect(at, `no refusal says: ${cause}`).toBeGreaterThan(-1);
      expect(router.slice(Math.max(0, at - 400), at), `${cause} has no cure`).toContain("withFix(");
    }
  });

  it("has swept the money door", () => {
    const money = read("server/db/boxSettlement.db.ts");
    for (const cause of [
      "بەبێ هۆکار تۆمار ناکرێت",                  // a discount with no reason
      "بەبێ نرخی دۆلار",                          // dinars with no rate
      "یەک ناگرێتەوە",                            // short or over, unexplained
      "لەسەر ئۆردەرەکەیەتی",                      // an order's price
      "پێشتر هەڵوەشێنراوەتەوە",                   // undoing a receipt twice
    ]) {
      const at = money.indexOf(cause);
      expect(at, `no refusal says: ${cause}`).toBeGreaterThan(-1);
      expect(money.slice(Math.max(0, at - 500), at), `${cause} has no cure`).toContain("withFix(");
    }
  });

  it("has swept the screens goods are entered on", () => {
    const register = read("server/routers/packages.router.ts");
    for (const cause of [
      "دەبێت بزانرێت لە کام کۆگاوە",              // no warehouse
      "دوو تۆمار بۆ یەک پاکەت",                    // a tracking twice
      "هی یەک کڕیار نین",                          // linked orders of two customers
    ]) {
      const at = register.indexOf(cause);
      expect(at, `no refusal says: ${cause}`).toBeGreaterThan(-1);
      expect(register.slice(Math.max(0, at - 400), at), `${cause} has no cure`).toContain("withFix(");
    }

    for (const file of ["server/routers/batches.router.ts", "server/db/batches.db.ts"]) {
      const src = read(file);
      const at = src.indexOf("پێشتر بەکارهاتووە");
      expect(at, `${file}: no duplicate-code refusal`).toBeGreaterThan(-1);
      expect(src.slice(Math.max(0, at - 400), at), `${file} has no cure`).toContain("withFix(");
    }
  });

  it("has one cure for a record that is simply not there", () => {
    // "Box not found" told somebody looking straight at the box's code that
    // it was not there. Written once (vanishedFix), used everywhere.
    const lib = read("shared/fixAdvice.ts");
    expect(lib).toContain("export function vanishedFix(");
    expect(lib).toContain("سەبەتەی خاوێنکردنەوە");
    expect(all.filter((r) => r.cured).length).toBeGreaterThan(100);
  });

  it("and one for a failure nobody at the screen caused", () => {
    const lib = read("shared/fixAdvice.ts");
    expect(lib).toContain("export function retryFix(");
    // "Contact the administrator" is not a step; copying the report is.
    expect(lib).toContain("کۆپیکردنی وردەکاری");
  });

  it("writes them in the shape the screens can print", () => {
    // Belt and braces on the lib itself: the steps must survive as lines.
    const sample = read("server/routers/scanning.router.ts");
    expect(sample).toMatch(/import \{[^}]*withFix[^}]*\} from "@shared\/fixAdvice";/);
    expect(hasFix("a\n\nچۆن چارەسەری بکەیت:\n1. b")).toBe(true);
  });
});

describe("and the screens can show one", () => {
  it("routes a cured failure to the window, and everything else to the toast", () => {
    const hook = read("client/src/hooks/useFailure.ts");
    expect(hook).toContain("hasFix(message)");
    expect(hook).toContain("systemAlert({");
    expect(hook).toContain("showErrorToast(err, options?.fallback);");
    // And the report can be copied from either.
    expect(hook).toContain("copyText: buildErrorReport(err),");
  });

  it("prints the steps as steps in that window, with a copy button", () => {
    const alert = read("client/src/components/SystemAlert.tsx");
    expect(alert).toContain('<p className="whitespace-pre-line">{current.message}</p>');
    expect(alert).toContain('data-testid="system-alert-copy"');
  });

  it("leaves room in a toast for a cure, everywhere in the app at once", () => {
    // 141 call sites show a failure with toast.error(err.message). The clamp
    // was three lines — one more than the cause and none for the steps.
    const toaster = read("client/src/components/ui/sonner.tsx");
    expect(toaster).toContain("line-clamp-[14] whitespace-pre-line");
  });

  it("is used by the screens the swept refusals arrive on", () => {
    for (const screen of [
      "client/src/components/delivery/BoxDetailPanel.tsx",
      "client/src/components/delivery/EmptyBoxes.tsx",
    ]) {
      const src = read(screen);
      expect(src, screen).toContain('import { useFailure } from "@/hooks/useFailure";');
      expect(src, screen).toContain("const showFailure = useFailure();");
      // …and no longer throws the message away in a two-line toast.
      expect(src, screen).not.toContain("onError: (err) => toast.error(err.message),");
    }
  });
});
