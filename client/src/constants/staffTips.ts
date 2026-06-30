// Localized staff tips ("tip of the day") + motivation messages, shown by
// <StaffTips/>. Four languages: ku / en / ar / zh. Tips marked with detail+
// example are the technical ones worth explaining; the rest are short reminders.

export type TipLang = "ku" | "en" | "ar" | "zh";
export type Localized = Record<TipLang, string>;

export interface StaffTip {
  id: string;
  short: Localized;
  detail?: Localized;
  example?: Localized;
}

export interface MotivationMessage {
  id: string;
  /** Contains the literal {name} placeholder, replaced with the staff name. */
  text: Localized;
}

export const STAFF_TIPS: StaffTip[] = [
  { id: "tip-1", short: {
    ku: "هەمیشە لە کاتی تۆمارکردنی ئۆردەری نوێ ئاگاداربە — لەسەر موشتەری هەڵە تۆماری مەکە.",
    en: "When registering a new order, double-check the customer — never enter it on the wrong one.",
    ar: "عند تسجيل طلب جديد، تحقّق من العميل — لا تسجّله على العميل الخطأ.",
    zh: "登记新订单时务必核对客户，切勿登记到错误的客户名下。" } },
  { id: "tip-2", short: {
    ku: "پێش پاشەکەوتکردن، دووجار کۆد و ناوی موشتەری بپشکنە.",
    en: "Before saving, re-check the customer's code and name twice.",
    ar: "قبل الحفظ، راجِع رمز العميل واسمه مرّتين.",
    zh: "保存前，请再次核对客户的编号和姓名。" } },
  { id: "tip-3", short: {
    ku: "ئەگەر تراکینگ ئامادە بوو، لە کاتی تۆمارکردنەوە داخڵی بکە — دواتر کاتت کەم دەکاتەوە.",
    en: "If the tracking number is ready, enter it while registering — it saves time later.",
    ar: "إذا كان رقم التتبّع جاهزاً، أدخِله أثناء التسجيل — يوفّر وقتك لاحقاً.",
    zh: "如果已有运单号，登记时一并录入，可节省后续时间。" } },
  { id: "tip-4", short: {
    ku: "جۆری کاڵا و عەدەد بە وردی پڕبکەرەوە — کاریگەری ڕاستەوخۆی لەسەر نرخ هەیە.",
    en: "Fill in the product type and quantity carefully — they directly affect the price.",
    ar: "املأ نوع المنتج والكمية بدقّة — لهما تأثير مباشر على السعر.",
    zh: "仔细填写商品类型和数量，它们直接影响价格。" } },
  { id: "tip-5", short: {
    ku: "وێنەی کاڵا زیاد بکە — لە کاتی گەیاندندا ناسینەوەی پاکەت ئاسانتر دەکات.",
    en: "Add a product photo — it makes the package easier to identify at delivery.",
    ar: "أضِف صورة للمنتج — تُسهّل التعرّف على الطرد عند التسليم.",
    zh: "添加商品照片，便于交付时识别包裹。" } },
  { id: "tip-6", short: {
    ku: "ئۆردەر نەمبەری دووبارە داخڵ مەکە — هەر ئۆردەرێک ئۆردەر نەمبەرێکی ناوازەی هەیە.",
    en: "Don't reuse an order number — each order has a unique one.",
    ar: "لا تُكرّر رقم الطلب — لكل طلب رقم فريد.",
    zh: "不要重复使用订单号——每个订单都有唯一编号。" } },
  { id: "tip-7", short: {
    ku: "ئۆردەری بێ تراکینگ زۆر مەهێڵەرەوە — لە «ئاگاداری تراکینگ» بەردەوام بیانپشکنە.",
    en: "Don't leave orders without tracking for long — check them in \"Tracking alerts\".",
    ar: "لا تترك الطلبات بدون تتبّع طويلاً — تابِعها في «تنبيهات التتبّع».",
    zh: "不要让订单长期没有运单号——在「追踪提醒」中及时查看。" } },
  { id: "tip-8", short: {
    ku: "پێش داخستنی بۆکس، دووبارە هەموو پاکەتەکان سکان بکە تاکو هیچ پاکێجێک لە یاد نەچێت.",
    en: "Before sealing a box, re-scan every package so none is forgotten.",
    ar: "قبل إغلاق الصندوق، أعِد مسح كل الطرود حتى لا يُنسى أيٌّ منها.",
    zh: "封箱前重新扫描所有包裹，确保不遗漏任何一个。" } },
  { id: "tip-9", short: {
    ku: "نرخی گواستنەوەی بۆکس پشکنین بکە پێش ناردن — دوای ناردن گۆڕینی ئاستەمە.",
    en: "Check the box's shipping price before sending — it's hard to change afterwards.",
    ar: "تحقّق من سعر شحن الصندوق قبل الإرسال — تغييره لاحقاً صعب.",
    zh: "发货前核对箱子的运费——发货后很难更改。" } },
  { id: "tip-10", short: {
    ku: "پاکەتە بێخاوەنەکان زوو خاوەنیان بدۆزەرەوە — درەنگکەوتن دەبێتە کێشە.",
    en: "Find owners for unclaimed packages quickly — delays cause problems.",
    ar: "ابحث عن أصحاب الطرود غير المطالَب بها بسرعة — التأخير يسبّب مشاكل.",
    zh: "尽快为无主包裹找到主人——拖延会带来麻烦。" } },
  { id: "tip-11", short: {
    ku: "ژمارەی مۆبایلی کڕیار بە دروستی تۆمار بکە — بۆ ئاگادارکردنەوەکان گرنگە.",
    en: "Record the customer's phone number correctly — it matters for notifications.",
    ar: "سجّل رقم هاتف العميل بشكل صحيح — مهم للإشعارات.",
    zh: "正确录入客户的手机号——这对通知很重要。" } },
  { id: "tip-12", short: {
    ku: "جۆری خزمەتی کڕیار دیاری بکە (پاکێجی تەواو / کرین بە تێچوو / سێلف ئۆردەر) بۆ فلتەری خێراتر.",
    en: "Set the customer's service types (full package / cost purchase / self order) for faster filtering.",
    ar: "حدّد أنواع خدمة العميل (الطرد الكامل / الشراء بالتكلفة / الطلب الذاتي) لتصفية أسرع.",
    zh: "设置客户的服务类型（完整包裹 / 成本代购 / 自购订单），便于快速筛选。" } },
  { id: "tip-13", short: {
    ku: "زانیاریی کڕیار تەواو پڕبکەرەوە — داتای ناتەواو دواتر دەبێتە کێشە.",
    en: "Fill in the customer's details completely — incomplete data causes problems later.",
    ar: "املأ بيانات العميل كاملةً — البيانات الناقصة تسبّب مشاكل لاحقاً.",
    zh: "完整填写客户信息——信息不全日后会出问题。" } },
  { id: "tip-14",
    short: {
      ku: "پێش گۆڕینی نرخی ئۆردەری چارجکراو، دڵنیابە — کاریگەری لەسەر والێتی کڕیار هەیە.",
      en: "Before changing the price of a charged order, be sure — it affects the customer's wallet.",
      ar: "قبل تغيير سعر طلب مُحصّل، تأكّد — فهو يؤثّر على محفظة العميل.",
      zh: "更改已计费订单的价格前请确认——它会影响客户钱包。" },
    detail: {
      ku: "کاتێک ئۆردەرێک چارج دەکرێت، نرخەکەی لە حسابی کڕیار دادەنرێت. گۆڕینی نرخ دوای چارج، باڵانسی کڕیار دەگۆڕێت — بۆیە سیستەم هۆکارت لێ دەخوازێت بۆ تۆماری مێژوو.",
      en: "Once an order is charged, its amount sits on the customer's account. Changing the price after that shifts the customer's balance — so the system asks for a reason for the audit trail.",
      ar: "بمجرّد تحصيل الطلب، يُسجَّل مبلغه على حساب العميل. تغيير السعر بعدها يُغيّر رصيد العميل — لذا يطلب النظام سبباً للسجل.",
      zh: "订单一旦计费，其金额便记入客户账户。之后更改价格会改变客户余额，因此系统会要求填写原因以留存记录。" },
    example: {
      ku: "ئۆردەرێک بە $50 چارج کراوە. ئەگەر بیکەیتە $60، سیستەم $10ـی زیادە لە حسابی کڕیار دادەنێت و هۆکارت لێ دەخوازێت.",
      en: "An order was charged at $50. If you make it $60, the system bills the extra $10 to the customer and asks for a reason.",
      ar: "طلب حُصّل بمبلغ 50$. إذا جعلته 60$، يحتسب النظام 10$ الإضافية على العميل ويطلب سبباً.",
      zh: "某订单已按 50 美元计费。若改为 60 美元，系统会向客户收取额外的 10 美元并要求填写原因。" } },
  { id: "tip-15", short: {
    ku: "پارەی پێشەکی بە وردی تۆمار بکە — دواتر چارەسەری ئاستەمە.",
    en: "Record advance payments carefully — they're hard to fix later.",
    ar: "سجّل الدفعات المقدّمة بدقّة — يصعب تصحيحها لاحقاً.",
    zh: "认真登记预付款——日后很难更正。" } },
  { id: "tip-16", short: {
    ku: "کڕیارە قەرزدارەکان لە داشبۆرد چاودێری بکە.",
    en: "Keep an eye on debtor customers from the dashboard.",
    ar: "راقِب العملاء المدينين من لوحة التحكم.",
    zh: "在仪表板上留意欠款客户。" } },
  { id: "tip-17", short: {
    ku: "ئۆردەری گەورە (زیاتر لە $1000) چاوت لەسەر بێت.",
    en: "Keep an eye on large orders (over $1000).",
    ar: "راقِب الطلبات الكبيرة (أكثر من 1000$).",
    zh: "留意大额订单（超过 1000 美元）。" } },
  { id: "tip-18", short: {
    ku: "قازانج و خەرجیی ڕۆژانە لە داشبۆرد بپشکنە.",
    en: "Review daily profit and expenses on the dashboard.",
    ar: "راجِع الأرباح والمصاريف اليومية في لوحة التحكم.",
    zh: "在仪表板上查看每日利润和支出。" } },
  { id: "tip-19", short: {
    ku: "پێش ناردن، دڵنیابە پاکەتەکان لە باچی دروستدان.",
    en: "Before shipping, make sure the packages are in the correct batch.",
    ar: "قبل الشحن، تأكّد أن الطرود في الدفعة الصحيحة.",
    zh: "发货前，确认包裹在正确的批次中。" } },
  { id: "tip-20",
    short: {
      ku: "نرخی هەر باچێک (تێچوو/نرخ) بە وردی دابنێ — قازانج لێوەی دەردەچێت.",
      en: "Set each batch's rates (cost/price) carefully — profit is derived from them.",
      ar: "اضبط أسعار كل دفعة (التكلفة/السعر) بدقّة — يُحتسب الربح منها.",
      zh: "认真设置每个批次的费率（成本/售价）——利润由此计算。" },
    detail: {
      ku: "هەر باچێک دوو ڕێژەی هەیە: تێچوو (ئەوەی تۆ دەیدەیت) و نرخ (ئەوەی لە کڕیار وەردەگریت). قازانج = نرخ − تێچوو. ئەگەر بە هەڵە دایبنێیت، قازانجی هەموو پاکەتەکانی باچ هەڵە دەبێت.",
      en: "Each batch has two rates: cost (what you pay) and price (what you charge the customer). Profit = price − cost. If set wrong, the profit on every package in the batch is wrong.",
      ar: "لكل دفعة سعران: التكلفة (ما تدفعه) والسعر (ما تتقاضاه من العميل). الربح = السعر − التكلفة. إذا أُدخِل خطأً، يصبح ربح كل طرد في الدفعة خاطئاً.",
      zh: "每个批次有两个费率：成本（你的支出）和售价（向客户收取）。利润 = 售价 − 成本。设置错误会导致该批次所有包裹的利润都出错。" },
    example: {
      ku: "ئاسمانی: تێچوو $4/kg، نرخ $7/kg → قازانج $3 بۆ هەر کیلۆیەک.",
      en: "Air: cost $4/kg, price $7/kg → $3 profit per kg.",
      ar: "جوّي: التكلفة 4$/كغ، السعر 7$/كغ → ربح 3$ لكل كغ.",
      zh: "空运：成本 4 美元/公斤，售价 7 美元/公斤 → 每公斤利润 3 美元。" } },
  { id: "tip-21", short: {
    ku: "خێراییی باچەکان (چەند ڕۆژ گەیشتوون) بەراورد بکە بۆ باشترکردنی خزمەت.",
    en: "Compare batch speeds (days to arrive) to improve service.",
    ar: "قارِن سرعة الدفعات (أيام الوصول) لتحسين الخدمة.",
    zh: "比较各批次的速度（到货天数）以改进服务。" } },
  { id: "tip-22", short: {
    ku: "بۆ دۆزینەوەی خێرای هەر فەنکشنێک، Ctrl+K بەکاربهێنە.",
    en: "Press Ctrl+K to quickly find any function.",
    ar: "اضغط Ctrl+K للعثور بسرعة على أي وظيفة.",
    zh: "按 Ctrl+K 可快速查找任意功能。" } },
  { id: "tip-23", short: {
    ku: "لە ستریپە سەرەوەکە دوگمەی گەڕانەوە/پێش هەیە — خێراتر دەگەڕێیتەوە.",
    en: "The top bar has back/forward buttons — navigate faster.",
    ar: "يحتوي الشريط العلوي على أزرار رجوع/تقدّم — تنقّل أسرع.",
    zh: "顶部栏有后退/前进按钮，可更快导航。" } },
  { id: "tip-24", short: {
    ku: "شۆرتکەتە پینکراوەکانی سەرەوە بۆ کارە ڕۆژانەییەکان بەکاربهێنە.",
    en: "Use the pinned top-bar shortcuts for your daily tasks.",
    ar: "استخدم اختصارات الشريط العلوي المثبّتة لمهامك اليومية.",
    zh: "使用顶部栏固定的快捷方式处理日常任务。" } },
  { id: "tip-25", short: {
    ku: "لە لیستەکاندا، بە ئایکۆنی کۆپی، کۆد/تراکینگ بە یەک کرتە کۆپی بکە.",
    en: "In lists, copy a code/tracking with one click using the copy icon.",
    ar: "في القوائم، انسخ الرمز/التتبّع بنقرة واحدة عبر أيقونة النسخ.",
    zh: "在列表中，用复制图标一键复制编号/运单号。" } },
  { id: "tip-26", short: {
    ku: "لە لیستەکاندا، ماوس بخەرە سەر وێنەی کاڵا بۆ بینینی گەورەتر.",
    en: "In lists, hover over a product photo to see it larger.",
    ar: "في القوائم، مرّر المؤشّر فوق صورة المنتج لرؤيتها أكبر.",
    zh: "在列表中，将鼠标悬停在商品照片上可放大查看。" } },
  { id: "tip-27", short: {
    ku: "دۆخی تاریک/ڕووناک لە سەرەوەی شاشە بەپێی حەزی خۆت بگۆڕە.",
    en: "Toggle dark/light mode at the top of the screen to your liking.",
    ar: "بدّل بين الوضع الداكن/الفاتح من أعلى الشاشة حسب رغبتك.",
    zh: "在屏幕顶部按喜好切换深色/浅色模式。" } },
  { id: "tip-28", short: {
    ku: "ئەگەر کۆمپیوتەرەکە هاوبەشە، دوای کار لە سیستەم دەربچۆ.",
    en: "If the computer is shared, log out when you finish.",
    ar: "إذا كان الحاسوب مشتركاً، سجّل الخروج عند الانتهاء.",
    zh: "如果是共用电脑，完成后请退出登录。" } },
  { id: "tip-29", short: {
    ku: "وشەی نهێنی خۆت لەگەڵ کەس هاوبەش مەکە.",
    en: "Never share your password with anyone.",
    ar: "لا تُشارك كلمة مرورك مع أحد.",
    zh: "切勿与任何人分享你的密码。" } },
  { id: "tip-30", short: {
    ku: "پێش سڕینەوەی هەر شتێک دڵنیابە — هەندێ سڕینەوە ناگەڕێتەوە.",
    en: "Be sure before deleting anything — some deletions can't be undone.",
    ar: "تأكّد قبل حذف أي شيء — بعض عمليات الحذف لا يمكن التراجع عنها.",
    zh: "删除任何内容前请确认——有些删除无法撤销。" } },
  { id: "tip-31", short: {
    ku: "هەڵە بینیت؟ یەکسەر چاکی بکە — هەڵەی بچووک دەبێتە کێشەی گەورە.",
    en: "Spot a mistake? Fix it right away — small errors grow into big problems.",
    ar: "رأيت خطأً؟ صحّحه فوراً — الأخطاء الصغيرة تتحوّل إلى مشاكل كبيرة.",
    zh: "发现错误？立即纠正——小错误会演变成大问题。" } },
  { id: "tip-32", short: {
    ku: "کێشی پاکەت بە دروستی بنووسە — نرخ ڕاستەوخۆ لەسەری دەردەچێت.",
    en: "Enter the package weight accurately — the price depends on it directly.",
    ar: "أدخِل وزن الطرد بدقّة — يعتمد السعر عليه مباشرةً.",
    zh: "准确录入包裹重量——价格直接取决于此。" } },
  { id: "tip-33",
    short: {
      ku: "بۆ ئاسمانی، قەبارە داخڵ بکە — کێشی قەبارەیی لەوانەیە لە کێشی ڕاستەقینە زیاتر بێت و نرخ بەو حساب بکرێت.",
      en: "For air freight, enter dimensions — volumetric weight may exceed actual weight and set the price.",
      ar: "للشحن الجوّي، أدخِل الأبعاد — قد يتجاوز الوزن الحجمي الوزن الفعلي ويُحدّد السعر.",
      zh: "空运请录入尺寸——体积重可能超过实际重量并据此定价。" },
    detail: {
      ku: "لە گواستنەوەی ئاسمانیدا، نرخ بەپێی گەورەترینی نێوان «کێشی ڕاستەقینە» و «کێشی قەبارەیی» وەردەگیرێت. کێشی قەبارەیی = (درێژی×پانی×بەرزی) ÷ ٦٠٠٠. ئەگەر قەبارە داخڵ نەکەیت، لەوانەیە کڕیار کەمتر چارج بکرێت و قازانج لەدەست بدەیت.",
      en: "For air, the price uses the GREATER of the actual weight and the volumetric weight. Volumetric weight = (L×W×H) ÷ 6000. If you skip the dimensions, the customer may be undercharged and you lose profit.",
      ar: "في الجوّي، يُستخدَم الأكبر بين الوزن الفعلي والوزن الحجمي. الوزن الحجمي = (الطول×العرض×الارتفاع) ÷ 6000. إذا أهملت الأبعاد، قد يُحتسَب على العميل أقل وتخسر الربح.",
      zh: "空运取实际重量与体积重中的较大值。体积重 = (长×宽×高) ÷ 6000。若不录入尺寸，可能少收客户费用、损失利润。" },
    example: {
      ku: "پاکەتێک ٢kg ـە بەڵام ٤٠×٣٠×٢٠cm. کێشی قەبارەیی = (٤٠×٣٠×٢٠)÷٦٠٠٠ = ٤kg → نرخ بەسەر ٤kg دادەنرێت، نەک ٢kg.",
      en: "A package is 2 kg but 40×30×20 cm. Volumetric = (40×30×20)÷6000 = 4 kg → priced at 4 kg, not 2 kg.",
      ar: "طرد وزنه 2 كغ لكن أبعاده 40×30×20 سم. الحجمي = (40×30×20)÷6000 = 4 كغ → يُسعّر على 4 كغ لا 2 كغ.",
      zh: "某包裹重 2 公斤，但尺寸为 40×30×20 厘米。体积重 = (40×30×20)÷6000 = 4 公斤 → 按 4 公斤计价，而非 2 公斤。" } },
  { id: "tip-34",
    short: {
      ku: "بۆ دەریایی، حەجم (CBM) گرنگە نەک کێش — بە وردی داخڵی بکە.",
      en: "For sea freight, volume (CBM) matters, not weight — enter it accurately.",
      ar: "للشحن البحري، المهم هو الحجم (CBM) لا الوزن — أدخِله بدقّة.",
      zh: "海运按体积（CBM）而非重量计价——请准确录入。" },
    detail: {
      ku: "گواستنەوەی دەریایی بەپێی حەجم (مەترسێ سێجا، CBM) نرخ دادەنرێت، نەک کێش. CBM = (درێژی×پانی×بەرزی بە مەتر). دڵنیابە قەبارە بە دروستی داخڵ کراوە.",
      en: "Sea freight is priced by volume (cubic meters, CBM), not weight. CBM = length×width×height in meters. Make sure dimensions are entered correctly.",
      ar: "يُسعّر الشحن البحري بالحجم (متر مكعّب، CBM) لا بالوزن. CBM = الطول×العرض×الارتفاع بالأمتار. تأكّد من إدخال الأبعاد بشكل صحيح.",
      zh: "海运按体积（立方米，CBM）计价，而非重量。CBM = 长×宽×高（米）。请确保尺寸录入正确。" },
    example: {
      ku: "کارتۆنێک ١×٠.٨×٠.٥ مەتر → CBM = ٠.٤ m³.",
      en: "A carton 1×0.8×0.5 m → CBM = 0.4 m³.",
      ar: "كرتونة 1×0.8×0.5 م → CBM = 0.4 م³.",
      zh: "一个 1×0.8×0.5 米的纸箱 → CBM = 0.4 立方米。" } },
  { id: "tip-35",
    short: {
      ku: "ئەگەر چەند ئۆردەر لە یەک کارتۆندان (تراکینگی هاوبەش)، دڵنیابە هەمووی بۆ یەک کڕیارن — تێکەڵاوی کڕیار کێشە دروست دەکات.",
      en: "If several orders share one carton (shared tracking), make sure they all belong to ONE customer — mixing customers causes problems.",
      ar: "إذا اشتركت عدّة طلبات في كرتونة واحدة (تتبّع مشترك)، تأكّد أنها كلها لعميل واحد — خلط العملاء يسبّب مشاكل.",
      zh: "若多个订单共用一个纸箱（共享运单号），请确保它们都属于同一客户——混淆客户会出问题。" },
    detail: {
      ku: "هەندێ جار یەک پاکەتی فیزیکی چەند ئۆردەری جیاوازی تێدایە و بە یەک تراکینگ بەستراون. هەموو ئۆردەرە هاوبەشەکان دەبێت هی یەک کڕیار بن، چونکە یەک کارتۆن یەک کرێی گواستنەوەی هەیە و بۆ یەک کڕیار دەگەیەنرێت.",
      en: "Sometimes one physical package holds several different orders linked by the same tracking number. All shared orders must belong to one customer, because one carton carries one shipping fee and is delivered to one customer.",
      ar: "أحياناً يحوي طرد فيزيائي واحد عدّة طلبات مختلفة مرتبطة بنفس رقم التتبّع. يجب أن تكون كل الطلبات المشتركة لعميل واحد، لأن الكرتونة الواحدة لها أجرة شحن واحدة وتُسلَّم لعميل واحد.",
      zh: "有时一个实物包裹中含有多个不同订单，并以同一运单号关联。所有共享订单必须属于同一客户，因为一个纸箱只有一笔运费，且只交付给一位客户。" },
    example: {
      ku: "کڕیار AZ001 سێ کاڵای لە یەک کارتۆن بە یەک تراکینگ → هەر سێ ئۆردەرەکە بۆ AZ001، و تەنها یەک کرێی گواستنەوە بۆ کارتۆنەکە حساب دەکرێت.",
      en: "Customer AZ001 has three items in one carton under one tracking → all three orders are AZ001's, and only one shipping fee is charged for the carton.",
      ar: "العميل AZ001 لديه ثلاثة أصناف في كرتونة واحدة بتتبّع واحد → الطلبات الثلاثة كلها لـ AZ001، وتُحتسب أجرة شحن واحدة فقط للكرتونة.",
      zh: "客户 AZ001 在一个纸箱中有三件商品、同一运单号 → 三个订单都属于 AZ001，整箱只收一笔运费。" } },
  { id: "tip-36", short: {
    ku: "یەک کارتۆن = یەک کرێی گواستنەوە، هەرچەند ئۆردەری لێبێت.",
    en: "One carton = one shipping fee, no matter how many orders it holds.",
    ar: "كرتونة واحدة = أجرة شحن واحدة، مهما بلغ عدد الطلبات فيها.",
    zh: "一个纸箱 = 一笔运费，无论里面有多少订单。" } },
  { id: "tip-37",
    short: {
      ku: "دوای داخستنی بۆکس، ئەگەر هەڵە هەبوو دەتوانیت بیکەیتەوە و چاکی بکەیت — بەس پێش ناردن.",
      en: "After sealing a box, if there's a mistake you can reopen and fix it — but only before sending.",
      ar: "بعد إغلاق الصندوق، إذا وُجد خطأ يمكنك إعادة فتحه وتصحيحه — لكن قبل الإرسال فقط.",
      zh: "封箱后如有错误可重新打开修正——但仅限发货之前。" },
    detail: {
      ku: "بۆکسی داخراو (هێشتا نەنێردراو) دەتوانرێت بکرێتەوە بۆ زیادکردن/لابردنی پاکەت یان گۆڕینی نرخی گواستنەوە، پاشان دووبارە دایبخرێت. بەڵام دوای ناردن (پارە لە کڕیار براوە)، ناکرێتەوە.",
      en: "A sealed (not-yet-sent) box can be reopened to add/remove packages or change the shipping price, then re-sealed. But once sent (customer charged), it can't be reopened.",
      ar: "الصندوق المُغلق (غير المُرسَل بعد) يمكن إعادة فتحه لإضافة/إزالة طرود أو تغيير سعر الشحن، ثم إغلاقه مجدداً. لكن بعد الإرسال (تحصيل العميل) لا يمكن إعادة فتحه.",
      zh: "已封箱但未发货的箱子可重新打开以增删包裹或更改运费，然后重新封箱。但一旦发货（已向客户计费）便无法再打开。" },
    example: {
      ku: "بۆکست داخست بەڵام پاکەتێکت لەبیر کرد → بیکەرەوە، پاکەتەکە زیاد بکە، دووبارە دایبخە.",
      en: "You sealed a box but forgot a package → reopen it, add the package, seal again.",
      ar: "أغلقت صندوقاً لكنك نسيت طرداً → أعِد فتحه، أضِف الطرد، أغلقه مجدداً.",
      zh: "你封了箱却忘了一个包裹 → 重新打开，加入包裹，再封箱。" } },
  { id: "tip-38", short: {
    ku: "لە کردنەوەی بۆکس، خانەی سکان فۆکەسی لەسەر دەمێنێتەوە — بەردەوام سکان بکە بەبێ کلیک.",
    en: "When a box is open, the scan field keeps focus — keep scanning without clicking.",
    ar: "عند فتح الصندوق، يبقى حقل المسح نشطاً — تابِع المسح دون نقر.",
    zh: "箱子打开时，扫描框保持焦点——无需点击即可连续扫描。" } },
  { id: "tip-39", short: {
    ku: "پاکەتی نوێ بۆ باچ زیادبوو دوای دروستکردنی بۆکس؟ «نوێکردنەوەی بۆکس» بەکاربهێنە.",
    en: "New package added to the batch after the box was made? Use \"Refresh box\".",
    ar: "أُضيف طرد جديد للدفعة بعد إنشاء الصندوق؟ استخدم «تحديث الصندوق».",
    zh: "建箱后批次中又加入了新包裹？使用「刷新箱子」。" } },
  { id: "tip-40", short: {
    ku: "بۆکسی خاڵی مەنێرە — سەرەتا پاکەت زیاد بکە.",
    en: "Don't send an empty box — add packages first.",
    ar: "لا تُرسل صندوقاً فارغاً — أضِف الطرود أولاً.",
    zh: "不要发送空箱——请先加入包裹。" } },
  { id: "tip-41",
    short: {
      ku: "ئۆردەری چارجکراو کڕیارەکەی ناگۆڕێت — سەرەتا چارجەکە بگەڕێنەوە.",
      en: "A charged order's customer can't be changed — reverse the charge first.",
      ar: "لا يمكن تغيير عميل طلب مُحصّل — أعِد التحصيل أولاً.",
      zh: "已计费订单无法更改客户——请先撤销计费。" },
    detail: {
      ku: "کاتێک ئۆردەر چارج دەکرێت، پارە لە والێتی ئەو کڕیارە دەبڕێت و لە لیژەری داراییدا تۆمار دەبێت. ئەگەر دواتر کڕیار بگۆڕیت، چارجەکە لەسەر کڕیاری کۆن دەمێنێتەوە و کڕیاری نوێ چارج ناکرێت → ناکۆکیی دارایی. بۆیە سیستەم ڕێگری دەکات.",
      en: "When an order is charged, money is taken from that customer's wallet and recorded in the ledger. If you later change the customer, the charge stays on the old customer and the new one is never charged → a ledger mismatch. So the system blocks it.",
      ar: "عند تحصيل الطلب، يُخصَم المبلغ من محفظة ذلك العميل ويُسجَّل في الدفتر. إذا غيّرت العميل لاحقاً، يبقى التحصيل على العميل القديم ولا يُحصَّل الجديد → تضارب في الدفتر. لذا يمنع النظام ذلك.",
      zh: "订单计费时会从该客户钱包扣款并记入账本。若之后更换客户，费用仍记在旧客户名下，新客户从未被计费 → 账目错乱。因此系统会予以阻止。" },
    example: {
      ku: "$50 لە AZ001 براوە. ناتوانیت ڕاستەوخۆ بیگۆڕیت بۆ AZ002 — سەرەتا $50 بگەڕێنەوە بۆ AZ001، پاشان کڕیار بگۆڕە.",
      en: "$50 was taken from AZ001. You can't switch directly to AZ002 — first refund $50 to AZ001, then change the customer.",
      ar: "خُصِم 50$ من AZ001. لا يمكنك التحويل مباشرةً إلى AZ002 — أعِد 50$ إلى AZ001 أولاً، ثم غيّر العميل.",
      zh: "已从 AZ001 扣款 50 美元。不能直接改为 AZ002——请先退还 AZ001 50 美元，再更改客户。" } },
  { id: "tip-42",
    short: {
      ku: "لە گۆڕینی نرخی ئۆردەری چارجکراو، سیستەم هۆکارت لێ دەخوازێت — ئەمە بۆ تۆماری مێژووە.",
      en: "When changing the price of a charged order, the system asks for a reason — for the audit trail.",
      ar: "عند تغيير سعر طلب مُحصّل، يطلب النظام سبباً — للسجل.",
      zh: "更改已计费订单的价格时，系统会要求填写原因——用于留存记录。" },
    detail: {
      ku: "هەر گۆڕانکارییەک لە پارە لەسەر ئۆردەری چارجکراو، کاریگەری لەسەر باڵانسی کڕیار دەبێت. بۆ شەفافیەت و پاراستن، سیستەم هۆکارێکت لێ دەخوازێت کە لە مێژووی ئۆردەردا تۆمار دەکرێت.",
      en: "Any money change on a charged order affects the customer's balance. For transparency and safety, the system requires a reason that is saved in the order's history.",
      ar: "أي تغيير مالي على طلب مُحصّل يؤثّر على رصيد العميل. للشفافية والأمان، يطلب النظام سبباً يُحفَظ في سجل الطلب.",
      zh: "对已计费订单的任何金额更改都会影响客户余额。为透明与安全，系统要求填写原因并保存在订单历史中。" },
    example: {
      ku: "نرخ لە $50 بۆ $45 کەم دەکەیتەوە → هۆکار بنووسە: «داشکاندن بۆ کڕیار».",
      en: "You lower the price from $50 to $45 → write a reason: \"Discount for the customer\".",
      ar: "تخفض السعر من 50$ إلى 45$ → اكتب سبباً: «خصم للعميل».",
      zh: "你将价格从 50 美元降到 45 美元 → 填写原因：「给客户的折扣」。" } },
  { id: "tip-43",
    short: {
      ku: "سنووری قەرزی (creditLimit) هەر کڕیارێک دابنێ — کاتێ تێپەڕی، لە داشبۆرد ئاگادار دەبیتەوە.",
      en: "Set each customer's credit limit — you'll be alerted on the dashboard when it's exceeded.",
      ar: "حدّد حدّ ائتمان كل عميل — ستُنبَّه في لوحة التحكم عند تجاوزه.",
      zh: "为每位客户设置信用额度——超额时会在仪表板收到提醒。" },
    detail: {
      ku: "هەر کڕیارێک سنوورێکی قەرزی دیاریکراوی هەیە. کاتێک قەرزەکەی لەو سنوورە تێدەپەڕێت، لە بەشی «مەشاکل»ی داشبۆرد ئاگاداری وەردەگریت — تاکو زوو مامەڵەی لەگەڵ بکەیت.",
      en: "Each customer has a set credit limit. When their debt passes it, you get an alert in the dashboard's \"Problems\" section — so you can act early.",
      ar: "لكل عميل حدّ ائتمان محدّد. عندما يتجاوز دينه هذا الحدّ، تتلقّى تنبيهاً في قسم «المشاكل» بلوحة التحكم — لتتصرّف مبكراً.",
      zh: "每位客户都有设定的信用额度。当其欠款超过额度时，你会在仪表板「问题」区收到提醒，以便尽早处理。" },
    example: {
      ku: "سنووری AZ001 = $500. ئەگەر قەرزی بووە $620 → لە داشبۆرد بە ئاگاداری سوور دەردەکەوێت.",
      en: "AZ001's limit = $500. If their debt becomes $620 → it shows as a red alert on the dashboard.",
      ar: "حدّ AZ001 = 500$. إذا أصبح دينه 620$ → يظهر كتنبيه أحمر في لوحة التحكم.",
      zh: "AZ001 的额度 = 500 美元。若其欠款达到 620 美元 → 仪表板会显示红色提醒。" } },
  { id: "tip-44", short: {
    ku: "پارەی پێشەکی دەگەڕێتەوە کاتێ ئۆردەر دەسڕیتەوە — بەڵام پێش سڕینەوە دڵنیابە.",
    en: "An advance payment is refunded when an order is deleted — but be sure before deleting.",
    ar: "تُسترَدّ الدفعة المقدّمة عند حذف الطلب — لكن تأكّد قبل الحذف.",
    zh: "删除订单时会退还预付款——但删除前请确认。" } },
  { id: "tip-45",
    short: {
      ku: "لە کرین بە تێچوو، نرخی کاڵا و عمولە جیان — هەردووکی بە دروستی داخڵ بکە.",
      en: "In cost purchase, the item price and the commission are separate — enter both correctly.",
      ar: "في الشراء بالتكلفة، سعر السلعة والعمولة منفصلان — أدخِل كليهما بشكل صحيح.",
      zh: "在成本代购中，商品价格与佣金是分开的——两者都要正确录入。" },
    detail: {
      ku: "لە کرین بە تێچوو، کڕیار نرخی ڕاستەقینەی کاڵا (تێچوو) + عمولەی خزمەتی کۆمپانیا دەدات. ئەم دووانە لە دوو خانەی جیادان — ئەگەر تێکەڵیان بکەیت، حساباتی قازانج هەڵە دەبێت.",
      en: "In cost purchase, the customer pays the actual item cost plus the company's service commission. These are two separate fields — mixing them makes the profit figures wrong.",
      ar: "في الشراء بالتكلفة، يدفع العميل تكلفة السلعة الفعلية زائد عمولة خدمة الشركة. هذان حقلان منفصلان — خلطهما يجعل أرقام الربح خاطئة.",
      zh: "在成本代购中，客户支付商品的实际成本加公司的服务佣金。这是两个独立字段——混淆会导致利润数字出错。" },
    example: {
      ku: "نرخی کاڵا $80، عمولە $10 → کڕیار $90 دەدات، قازانجی کۆمپانیا $10.",
      en: "Item price $80, commission $10 → the customer pays $90, the company's profit is $10.",
      ar: "سعر السلعة 80$، العمولة 10$ → يدفع العميل 90$، وربح الشركة 10$.",
      zh: "商品价格 80 美元，佣金 10 美元 → 客户支付 90 美元，公司利润 10 美元。" } },
  { id: "tip-46",
    short: {
      ku: "لە پاکێجی تەواو، نرخی کڕین و نرخی فرۆشتن جیان — قازانج جیاوازییەکەیانە.",
      en: "In full package, the purchase price and selling price are separate — profit is the difference.",
      ar: "في الطرد الكامل، سعر الشراء وسعر البيع منفصلان — الربح هو الفرق بينهما.",
      zh: "在完整包裹中，采购价与售价是分开的——利润即两者之差。" },
    detail: {
      ku: "لە پاکێجی تەواو، کۆمپانیا کاڵا دەکڕێت (نرخی کڕین) و بە نرخی فرۆشتن بە کڕیار دەفرۆشێت. قازانج = نرخی فرۆشتن − نرخی کڕین. هەردوو نرخ بە دروستی داخڵ بکە.",
      en: "In full package, the company buys the item (purchase price) and sells it to the customer (selling price). Profit = selling − purchase. Enter both prices correctly.",
      ar: "في الطرد الكامل، تشتري الشركة السلعة (سعر الشراء) وتبيعها للعميل (سعر البيع). الربح = البيع − الشراء. أدخِل كلا السعرين بشكل صحيح.",
      zh: "在完整包裹中，公司采购商品（采购价）并以售价卖给客户。利润 = 售价 − 采购价。请正确录入两个价格。" },
    example: {
      ku: "نرخی کڕین $60، نرخی فرۆشتن $85 → قازانج $25.",
      en: "Purchase $60, selling $85 → profit $25.",
      ar: "الشراء 60$، البيع 85$ → الربح 25$.",
      zh: "采购价 60 美元，售价 85 美元 → 利润 25 美元。" } },
  { id: "tip-47", short: {
    ku: "نرخی ¥ (RMB) ڕۆژانە نوێ بکەرەوە — هەڵەی نرخ قازانج کەم دەکات.",
    en: "Update the ¥ (RMB) rate daily — a wrong rate eats into profit.",
    ar: "حدّث سعر اليوان (¥/RMB) يومياً — السعر الخاطئ يقلّل الربح.",
    zh: "每天更新人民币（¥）汇率——汇率错误会侵蚀利润。" } },
  { id: "tip-48",
    short: {
      ku: "پەیامی «ئۆردەرەکە لەلایەن کەسێکی دیکەوە گۆڕدراوە» بینیت؟ پەڕەکە نوێ بکەرەوە پێش هەوڵی دووبارە — داتای کۆن مەنووسەرەوە.",
      en: "See \"This order was changed by someone else\"? Reload the page before retrying — don't overwrite the newer data.",
      ar: "ظهرت رسالة «تم تغيير هذا الطلب من شخص آخر»؟ أعِد تحميل الصفحة قبل المحاولة — لا تستبدل البيانات الأحدث.",
      zh: "看到「此订单已被他人更改」？重试前请刷新页面——不要覆盖更新的数据。" },
    detail: {
      ku: "ئەگەر دوو ستاف لە یەک کاتدا هەمان ئۆردەر بگۆڕن، ئەوەی دواتر پاشەکەوت بکات لەوانەیە گۆڕانکاری ئەوی یەکەم بسڕێتەوە. سیستەم ئەگەر بزانێت ئۆردەرەکە گۆڕاوە، ڕێگەت نادات و ئاگادارت دەکاتەوە — تەنها پەڕەکە نوێ بکەرەوە، دوایین دۆخ ببینە، پاشان گۆڕانکارییەکەت بکە.",
      en: "If two staff edit the same order at once, whoever saves last could erase the first one's changes. The system detects the order changed since you opened it and warns you — just reload, see the latest state, then make your change.",
      ar: "إذا عدّل موظّفان نفس الطلب في آنٍ واحد، فمن يحفظ أخيراً قد يمحو تغييرات الأول. يكتشف النظام أن الطلب تغيّر منذ فتحه ويُنبّهك — فقط أعِد التحميل، شاهد آخر حالة، ثم نفّذ تغييرك.",
      zh: "若两名员工同时编辑同一订单，后保存者可能覆盖前者的更改。系统会检测到订单自你打开后已变更并提醒你——只需刷新、查看最新状态，再进行修改。" },
    example: {
      ku: "تۆ نرخت گۆڕی، بەڵام هاوکارت لە هەمان ساتدا دۆخی گۆڕی → کاتی پاشەکەوت، پەیامەکە دەردەکەوێت. نوێی بکەرەوە، گۆڕانکاری هاوکارت دەبینیت، پاشان نرخەکە بگۆڕە.",
      en: "You changed the price, but a colleague changed the status at the same moment → on save, the message appears. Reload, see your colleague's change, then set the price.",
      ar: "غيّرت السعر، لكن زميلاً غيّر الحالة في اللحظة نفسها → عند الحفظ تظهر الرسالة. أعِد التحميل، شاهد تغيير زميلك، ثم اضبط السعر.",
      zh: "你改了价格，但同事在同一时刻改了状态 → 保存时出现提示。刷新后看到同事的更改，再设置价格。" } },
  { id: "tip-49", short: {
    ku: "هەموو گۆڕانکارییەک لە مێژووی ئۆردەردا تۆمار دەبێت — کێ، کەی، چی گۆڕی.",
    en: "Every change is recorded in the order's history — who, when, and what changed.",
    ar: "كل تغيير يُسجَّل في سجل الطلب — مَن ومتى وماذا تغيّر.",
    zh: "每次更改都会记入订单历史——谁、何时、改了什么。" } },
  { id: "tip-50", short: {
    ku: "سڕینەوەی ئۆردەر «نەرمە» (دەگەڕێتەوە) — بەڵام هەر وردبە.",
    en: "Order deletion is \"soft\" (recoverable) — but stay careful anyway.",
    ar: "حذف الطلب «ناعم» (قابل للاسترجاع) — لكن ابقَ حذِراً مع ذلك.",
    zh: "订单删除是「软删除」（可恢复）——但仍请谨慎。" } },
  { id: "tip-51", short: {
    ku: "دۆخی ئۆردەر بە دروستی نوێ بکەرەوە — کڕیار بەپێی دۆخ ئاگادار دەبێتەوە.",
    en: "Keep the order status up to date — the customer is notified based on it.",
    ar: "حدّث حالة الطلب باستمرار — يُخطَر العميل بناءً عليها.",
    zh: "及时更新订单状态——客户会据此收到通知。" } },
  { id: "tip-52", short: {
    ku: "بەشی «مەشاکل» لە داشبۆرد ڕۆژانە بپشکنە — بێ تراکینگ، قەرز، ئۆردەری گەورە.",
    en: "Check the dashboard's \"Problems\" section daily — no tracking, debt, large orders.",
    ar: "راجِع قسم «المشاكل» في لوحة التحكم يومياً — بدون تتبّع، ديون، طلبات كبيرة.",
    zh: "每天查看仪表板的「问题」区——无运单号、欠款、大额订单。" } },
  { id: "tip-53", short: {
    ku: "بەشی «سەرکەوتنەکانی ئەم هەفتەیە» — بزانە کام کڕیار ئاکتیفترینە و قازانجت چۆنە.",
    en: "Check \"Wins this week\" — see your most active customer and how profit is doing.",
    ar: "راجِع «إنجازات هذا الأسبوع» — لتعرف أنشط عميل وكيف يسير الربح.",
    zh: "查看「本周成绩」——了解最活跃的客户和利润情况。" } },
  { id: "tip-54", short: {
    ku: "خێراییی باچەکان (چەند ڕۆژ گەیشتوون) بەراورد بکە.",
    en: "Compare batch speeds (days to arrive).",
    ar: "قارِن سرعة الدفعات (أيام الوصول).",
    zh: "比较各批次的速度（到货天数）。" } },
  { id: "tip-55", short: {
    ku: "کڕیارێک زۆر ئۆردەر دەکات؟ یەکجار هەڵیبژێرە و هەمووی پشتەوەپشت داخڵ بکە — فۆرم دوای سەیڤ دانەخراوە.",
    en: "Customer with many orders? Pick them once and enter all back-to-back — the form stays open after saving.",
    ar: "عميل لديه طلبات كثيرة؟ اختَره مرّة وأدخِلها كلها تباعاً — يبقى النموذج مفتوحاً بعد الحفظ.",
    zh: "客户订单很多？选定一次即可连续录入——保存后表单仍保持打开。" } },
  { id: "tip-56", short: {
    ku: "وێنەی کاڵای لەبیرکراو دەکرێت دواتر لە ئیدیتدا زیاد بکرێت.",
    en: "A forgotten product photo can be added later in edit mode.",
    ar: "يمكن إضافة صورة المنتج المنسيّة لاحقاً في وضع التعديل.",
    zh: "忘记添加的商品照片可稍后在编辑中补充。" } },
  { id: "tip-57", short: {
    ku: "تراکینگ نەمبەری هەڵە = نەدۆزینەوەی پاکەت — بە وردی داخڵی بکە.",
    en: "A wrong tracking number = a package that can't be found — enter it carefully.",
    ar: "رقم تتبّع خاطئ = طرد لا يُعثَر عليه — أدخِله بدقّة.",
    zh: "运单号错误 = 找不到包裹——请仔细录入。" } },
  { id: "tip-58", short: {
    ku: "پێش پاشەکەوتکردنی فۆرم، خانە پێویستەکان (بەستەرە سوورەکان *) پڕبکەرەوە.",
    en: "Before saving a form, fill the required fields (marked with a red *).",
    ar: "قبل حفظ النموذج، املأ الحقول المطلوبة (المعلّمة بنجمة حمراء *).",
    zh: "保存表单前，请填写必填字段（带红色 * 标记）。" } },
];

export const MOTIVATION_MESSAGES: MotivationMessage[] = [
  { id: "mot-1", text: { ku: "هەر بژی {name}، کارەکانت شایەنی نرخاندنە — دەستەکانت خۆش بێ! 🌟", en: "Well done, {name}! Your work is truly appreciated — keep it up! 🌟", ar: "أحسنت يا {name}! عملك يستحق التقدير — واصِل التميّز! 🌟", zh: "{name}，干得好！你的工作值得赞赏——继续加油！🌟" } },
  { id: "mot-2", text: { ku: "{name}، ئەمڕۆ زۆر چالاک بوویت — سوپاس بۆ کۆششەکانت! 💪", en: "{name}, you've been very active today — thank you for your effort! 💪", ar: "{name}، كنت نشيطاً جداً اليوم — شكراً على جهدك! 💪", zh: "{name}，你今天非常活跃——感谢你的付出！💪" } },
  { id: "mot-3", text: { ku: "ماندوو نەبیت {name}، هەر بەردەوام بە! 🙌", en: "Stay strong, {name}, keep going! 🙌", ar: "لا تتعب يا {name}، واصِل! 🙌", zh: "{name}，辛苦了，继续前进！🙌" } },
  { id: "mot-4", text: { ku: "{name}، هەر کارێک بە وردی و دڵسۆزییەوە دەکەیت — ڕێزمان بۆت هەیە. 🤝", en: "{name}, you do everything with care and dedication — we respect that. 🤝", ar: "{name}، تؤدّي كل شيء بدقّة وإخلاص — لك كل التقدير. 🤝", zh: "{name}，你做每件事都认真而尽责——我们由衷敬佩。🤝" } },
  { id: "mot-5", text: { ku: "دەست‌خۆش {name}! کارایی تۆ جیاوازی دروست دەکات. ✨", en: "Great job, {name}! Your efficiency makes a difference. ✨", ar: "أحسنت يا {name}! كفاءتك تصنع فرقاً. ✨", zh: "{name}，做得好！你的高效带来了改变。✨" } },
  { id: "mot-6", text: { ku: "{name}، خزمەتت بۆ کڕیارەکان بێ‌وێنەیە — سوپاس! 🏆", en: "{name}, your service to customers is outstanding — thank you! 🏆", ar: "{name}، خدمتك للعملاء رائعة — شكراً لك! 🏆", zh: "{name}，你为客户提供的服务非常出色——谢谢你！🏆" } },
  { id: "mot-7", text: { ku: "بەردەوامبە {name}، سەرکەوتن لەگەڵ کۆششدا دێت. 🚀", en: "Keep going, {name}, success comes with effort. 🚀", ar: "واصِل يا {name}، النجاح يأتي مع الجهد. 🚀", zh: "{name}，继续努力，成功源于付出。🚀" } },
  { id: "mot-8", text: { ku: "{name}، ئەمڕۆ زۆر شتت تەواوکرد — شانازی بکە بەخۆت! 🎉", en: "{name}, you got a lot done today — be proud of yourself! 🎉", ar: "{name}، أنجزت الكثير اليوم — افخر بنفسك! 🎉", zh: "{name}，你今天完成了很多——为自己骄傲吧！🎉" } },
  { id: "mot-9", text: { ku: "ماندووبوونەکانت بێ‌خەسار نییە {name} — بەرەوپێش! 📈", en: "Your hard work isn't in vain, {name} — onward! 📈", ar: "تعبك ليس هباءً يا {name} — إلى الأمام! 📈", zh: "{name}，你的辛劳不会白费——继续向前！📈" } },
  { id: "mot-10", text: { ku: "{name}، وردبینیت هەڵە کەم دەکاتەوە — ئەمە بەنرخە. 🎯", en: "{name}, your attention to detail prevents mistakes — that's valuable. 🎯", ar: "{name}، دقّتك تقلّل الأخطاء — وهذا ثمين. 🎯", zh: "{name}，你的细心减少了错误——这很宝贵。🎯" } },
  { id: "mot-11", text: { ku: "سوپاس {name}، بەهۆی تۆوە کارەکان ڕێک دەڕۆن. 🌿", en: "Thank you, {name}, things run smoothly because of you. 🌿", ar: "شكراً يا {name}، الأمور تسير بسلاسة بفضلك. 🌿", zh: "{name}，谢谢你，因为有你一切才如此顺畅。🌿" } },
  { id: "mot-12", text: { ku: "{name}، تۆ هاوبەشی سەرکەوتنی ئەم کۆمپانیایەی! 💎", en: "{name}, you're a partner in this company's success! 💎", ar: "{name}، أنت شريك في نجاح هذه الشركة! 💎", zh: "{name}，你是这家公司成功的伙伴！💎" } },
  { id: "mot-13", text: { ku: "هەر خۆش بیت {name}، ئەمڕۆت بە سوود تەواوکرد. ☀️", en: "All the best, {name}, you finished today productively. ☀️", ar: "كل التوفيق يا {name}، أنهيت يومك بإنتاجية. ☀️", zh: "{name}，祝一切顺利，你今天收获满满。☀️" } },
  { id: "mot-14", text: { ku: "{name}، دڵنیابە کۆششەکانت دەبینرێن و دەنرخێنرێن. 👏", en: "{name}, rest assured your efforts are seen and valued. 👏", ar: "{name}، كن مطمئناً أن جهودك تُرى وتُقدَّر. 👏", zh: "{name}，请放心，你的努力被看见并被珍视。👏" } },
  { id: "mot-15", text: { ku: "بەردەوامی تۆ {name} هێزی ئەم تیمەیە. 🔥", en: "Your consistency, {name}, is this team's strength. 🔥", ar: "ثباتك يا {name} هو قوة هذا الفريق. 🔥", zh: "{name}，你的坚持是这个团队的力量。🔥" } },
  { id: "mot-16", text: { ku: "{name}، هەر ئۆردەرێک بە وردی تۆمار دەکەیت، متمانە دروست دەکەیت. 🤍", en: "{name}, every order you log carefully builds trust. 🤍", ar: "{name}، كل طلب تسجّله بدقّة يبني الثقة. 🤍", zh: "{name}，你认真登记的每一笔订单都在建立信任。🤍" } },
  { id: "mot-17", text: { ku: "دەست‌خۆش {name}! خێرایی و ووردی پێکەوە — نایاب! ⚡", en: "Nice work, {name}! Fast and accurate together — excellent! ⚡", ar: "أحسنت يا {name}! سرعة ودقّة معاً — ممتاز! ⚡", zh: "{name}，做得好！又快又准——太棒了！⚡" } },
  { id: "mot-18", text: { ku: "{name}، ئەمڕۆ ڕۆژێکی بەرهەمدار بوو — پیرۆزە! 🎊", en: "{name}, today was a productive day — congrats! 🎊", ar: "{name}، كان اليوم يوماً منتِجاً — مبارك! 🎊", zh: "{name}，今天收获颇丰——恭喜！🎊" } },
  { id: "mot-19", text: { ku: "هەر بەرزبیتەوە {name}، شایەنی باشترینیت. 🌈", en: "Keep rising, {name}, you deserve the best. 🌈", ar: "ارتقِ دائماً يا {name}، أنت تستحق الأفضل. 🌈", zh: "{name}，不断进取，你值得最好的。🌈" } },
  { id: "mot-20", text: { ku: "{name}، کارە بچووکەکانت پێکەوە شتێکی گەورە دروست دەکەن. 🧩", en: "{name}, your small tasks together build something big. 🧩", ar: "{name}، مهامك الصغيرة معاً تبني شيئاً كبيراً. 🧩", zh: "{name}，你的每件小事汇聚成大成就。🧩" } },
  { id: "mot-21", text: { ku: "سوپاسی بێ‌سنوور {name} — تۆ جیاوازی دەکەیت. 🙏", en: "Endless thanks, {name} — you make a difference. 🙏", ar: "شكراً بلا حدود يا {name} — أنت تصنع فرقاً. 🙏", zh: "{name}，无尽感谢——你带来了改变。🙏" } },
  { id: "mot-22", text: { ku: "{name}، هێشتا لێرەیت و کاردەکەیت — ئەمە دڵسۆزییە. ❤️", en: "{name}, you're still here working — that's dedication. ❤️", ar: "{name}، ما زلت هنا تعمل — هذا إخلاص. ❤️", zh: "{name}，你仍在坚守工作——这就是敬业。❤️" } },
  { id: "mot-23", text: { ku: "ماندوو نەبیت {name}، خاڵە بەهێزەکانت زۆرن. 💫", en: "Stay strong, {name}, your strengths are many. 💫", ar: "لا تتعب يا {name}، نقاط قوّتك كثيرة. 💫", zh: "{name}，辛苦了，你的优点很多。💫" } },
  { id: "mot-24", text: { ku: "{name}، هەر هەنگاوێک بەرەوپێش، نزیکترە لە ئامانج. 🎯", en: "{name}, every step forward brings the goal closer. 🎯", ar: "{name}، كل خطوة للأمام تقرّبك من الهدف. 🎯", zh: "{name}，每前进一步都离目标更近。🎯" } },
  { id: "mot-25", text: { ku: "دەست‌خۆش بەو ووردییە {name} — کڕیارەکان متمانەت پێ دەکەن. 🤝", en: "Well done on that precision, {name} — customers trust you. 🤝", ar: "أحسنت بهذه الدقّة يا {name} — العملاء يثقون بك. 🤝", zh: "{name}，如此细致，做得好——客户信任你。🤝" } },
  { id: "mot-26", text: { ku: "{name}، ئەمڕۆ ئاکتیفترین بوویت — نایابە! 🥇", en: "{name}, you were the most active today — outstanding! 🥇", ar: "{name}، كنت الأكثر نشاطاً اليوم — رائع! 🥇", zh: "{name}，你是今天最活跃的人——太出色了！🥇" } },
  { id: "mot-27", text: { ku: "هەر سەرکەوتوو بیت {name}، تیمەکە شانازیت پێوە دەکات. 🌟", en: "Wishing you success, {name}, the team is proud of you. 🌟", ar: "أتمنّى لك النجاح يا {name}، الفريق فخور بك. 🌟", zh: "{name}，祝你成功，团队为你骄傲。🌟" } },
  { id: "mot-28", text: { ku: "{name}، کۆششی ئەمڕۆت بنەمای سەرکەوتنی سبەینێیە. 🌅", en: "{name}, today's effort is the foundation of tomorrow's success. 🌅", ar: "{name}، جهد اليوم هو أساس نجاح الغد. 🌅", zh: "{name}，今天的努力是明天成功的基石。🌅" } },
  { id: "mot-29", text: { ku: "سوپاس {name} بۆ ئەو هەموو هەوڵە — پشوویەکی خۆش! 😊", en: "Thank you, {name}, for all the effort — have a good rest! 😊", ar: "شكراً يا {name} على كل هذا الجهد — استراحة طيبة! 😊", zh: "{name}，感谢你的所有付出——好好休息！😊" } },
  { id: "mot-30", text: { ku: "{name}، تۆ نموونەی کارکردنی باشیت — ڕێزمان بۆت هەیە. 🏅", en: "{name}, you're an example of good work — we respect you. 🏅", ar: "{name}، أنت قدوة في العمل الجيّد — لك كل الاحترام. 🏅", zh: "{name}，你是优秀工作的榜样——我们尊敬你。🏅" } },
];
