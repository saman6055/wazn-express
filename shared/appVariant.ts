/**
 * Which app a phone installs from this address.
 *
 * The owner, 2026-09-27: the office system should become an app on the
 * phone too, named only «سیستەم». The customer portal and the office share
 * one build but not one address: staff work on admin.waznexpress.com, so
 * that host installs as its own app with its own name, beside the
 * customers' «Wazn Express». Different origins are different apps to a
 * phone, so the two never replace each other.
 */

export const SYSTEM_APP_NAME = "سیستەم";

/** The staff host: admin.… (and staff.…, the alias Home.tsx also honours). */
export function isSystemHost(hostname: string | null | undefined): boolean {
  const host = String(hostname ?? "").toLowerCase().split(":")[0];
  return host.startsWith("admin.") || host.startsWith("staff.");
}
