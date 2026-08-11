import { TERMS_WHATSAPP_NUMBER, type L10n } from "./portalTerms";

/**
 * Every way a customer can reach Wazn Express, in one place.
 *
 * Contact details were previously scattered across pages as literals, which is
 * how a placeholder WhatsApp number survived in four of them. Anything that
 * shows a number, an address, or a social link should read it from here.
 */

/** Local-format numbers, as a customer would dial them. */
export const CONTACT_WHATSAPP_LOCAL = "07709183535";
export const CONTACT_PHONE_LOCAL = "07509183535";

/**
 * International format for wa.me and tel: links. The WhatsApp number is taken
 * from the terms constant rather than written again — one number in two files
 * is how the placeholder survived last time.
 */
export const CONTACT_WHATSAPP_INTL = TERMS_WHATSAPP_NUMBER;
export const CONTACT_PHONE_INTL = "9647509183535";

export const CONTACT_EMAIL = "waznexpress@gmail.com";
export const CONTACT_WEBSITE = "https://www.waznexpress.com";
export const CONTACT_MAP_URL = "https://maps.app.goo.gl/94SbcCesBB8i5SMk6";

export const CONTACT_ADDRESS: L10n = {
  ku: "هەولێر، 32 پارک، نزیک جۆت سایدی جەوازات",
  en: "Erbil, 32 Park, near the Passport Directorate",
  ar: "أربيل، 32 بارك، قرب الجوازات",
  zh: "埃尔比勒，32 Park，护照局附近",
};

/** Which glyph to draw — brand marks are hand-drawn, lucide has none. */
export type ContactIcon =
  | "whatsapp"
  | "phone"
  | "mail"
  | "map"
  | "tiktok"
  | "facebook"
  | "instagram"
  | "telegram"
  | "youtube"
  | "megaphone"
  | "globe";

export interface ContactChannel {
  id: string;
  icon: ContactIcon;
  label: L10n;
  /** What the row shows — a number, an address, a handle. */
  value: string;
  href: string;
  /** Brand colour, used for the icon and the social tile background. */
  color: string;
  /** Offer a copy button — only useful for things worth pasting elsewhere. */
  copyable?: boolean;
}

/** Phone, WhatsApp, email, address — the direct ways to reach a person. */
export const DIRECT_CHANNELS: ContactChannel[] = [
  {
    id: "whatsapp",
    icon: "whatsapp",
    label: { ku: "واتساپ", en: "WhatsApp", ar: "واتساب", zh: "WhatsApp" },
    value: CONTACT_WHATSAPP_LOCAL,
    href: `https://wa.me/${CONTACT_WHATSAPP_INTL}`,
    color: "#25D366",
    copyable: true,
  },
  {
    id: "phone",
    icon: "phone",
    label: { ku: "تەلەفۆن", en: "Phone", ar: "هاتف", zh: "电话" },
    value: CONTACT_PHONE_LOCAL,
    href: `tel:+${CONTACT_PHONE_INTL}`,
    color: "#3B82F6",
    copyable: true,
  },
  {
    id: "email",
    icon: "mail",
    label: { ku: "ئیمەیل", en: "Email", ar: "البريد الإلكتروني", zh: "邮箱" },
    value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
    color: "#F59E0B",
    copyable: true,
  },
  {
    id: "address",
    icon: "map",
    label: { ku: "ناونیشان", en: "Address", ar: "العنوان", zh: "地址" },
    // Filled in per-language at render time from CONTACT_ADDRESS.
    value: "",
    href: CONTACT_MAP_URL,
    color: "#EF4444",
  },
];

/** The public accounts, in the order they appear on the page. */
export const SOCIAL_CHANNELS: ContactChannel[] = [
  {
    id: "tiktok",
    icon: "tiktok",
    label: { ku: "تیکتۆک", en: "TikTok", ar: "تيك توك", zh: "TikTok" },
    value: "wazn.express",
    href: "https://www.tiktok.com/@wazn.express",
    color: "#000000",
  },
  {
    id: "facebook",
    icon: "facebook",
    label: { ku: "فەیسبووک", en: "Facebook", ar: "فيسبوك", zh: "Facebook" },
    value: "wazn.express",
    href: "https://www.facebook.com/wazn.express",
    color: "#1877F2",
  },
  {
    id: "instagram",
    icon: "instagram",
    label: { ku: "ئینستاگرام", en: "Instagram", ar: "إنستغرام", zh: "Instagram" },
    // waznexpress, not wazn.express — the dotted spelling is the Facebook
    // handle, and it was copied across to this row. It leads nowhere.
    value: "waznexpress",
    href: "https://www.instagram.com/waznexpress/",
    color: "#C13584",
  },
  {
    id: "telegram",
    icon: "telegram",
    label: { ku: "تێلێگرام", en: "Telegram", ar: "تيليغرام", zh: "Telegram" },
    value: "waznexpress",
    href: "https://t.me/waznexpress",
    color: "#229ED9",
  },
  {
    id: "youtube",
    icon: "youtube",
    label: { ku: "یوتوب", en: "YouTube", ar: "يوتيوب", zh: "YouTube" },
    value: "@WaznExpress",
    href: "https://www.youtube.com/@WaznExpress",
    color: "#FF0000",
  },
  {
    id: "whatsapp-channel",
    icon: "megaphone",
    label: { ku: "کەناڵی واتساپ", en: "WhatsApp channel", ar: "قناة واتساب", zh: "WhatsApp 频道" },
    value: "هەواڵ و ڕاگەیاندن",
    href: "https://whatsapp.com/channel/0029Vb6AukOK5cDImQtBmz3b",
    color: "#25D366",
  },
  {
    id: "website",
    icon: "globe",
    label: { ku: "ماڵپەڕ", en: "Website", ar: "الموقع", zh: "网站" },
    value: "www.waznexpress.com",
    href: CONTACT_WEBSITE,
    color: "#0F766E",
  },
];

export const CONTACT_PAGE_TITLE: L10n = {
  ku: "پەیوەندی",
  en: "Contact",
  ar: "تواصل",
  zh: "联系我们",
};

export const CONTACT_PAGE_SUBTITLE: L10n = {
  ku: "هەموو ڕێگاکانی گەیشتن بە ئێمە",
  en: "Every way to reach us",
  ar: "كل طرق الوصول إلينا",
  zh: "联系我们的所有方式",
};
