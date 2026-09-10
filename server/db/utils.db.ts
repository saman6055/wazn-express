// Shared helper functions (no DB connection)
import { randomInt } from "crypto";

export function generateAccountNumber(customerCode: string): string {
  const year = new Date().getFullYear();
  return `ACC-${customerCode}-${year}`;
}

/**
 * How many random digits follow the date in a ledger or payment number.
 *
 * It was four: ten thousand numbers a day, drawn blind, into a column that
 * must be unique. A box payment that charges twenty parcels draws twenty at
 * once, and later in the day one of them hit a number already used —
 * "Duplicate entry 'TXN-20260910-6269'" — the whole payment rolled back, and
 * the second attempt worked only because it drew again. Twelve digits make a
 * repeat about a hundred million times less likely.
 */
const RANDOM_DIGITS = 12;

function randomDigits(): string {
  return randomInt(0, 10 ** RANDOM_DIGITS).toString().padStart(RANDOM_DIGITS, "0");
}

const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

export function generateTransactionNumber(): string {
  return `TXN-${today()}-${randomDigits()}`;
}

export function generatePaymentNumber(): string {
  return `PAY-${today()}-${randomDigits()}`;
}
