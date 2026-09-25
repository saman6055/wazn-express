/**
 * What an air waybill number says about itself.
 *
 * The owner, 2026-09-25, looking at the flight panel: "after I enter the AWB,
 * can the system fill the other fields in by searching the web, or must it be
 * manual?"
 *
 * Part of it needs no searching at all. An AWB is `235-98651733`: three
 * digits that are the airline's own IATA prefix, then eight that are the
 * shipment's serial — and the last of those eight is a check digit, the
 * first seven taken modulo seven. So two things come free and instantly:
 *
 *   - the airline, from a fixed table
 *   - whether the number was typed correctly at all
 *
 * The second matters more than it looks. A mistyped waybill is not found on
 * any board, so the shipment silently stops being watched and nobody learns
 * why until a customer telephones.
 *
 * The flight number does NOT come from here, and cannot: the waybill names
 * the airline, not the aeroplane. Which flight a shipment was loaded onto
 * lives in that airline's cargo system, and reading it means reading that
 * airline's own tracking page — one scraper per carrier, each of which
 * breaks on its own schedule. That stays typed by hand until it is worth
 * building for the one or two carriers we actually fly.
 */

/**
 * IATA airline prefixes, kept deliberately short.
 *
 * Only carriers we are sure of. An unknown prefix returns null and the field
 * is left for a person — a confidently wrong airline name is worse than an
 * empty box, because nobody checks a box that is already filled.
 *
 * Add a row when a new carrier appears on a real waybill, not from memory.
 */
export const AIRLINE_PREFIXES: Record<string, string> = {
  "001": "American Airlines",
  "006": "Delta Air Lines",
  "014": "Air Canada",
  "016": "United Airlines",
  "020": "Lufthansa Cargo",
  "057": "Air France",
  "074": "KLM",
  "075": "Iberia",
  "125": "British Airways",
  "131": "Japan Airlines",
  "157": "Qatar Airways",
  "160": "Cathay Pacific",
  "172": "Cargolux",
  "176": "Emirates",
  "180": "Korean Air",
  "217": "Thai Airways",
  "235": "Turkish Airlines",
  "297": "China Airlines",
  "607": "Etihad Airways",
  "618": "Singapore Airlines",
  "774": "FedEx",
  "781": "China Eastern Airlines",
  "807": "China Southern Airlines",
  "988": "Asiana Airlines",
};

export interface AirWaybill {
  /** The three-digit airline prefix. */
  prefix: string;
  /** The eight-digit serial, check digit included. */
  serial: string;
  /** `235-98651733` — how it is written on the paper. */
  formatted: string;
  /** Null when the prefix is not one we are sure of. */
  airline: string | null;
  /** The last digit is the first seven modulo seven, or the number is wrong. */
  checkDigitValid: boolean;
}

/** Digits only: people type spaces, dashes and the odd letter. */
function digitsOf(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Read a waybill number, or null when it is not one yet.
 *
 * Null rather than a half-answer while somebody is still typing: a field
 * that argues with every keystroke is a field people stop reading.
 */
export function parseAwb(value: string | null | undefined): AirWaybill | null {
  const digits = digitsOf(value ?? "");
  if (digits.length !== 11) return null;

  const prefix = digits.slice(0, 3);
  const serial = digits.slice(3);
  const body = Number(serial.slice(0, 7));
  const check = Number(serial.slice(7));

  return {
    prefix,
    serial,
    formatted: `${prefix}-${serial}`,
    airline: AIRLINE_PREFIXES[prefix] ?? null,
    checkDigitValid: Number.isFinite(body) && body % 7 === check,
  };
}

/** The airline a waybill belongs to, or null when we cannot be sure. */
export function airlineFromAwb(value: string | null | undefined): string | null {
  return parseAwb(value)?.airline ?? null;
}

/**
 * Is this a waybill number at all?
 *
 * False only for a complete number whose check digit disagrees — a number
 * still being typed is not wrong, it is unfinished.
 */
export function awbLooksWrong(value: string | null | undefined): boolean {
  const parsed = parseAwb(value);
  return parsed !== null && !parsed.checkDigitValid;
}
