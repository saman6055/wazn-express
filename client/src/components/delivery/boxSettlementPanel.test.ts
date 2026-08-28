import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The screen where money is taken.
 *
 * The rule it is built around, in the owner's own words: a box is $900, $900
 * comes back, and no fuss is needed — everything goes in as it stands. So
 * what is guarded here is mostly what the screen does NOT do on the ordinary
 * day, and that every exception insists on a reason on the days that are not
 * that one.
 */

const ROOT = path.join(__dirname, "..", "..", "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const panel = read("client/src/components/delivery/BoxSettlementPanel.tsx");
const detail = read("client/src/components/delivery/BoxDetailPanel.tsx");
const page = read("client/src/pages/CustomerDeliveryScanner.tsx");

function slice(src: string, start: string, end: string, label: string): string {
  const a = src.indexOf(start);
  expect(a, `${label}: start marker not found`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `${label}: end marker not found after start`).toBeGreaterThan(a);
  const body = src.slice(a, b);
  expect(body.length, `${label}: slice is empty`).toBeGreaterThan(30);
  return body;
}

describe("the ordinary day is one press", () => {
  it("treats an empty amount box as paying in full", () => {
    // Nothing typed means the customer paid what was asked. Making the
    // operator type 900 to say "he gave me 900" is the fuss the owner
    // objected to.
    expect(panel).toContain("const nothingEntered = !iqd && !usd");
    expect(panel).toContain("nothingEntered ? totals.dueUsd : paidUsd");
  });

  it("sends the full amount when nothing was typed", () => {
    // The screen showing "paid in full" and the mutation sending zero would
    // be the worst possible version of this.
    const submit = slice(panel, "const submit = () =>", "};", "submit");
    expect(submit).toContain("nothingEntered ? totals.dueUsd");
  });

  it("pre-fills the dollar rate from the last receipt", () => {
    // The dollar sits still for a week at a time; typing it every box is
    // typing for nothing.
    expect(panel).toContain("data?.lastExchangeRate");
    expect(panel).toContain("setRate(String(data.lastExchangeRate))");
  });

  it("asks for no reason when the money is exact", () => {
    expect(panel).toContain('difference.kind === "none"');
    expect(panel).toContain('data-testid="settle-exact"');
  });

  it("shows the amount on the button, so it is read before it is pressed", () => {
    const button = slice(panel, 'data-testid="settle-open-confirm"', "</Button>", "settle button");
    expect(button).toContain("money(totals.dueUsd)");
  });
});

describe("the exceptions are there, and each one costs a reason", () => {
  it("cannot be submitted while a required reason is blank", () => {
    expect(panel).toContain("const needsReason = difference.reasonRequired && !differenceReason.trim()");
    expect(panel).toContain("const canSettle = !blocked && !needsReason");
  });

  it("offers the discount the way it is actually given — on the box", () => {
    // Nobody forgives $4.13 on parcel three. They say make it 880, or make
    // the kilo ten.
    for (const mode of ["newTotal", "amount", "perKg"]) {
      expect(panel, `${mode} is missing from the discount modes`).toContain(`value="${mode}"`);
    }
  });

  it("makes short money either a debt or a write-off, never a shrug", () => {
    expect(panel).toContain('data-testid="settle-short-as"');
    expect(panel).toContain('value="debt"');
    expect(panel).toContain('value="discount"');
  });

  it("says what happens to money over, without asking anything", () => {
    // Credit needs no decision: it sits on the balance and comes off the
    // next box.
    expect(panel).toContain('difference.kind === "credit"');
    expect(panel).toContain("دەبێتە کریدیت لەسەر کڕیار");
  });

  it("lets a disputed parcel be set aside rather than blocking the rest", () => {
    expect(panel).toContain('data-testid={`settle-hold-${line.packageId}`}');
    expect(panel).toContain("const toggleHold");
  });
});

describe("nothing on this screen is a second opinion about the money", () => {
  it("computes every figure with the same functions the server writes with", () => {
    // The screen showing one total and the server saving another is the
    // single worst failure available here.
    const imports = slice(panel, "  settlementTotals,", '} from "@shared/boxSettlement"', "shared import");
    for (const fn of ["settlementTotals", "differenceOf", "boxDiscountUsd", "allocateBoxDiscount"]) {
      expect(imports, `${fn} must come from the shared rule, not be recomputed here`).toContain(fn);
    }
    // And no second opinion alongside them.
    expect(panel, "the due total must not be summed locally")
      .not.toMatch(/reduce\(\([^)]*\)\s*=>\s*[a-z]+\s*\+\s*[a-z.]*charged/i);
  });

  it("reads it all back before writing anything", () => {
    // Box is the exit door. The numbers get one last look at full size.
    expect(panel).toContain("setConfirmOpen(true)");
    expect(panel).toContain('data-testid="settle-confirm"');
  });

  it("raises a refusal as a blocking alert, not a toast", () => {
    // A refusal at the money door has to be read, not glimpsed.
    const onError = slice(
      panel,
      "const settle = trpc.deliveryBox.settle.useMutation",
      "const reverse = trpc.deliveryBox.reverseSettlement",
      "settle mutation",
    );
    expect(onError).toContain("systemAlert({");
    expect(onError).toContain('kind: "error"');
    expect(onError, "a refusal at the money door must not be a corner toast")
      .not.toContain("toast.error(");
  });

  it("warns loudly about parcels that have never been charged", () => {
    expect(panel).toContain("notChargedYet");
    expect(panel).toContain("const blocked = notCharged.length > 0");
  });
});

describe("a saved receipt is corrected, never edited", () => {
  it("offers a reversal on each confirmed receipt", () => {
    expect(panel).toContain('data-testid={`settlement-reverse-${s.id}`}');
  });

  it("will not reverse without at least a few words of reason", () => {
    expect(panel).toContain("reversalReason.trim().length < 3");
  });

  it("tells the operator why the row is not simply deleted", () => {
    // The printed copy is in the customer's hands.
    expect(panel).toContain("وەسڵەکەی لە دەستی کڕیاردایە");
  });

  it("shows a reversed receipt as reversed rather than hiding it", () => {
    expect(panel).toContain('s.status === "reversed"');
  });
});

describe("every word is in all four languages", () => {
  it("uses pickLang rather than one hard-coded language", () => {
    expect(panel).toContain('import { pickLang } from "@/lib/lang"');
  });

  it("gives every label all four", () => {
    // A screen half-translated is a screen that reads as broken to whoever
    // gets the other half.
    // Every `ku:` must be followed by its three siblings before the next one
    // starts. Matching whole objects is unreliable — a label containing a
    // template literal carries its own braces.
    const starts = [...panel.matchAll(/ku:\s/g)].map((m) => m.index!);
    expect(starts.length, "no translated labels found at all").toBeGreaterThan(20);
    for (let i = 0; i < starts.length; i++) {
      const next = i + 1 < starts.length ? starts[i + 1]! : panel.length;
      const text = panel.slice(starts[i]!, next);
      for (const lang of ["en:", "ar:", "zh:"]) {
        expect(text.includes(lang), `a label is missing ${lang} — ${text.slice(0, 70)}`).toBe(true);
      }
    }
  });

  it("shows the receipt's own currency figures left to right", () => {
    // Codes and amounts are not words; RTL would reorder them.
    expect(panel).toContain('dir="ltr"');
  });
});

/**
 * Where it sits, after the owner opened the delivery screen and found
 * everything unrolled onto it at once: the codes, the box, and the money all
 * stacked down one page.
 *
 * So a box is now opened INTO — its own window — and inside that window the
 * contents and the money are two tabs rather than one long scroll.
 */
describe("it is opened into, not unrolled underneath", () => {
  it("lives behind the money tab of the box window", () => {
    expect(page).toContain('<TabsTrigger value="money"');
    expect(page).toContain("<BoxSettlementPanel");
  });

  it("is not stacked under the box contents any more", () => {
    expect(detail, "the settlement panel must not be inside the box detail card")
      .not.toContain("<BoxSettlementPanel");
  });

  it("opens the box as its own window rather than in the page flow", () => {
    const body = slice(page, "activeBoxId !== null", "</Dialog>", "box window");
    expect(body).toContain("<DialogContent");
    expect(body).toContain("<BoxDetailPanel");
  });

  it("refreshes the list when money moves", () => {
    expect(page).toContain("onSettled={() => { refetchBoxes(); }}");
  });
});
