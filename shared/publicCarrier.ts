/**
 * What a customer may read about who carries their goods (owner, 2026-10-28:
 * «تەنها زانیاری هێلی ئاسمانی و ژمارە باچی ئێمە ... بە هیچ شێوەیەک زانیاری
 * سێرد پارت نیشان نەدرێ»). The airline, by its real name, and the airline's
 * waybill - nothing of the forwarder in between.
 *
 * The office types these fields freely ("TK", "Turkish Airline", "anc",
 * "obi", "167"), so the portal does not pass them through: an airline is
 * shown only when it is one we know, a waybill only when it has a waybill's
 * shape (3 digits, 8 digits). ANC's "167" typed into the waybill box, or
 * "anc" in the airline box, reach nobody.
 */

const AIRLINES: Array<{ name: string; match: RegExp }> = [
  { name: "Turkish Airlines", match: /^(tk|thy|turkish( air(line|lines|ways)?)?( cargo)?|土耳其航空(公司)?)$/i },
  { name: "Qatar Airways", match: /^(qr|qatar( airways)?( cargo)?)$/i },
  { name: "Emirates", match: /^(ek|emirates( skycargo)?)$/i },
  { name: "flydubai", match: /^(fz|fly ?dubai)$/i },
  { name: "Royal Jordanian", match: /^(rj|royal jordanian)$/i },
  { name: "EgyptAir", match: /^(ms|egypt ?air)$/i },
  { name: "Pegasus Airlines", match: /^(pc|pegasus( airlines)?)$/i },
  { name: "Air Arabia", match: /^(g9|air arabia)$/i },
  { name: "Iraqi Airways", match: /^(ia|iraqi airways)$/i },
  { name: "Etihad", match: /^(ey|etihad( airways)?)$/i },
  { name: "China Southern", match: /^(cz|china southern( airlines)?|南方航空|中国南方航空)$/i },
  { name: "Air China", match: /^(ca|air china|中国国际航空)$/i },
  { name: "China Eastern", match: /^(mu|china eastern( airlines)?|东方航空|中国东方航空)$/i },
];

/** The airline's real name, or null when the field holds anything else. */
export function publicAirlineName(value: string | null | undefined): string | null {
  const t = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!t) return null;
  return AIRLINES.find((a) => a.match.test(t))?.name ?? null;
}

/** An air waybill only when it is one: "235-99231031" or "23599231031". */
export function publicAwb(value: string | null | undefined): string | null {
  const t = String(value ?? "").trim();
  const m = /^(\d{3})[-\s]?(\d{8})$/.exec(t);
  return m ? `${m[1]}-${m[2]}` : null;
}
