import { appLogger } from "../utils/logger";

/**
 * The company's own name, address, phone and email, for anything printed.
 *
 * These were hardcoded in two places — invoice.service.ts and
 * pdf-generator.ts — while the real values sat in settings, editable from the
 * admin screens. So every invoice and every PDF went out carrying
 * "+964 XXX XXX XXXX", a placeholder nobody had noticed because it is at the
 * top of a document staff see every day and stop reading.
 *
 * One reader, so a change in settings reaches the paperwork.
 */

export type CompanyDetails = {
  name: string;
  nameKu?: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
};

/**
 * Used only when settings has nothing yet — a brand-new install. Deliberately
 * omits a phone number rather than inventing one: a blank line on an invoice
 * is honest, and "+964 XXX XXX XXXX" is not.
 */
const FALLBACK: CompanyDetails = {
  name: "Wazn Express",
  nameKu: "وەزن ئێکسپرێس",
  address: "Erbil, Kurdistan Region, Iraq",
  phone: "",
  email: "info@waznexpress.com",
  website: "www.waznexpress.com",
};

const str = (v: unknown): string => (typeof v === "string" && v.trim() ? v.trim() : "");

/** Read the company's details from settings, falling back only where empty. */
export async function getCompanyDetails(): Promise<CompanyDetails> {
  try {
    const { getSetting } = await import("../db/settings.db");
    const raw = await getSetting("company_info");
    if (!raw) return FALLBACK;

    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      name: str(p.name) || FALLBACK.name,
      nameKu: str(p.nameKu) || FALLBACK.nameKu,
      // The admin form keeps the Kurdish address separately; either is better
      // than the English default.
      address: str(p.addressKu) || str(p.address) || FALLBACK.address,
      // A second number is common here, and the invoice has room for both.
      phone: [str(p.phone), str(p.phone2)].filter(Boolean).join(" · ") || FALLBACK.phone,
      email: str(p.email) || FALLBACK.email,
      website: str(p.website) || FALLBACK.website,
    };
  } catch (err) {
    appLogger.warn("[Company] Could not read company_info; using fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
    return FALLBACK;
  }
}
