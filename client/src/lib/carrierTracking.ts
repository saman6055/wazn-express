/**
 * Turning a batch's air waybill or container number into a link that opens
 * the carrier's own tracking page.
 *
 * Two facts from checking every carrier below decided the shape of this:
 *
 * Almost none of them accept the number in the URL. Four sea lines and two
 * airlines do; everyone else shows a form you must paste into. So a result
 * carries `prefilled` and the caller copies the number to the clipboard when
 * it is false — the click is then "open the page, paste, done" rather than
 * "open the page and go find the number again".
 *
 * And a container's four-letter prefix names the OWNER of the box, not the
 * line carrying it. Roughly half of all containers are leased, so on half of
 * them the prefix points at a leasing company (TGHU is Textainer, TCLU is
 * Triton) and says nothing about who is shipping it. The shipping company we
 * typed in when creating the batch is therefore trusted ahead of the prefix,
 * and the prefix is consulted only for the codes a carrier actually owns.
 *
 * Air is the opposite: the three-digit waybill prefix IS the airline, it is
 * assigned by IATA and it does not drift. There it is the primary signal.
 */

export interface TrackingTarget {
  /** Carrier name to show beside the number, when we could identify one. */
  carrierName?: string;
  url: string;
  /** True when the URL carries the number; false means "copy, then paste". */
  prefilled: boolean;
}

/**
 * Free aggregator covering both air waybills and containers. It reads the
 * number from the URL fragment, not a query parameter, and it pre-fills
 * without submitting — and it drops the number entirely if the check digit
 * is wrong, which is why an invalid number is never sent here.
 */
const AGGREGATOR = {
  air: (awb: string) => `https://www.track-trace.com/aircargo#${awb}`,
  container: (n: string) => `https://www.track-trace.com/container#${n}`,
};

interface Airline {
  name: string;
  url: string;
  /** Present only where the carrier accepts the number in the URL. */
  deepLink?: (prefix: string, serial: string) => string;
}

/**
 * IATA air waybill prefixes. Every entry verified against a ground handler's
 * prefix table; an airline with no reachable public tracking page is left
 * out entirely rather than pointed at a guess, so its waybill falls through
 * to the aggregator still correctly labelled.
 */
const AIRLINES: Record<string, Airline> = {
  "235": { name: "Turkish Cargo", url: "https://www.turkishcargo.com/en/cargo-tracking" },
  "157": { name: "Qatar Airways Cargo", url: "https://www.qrcargo.com/s/track-your-shipment" },
  "176": {
    name: "Emirates SkyCargo",
    url: "https://scekprd.emirates.com/skychain/app?service=page%2Fnwp%3ATrackshipmt&initial=y",
  },
  "607": {
    name: "Etihad Cargo",
    url: "https://www.etihadcargo.com/en/e-services/shipment-tracking",
    // The full 11 digits, no dash.
    deepLink: (prefix, serial) =>
      `https://www.etihadcargo.com/en/e-services/shipment-tracking?awb=${prefix}${serial}`,
  },
  "020": {
    // Shared across the Lufthansa Group, so the label stays at group level.
    name: "Lufthansa Cargo",
    url: "https://www.lufthansa-cargo.com/en/eservices/etracking",
    deepLink: (prefix, serial) =>
      `https://www.lufthansa-cargo.com/en/eservices/etracking/tracking/-/awb/${prefix}/${serial}`,
  },
  "999": { name: "Air China Cargo", url: "https://www.airchinacargo.com/cargo_en/gzcx/hkyd/list/index_pc.html" },
  "784": { name: "China Southern Cargo", url: "https://cargo.csair.com/pages/cargotrackingNew.do" },
  "160": { name: "Cathay Cargo", url: "https://www.cathaycargo.com/en-us/track-and-trace.html" },
  "172": { name: "Cargolux", url: "https://www.cargolux.com/track-and-trace" },
  "125": { name: "IAG Cargo", url: "https://www.iagcargo.com/" },
  // Named but deliberately without a URL: the airline is worth showing even
  // when we have nowhere good to send the click.
  "781": { name: "China Eastern Cargo", url: "" },
  "112": { name: "China Cargo Airlines", url: "" },
  "057": { name: "Air France Cargo", url: "" },
  "074": { name: "KLM Cargo", url: "" },
  "073": { name: "Iraqi Airways", url: "" },
};

interface SeaLine {
  name: string;
  url: string;
  deepLink?: (containerNumber: string) => string;
  /** Lowercase fragments matched against the batch's shipping company. */
  aliases: string[];
  /** Prefixes this carrier genuinely owns. Leasing codes never appear here. */
  prefixes: string[];
}

const SEA_LINES: SeaLine[] = [
  {
    name: "MSC",
    url: "https://www.msc.com/en/track-a-shipment",
    aliases: ["msc", "mediterranean shipping"],
    prefixes: ["MSCU", "MEDU"],
  },
  {
    name: "Maersk",
    url: "https://www.maersk.com/tracking/",
    deepLink: (n) => `https://www.maersk.com/tracking/${n}`,
    aliases: ["maersk"],
    prefixes: ["MAEU", "MSKU"],
  },
  {
    name: "CMA CGM",
    url: "https://www.cma-cgm.com/ebusiness/tracking",
    deepLink: (n) =>
      `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference=${n}`,
    aliases: ["cma", "cgm"],
    prefixes: ["CMAU"],
  },
  {
    name: "COSCO",
    url: "https://elines.coscoshipping.com/ebusiness/cargoTracking",
    deepLink: (n) =>
      `https://elines.coscoshipping.com/ebusiness/cargoTracking?trackingType=CONTAINER&number=${n}`,
    aliases: ["cosco"],
    // COSU is absent from the BIC registry despite being widely listed, and
    // CBHU/CCLU belong to COSCO's leasing arms rather than the liner.
    prefixes: ["CSNU"],
  },
  {
    name: "OOCL",
    url: "https://www.oocl.com/eng/ourservices/eservices/cargotracking/pages/cargotracking.aspx",
    aliases: ["oocl", "orient overseas"],
    prefixes: ["OOLU"],
  },
  {
    name: "Hapag-Lloyd",
    url: "https://www.hapag-lloyd.com/en/online-business/track/track-by-container-solution.html",
    aliases: ["hapag"],
    prefixes: ["HLCU", "HLXU"],
  },
  {
    name: "Evergreen",
    url: "https://ct.shipmentlink.com/servlet/TDB1_CargoTracking.do",
    aliases: ["evergreen", "shipmentlink"],
    prefixes: ["EMCU", "EGHU"],
  },
  {
    name: "ONE",
    url: "https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking",
    deepLink: (n) =>
      `https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?trakNoParam=${n}`,
    aliases: ["ocean network", "one line", "one-line"],
    prefixes: ["ONEU"],
  },
  {
    name: "Yang Ming",
    url: "https://www.yangming.com/en/esolution/cargo_tracking",
    aliases: ["yang ming", "yangming"],
    prefixes: ["YMLU"],
  },
  {
    name: "ZIM",
    url: "https://www.zim.com/tools/track-a-shipment",
    deepLink: (n) => `https://www.zim.com/tools/track-a-shipment?consnumber=${n}`,
    aliases: ["zim"],
    prefixes: ["ZIMU"],
  },
];

/** An air waybill split into its parts, or null if it isn't one. */
export function parseAwb(raw: string | null | undefined): {
  prefix: string;
  serial: string;
  /** Digits only, no separator — the form carriers expect in a URL. */
  plain: string;
  /** Formatted the way the industry writes it. */
  formatted: string;
  /**
   * The last serial digit is the first seven mod 7. A wrong one means a
   * typo, and the aggregator silently ignores such a number.
   */
  valid: boolean;
} | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  const prefix = digits.slice(0, 3);
  const serial = digits.slice(3);
  const valid = Number(serial.slice(0, 7)) % 7 === Number(serial[7]);
  return { prefix, serial, plain: digits, formatted: `${prefix}-${serial}`, valid };
}

/** ISO 6346 letter values. Multiples of 11 are skipped by the standard. */
const CONTAINER_LETTER_VALUES: Record<string, number> = (() => {
  const values: Record<string, number> = {};
  let n = 10;
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (n % 11 === 0) n++;
    values[letter] = n++;
  }
  return values;
})();

/** A container number split into its parts, or null if it isn't one. */
export function parseContainerNumber(raw: string | null | undefined): {
  /** Four-letter owner code — a leasing company about half the time. */
  ownerPrefix: string;
  normalized: string;
  /** ISO 6346 check digit. A wrong one means a typo. */
  valid: boolean;
} | null {
  if (!raw) return null;
  const normalized = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{4}\d{7}$/.test(normalized)) return null;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = normalized[i];
    const value = i < 4 ? CONTAINER_LETTER_VALUES[char] : Number(char);
    sum += value * 2 ** i;
  }
  const checkDigit = sum % 11 === 10 ? 0 : sum % 11;

  return {
    ownerPrefix: normalized.slice(0, 4),
    normalized,
    valid: checkDigit === Number(normalized[10]),
  };
}

/** Where to send someone who clicks an air waybill. */
export function getAwbTracking(raw: string | null | undefined): TrackingTarget | null {
  const awb = parseAwb(raw);
  if (!awb) return null;

  const airline = AIRLINES[awb.prefix];

  if (airline?.deepLink) {
    return { carrierName: airline.name, url: airline.deepLink(awb.prefix, awb.serial), prefilled: true };
  }
  if (airline?.url) {
    return { carrierName: airline.name, url: airline.url, prefilled: false };
  }
  // Unknown prefix, or an airline we can name but have nowhere to send. The
  // aggregator drops a number whose check digit is wrong, so only a valid
  // one goes there; an invalid one has nowhere useful to go at all.
  if (!awb.valid) return null;
  return { carrierName: airline?.name, url: AGGREGATOR.air(awb.formatted), prefilled: true };
}

/**
 * Where to send someone who clicks a container number.
 *
 * `shippingCompany` is what we typed when creating the batch, and it beats
 * the container's prefix — the prefix names whoever owns the box, which on
 * a leased container is not the line carrying it.
 */
export function getContainerTracking(
  raw: string | null | undefined,
  shippingCompany?: string | null
): TrackingTarget | null {
  const container = parseContainerNumber(raw);
  if (!container) return null;

  const typed = (shippingCompany ?? "").trim().toLowerCase();
  const byName = typed
    ? SEA_LINES.find((line) => line.aliases.some((alias) => typed.includes(alias)))
    : undefined;
  const line =
    byName ?? SEA_LINES.find((l) => l.prefixes.includes(container.ownerPrefix));

  if (line?.deepLink) {
    return { carrierName: line.name, url: line.deepLink(container.normalized), prefilled: true };
  }
  if (line) {
    return { carrierName: line.name, url: line.url, prefilled: false };
  }
  if (!container.valid) return null;
  return { url: AGGREGATOR.container(container.normalized), prefilled: true };
}
