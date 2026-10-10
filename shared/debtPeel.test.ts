import { describe, expect, it } from "vitest";
import { accountSums, chargeStory, storyTotal, type AccountRow } from "./boxPaidStillOwed";

/**
 * The owner, 2026-10-10, on the card that explains a debt: whatever he
 * presses should give the complete, exact detail - any figure, "peeled like
 * an onion". Each figure is given the rows of the account it was added up
 * from; these are the two sums behind that, and they must come to the cent.
 */
const row = (id: number, type: string, usd: number, description = "", extra: Partial<AccountRow> = {}): AccountRow & { createdAt: string } => ({
  id,
  transactionNumber: `TXN-${id}`,
  transactionType: type,
  amountUsd: usd,
  balanceAfterUsd: 0,
  description,
  referenceId: null,
  createdAt: `2026-10-0${(id % 9) + 1}T09:00:00.000Z`,
  ...extra,
});

describe("how one owed thing came to its amount", () => {
  const rows = [
    row(1, "DEBIT_COMMISSION", 95, "Shoes CM-1"),
    row(2, "DEBIT_PACKAGE", 12, "another parcel"),
    row(3, "ADJUSTMENT_CREDIT", 10, "price put right [ADJ:TXN-1]"),
    row(4, "ADJUSTMENT_DEBIT", 2.01, "freight added [ADJ:TXN-1]"),
    row(5, "ADJUSTMENT_CREDIT", 5, "about the other one [ADJ:TXN-2]"),
    row(6, "CREDIT_PAYMENT", 20, "cash"),
  ];

  it("is its charge and every correction that names it - nothing else", () => {
    const story = chargeStory(rows, [1]);
    expect(story.map((l) => [l.id, l.kind, l.usd])).toEqual([
      [1, "charge", 95],
      [3, "takenOff", -10],
      [4, "raised", 2.01],
    ]);
  });

  it("comes to what the charge stands at, to the cent", () => {
    expect(storyTotal(chargeStory(rows, [1]))).toBe(87.01);
    expect(storyTotal(chargeStory(rows, [2]))).toBe(7);
  });

  it("an order written in two rows shows both", () => {
    expect(chargeStory(rows, [1, 2]).filter((l) => l.kind === "charge").map((l) => l.id)).toEqual([1, 2]);
    expect(storyTotal(chargeStory(rows, [1, 2]))).toBe(94.01);
  });

  it("says when each row was written and by what number", () => {
    const [first] = chargeStory(rows, [1]);
    expect(first.transactionNumber).toBe("TXN-1");
    expect(first.at).toBe("2026-10-02T09:00:00.000Z");
  });

  it("a payment is never a line of a charge", () => {
    expect(chargeStory(rows, [1]).some((l) => l.id === 6)).toBe(false);
  });
});

describe("the whole account in five sums", () => {
  const rows = [
    row(1, "DEBIT_COMMISSION", 95),
    row(2, "DEBIT_PACKAGE", 60.36),
    row(3, "DEBIT_PACKAGE", 60.36, "BOX-20260910-001 — YT1"),
    row(4, "ADJUSTMENT_CREDIT", 7.99, "[ADJ:TXN-1]"),
    row(5, "CREDIT_PAYMENT", 60.36, "BOX-20260910-001"),
    row(6, "CREDIT_DISCOUNT", 0),
  ];

  it("come to the balance on the account", () => {
    const sums = accountSums(rows, 147.37);
    expect(sums).toMatchObject({ chargedUsd: 215.72, chargedCount: 3, takenOffUsd: 7.99, paidUsd: 60.36, paidCount: 1, computedUsd: 147.37, differenceUsd: 0, rows: 6 });
  });

  it("say so when the balance and the rows disagree, and by how much", () => {
    expect(accountSums(rows, 150).differenceUsd).toBe(2.63);
  });

  it("do not drift by a cent over many rows", () => {
    const many = Array.from({ length: 300 }, (_, i) => row(i + 1, "DEBIT_PACKAGE", 0.1));
    expect(accountSums(many, 30).computedUsd).toBe(30);
    expect(accountSums(many, 30).differenceUsd).toBe(0);
  });

  it("an empty account is nothing", () => {
    expect(accountSums([], 0)).toMatchObject({ chargedUsd: 0, paidUsd: 0, computedUsd: 0, differenceUsd: 0, rows: 0 });
  });
});
