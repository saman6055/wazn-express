/**
 * Where a figure on the finance dashboard came from.
 *
 * A number like "کۆی داهات $12,340" is the end of a computation, and the
 * screen throws away everything about how it got there. Answering "where did
 * this come from" meant reading the SQL.
 *
 * So each headline figure declares its parts. Two rules make this trustworthy
 * rather than decorative:
 *
 * 1. The explanation is DERIVED from the same object the dashboard renders,
 *    never re-queried. A second query would be a second answer, and the two
 *    would drift — which is the problem, not the fix.
 *
 * 2. The parts must add up to the whole. That is asserted in the tests, so a
 *    figure that stops reconciling fails there rather than in a report months
 *    later. When the parts do not sum, something is genuinely wrong with the
 *    arithmetic — the drill-down is a bug detector as much as an explanation.
 *
 * Pure functions over a plain object, so all of this is testable without a
 * database.
 */

export type FigureId =
  | "totalRevenue"
  | "totalExpenses"
  | "netProfit";

export interface Localised {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

export interface ExplainComponent {
  key: string;
  label: Localised;
  value: number;
  /** How many source records are behind it, when we know. */
  count?: number;
  /** Where the reader can go to see those records. */
  href?: string;
}

export interface FigureExplanation {
  figure: FigureId;
  label: Localised;
  /** The number as the dashboard shows it. */
  value: number;
  /** The calculation, in words. */
  formula: Localised;
  components: ExplainComponent[];
  /** Sum of the components. Equal to `value` when the figure reconciles. */
  componentTotal: number;
  reconciles: boolean;
  /** Said plainly when the label and the arithmetic disagree. */
  caveat?: Localised;
}

/** The shape this reads from — a subset of getComprehensiveDashboardStats. */
export interface DashboardStatsLike {
  revenueBySource?: {
    batchProfit?: {
      air_regular?: { revenue?: number; cost?: number; profit?: number; count?: number };
      air_irregular?: { revenue?: number; cost?: number; profit?: number; count?: number };
      sea?: { revenue?: number; cost?: number; profit?: number; count?: number };
      total?: number;
    };
    fullPackage?: { revenue?: number; cost?: number; profit?: number; count?: number };
    commission?: { totalCommission?: number; count?: number };
    service?: { revenue?: number; cost?: number; profit?: number; count?: number };
    deliveryBox?: { totalCharge?: number; totalCost?: number; totalProfit?: number; boxCount?: number };
    totalRevenue?: number;
  };
  expenseBreakdown?: {
    total?: number;
    categories?: Array<{
      id: number;
      nameEn?: string | null;
      nameKu?: string | null;
      icon?: string | null;
      amount?: number;
      count?: number;
    }>;
  };
  profitLoss?: {
    totalRevenue?: number;
    totalExpenses?: number;
    netProfit?: number;
  };
}

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(x) ? x : 0;
};

/** Money compared at two decimal places — floats do not land on equality. */
const CENT = 0.005;
export function sameMoney(a: number, b: number): boolean {
  return Math.abs(a - b) < CENT;
}

/**
 * What this figure is, said plainly.
 *
 * It was labelled "total revenue" and is nothing of the kind: every part of
 * it contributes `profit`, its revenue less its own cost. The net profit
 * below it was therefore right — gross profit less operating expenses — but
 * the top line was misnamed, and a reader comparing it against sales would
 * have been confused for a long time before finding out why. The label is
 * fixed now; this stays because "gross profit" still needs saying out loud
 * to anyone reading a figure made of seven different sources.
 */
const WHAT_GROSS_PROFIT_MEANS: Localised = {
  ku: "ئەمە قازانجی سەرەتاییە نەک داهاتی خاو — تێچووی هەر سەرچاوەیەک پێشتر لێی کەمکراوەتەوە. خەرجییە گشتییەکان لە قازانجی خاوێندا کەم دەکرێنەوە",
  en: "This is gross profit, not raw revenue — each source's own cost is already deducted. Operating expenses come off separately, in net profit",
  ar: "هذا هو الربح الإجمالي وليس الإيراد الخام — تكلفة كل مصدر مخصومة بالفعل. المصروفات التشغيلية تُخصم لاحقاً في صافي الربح",
  zh: "这是毛利而非营业额 — 每个来源的成本已扣除。营运支出在净利润中另行扣除",
};

export function explainTotalRevenue(stats: DashboardStatsLike): FigureExplanation {
  const src = stats.revenueBySource ?? {};
  const batch = src.batchProfit ?? {};

  const components: ExplainComponent[] = [
    {
      key: "air_regular",
      label: { ku: "هەوایی ئاسایی", en: "Air regular", ar: "جوي عادي", zh: "普通空运" },
      value: n(batch.air_regular?.profit),
      count: n(batch.air_regular?.count),
      href: "/reports/batches",
    },
    {
      key: "air_irregular",
      label: { ku: "هەوایی تایبەت", en: "Air irregular", ar: "جوي خاص", zh: "特殊空运" },
      value: n(batch.air_irregular?.profit),
      count: n(batch.air_irregular?.count),
      href: "/reports/batches",
    },
    {
      key: "sea",
      label: { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" },
      value: n(batch.sea?.profit),
      count: n(batch.sea?.count),
      href: "/reports/batches",
    },
    {
      key: "fullPackage",
      label: { ku: "پاکێجی تەواو", en: "Full package", ar: "حزمة كاملة", zh: "完整套餐" },
      value: n(src.fullPackage?.profit),
      count: n(src.fullPackage?.count),
      href: "/full-package",
    },
    {
      key: "commission",
      label: { ku: "کڕین بە عمولە", en: "Commission", ar: "عمولة", zh: "代购佣金" },
      value: n(src.commission?.totalCommission),
      count: n(src.commission?.count),
      href: "/commission",
    },
    {
      key: "service",
      label: { ku: "خزمەتگوزارییەکان", en: "Services", ar: "الخدمات", zh: "服务" },
      value: n(src.service?.profit),
      count: n(src.service?.count),
      href: "/reports/services",
    },
    {
      key: "deliveryBox",
      label: { ku: "سندوقی گەیاندن", en: "Delivery boxes", ar: "صناديق التسليم", zh: "配送箱" },
      value: n(src.deliveryBox?.totalProfit),
      count: n(src.deliveryBox?.boxCount),
      href: "/packages",
    },
  ];

  const value = n(stats.profitLoss?.totalRevenue ?? src.totalRevenue);
  const componentTotal = components.reduce((sum, c) => sum + c.value, 0);

  return {
    figure: "totalRevenue",
    label: { ku: "قازانجی سەرەتایی", en: "Gross profit", ar: "الربح الإجمالي", zh: "毛利" },
    value,
    formula: {
      ku: "کۆی قازانجی هەر سەرچاوەیەک: باچە هەوایی و دەریاییەکان + پاکێجی تەواو + عمولە + خزمەتگوزاری + سندوقی گەیاندن",
      en: "The profit of each source added together: air and sea batches + full package + commission + services + delivery boxes",
      ar: "مجموع ربح كل مصدر: الدفعات الجوية والبحرية + الحزمة الكاملة + العمولة + الخدمات + صناديق التسليم",
      zh: "各来源利润之和：空运与海运批次 + 完整套餐 + 佣金 + 服务 + 配送箱",
    },
    components,
    componentTotal,
    reconciles: sameMoney(value, componentTotal),
    caveat: WHAT_GROSS_PROFIT_MEANS,
  };
}

export function explainTotalExpenses(stats: DashboardStatsLike): FigureExplanation {
  const categories = stats.expenseBreakdown?.categories ?? [];

  const components: ExplainComponent[] = categories.map((c) => ({
    key: String(c.id),
    label: {
      ku: c.nameKu || c.nameEn || "—",
      en: c.nameEn || c.nameKu || "—",
      ar: c.nameEn || "—",
      zh: c.nameEn || "—",
    },
    value: n(c.amount),
    count: n(c.count),
    href: "/company/expenses",
  }));

  const value = n(stats.profitLoss?.totalExpenses ?? stats.expenseBreakdown?.total);
  const componentTotal = components.reduce((sum, c) => sum + c.value, 0);

  return {
    figure: "totalExpenses",
    label: { ku: "کۆی خەرجی", en: "Total expenses", ar: "إجمالي المصروفات", zh: "总支出" },
    value,
    formula: {
      ku: "کۆی هەموو خەرجییە تۆمارکراوەکان لەم ماوەیەدا، بەپێی پۆل",
      en: "Every expense recorded in this period, added up by category",
      ar: "مجموع كل المصروفات المسجلة في هذه الفترة حسب الفئة",
      zh: "本期记录的所有支出，按类别汇总",
    },
    components,
    componentTotal,
    reconciles: sameMoney(value, componentTotal),
  };
}

export function explainNetProfit(stats: DashboardStatsLike): FigureExplanation {
  const revenue = n(stats.profitLoss?.totalRevenue);
  const expenses = n(stats.profitLoss?.totalExpenses);
  const value = n(stats.profitLoss?.netProfit);

  const components: ExplainComponent[] = [
    {
      key: "grossProfit",
      label: { ku: "قازانجی سەرەتایی", en: "Gross profit", ar: "الربح الإجمالي", zh: "毛利" },
      value: revenue,
    },
    {
      key: "expenses",
      label: { ku: "خەرجییەکان", en: "Expenses", ar: "المصروفات", zh: "支出" },
      // Shown as the negative it is, so the column adds up on the page the
      // way it does in the arithmetic.
      value: -expenses,
      href: "/company/expenses",
    },
  ];

  const componentTotal = components.reduce((sum, c) => sum + c.value, 0);

  return {
    figure: "netProfit",
    label: { ku: "قازانجی خاوێن", en: "Net profit", ar: "صافي الربح", zh: "净利润" },
    value,
    formula: {
      ku: "قازانجی سەرەتایی − کۆی خەرجییەکان",
      en: "Gross profit − total expenses",
      ar: "الربح الإجمالي − إجمالي المصروفات",
      zh: "毛利 − 总支出",
    },
    components,
    componentTotal,
    reconciles: sameMoney(value, componentTotal),
  };
}

const EXPLAINERS: Record<FigureId, (stats: DashboardStatsLike) => FigureExplanation> = {
  totalRevenue: explainTotalRevenue,
  totalExpenses: explainTotalExpenses,
  netProfit: explainNetProfit,
};

export const EXPLAINABLE_FIGURES = Object.keys(EXPLAINERS) as FigureId[];

/** Explain one figure from the very object the dashboard is rendering. */
export function explainFigure(figure: FigureId, stats: DashboardStatsLike): FigureExplanation {
  return EXPLAINERS[figure](stats);
}

/** Explain every figure — used by the tests to check they all reconcile. */
export function explainAll(stats: DashboardStatsLike): FigureExplanation[] {
  return EXPLAINABLE_FIGURES.map((figure) => explainFigure(figure, stats));
}
