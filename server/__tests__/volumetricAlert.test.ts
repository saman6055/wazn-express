import { describe, it, expect } from 'vitest';
import {
  assessVolumetric,
  buildVolumetricMessage,
  buildWhatsAppLink,
  DEFAULT_VOLUMETRIC_THRESHOLDS,
} from '../shared/volumetricAlert';

/**
 * These decide who gets a message about their bill, and what it says. The
 * tests are written around the two failure modes that matter: a real surprise
 * going out unannounced, and a message going to the wrong phone.
 */

const air = (over: Record<string, unknown> = {}) => ({
  shippingType: 'air_regular',
  weightKg: '2',
  lengthCm: '60',
  widthCm: '40',
  heightCm: '30',
  ...over,
});

describe('assessVolumetric — who is worth telling', () => {
  it('flags the 2 kg carton that bills as 12 kg', () => {
    const a = assessVolumetric(air());

    expect(a.actualKg).toBe(2);
    expect(a.volumetricKg).toBe(12);
    expect(a.chargeableKg).toBe(12);
    expect(a.alert).toBe(true);
  });

  it('stays quiet when the scale wins', () => {
    const a = assessVolumetric(air({ weightKg: '30' }));

    expect(a.chargeableKg).toBe(30);
    expect(a.billedOnVolume).toBe(false);
    expect(a.alert).toBe(false);
  });

  it('never alerts on sea — volume is how sea is always billed', () => {
    // Nothing surprising has happened, so there is nothing to explain.
    const a = assessVolumetric(air({ shippingType: 'sea' }));

    expect(a.alert).toBe(false);
  });

  it('covers air_irregular as well as air_regular', () => {
    expect(assessVolumetric(air({ shippingType: 'air_irregular' })).alert).toBe(true);
  });

  it('stays quiet for a small envelope however lopsided the ratio', () => {
    // 0.2 kg billed as 0.6: three times over, and nobody argues over 400g.
    const a = assessVolumetric(air({ weightKg: '0.2', lengthCm: '30', widthCm: '20', heightCm: '6' }));

    expect(a.billedOnVolume).toBe(true);
    expect(a.alert).toBe(false);
  });

  it('stays quiet when a heavy parcel is only nudged past by its volume', () => {
    // 40 kg billed as 45 — five kilos, but 1.13×, and ordinary on that size.
    const a = assessVolumetric(air({ weightKg: '40', lengthCm: '90', widthCm: '50', heightCm: '60' }));

    expect(a.extraKg).toBe(5);
    expect(a.alert).toBe(false);
  });

  it('speaks up for a big absolute gap even at a modest ratio', () => {
    // 20 kg billed as 29.17 — only 1.46×, under the ratio rule, but nine kilos
    // of somebody's money. The customer pays in kilos, not in ratios.
    const a = assessVolumetric(air({ weightKg: '20', lengthCm: '70', widthCm: '50', heightCm: '50' }));

    expect(a.ratio).toBeLessThan(DEFAULT_VOLUMETRIC_THRESHOLDS.minRatio);
    expect(a.extraKg).toBeGreaterThanOrEqual(DEFAULT_VOLUMETRIC_THRESHOLDS.alwaysAboveExtraKg);
    expect(a.alert).toBe(true);
  });

  it('honours thresholds handed in from settings', () => {
    const strict = { minExtraKg: 50, minRatio: 10, alwaysAboveExtraKg: 100 };

    expect(assessVolumetric(air(), { thresholds: strict }).alert).toBe(false);
  });

  it('honours a changed divisor', () => {
    // A smaller divisor means more volumetric kilos.
    expect(assessVolumetric(air(), { divisor: 5000 }).chargeableKg).toBeCloseTo(14.4, 5);
  });

  it('never alerts on a parcel with no weight to compare against', () => {
    const a = assessVolumetric(air({ weightKg: '' }));

    expect(a.alert).toBe(false);
  });
});

describe('buildVolumetricMessage', () => {
  const message = buildVolumetricMessage({
    customerName: 'ئاراس',
    trackingNumber: 'YT7429183055',
    lengthCm: '60', widthCm: '40', heightCm: '30',
    assessment: assessVolumetric(air()),
  });

  it('names the customer and the tracking number', () => {
    expect(message).toContain('ئاراس');
    expect(message).toContain('YT7429183055');
  });

  it('shows all three weights so the arithmetic can be followed', () => {
    expect(message).toContain('2 کیلۆ');
    expect(message).toContain('12 کیلۆ');
    expect(message).toContain('60 × 40 × 30');
  });

  it('shows the divisor actually used, not a hard-coded one', () => {
    const custom = buildVolumetricMessage({
      customerName: 'ئاراس',
      trackingNumber: 'X',
      assessment: assessVolumetric(air(), { divisor: 5000 }),
    });

    expect(custom).toContain('÷ 5000');
    expect(message).toContain('÷ 6000');
  });

  it('says the surcharge is the airline’s, not ours', () => {
    // The whole point of sending this: the customer must not read the extra
    // kilos as us inventing a charge.
    expect(message).toContain('هی ئێمە نییە');
    expect(message).toContain('هێڵی ئاسمانیی');
  });

  it('explains why it is fair — the parcel takes space on the aircraft', () => {
    expect(message).toContain('شوێن');
    expect(message).toContain('ئاسایی و ڕەوا');
  });

  it('gives the customer 24 hours before the parcel is batched', () => {
    expect(message).toContain('24 کاتژمێر');
  });

  it('omits the dimensions line rather than printing a broken one', () => {
    const partial = buildVolumetricMessage({
      customerName: 'ئاراس',
      trackingNumber: 'X',
      lengthCm: '60', widthCm: '40',
      assessment: assessVolumetric(air()),
    });

    expect(partial).not.toContain('قەبارە:');
  });

  it('writes whole numbers without trailing zeros', () => {
    expect(message).toContain('2 کیلۆ');
    expect(message).not.toContain('2.00');
  });
});

describe('buildWhatsAppLink', () => {
  it('turns a local Iraqi number into an international one', () => {
    const link = buildWhatsAppLink('0750 123 4567', 'hello');

    expect(link).toContain('https://wa.me/9647501234567');
  });

  it('accepts a number already in international form', () => {
    expect(buildWhatsAppLink('+964 770 111 2222', 'x')).toContain('wa.me/9647701112222');
    expect(buildWhatsAppLink('00964 770 111 2222', 'x')).toContain('wa.me/9647701112222');
  });

  it('encodes the message so newlines and Kurdish survive the URL', () => {
    const link = buildWhatsAppLink('07501234567', 'سڵاو\nدوو')!;

    expect(link).toContain('%0A');
    expect(link).not.toContain('\n');
    expect(decodeURIComponent(link.split('?text=')[1])).toBe('سڵاو\nدوو');
  });

  it('returns null rather than a link that opens an empty chat', () => {
    // Rendering nothing is better than an admin messaging a stranger.
    for (const v of [null, undefined, '', '   ', '123', 'abc', '01234567890123456789']) {
      expect(buildWhatsAppLink(v as string, 'x'), String(v)).toBeNull();
    }
  });
});
