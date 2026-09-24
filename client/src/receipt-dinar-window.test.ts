import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The window before a box receipt is printed (owner, 2026-09-17).
 *
 * The rules are unit-tested in shared/receiptDinar.test.ts and pinned to the
 * paper in lib/deliveryBoxPrint.test.ts; this pins the window and every way
 * into a receipt.
 *
 * What would undo it: a print path that skips the window, the window saving
 * anything to the box or the account, the advance starting in dollars, or the
 * window previewing a figure the receipt does not print.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");
const readRoot = (p: string) => fs.readFileSync(path.resolve(SRC, "../..", p), "utf8").replace(/\r\n/g, "\n");

const dialog = read("components/delivery/ReceiptDinarDialog.tsx");
const panel = read("components/delivery/BoxDetailPanel.tsx");
const table = read("components/delivery/BoxTable.tsx");

describe("the window", () => {
  it("previews with the same rule the receipt prints with", () => {
    // The discount comes off in dollars and what remains is converted once,
    // so the lines on the paper still add up by hand (owner, 2026-09-24).
    expect(dialog).toContain("const netUsd = Math.round(Math.max(0, grossUsd - cutUsd) * 100) / 100;");
    expect(dialog).toContain("receiptDinar(netUsd, input)");
    expect(dialog).toContain('from "@shared/receiptDinar"');
  });

  it("offers the newer of this device's last rate and the last payment's", () => {
    expect(dialog).toContain("trpc.deliveryBox.lastExchangeRate.useQuery(");
    expect(dialog).toContain("offeredRate(device, payment)");
  });

  it("starts every receipt with the advance empty and in dinars", () => {
    expect(dialog).toContain('useState<AdvanceCurrency>("IQD")');
    expect(dialog).toContain('setCurrency("IQD");');
    expect(dialog).toContain('setAdvance("");');
  });

  it("says when to round and when not: cash to 250, an electronic payment exact", () => {
    // Owner: FIB, Qi, ZainCash, AsiaPay… can pay any amount — one general name.
    expect(dialog).toContain('exact: { ku: "وەک خۆی — پارەدانی ئەلیکترۆنی"');
    expect(dialog).toContain("{mode === \"down\" ? L(TXT.noRemainderHint) : L(TXT.roundingHint)}");
    expect(dialog).toContain('<SelectItem value="1">{L(TXT.exact)}</SelectItem>');
  });

  it("offers dinars without a remainder, and remembers it beside the step", () => {
    // Owner, 2026-09-21: 150,250 is asked for as 150,000.
    expect(dialog).toContain('<SelectItem value={`1000${ROUNDING_DOWN}`}>{L(TXT.noRemainder)}</SelectItem>');
    expect(dialog).toContain("mode, advanceAmount: Number(advance) || null");
    expect(dialog).toContain("rememberChoice({ rate: input.rate, at: Date.now(), step, mode })");
    expect(dialog).toContain("setMode(isMode(saved.mode) ? saved.mode : DEFAULT_DINAR_ROUND_MODE);");
  });

  it("saves nothing: no mutation, and the advance is never remembered", () => {
    expect(dialog).not.toMatch(/useMutation|\.mutate\(/);
    const remembered = dialog.slice(dialog.indexOf("interface Remembered"), dialog.indexOf("function recall"));
    expect(remembered.length).toBeGreaterThan(10);
    expect(remembered).not.toMatch(/advance/i);
  });
});

describe("every way into a receipt goes through it", () => {
  it("the box panel's print and PDF", () => {
    expect(panel).toContain("const handlePrintReceipt = (lang: Language) => askBeforePrinting(lang, printReceiptNow);");
    expect(panel).toContain("const handleDownloadReceiptPDF = (lang: Language) => askBeforePrinting(lang, downloadReceiptNow);");
    expect(panel).toContain("totalUsd: receiptAmountUsd(box, settlementForPrint)");
    expect(panel).toContain("<ReceiptDinarDialog request={receiptRequest}");
    // Every output carries the choice to the paper: print, PDF, and since
    // 2026-09-21 the copy sent to the customer's WhatsApp.
    expect(panel.match(/\n      dinar,\n/g)?.length).toBe(3);
    expect(panel).toContain("const handleSendOnWhatsApp = (format: ReceiptShareFormat, destination: ReceiptShareDestination = \"whatsapp\") =>");
  });

  it("the box list's print", () => {
    expect(table).toContain("totalUsd: receiptAmountUsd(box)");
    expect(table).toContain("onConfirm: (dinar) => void printReceiptNow(box, lang, dinar)");
    expect(table).toContain("company: companyContact(company, lang), dinar }");
    expect(table).toContain("<ReceiptDinarDialog request={receiptRequest}");
  });

  it("a box already paid for opens the window too, at the rate its payment used", () => {
    // Owner, 2026-09-22: a corrected receipt must be priceable in dinars
    // again — it was going out with none, because the window was skipped.
    expect(panel).toContain("rate: settlementForPrint?.exchangeRate ?? null,");
    expect(panel).not.toContain("if (settlementForPrint) {\n      void output(lang, null);");
    expect(read("components/delivery/ReceiptDinarDialog.tsx")).toContain(
      "const offered = Number.isFinite(ownRate) && ownRate > 0 ? ownRate : offeredRate(device, payment);",
    );
    // The box list still prints a cleared box straight off; it has no window.
    expect(table).toContain("if (box.settlementCleared === true) {\n      void printReceiptNow(box, lang, null);");
  });
});

describe("the last payment's rate", () => {
  it("is read in one place, by the payment screen and the window alike", () => {
    const store = readRoot("server/db/boxSettlement.db.ts");
    const start = store.indexOf("export async function getLastSettlementRate");
    expect(start).toBeGreaterThan(-1);
    const fn = store.slice(start, store.indexOf("\n}\n", start));
    expect(fn).not.toMatch(/\.(insert|update|delete)\(/);
    expect(store).toContain("const lastRate = await getLastSettlementRate();");
    expect(readRoot("server/routers/scanning.router.ts")).toContain("return db.getLastSettlementRate();");
  });
});
