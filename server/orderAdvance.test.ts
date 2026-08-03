import { describe, it, expect } from 'vitest';
import { orderAdvancePaidUsd } from '../shared/orderAdvance';

/**
 * This figure is subtracted from what a customer owes at the delivery box, so
 * every wrong kilo of it is money the company does not collect. The tests are
 * written around the two production reports that produced this rule.
 */

describe('full_package — the reported bug', () => {
  it('does not treat the delivery charge as a payment', () => {
    // The exact shape of the report: never paid an advance, but charged
    // $374.65 at batch delivery, which was written to paidFromBalanceUsd and
    // then credited back at the box.
    const order = {
      orderType: 'full_package',
      advancePaidUsd: '0',
      paidFromBalanceUsd: '374.65',
      isPrepaid: false,
    };

    expect(orderAdvancePaidUsd(order)).toBe(0);
  });

  it('credits a real advance', () => {
    expect(orderAdvancePaidUsd({ orderType: 'full_package', advancePaidUsd: '100' })).toBe(100);
  });

  it('credits the advance only, never the advance plus the charge', () => {
    const order = {
      orderType: 'full_package',
      advancePaidUsd: '100',
      paidFromBalanceUsd: '500',
    };

    expect(orderAdvancePaidUsd(order)).toBe(100);
  });

  it('treats purchase_request the same way', () => {
    expect(orderAdvancePaidUsd({
      orderType: 'purchase_request',
      advancePaidUsd: '0',
      paidFromBalanceUsd: '250',
    })).toBe(0);
  });
});

describe('commission — the earlier report, still fixed', () => {
  it('does not treat the delivery charge as a payment', () => {
    expect(orderAdvancePaidUsd({
      orderType: 'commission',
      advancePaidUsd: '0',
      paidFromBalanceUsd: '300',
      isPrepaid: false,
    })).toBe(0);
  });

  it('credits a real advance', () => {
    expect(orderAdvancePaidUsd({ orderType: 'commission', advancePaidUsd: '50' })).toBe(50);
  });

  it('honours a legacy prepaid order, where the wallet really was charged', () => {
    // createCommissionOrder took the money at creation and is the only writer
    // of isPrepaid, so for these rows the billed column IS the payment.
    expect(orderAdvancePaidUsd({
      orderType: 'commission',
      advancePaidUsd: '0',
      paidFromBalanceUsd: '80',
      isPrepaid: true,
    })).toBe(80);
  });

  it('takes the larger when a legacy order also carries an advance', () => {
    // Never the sum: the two columns describe the same money from different
    // angles, and adding them would credit it twice.
    expect(orderAdvancePaidUsd({
      orderType: 'commission',
      advancePaidUsd: '120',
      paidFromBalanceUsd: '80',
      isPrepaid: true,
    })).toBe(120);
  });
});

describe('what counts as money', () => {
  it('reads blank, null and nonsense as nothing paid', () => {
    for (const v of ['', '   ', null, undefined, 'abc', NaN]) {
      expect(orderAdvancePaidUsd({ orderType: 'full_package', advancePaidUsd: v as string }), String(v)).toBe(0);
    }
  });

  it('refuses a negative advance rather than crediting it', () => {
    // A negative would hand the customer money nobody ever received.
    expect(orderAdvancePaidUsd({ orderType: 'full_package', advancePaidUsd: '-50' })).toBe(0);
  });

  it('accepts a number as readily as a string', () => {
    expect(orderAdvancePaidUsd({ orderType: 'full_package', advancePaidUsd: 75.5 })).toBe(75.5);
  });
});

describe('order types it knows nothing about', () => {
  it('credits nothing rather than guessing', () => {
    expect(orderAdvancePaidUsd({
      orderType: 'something_new',
      advancePaidUsd: '100',
      paidFromBalanceUsd: '200',
      isPrepaid: true,
    })).toBe(0);
  });
});
