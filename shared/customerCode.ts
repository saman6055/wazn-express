/**
 * Splitting a customer code into the part that identifies and the part that
 * explains.
 *
 * The stored code is `AZ047(Lubna Hikmat Dawood)` — an identifier with the
 * name folded into it. That is fine in a wide table and useless in a narrow
 * tile: a grid of them truncates to "AZ08…", "AZ19…", "AZ21…", which is a
 * list of codes that cannot be told apart, on a screen whose only job is
 * telling them apart.
 *
 * So the two halves are separated wherever space is short: the code reads at
 * a glance, the name goes underneath in small type or into a tooltip.
 *
 * A code with no bracket — hand-typed, or from before the convention — comes
 * back whole as the code with no name, which is the honest answer rather
 * than an empty tile.
 */

export interface SplitCustomerCode {
  /** `AZ047`. What identifies the customer. */
  code: string;
  /** `Lubna Hikmat Dawood`, or empty when the code carries no name. */
  name: string;
}

export function splitCustomerCode(customerCode: string | null | undefined): SplitCustomerCode {
  const raw = (customerCode ?? "").trim();
  if (!raw) return { code: "", name: "" };

  const open = raw.indexOf("(");
  if (open === -1) return { code: raw, name: "" };

  const close = raw.lastIndexOf(")");
  const code = raw.slice(0, open).trim();
  // An unclosed bracket takes everything after it rather than dropping the
  // name entirely; a truncated row is still worth reading.
  const name = (close > open ? raw.slice(open + 1, close) : raw.slice(open + 1)).trim();

  // `(Lubna)` with nothing before it: the bracket was all there was.
  return code ? { code, name } : { code: raw, name: "" };
}

/** Just the identifying half, for somewhere with room for one line. */
export function customerCodeOnly(customerCode: string | null | undefined): string {
  return splitCustomerCode(customerCode).code;
}
