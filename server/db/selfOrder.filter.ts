import { and, eq, gte, isNull, isNotNull, sql, SQL } from "drizzle-orm";
import { packages, fullPackageOrders, fullPackageOrderTrackings } from "../../drizzle/schema";
import { SELF_ORDER_FROM } from "../lib/selfOrder";

/**
 * The self-order rule as a database condition.
 *
 * The same rule as `isSelfOrder` in ../lib/selfOrder.ts, expressed for a
 * query. Both exist because one runs over a row already in memory and the
 * other has to filter in SQL — but there is exactly one rule, and every reader
 * imports it from here rather than writing the clauses out again.
 *
 * Writing them out again is the failure this guards against: the self-order
 * report and the customer portal must always agree about which box is whose
 * purchase, or the money report and what the customer sees stop matching.
 *
 * ---
 *
 * The rule used to be "packages.fullPackageOrderId IS NULL" and nothing else,
 * and that was the wrong question. It asks whether somebody remembered to
 * write a link, not whether the parcel has an order. Those came apart over and
 * over: an order recording its tracking in the multi-tracking table instead of
 * its own column, an edit that set the tracking without triggering the
 * backlink, a parcel registered through a path that never looked. Each time,
 * a parcel with a perfectly good order number sat in the customer's portal
 * under "goods I bought myself" while the admin screen showed its buy price,
 * its sell price and its profit.
 *
 * So it asks the real question now: **does any order in the system claim this
 * tracking number?** That cannot fall out of step, because there is nothing to
 * maintain — no mirror column, no code path that has to remember. An order
 * entered a year late stops the parcel being a self order the moment it is
 * saved, wherever it recorded the tracking.
 *
 * Both places an order can record one are checked. Both columns are indexed
 * (`idx_fpo_tracking_number`, `idx_fpot_tracking_number`), so this stays a
 * lookup rather than a scan.
 */

/** Does any order claim this parcel's tracking number? */
function noOrderClaimsTheTracking(): SQL {
  return sql`
    ${packages.trackingNumber} IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM ${fullPackageOrders}
      WHERE ${fullPackageOrders.trackingNumber} = ${packages.trackingNumber}
    )
    AND NOT EXISTS (
      SELECT 1 FROM ${fullPackageOrderTrackings}
      WHERE ${fullPackageOrderTrackings.trackingNumber} = ${packages.trackingNumber}
    )
  `;
}

export function selfOrderConditions(): SQL[] {
  return [
    // The link, when it has been written. Kept because it is the cheapest
    // possible "no" and it catches an order that claims a parcel by something
    // other than the tracking number.
    isNull(packages.fullPackageOrderId),
    // And the real question, which needs nobody to have remembered anything.
    noOrderClaimsTheTracking(),
    isNotNull(packages.customerId),
    eq(packages.isUnclaimed, false),
    // Only from the day the feature existed. The constant lives beside the
    // in-memory rule so both draw the line on the same day — see
    // SELF_ORDER_FROM in ../lib/selfOrder.ts for why there is a line at all.
    gte(packages.registeredAt, SELF_ORDER_FROM),
  ];
}

/** The rule as a single `where` expression. */
export function selfOrderWhere(...extra: SQL[]) {
  return and(...selfOrderConditions(), ...extra);
}
