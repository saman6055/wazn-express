/**
 * One phone number, written six different ways.
 *
 * A customer signing in types the number the way they say it out loud. Some
 * write `07740427884`, some `7740427884`, some paste `+964 774 042 7884` out
 * of WhatsApp. What is stored is whatever whoever created the account typed,
 * years ago, in one of those same shapes.
 *
 * The portal compared them with `=`, so the two only had to disagree about a
 * leading zero for the lookup to find nobody — and the message a customer got
 * was "wrong phone number or password". Staff then reset the password, the
 * customer still could not sign in, and the password had never been the
 * problem. That was two people's afternoon, every time.
 *
 * So: reduce a number to what actually identifies it, and compare on that.
 *
 * For Iraq that is the ten digits after the country code, beginning with 7.
 * Everything else — the `+`, the `00`, the `964`, the trunk `0`, the spaces
 * and dashes people put in — is decoration that varies by who is typing.
 */

/**
 * Arabic-Indic digits, folded to the ASCII ones.
 *
 * `٠٧٧٤٠٤٢٧٨٨٤` is the same number as `07740427884` and looks the same to
 * anyone reading it. A phone keyboard set to Arabic or Kurdish can produce
 * them, and rows imported from an Arabic source hold them. `\D` counts them
 * as punctuation and strips them, so a number written that way reduced to an
 * empty string and matched nobody at all.
 */
function toAsciiDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, ch => {
    const code = ch.charCodeAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}

/** Digits only, with the country code and trunk zero taken off. */
export function normalizePhone(input: string | null | undefined): string {
  let digits = toAsciiDigits(String(input ?? "")).replace(/\D/g, "");
  if (!digits) return "";

  // 00964… and 964… both mean the same country.
  if (digits.startsWith("00964")) digits = digits.slice(5);
  else if (digits.startsWith("964")) digits = digits.slice(3);

  // The trunk zero is national notation; it is not part of the number.
  digits = digits.replace(/^0+/, "");

  return digits;
}

/**
 * Every shape this number might already be stored as.
 *
 * Used to look a customer up without touching the data: rows written years
 * ago keep whatever form they were typed in, and this matches all of them.
 * Ordered from most to least common so the intent is readable, though the
 * query treats them as a set.
 */
export function phoneVariants(input: string | null | undefined): string[] {
  const bare = normalizePhone(input);
  if (!bare) return [];

  const variants = new Set<string>([
    bare,               // 7740427884
    `0${bare}`,         // 07740427884
    `964${bare}`,       // 9647740427884
    `+964${bare}`,      // +9647740427884
    `00964${bare}`,     // 009647740427884
  ]);

  // And the raw input itself, in case a row holds something this does not
  // predict — a number with spaces, or a landline, or a foreign mobile.
  const raw = String(input ?? "").trim();
  if (raw) variants.add(raw);

  return Array.from(variants);
}

/** Do two numbers identify the same phone, however each was written? */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  return left !== "" && left === right;
}
