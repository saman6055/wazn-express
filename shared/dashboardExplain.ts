/**
 * Where each figure on the dashboard comes from.
 *
 * The dashboard is twenty-odd numbers and nothing else: no link, no source,
 * no way to ask "which ones?". Every one of them is the end of a query with
 * decisions baked into it — which table, which window, what counts as active,
 * what is excluded — and none of those decisions were visible to the person
 * reading the number every morning.
 *
 * Three of them are worth stating out loud, because a reasonable reader would
 * assume otherwise:
 *
 *  - "income" is money actually received, not invoiced. An unpaid invoice
 *    raised today adds nothing to today's income.
 *  - "this week" is the last seven days, rolling — not Saturday to Friday.
 *    "This month" really is the calendar month, from the 1st.
 *  - "active shipments" is three statuses, not everything before delivery:
 *    a shipment in customs or sitting at the Erbil depot is not counted.
 *
 * Each figure names the list that holds its records, filtered to exactly what
 * it counted, using the shared link vocabulary — so a figure of 6 opens a list
 * of 6. The parts, where a figure has them, come from the server so they add
 * up to the figure rather than to something computed a second way.
 */

import {
  batchesHref,
  customersHref,
  financeHref,
  packagesHref,
  type Localised,
} from "./listLinks";

export type DashboardFigureId =
  | "todayIncome"
  | "weekIncome"
  | "monthIncome"
  | "totalDebt"
  | "newCustomers"
  | "totalCustomers"
  | "activeBatches"
  | "totalPackages"
  | "deliveredPackages";

export interface FigurePart {
  key: string;
  label: Localised;
  /** Money for the income figures, a count for the rest. */
  value: number;
  /** How many records are behind it, when that differs from the value. */
  count?: number;
  href?: string;
}

export interface DashboardFigureMeta {
  id: DashboardFigureId;
  label: Localised;
  /** Money is shown with a currency; a count is not. */
  kind: "money" | "count";
  /** The calculation, in the words the office would use. */
  formula: Localised;
  /** The window, said exactly, because "week" is the one people misread. */
  window?: Localised;
  /** The list holding the records behind it, already filtered. */
  href: string;
  /** What the link opens, so the button can say it. */
  hrefLabel: Localised;
}

const RECEIVED_NOT_INVOICED: Localised = {
  ku: "پارەی وەرگیراو لە کڕیارەکان — نەک ئەوەی پسووڵەی بۆ کراوە. پسووڵەیەکی نەدراو هیچ زیاد ناکات، و ئەوەی گەڕێندراوەتەوە کەم دەکرێتەوە",
  en: "Money actually received from customers — not invoiced. An unpaid invoice adds nothing, and anything reversed is taken back off",
  ar: "الأموال المستلمة فعلياً من العملاء — لا المفوترة. الفاتورة غير المدفوعة لا تضيف شيئاً، وما تم عكسه يُخصم",
  zh: "实际收到的客户款项——不是已开票金额。未付发票不计入，已冲销的会扣除",
};

const PAYMENTS_LIST: Localised = {
  ku: "پارەدانەکان",
  en: "Payments",
  ar: "المدفوعات",
  zh: "付款记录",
};

const FIGURES: Record<DashboardFigureId, DashboardFigureMeta> = {
  todayIncome: {
    id: "todayIncome",
    label: { ku: "داهاتی ئەمڕۆ", en: "Today's income", ar: "دخل اليوم", zh: "今日收入" },
    kind: "money",
    formula: RECEIVED_NOT_INVOICED,
    window: {
      ku: "لە ٠٠:٠٠ی ئەمڕۆوە تا ئێستا. بەراورد لەگەڵ هەموو دوێنێ",
      en: "From 00:00 today until now. Compared against the whole of yesterday",
      ar: "من الساعة ٠٠:٠٠ اليوم حتى الآن. مقارنة بيوم أمس كاملاً",
      zh: "从今天 00:00 至今。与昨天全天相比",
    },
    href: financeHref({ tab: "payments" }),
    hrefLabel: PAYMENTS_LIST,
  },
  weekIncome: {
    id: "weekIncome",
    label: { ku: "داهاتی هەفتە", en: "This week's income", ar: "دخل الأسبوع", zh: "本周收入" },
    kind: "money",
    formula: RECEIVED_NOT_INVOICED,
    window: {
      ku: "٧ ڕۆژی ڕابردوو — نەک لە شەممەوە. بەراورد لەگەڵ ٧ ڕۆژی پێش ئەوان",
      en: "The last 7 days, rolling — not from Saturday. Compared against the 7 days before those",
      ar: "آخر ٧ أيام متتالية — وليس من السبت. مقارنة بالأيام السبعة التي قبلها",
      zh: "最近 7 天（滚动），不是从周六起算。与之前的 7 天相比",
    },
    href: financeHref({ tab: "payments" }),
    hrefLabel: PAYMENTS_LIST,
  },
  monthIncome: {
    id: "monthIncome",
    label: { ku: "داهاتی مانگ", en: "This month's income", ar: "دخل الشهر", zh: "本月收入" },
    kind: "money",
    formula: RECEIVED_NOT_INVOICED,
    window: {
      ku: "لە یەکەمی ئەم مانگەوە. بەراورد لەگەڵ هەمان ماوە لە مانگی ڕابردوو",
      en: "From the 1st of this month. Compared against the same stretch of last month",
      ar: "من اليوم الأول من هذا الشهر. مقارنة بالفترة نفسها من الشهر الماضي",
      zh: "从本月 1 日起。与上月同期相比",
    },
    href: financeHref({ tab: "payments" }),
    hrefLabel: PAYMENTS_LIST,
  },
  totalDebt: {
    id: "totalDebt",
    label: { ku: "کۆی قەرز", en: "Total debt", ar: "إجمالي الديون", zh: "欠款总额" },
    kind: "money",
    formula: {
      ku: "کۆی باڵانسی ئەو کڕیارانەی زیاتریان لەسەرە لەوەی داویانە. کڕیارانی پێشەکیدەر لێی کەم ناکرێنەوە",
      en: "The balances of every customer who owes more than they have paid. Customers in credit are not netted off",
      ar: "أرصدة كل عميل عليه أكثر مما دفع. العملاء الدائنون لا تُخصم أرصدتهم",
      zh: "所有欠款客户的余额合计。预付客户的余额不做抵扣",
    },
    href: "/finance/debtors",
    hrefLabel: { ku: "قەرزدارەکان", en: "Debtors", ar: "المدينون", zh: "欠款客户" },
  },
  newCustomers: {
    id: "newCustomers",
    label: { ku: "کڕیاری نوێ (٧ ڕۆژ)", en: "New customers (7 days)", ar: "عملاء جدد (٧ أيام)", zh: "新客户（7天）" },
    kind: "count",
    formula: {
      ku: "ئەو هەژمارانەی لە ٧ ڕۆژی ڕابردوودا دروستکراون — چالاک بن یان نا",
      en: "Accounts created in the last 7 days, active or not",
      ar: "الحسابات المنشأة خلال آخر ٧ أيام، نشطة كانت أم لا",
      zh: "最近 7 天创建的账户，无论是否启用",
    },
    href: customersHref({ createdWithin: 7 }),
    hrefLabel: { ku: "کڕیارەکان", en: "Customers", ar: "العملاء", zh: "客户" },
  },
  totalCustomers: {
    id: "totalCustomers",
    label: { ku: "کۆی کڕیاران", en: "Total customers", ar: "إجمالي العملاء", zh: "客户总数" },
    kind: "count",
    formula: {
      ku: "هەموو هەژمارەکانی کڕیار — ناچالاکەکانیش تێیدان",
      en: "Every customer account, including the switched-off ones",
      ar: "كل حسابات العملاء، بما فيها المعطّلة",
      zh: "所有客户账户，包括已停用的",
    },
    href: customersHref(),
    hrefLabel: { ku: "کڕیارەکان", en: "Customers", ar: "العملاء", zh: "客户" },
  },
  activeBatches: {
    id: "activeBatches",
    label: { ku: "باچە چالاکەکان", en: "Active shipments", ar: "الشحنات النشطة", zh: "进行中的批次" },
    kind: "count",
    formula: {
      ku: "بارەکانی لە ئامادەکاری، لە ڕێگا و گەیشتوو. ئەوانەی لە گومرگ یان لە کۆگای هەولێرن لێرەدا نەژمێردراون",
      en: "Shipments preparing, in transit or arrived. Ones in customs or at the Erbil depot are not counted here",
      ar: "الشحنات قيد التحضير أو في الطريق أو التي وصلت. تلك في الجمارك أو مستودع أربيل غير محسوبة هنا",
      zh: "准备中、运输中或已抵达的批次。在海关或埃尔比勒仓库的不计入",
    },
    href: batchesHref({ status: "active" }),
    hrefLabel: { ku: "بارەکان", en: "Shipments", ar: "الشحنات", zh: "批次" },
  },
  totalPackages: {
    id: "totalPackages",
    label: { ku: "کۆی پاکێتەکان", en: "Total parcels", ar: "إجمالي الطرود", zh: "包裹总数" },
    kind: "count",
    formula: {
      ku: "هەموو پاکێتێکی تۆمارکراو، لە هەر دۆخێکدا بێت",
      en: "Every parcel ever registered, whatever its status",
      ar: "كل طرد مُسجّل، أياً كانت حالته",
      zh: "所有已登记的包裹，无论状态",
    },
    href: packagesHref(),
    hrefLabel: { ku: "پاکێتەکان", en: "Parcels", ar: "الطرود", zh: "包裹" },
  },
  deliveredPackages: {
    id: "deliveredPackages",
    label: { ku: "گەیەنراوەکان", en: "Delivered", ar: "تم التسليم", zh: "已送达" },
    kind: "count",
    formula: {
      ku: "پاکێتەکانی دۆخیان «گەیەنراو»ە — بەبێ گەڕێندراوە و هەڵوەشێنراوەکان",
      en: "Parcels whose status is delivered — returned and cancelled ones are not included",
      ar: "الطرود التي حالتها «تم التسليم» — المرتجعة والملغاة غير مشمولة",
      zh: "状态为已送达的包裹——不含退回和已取消的",
    },
    href: packagesHref({ tab: "delivered" }),
    hrefLabel: { ku: "پاکێتەکان", en: "Parcels", ar: "الطرود", zh: "包裹" },
  },
};

export const DASHBOARD_FIGURE_IDS = Object.keys(FIGURES) as DashboardFigureId[];

export function figureMeta(id: DashboardFigureId): DashboardFigureMeta {
  return FIGURES[id];
}

/* ─── how the parts add up ──────────────────────────────────────────────── */

/** Compared at two decimals: floats do not land on equality. */
const CENT = 0.005;

export interface FigureReconciliation {
  partTotal: number;
  /** Whether the parts add up to the figure. */
  reconciles: boolean;
}

/**
 * Do the parts add up to the number on the card?
 *
 * Shown either way. A drill-down that quietly disagrees with the figure above
 * it is worse than no drill-down: it is two numbers with equal authority and
 * no way to tell which is wrong.
 */
export function reconcile(value: number, parts: FigurePart[]): FigureReconciliation {
  const partTotal = parts.reduce((sum, p) => sum + (Number.isFinite(p.value) ? p.value : 0), 0);
  return { partTotal, reconciles: Math.abs(partTotal - value) < CENT };
}

export const RECONCILES: Localised = {
  ku: "کۆی پێکهاتەکان = ژمارەی کارتەکە",
  en: "The parts add up to the figure",
  ar: "مجموع الأجزاء يساوي الرقم",
  zh: "各部分之和等于该数字",
};

export const DOES_NOT_RECONCILE: Localised = {
  ku: "کۆی پێکهاتەکان یەکسان نییە بەم ژمارەیە — لە ڕاپۆرتەکە بپشکنە",
  en: "The parts do not add up to this figure — check the report",
  ar: "مجموع الأجزاء لا يساوي هذا الرقم — راجع التقرير",
  zh: "各部分之和与该数字不符——请核对报表",
};

export const NO_PARTS: Localised = {
  ku: "ئەم ژمارەیە بەشی ناوەکی نییە — سەرچاوەکەی لە لیستەکەدایە",
  en: "This figure has no parts — its records are in the list",
  ar: "هذا الرقم بلا أجزاء — سجلاته في القائمة",
  zh: "该数字没有细分——其记录在列表中",
};

/* ─── the words around the panel ────────────────────────────────────────── */

export const HOW_CALCULATED: Localised = {
  ku: "چۆن حیساب کراوە",
  en: "How it is calculated",
  ar: "كيف يُحتسب",
  zh: "如何计算",
};

export const THE_WINDOW: Localised = {
  ku: "کام ماوە",
  en: "Which period",
  ar: "أي فترة",
  zh: "时间范围",
};

export const THE_PARTS: Localised = {
  ku: "پێکهاتەکانی",
  en: "What it is made of",
  ar: "مما يتكوّن",
  zh: "构成部分",
};

export const OPEN_RECORDS: Localised = {
  ku: "بینینی تۆمارەکان",
  en: "See the records",
  ar: "عرض السجلات",
  zh: "查看记录",
};

export const EXPLAIN_HINT: Localised = {
  ku: "کلیک بکە بۆ سەرچاوە",
  en: "Click to see where this came from",
  ar: "اضغط لمعرفة مصدر الرقم",
  zh: "点击查看数据来源",
};
