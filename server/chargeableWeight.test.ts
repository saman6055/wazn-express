import { describe, it, expect } from 'vitest';
import {
  chargeableWeight,
  volumetricWeightKg,
  volumeCbm,
  exceedsVolumetricThreshold,
  isAirShipping,
  DEFAULT_VOLUMETRIC_DIVISOR,
} from '../shared/chargeableWeight';

/**
 * This decides what a customer pays, so the tests are written around the case
 * that starts arguments: a 2 kg carton that measures 12 kg by volume.
 */

const bulky = { weightKg: '2', lengthCm: '60', widthCm: '40', heightCm: '30' }; // 72000/6000 = 12 kg
const dense = { weightKg: '20', lengthCm: '30', widthCm: '20', heightCm: '10' }; // 6000/6000 = 1 kg

describe('chargeableWeight — the greater of the two figures', () => {
  it('bills a light bulky carton on its volume', () => {
    const r = chargeableWeight(bulky);

    expect(r.actualKg).toBe(2);
    expect(r.volumetricKg).toBe(12);
    expect(r.chargeableKg).toBe(12);
    expect(r.billedOnVolume).toBe(true);
    expect(r.extraKg).toBe(10);
    expect(r.ratio).toBe(6);
  });

  it('bills a dense parcel on the scale', () => {
    const r = chargeableWeight(dense);

    expect(r.chargeableKg).toBe(20);
    expect(r.billedOnVolume).toBe(false);
    expect(r.extraKg).toBe(0);
  });

  it('does not call a tie "billed on volume" — nothing surprising happened', () => {
    // 30×20×10 = 6000 → exactly 1 kg.
    const r = chargeableWeight({ weightKg: '1', lengthCm: '30', widthCm: '20', heightCm: '10' });

    expect(r.chargeableKg).toBe(1);
    expect(r.billedOnVolume).toBe(false);
    expect(r.ratio).toBe(1);
  });

  it('falls back to the actual weight when dimensions are missing', () => {
    const r = chargeableWeight({ weightKg: '5' });

    expect(r.volumetricKg).toBe(0);
    expect(r.chargeableKg).toBe(5);
    expect(r.billedOnVolume).toBe(false);
  });

  it('ignores a partial set of sides rather than inventing a volume', () => {
    const r = chargeableWeight({ weightKg: '5', lengthCm: '60', widthCm: '40' });

    expect(r.volumetricKg).toBe(0);
    expect(r.chargeableKg).toBe(5);
  });

  it('reports a zero ratio when there is no weight to compare against', () => {
    // Guards the caller from dividing by zero and showing "Infinity×".
    const r = chargeableWeight({ lengthCm: '60', widthCm: '40', heightCm: '30' });

    expect(r.actualKg).toBe(0);
    expect(r.chargeableKg).toBe(12);
    expect(r.ratio).toBe(0);
  });

  it('honours a changed divisor', () => {
    // 72000/5000 = 14.4 — a stricter divisor charges more.
    expect(chargeableWeight(bulky, 5000).chargeableKg).toBeCloseTo(14.4, 5);
  });

  it('falls back to the default when handed a nonsense divisor', () => {
    for (const d of [0, -1, NaN]) {
      expect(chargeableWeight(bulky, d).volumetricKg, String(d)).toBe(12);
    }
  });

  it('treats blank, zero and negative measurements as absent', () => {
    for (const v of ['', '0', '-5', null, undefined, 'abc']) {
      expect(volumetricWeightKg({ lengthCm: v, widthCm: '40', heightCm: '30' }), String(v)).toBe(0);
    }
  });
});

describe('volumeCbm', () => {
  it('converts centimetres to cubic metres', () => {
    expect(volumeCbm({ lengthCm: '100', widthCm: '100', heightCm: '100' })).toBe(1);
    expect(volumeCbm({ lengthCm: '60', widthCm: '40', heightCm: '30' })).toBeCloseTo(0.072, 6);
  });

  it('returns zero when a side is missing', () => {
    expect(volumeCbm({ lengthCm: '60', widthCm: '40' })).toBe(0);
  });
});

describe('exceedsVolumetricThreshold — who gets told before the invoice', () => {
  const rule = { minExtraKg: 3, minRatio: 1.5 };

  it('flags the 2 kg carton that bills as 12 kg', () => {
    expect(exceedsVolumetricThreshold(chargeableWeight(bulky), rule)).toBe(true);
  });

  it('stays quiet for a parcel billed on the scale', () => {
    expect(exceedsVolumetricThreshold(chargeableWeight(dense), rule)).toBe(false);
  });

  it('stays quiet for a tiny envelope, however lopsided the ratio', () => {
    // 0.2 kg measuring 0.6 kg is three times over — and nobody argues over
    // 0.4 kg. The floor is what keeps this from becoming noise.
    const r = chargeableWeight({ weightKg: '0.2', lengthCm: '30', widthCm: '20', heightCm: '6' });

    expect(r.billedOnVolume).toBe(true);
    expect(exceedsVolumetricThreshold(r, rule)).toBe(false);
  });

  it('stays quiet when a heavy parcel is only nudged past by its volume', () => {
    // 40 kg billed as 45: five extra kilos, but only 1.125× — expected on a
    // large consignment and not worth a message.
    const r = chargeableWeight({ weightKg: '40', lengthCm: '90', widthCm: '50', heightCm: '60' });

    expect(r.extraKg).toBeGreaterThan(rule.minExtraKg);
    expect(exceedsVolumetricThreshold(r, rule)).toBe(false);
  });

  it('needs both conditions, never just one', () => {
    const r = chargeableWeight(bulky);

    expect(exceedsVolumetricThreshold(r, { minExtraKg: 100, minRatio: 1.5 })).toBe(false);
    expect(exceedsVolumetricThreshold(r, { minExtraKg: 3, minRatio: 99 })).toBe(false);
  });

  it('never flags a parcel with no weight on record', () => {
    // Nothing to compare, so nothing to explain to the customer.
    const r = chargeableWeight({ lengthCm: '60', widthCm: '40', heightCm: '30' });

    expect(exceedsVolumetricThreshold(r, rule)).toBe(false);
  });
});

describe('isAirShipping', () => {
  it('covers both air routes and excludes sea', () => {
    expect(isAirShipping('air_regular')).toBe(true);
    expect(isAirShipping('air_irregular')).toBe(true);
    expect(isAirShipping('sea')).toBe(false);
  });
});

describe('the divisor default', () => {
  it('is the IATA figure for centimetres and kilograms', () => {
    expect(DEFAULT_VOLUMETRIC_DIVISOR).toBe(6000);
  });
});
