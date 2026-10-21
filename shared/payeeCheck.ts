import { splitCustomerCode } from "./customerCode";

/**
 * Whose money is this?
 *
 * The owner, 2026-10-21: in the box list the «پارەدان» buttons stand row on
 * row, and a press on the row above takes one customer's payment onto
 * another's box. Three guards, all his: payment only from inside the box,
 * the customer's name large on the payment window and on its button, and
 * the digits of the customer's code typed before the money is taken -
 * «AZ303» → 303. The last is checked again on the server
 * (deliveryBox.settle), so no screen can skip it.
 */

/** The digits of a customer code: "AZ303(Sayf Shakhi)" → "303". */
export function payeeDigits(customerCode: string | null | undefined): string {
  return splitCustomerCode(customerCode).code.replace(/\D/g, "");
}

/**
 * The typed number is this customer's: the same digits, leading zeros aside
 * ("1" for AZ001). A customer whose code carries no digits cannot be asked,
 * and is not held up.
 */
export function payeeCodeMatches(customerCode: string | null | undefined, typed: string | null | undefined): boolean {
  const want = payeeDigits(customerCode);
  if (!want) return true;
  const got = String(typed ?? "").replace(/\D/g, "");
  if (!got) return false;
  return Number(got) === Number(want);
}
