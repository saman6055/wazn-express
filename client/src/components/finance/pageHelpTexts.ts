import type { PageHelpText } from "./PageHelp";

/** The three plain lines of each finance page (owner, 2026-11-05). */
export const HELP: Record<string, PageHelpText> = {
  goodsOnRoad: {
    what: { ku: "ئەو داواکارییانەی کڕدراون (کاڵاکە پارەی دراوە) بەڵام هێشتا لەسەر حیسابی کڕیار نەنووسراون.", en: "Orders bought (the goods are paid for) but not yet written on the customer's account.", ar: "طلبات مشتراة لم تُقيَّد بعد على حساب العميل.", zh: "已购买但尚未记入客户账户的订单。" },
    how: { ku: "بە نرخی کڕین دەژمێردرێت. کە کاڵاکە دەگات و دەچێتە بۆکس، خۆی لەسەر کڕیار دەنووسرێت و لێرە دەردەچێت.", en: "Counted at cost. When the goods arrive and go into a box they are written on the customer and leave this list.", ar: "يُحسب بسعر الشراء؛ عند الوصول والدخول في صندوق يُقيَّد على العميل.", zh: "按成本计算；到货入箱后记入客户并离开此列表。" },
    use: { ku: "ئەوەی زیاتر لە 90 ڕۆژە (سوور) بپشکنە: گەیشتووە و نەنووسراوە؟ یان ون بووە؟ بە دوگمەکانی هەر ڕیزێک یەکلای بکەرەوە.", en: "Check anything over 90 days (red): arrived and not written, or lost? Settle it with the row's buttons.", ar: "افحص ما تجاوز 90 يوماً: وصل ولم يُقيَّد أم ضاع؟", zh: "检查超过 90 天的（红色）：已到未记账还是丢失？" },
  },
  extraCosts: {
    what: { ku: "تێچووی زیادە لەسەر بۆکس: گومرگ، پشکنین، دووبارە پێچانەوە.", en: "Extra costs on a box: customs, inspection, repacking.", ar: "تكاليف إضافية على الصندوق: جمارك، فحص، إعادة تغليف.", zh: "箱子附加费用：海关、检查、重新包装。" },
    how: { ku: "کۆمپانیا چەندی دا، و چەندی لە کڕیار نووسرا. جیاوازییەکەی قازانج یان زیانە و دەچێتە قازانجی خاوێن.", en: "What the company paid and what was charged to the customer; the difference is profit or loss and goes into clean profit.", ar: "ما دفعته الشركة وما قُيِّد على العميل؛ الفرق ربح أو خسارة.", zh: "公司支付与向客户收取之差计入净利润。" },
    use: { ku: "تەنها کاتێک کاردەکات کە لە ناو بۆکسێک «تێچووی تر» زیاد بکەیت. ئەگەر بەتاڵە، واتە هیچ زیادەیەک نەنووسراوە.", en: "Only fills when you add an \"other cost\" inside a box. Empty means none was written.", ar: "يمتلئ فقط عند إضافة «تكلفة أخرى» داخل صندوق.", zh: "仅在箱内添加“其他费用”时才有数据。" },
  },
  yuanRates: {
    what: { ku: "مێژووی نرخی یوان: هەر نرخێک کەی دانرا و چەند داواکاری بەو نرخە کڕدراون.", en: "The yuan rate history: when each rate was set and how many orders were bought at it.", ar: "سجل سعر اليوان ومتى وُضع كل سعر وكم طلباً اشتُري به.", zh: "人民币汇率历史：每个汇率设定时间及按此购买的订单数。" },
    how: { ku: "بۆ هەر ماوەیەک: کۆی یوان و دۆلاری ئەو داواکارییانە.", en: "For each stretch: the total yuan and dollars of those orders.", ar: "لكل فترة: مجموع اليوان والدولار لتلك الطلبات.", zh: "每段时间：这些订单的人民币与美元合计。" },
    use: { ku: "نرخی ڕاستەقینەی کڕینی یوانی ئەو ماوەیە بنووسە: سیستەم پێت دەڵێت لە جیاوازیی نرخ چەند قازانج یان زیانت کردووە.", en: "Type the real rate you bought yuan at for that stretch: the system tells you what the rate difference earned or lost.", ar: "اكتب سعر الشراء الحقيقي لتعرف ربح أو خسارة فرق السعر.", zh: "输入该期间真实购汇汇率，系统显示汇差盈亏。" },
  },
  debtors: {
    what: { ku: "هەموو ئەو کڕیارانەی قەرزیان لەسەرە، بەپێی تەمەنی قەرزەکە.", en: "Every customer who owes, by how old the debt is.", ar: "كل العملاء المدينين حسب عمر الدين.", zh: "所有欠款客户，按欠款时长。" },
    how: { ku: "لە حیسابی هەر کڕیارێکەوە. حیسابی ناوخۆی کۆمپانیا تێیدا نییە. تەمەن لە کۆنترین قەرزی نەدراوەوە دەژمێردرێت.", en: "From each customer's account; the company's own account is not in it. Age runs from the oldest unpaid charge.", ar: "من حساب كل عميل دون حساب الشركة؛ العمر من أقدم دين.", zh: "来自各客户账户，不含公司账户；时长从最早未付算起。" },
    use: { ku: "سەرەتا ئەوانەی زیاتر لە 30 ڕۆژن. لە «یادخستنەوەی قەرزداران» بە واتسئەپ بیریان بخەرەوە.", en: "Start with those over 30 days. Remind them on WhatsApp from Debt reminders.", ar: "ابدأ بمن تجاوز 30 يوماً وذكّرهم عبر واتساب.", zh: "先处理超过 30 天的，通过 WhatsApp 提醒。" },
  },
  payments: {
    what: { ku: "هەموو ئەو پارانەی وەرگیراون (نەک ئەوانەی دەبێت بدرێن): هەر وەسڵێک یەک ڕیزە.", en: "Every payment received (not what is owed): one row per receipt.", ar: "كل المدفوعات المستلمة (لا المستحقة).", zh: "所有已收款项（非应付）。" },
    how: { ku: "کارتەکانی سەرەوە کۆی دوایین 300 پارەدانن بەپێی شێواز: کاش، بانک، کارت. قەرەبوو لێرە نییە چونکە پارە نییە.", en: "The cards add the last 300 payments by method: cash, bank, card. Compensation is not here; it is not money.", ar: "البطاقات مجموع آخر 300 دفعة حسب الطريقة؛ التعويض ليس هنا.", zh: "卡片为最近 300 笔按方式汇总；补偿不在此。" },
    use: { ku: "بۆ دۆزینەوەی پارەیەک گەڕان بکە. بۆ هەڵوەشاندنەوەی پارەیەکی هەڵە، لە پرۆفایلی داراییی کڕیارەکەوە بیکە.", en: "Search to find a payment. To undo a wrong one, do it from the customer's finance profile.", ar: "ابحث عن دفعة؛ لإلغاء دفعة خاطئة استخدم ملف العميل.", zh: "搜索查找付款；撤销错误付款请在客户财务档案中操作。" },
  },
  finance: {
    what: { ku: "دارایی کڕیاران: قەرز، کریدیت و هەموو جووڵەکانی حیسابیان.", en: "Customers' finance: debt, credit and every movement on their accounts.", ar: "مالية العملاء: الديون والأرصدة والحركات.", zh: "客户财务：欠款、余额及所有变动。" },
    how: { ku: "«کۆی قەرز» = ئەوەی کڕیاران لەسەریانە. «باڵانسی نێت» = کۆی قەرز کەم ئەو پارەیەی کڕیاران پێشەکی لای ئێمە داناوە (کریدیت).", en: "\"Total debt\" = what customers owe. \"Net balance\" = total debt less the money customers left with us in advance (credit).", ar: "«مجموع الدين» ما على العملاء؛ «الرصيد الصافي» = الدين ناقص الرصيد المدفوع مقدماً.", zh: "“总欠款”=客户所欠；“净余额”=总欠款减客户预存。" },
    use: { ku: "کلیک لەسەر هەر کڕیارێک بۆ بینینی ئەوەی بۆچی قەرزارە. بۆ تۆمارکردنی قەرەبوو، شێوازی «قەرەبوو — پارە نییە» هەڵبژێرە.", en: "Click a customer to see why they owe. To record compensation, pick the \"Compensation — not money\" method.", ar: "اضغط على عميل لمعرفة سبب الدين؛ للتعويض اختر «تعويض — ليس مالاً».", zh: "点击客户查看欠款原因；记录补偿请选“补偿—非收款”。" },
  },
};
