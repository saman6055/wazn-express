import { describe, it, expect } from 'vitest';
import {
  classifyBacklinkCandidate,
  isTerminalOrderStatus,
  type BacklinkPackage,
  type BacklinkLink,
} from './lib/orderBacklink';

/**
 * The scenario these rules exist for:
 *
 *   Goods are bought at cost but nobody enters the order. The box reaches the
 *   China warehouse carrying only a customer code, so staff quick-register it.
 *   The purchase order is created afterwards, with the same tracking number.
 *
 * Before this module the parcel stayed unlinked, which made it a self order in
 * every report — the same box counted once as shipping revenue and once as
 * order profit — and the order never advanced past `tracking_added`.
 */

const ORDER_ID = 77;
const CUSTOMER_ID = 5;

function pkg(over: Partial<BacklinkPackage> = {}): BacklinkPackage {
  return {
    customerId: CUSTOMER_ID,
    isCharged: false,
    status: 'registered',
    fullPackageOrderId: null,
    ...over,
  };
}

function classify(p: BacklinkPackage, existingLinks: BacklinkLink[] = []) {
  return classifyBacklinkCandidate({
    pkg: p,
    orderId: ORDER_ID,
    orderCustomerId: CUSTOMER_ID,
    existingLinks,
  });
}

describe('classifyBacklinkCandidate — the parcel that arrived before its order', () => {
  it('adopts a quick-registered parcel and makes it the primary link', () => {
    // Exactly the reported case: same customer, nothing settled, no links yet.
    expect(classify(pkg())).toEqual({ action: 'link', isPrimary: true });
  });

  it('still links a parcel already moving through the pipeline', () => {
    // The order can be entered days late, by which time the box may be in a
    // batch or in transit. Only money and hand-over close the door.
    for (const status of ['in_batch', 'in_transit', 'customs_processing', 'ready_for_delivery', 'out_for_delivery']) {
      expect(classify(pkg({ status })), status).toEqual({ action: 'link', isPrimary: true });
    }
  });
});

describe('classifyBacklinkCandidate — refuses to guess', () => {
  it('never links a parcel belonging to a different customer', () => {
    // Linking here would charge one customer for goods another takes home.
    expect(classify(pkg({ customerId: 999 }))).toEqual({
      action: 'conflict',
      reason: 'customer_mismatch',
    });
  });

  it('never claims an unclaimed parcel', () => {
    // Assigning an owner is a deliberate staff action, not a side effect of
    // typing a tracking number.
    expect(classify(pkg({ customerId: null }))).toEqual({
      action: 'conflict',
      reason: 'unclaimed',
    });
  });

  it('never re-attributes a parcel that has already been charged', () => {
    expect(classify(pkg({ isCharged: true }))).toEqual({
      action: 'conflict',
      reason: 'finance_closed',
    });
  });

  it('never re-attributes a parcel that has left our hands', () => {
    for (const status of ['delivered', 'returned', 'cancelled']) {
      expect(classify(pkg({ status })), status).toEqual({
        action: 'conflict',
        reason: 'finance_closed',
      });
    }
  });

  it('reports a customer mismatch even when the parcel is also settled', () => {
    // Ownership is checked before money on purpose: a mismatch is a data error
    // somebody must look at, and calling it `finance_closed` would send staff
    // chasing the wrong problem.
    expect(classify(pkg({ customerId: 999, isCharged: true, status: 'delivered' }))).toEqual({
      action: 'conflict',
      reason: 'customer_mismatch',
    });
  });
});

describe('classifyBacklinkCandidate — idempotence', () => {
  it('does nothing when the join table already records this link', () => {
    expect(classify(pkg(), [{ fullPackageOrderId: ORDER_ID, isPrimary: true }])).toEqual({
      action: 'skip',
    });
  });

  it('does nothing when only the legacy FK records this link', () => {
    // Older rows predate the join table; both spellings mean "already linked".
    expect(classify(pkg({ fullPackageOrderId: ORDER_ID }))).toEqual({ action: 'skip' });
  });

  it('skips an already-linked parcel even after it is delivered and charged', () => {
    // Re-running must stay a no-op forever. If the settled check ran first, a
    // second call would report a conflict about a link it wrote itself.
    expect(
      classify(
        pkg({ isCharged: true, status: 'delivered', fullPackageOrderId: ORDER_ID }),
        [{ fullPackageOrderId: ORDER_ID, isPrimary: true }],
      ),
    ).toEqual({ action: 'skip' });
  });
});

describe('classifyBacklinkCandidate — one carton, several orders', () => {
  it('links to a second order without stealing primary from the first', () => {
    // The legacy FK holds exactly one order id. Overwriting it would silently
    // repoint every code path that still reads only that column.
    expect(
      classify(pkg({ fullPackageOrderId: 42 }), [{ fullPackageOrderId: 42, isPrimary: true }]),
    ).toEqual({ action: 'link', isPrimary: false });
  });

  it('takes primary when existing links somehow have none', () => {
    expect(
      classify(pkg(), [{ fullPackageOrderId: 42, isPrimary: false }]),
    ).toEqual({ action: 'link', isPrimary: true });
  });

  it('treats a set legacy FK as primary already taken, links table or not', () => {
    expect(classify(pkg({ fullPackageOrderId: 42 }))).toEqual({ action: 'link', isPrimary: false });
  });
});

describe('isTerminalOrderStatus', () => {
  it('closes the door on finished and abandoned orders', () => {
    for (const s of ['delivered', 'cancelled', 'refunded', 'returned']) {
      expect(isTerminalOrderStatus(s), s).toBe(true);
    }
  });

  it('leaves every live order open to adoption', () => {
    // `tracking_added` above all — that is precisely where an order stalls
    // when its parcel was registered first.
    for (const s of ['pending', 'approved', 'ordered', 'tracking_added', 'in_china_warehouse', 'in_batch', 'in_transit', 'arrived', 'ready_for_delivery']) {
      expect(isTerminalOrderStatus(s), s).toBe(false);
    }
  });
});
