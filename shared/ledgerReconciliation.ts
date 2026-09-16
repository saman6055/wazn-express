/**
 * The whole-system money check the owner asked for (ledger audit, 2026-09-16):
 * which customers' accounts are wrong, why, and by how much — read from the
 * data, never written to it.
 *
 * The SQL lives in server/db/ledgerReconciliation.db.ts; the judgements it
 * makes about each row live here, pure, so they can be tested without a
 * database and cannot quietly differ between the screen and the copy.
 */

const cents = (value: number | string | null | undefined): number => {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const dollars = (c: number): number => c / 100;

/** An account whose running balance is not what its rows add up to. */
export interface DriftRow {
  customerId: number;
  customerCode: string;
  customerName: string | null;
  storedBalanceUsd: number;
  ledgerBalanceUsd: number;
  driftUsd: number;
}

/**
 * An order carton a box receipt charged as an ordinary parcel, while the
 * order carries its own charge for the same goods (box-money defect 1).
 */
export interface CartonChargeRow {
  customerId: number;
  customerCode: string;
  customerName: string | null;
  boxCode: string;
  trackingNumber: string | null;
  packageId: number;
  /** What the box posted against the parcel, net of corrections. */
  boxChargeUsd: number;
  orderCodes: string;
  /** What the orders on this carton already carry: goods and freight, net of corrections. */
  orderChargesUsd: number;
  /** The part charged twice. */
  overchargeUsd: number;
}

/** A reversed box receipt, judged against its payment record and the row that undid it. */
export interface BoxReversalRow {
  customerId: number;
  customerCode: string;
  customerName: string | null;
  settlementNumber: string;
  boxCode: string | null;
  paidUsd: number;
  discountUsd: number;
  /** Still counted as collected by the payment record (receipts undone before d38aec5). */
  stillCountedUsd: number;
  /** Put back on the balance twice — at the box and from the payments list. */
  doubleReversedUsd: number;
}

/** Freight posted against an order id that is also another customer's parcel in a box. */
export interface FreightCollisionRow {
  ledgerTransactionId: number;
  customerId: number;
  customerCode: string;
  orderCode: string | null;
  referenceId: number;
  amountUsd: number;
  otherCustomerCode: string;
  otherBoxCode: string;
}

/** Parcels whose box asks for money the customer's account has not been told about. */
export interface NotOnAccountRow {
  customerId: number;
  customerCode: string;
  customerName: string | null;
  boxes: number;
  parcels: number;
  totalUsd: number;
}

/** A parcel whose box price is not what the account charged for it. */
export interface PriceMismatchRow {
  customerId: number;
  customerCode: string;
  boxCode: string;
  trackingNumber: string | null;
  packageId: number;
  boxPriceUsd: number;
  ledgerChargeUsd: number;
  differenceUsd: number;
}

export interface LedgerReconciliation {
  generatedAt: string;
  accountsChecked: number;
  drift: DriftRow[];
  doubleChargedCartons: CartonChargeRow[];
  boxReversals: BoxReversalRow[];
  freightCollisions: FreightCollisionRow[];
  notOnAccount: NotOnAccountRow[];
  priceMismatches: PriceMismatchRow[];
  /** Lists are capped for the screen; the totals always count everything. */
  totals: {
    driftAccounts: number;
    driftUsd: number;
    doubleChargedCartons: number;
    overchargeUsd: number;
    stillCountedReceipts: number;
    stillCountedUsd: number;
    doubleReversedReceipts: number;
    doubleReversedUsd: number;
    freightCollisions: number;
    notOnAccountParcels: number;
    notOnAccountUsd: number;
    priceMismatches: number;
  };
  truncated: boolean;
}

/**
 * What a reversed box receipt still gets wrong.
 *
 * Before d38aec5 undoing a receipt put paid + discount back on the balance
 * and never touched the payment record, so the record still counts the
 * payment as collected; and if the payment had also been undone from the
 * payments list, the balance went up twice. Since d38aec5 the reversal marks
 * the record (its reversalTransactionId is the reversal row) and only puts
 * back what the list had not.
 */
export function judgeBoxReversal(input: {
  paidUsd: number | string | null;
  discountUsd: number | string | null;
  record: { reversedAmountUsd: number | string | null; reversalTransactionId: number | null } | null;
  reversalRow: { id: number; amountUsd: number | string | null } | null;
}): { stillCountedUsd: number; doubleReversedUsd: number } {
  const paid = cents(input.paidUsd);
  const discount = cents(input.discountUsd);
  const putBack = input.reversalRow ? cents(input.reversalRow.amountUsd) : 0;
  const recorded = input.record ? cents(input.record.reversedAmountUsd) : 0;
  const markedByBox =
    !!input.record && !!input.reversalRow && input.record.reversalTransactionId === input.reversalRow.id;
  // What the payments list undid: all of the record's reversal, unless the box
  // wrote it — then everything beyond what the box itself put back.
  const fromList = markedByBox ? recorded - Math.max(0, putBack - discount) : recorded;
  return {
    stillCountedUsd: input.record ? dollars(Math.max(0, paid - recorded)) : 0,
    doubleReversedUsd: dollars(Math.max(0, putBack + fromList - (paid + discount))),
  };
}

/** The part of a carton charged twice: never more than either charge. */
export function cartonOverchargeUsd(boxChargeUsd: number | string | null, orderChargesUsd: number | string | null): number {
  return dollars(Math.max(0, Math.min(cents(boxChargeUsd), cents(orderChargesUsd))));
}

/** The report as plain text, to paste into a message. Latin digits only. */
export function reconciliationText(report: LedgerReconciliation): string {
  const usd = (n: number) => `$${n.toFixed(2)}`;
  const t = report.totals;
  const lines = [
    `Ledger reconciliation — ${report.generatedAt}`,
    `Accounts checked: ${report.accountsChecked}`,
    `Balance drift: ${t.driftAccounts} accounts, ${usd(t.driftUsd)}`,
    `Order cartons charged twice at the box: ${t.doubleChargedCartons}, ${usd(t.overchargeUsd)}`,
    `Reversed receipts still counted as paid: ${t.stillCountedReceipts}, ${usd(t.stillCountedUsd)}`,
    `Receipts put back twice: ${t.doubleReversedReceipts}, ${usd(t.doubleReversedUsd)}`,
    `Freight rows colliding with another customer's parcel: ${t.freightCollisions}`,
    `Box parcels not on the account yet: ${t.notOnAccountParcels}, ${usd(t.notOnAccountUsd)}`,
    `Box price differs from the account's charge: ${t.priceMismatches}`,
  ];
  for (const r of report.drift) lines.push(`drift ${r.customerCode}: stored ${usd(r.storedBalanceUsd)} rows ${usd(r.ledgerBalanceUsd)} (${usd(r.driftUsd)})`);
  for (const r of report.doubleChargedCartons) lines.push(`carton ${r.customerCode} ${r.boxCode} ${r.trackingNumber ?? r.packageId}: box ${usd(r.boxChargeUsd)} orders ${r.orderCodes} ${usd(r.orderChargesUsd)} → twice ${usd(r.overchargeUsd)}`);
  for (const r of report.boxReversals) lines.push(`receipt ${r.customerCode} ${r.settlementNumber}: still counted ${usd(r.stillCountedUsd)}, put back twice ${usd(r.doubleReversedUsd)}`);
  for (const r of report.freightCollisions) lines.push(`freight #${r.ledgerTransactionId} ${r.customerCode} ${r.orderCode ?? r.referenceId} ${usd(r.amountUsd)} ↔ ${r.otherCustomerCode} ${r.otherBoxCode}`);
  for (const r of report.notOnAccount) lines.push(`not on account ${r.customerCode}: ${r.parcels} parcels in ${r.boxes} boxes, ${usd(r.totalUsd)}`);
  for (const r of report.priceMismatches) lines.push(`price ${r.customerCode} ${r.boxCode} ${r.trackingNumber ?? r.packageId}: box ${usd(r.boxPriceUsd)} account ${usd(r.ledgerChargeUsd)}`);
  if (report.truncated) lines.push("(lists capped — totals count everything)");
  return lines.join("\n");
}
