/**
 * Things a customer can be given, one customer at a time.
 *
 * A feature the office is not ready to show everybody has usually had two
 * options: leave it on for all, or switch it off for all. Both are blunt. The
 * useful third one is to hand it to the customers it suits — a VIP, a
 * long-standing account, someone who has asked for it — and watch how it goes
 * before opening it wider.
 *
 * So this is a catalogue of grantable features, and a customer holds a list of
 * the ones they have. Nothing here is a permission in the security sense: every
 * one of these screens is already scoped to the customer's own data, and a
 * customer without the grant is not being kept away from anything dangerous.
 * They are simply not being shown it yet.
 */

export interface Localised {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

export type FeatureId = "finance_detail";

export interface FeatureDefinition {
  id: FeatureId;
  name: Localised;
  /** What the customer will be able to see. Written for the person granting it. */
  description: Localised;
}

export const FEATURES: readonly FeatureDefinition[] = [
  {
    id: "finance_detail",
    name: {
      ku: "پسووڵەی وردی باچ و سندوق",
      en: "Itemised batch and box invoices",
      ar: "فواتير مفصّلة للدفعات والصناديق",
      zh: "批次与箱子的明细账单",
    },
    description: {
      ku: "لە بەشی دارایی، مشتەری هەر باچ و هەر سندوقێکی خۆی بەرید بە بەرید دەبینێت — تێچووی کڕین، کرێی گواستنەوە، کێش، و کۆی گشتی.",
      en: "In their finance section, the customer sees each batch and box parcel by parcel — what the goods cost, what the carriage was, the weight, and the total.",
      ar: "في قسم الحسابات، يرى العميل كل دفعة وكل صندوق طرداً طرداً — قيمة البضاعة، أجرة الشحن، الوزن، والإجمالي.",
      zh: "在账目板块中，客户可逐件查看每个批次和箱子——货款、运费、重量与合计。",
    },
  },
];

const BY_ID = new Map<FeatureId, FeatureDefinition>(FEATURES.map((f) => [f.id, f]));

export function featureDefinition(id: string): FeatureDefinition | undefined {
  return BY_ID.get(id as FeatureId);
}

export function isKnownFeature(id: string): id is FeatureId {
  return BY_ID.has(id as FeatureId);
}

/**
 * Does this customer hold this feature?
 *
 * Takes the whole granted list rather than a boolean so that every screen asks
 * the same question of the same data. A missing or unloaded list answers no,
 * which is the safe direction: showing a tab that then fails is worse than a
 * tab appearing a moment late.
 */
export function hasFeature(granted: readonly string[] | null | undefined, id: FeatureId): boolean {
  return Array.isArray(granted) && granted.includes(id);
}
