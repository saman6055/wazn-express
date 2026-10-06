import { describe, it, expect } from "vitest";
import {
  groupMovements, moneyKind, unseenMovements, unseenCredit, MONEY_KIND_LABEL, type LedgerRowForFeed,
  CHARGE_RESTATED_ACTION, restatedCharge, unseenRestated, type RestatedRecord,
} from "./moneyFeed";

let nextId = 1;
const row = (over: Partial<LedgerRowForFeed> = {}): LedgerRowForFeed => ({
  id: nextId++,
  accountId: 1,
  transactionType: "DEBIT_PACKAGE",
  referenceType: "package",
  amountUsd: "10.00",
  balanceBeforeUsd: "0.00",
  balanceAfterUsd: "10.00",
  description: "پاکەت X",
  createdById: 1,
  createdAt: "2026-10-02T10:00:00.000Z",
  ...over,
});

/**
 * Owner, 2026-10-02: every movement of money reaches the main admin, with
 * where it happened; and a credit is never made without anybody being told.
 */
describe("which kind of movement a ledger row is", () => {
  it("names each type in plain words", () => {
    expect(moneyKind({ transactionType: "CREDIT_PAYMENT", referenceType: "payment" })).toBe("payment");
    expect(moneyKind({ transactionType: "DEBIT_COMMISSION", referenceType: "commission" })).toBe("charge");
    expect(moneyKind({ transactionType: "CREDIT_DISCOUNT", referenceType: "package" })).toBe("discount");
    expect(moneyKind({ transactionType: "ADJUSTMENT_CREDIT", referenceType: "commission" })).toBe("correction_down");
    expect(moneyKind({ transactionType: "ADJUSTMENT_CREDIT", referenceType: "adjustment" })).toBe("hand_down");
    expect(moneyKind({ transactionType: "ADJUSTMENT_DEBIT", referenceType: "adjustment" })).toBe("hand_up");
    expect(moneyKind({ transactionType: "ADJUSTMENT_DEBIT", referenceType: "package" })).toBe("correction_up");
    for (const words of Object.values(MONEY_KIND_LABEL)) expect(words.ku.length).toBeGreaterThan(3);
  });
});

describe("rows written together are one line", () => {
  it("folds a batch's hundred charges for one customer into one, with count and sum", () => {
    nextId = 1;
    const rows = Array.from({ length: 100 }, (_, i) =>
      row({
        amountUsd: "4.00",
        balanceBeforeUsd: String(i * 4),
        balanceAfterUsd: String((i + 1) * 4),
        createdAt: new Date(Date.UTC(2026, 9, 2, 10, 0, i)).toISOString(),
      }));
    const m = groupMovements(rows);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ count: 100, amountUsd: 400, kind: "charge", direction: 1, balanceAfterUsd: 400, id: 100 });
  });

  it("never folds money received or a change made by hand", () => {
    nextId = 1;
    const m = groupMovements([
      row({ transactionType: "CREDIT_PAYMENT", referenceType: "payment", amountUsd: "5", description: "BOX-20260930-001" }),
      row({ transactionType: "CREDIT_PAYMENT", referenceType: "payment", amountUsd: "7", description: "BOX-20260930-002" }),
      row({ transactionType: "ADJUSTMENT_CREDIT", referenceType: "adjustment", amountUsd: "1" }),
      row({ transactionType: "ADJUSTMENT_CREDIT", referenceType: "adjustment", amountUsd: "1" }),
    ]);
    expect(m).toHaveLength(4);
    expect(m[3].boxCode).toBe("BOX-20260930-001");
  });

  it("keeps different customers, people and moments apart", () => {
    nextId = 1;
    expect(groupMovements([row(), row({ accountId: 2 })])).toHaveLength(2);
    expect(groupMovements([row(), row({ createdById: 9 })])).toHaveLength(2);
    expect(groupMovements([row(), row({ createdAt: "2026-10-02T10:05:00.000Z" })])).toHaveLength(2);
  });

  it("is newest first", () => {
    nextId = 1;
    const m = groupMovements([row({ accountId: 1 }), row({ accountId: 2 }), row({ accountId: 3 })]);
    expect(m.map((x) => x.accountId)).toEqual([3, 2, 1]);
  });
});

describe("a credit being made is said out loud", () => {
  it("$200 owed, $300 received: $100 became credit", () => {
    nextId = 1;
    const [m] = groupMovements([
      row({ transactionType: "CREDIT_PAYMENT", referenceType: "payment", amountUsd: "300", balanceBeforeUsd: "200", balanceAfterUsd: "-100" }),
    ]);
    expect(m.creditCreatedUsd).toBe(100);
    expect(m.direction).toBe(-1);
  });

  it("an order cancelled after it was paid for says so too", () => {
    nextId = 1;
    const [m] = groupMovements([
      row({ transactionType: "ADJUSTMENT_CREDIT", referenceType: "commission", amountUsd: "40", balanceBeforeUsd: "0", balanceAfterUsd: "-40" }),
    ]);
    expect(m.kind).toBe("correction_down");
    expect(m.creditCreatedUsd).toBe(40);
  });

  it("paying off a debt, or a credit shrinking, makes none", () => {
    nextId = 1;
    expect(groupMovements([row({ transactionType: "CREDIT_PAYMENT", amountUsd: "50", balanceBeforeUsd: "200", balanceAfterUsd: "150" })])[0].creditCreatedUsd).toBe(0);
    expect(groupMovements([row({ amountUsd: "30", balanceBeforeUsd: "-100", balanceAfterUsd: "-70" })])[0].creditCreatedUsd).toBe(0);
  });

  it("counts what is new since the reader last looked", () => {
    nextId = 1;
    const m = groupMovements([
      row({ accountId: 1 }),
      row({ accountId: 2, transactionType: "CREDIT_PAYMENT", amountUsd: "30", balanceBeforeUsd: "0", balanceAfterUsd: "-30" }),
      row({ accountId: 3 }),
    ]);
    expect(unseenMovements(m, 0)).toBe(3);
    expect(unseenMovements(m, 2)).toBe(1);
    expect(unseenCredit(m, 1)).toBe(true);
    expect(unseenCredit(m, 2)).toBe(false);
  });
});

/*
 * Owner, 2026-10-05: a parcel weighed wrong is put right on its own line, not
 * with a second one. So that movement writes no ledger row - and the bell,
 * which reads rows, would miss it. The record kept with the change is read
 * instead.
 */
describe("a charge put right in place leaves a record, not a row", () => {
  const record = (over: Partial<RestatedRecord> = {}): RestatedRecord => ({
    id: 7,
    userId: 11,
    entityCode: "ZZT-1",
    oldValues: { amountUsd: 165 },
    newValues: { amountUsd: 16.5 },
    metadata: { accountId: 3, balanceBeforeUsd: 165, balanceAfterUsd: 16.5 },
    description: "note",
    createdAt: "2026-10-05T10:00:00.000Z",
    ...over,
  });

  it("reads what it was and what it is", () => {
    expect(restatedCharge(record())).toEqual({
      id: 7, accountId: 3, subject: "ZZT-1", wasUsd: 165, nowUsd: 16.5, direction: -1,
      balanceAfterUsd: 16.5, creditCreatedUsd: 0, createdById: 11,
      at: "2026-10-05T10:00:00.000Z", note: "note",
    });
  });

  it("a raising points the other way", () => {
    const up = restatedCharge(record({ oldValues: { amountUsd: 16.5 }, newValues: { amountUsd: 22 } }));
    expect(up?.direction).toBe(1);
  });

  it("says when it left the account below zero", () => {
    const made = restatedCharge(record({ metadata: { accountId: 3, balanceBeforeUsd: 0, balanceAfterUsd: -148.5 } }));
    expect(made?.creditCreatedUsd).toBe(148.5);
    // Further below zero than it found it - not the whole of what was there.
    const deeper = restatedCharge(record({ metadata: { accountId: 3, balanceBeforeUsd: -10, balanceAfterUsd: -30 } }));
    expect(deeper?.creditCreatedUsd).toBe(20);
  });

  it("reads a JSON column that came back as text", () => {
    const fromText = restatedCharge(record({
      oldValues: '{"amountUsd":165}',
      newValues: '{"amountUsd":"16.50"}',
      metadata: '{"accountId":3}',
    }));
    expect(fromText).toMatchObject({ wasUsd: 165, nowUsd: 16.5, accountId: 3, balanceAfterUsd: null, creditCreatedUsd: 0 });
  });

  it("shows nothing for a record that does not say the figures", () => {
    expect(restatedCharge(record({ oldValues: null }))).toBeNull();
    expect(restatedCharge(record({ newValues: "not json" }))).toBeNull();
    expect(restatedCharge(record({ newValues: {} }))).toBeNull();
  });

  it("counts the ones not looked at yet", () => {
    expect(unseenRestated([{ id: 9 }, { id: 7 }, { id: 3 }], 7)).toBe(1);
    expect(unseenRestated([{ id: 9 }, { id: 7 }], 0)).toBe(2);
    expect(unseenRestated([], 0)).toBe(0);
  });

  it("is kept under a name that must not change: records already written carry it", () => {
    expect(CHARGE_RESTATED_ACTION).toBe("restate_charge");
  });
});
