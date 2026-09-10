import type { CompanyInfo } from "@/hooks/useCompanyInfo";
import { CONTACT_WEBSITE } from "@/constants/contactChannels";

/**
 * The Wazn Express mark, shipped inside every build (client/public/brand).
 *
 * The logo uploaded in Settings lives in the uploads folder, and a redeploy
 * without a mounted volume takes that folder with it. That is how the company
 * logo vanished in September 2026: every login page, receipt and home-screen
 * icon fell back to a generic box. This copy cannot vanish — it is part of
 * the deploy itself. An uploaded logo still wins wherever one exists.
 */
export const BRAND_LOGO_URL = "/brand/wazn-logo.png";

/** How to find us, in one document's language — what a receipt prints at its foot. */
export interface CompanyContact {
  /** The company name in the document's language. */
  name: string;
  address: string;
  phones: string[];
  /** Host only, as a person would type it: "waznexpress.com". */
  website: string;
  /** Where a customer signs in to follow their parcels. */
  portal: string;
}

const bareUrl = (url: string) =>
  url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");

/**
 * The company's contact details from Settings, picked for `language`. Kurdish
 * and Arabic documents take their own name and address; English and Chinese
 * take the Latin ones. The website falls back to the public address when
 * Settings has none, and the portal is always that site's /portal.
 */
export function companyContact(company: CompanyInfo, language: string): CompanyContact {
  const inLanguage = (ku: string, ar: string, en: string) =>
    (language === "ku" ? ku : language === "ar" ? ar : en) || en || ku || ar;
  const site = bareUrl(company.website || CONTACT_WEBSITE);
  return {
    name: inLanguage(company.nameKu, company.nameAr, company.name),
    address: inLanguage(company.addressKu, company.addressAr, company.address),
    phones: [company.phone, company.phone2].map((p) => (p || "").trim()).filter(Boolean),
    website: site,
    portal: `${site}/portal`,
  };
}
