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
  it("the found order is under the box that found it", () => {
    // The customer joined the tracking inside one card on 2026-09-29, so the
    // order card is no longer between them — it is under both, which is where
    // it was always meant to be: the answer beneath the question.
    const tracking = at('{t("quickRegister.stepTracking")}');
    const customer = at('{t("quickRegister.stepCustomer")}');
    const order = at('className="md:col-span-5 border-2 border-indigo-200');
    expect(customer).toBeGreaterThan(tracking);
    expect(order).toBeGreaterThan(customer);
  });

  it("the tracking and the customer share one frame", () => {
    // Owner, 2026-09-29: «ئەو دووانە لە چوارچێوەی یەک کارتدا بن». Two borders
    // and two headings for two short fields was twice the height of one job.
    const card = page.slice(
      at('<Card className="md:col-span-5 border bg-card'),
      at('{/* Tracking Info Display */}'),
    );
    expect(card).toContain('{t("quickRegister.stepTracking")}');
    expect(card).toContain('{t("quickRegister.stepCustomer")}');
    expect(card).toContain("md:grid-cols-2");
  });

  it("the steps keep their own order", () => {
    // The weight left this list on 2026-09-29 — it is on the bottom bar now,
    // which is why its label appears after everything else in the file. What
    // still has to hold is that the customer comes before the measuring.
    expect(at('{t("quickRegister.stepCustomer")}')).toBeLessThan(at('{t("quickRegister.stepDimensions")}'));
    // On the bar the weight is labelled plainly: the step heading carries its
    // own number and unit ("3. kilos (kg)") and beside a box that already
    // prints kg would say it twice. The phone card is a step card and keeps
    // the heading.
    const barOnly = page.slice(at("<StickyFormBar>"), at("</StickyFormBar>"));
    expect(barOnly).not.toContain('{t("quickRegister.stepWeight")}');
  });

  it("the side column is the warehouse, then the photos", () => {
    const side = at('className="lg:col-span-1 min-w-0 space-y-3"');
    const photos = at('className="border-2 border-sky-200 dark:border-sky-900/60');
    expect(photos).toBeGreaterThan(side);
    // The register button is no longer a card here — it is the bar below.
    expect(page).not.toContain("lg:sticky lg:top-4 border-2 border-primary/30");
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
    // Greyed while a correction is open (2026-10-05) — the size is the same.
    expect(page).toContain('className={cn("font-mono text-base h-11 flex-1", correcting && "bg-muted text-muted-foreground")}');
    // The customer takes the whole row since the weight moved to the bar.
    expect(page).toContain('md:col-span-5 border bg-card');  // customer
    expect(page).not.toContain('md:col-span-2 border bg-card');  // the old weight box
    expect(page).toContain('grid grid-cols-2 sm:grid-cols-4 gap-2');
    expect(page).not.toContain("h-14 text-xl font-mono font-bold text-center");
  });

  it("the prohibited strip sits just above the tracking box", () => {
    const prohibited = at("کەلوپەلی قەدەغە");
    expect(prohibited).toBeGreaterThan(at('<h1 className="text-lg font-bold'));
    expect(prohibited).toBeLessThan(at('{t("quickRegister.stepTracking")}'));
  });

  it("register and clear are the form's own bar, as the buy-at-cost form has", () => {
    // Owner, 2026-09-23: "look at the buy-at-cost form — at the bottom Save
    // and Cancel are fixed. That one is very nice."
    expect(page).toContain('import { StickyFormBar } from "@/components/forms/sticky-form-bar";');
    expect(page).toContain("<StickyFormBar>");
    const bar = page.slice(at("<StickyFormBar>"), at("</StickyFormBar>"));
    expect(bar).toContain('type="submit"');
    expect(bar).toContain("onClick={clearAllForm}");
    expect(bar).toContain('{t("quickRegister.estimatedPrice")}');
    // And it is after everything, not inside a column.
    expect(at("<StickyFormBar>")).toBeGreaterThan(at('className="lg:col-span-1 min-w-0 space-y-3"'));
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
    // `!correcting` since 2026-10-05: while the last registration is open for
    // correction this card would say "registered ✓" beside the very form
    // that is changing it.
    expect(page).toContain("{!foundOrder?.found && lastRegistered && customerId && !correcting && (");
    const card = page.slice(
      at("{!foundOrder?.found && lastRegistered && customerId && !correcting && ("),
      at('{/* Row 2.5: Dimensions'),
    );
    expect(card).toContain("lastRegistered.packageCode");
    expect(card).toContain("customerOrderProgress && customerOrderProgress.total > 0");
    expect(card).toContain("پاکێجی تری ئەم کڕیارە چاوەڕوانە");
    expect(card).toContain("تراکی دواتر داخڵ بکە");
  });
});

/**
 * One screen, 2026-09-29.
 *
 * Measured before anything changed: a successful scan grew the page by 557px
 * and pushed the weight box from 469px to 914px — off a 694px screen, at the
 * moment it was wanted. The owner: «دیسان تۆماری خێرامان بە دڵ نیە».
 *
 * Three things answer it, and each is here so it cannot quietly come undone.
 */
describe("the whole job on one screen", () => {
  const bar = page.slice(at("<StickyFormBar>"), at("</StickyFormBar>"));

  it("the weight is on the bar on a desktop, and in the flow on a phone", () => {
    // Owner, 2026-09-29: «بۆ مۆبایل کێش هەر لە جێگای خۆی بێت». A phone's
    // bottom edge already carries the tab bar and the two round buttons.
    expect(bar).toContain('data-testid="qr-bar-weight"');
    expect(bar).toContain("{!isMobile && (");
    expect(page).toContain("{isMobile && (");
    // Two boxes in the source, never two in the page: one is rendered.
    expect((page.match(/ref=\{weightRef\}/g) ?? []).length).toBe(2);
    expect(page).toContain("const isMobile = useIsMobile();");
  });

  it("the bar repeats nothing the screen already says", () => {
    /*
     * It briefly carried the chargeable weight and the customer's code.
     * The owner, seeing both: «پسوولە و کۆد زیادەیە، چ سوودێکی هەیە؟» — and he
     * was right. The chargeable weight has its own amber panel under the
     * three sides that produce it, and the customer sits two lines up in
     * step 2, locked by the scan. A bar that repeats the screen is a bar
     * nobody reads.
     */
    expect(bar).not.toContain("billedDiffers");
    expect(bar).not.toContain("{ownerCode}");
    expect(page).not.toContain("const ownerCode");
    // Sea is billed by volume outright, and that figure is on no other line.
    expect(bar).toContain('shippingType === "sea" && cbm > 0');
    // The rate behind the price — the multiplier, not the number it
    // multiplies, which is in the weight box beside it.
    expect(bar).toContain("{priceWorking}");
    expect(page).toContain("`× ${Number(estimate.rate).toFixed(2)}`");
  });

  it("the bar shouts when a parcel has no owner", () => {
    // The one state somebody must come back and fix, and the one that is
    // easy to commit without noticing.
    expect(bar).toContain('data-testid="qr-bar-owner"');
    expect(bar).toContain("بێ خاوەن");
    expect(bar).toContain("{isUnclaimed && (");
  });

  it("the tracking hands the caret to the kilos, however it was entered", () => {
    // Owner, 2026-09-29: «پاش تراک ئەبێ ماوس خۆی یەکسەر بێتە سەر کیلۆ، ئەوێ
    // گلۆ بکات». It used to happen only when a scanner sent its own Enter,
    // because the weight box was mid-page and jumping to it scrolled away
    // what had been scanned. On the bar there is nothing to scroll.
    expect(page).toContain("const focusWeight = useCallback(() => {");
    expect(page).not.toContain("if (!silent) setTimeout(");
    // And the handover is seen, not guessed.
    expect(page).toContain("setWeightGlow(true);");
    expect(page).toContain('weightGlow && "ring-4 ring-emerald-400/70 border-emerald-500"');
  });

  it("a measured parcel with no price says why", () => {
    expect(bar).toContain("باچ نرخی نییە");
  });

  it("the order's paperwork is folded, with the number that matters on the fold", () => {
    expect(page).toContain("<details className=\"group rounded-xl border border-indigo-100");
    expect(page).toContain("وردەکاری داواکاری");
    // Still to come is on the summary line itself, read without opening it.
    const summary = page.slice(at("<summary className=\"flex cursor-pointer"), at("</summary>"));
    expect(summary).toContain("customerOrderProgress.remaining");
    // "everything has arrived" is a cue to act, not a detail: it stays out.
    expect(at("customerOrderProgress?.allRegistered && customerOrderProgress.total > 0")).toBeGreaterThan(at("</details>"));
  });

  it("photographs are in one card, on the side", () => {
    const sideStart = at('className="lg:col-span-1 min-w-0 space-y-3"');
    const orderPhoto = at("وێنەی داواکاری");
    expect(orderPhoto).toBeGreaterThan(sideStart);
    // And gone from the order card. The pre-declaration card below it keeps
    // its own stack: those are the customer's photographs of what they
    // ordered, and that card exists to say who declared it.
    const orderCard = page.slice(
      at('className="md:col-span-5 border-2 border-indigo-200'),
      at("{/* What was just registered, and what is still coming."),
    );
    expect(orderCard).not.toContain("<PhotoStack");
  });

  it("the no-owner button says what pressing it does", () => {
    expect(page).toContain("تۆماری پاکەتی بێ ناو");
    expect(page).toContain('data-testid="qr-unclaimed"');
    expect(page).toContain("aria-pressed={isUnclaimed}");
  });
});

/**
 * What the scanned order shows (owner, 2026-10-05) — inside the frames that
 * were already there: «پێکهاتەی تۆماری خێرا زۆر ڕێکە، شکل و شێوەی دەستکاری
 * مەکە».
 */
describe("the scanned order, at a glance", () => {
  it("the photograph is shown whole, and a click still opens it", () => {
    // It was made to fill a wide, short box, so a tall product photo showed
    // as one blurred stripe of itself.
    const card = page.slice(at("وێنەی داواکاری"), at("وێنەی گەیشتن"));
    expect(card).toContain('fit="contain"');
    const stack = fs.readFileSync(path.join(__dirname, "components", "PhotoStack.tsx"), "utf8");
    expect(stack).toContain('fit === "contain" ? "object-contain" : "object-cover"');
    // The default stays a cropped square: every row thumbnail relies on it.
    expect(stack).toContain('fit = "cover"');
  });

  it("says how many pieces the tracking carries, across every order sharing it", () => {
    expect(page).toContain("trackingOrders.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0)");
    expect(page).toContain('data-testid="qr-tracking-pieces"');
    expect(page).toContain("{trackingPieces > 1 && (");
  });

  it("does not claim a count it cannot know", () => {
    // An order sent in several cartons has its pieces spread over them, and
    // nothing recorded says how many are in this one.
    expect(page).toContain("trackingCartons > 1");
    expect(page).toContain("پارچە لە ${trackingCartons} کارتۆن");
  });

  it("names the shop and the shop's own order number beside it", () => {
    const header = page.slice(at('data-testid="qr-tracking-pieces"'), at("The paperwork, folded."));
    expect(header).toContain("<PlatformChip key={name} platform={name}");
    expect(header).toContain("<OrderNumbers numbers={trackingOrderNumbers}");
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
