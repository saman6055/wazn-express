import { describe, it, expect } from 'vitest';
import { missingMeasurements, isMeasured, missingMeasurementMessage } from '../shared/measurementGuard';

/**
 * This guard refuses a save, so the tests are written from the refusal side:
 * what must go through matters as much as what must be blocked. A false
 * refusal strands a real parcel at the counter.
 */

const air = (over: Record<string, unknown> = {}) =>
  ({ shippingType: 'air_regular' as const, ...over });
const sea = (over: Record<string, unknown> = {}) =>
  ({ shippingType: 'sea' as const, ...over });

describe('air — billed on chargeable weight, so it needs both sides of that comparison', () => {
  it('accepts a parcel with weight and dimensions', () => {
    expect(missingMeasurements(air({ weightKg: '12.4', lengthCm: '40', widthCm: '30', heightCm: '25' }))).toEqual([]);
  });

  it('refuses a parcel with nothing filled in', () => {
    expect(missingMeasurements(air())).toEqual(['weight', 'dimensions']);
  });

  it('refuses weight alone — a light bulky carton would bill as though it were small', () => {
    expect(missingMeasurements(air({ weightKg: '12.4' }))).toEqual(['dimensions']);
  });

  it('refuses dimensions alone', () => {
    expect(missingMeasurements(air({ lengthCm: '40', widthCm: '30', heightCm: '25' }))).toEqual(['weight']);
  });

  it('accepts weight plus a volume that was entered directly', () => {
    // The sides are only ever a means of getting the volume; if it is already
    // known there is nothing to insist on.
    expect(missingMeasurements(air({ weightKg: '12.4', volumeCbm: '0.030' }))).toEqual([]);
  });

  it('refuses a partial set of sides', () => {
    expect(missingMeasurements(air({ weightKg: '5', lengthCm: '40', widthCm: '30' }))).toEqual(['dimensions']);
  });

  it('treats air_irregular exactly like air_regular', () => {
    expect(missingMeasurements({ shippingType: 'air_irregular', weightKg: '5' })).toEqual(['dimensions']);
  });
});

describe('sea — billed on volume, so volume is all it must have', () => {
  it('accepts a CBM typed straight in', () => {
    expect(missingMeasurements(sea({ volumeCbm: '0.096' }))).toEqual([]);
  });

  it('accepts sides it can derive the volume from', () => {
    expect(missingMeasurements(sea({ lengthCm: '60', widthCm: '40', heightCm: '40' }))).toEqual([]);
  });

  it('refuses a parcel with neither', () => {
    expect(missingMeasurements(sea())).toEqual(['volume']);
  });

  it('does not demand a weight it will never bill on', () => {
    expect(missingMeasurements(sea({ volumeCbm: '0.5' }))).toEqual([]);
  });
});

describe('what counts as a filled-in number', () => {
  it('rejects zero, blank, whitespace and nonsense as not measured', () => {
    for (const v of ['0', '', '   ', 'abc', null, undefined, '-3', 0, -1, NaN]) {
      expect(missingMeasurements(air({ weightKg: v, lengthCm: '40', widthCm: '30', heightCm: '25' })), String(v))
        .toEqual(['weight']);
    }
  });

  it('accepts a number as well as a string', () => {
    expect(missingMeasurements(air({ weightKg: 12.4, lengthCm: 40, widthCm: 30, heightCm: 25 }))).toEqual([]);
  });

  it('accepts a very small but real measurement', () => {
    expect(missingMeasurements(sea({ volumeCbm: '0.001' }))).toEqual([]);
  });
});

describe('isMeasured', () => {
  it('agrees with missingMeasurements', () => {
    expect(isMeasured(air({ weightKg: '5', lengthCm: '1', widthCm: '1', heightCm: '1' }))).toBe(true);
    expect(isMeasured(air())).toBe(false);
    expect(isMeasured(sea({ volumeCbm: '0.2' }))).toBe(true);
    expect(isMeasured(sea())).toBe(false);
  });
});

describe('missingMeasurementMessage', () => {
  it('names what is missing in both languages', () => {
    const msg = missingMeasurementMessage(['weight', 'dimensions']);

    expect(msg).toContain('کێش');
    expect(msg).toContain('weight');
    expect(msg).toContain('dimensions');
  });

  it('says why, not just what — the operator needs a reason to go and weigh it', () => {
    expect(missingMeasurementMessage(['volume'])).toContain('باچ');
  });
});
