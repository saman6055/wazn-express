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

/**
 * The installed app's name under its icon (owner, 2026-09-28: «بنووسرێت
 * Wazn System»). Latin, so it reads the same on every phone's home screen
 * and sits apart from the customers' "Wazn".
 */
export const SYSTEM_APP_NAME = "Wazn System";

/** Inside the app, the top bar still says what it is in Kurdish. */
export const SYSTEM_TITLE = "سیستەم";

/**
 * Its own icon: the mark in white on the system's dark tile, full-bleed
 * (client/public/icons/system, drawn from docs/brand/wazn-logo-master.png).
 * The customers' app keeps the white tile, so the two never look alike.
 */
export const SYSTEM_ICON_SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512] as const;
export const systemIconUrl = (size: number) => `/icons/system/icon-${size}x${size}.png`;

/** The staff host: admin.… (and staff.…, the alias Home.tsx also honours). */
export function isSystemHost(hostname: string | null | undefined): boolean {
  const host = String(hostname ?? "").toLowerCase().split(":")[0];
  return host.startsWith("admin.") || host.startsWith("staff.");
}
