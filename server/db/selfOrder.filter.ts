import { and, eq, isNull, isNotNull, SQL } from "drizzle-orm";
import { packages } from "../../drizzle/schema";

/**
 * The self-order rule as a database condition.
 *
 * The same rule as `isSelfOrder` in ../lib/selfOrder.ts, expressed for a
 * query. Both exist because one runs over a row already in memory and the
 * other has to filter in SQL — but there is exactly one rule, and every reader
 * imports it from here rather than writing the three clauses out again.
 *
 * Writing them out again is the failure this guards against: the self-order
 * report and the customer portal must always agree about which box is whose
 * purchase, or the money report and what the customer sees stop matching.
 */
export function selfOrderConditions(): SQL[] {
  return [
    // No purchase order behind it. Set the moment an order claims the parcel's
    // tracking number (see lib/orderBacklink.ts), which is what makes a parcel
    // stop being a self order on its own.
    isNull(packages.fullPackageOrderId),
    isNotNull(packages.customerId),
    eq(packages.isUnclaimed, false),
  ];
}

/** The rule as a single `where` expression. */
export function selfOrderWhere(...extra: SQL[]) {
  return and(...selfOrderConditions(), ...extra);
}
