import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A discount given on a receipt is the same discount everywhere.
 *
 * The owner, 2026-09-24: "add a discount to the receipt printing, in dollars,
 * in step with the dinar rate chosen above. The box payment screen must be in
 * step with it too … and the reason for the discount must be written." Then:
 * "the discount at receipt printing is fixed in the box payment. You cannot
 * lower it — only raise it." And: "it must be possible for the receipt to
 * carry a discount on one particular tracking as well … it must exist as
 * data."
 *
 * Four places have to agree, so each is checked against the one shared rule
 * (shared/pledgedDiscount) rather than against each other.
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

const dialog = read("client/src/components/delivery/ReceiptDinarDialog.tsx");
const boxPanel = read("client/src/components/delivery/BoxDetailPanel.tsx");
const settle = read("client/src/components/delivery/BoxSettlementPanel.tsx");
const print = read("client/src/lib/deliveryBoxPrintUtils.ts");
const quick = read("client/src/components/delivery/QuickSettleDialog.tsx");

/** A slice that matched nothing checks nothing — so it is checked. */
function slice(source: string, from: string, to: string, what: string): string {
  const start = source.indexOf(from);
  expect(start, `${what}: "${from}" not found`).toBeGreaterThan(-1);
  const end = source.indexOf(to, start + from.length);
  expect(end, `${what}: "${to}" not found`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("the window before printing", () => {
  it("asks for dollars, a reason, and what the discount is for", () => {
    expect(dialog).toContain('data-testid="receipt-discount-amount"');
    expect(dialog).toContain('data-testid="receipt-discount-reason"');
    expect(dialog).toContain('data-testid="receipt-discount-target"');
    // The six reasons come from the one place that defines them.
    expect(dialog).toContain('import { DISCOUNT_REASON_LABELS, REASON_NEEDS_TEXT, type DiscountReason } from "@shared/boxSettlement";');
  });

  it("will not print a discount whose reason nobody chose", () => {
    // The reason is printed on the paper; a default would quietly put the
    // wrong one there.
    expect(dialog).toContain('const [discountReason, setDiscountReason] = useState<DiscountReason | "">("");');
    expect(dialog).toContain("const reasonMissing = cutUsd > 0 && !discountReason;");
    expect(dialog).toContain("disabled={blocked}");
  });

  it("converts it with the very rate and rounding chosen above it", () => {
    const sums = slice(dialog, "const canDiscount =", "const parcels =", "the dialog's arithmetic");
    expect(sums).toContain("receiptDinar(netUsd, input)");
    // The discount's own dinars are the difference between the two rounded
    // totals, so the lines on the paper add up by hand at any rounding.
    expect(sums).toContain("roundDinars(grossUsd * input.rate, step, mode) - roundDinars(netUsd * input.rate, step, mode)");
  });

  it("opens at what an earlier printing promised and will not go below it", () => {
    expect(dialog).toContain('import { pledgeFloors, type DiscountPledge } from "@shared/pledgedDiscount";');
    expect(dialog).toContain("const belowPledge = floorUsd > 0 && cutUsd + 0.004 < floorUsd;");
    expect(dialog).toContain("const blocked = reasonMissing || noteMissing || belowPledge;");
  });

  it("does not offer one on a box with nothing left to settle", () => {
    expect(dialog).toContain("const canDiscount = request?.canDiscount !== false;");
    expect(boxPanel).toContain("canDiscount: settlementDueUsd > 0,");
  });
});

describe("the promise is written down before the paper exists", () => {
  it("records it, and prints nothing if that fails", () => {
    const flow = slice(boxPanel, "const printWithPledge = async", "const handlePrintReceipt", "printWithPledge");
    expect(flow).toContain("await pledgeDiscount.mutateAsync(");
    expect(flow).toContain("lineId: given.lineId,");
    // The refusal is read before anything is printed, not after.
    const stop = flow.indexOf("return;");
    const output = flow.indexOf("await output(");
    expect(stop).toBeGreaterThan(-1);
    expect(output).toBeGreaterThan(stop);
  });

  it("goes to the server, which keeps it as data", () => {
    const router = read("server/routers/scanning.router.ts");
    expect(router).toContain("pledgeDiscount: staffProcedure");
    expect(router).toContain("return db.pledgeBoxDiscount(input, ctx.user.id);");
    const schema = read("drizzle/schema/finance.schema.ts");
    expect(schema).toContain('export const boxDiscountPledges = mysqlTable("boxDiscountPledges"');
    // A table only drizzle knows about does not exist on a new deployment.
    expect(read("server/_core/migrations.ts")).toContain("CREATE TABLE IF NOT EXISTS boxDiscountPledges");
  });
});

describe("the receipt", () => {
  it("prints the discount with the reason it was given for", () => {
    expect(print).toContain("discountReason?: string | null;");
    const row = slice(print, 't("delivery.discount")', "afterDiscount", "the receipt's discount row");
    expect(row).toContain("escapeHtml(settlement.discountReason)");
  });

  it("says the same thing on the copy that is saved and the one that is sent", () => {
    // Every path builds the settlement the same way, from one function.
    expect(boxPanel).toContain("settlement: { ...settlementForPrint, ...receiptDiscount(lang, given) },");
    expect(boxPanel).toContain("settlement: { ...settlementForPrint, ...discounted },");
    expect(print).toContain("settlement: options?.settlement,");
  });

  it("names the tracking when the discount was given on one parcel", () => {
    expect(boxPanel).toContain('import { pledgeLabel } from "@shared/pledgedDiscount";');
    expect(boxPanel).toContain("discountReason: source ? pledgeLabel(source, words) : null,");
  });

  it("quotes the discounted figure in the WhatsApp message too", () => {
    expect(boxPanel).toContain("const totalUsd = receiptAmountUsd(box, discounted);");
  });
});

describe("the payment screen", () => {
  it("opens with what the receipt promised already filled in", () => {
    expect(settle).toContain('import { pledgeFloors, pledgeBreaches, pledgeRefusal, reasonText, wholeBoxName } from "@shared/pledgedDiscount";');
    const fill = slice(settle, "const filledRef = useRef", "const boxCut =", "the pre-fill");
    expect(fill).toContain("setDiscountValue((v) => (Number(v) >= floors.boxUsd ? v : String(floors.boxUsd)));");
    expect(fill).toContain('next[lineId] = { amount: String(usd), reason: promised?.reason ?? "other", note: promised?.note ?? null };');
    // A refetch bringing back the same promises must not undo an edit made
    // since; the fill happens once per distinct set.
    expect(fill).toContain("filledRef.current === pledgeKey");
  });

  it("refuses to settle for less than was promised, and says how to fix it", () => {
    const submit = slice(settle, "const submit = () => {", "settle.mutate({", "the submit guard");
    expect(submit).toContain("if (breaches.length > 0)");
    expect(submit).toContain("message: pledgeRefusal(breaches,");
  });

  it("shows which discounts came off a printed receipt", () => {
    expect(settle).toContain('data-testid="settle-pledged"');
    expect(settle).toContain('data-testid={`settle-pledged-${line.lineId}`}');
  });
});

describe("the one-press payment screen", () => {
  /**
   * The owner, 2026-09-24, with a screenshot of this dialog: "the box
   * payment is supposed to remember the discount made on the receipt and
   * confirm it was given — there is no news of it there at all … it should
   * be added in the box payment too. And show the reason there as well."
   *
   * It settled with no intents and one bare lineId per parcel, so the
   * promise was invisible — and after the pledge rule landed, unsettleable
   * from here at all.
   */
  it("takes the promised discount off the figure it asks for", () => {
    expect(quick).toContain('import { pledgeFloors, reasonText } from "@shared/pledgedDiscount";');
    expect(quick).toContain("const totals = useMemo(() => settlementTotals(parcels, intents), [parcels, intents]);");
  });

  it("says it was given, on what, and why", () => {
    expect(quick).toContain('data-testid="quick-pledged"');
    expect(quick).toContain("why: reasonText(p,");
  });

  it("sends each promise on the thing it was promised on", () => {
    // A promise made on one parcel is not kept by a discount spread over
    // all of them — the receipt named that parcel.
    const submit = slice(quick, "const submit = () => {", "const boxReason", "the quick submit");
    expect(submit).toContain("const cut = floors.byLine.get(p.lineId) ?? 0;");
    expect(submit).toContain("boxDiscount: floors.boxUsd > 0 ? { mode: \"amount\" as const, value: floors.boxUsd } : undefined,");
    expect(submit).toContain("discountNote:");
  });
});

describe("a reason that is not on the list", () => {
  it("is written out, and nothing prints until it is", () => {
    expect(dialog).toContain('data-testid="receipt-discount-note"');
    expect(dialog).toContain("const noteMissing = cutUsd > 0 && discountReason === REASON_NEEDS_TEXT && !discountNote.trim();");
    expect(dialog).toContain("const blocked = reasonMissing || noteMissing || belowPledge;");
  });

  it("is what the paper and the screens then say, instead of \"Other\"", () => {
    const shared = read("shared/pledgedDiscount.ts");
    expect(shared).toContain("export function reasonText(");
    // A reason written by hand is what comes back, before the list's own name.
    expect(shared).toContain("if (written) return written;");
    expect(boxPanel).toContain("note: given.note,");
  });

  it("travels with the money, not only with the promise", () => {
    expect(boxPanel).toContain("note: given.note ?? undefined,");
    expect(settle).toContain("discountNote: lineDiscounts[p.lineId]?.note ?? undefined,");
  });
});

describe("the reasons themselves", () => {
  it("live in one place, and the screens and the router read it", () => {
    const shared = read("shared/boxSettlement.ts");
    for (const reason of ["missing", "wrong_item", "agreed", "bulk"]) {
      expect(shared, reason).toContain(`${reason}: { ku:`);
    }
    // Three screens used to keep their own copy of the same six words.
    expect(read("client/src/components/delivery/DiscountReport.tsx")).toContain("const REASON_LABELS = DISCOUNT_REASON_LABELS;");
    expect(settle).toContain("const REASON_LABELS = DISCOUNT_REASON_LABELS;");
    expect(read("server/routers/scanning.router.ts")).toContain("z.enum(DISCOUNT_REASONS)");
  });

  it("widen the columns that store them, on a database that already has rows", () => {
    // MySQL refuses an unknown enum value with "Data truncated", which names
    // neither the value nor the column that mattered.
    const migrations = read("server/_core/migrations.ts");
    expect(migrations).toContain('name: "boxSettlementLines.discountReason.more"');
    expect(migrations).toContain('name: "boxDiscountPledges.reason.more"');
    expect(migrations).toContain("'damaged','missing','wrong_item','late','goodwill','loyal','agreed','bulk','rounding','other'");
  });
});

describe("and the server does not take the screen's word for it", () => {
  const db = read("server/db/boxSettlement.db.ts");

  it("reads the open promises and refuses a settlement that breaks one", () => {
    const check = slice(db, "const openPledges = await getOpenPledges(input.boxId);", "const now = new Date();", "the settlement guard");
    expect(check).toContain("pledgeBreaches(floors,");
    expect(check).toContain("throw new Error(pledgeRefusal(breaches, \"ku\"));");
  });

  it("marks them kept inside the same transaction as the money", () => {
    const mark = slice(db, "// The promises this receipt kept.", "return { settlementId, settlementNumber", "honouring");
    expect(mark).toContain(".update(boxDiscountPledges)");
    expect(mark).toContain("set({ settlementId, honouredAt: now })");
  });

  it("opens them again when the receipt is reversed", () => {
    const undo = slice(db, "The promises this receipt had kept are open again.", "appLogger.info(\"[BoxSettlement] reversed\"", "reversal");
    expect(undo).toContain("set({ settlementId: null, honouredAt: null })");
  });

  it("refuses to lower a promise at the moment it is made", () => {
    const write = slice(db, "export async function pledgeBoxDiscount", "export interface SettlementLineInput", "pledgeBoxDiscount");
    expect(write).toContain("if (shortOfPledge(current, usd) > 0)");
    expect(write).toContain("throw new Error(lowerPledgeRefusal(");
    // Append-only: a promise is never edited away.
    expect(write).not.toContain(".delete(");
  });
});
