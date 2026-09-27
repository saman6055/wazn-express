/**
 * How goods travel, said the way a customer thinks of it: by air or by sea.
 *
 * The owner, 2026-09-27, on two screenshots of an AIR shipment: the parcel
 * sheet said «لە ڕێگادایە (لە فڕۆکە یان کەشتیدایە)» — "on a plane or a
 * ship" — about goods we know are on a plane, and the shipment card said
 * «لە ڕێگادا» next to a truck. We always know the mode; the words and the
 * icon now say it: «لە ڕێگای ئاسمانی» with a plane, «لە ڕێگای دەریایی» with a
 * ship. Only when nothing says how it travels does the plain «لە ڕێگادایە»
 * remain — never the either/or.
 *
 * One home for this, read by the parcel chip (lib/packageStatus), the
 * shipment chip and journey (lib/shipmentFilters, BatchJourneyTimeline) and
 * the icon next to them.
 */

type L = { ku: string; en: string; ar: string; zh: string };

export type TravelMode = "air" | "sea";

/** air_regular / air_irregular / air → air; sea → sea; anything else → unknown. */
export function travelModeOf(shippingType: string | null | undefined): TravelMode | null {
  const t = String(shippingType ?? "").toLowerCase();
  if (t === "sea" || t.startsWith("sea_")) return "sea";
  if (t === "air" || t.startsWith("air_")) return "air";
  return null;
}

export const ON_THE_WAY_WORDS: Record<TravelMode | "unknown", L> = {
  air: { ku: "لە ڕێگای ئاسمانی", en: "On the way by air", ar: "في الطريق جوًّا", zh: "空运途中" },
  sea: { ku: "لە ڕێگای دەریایی", en: "On the way by sea", ar: "في الطريق بحرًا", zh: "海运途中" },
  unknown: { ku: "لە ڕێگادایە", en: "On the way", ar: "في الطريق", zh: "运输中" },
};

/** "On the way", in the words of the way it is actually travelling. */
export function onTheWayWords(shippingType: string | null | undefined): L {
  return ON_THE_WAY_WORDS[travelModeOf(shippingType) ?? "unknown"];
}
