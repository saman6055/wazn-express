/**
 * A batch's journey as four steps (owner, 2026-10-27, the batches page
 * redesign): China → on the road → Erbil → delivered. One step per status,
 * so the line on every row says the same thing the status badge does.
 */

export type JourneyStep = 0 | 1 | 2 | 3;

export const JOURNEY_STEPS = [
  { ku: "چین", en: "China", ar: "الصين", zh: "中国" },
  { ku: "لە ڕێگا", en: "On the road", ar: "في الطريق", zh: "运输中" },
  { ku: "هەولێر", en: "Erbil", ar: "أربيل", zh: "埃尔比勒" },
  { ku: "گەیاندرا", en: "Delivered", ar: "تم التسليم", zh: "已交付" },
] as const;

export function journeyStep(status: string | null | undefined): JourneyStep {
  switch (status) {
    case "in_transit":
      return 1;
    case "arrived":
    case "customs":
    case "at_depot":
      return 2;
    case "delivered":
    case "closed":
      return 3;
    default:
      return 0;
  }
}

/** The mark beside a batch: the ship, the plane, or the red plane of an irregular flight (owner). */
export type BatchTypeMark = "sea" | "air" | "air_irregular";

export function batchTypeMark(shippingType: string | null | undefined): BatchTypeMark {
  if (shippingType === "sea") return "sea";
  if (shippingType === "air_irregular") return "air_irregular";
  return "air";
}
