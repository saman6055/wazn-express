import type { CompanyInfo } from "@/hooks/useCompanyInfo";
import { CONTACT_WEBSITE } from "@/constants/contactChannels";
import { absoluteLogoUrl } from "./absoluteLogoUrl";

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

/**
 * The same mark in white ink, the cyan dot kept, for dark surfaces — the
 * black-ink original disappears on the portal's dark theme. Made from
 * docs/brand/wazn-logo-master.png.
 */
export const BRAND_LOGO_ON_DARK_URL = "/brand/wazn-logo-on-dark.png";

/**
 * The house's own stamp, the one on the office desk — photographed, lifted
 * off the cardboard and kept in the build beside the mark (owner sent it,
 * 2026-09-21: "let it be exactly like this, in blue").
 *
 * In the build rather than in uploads for the same reason as the mark: a
 * redeploy without a mounted volume once took the uploads folder with it.
 */
export const BRAND_STAMP_URL = "/brand/wazn-stamp.png";

/**
 * Which mark a coloured band should print — a receipt's green header, say.
 *
 * The owner's rule from September 2026 is that the mark sits straight on the
 * surface with no white tile behind it, and that only works if each place
 * says which ink it needs. The app's screens were taught this; the printed
 * receipts were not, and kept a white tile around a transparent logo.
 *
 * A company that uploaded its own mark gets that mark: we cannot know its
 * ink, and it is theirs to look at. Otherwise the white-ink twin, which is
 * what a dark band needs.
 */
export function logoUrlOnDark(uploadedLogoUrl?: string | null): string {
  return uploadedLogoUrl || BRAND_LOGO_ON_DARK_URL;
}

/**
 * The mark as an <img> for a report that prints from its own window.
 *
 * A print window is a blank document with no base URL of ours, so the address
 * has to be absolute. Pass useCompanyInfo().logoUrl — the server has already
 * blanked it if its file is gone — and the built-in mark stands in otherwise.
 * The white tile is because the mark is black ink and several report headers
 * are coloured.
 */
export function reportLogoHtml(logoUrl?: string | null, heightPx = 40): string {
  const src = absoluteLogoUrl(logoUrl || BRAND_LOGO_URL);
  if (!src) return "";
  return `<img src="${src.replace(/"/g, "&quot;")}" alt="" style="height:${heightPx}px;width:auto;object-fit:contain;background:#fff;border-radius:6px;padding:3px 6px;vertical-align:middle;" />`;
}

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
