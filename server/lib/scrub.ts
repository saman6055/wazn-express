/**
 * What an error report must not carry into a log.
 *
 * A report from a browser is written by the page that crashed: its message
 * can quote a search box, its stack can carry a URL with a share token, and
 * a toast's text can hold a customer's phone number. The log is read by
 * people who do not need any of that to fix the bug.
 */
const RULES: [RegExp, string][] = [
  // JSON Web Tokens (our session tokens among them)
  [/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, "[jwt]"],
  // bearer credentials
  [/\bBearer\s+[\w.~+/-]+=*/gi, "Bearer [redacted]"],
  // key=value secrets in URLs, headers or messages
  [/\b(password|passwd|token|otp|secret|authorization|cookie|session|api[_-]?key)(["']?\s*[:=]\s*["']?)[^\s&"',;]+/gi, "$1$2[redacted]"],
  // e-mail addresses
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]"],
  // Iraqi mobile numbers, international or local, with or without spaces
  [/(\+?964[\s-]?|0)7\d{2}[\s-]?\d{3}[\s-]?\d{4}/g, "[phone]"],
  // public share links carry their token in the path
  [/\/t\/[\w-]{6,}/g, "/t/[token]"],
  // any other long run of digits (card, ID and account numbers)
  [/\b\d{10,}\b/g, "[number]"],
];

export function scrubText(value: unknown, maxLength = 2000): string {
  let text = typeof value === "string" ? value : value == null ? "" : String(value);
  if (text.length > maxLength) text = `${text.slice(0, maxLength)}…`;
  for (const [pattern, replacement] of RULES) text = text.replace(pattern, replacement);
  return text;
}

/** A page address for a log: the path only — a query string is someone's search. */
export function scrubUrl(value: unknown): string {
  const text = typeof value === "string" ? value : "";
  const path = text.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0] ?? "";
  return scrubText(path, 300);
}
