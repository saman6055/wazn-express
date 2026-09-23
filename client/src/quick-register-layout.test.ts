import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Quick Register, arranged the way the work actually goes (owner, 2026-09-23).
 *
 * He went through the screen picture by picture: the order card is the most
 * important thing on it and you had to scroll to see it; the summary is the
 * least important and it had the best seat; the photo matters and was at the
 * bottom; Enter matters and was below the fold. The tracking box, the
 * warehouse row, the customer, the weight and the dimensions were right
 * where he wants them and were not to move.
 *
 * What would undo it: the order card drifting back down the page, the
 * summary taking the side column again, or the register button going back
 * inside it.
 */

const page = fs
  .readFileSync(path.join(__dirname, "pages", "QuickRegister.tsx"), "utf8")
  .replace(/\r\n/g, "\n");

const at = (needle: string) => {
  const i = page.indexOf(needle);
  expect(i, needle).toBeGreaterThan(-1);
  return i;
};

describe("what sits where", () => {
  it("the found order is under the tracking box, before the customer step", () => {
    const tracking = at('{t("quickRegister.stepTracking")}');
    const order = at('className="md:col-span-5 border-2 border-indigo-200');
    const customer = at('{t("quickRegister.stepCustomer")}');
    expect(order).toBeGreaterThan(tracking);
    expect(order).toBeLessThan(customer);
  });

  it("the steps keep their own order", () => {
    expect(at('{t("quickRegister.stepCustomer")}')).toBeLessThan(at('{t("quickRegister.stepWeight")}'));
    expect(at('{t("quickRegister.stepWeight")}')).toBeLessThan(at('{t("quickRegister.stepDimensions")}'));
  });

  it("the side column is the warehouse, then the photos, then the register button", () => {
    const side = at('className="lg:col-span-1 min-w-0 space-y-3"');
    const photos = at('className="border-2 border-sky-200 dark:border-sky-900/60');
    const register = at('className="lg:sticky lg:top-4 border-2 border-primary/30');
    expect(photos).toBeGreaterThan(side);
    expect(register).toBeGreaterThan(photos);
  });

  it("neither column can be stretched by one wide child", () => {
    // A grid track is as wide as its widest child unless told otherwise; the
    // long button label was pushing the side column over the form.
    expect(page).toContain('<div className="lg:col-span-2 min-w-0 space-y-3">');
    expect(page).toContain('<div className="lg:col-span-1 min-w-0 space-y-3">');
  });

  it("the boxes are the size of what goes in them", () => {
    // Owner, 2026-09-23: the tracking, the weight and the centimetre row were
    // all far longer than the numbers they hold.
    expect(page).toContain('className="font-mono text-base h-11 flex-1"');
    expect(page).toContain('md:col-span-3 border bg-card');  // customer
    expect(page).toContain('md:col-span-2 border bg-card');  // weight, narrower
    expect(page).toContain('grid grid-cols-2 sm:grid-cols-4 gap-2');
    expect(page).not.toContain("h-14 text-xl font-mono font-bold text-center");
  });

  it("the prohibited strip sits just above the tracking box", () => {
    const prohibited = at("کەلوپەلی قەدەغە");
    expect(prohibited).toBeGreaterThan(at('<h1 className="text-lg font-bold'));
    expect(prohibited).toBeLessThan(at('{t("quickRegister.stepTracking")}'));
  });

  it("the register button is sticky, and no longer buried in the summary", () => {
    expect(page).toContain('<Card className="lg:sticky lg:top-4 border-2 border-primary/30');
    // It is in the side column, not inside the summary card.
    const register = at("{/* Submit Button - Below Summary */}");
    expect(register).toBeGreaterThan(at('className="lg:col-span-1 min-w-0 space-y-3"'));
    const summaryCard = page.slice(page.lastIndexOf("<Card", at('{t("quickRegister.summary")}')), at('className="lg:col-span-1 min-w-0 space-y-3"'));
    expect(summaryCard).not.toContain('type="submit"');
  });

  it("the summary is at the foot of the steps, and sticks to nothing", () => {
    const summary = at('{t("quickRegister.summary")}');
    // After the last step, before the side column starts.
    expect(summary).toBeGreaterThan(at('{t("quickRegister.stepDimensions")}'));
    expect(summary).toBeLessThan(at('className="lg:col-span-1 min-w-0 space-y-3"'));
    const card = page.slice(page.lastIndexOf("<Card", summary), summary);
    expect(card).not.toContain("lg:sticky");
  });

  it("the header is a strip, not a banner", () => {
    expect(page).toContain("rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 px-4 py-2.5");
    expect(page).toContain('<h1 className="text-lg font-bold');
  });
});

describe("after Enter", () => {
  it("the customer stays, with what is still coming, until the next tracking", () => {
    expect(page).toContain("{!foundOrder?.found && lastRegistered && customerId && (");
    const card = page.slice(at("{!foundOrder?.found && lastRegistered && customerId && ("), at('{/* Customer Selection */}'));
    expect(card).toContain("lastRegistered.packageCode");
    expect(card).toContain("customerOrderProgress && customerOrderProgress.total > 0");
    expect(card).toContain("پاکێجی تری ئەم کڕیارە چاوەڕوانە");
    expect(card).toContain("تراکی دواتر داخڵ بکە");
  });
});

describe("the cubic metre", () => {
  it("sits under the three sides and says what it does", () => {
    expect(page).toContain('data-testid="quick-register-direct-cbm"');
    expect(page).toContain("ئەگەر CBM پڕ بکرێتەوە");
    expect(page).toContain("volumeCbm: directCbm || undefined,");
  });

  it("is what the screen's own volumetric weight is worked out from", () => {
    expect(page).toContain("volumetricWeightKg(\n      { lengthCm, widthCm, heightCm, volumeCbm: directCbm },");
  });
});
