import { describe, expect, it } from "vitest";
import {
  getAwbTracking,
  getContainerTracking,
  parseAwb,
  parseContainerNumber,
} from "./carrierTracking";

describe("air waybill", () => {
  it("splits a waybill however it was typed", () => {
    for (const written of ["176-48293011", "17648293011", "176 4829 3011", " 176-4829-3011 "]) {
      const awb = parseAwb(written);
      expect(awb?.prefix, written).toBe("176");
      expect(awb?.serial, written).toBe("48293011");
      expect(awb?.formatted, written).toBe("176-48293011");
    }
  });

  it("rejects anything that is not eleven digits", () => {
    for (const bad of ["", "176", "176-4829301", "176-482930111", "MSCU1234567", null, undefined]) {
      expect(parseAwb(bad as string), String(bad)).toBeNull();
    }
  });

  it("checks the last digit against the first seven", () => {
    // The industry check digit: serial[0..6] mod 7 === serial[7].
    // 4829301 mod 7 = 1, so ...3011 is right and ...3012 is a typo.
    expect(parseAwb("176-48293011")?.valid).toBe(true);
    expect(parseAwb("176-48293012")?.valid).toBe(false);
  });

  it("sends a carrier that accepts the number straight to the shipment", () => {
    const etihad = getAwbTracking("607-12345675");
    expect(etihad?.carrierName).toBe("Etihad Cargo");
    expect(etihad?.prefilled).toBe(true);
    // Full eleven digits, no dash — the form this page expects.
    expect(etihad?.url).toContain("awb=60712345675");
  });

  it("names the carrier and opens its page when the number can't be passed", () => {
    const turkish = getAwbTracking("235-12345675");
    expect(turkish?.carrierName).toBe("Turkish Cargo");
    // Nothing to pre-fill, so the caller copies the number for pasting.
    expect(turkish?.prefilled).toBe(false);
    expect(turkish?.url).toContain("turkishcargo.com");
  });

  it("falls back to the aggregator for an airline we don't know", () => {
    const unknown = getAwbTracking("888-12345675");
    expect(unknown?.carrierName).toBeUndefined();
    expect(unknown?.url).toContain("track-trace.com/aircargo");
  });

  it("still names an airline that has no reachable tracking page", () => {
    // Iraqi Airways publishes none, so the click goes to the aggregator —
    // but the operator should still see whose waybill this is.
    const iraqi = getAwbTracking("073-12345675");
    expect(iraqi?.carrierName).toBe("Iraqi Airways");
    expect(iraqi?.url).toContain("track-trace.com");
  });

  it("refuses to send a mistyped number to the aggregator", () => {
    // The aggregator silently drops a number whose check digit is wrong, so
    // the link would open an empty form and look broken. Better no link.
    expect(getAwbTracking("888-12345670")).toBeNull();
  });
});

describe("container number", () => {
  it("normalizes separators and case", () => {
    for (const written of ["MSCU1234567", "mscu1234567", "MSCU 123456 7", "MSCU-1234567"]) {
      expect(parseContainerNumber(written)?.normalized, written).toBe("MSCU1234567");
    }
  });

  it("rejects anything that is not four letters and seven digits", () => {
    for (const bad of ["", "MSCU123456", "MSC1234567", "12341234567", "176-48293011", null]) {
      expect(parseContainerNumber(bad as string), String(bad)).toBeNull();
    }
  });

  it("validates the ISO 6346 check digit", () => {
    // CSQU3054383 is the standard's own worked example.
    expect(parseContainerNumber("CSQU3054383")?.valid).toBe(true);
    expect(parseContainerNumber("CSQU3054384")?.valid).toBe(false);
  });

  it("trusts the shipping company we typed over the box's prefix", () => {
    // The whole point: TGHU belongs to Textainer, a LEASING company. The
    // prefix says nothing about who is carrying it — but we know, because
    // somebody typed it in when the batch was created.
    const leased = getContainerTracking("TGHU1234567", "Maersk Line");
    expect(leased?.carrierName).toBe("Maersk");
    expect(leased?.url).toContain("maersk.com");
  });

  it("uses the prefix only when no shipping company was recorded", () => {
    const byPrefix = getContainerTracking("CMAU1234564", "");
    expect(byPrefix?.carrierName).toBe("CMA CGM");
    expect(byPrefix?.prefilled).toBe(true);
    expect(byPrefix?.url).toContain("Reference=CMAU1234564");
  });

  it("never guesses a carrier from a leasing prefix", () => {
    // Roughly half of all containers are leased. With no shipping company
    // recorded, naming one of these would be a coin flip, so we name none
    // and send the click to the aggregator instead.
    for (const leasing of ["TGHU1234567", "TCLU1234568", "CAIU1234561", "TRLU1234567"]) {
      const result = getContainerTracking(leasing, "");
      expect(result?.carrierName, leasing).toBeUndefined();
      expect(result?.url, leasing).toContain("track-trace.com/container");
    }
  });

  it("matches a shipping company however it was written", () => {
    for (const typed of ["COSCO", "cosco shipping", "COSCO SHIPPING LINES CO"]) {
      expect(getContainerTracking("CSNU1234560", typed)?.carrierName, typed).toBe("COSCO");
    }
  });

  it("refuses to send a mistyped number to the aggregator", () => {
    expect(getContainerTracking("TGHU1234561", "")).toBeNull();
  });
});
