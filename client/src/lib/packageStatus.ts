/**
 * What each package status is called, in the customer's language — one copy.
 *
 * The enum lives in drizzle/schema/packages.schema.ts and holds nine values.
 * Screens kept private partial maps of it (the batch detail knew seven, in two
 * languages), and whatever a map did not know leaked to the customer as the
 * raw column value — "customs_processing" in Latin letters on a Kurdish page.
 * portal-audit.test.ts fails if this map and the enum ever disagree again.
 */

type L = { ku: string; en: string; ar: string; zh: string };

/**
 * The home-screen stage groups, from the customer's side of the counter.
 *
 * These exist because two skins were counting packages against BATCH statuses
 * ("arrived", "customs", "closed" — values a package row can never hold), so
 * the "arrived" tile showed 0 forever no matter what was sitting in Erbil.
 * Group membership is checked against the enum by portal-audit.test.ts.
 */
export const PACKAGE_STAGE_GROUPS = {
  /** Moving between countries. */
  inTransit: ["in_transit"],
  /** In Iraq but not yet in the customer's hands. */
  arrived: ["customs_processing", "ready_for_delivery", "out_for_delivery"],
  delivered: ["delivered"],
} as const;

export const PACKAGE_STATUS_LABEL: Record<string, L> = {
  registered: { ku: "گەیشتە کۆگاکەمان", en: "At our depot", ar: "في مستودعنا", zh: "已到我们的仓库" },
  in_batch: { ku: "خرایە ناو بار", en: "Packed into a shipment", ar: "أُضيف إلى شحنة", zh: "已装入货运" },
  in_transit: { ku: "لە ڕێگادا", en: "In transit", ar: "في الطريق", zh: "运输中" },
  customs_processing: { ku: "لە گومرگ", en: "At customs", ar: "في الجمارك", zh: "清关中" },
  ready_for_delivery: { ku: "ئامادەیە بۆ وەرگرتن", en: "Ready for pickup", ar: "جاهز للاستلام", zh: "可取件" },
  out_for_delivery: { ku: "لە ڕێی گەیاندنە", en: "Out for delivery", ar: "خرج للتسليم", zh: "派送中" },
  delivered: { ku: "گەیشتە دەستت", en: "Delivered", ar: "تم التسليم", zh: "已交付" },
  returned: { ku: "گەڕێندراوەتەوە", en: "Returned", ar: "مُرتجع", zh: "已退回" },
  cancelled: { ku: "هەڵوەشێنراوە", en: "Cancelled", ar: "ملغى", zh: "已取消" },
};

/**
 * The colour of each package status — the twin of BATCH_STATUS_TONE in
 * shipmentFilters.ts, and for the same reason: three screens coloured these
 * chips for themselves, and a returned or cancelled parcel came out grey,
 * the colour of "nothing to see".
 */
export const PACKAGE_STATUS_TONE: Record<string, string> = {
  registered: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_batch: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_transit: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  customs_processing: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  ready_for_delivery: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  out_for_delivery: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  returned: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export function packageStatusTone(status: string | null | undefined): string {
  return PACKAGE_STATUS_TONE[status ?? ""] ?? PACKAGE_STATUS_TONE.registered;
}

/**
 * Where a parcel is, in the customer's three phrases — the owner's brief
 * (2026-09-19): green in Erbil, blue on the way, grey in China.
 *
 * The per-status names above stay as they are: the office's screens read
 * them too, and there "registered" and "packed into a shipment" must stay
 * apart. A customer needs only to know where the goods are.
 */
export const PARCEL_WHERE_WORDS: Record<"erbil" | "onTheWay" | "china", L> = {
  erbil: { ku: "گەیشتە هەولێر — ئامادەیە بۆ وەرگرتن", en: "In Erbil — ready to collect", ar: "وصل إلى أربيل — جاهز للاستلام", zh: "已到埃尔比勒——可以取件" },
  onTheWay: { ku: "لە ڕێگادایە (لە فڕۆکە یان کەشتیدایە)", en: "On the way (on a plane or ship)", ar: "في الطريق (على متن طائرة أو سفينة)", zh: "运输中（在飞机或船上）" },
  china: { ku: "تۆمارکراوە لە کۆگای چین", en: "Registered at our China warehouse", ar: "مسجّل في مستودعنا في الصين", zh: "已在我们的中国仓库登记" },
};

interface ParcelWhere {
  status?: string | null;
  batchId?: number | null;
  registeredInCountryId?: number | null;
}

/**
 * The countries a customer's shipped parcels were registered in.
 *
 * Shipments leave from China, so every one of these is a China depot's
 * country. The portal is not told which countries are origins (that list is
 * the office's); this is how it learns it from what it is told.
 */
export function originCountriesOf(parcels: readonly ParcelWhere[] | null | undefined): Set<number> {
  const ids = new Set<number>();
  for (const p of parcels ?? []) {
    if (p.batchId != null && p.registeredInCountryId != null) ids.add(p.registeredInCountryId);
  }
  return ids;
}

/**
 * Whether a parcel waiting at a depot can be said to be in China.
 *
 * Not when it is known to be elsewhere — a parcel registered at the Erbil
 * depot never went to China, and telling its owner otherwise is the mistake
 * the neutral name above exists to avoid. It is in China when it is packed
 * into a shipment (they leave from China), when it carries no location
 * stamp (everything registered before the stamp came through the China
 * depot), or when its stamp is a country the customer's shipped parcels came
 * from. A stamp from any other country, from a customer who has shipped,
 * is the Erbil depot. A customer who has shipped nothing yet is not told
 * otherwise: nearly every first parcel is registered in China.
 */
export function registeredInChina(parcel: ParcelWhere, originCountries: ReadonlySet<number>): boolean {
  if (parcel.batchId != null || parcel.status === "in_batch") return true;
  if (parcel.registeredInCountryId == null) return true;
  return originCountries.size === 0 || originCountries.has(parcel.registeredInCountryId);
}

/**
 * The words a customer's chip says for a parcel: one of the three places
 * where one fits, the exact name otherwise — «لە گومرگ» for customs (the
 * owner kept it), out for delivery, delivered, returned, cancelled.
 */
export function parcelStatusWords(parcel: ParcelWhere, originCountries: ReadonlySet<number>): L | null {
  const status = String(parcel.status ?? "");
  switch (status) {
    case "ready_for_delivery":
      return PARCEL_WHERE_WORDS.erbil;
    case "in_transit":
      return PARCEL_WHERE_WORDS.onTheWay;
    case "registered":
    case "in_batch":
      return registeredInChina(parcel, originCountries) ? PARCEL_WHERE_WORDS.china : PACKAGE_STATUS_LABEL.registered;
    default:
      return PACKAGE_STATUS_LABEL[status] ?? null;
  }
}
