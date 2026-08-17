/**
 * Everything worth checking, in one list.
 *
 * The auditor account can open every screen, but a reader who has to visit
 * sixty pages to find out whether anything is wrong will visit six and guess
 * about the rest. Worse, the things most worth finding are not on any page:
 * an invoice whose payments exceed its total, a package pointing at a batch
 * that was deleted, a customer balance that has drifted from its own history.
 * Nothing renders those, because no screen was built to show a contradiction.
 *
 * So the checks are declared here — id, what it means, how much it matters —
 * and the server runs them all in one pass. This file holds no queries: it is
 * the catalogue, and it is what the report is written from.
 *
 * The severities are meant literally.
 *
 *   critical — two records that describe the same money disagree. Somebody
 *              has to look today. These do not age well: the longer a
 *              balance is wrong, the more of the business is built on it.
 *   warning  — work that has stopped. Nothing is broken; something is stuck,
 *              and stuck work is invisible until somebody counts it.
 *   info     — worth knowing, nobody needs to act tonight.
 */

export interface Localised {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

export type CheckSeverity = "critical" | "warning" | "info";

export type CheckId =
  | "invoice_total_mismatch"
  | "invoice_paid_but_unbalanced"
  | "account_balance_drift"
  | "cash_account_drift"
  | "partner_books_drift"
  | "ownership_not_whole"
  | "orphan_package_batch"
  | "orphan_transaction_account"
  | "duplicate_customer_code"
  | "duplicate_tracking_number"
  | "negative_weight"
  | "zero_price_sale"
  | "batch_overdue"
  | "batch_unwatched"
  | "package_never_batched"
  | "package_arrived_undelivered"
  | "unclaimed_no_request"
  | "debt_unreminded";

export interface CheckDefinition {
  id: CheckId;
  severity: CheckSeverity;
  title: Localised;
  /** What a non-zero count actually means, in one sentence. */
  meaning: Localised;
  /** Where in the system to go and look. Empty when there is no such screen. */
  path?: string;
}

export const CHECKS: readonly CheckDefinition[] = [
  {
    id: "invoice_total_mismatch",
    severity: "critical",
    path: "/invoices",
    title: {
      ku: "پسووڵە کۆکراوەکەی لەگەڵ ڕیزەکانی ناگونجێت",
      en: "Invoices whose total is not their own lines",
      ar: "فواتير مجموعها لا يطابق بنودها",
      zh: "总额与自身明细不符的发票",
    },
    meaning: {
      ku: "کۆی گشتی لەگەڵ (کۆی بەشەکان + باج) یەک ناگرێتەوە. ئەو پسووڵەیە بۆ مشتەری چووە.",
      en: "The total does not equal subtotal plus tax. That invoice went to a customer.",
      ar: "الإجمالي لا يساوي المجموع الفرعي زائد الضريبة. تلك الفاتورة ذهبت إلى عميل.",
      zh: "总额不等于小计加税额。那张发票已经发给客户了。",
    },
  },
  {
    id: "invoice_paid_but_unbalanced",
    severity: "critical",
    path: "/invoices",
    title: {
      ku: "پسووڵە دۆخەکەی لەگەڵ ڕێکەوتی پارەدانی ناگونجێت",
      en: "Invoices whose status and payment date contradict",
      ar: "فواتير تتناقض حالتها مع تاريخ سدادها",
      zh: "状态与付款日期矛盾的发票",
    },
    meaning: {
      ku: "پسووڵەیەک وەکو پارەدراو نیشانکراوە بەڵام ڕێکەوتی پارەدانی نییە، یان بەپێچەوانەوە. دۆخەکەی بە دەست گۆڕدراوە.",
      en: "An invoice reads as paid with no payment date, or carries a date while still open. The status was changed by hand.",
      ar: "فاتورة تظهر مدفوعة بلا تاريخ سداد، أو تحمل تاريخاً وهي ما زالت مفتوحة. الحالة غُيِّرت يدوياً.",
      zh: "发票显示已付却没有付款日期，或仍未结却带着日期。状态是被手工改过的。",
    },
  },
  {
    id: "account_balance_drift",
    severity: "critical",
    path: "/finance",
    title: {
      ku: "باڵانسی کڕیار لەگەڵ مێژووی خۆی ناگونجێت",
      en: "Customer balances that disagree with their own history",
      ar: "أرصدة عملاء لا تطابق سجلّها",
      zh: "与自身流水不符的客户余额",
    },
    meaning: {
      ku: "باڵانسی خەزنکراو لەگەڵ کۆی لێدوانەکانی خۆی یەک ناگرێتەوە. ئەمە گرنگترین شتە کە دەدۆزرێتەوە.",
      en: "The stored balance does not equal the sum of the account's own transactions. This is the most serious thing on the list.",
      ar: "الرصيد المخزَّن لا يساوي مجموع حركات الحساب نفسه. هذا أخطر ما في القائمة.",
      zh: "存储余额不等于该账户流水之和。这是清单上最严重的问题。",
    },
  },
  {
    id: "cash_account_drift",
    severity: "critical",
    path: "/finance/bank-accounts",
    title: {
      ku: "باڵانسی حسابی کاش ناگونجێت",
      en: "Cash accounts that disagree with their movements",
      ar: "حسابات نقدية لا تطابق حركاتها",
      zh: "与流水不符的现金账户",
    },
    meaning: {
      ku: "باڵانسی حسابەکە لەگەڵ خستنە ناو و دەرهێنانەکانی یەک ناگرێتەوە.",
      en: "The account's balance does not match its deposits less its withdrawals.",
      ar: "رصيد الحساب لا يطابق إيداعاته ناقصاً سحوباته.",
      zh: "账户余额与其存入减支出不符。",
    },
  },
  {
    id: "partner_books_drift",
    severity: "critical",
    path: "/company/partners",
    title: {
      ku: "ژمێری هاوبەش ناگونجێت",
      en: "Partner books that do not reconcile",
      ar: "دفاتر شركاء غير مطابقة",
      zh: "无法对账的合伙人账目",
    },
    meaning: {
      ku: "کۆی جووڵەکانی هاوبەش لەگەڵ باڵانسی خەزنکراوی یەک ناگرێتەوە.",
      en: "A partner's recorded movements do not add up to their stored balance.",
      ar: "حركات الشريك المسجَّلة لا تساوي رصيده المخزَّن.",
      zh: "合伙人的记录变动与其存储余额不符。",
    },
  },
  {
    id: "ownership_not_whole",
    severity: "warning",
    path: "/company/partners",
    title: {
      ku: "ڕێژەی خاوەندارێتی ١٠٠٪ نییە",
      en: "Ownership shares do not total 100%",
      ar: "حصص الملكية لا تساوي ١٠٠٪",
      zh: "所有权比例合计不足 100%",
    },
    meaning: {
      ku: "هەر دابەشکردنێکی قازانج بەشێکی بۆ هیچ کەس دەمێنێتەوە.",
      en: "Every profit distribution leaves a slice assigned to nobody.",
      ar: "كل توزيع أرباح يترك جزءاً بلا مالك.",
      zh: "每次利润分配都会留下一部分无人归属。",
    },
  },
  {
    id: "orphan_package_batch",
    severity: "critical",
    path: "/packages/all",
    title: {
      ku: "پاکەت ئاماژە بە باچێکی نەماو دەکات",
      en: "Packages pointing at a batch that is gone",
      ar: "طرود تشير إلى دفعة غير موجودة",
      zh: "指向已不存在批次的包裹",
    },
    meaning: {
      ku: "پاکەتەکە باچێکی هەیە کە بوونی نییە. لە هیچ لیستێکدا دەرناکەوێت و لە هیچ ڕاپۆرتێکدا ناژمێردرێت.",
      en: "The package names a batch that does not exist. It appears in no list and counts in no report.",
      ar: "الطرد يشير إلى دفعة غير موجودة، فلا يظهر في أي قائمة ولا يُحتسب في أي تقرير.",
      zh: "包裹指向不存在的批次，因此不出现在任何列表、不计入任何报表。",
    },
  },
  {
    id: "orphan_transaction_account",
    severity: "critical",
    path: "/finance",
    title: {
      ku: "لێدوانی دارایی ئاماژە بە حسابێکی نەماو دەکات",
      en: "Ledger entries pointing at an account that is gone",
      ar: "قيود تشير إلى حساب غير موجود",
      zh: "指向已不存在账户的分录",
    },
    meaning: {
      ku: "پارە لە تۆمارەکاندا هەیە بەڵام سەر بە هیچ حسابێک نییە.",
      en: "Money recorded against nobody. It is in the ledger and in no account.",
      ar: "مبالغ مقيَّدة دون حساب. موجودة في الدفتر ولا تخصّ أحداً.",
      zh: "有金额入账却不属于任何账户。",
    },
  },
  {
    id: "duplicate_customer_code",
    severity: "critical",
    path: "/customers",
    title: {
      ku: "کۆدی کڕیاری دووبارە",
      en: "Duplicate customer codes",
      ar: "رموز عملاء مكرَّرة",
      zh: "重复的客户编号",
    },
    meaning: {
      ku: "دوو کڕیار هەمان کۆدیان هەیە. پاکەت دەکرێت بۆ کەسی هەڵە بچێت.",
      en: "Two customers share a code. A parcel can reach the wrong person.",
      ar: "عميلان يتشاركان الرمز نفسه. قد يصل طرد إلى الشخص الخطأ.",
      zh: "两个客户共用一个编号。包裹可能送错人。",
    },
  },
  {
    id: "duplicate_tracking_number",
    severity: "warning",
    path: "/packages/all",
    title: {
      ku: "ژمارەی تراکینگی دووبارە",
      en: "Duplicate tracking numbers",
      ar: "أرقام تتبُّع مكرَّرة",
      zh: "重复的追踪号",
    },
    meaning: {
      ku: "چەند پاکەتێک هەمان ژمارەی تراکینگیان هەیە. یان دوو جار تۆمار کراون، یان تێکەڵ بوونە.",
      en: "Several packages carry the same tracking number — registered twice, or confused with each other.",
      ar: "عدة طرود تحمل رقم التتبُّع نفسه — سُجِّلت مرتين أو اختلطت.",
      zh: "多个包裹使用同一追踪号——重复登记或彼此混淆。",
    },
  },
  {
    id: "negative_weight",
    severity: "warning",
    path: "/packages/all",
    title: {
      ku: "کێشی نەرێنی یان سفر",
      en: "Negative or zero weights",
      ar: "أوزان سالبة أو صفرية",
      zh: "负数或零重量",
    },
    meaning: {
      ku: "پاکەتێک کە کێشی نەرێنییە یان سفرە، نرخەکەی هەڵەیە.",
      en: "A parcel weighing nothing or less than nothing was priced from that number.",
      ar: "طرد بوزن صفري أو سالب جرى تسعيره على هذا الأساس.",
      zh: "重量为零或负数的包裹，其定价就建立在这个数字上。",
    },
  },
  {
    id: "zero_price_sale",
    severity: "warning",
    path: "/commission",
    title: {
      ku: "ئۆردەری فرۆشراو بە نرخی سفر",
      en: "Orders sold at zero",
      ar: "طلبات بيعت بصفر",
      zh: "以零价售出的订单",
    },
    meaning: {
      ku: "ئۆردەرێک بە سفر فرۆشراوە. لەوانەیە بەئەنقەست بێت، بەڵام دەبێت بڕیارێک بێت.",
      en: "An order sold for nothing. It may be deliberate, but it should be a decision.",
      ar: "طلب بيع بلا مقابل. قد يكون متعمَّداً، لكن يجب أن يكون قراراً.",
      zh: "订单售价为零。可以是有意的，但应当是个决定。",
    },
  },
  {
    id: "batch_overdue",
    severity: "warning",
    path: "/batches",
    title: {
      ku: "باچی زیاتر لە ٣٠ ڕۆژ کراوە",
      en: "Batches open more than 30 days",
      ar: "دفعات مفتوحة أكثر من ٣٠ يوماً",
      zh: "开启超过 30 天的批次",
    },
    meaning: {
      ku: "باچێک کە دوا کەوتووە و باچێک کە کەس دایخستووە، لە لیستێکی بەپێی ڕێککەوت وەکو یەک دەردەکەون.",
      en: "A late shipment and one nobody closed look identical on a list sorted by date.",
      ar: "الشحنة المتأخرة والتي لم يغلقها أحد تبدوان متطابقتين في قائمة مرتَّبة بالتاريخ.",
      zh: "延误的批次和无人关闭的批次，在按日期排序的列表里看起来一模一样。",
    },
  },
  {
    id: "batch_unwatched",
    severity: "warning",
    path: "/batches",
    title: {
      ku: "باچی ئاسمانی بەبێ ژمارەی فڕین",
      en: "Air batches with no flight number",
      ar: "دفعات جوّية بلا رقم رحلة",
      zh: "无航班号的空运批次",
    },
    meaning: {
      ku: "چاودێری فرۆکەخانە بە ژمارەی فڕین کاردەکات. بەبێی، هیچ کەس چاودێری ئەم باچە ناکات.",
      en: "The airport watcher matches on the flight number. Without one, nothing is watching this batch.",
      ar: "متابعة المطار تعتمد على رقم الرحلة. بدونه لا شيء يراقب هذه الدفعة.",
      zh: "机场监控依据航班号匹配。没有它，就没有任何东西在盯这个批次。",
    },
  },
  {
    id: "package_never_batched",
    severity: "warning",
    path: "/packages/all",
    title: {
      ku: "پاکەتی تۆمارکراو کە نەخراوەتە هیچ باچێک",
      en: "Packages registered but never put in a batch",
      ar: "طرود مسجَّلة لم تُدرج في أي دفعة",
      zh: "已登记但从未装批的包裹",
    },
    meaning: {
      ku: "لە کۆگا دانراوە و لەبیر کراوە. هەموو ڕۆژێک کە دەڕوات، مشتەرییەک چاوەڕێیە.",
      en: "Sitting in the warehouse, forgotten. Every day it waits, a customer is waiting too.",
      ar: "قابع في المستودع ومنسي. كل يوم ينتظر فيه، هناك عميل ينتظر أيضاً.",
      zh: "留在仓库里被遗忘。它每多等一天，就有一位客户在等。",
    },
  },
  {
    id: "package_arrived_undelivered",
    severity: "warning",
    path: "/packages/all",
    title: {
      ku: "پاکەتی گەیشتوو کە نەگەیەنراوە",
      en: "Packages arrived but never delivered",
      ar: "طرود وصلت ولم تُسلَّم",
      zh: "已抵达但未派送的包裹",
    },
    meaning: {
      ku: "لە هەولێرە و لای مشتەری نییە. پارەکەی وەرنەگیراوە.",
      en: "In Erbil and not with the customer. Nothing has been collected for it.",
      ar: "في أربيل وليست لدى العميل، ولم يُحصَّل عنها شيء.",
      zh: "已在埃尔比勒却未到客户手中，也没有收到任何款项。",
    },
  },
  {
    id: "unclaimed_no_request",
    severity: "info",
    path: "/packages/unclaimed",
    title: {
      ku: "پاکەتی بێ خاوەن بەبێ داواکاری",
      en: "Unclaimed parcels nobody has asked for",
      ar: "طرود بلا مالك ولم يطالب بها أحد",
      zh: "无人认领且无申请的包裹",
    },
    meaning: {
      ku: "خاوەنی نییە و کەسیش داوای نەکردووە. جێگای دەگرێت و کەس بەدوایدا ناگەڕێت.",
      en: "No owner and no claim. It takes up space and nobody is looking for it.",
      ar: "بلا مالك وبلا مطالبة. تشغل مكاناً ولا أحد يبحث عنها.",
      zh: "既无归属也无人申请。占着地方，也没人来找。",
    },
  },
  {
    id: "debt_unreminded",
    severity: "info",
    path: "/finance/debtors",
    title: {
      ku: "قەرزی کۆنتر لە مانگێک بەبێ بیرخستنەوە",
      en: "Debts older than a month with no reminder",
      ar: "ديون تجاوزت الشهر بلا تذكير",
      zh: "超过一个月且未催收的欠款",
    },
    meaning: {
      ku: "قەرزێک کە هیچ کەس داوای نەکردووەتەوە کۆنتر دەبێت، نەک کەمتر.",
      en: "A debt nobody has asked for gets older, not smaller.",
      ar: "الدين الذي لا يطالب به أحد يزداد قِدماً لا نقصاً.",
      zh: "无人催讨的欠款只会变旧，不会变少。",
    },
  },
];

const BY_ID = new Map<CheckId, CheckDefinition>(CHECKS.map((c) => [c.id, c]));

export function checkDefinition(id: CheckId): CheckDefinition | undefined {
  return BY_ID.get(id);
}

/**
 * What one check came back with.
 *
 * `failed` is a first-class outcome, not an exception to swallow. A check
 * whose query breaks must say so: reporting it as clean would be the system
 * telling the owner it looked and found nothing, when it never looked.
 */
export interface CheckResult {
  id: CheckId;
  status: "clean" | "found" | "failed";
  count: number;
  /** A handful of offending rows, enough to go and look. Never the whole set. */
  sample?: unknown[];
  error?: string;
}

export interface SweepSummary {
  critical: number;
  warning: number;
  info: number;
  failed: number;
  clean: number;
  /** True when every check ran and every one came back clean. */
  allClear: boolean;
}

const RANK: Record<CheckSeverity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Worst first, and a failed check ranks with the criticals.
 *
 * Not knowing whether the books balance is not a mild state. It sits above
 * every warning precisely because the reader cannot tell what it is hiding.
 */
export function rankResults(results: readonly CheckResult[]): CheckResult[] {
  return [...results].sort((a, b) => {
    const aFailed = a.status === "failed";
    const bFailed = b.status === "failed";
    if (aFailed !== bFailed) return aFailed ? -1 : 1;

    const aClean = a.status === "clean";
    const bClean = b.status === "clean";
    if (aClean !== bClean) return aClean ? 1 : -1;

    const aSev = checkDefinition(a.id)?.severity ?? "info";
    const bSev = checkDefinition(b.id)?.severity ?? "info";
    if (RANK[aSev] !== RANK[bSev]) return RANK[aSev] - RANK[bSev];

    return b.count - a.count;
  });
}

export function summarise(results: readonly CheckResult[]): SweepSummary {
  const summary: SweepSummary = { critical: 0, warning: 0, info: 0, failed: 0, clean: 0, allClear: false };

  for (const result of results) {
    if (result.status === "failed") {
      summary.failed += 1;
      continue;
    }
    if (result.status === "clean") {
      summary.clean += 1;
      continue;
    }
    summary[checkDefinition(result.id)?.severity ?? "info"] += 1;
  }

  summary.allClear =
    results.length > 0 && summary.clean === results.length;

  return summary;
}

/**
 * The one line that goes at the top of the report.
 *
 * "Nothing to report" is said only when every check ran and every one was
 * clean. If even one failed, the honest headline names that instead — a
 * sweep that could not see everything must not claim everything is fine.
 */
export function headline(summary: SweepSummary): Localised {
  if (summary.failed > 0) {
    return {
      ku: `${summary.failed} پشکنین نەیتوانی کاربکات — ئەنجامەکە تەواو نییە`,
      en: `${summary.failed} checks could not run — this sweep is incomplete`,
      ar: `${summary.failed} فحوصات لم تُنفَّذ — هذه الجولة غير مكتملة`,
      zh: `${summary.failed} 项检查无法运行——本次扫描不完整`,
    };
  }
  if (summary.critical > 0) {
    // Counted in checks, not rows: "2" here means two kinds of thing are
    // wrong, and the list below says how many records each covers. One
    // number that silently mixed both would answer neither question.
    const n = summary.critical;
    return {
      ku: `${n} شت هەیە کە دەبێت ئەمڕۆ سەیر بکرێت`,
      en: n === 1 ? "1 thing needs looking at today" : `${n} things need looking at today`,
      ar: `${n} من الأمور تحتاج نظراً اليوم`,
      zh: `${n} 项问题需要今天处理`,
    };
  }
  if (summary.warning > 0) {
    return {
      ku: `هیچ شتێکی شکاو نییە. ${summary.warning} شت ڕاوەستاون.`,
      en: `Nothing is broken. ${summary.warning} things are stuck.`,
      ar: `لا شيء معطَّل. ${summary.warning} أمور متوقفة.`,
      zh: `没有故障。${summary.warning} 项工作停滞。`,
    };
  }
  if (summary.allClear) {
    return {
      ku: "هەموو پشکنینەکان کاریان کرد و هیچیان شتێکیان نەدۆزییەوە",
      en: "Every check ran and every one came back clean",
      ar: "جميع الفحوصات نُفِّذت وجاءت جميعها سليمة",
      zh: "全部检查均已运行，且全部通过",
    };
  }
  return {
    ku: "هیچ شتێکی گرنگ نییە",
    en: "Nothing that needs acting on",
    ar: "لا شيء يستدعي إجراءً",
    zh: "无需处理的事项",
  };
}
