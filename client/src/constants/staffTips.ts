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
  { id: "tip-1",
    short: {
      ku: "هەمیشە لە کاتی تۆمارکردنی ئۆردەری نوێ ئاگاداربە — لەسەر موشتەری هەڵە تۆماری مەکە.",
      en: "When registering a new order, double-check the customer — never enter it on the wrong one.",
      ar: "عند تسجيل طلب جديد، تحقّق من العميل — لا تسجّله على العميل الخطأ.",
      zh: "登记新订单时务必核对客户，切勿登记到错误的客户名下。" },
    detail: {
      ku: "هەر ئۆردەرێک بەستراوەتەوە بە کڕیارێکی دیاریکراو، و پارە و گەیاندن لەسەر بنەمای ئەو بەستنە دەڕۆن. ئەگەر ئۆردەر لەسەر کڕیاری هەڵە تۆمار بکەیت، پاکەتەکە بۆ کەسی هەڵە دەچێت و حسابی دارایی تێکدەچێت. بۆیە پێش هەر شتێک دڵنیابە کڕیارە هەڵبژێردراوەکە دروستە.",
      en: "Every order is tied to a specific customer, and billing and delivery both follow that link. If you log the order on the wrong customer, the package goes to the wrong person and the finances get tangled. So before anything else, confirm the selected customer is correct.",
      ar: "كل طلب مرتبط بعميل محدّد، والتحصيل والتسليم يتبعان هذا الارتباط. إذا سجّلت الطلب على العميل الخطأ، يذهب الطرد للشخص الخطأ ويختلّ الحساب المالي. لذا قبل أي شيء تأكّد أن العميل المُختار صحيح.",
      zh: "每个订单都绑定到特定客户，计费和交付都依据这一关联。如果登记到错误的客户，包裹会送错人，财务也会混乱。所以在做任何事之前，先确认所选客户无误。" },
    example: {
      ku: "دوو کڕیارت هەیە: AZ001 «ئاکام» و AZ010 «ئاکۆ». پێش پاشەکەوت دڵنیابە کۆدی AZ001 هەڵبژێردراوە، نەک بە هەڵە AZ010.",
      en: "You have two customers: AZ001 \"Akam\" and AZ010 \"Ako\". Before saving, make sure code AZ001 is selected, not AZ010 by mistake.",
      ar: "لديك عميلان: AZ001 «أكام» و AZ010 «أكو». قبل الحفظ تأكّد أن الرمز AZ001 مُختار، لا AZ010 بالخطأ.",
      zh: "你有两位客户：AZ001「阿卡姆」和 AZ010「阿科」。保存前确认所选编号是 AZ001，而非误选 AZ010。" } },
  { id: "tip-2",
    short: {
      ku: "پێش پاشەکەوتکردن، دووجار کۆد و ناوی موشتەری بپشکنە.",
      en: "Before saving, re-check the customer's code and name twice.",
      ar: "قبل الحفظ، راجِع رمز العميل واسمه مرّتين.",
      zh: "保存前，请再次核对客户的编号和姓名。" },
    detail: {
      ku: "هەندێ کات کۆدی کڕیارەکان لێک دەچن یان ناوەکان هاوشێوەن، بۆیە ئاسانە یەکێک لە جیاتی ئەوی دیکە هەڵبژێریت. تەنها چرکەیەک خایەنە کە کۆد و ناو پێکەوە بپشکنیت، بەڵام چاککردنی هەڵە دوای پاشەکەوت کاتی زۆرتر دەخوات. ئەم پشکنینە دووجارە تۆ لە کێشەی گەورە دەپارێزێت.",
      en: "Sometimes customer codes look alike or names are similar, so it's easy to pick one instead of another. It takes only a second to check the code and name together, but fixing the mistake after saving costs far more time. This double-check protects you from a big headache.",
      ar: "أحياناً تتشابه رموز العملاء أو تتقارب الأسماء، فيسهل اختيار أحدهم بدل الآخر. لا يستغرق التحقق من الرمز والاسم معاً سوى ثانية، لكن تصحيح الخطأ بعد الحفظ يكلّف وقتاً أكثر بكثير. هذا التحقق المزدوج يحميك من مشكلة كبيرة.",
      zh: "有时客户编号相像或姓名相似，很容易选错。一起核对编号和姓名只需一秒，但保存后再纠错要花费多得多的时间。这个二次核对能让你免去大麻烦。" },
    example: {
      ku: "لیست AZ001 «ئاکام محەمەد» پیشان دەدات. پێش پاشەکەوت دڵنیابە کۆد AZ001ـە و ناو «ئاکام محەمەد»ـە، نەک «ئاکام ئەحمەد».",
      en: "The list shows AZ001 \"Akam Mohammed\". Before saving, confirm the code is AZ001 and the name is \"Akam Mohammed\", not \"Akam Ahmed\".",
      ar: "تُظهِر القائمة AZ001 «أكام محمد». قبل الحفظ تأكّد أن الرمز AZ001 والاسم «أكام محمد»، لا «أكام أحمد».",
      zh: "列表显示 AZ001「阿卡姆·穆罕默德」。保存前确认编号是 AZ001、姓名是「阿卡姆·穆罕默德」，而非「阿卡姆·艾哈迈德」。" } },
  { id: "tip-3",
    short: {
      ku: "ئەگەر تراکینگ ئامادە بوو، لە کاتی تۆمارکردنەوە داخڵی بکە — دواتر کاتت کەم دەکاتەوە.",
      en: "If the tracking number is ready, enter it while registering — it saves time later.",
      ar: "إذا كان رقم التتبّع جاهزاً، أدخِله أثناء التسجيل — يوفّر وقتك لاحقاً.",
      zh: "如果已有运单号，登记时一并录入，可节省后续时间。" },
    detail: {
      ku: "تراکینگ نەمبەر ئەو ژمارەیەیە کە پاکەتەکە پێی دەناسرێتەوە و بەدوایدا دەگەڕێیت. ئەگەر لە کاتی تۆمارکردنی ئۆردەردا ئامادە بوو و یەکسەر داخڵی بکەیت، پێویست ناکات دواتر بگەڕێیتەوە و ئۆردەرەکە بکەیتەوە بۆ زیادکردنی. ئەمە کارەکە یەک جار تەواو دەکات و لیستی «بێ تراکینگ» کورت دەکاتەوە.",
      en: "The tracking number is the code by which the package is identified and traced. If it's ready while you register the order and you enter it right away, you won't have to come back and reopen the order to add it. This finishes the job in one go and shortens the \"no tracking\" list.",
      ar: "رقم التتبّع هو الرمز الذي يُعرَف به الطرد ويُتتبَّع. إذا كان جاهزاً أثناء تسجيل الطلب وأدخلته فوراً، فلن تضطر للعودة وإعادة فتح الطلب لإضافته. هذا يُنهي العمل دفعة واحدة ويقصّر قائمة «بدون تتبّع».",
      zh: "运单号是识别和追踪包裹的编号。如果登记订单时它已就绪并立即录入，就不必稍后返回重新打开订单去补录。这样一次性完成工作，也缩短了「无运单号」列表。" },
    example: {
      ku: "کڕیار AZ001 تراکینگی YT7612345678 پێیداویت → لە هەمان فۆرمی تۆمارکردندا داخڵی بکە، نەک دواتر.",
      en: "Customer AZ001 gave you tracking YT7612345678 → enter it in the same registration form, not later.",
      ar: "أعطاك العميل AZ001 رقم التتبّع YT7612345678 → أدخِله في نفس نموذج التسجيل، لا لاحقاً.",
      zh: "客户 AZ001 给了你运单号 YT7612345678 → 在同一登记表单中录入，而非稍后补录。" } },
  { id: "tip-4",
    short: {
      ku: "جۆری کاڵا و عەدەد بە وردی پڕبکەرەوە — کاریگەری ڕاستەوخۆی لەسەر نرخ هەیە.",
      en: "Fill in the product type and quantity carefully — they directly affect the price.",
      ar: "املأ نوع المنتج والكمية بدقّة — لهما تأثير مباشر على السعر.",
      zh: "仔细填写商品类型和数量，它们直接影响价格。" },
    detail: {
      ku: "جۆری کاڵا و عەدەد بنەمای حسابی نرخن — هەندێ جۆر کرێی جیاوازیان هەیە و عەدەد کۆی گشتی دیاری دەکات. ئەگەر بە هەڵە داخڵیان بکەیت، نرخی ئۆردەر هەڵە دەبێت و یان کڕیار زۆر چارج دەکرێت یان کەم. وردی لێرەدا ڕاستەوخۆ دەبێتە پارەی دروست.",
      en: "Product type and quantity are the basis of the price calculation — some types carry different rates, and quantity sets the total. If you enter them wrong, the order price is wrong and the customer is over- or under-charged. Accuracy here turns directly into correct money.",
      ar: "نوع المنتج والكمية هما أساس احتساب السعر — بعض الأنواع لها أسعار مختلفة، والكمية تحدّد الإجمالي. إذا أدخلتهما خطأً، يصبح سعر الطلب خاطئاً ويُحصَّل العميل أكثر أو أقل. الدقّة هنا تتحوّل مباشرة إلى مبلغ صحيح.",
      zh: "商品类型和数量是价格计算的基础——有些类型费率不同，数量决定总额。录入错误会导致订单价格出错，向客户多收或少收。这里的准确直接转化为正确的金额。" },
    example: {
      ku: "کڕیار ٣ دانە مۆبایل دەنێرێت بەڵام تۆ ١ داخڵ دەکەیت → نرخ بۆ ١ دانە حساب دەکرێت و کۆمپانیا قازانجی ٢ دانە لەدەست دەدات.",
      en: "The customer ships 3 phones but you enter 1 → the price is calculated for 1, and the company loses the profit on 2.",
      ar: "يشحن العميل 3 هواتف لكنك تُدخِل 1 → يُحتسَب السعر لقطعة واحدة وتخسر الشركة ربح القطعتين.",
      zh: "客户寄了 3 部手机但你录入 1 → 按 1 件计价，公司损失了 2 件的利润。" } },
  { id: "tip-5",
    short: {
      ku: "وێنەی کاڵا زیاد بکە — لە کاتی گەیاندندا ناسینەوەی پاکەت ئاسانتر دەکات.",
      en: "Add a product photo — it makes the package easier to identify at delivery.",
      ar: "أضِف صورة للمنتج — تُسهّل التعرّف على الطرد عند التسليم.",
      zh: "添加商品照片，便于交付时识别包裹。" },
    detail: {
      ku: "وێنەی کاڵا وایدەکات ستاف و کڕیار بزانن ناوەڕۆکی پاکەت چییە، بەبێ ئەوەی بیکەنەوە. لە کاتی گەیاندن یان دۆزینەوەی پاکەتی بێخاوەن، وێنە یارمەتیدەرێکی گەورەیە بۆ پشتڕاستکردنەوە. هەروەها ئەگەر کاڵا زیان ببینێت، وێنەی پێشوەخت بەڵگەیە.",
      en: "A product photo lets staff and the customer know what's inside the package without opening it. At delivery, or when finding an unclaimed package, the photo is a big help for confirmation. It's also evidence if the item is damaged later.",
      ar: "صورة المنتج تُمكّن الموظّفين والعميل من معرفة محتوى الطرد دون فتحه. عند التسليم أو عند إيجاد طرد بلا صاحب، تكون الصورة عوناً كبيراً للتأكيد. وهي أيضاً دليل إن تضرّرت السلعة لاحقاً.",
      zh: "商品照片让员工和客户无需打开包裹即可知道内容。在交付或寻找无主包裹时，照片对确认大有帮助。如果商品日后受损，它也是证据。" },
    example: {
      ku: "پاکەتی AZ001 وێنەی جووتە پێڵاوێکی هەیە → لە کاتی گەیاندن، خێرا لەگەڵ داواکارییەکەی دەگونجێنیت بەبێ کردنەوەی.",
      en: "AZ001's package has a photo of a pair of shoes → at delivery you quickly match it to the order without opening it.",
      ar: "طرد AZ001 يحمل صورة لزوج أحذية → عند التسليم تطابقه بسرعة مع الطلب دون فتحه.",
      zh: "AZ001 的包裹有一张鞋子的照片 → 交付时无需打开即可快速与订单匹配。" } },
  { id: "tip-6",
    short: {
      ku: "ئۆردەر نەمبەری دووبارە داخڵ مەکە — هەر ئۆردەرێک ئۆردەر نەمبەرێکی ناوازەی هەیە.",
      en: "Don't reuse an order number — each order has a unique one.",
      ar: "لا تُكرّر رقم الطلب — لكل طلب رقم فريد.",
      zh: "不要重复使用订单号——每个订单都有唯一编号。" },
    detail: {
      ku: "ئۆردەر نەمبەر ناسنامەی تاکی هەر ئۆردەرێکە و سیستەم پێی جیایان دەکاتەوە. ئەگەر ژمارەیەک دووبارە بەکاربهێنیت، سیستەم تێکدەچێت کە کام ئۆردەر مەبەستە و گەڕان و راپۆرتەکان هەڵە دەبن. هەمیشە ژمارەی نوێ بەکاربهێنە بۆ هەر ئۆردەرێکی نوێ.",
      en: "The order number is the unique identity of each order, and the system tells orders apart by it. If you reuse a number, the system can't tell which order you mean, and searches and reports go wrong. Always use a fresh number for each new order.",
      ar: "رقم الطلب هو الهوية الفريدة لكل طلب، والنظام يميّز الطلبات به. إذا أعدت استخدام رقم، يلتبس على النظام أيّ طلب تقصد، وتختلّ عمليات البحث والتقارير. استخدم دائماً رقماً جديداً لكل طلب جديد.",
      zh: "订单号是每个订单的唯一身份，系统据此区分订单。若重复使用某个编号，系统无法分辨你指的是哪个订单，搜索和报表都会出错。每个新订单务必使用新编号。" },
    example: {
      ku: "ئۆردەری AZ001 ژمارەی ORD-1042 هەیە. بۆ ئۆردەری دواتری هەمان کڕیار، ORD-1043 بەکاربهێنە، نەک دووبارە ORD-1042.",
      en: "AZ001's order has number ORD-1042. For the same customer's next order, use ORD-1043, not ORD-1042 again.",
      ar: "طلب AZ001 يحمل الرقم ORD-1042. لطلب العميل التالي استخدم ORD-1043، لا ORD-1042 مجدداً.",
      zh: "AZ001 的订单编号为 ORD-1042。该客户的下一个订单应使用 ORD-1043，而非再次使用 ORD-1042。" } },
  { id: "tip-7",
    short: {
      ku: "ئۆردەری بێ تراکینگ زۆر مەهێڵەرەوە — لە «ئاگاداری تراکینگ» بەردەوام بیانپشکنە.",
      en: "Don't leave orders without tracking for long — check them in \"Tracking alerts\".",
      ar: "لا تترك الطلبات بدون تتبّع طويلاً — تابِعها في «تنبيهات التتبّع».",
      zh: "不要让订单长期没有运单号——在「追踪提醒」中及时查看。" },
    detail: {
      ku: "ئۆردەری بێ تراکینگ ناتوانرێت بەدوایدا بگەڕێیت یان لە بۆکس سکان بکرێت — بەکردەوە ون دەبێت. بەشی «ئاگاداری تراکینگ» ئەو ئۆردەرانە کۆدەکاتەوە تاکو زوو چارەسەریان بکەیت. هەرچی زووتر تراکینگ زیاد بکەیت، ئۆردەرەکە خێراتر دەچێتە پرۆسەی گواستنەوە.",
      en: "An order without tracking can't be traced or scanned into a box — in practice it gets lost. The \"Tracking alerts\" section gathers those orders so you can resolve them early. The sooner you add a tracking number, the faster the order enters the shipping flow.",
      ar: "الطلب بدون تتبّع لا يمكن تتبّعه أو مسحه في صندوق — عملياً يضيع. قسم «تنبيهات التتبّع» يجمع تلك الطلبات لتعالجها مبكراً. وكلما أضفت رقم التتبّع أسرع، دخل الطلب مسار الشحن أسرع.",
      zh: "没有运单号的订单无法追踪，也无法扫描入箱——实际上会丢失。「追踪提醒」区汇集这些订单，便于你尽早处理。越早补录运单号，订单就越快进入运输流程。" },
    example: {
      ku: "ئۆردەری AZ001 سێ ڕۆژە بێ تراکینگە و لە «ئاگاداری تراکینگ» دەردەکەوێت → پەیوەندی بە کڕیارەوە بکە و ژمارەکە وەربگرە.",
      en: "AZ001's order has been without tracking for three days and shows up in \"Tracking alerts\" → contact the customer and get the number.",
      ar: "طلب AZ001 بلا تتبّع منذ ثلاثة أيام ويظهر في «تنبيهات التتبّع» → تواصل مع العميل واحصل على الرقم.",
      zh: "AZ001 的订单已三天没有运单号，出现在「追踪提醒」中 → 联系客户并取得编号。" } },
  { id: "tip-8",
    short: {
      ku: "پێش داخستنی بۆکس، دووبارە هەموو پاکەتەکان سکان بکە تاکو هیچ پاکێجێک لە یاد نەچێت.",
      en: "Before sealing a box, re-scan every package so none is forgotten.",
      ar: "قبل إغلاق الصندوق، أعِد مسح كل الطرود حتى لا يُنسى أيٌّ منها.",
      zh: "封箱前重新扫描所有包裹，确保不遗漏任何一个。" },
    detail: {
      ku: "هەر پاکەتێک کە سکان دەکرێت، دەچێتە ناو بۆکسەکەوە و لە سیستەمدا تۆمار دەبێت. ئەگەر پاکەتێک سکان نەکرابێت، لە بۆکس بەجێدەمێنێتەوە و کڕیارەکەی پاکەتەکەی ناگاتێ. پشکنینی کۆتایی پێش داخستن دڵنیات دەکات ژمارەی پاکەتە سکانکراوەکان لەگەڵ ئەوانەی لەبەردەستن یەکن.",
      en: "Every scanned package goes into the box and is recorded in the system. If a package wasn't scanned, it's left out of the box and its customer never receives it. A final check before sealing makes sure the number of scanned packages matches the ones in hand.",
      ar: "كل طرد يُمسَح يدخل الصندوق ويُسجَّل في النظام. إذا لم يُمسَح طرد، يبقى خارج الصندوق ولا يستلمه عميله أبداً. التحقق النهائي قبل الإغلاق يضمن تطابق عدد الطرود الممسوحة مع التي بين يديك.",
      zh: "每个扫描的包裹都进入箱子并记入系统。若某包裹未被扫描，就会被遗漏在箱外，其客户永远收不到。封箱前的最终核对可确保扫描数量与手中实物相符。" },
    example: {
      ku: "١٢ پاکەتت لەبەردەستە بەڵام سیستەم تەنها ١١ سکانکراو پیشان دەدات → یەک پاکەت لەبیر کراوە، بیدۆزەرەوە و سکانی بکە پێش داخستن.",
      en: "You have 12 packages in hand but the system shows only 11 scanned → one was missed; find it and scan it before sealing.",
      ar: "لديك 12 طرداً لكن النظام يُظهِر 11 ممسوحاً فقط → نُسي واحد؛ جِده وامسَحه قبل الإغلاق.",
      zh: "你手上有 12 个包裹，但系统只显示 11 个已扫描 → 漏了一个；封箱前找到并扫描它。" } },
  { id: "tip-9",
    short: {
      ku: "نرخی گواستنەوەی بۆکس پشکنین بکە پێش ناردن — دوای ناردن گۆڕینی ئاستەمە.",
      en: "Check the box's shipping price before sending — it's hard to change afterwards.",
      ar: "تحقّق من سعر شحن الصندوق قبل الإرسال — تغييره لاحقاً صعب.",
      zh: "发货前核对箱子的运费——发货后很难更改。" },
    detail: {
      ku: "کاتێک بۆکس دەنێردرێت، نرخی گواستنەوەکەی لە کڕیار(ەکان) چارج دەکرێت و لە حساباتدا جێگیر دەبێت. گۆڕینی دوای ناردن مانای گەڕاندنەوەی چارج و دووبارە حسابکردنە، کە ئاڵۆزە. بۆیە پێش کرتەی «ناردن» نرخەکە بپشکنە.",
      en: "When a box is sent, its shipping price is charged to the customer(s) and locked into the accounts. Changing it after sending means reversing the charge and recalculating, which is messy. So check the price before you click \"Send\".",
      ar: "عند إرسال الصندوق، يُحصَّل سعر شحنه من العميل(العملاء) ويُثبَّت في الحسابات. تغييره بعد الإرسال يعني عكس التحصيل وإعادة الاحتساب، وهو أمر معقّد. لذا تحقّق من السعر قبل النقر على «إرسال».",
      zh: "箱子发出时，其运费会向客户计费并锁定到账目中。发货后更改意味着撤销计费并重新计算，相当麻烦。所以点击「发送」前先核对价格。" },
    example: {
      ku: "بۆکسێک ١٠kg لەخۆ دەگرێت بە نرخی $7/kg → نرخی گواستنەوە دەبێت $70. پێش ناردن دڵنیابە ٧٠ـە، نەک ٦٠ بەهۆی هەڵەی کێش.",
      en: "A box holds 10 kg at $7/kg → shipping should be $70. Before sending, confirm it's $70, not $60 due to a weight error.",
      ar: "صندوق يحوي 10 كغ بسعر 7$/كغ → يجب أن يكون الشحن 70$. قبل الإرسال تأكّد أنه 70$، لا 60$ بسبب خطأ في الوزن.",
      zh: "一个箱子装 10 公斤、每公斤 7 美元 → 运费应为 70 美元。发货前确认是 70 美元，而非因重量错误变成 60 美元。" } },
  { id: "tip-10",
    short: {
      ku: "پاکەتە بێخاوەنەکان زوو خاوەنیان بدۆزەرەوە — درەنگکەوتن دەبێتە کێشە.",
      en: "Find owners for unclaimed packages quickly — delays cause problems.",
      ar: "ابحث عن أصحاب الطرود غير المطالَب بها بسرعة — التأخير يسبّب مشاكل.",
      zh: "尽快为无主包裹找到主人——拖延会带来麻烦。" },
    detail: {
      ku: "پاکەتی بێخاوەن ئەوەیە کە گەیشتووە بەڵام بە هیچ کڕیارێکەوە نەبەستراوەتەوە. هەرچی زیاتر بمێنێتەوە، بیرکردنەوەی لێی سەختتر دەبێت و شوێنی کۆگا داگیر دەکات. بە تراکینگ یان وێنە بەدوای خاوەنەکەیدا بگەڕێ و یەکسەر ببەستەوە بە ئۆردەرەکەیەوە.",
      en: "An unclaimed package is one that has arrived but isn't linked to any customer. The longer it sits, the harder it is to recall and the more storage space it ties up. Use the tracking number or photo to find its owner and link it to the order right away.",
      ar: "الطرد بلا صاحب هو الذي وصل لكنه غير مرتبط بأي عميل. كلما طال بقاؤه، صعب تذكّره وشغل مساحة في المخزن. استخدم رقم التتبّع أو الصورة لإيجاد صاحبه واربطه بالطلب فوراً.",
      zh: "无主包裹是已到货但未关联任何客户的包裹。它停留越久，越难追溯，也越占用仓储空间。用运单号或照片找到主人，并立即关联到订单。" },
    example: {
      ku: "پاکەتێک بە تراکینگ YT7600001111 گەیشتووە بەڵام بێخاوەنە → لە سیستەم بگەڕێ؛ دەردەکەوێت هی AZ001ـە و یەکسەر ببەستەوە.",
      en: "A package arrived with tracking YT7600001111 but is unclaimed → search the system; it turns out to be AZ001's and link it at once.",
      ar: "وصل طرد برقم التتبّع YT7600001111 لكنه بلا صاحب → ابحث في النظام؛ يتبيّن أنه لـ AZ001 فاربطه فوراً.",
      zh: "一个运单号为 YT7600001111 的包裹到货但无主 → 在系统中搜索；发现属于 AZ001，立即关联。" } },
  { id: "tip-11",
    short: {
      ku: "ژمارەی مۆبایلی کڕیار بە دروستی تۆمار بکە — بۆ ئاگادارکردنەوەکان گرنگە.",
      en: "Record the customer's phone number correctly — it matters for notifications.",
      ar: "سجّل رقم هاتف العميل بشكل صحيح — مهم للإشعارات.",
      zh: "正确录入客户的手机号——这对通知很重要。" },
    detail: {
      ku: "ژمارەی مۆبایل ڕێگای سەرەکی پەیوەندی لەگەڵ کڕیارە — بۆ ئاگادارکردنەوەی دۆخی ئۆردەر و وەرگرتنی پاکەت. ئەگەر ژمارەکە هەڵە بێت، کڕیار هیچ پەیامێک وەرناگرێت و لەوانەیە پاکەتەکەی درەنگ وەربگرێت. بۆیە ژمارەکە بە وردی و بە ژمارەی دروستی نێودەوڵەتی تۆمار بکە.",
      en: "The phone number is the main channel to reach the customer — for order-status alerts and package pickup. If the number is wrong, the customer gets no message and may collect their package late. So record it accurately, with the correct country format.",
      ar: "رقم الهاتف هو القناة الرئيسية للوصول للعميل — لتنبيهات حالة الطلب واستلام الطرد. إذا كان الرقم خاطئاً، لا يصل العميل أي رسالة وقد يتأخّر في استلام طرده. لذا سجّله بدقّة وبالصيغة الدولية الصحيحة.",
      zh: "手机号是联系客户的主要渠道——用于订单状态通知和包裹取件。号码错误，客户收不到任何信息，可能延迟取件。所以请准确录入，并采用正确的国际格式。" },
    example: {
      ku: "کڕیار AZ001 ژمارەی 0750 123 4567 ـە. ئەگەر بە هەڵە 0750 123 4576 بنووسیت، پەیامەکان بۆ کەسی هەڵە دەچن.",
      en: "Customer AZ001's number is 0750 123 4567. If you mistype it as 0750 123 4576, the messages go to the wrong person.",
      ar: "رقم العميل AZ001 هو 0750 123 4567. إذا كتبته خطأً 0750 123 4576، تذهب الرسائل للشخص الخطأ.",
      zh: "客户 AZ001 的号码是 0750 123 4567。若误输为 0750 123 4576，信息会发给错误的人。" } },
  { id: "tip-12",
    short: {
      ku: "جۆری خزمەتی کڕیار دیاری بکە (پاکێجی تەواو / کرین بە تێچوو / سێلف ئۆردەر) بۆ فلتەری خێراتر.",
      en: "Set the customer's service types (full package / cost purchase / self order) for faster filtering.",
      ar: "حدّد أنواع خدمة العميل (الطرد الكامل / الشراء بالتكلفة / الطلب الذاتي) لتصفية أسرع.",
      zh: "设置客户的服务类型（完整包裹 / 成本代购 / 自购订单），便于快速筛选。" },
    detail: {
      ku: "هەر کڕیارێک لەوانەیە یەک یان چەند جۆری خزمەتی بەکاربهێنێت، و دیاریکردنیان وایدەکات لیستەکان بەپێی جۆری خزمەت فلتەر بکەیت. ئەمە یارمەتیت دەدات خێراتر کڕیارە گونجاوەکان بدۆزیتەوە و راپۆرتە دروستەکان دروست بکەیت. دیاریکردنی دروست لە سەرەتاوە کاتت دەپارێزێت لە داهاتوودا.",
      en: "Each customer may use one or several service types, and tagging them lets you filter lists by service type. This helps you find the right customers faster and build accurate reports. Setting it right from the start saves time down the road.",
      ar: "قد يستخدم كل عميل نوعاً أو عدّة أنواع من الخدمة، ووسمها يتيح لك تصفية القوائم حسب نوع الخدمة. هذا يساعدك في إيجاد العملاء المناسبين أسرع وبناء تقارير دقيقة. الضبط الصحيح من البداية يوفّر الوقت لاحقاً.",
      zh: "每位客户可能使用一种或多种服务类型，标注后即可按服务类型筛选列表。这能帮你更快找到合适的客户并生成准确报表。一开始设置正确可省去日后的时间。" },
    example: {
      ku: "کڕیار AZ001 هەردوو «پاکێجی تەواو» و «سێلف ئۆردەر» بەکاردەهێنێت → هەردووکیان هەڵبژێرە؛ دواتر لە فلتەری «سێلف ئۆردەر» دەردەکەوێت.",
      en: "Customer AZ001 uses both \"full package\" and \"self order\" → select both; later they appear in the \"self order\" filter.",
      ar: "العميل AZ001 يستخدم «الطرد الكامل» و«الطلب الذاتي» معاً → اختَر كليهما؛ لاحقاً يظهر في تصفية «الطلب الذاتي».",
      zh: "客户 AZ001 同时使用「完整包裹」和「自购订单」 → 两者都选中；日后在「自购订单」筛选中会出现。" } },
  { id: "tip-13",
    short: {
      ku: "زانیاریی کڕیار تەواو پڕبکەرەوە — داتای ناتەواو دواتر دەبێتە کێشە.",
      en: "Fill in the customer's details completely — incomplete data causes problems later.",
      ar: "املأ بيانات العميل كاملةً — البيانات الناقصة تسبّب مشاكل لاحقاً.",
      zh: "完整填写客户信息——信息不全日后会出问题。" },
    detail: {
      ku: "زانیاریی تەواوی کڕیار — ناو، ژمارە، شار، جۆری خزمەت — بنەمای پەیوەندی و گەیاندن و راپۆرتە. ئەگەر خانەیەک بەتاڵ بمێنێتەوە، لەوانەیە دواتر نەتوانیت پەیوەندی بکەیت یان پاکەتەکە بگەیەنیت. لە سەرەتاوە تەواوی بکە، تاکو دواتر بەدوای زانیاریدا نەگەڕێیت.",
      en: "Complete customer data — name, phone, city, service type — is the basis for contact, delivery, and reports. If a field is left blank, you may later be unable to reach the customer or deliver the package. Fill it in fully at the start so you're not chasing missing info later.",
      ar: "بيانات العميل الكاملة — الاسم، الهاتف، المدينة، نوع الخدمة — هي أساس التواصل والتسليم والتقارير. إذا تُرك حقل فارغاً، قد لا تتمكّن لاحقاً من الوصول للعميل أو تسليم الطرد. املأها كاملةً من البداية كي لا تطارد المعلومات الناقصة لاحقاً.",
      zh: "完整的客户资料——姓名、电话、城市、服务类型——是联系、交付和报表的基础。若某字段留空，日后可能无法联系客户或交付包裹。一开始就填完整，免得日后到处找缺失信息。" },
    example: {
      ku: "بۆ AZ001 شارەکەی بەتاڵ هێشتووەتەوە → لە کاتی گەیاندن نازانیت بۆ کام شار بنێردرێت و کاتی زۆر لەدەست دەدەیت.",
      en: "You left AZ001's city blank → at delivery you don't know which city to send to and waste a lot of time.",
      ar: "تركت مدينة AZ001 فارغة → عند التسليم لا تعرف لأي مدينة تُرسِل وتُهدر وقتاً كثيراً.",
      zh: "你把 AZ001 的城市留空了 → 交付时不知道该送往哪个城市，浪费大量时间。" } },
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
  { id: "tip-15",
    short: {
      ku: "پارەی پێشەکی بە وردی تۆمار بکە — دواتر چارەسەری ئاستەمە.",
      en: "Record advance payments carefully — they're hard to fix later.",
      ar: "سجّل الدفعات المقدّمة بدقّة — يصعب تصحيحها لاحقاً.",
      zh: "认真登记预付款——日后很难更正。" },
    detail: {
      ku: "پارەی پێشەکی ئەو بڕەیە کە کڕیار پێش تەواوبوونی ئۆردەر دەیدات، و لە باڵانسی کڕیار دادەنرێت. ئەگەر بە هەڵە تۆماری بکەیت، حسابی کڕیار تێکدەچێت و دواتر دۆزینەوە و چاککردنی ئاڵۆزە. بۆیە بڕ و کڕیارەکە بە وردی بپشکنە پێش تۆمارکردن.",
      en: "An advance payment is the amount a customer pays before the order is finished, and it sits in the customer's balance. If recorded wrong, the customer's account is thrown off and tracing and fixing it later is messy. So check the amount and the customer carefully before recording.",
      ar: "الدفعة المقدّمة هي المبلغ الذي يدفعه العميل قبل اكتمال الطلب، وتُدرَج في رصيد العميل. إذا سُجّلت خطأً، يختلّ حساب العميل ويصعب تتبّعها وتصحيحها لاحقاً. لذا تحقّق من المبلغ والعميل بدقّة قبل التسجيل.",
      zh: "预付款是客户在订单完成前支付的金额，计入客户余额。若登记错误，客户账户会出错，日后追查和更正都很麻烦。所以登记前请仔细核对金额和客户。" },
    example: {
      ku: "کڕیار AZ001 پێشەکی $30 دەدات → بە دروستی $30 لەسەر AZ001 تۆمار بکە؛ ئەگەر بە هەڵە $300 بنووسیت، باڵانسی هەڵە دەبێت.",
      en: "Customer AZ001 pays a $30 advance → record exactly $30 on AZ001; if you mistype $300, the balance is wrong.",
      ar: "يدفع العميل AZ001 دفعة مقدّمة 30$ → سجّل 30$ بالضبط على AZ001؛ إذا كتبت 300$ خطأً، يصبح الرصيد خاطئاً.",
      zh: "客户 AZ001 预付 30 美元 → 在 AZ001 名下准确登记 30 美元；若误输 300 美元，余额就会出错。" } },
  { id: "tip-16",
    short: {
      ku: "کڕیارە قەرزدارەکان لە داشبۆرد چاودێری بکە.",
      en: "Keep an eye on debtor customers from the dashboard.",
      ar: "راقِب العملاء المدينين من لوحة التحكم.",
      zh: "在仪表板上留意欠款客户。" },
    detail: {
      ku: "کڕیاری قەرزدار ئەوەیە کە باڵانسەکەی نەرێیە — واتە زیاتری لێ چارج کراوە لەوەی پارەی داوە. داشبۆرد ئەم کڕیارانە کۆدەکاتەوە تاکو زوو پەیوەندییان پێوە بکەیت و قەرز کۆبکەیتەوە. چاودێریی بەردەوام ڕێگری دەکات لە کۆبوونەوەی قەرزی گەورە.",
      en: "A debtor customer is one whose balance is negative — that is, charged more than they've paid. The dashboard gathers these customers so you can contact them early and collect the debt. Steady monitoring prevents large debts from piling up.",
      ar: "العميل المدين هو من رصيده سالب — أي حُصّل منه أكثر مما دفع. تجمع لوحة التحكم هؤلاء العملاء لتتواصل معهم مبكراً وتُحصّل الدين. المراقبة المستمرّة تمنع تراكم الديون الكبيرة.",
      zh: "欠款客户是指余额为负的客户——即计费多于其已付款。仪表板汇集这些客户，便于你尽早联系并催收。持续监控可防止大额欠款堆积。" },
    example: {
      ku: "لە داشبۆرد دەبینیت AZ001 باڵانسی −$420ـە → پەیوەندی پێوە بکە بۆ یەکلایی کردنەوەی قەرزەکە پێش ئەوەی زیاتر بێت.",
      en: "On the dashboard you see AZ001 has a −$420 balance → contact them to settle the debt before it grows.",
      ar: "في لوحة التحكم ترى أن رصيد AZ001 هو −420$ → تواصل معه لتسوية الدين قبل أن يكبر.",
      zh: "在仪表板上你看到 AZ001 余额为 −420 美元 → 联系他在欠款增大前结清。" } },
  { id: "tip-17",
    short: {
      ku: "ئۆردەری گەورە (زیاتر لە $1000) چاوت لەسەر بێت.",
      en: "Keep an eye on large orders (over $1000).",
      ar: "راقِب الطلبات الكبيرة (أكثر من 1000$).",
      zh: "留意大额订单（超过 1000 美元）。" },
    detail: {
      ku: "ئۆردەری گەورە مەترسیی داراییی زیاتری هەیە — هەڵەیەکی بچووک لە نرخ یان کێش دەبێتە زیانێکی گەورە. داشبۆرد ئەم ئۆردەرانە جیادەکاتەوە تاکو دووبارە بپشکنیت و دڵنیابیت هەموو شتێک دروستە. چاودێریی زیاتر بۆ ئۆردەری گەورە، پاراستنی پارەی زیاترە.",
      en: "A large order carries more financial risk — a small error in price or weight becomes a big loss. The dashboard flags these orders so you can re-check them and make sure everything is right. Extra attention on large orders means protecting more money.",
      ar: "الطلب الكبير يحمل مخاطر مالية أكبر — خطأ صغير في السعر أو الوزن يصبح خسارة كبيرة. تُبرِز لوحة التحكم هذه الطلبات لتعيد التحقق منها وتتأكّد أن كل شيء صحيح. الاهتمام الإضافي بالطلبات الكبيرة يعني حماية أموال أكثر.",
      zh: "大额订单财务风险更大——价格或重量上的小错误会变成大损失。仪表板会标记这些订单，便于你复核并确保一切无误。对大额订单多加留意，就是保护更多的钱。" },
    example: {
      ku: "ئۆردەری AZ001 بە $1,250 لە داشبۆرد دەردەکەوێت → نرخ و کێش و کڕیار دووبارە بپشکنە پێش چارجکردن.",
      en: "AZ001's $1,250 order appears on the dashboard → re-check the price, weight, and customer before charging.",
      ar: "يظهر طلب AZ001 بقيمة 1,250$ في لوحة التحكم → أعِد التحقق من السعر والوزن والعميل قبل التحصيل.",
      zh: "AZ001 价值 1,250 美元的订单出现在仪表板上 → 计费前复核价格、重量和客户。" } },
  { id: "tip-18",
    short: {
      ku: "قازانج و خەرجیی ڕۆژانە لە داشبۆرد بپشکنە.",
      en: "Review daily profit and expenses on the dashboard.",
      ar: "راجِع الأرباح والمصاريف اليومية في لوحة التحكم.",
      zh: "在仪表板上查看每日利润和支出。" },
    detail: {
      ku: "داشبۆرد قازانج و خەرجیی هەر ڕۆژێک پیشان دەدات، تاکو دۆخی داراییی کۆمپانیا بزانیت. پشکنینی ڕۆژانە یارمەتیت دەدات زوو هەڵە یان لاوازی بدۆزیتەوە — وەک ڕۆژێک کە خەرجی لە قازانج زیاترە. ئەم چاودێرییە بڕیاری باشتر دەداتە دەستت.",
      en: "The dashboard shows each day's profit and expenses so you can see the company's financial health. A daily review helps you spot problems or weakness early — like a day where expenses exceed profit. This monitoring leads to better decisions.",
      ar: "تُظهِر لوحة التحكم أرباح ومصاريف كل يوم لتعرف الوضع المالي للشركة. المراجعة اليومية تساعدك على اكتشاف المشاكل أو الضعف مبكراً — كيوم تتجاوز فيه المصاريف الأرباح. هذه المراقبة تقود لقرارات أفضل.",
      zh: "仪表板显示每天的利润和支出，让你了解公司的财务状况。每日查看有助于尽早发现问题或薄弱环节——比如支出超过利润的某一天。这种监控带来更好的决策。" },
    example: {
      ku: "ئەمڕۆ قازانج $320 و خەرجی $400 → داشبۆرد زیانی $80 پیشان دەدات؛ هۆکارەکە بدۆزەرەوە.",
      en: "Today's profit is $320 and expenses $400 → the dashboard shows an $80 loss; find out why.",
      ar: "ربح اليوم 320$ والمصاريف 400$ → تُظهِر لوحة التحكم خسارة 80$؛ ابحث عن السبب.",
      zh: "今天利润 320 美元、支出 400 美元 → 仪表板显示亏损 80 美元；查明原因。" } },
  { id: "tip-19",
    short: {
      ku: "پێش ناردن، دڵنیابە پاکەتەکان لە باچی دروستدان.",
      en: "Before shipping, make sure the packages are in the correct batch.",
      ar: "قبل الشحن، تأكّد أن الطرود في الدفعة الصحيحة.",
      zh: "发货前，确认包裹在正确的批次中。" },
    detail: {
      ku: "باچ کۆمەڵێک پاکەتە کە پێکەوە بە یەک ڕێگا (ئاسمانی/دەریایی) و یەک ڕێژەی نرخ دەنێردرێن. ئەگەر پاکەتێک لە باچی هەڵە بێت، بە ڕێگا یان نرخی هەڵە حساب دەکرێت و گەیشتنەکەی دواخراو دەبێت. بۆیە پێش ناردن دڵنیابە هەر پاکەتێک لە باچی دروستی خۆیەتی.",
      en: "A batch is a group of packages sent together by one route (air/sea) and one rate. If a package is in the wrong batch, it's priced by the wrong route or rate and its arrival is delayed. So before shipping, make sure each package is in its correct batch.",
      ar: "الدفعة مجموعة طرود تُرسَل معاً بمسار واحد (جوّي/بحري) وسعر واحد. إذا كان طرد في الدفعة الخطأ، يُسعّر بمسار أو سعر خاطئ ويتأخّر وصوله. لذا قبل الشحن تأكّد أن كل طرد في دفعته الصحيحة.",
      zh: "批次是一组按同一路线（空运/海运）和同一费率一起发运的包裹。若某包裹在错误的批次中，会按错误的路线或费率计价，到货也会延误。所以发货前确认每个包裹都在正确的批次中。" },
    example: {
      ku: "پاکەتی AZ001 بە ئاسمانی دەچێت بەڵام بە هەڵە لە باچی دەریایی دایە → بیگوازەرەوە بۆ باچی ئاسمانی پێش ناردن.",
      en: "AZ001's package goes by air but is wrongly in the sea batch → move it to the air batch before shipping.",
      ar: "طرد AZ001 يُشحَن جوّاً لكنه خطأً في دفعة بحرية → انقله إلى الدفعة الجوّية قبل الشحن.",
      zh: "AZ001 的包裹走空运，却被误放在海运批次中 → 发货前将其移至空运批次。" } },
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
  { id: "tip-21",
    short: {
      ku: "خێراییی باچەکان (چەند ڕۆژ گەیشتوون) بەراورد بکە بۆ باشترکردنی خزمەت.",
      en: "Compare batch speeds (days to arrive) to improve service.",
      ar: "قارِن سرعة الدفعات (أيام الوصول) لتحسين الخدمة.",
      zh: "比较各批次的速度（到货天数）以改进服务。" },
    detail: {
      ku: "هەر باچێک ماوەیەکی جیاوازی گەیشتنی هەیە، و بەراوردکردنیان پیشانی دەدات کام ڕێگا و کام لۆجستیک خێراترن. ئەم زانیارییە یارمەتیت دەدات باشترین هەڵبژاردن بۆ کڕیار پێشنیار بکەیت و خزمەت باشتر بکەیت. باچی خاو بکەرە هۆکاری ناڕەزایی کڕیار، بۆیە بەدوایدا بگەڕێ.",
      en: "Each batch arrives in a different time, and comparing them shows which route and which logistics are faster. This information helps you recommend the best option to the customer and improve service. A slow batch becomes a source of customer complaints, so look into it.",
      ar: "تصل كل دفعة في وقت مختلف، ومقارنتها تُظهِر أي مسار وأي خدمة لوجستية أسرع. هذه المعلومة تساعدك على اقتراح الخيار الأفضل للعميل وتحسين الخدمة. الدفعة البطيئة تصبح مصدر شكاوى العملاء، فتقصّاها.",
      zh: "每个批次到货时间不同，比较它们可看出哪条路线、哪家物流更快。这些信息帮你向客户推荐最佳选项并改进服务。慢批次会引发客户投诉，应予以排查。" },
    example: {
      ku: "باچی ئاسمانی A ٧ ڕۆژ گەیشت، باچی ئاسمانی B ١٢ ڕۆژ → بۆ ئۆردەری بەپەلە، باچی A پێشنیار بکە.",
      en: "Air batch A arrived in 7 days, air batch B in 12 → for urgent orders, recommend batch A.",
      ar: "وصلت الدفعة الجوّية A في 7 أيام، والدفعة B في 12 → للطلبات العاجلة اقترِح الدفعة A.",
      zh: "空运批次 A 用 7 天到货，批次 B 用 12 天 → 加急订单推荐批次 A。" } },
  { id: "tip-22",
    short: {
      ku: "بۆ دۆزینەوەی خێرای هەر فەنکشنێک، Ctrl+K بەکاربهێنە.",
      en: "Press Ctrl+K to quickly find any function.",
      ar: "اضغط Ctrl+K للعثور بسرعة على أي وظيفة.",
      zh: "按 Ctrl+K 可快速查找任意功能。" },
    detail: {
      ku: "Ctrl+K سندوقی گەڕانی خێرا دەکاتەوە کە تێیدا دەتوانیت ناوی هەر پەڕە یان کارێک بنووسیت و یەکسەر بیکەیتەوە. ئەمە کاتت دەپارێزێت لە گەڕان بەناو مێنیووەکاندا. هەرچی زیاتر بەکاری بهێنیت، کارەکانت خێراتر دەبن.",
      en: "Ctrl+K opens a quick-search box where you can type the name of any page or action and jump straight to it. This saves the time of hunting through menus. The more you use it, the faster your work gets.",
      ar: "يفتح Ctrl+K صندوق بحث سريع تكتب فيه اسم أي صفحة أو إجراء وتنتقل إليه مباشرةً. هذا يوفّر وقت البحث في القوائم. كلما استخدمته أكثر، صار عملك أسرع.",
      zh: "Ctrl+K 打开快速搜索框，输入任意页面或操作的名称即可直接跳转。这省去了在菜单中翻找的时间。用得越多，工作越快。" },
    example: {
      ku: "دەتەوێت ئۆردەرێکی نوێ تۆمار بکەیت → Ctrl+K بکەرەوە، «ئۆردەری نوێ» بنووسە و Enter بکە؛ یەکسەر فۆرمەکە دەکرێتەوە.",
      en: "You want to register a new order → press Ctrl+K, type \"New order\" and hit Enter; the form opens right away.",
      ar: "تريد تسجيل طلب جديد → اضغط Ctrl+K، اكتب «طلب جديد» واضغط Enter؛ يُفتَح النموذج فوراً.",
      zh: "你想登记新订单 → 按 Ctrl+K，输入「新订单」并回车；表单立即打开。" } },
  { id: "tip-23",
    short: {
      ku: "لە ستریپە سەرەوەکە دوگمەی گەڕانەوە/پێش هەیە — خێراتر دەگەڕێیتەوە.",
      en: "The top bar has back/forward buttons — navigate faster.",
      ar: "يحتوي الشريط العلوي على أزرار رجوع/تقدّم — تنقّل أسرع.",
      zh: "顶部栏有后退/前进按钮，可更快导航。" },
    detail: {
      ku: "دوگمەی گەڕانەوە/پێش لە ستریپی سەرەوە وایدەکات بەبێ گەڕانەوە بۆ مێنیووی سەرەکی، بچیتەوە بۆ پەڕەی پێشوو یان پێشەوە. ئەمە کاتت دەپارێزێت کاتێک نێوان چەند پەڕەدا دەجوڵێیتەوە. وەک گەڕانەوەی وێبگەڕ کاردەکات بەڵام لەناو سیستەمەکەدا.",
      en: "The back/forward buttons in the top bar let you return to the previous page or move ahead without going back to the main menu. This saves time when you're moving between several pages. It works like a browser's back button, but inside the system.",
      ar: "تتيح لك أزرار الرجوع/التقدّم في الشريط العلوي العودة للصفحة السابقة أو التقدّم دون العودة للقائمة الرئيسية. هذا يوفّر الوقت عند التنقّل بين عدّة صفحات. تعمل كزر الرجوع في المتصفّح لكن داخل النظام.",
      zh: "顶部栏的后退/前进按钮让你无需回到主菜单即可返回上一页或前进。在多个页面间移动时这能省时间。它的作用类似浏览器的后退按钮，但在系统内部。" },
    example: {
      ku: "لە لیستی ئۆردەرەوە چوویتە ناو ئۆردەرێک، دەتەوێت بگەڕێیتەوە لیست → دوگمەی گەڕانەوە لێبدە، نەک مێنیووی سەرەکی.",
      en: "You went from the order list into an order and want to return to the list → click the back button, not the main menu.",
      ar: "انتقلت من قائمة الطلبات إلى طلب وتريد العودة للقائمة → انقر زر الرجوع، لا القائمة الرئيسية.",
      zh: "你从订单列表进入某个订单，想返回列表 → 点击后退按钮，而非主菜单。" } },
  { id: "tip-24",
    short: {
      ku: "شۆرتکەتە پینکراوەکانی سەرەوە بۆ کارە ڕۆژانەییەکان بەکاربهێنە.",
      en: "Use the pinned top-bar shortcuts for your daily tasks.",
      ar: "استخدم اختصارات الشريط العلوي المثبّتة لمهامك اليومية.",
      zh: "使用顶部栏固定的快捷方式处理日常任务。" },
    detail: {
      ku: "شۆرتکەتی پینکراو دوگمەی خێرایە بۆ ئەو کارانەی زۆرجار بەکاریان دەهێنیت، وەک تۆمارکردنی ئۆردەر یان کردنەوەی بۆکس. لە جیاتی گەڕان بەناو مێنیووەکاندا، بە یەک کرتە دەگەیتە کارەکە. پینکردنی کارە ڕۆژانەییەکان ڕۆژەکەت خێراتر و ڕێکتر دەکات.",
      en: "A pinned shortcut is a quick button for the actions you use most, like registering an order or opening a box. Instead of digging through menus, you reach the task in one click. Pinning your daily tasks makes your day faster and smoother.",
      ar: "الاختصار المثبّت زر سريع للإجراءات التي تستخدمها كثيراً، كتسجيل طلب أو فتح صندوق. بدل البحث في القوائم، تصل للمهمّة بنقرة واحدة. تثبيت مهامك اليومية يجعل يومك أسرع وأكثر سلاسة.",
      zh: "固定的快捷方式是你最常用操作的快速按钮，比如登记订单或打开箱子。无需在菜单中翻找，一键即可到达任务。固定日常任务让你的一天更快更顺。" },
    example: {
      ku: "هەموو ڕۆژێک ئۆردەر تۆمار دەکەیت → «ئۆردەری نوێ» پین بکە تاکو هەمیشە لە سەرەوەی شاشە بەردەست بێت.",
      en: "You register orders every day → pin \"New order\" so it's always available at the top of the screen.",
      ar: "تسجّل طلبات كل يوم → ثبّت «طلب جديد» ليكون دائماً متاحاً أعلى الشاشة.",
      zh: "你每天都登记订单 → 固定「新订单」，让它始终在屏幕顶部可用。" } },
  { id: "tip-25",
    short: {
      ku: "لە لیستەکاندا، بە ئایکۆنی کۆپی، کۆد/تراکینگ بە یەک کرتە کۆپی بکە.",
      en: "In lists, copy a code/tracking with one click using the copy icon.",
      ar: "في القوائم، انسخ الرمز/التتبّع بنقرة واحدة عبر أيقونة النسخ.",
      zh: "在列表中，用复制图标一键复制编号/运单号。" },
    detail: {
      ku: "ئایکۆنی کۆپی لەتەنیشت کۆد و تراکینگەکاندا وایدەکات بە یەک کرتە ژمارەکە کۆپی بکەیت، بەبێ نووسینەوەی بە دەست. ئەمە هەڵەی نووسین کەم دەکاتەوە — بەتایبەت لە تراکینگە درێژەکاندا. پاشان دەتوانیت لە شوێنی دیکە پەیستی بکەیت.",
      en: "The copy icon next to codes and tracking numbers lets you copy the number with one click, without retyping it by hand. This cuts typing errors — especially on long tracking numbers. You can then paste it elsewhere.",
      ar: "أيقونة النسخ بجانب الرموز وأرقام التتبّع تتيح لك نسخ الرقم بنقرة واحدة دون إعادة كتابته يدوياً. هذا يقلّل أخطاء الكتابة — خاصةً في أرقام التتبّع الطويلة. ثم يمكنك لصقه في مكان آخر.",
      zh: "编号和运单号旁的复制图标让你一键复制，无需手动重输。这能减少输入错误——尤其是较长的运单号。随后可粘贴到别处。" },
    example: {
      ku: "دەتەوێت تراکینگی YT7612345678 بدەیتە کڕیار → ئایکۆنی کۆپی لێبدە و لە واتساپ پەیستی بکە، نەک بە دەست بینووسیتەوە.",
      en: "You want to send tracking YT7612345678 to a customer → click the copy icon and paste it into WhatsApp, instead of typing it by hand.",
      ar: "تريد إرسال رقم التتبّع YT7612345678 لعميل → انقر أيقونة النسخ والصِقه في واتساب بدل كتابته يدوياً.",
      zh: "你想把运单号 YT7612345678 发给客户 → 点击复制图标并粘贴到 WhatsApp，而非手动输入。" } },
  { id: "tip-26",
    short: {
      ku: "لە لیستەکاندا، ماوس بخەرە سەر وێنەی کاڵا بۆ بینینی گەورەتر.",
      en: "In lists, hover over a product photo to see it larger.",
      ar: "في القوائم، مرّر المؤشّر فوق صورة المنتج لرؤيتها أكبر.",
      zh: "在列表中，将鼠标悬停在商品照片上可放大查看。" },
    detail: {
      ku: "وێنەکانی کاڵا لە لیستدا بچووکن بۆ پاراستنی شوێن، بەڵام بە خستنی ماوس بەسەریاندا گەورە دەبنەوە. ئەمە وایدەکات وردەکارییەکانی کاڵا ببینیت بەبێ کردنەوەی پەڕەیەکی نوێ. کاتت دەپارێزێت کاتێک بەخێرایی بەناو چەند ئۆردەردا دەڕوانیت.",
      en: "Product photos in the list are small to save space, but hovering over them enlarges them. This lets you see the item's details without opening a new page. It saves time when you're quickly scanning through several orders.",
      ar: "صور المنتجات في القائمة صغيرة لتوفير المساحة، لكن تمرير المؤشّر فوقها يُكبّرها. هذا يتيح لك رؤية تفاصيل السلعة دون فتح صفحة جديدة. يوفّر الوقت عند تصفّح عدّة طلبات بسرعة.",
      zh: "列表中的商品照片为节省空间而较小，但悬停即可放大。这让你无需打开新页面即可看清商品细节。在快速浏览多个订单时能省时间。" },
    example: {
      ku: "لیستی ئۆردەرەکان بینیت و دەتەوێت بزانیت کاڵای AZ001 چییە → ماوس بخەرە سەر وێنەکەی، گەورە دەبێتەوە و دەیبینیت.",
      en: "You're viewing the order list and want to know what AZ001's item is → hover over its photo, it enlarges and you can see it.",
      ar: "تتصفّح قائمة الطلبات وتريد معرفة ما هي سلعة AZ001 → مرّر المؤشّر فوق صورتها، تكبر فتراها.",
      zh: "你在浏览订单列表，想知道 AZ001 的商品是什么 → 悬停在其照片上即可放大查看。" } },
  { id: "tip-27",
    short: {
      ku: "دۆخی تاریک/ڕووناک لە سەرەوەی شاشە بەپێی حەزی خۆت بگۆڕە.",
      en: "Toggle dark/light mode at the top of the screen to your liking.",
      ar: "بدّل بين الوضع الداكن/الفاتح من أعلى الشاشة حسب رغبتك.",
      zh: "在屏幕顶部按喜好切换深色/浅色模式。" },
    detail: {
      ku: "دۆخی تاریک و ڕووناک تەنها جیاوازیی دیمەنە و کاریگەری لەسەر داتا نییە. دۆخی تاریک لە شوێنی کەمڕووناک چاو کەمتر ماندوو دەکات، دۆخی ڕووناک لە ڕووناکیی زۆردا ئاسانترە. ئەوەی بۆ تۆ ئاسوودەترە هەڵبژێرە تاکو بە ئاسوودەیی کاربکەیت.",
      en: "Dark and light mode are only a visual difference and don't affect data. Dark mode tires the eyes less in dim places; light mode is easier in bright light. Pick whichever is more comfortable so you can work at ease.",
      ar: "الوضع الداكن والفاتح مجرّد فرق بصري ولا يؤثّر على البيانات. الوضع الداكن يُجهِد العين أقل في الأماكن المعتمة؛ والفاتح أسهل في الإضاءة القوية. اختَر الأريح لك كي تعمل بارتياح.",
      zh: "深色与浅色模式只是视觉差异，不影响数据。深色模式在昏暗处不易使眼睛疲劳；浅色模式在强光下更易看清。选择更舒适的那种，让你轻松工作。" },
    example: {
      ku: "بەیانی لە ئۆفیسی ڕووناکدا دۆخی ڕووناک بەکاربهێنە؛ شەو لە ژووری کەمڕووناکدا بیگۆڕە بۆ تاریک.",
      en: "Use light mode in the bright office in the morning; switch to dark at night in a dim room.",
      ar: "استخدم الوضع الفاتح في المكتب المضيء صباحاً؛ وبدّل للداكن ليلاً في غرفة معتمة.",
      zh: "早上在明亮的办公室用浅色模式；夜里在昏暗房间切换为深色。" } },
  { id: "tip-28",
    short: {
      ku: "ئەگەر کۆمپیوتەرەکە هاوبەشە، دوای کار لە سیستەم دەربچۆ.",
      en: "If the computer is shared, log out when you finish.",
      ar: "إذا كان الحاسوب مشتركاً، سجّل الخروج عند الانتهاء.",
      zh: "如果是共用电脑，完成后请退出登录。" },
    detail: {
      ku: "هەر کارێک کە لە سیستەمدا دەیکەیت، بە ناوی ئەو ستافەوە تۆمار دەبێت کە چووەتە ژوورەوە. ئەگەر دەرنەچیت و کەسێکی دیکە بەکاربهێنێت، کارەکانیان بە ناوی تۆ تۆمار دەبێت و بەرپرسیارێتی تێکدەچێت. دەرچوون لە کۆمپیوتەری هاوبەش حسابەکەت و راستیی مێژووەکە دەپارێزێت.",
      en: "Everything you do in the system is recorded under the name of whoever is logged in. If you don't log out and someone else uses it, their actions are recorded as yours and accountability breaks down. Logging out on a shared computer protects your account and the accuracy of the history.",
      ar: "كل ما تفعله في النظام يُسجَّل باسم من سجّل الدخول. إذا لم تسجّل الخروج واستخدمه شخص آخر، تُسجَّل أفعاله باسمك وتنهار المساءلة. تسجيل الخروج على حاسوب مشترك يحمي حسابك ودقّة السجل.",
      zh: "你在系统中所做的一切都记录在当前登录者名下。若不退出而他人使用，其操作会记在你名下，问责便无从谈起。在共用电脑上退出登录可保护你的账户和历史记录的准确性。" },
    example: {
      ku: "کارت تەواوبوو و دەچیت → دەربچۆ؛ ئەگەر دەرنەچیت و هاوکارت ئۆردەرێک بسڕێتەوە، مێژوو دەڵێت تۆ سڕیوتەتەوە.",
      en: "You finish your work and leave → log out; if you don't and a colleague deletes an order, the history says you did it.",
      ar: "تنهي عملك وتغادر → سجّل الخروج؛ إن لم تفعل وحذف زميل طلباً، يقول السجل إنك أنت من حذفه.",
      zh: "你做完工作要离开 → 退出登录；若不退出而同事删了某订单，历史会显示是你删的。" } },
  { id: "tip-29",
    short: {
      ku: "وشەی نهێنی خۆت لەگەڵ کەس هاوبەش مەکە.",
      en: "Never share your password with anyone.",
      ar: "لا تُشارك كلمة مرورك مع أحد.",
      zh: "切勿与任何人分享你的密码。" },
    detail: {
      ku: "وشەی نهێنی کلیلی حسابی تۆیە و هەموو کارەکانت پێی دەبەسترێنەوە. ئەگەر کەسێکی دیکە بیزانێت، دەتوانێت بە ناوی تۆ کاربکات و تۆ بەرپرسیار دەبیت. هیچ کات وشەی نهێنیت بە کەس مەدە، تەنانەت هاوکار یان بەڕێوەبەریش.",
      en: "Your password is the key to your account, and all your actions are tied to it. If someone else knows it, they can act in your name and you'll be held responsible. Never give your password to anyone, not even a colleague or a manager.",
      ar: "كلمة مرورك هي مفتاح حسابك، وكل أفعالك مرتبطة بها. إذا عرفها شخص آخر، يمكنه التصرّف باسمك وتتحمّل أنت المسؤولية. لا تُعطِ كلمة مرورك لأحد أبداً، ولا حتى لزميل أو مدير.",
      zh: "密码是你账户的钥匙，你的所有操作都与之关联。若他人知晓，便可冒你之名行事，而责任由你承担。切勿把密码告诉任何人，哪怕是同事或主管。" },
    example: {
      ku: "هاوکارێک داوای وشەی نهێنیت لێ دەکات بۆ ئەوەی «خێرا ئۆردەرێک تۆمار بکات» → ڕەتی بکەرەوە؛ با بە حسابی خۆی بچێتە ژوورەوە.",
      en: "A colleague asks for your password to \"quickly register an order\" → refuse; let them log in with their own account.",
      ar: "يطلب زميل كلمة مرورك ليُسجّل طلباً «بسرعة» → ارفض؛ دعه يسجّل الدخول بحسابه.",
      zh: "同事索要你的密码以「快速登记一个订单」 → 拒绝；让他用自己的账户登录。" } },
  { id: "tip-30",
    short: {
      ku: "پێش سڕینەوەی هەر شتێک دڵنیابە — هەندێ سڕینەوە ناگەڕێتەوە.",
      en: "Be sure before deleting anything — some deletions can't be undone.",
      ar: "تأكّد قبل حذف أي شيء — بعض عمليات الحذف لا يمكن التراجع عنها.",
      zh: "删除任何内容前请确认——有些删除无法撤销。" },
    detail: {
      ku: "هەندێ سڕینەوە لە سیستەمدا «نەرمن» و دەگەڕێنەوە، بەڵام هەندێکی دیکە نەمر و کۆتایین. ئەگەر بەبێ دڵنیایی شتێک بسڕیتەوە، لەوانەیە داتایەکی گرنگ بۆ هەمیشە لەدەست بدەیت. بۆیە پێش هەر سڕینەوەیەک دووجار بیر بکەرەوە کە دروست شت هەڵبژێردراوە.",
      en: "Some deletions in the system are \"soft\" and can be recovered, but others are permanent and final. If you delete something without being sure, you may lose important data forever. So before any deletion, think twice that the right thing is selected.",
      ar: "بعض عمليات الحذف في النظام «ناعمة» وقابلة للاسترجاع، لكن أخرى دائمة ونهائية. إذا حذفت شيئاً دون تأكّد، قد تفقد بيانات مهمّة للأبد. لذا قبل أي حذف فكّر مرّتين أن الشيء الصحيح هو المُختار.",
      zh: "系统中有些删除是「软删除」可恢复，但有些是永久且不可逆的。若不确定就删除，可能永远丢失重要数据。所以每次删除前，请再三确认选中的是正确的对象。" },
    example: {
      ku: "دەتەوێت ئۆردەری AZ001 بسڕیتەوە بەڵام لیست AZ010 پیشان دەدات → بوەستە، دڵنیابە کام ئۆردەرە، پاشان بیسڕەوە.",
      en: "You mean to delete AZ001's order but the row shows AZ010 → stop, confirm which order it is, then delete.",
      ar: "تقصد حذف طلب AZ001 لكن الصفّ يُظهِر AZ010 → توقّف، تأكّد من الطلب، ثم احذف.",
      zh: "你想删除 AZ001 的订单，但该行显示的是 AZ010 → 停下，确认是哪个订单，再删除。" } },
  { id: "tip-31",
    short: {
      ku: "هەڵە بینیت؟ یەکسەر چاکی بکە — هەڵەی بچووک دەبێتە کێشەی گەورە.",
      en: "Spot a mistake? Fix it right away — small errors grow into big problems.",
      ar: "رأيت خطأً؟ صحّحه فوراً — الأخطاء الصغيرة تتحوّل إلى مشاكل كبيرة.",
      zh: "发现错误？立即纠正——小错误会演变成大问题。" },
    detail: {
      ku: "لە سیستەمی گواستنەوەدا، هەڵەیەکی بچووکی وەک کێشێکی هەڵە یان کڕیارێکی هەڵە، دواتر دەبێتە چارجی هەڵە و گەیاندنی هەڵە. هەرچی زووتر چاکی بکەیت، چاکردنەکەی ئاسانترە و کاریگەرییەکەی کەمترە. هەڵە بەجێ مەهێڵە بەهیوای ئەوەی دواتر چاک بێتەوە — یەکسەر چارەسەری بکە.",
      en: "In a shipping system, a small error like a wrong weight or wrong customer later turns into a wrong charge and a wrong delivery. The sooner you fix it, the easier the fix and the smaller its effect. Don't leave an error hoping it sorts itself out later — solve it at once.",
      ar: "في نظام الشحن، يتحوّل خطأ صغير كوزن خاطئ أو عميل خاطئ لاحقاً إلى تحصيل خاطئ وتسليم خاطئ. كلما صحّحته أسرع، كان التصحيح أسهل وأثره أقل. لا تترك الخطأ آملاً أن يُحَلّ لاحقاً — عالِجه فوراً.",
      zh: "在运输系统中，重量错误或客户错误这样的小失误日后会变成计费错误和交付错误。越早纠正，修正越容易、影响越小。别指望错误自行消失而搁置——立即解决。" },
    example: {
      ku: "تێبینی دەکەیت کێشی پاکەتی AZ001 بە هەڵە ٢kg تۆمار کراوە لەجیاتی ٥kg → یەکسەر چاکی بکە پێش ئەوەی بۆکس بنێردرێت.",
      en: "You notice AZ001's package weight was logged as 2 kg instead of 5 kg → fix it right away, before the box is sent.",
      ar: "تلاحظ أن وزن طرد AZ001 سُجّل 2 كغ بدل 5 كغ → صحّحه فوراً قبل إرسال الصندوق.",
      zh: "你发现 AZ001 的包裹重量被误录为 2 公斤而非 5 公斤 → 在箱子发出前立即纠正。" } },
  { id: "tip-32",
    short: {
      ku: "کێشی پاکەت بە دروستی بنووسە — نرخ ڕاستەوخۆ لەسەری دەردەچێت.",
      en: "Enter the package weight accurately — the price depends on it directly.",
      ar: "أدخِل وزن الطرد بدقّة — يعتمد السعر عليه مباشرةً.",
      zh: "准确录入包裹重量——价格直接取决于此。" },
    detail: {
      ku: "لە گواستنەوەدا، نرخ زۆرجار بەپێی کێش (دۆلار بۆ هەر کیلۆیەک) حساب دەکرێت. ئەگەر کێش کەمتر تۆمار بکەیت، کڕیار کەمتر چارج دەکرێت و قازانج لەدەست دەچێت؛ ئەگەر زیاتر بێت، کڕیار زۆر چارج دەکرێت و ناڕازی دەبێت. بۆیە کێش بە دروستی لە تەرازوو وەربگرە و داخڵی بکە.",
      en: "In shipping, the price is often calculated by weight (dollars per kilogram). If you log the weight too low, the customer is undercharged and profit is lost; too high, and the customer is overcharged and unhappy. So read the weight accurately from the scale and enter it.",
      ar: "في الشحن، يُحتسَب السعر غالباً حسب الوزن (دولار لكل كيلوغرام). إذا سجّلت الوزن أقل، يُحصَّل العميل أقل ويضيع الربح؛ وإذا أكثر، يُحصَّل أكثر فيستاء. لذا اقرأ الوزن بدقّة من الميزان وأدخِله.",
      zh: "运输中价格通常按重量计算（每公斤多少美元）。重量录得过低，会少收客户、损失利润；过高则多收客户、令其不满。所以请从秤上准确读取重量并录入。" },
    example: {
      ku: "نرخ $7/kgـە. پاکەتی AZ001 لەسەر تەرازوو ٣kgـە → داخڵی بکە؛ ئەگەر بە هەڵە ٢kg بنووسیت، کۆمپانیا $7 لەدەست دەدات.",
      en: "The rate is $7/kg. AZ001's package weighs 3 kg on the scale → enter 3 kg; if you mistype 2 kg, the company loses $7.",
      ar: "السعر 7$/كغ. طرد AZ001 يزن 3 كغ على الميزان → أدخِل 3 كغ؛ إذا كتبت 2 كغ خطأً، تخسر الشركة 7$.",
      zh: "费率为 7 美元/公斤。AZ001 的包裹在秤上重 3 公斤 → 录入 3 公斤；若误输 2 公斤，公司损失 7 美元。" } },
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
  { id: "tip-36",
    short: {
      ku: "یەک کارتۆن = یەک کرێی گواستنەوە، هەرچەند ئۆردەری لێبێت.",
      en: "One carton = one shipping fee, no matter how many orders it holds.",
      ar: "كرتونة واحدة = أجرة شحن واحدة، مهما بلغ عدد الطلبات فيها.",
      zh: "一个纸箱 = 一笔运费，无论里面有多少订单。" },
    detail: {
      ku: "کرێی گواستنەوە بەسەر کارتۆنی فیزیکیدا حساب دەکرێت (بەپێی کێش یان حەجم)، نەک بەسەر ژمارەی ئۆردەرەکاندا. واتە ئەگەر یەک کارتۆن چەند ئۆردەری تێدابێت، تەنها یەک کرێ بۆ کارتۆنەکە دادەنرێت. ئەمە لە دووبارە چارجکردنی هەڵە دەپارێزێت.",
      en: "The shipping fee is charged on the physical carton (by weight or volume), not on the number of orders. So if one carton holds several orders, only one fee is charged for that carton. This avoids charging twice by mistake.",
      ar: "تُحتسَب أجرة الشحن على الكرتونة الفيزيائية (بالوزن أو الحجم)، لا على عدد الطلبات. فإذا حوت كرتونة واحدة عدّة طلبات، تُحتسَب أجرة واحدة فقط لتلك الكرتونة. هذا يتجنّب التحصيل مرّتين بالخطأ.",
      zh: "运费按实物纸箱计算（按重量或体积），而非按订单数量。所以若一个纸箱装有多个订单，整箱只收一笔运费。这可避免误重复收费。" },
    example: {
      ku: "کارتۆنی AZ001 سێ ئۆردەری تێدایە و کێشی ٦kgـە بە $7/kg → کرێی گواستنەوە $42 بۆ تەواوی کارتۆنەکە، نەک ٣ جار.",
      en: "AZ001's carton holds three orders and weighs 6 kg at $7/kg → the shipping fee is $42 for the whole carton, not three times.",
      ar: "كرتونة AZ001 تحوي ثلاثة طلبات وتزن 6 كغ بسعر 7$/كغ → أجرة الشحن 42$ للكرتونة كاملة، لا ثلاث مرّات.",
      zh: "AZ001 的纸箱装有三个订单、重 6 公斤、每公斤 7 美元 → 整箱运费为 42 美元，而非收三次。" } },
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
  { id: "tip-38",
    short: {
      ku: "لە کردنەوەی بۆکس، خانەی سکان فۆکەسی لەسەر دەمێنێتەوە — بەردەوام سکان بکە بەبێ کلیک.",
      en: "When a box is open, the scan field keeps focus — keep scanning without clicking.",
      ar: "عند فتح الصندوق، يبقى حقل المسح نشطاً — تابِع المسح دون نقر.",
      zh: "箱子打开时，扫描框保持焦点——无需点击即可连续扫描。" },
    detail: {
      ku: "کاتێک بۆکس کراوەیە، خانەی سکان بەردەوام «فۆکەس»ـە، واتە ئامادەیە بۆ وەرگرتنی سکانی دواتر بەبێ ئەوەی کلیکی بکەیت. ئەمە وایدەکات پاکەتەکان پشتەوەپشت و بەخێرایی سکان بکەیت. تەنها ئامێری سکان بەکاربهێنە و فۆکەسەکە مەبڕە بە کلیککردنی شوێنی دیکە.",
      en: "When a box is open, the scan field stays \"focused\", meaning it's ready to receive the next scan without you clicking it. This lets you scan packages one after another, quickly. Just use the scanner and don't break the focus by clicking elsewhere.",
      ar: "عندما يكون الصندوق مفتوحاً، يبقى حقل المسح «نشطاً»، أي جاهزاً لاستقبال المسح التالي دون نقر. هذا يتيح لك مسح الطرود واحداً تلو الآخر بسرعة. استخدم الماسح فقط ولا تكسر التركيز بالنقر في مكان آخر.",
      zh: "箱子打开时，扫描框保持「焦点」，即无需点击便可接收下一次扫描。这让你快速地一个接一个扫描包裹。只需使用扫描枪，不要点击别处而打断焦点。" },
    example: {
      ku: "١٥ پاکەتت هەیە بۆ سکانکردن → یەک لەدوای یەک سکانیان بکە؛ پێویست ناکات نێوان هەر سکانێکدا کلیکی خانەکە بکەیت.",
      en: "You have 15 packages to scan → scan them one after another; you don't need to click the field between each scan.",
      ar: "لديك 15 طرداً لمسحها → امسَحها واحداً تلو الآخر؛ لا تحتاج للنقر على الحقل بين كل مسح.",
      zh: "你有 15 个包裹要扫描 → 一个接一个地扫；每次扫描之间无需点击扫描框。" } },
  { id: "tip-39",
    short: {
      ku: "پاکەتی نوێ بۆ باچ زیادبوو دوای دروستکردنی بۆکس؟ «نوێکردنەوەی بۆکس» بەکاربهێنە.",
      en: "New package added to the batch after the box was made? Use \"Refresh box\".",
      ar: "أُضيف طرد جديد للدفعة بعد إنشاء الصندوق؟ استخدم «تحديث الصندوق».",
      zh: "建箱后批次中又加入了新包裹？使用「刷新箱子」。" },
    detail: {
      ku: "بۆکس لیستی پاکەتەکانی باچ لە کاتی دروستکردنیدا دەگرێتە خۆی. ئەگەر دوای ئەوە پاکەتی نوێ بۆ باچ زیاد ببێت، بۆکس خۆکارانە نایبینێت — پێویستی بە «نوێکردنەوەی بۆکس» هەیە تاکو لیستەکە نوێ بکاتەوە. بەبێ ئەمە، پاکەتە نوێیەکان لە بۆکس بەجێدەمێننەوە.",
      en: "A box captures the batch's package list at the time it's created. If a new package is added to the batch afterwards, the box won't see it automatically — it needs \"Refresh box\" to update the list. Without this, the new packages are left out of the box.",
      ar: "يلتقط الصندوق قائمة طرود الدفعة وقت إنشائه. إذا أُضيف طرد جديد للدفعة بعد ذلك، لن يراه الصندوق تلقائياً — يحتاج «تحديث الصندوق» لتحديث القائمة. بدون ذلك تبقى الطرود الجديدة خارج الصندوق.",
      zh: "箱子在创建时捕获批次的包裹列表。若之后批次中又加入新包裹，箱子不会自动识别——需要「刷新箱子」来更新列表。否则新包裹会被遗漏在箱外。" },
    example: {
      ku: "بۆکست بۆ باچی ئاسمانی دروستکرد، پاشان پاکەتی AZ001 بۆ هەمان باچ زیاد بوو → «نوێکردنەوەی بۆکس» لێبدە تاکو پاکەتەکە دەربکەوێت.",
      en: "You made a box for the air batch, then AZ001's package was added to that batch → click \"Refresh box\" so the package appears.",
      ar: "أنشأت صندوقاً للدفعة الجوّية، ثم أُضيف طرد AZ001 لنفس الدفعة → انقر «تحديث الصندوق» ليظهر الطرد.",
      zh: "你为空运批次建了箱，之后 AZ001 的包裹被加入该批次 → 点击「刷新箱子」让该包裹显示。" } },
  { id: "tip-40",
    short: {
      ku: "بۆکسی خاڵی مەنێرە — سەرەتا پاکەت زیاد بکە.",
      en: "Don't send an empty box — add packages first.",
      ar: "لا تُرسل صندوقاً فارغاً — أضِف الطرود أولاً.",
      zh: "不要发送空箱——请先加入包裹。" },
    detail: {
      ku: "بۆکس بۆ گواستنەوەی پاکەتە؛ بۆکسی خاڵی هیچ مانایەکی نییە و تەنها لیستەکان و راپۆرتەکان تێکدەدات. پێش کرتەی «ناردن»، دڵنیابە لانیکەم یەک پاکەت سکانکراوە و لەناویدایە. ئەمە ڕێگری دەکات لە بۆکسی بەتاڵی بێ سوود لە سیستەمدا.",
      en: "A box exists to ship packages; an empty box is meaningless and only clutters lists and reports. Before clicking \"Send\", make sure at least one package has been scanned into it. This prevents useless empty boxes in the system.",
      ar: "الصندوق موجود لشحن الطرود؛ والصندوق الفارغ بلا معنى ويُفسِد القوائم والتقارير فقط. قبل النقر على «إرسال» تأكّد أن طرداً واحداً على الأقل مُسِح بداخله. هذا يمنع وجود صناديق فارغة عديمة الفائدة في النظام.",
      zh: "箱子是为运送包裹而存在的；空箱毫无意义，只会扰乱列表和报表。点击「发送」前，确认至少有一个包裹已扫描入箱。这能避免系统中出现无用的空箱。" },
    example: {
      ku: "بۆکست دروستکرد بەڵام هێشتا هیچ پاکەتێکت سکان نەکردووە → سەرەتا پاکەتی AZ001 سکان بکە، پاشان بینێرە.",
      en: "You created a box but haven't scanned any package yet → scan AZ001's package first, then send.",
      ar: "أنشأت صندوقاً لكنك لم تمسَح أي طرد بعد → امسَح طرد AZ001 أولاً، ثم أرسِل.",
      zh: "你建了箱却还没扫描任何包裹 → 先扫描 AZ001 的包裹，再发送。" } },
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
  { id: "tip-44",
    short: {
      ku: "پارەی پێشەکی دەگەڕێتەوە کاتێ ئۆردەر دەسڕیتەوە — بەڵام پێش سڕینەوە دڵنیابە.",
      en: "An advance payment is refunded when an order is deleted — but be sure before deleting.",
      ar: "تُسترَدّ الدفعة المقدّمة عند حذف الطلب — لكن تأكّد قبل الحذف.",
      zh: "删除订单时会退还预付款——但删除前请确认。" },
    detail: {
      ku: "ئەگەر ئۆردەرێک پارەی پێشەکیی هەبووبێت و بیسڕیتەوە، سیستەم ئەو پارەیە بۆ باڵانسی کڕیار دەگەڕێنێتەوە تاکو حساب ڕاست بمێنێتەوە. بەڵام ئەگەر بە هەڵە ئۆردەری چالاک بسڕیتەوە، پرۆسەی گواستنەوەش تێکدەچێت. بۆیە پێش سڕینەوە دڵنیابە کە دروست ئۆردەرە و سڕینەوەکە پێویستە.",
      en: "If an order had an advance payment and you delete it, the system returns that money to the customer's balance so the account stays correct. But if you delete an active order by mistake, the shipping flow is disrupted too. So before deleting, be sure it's the right order and the deletion is needed.",
      ar: "إذا كان للطلب دفعة مقدّمة وحذفته، يُعيد النظام ذلك المبلغ لرصيد العميل ليبقى الحساب صحيحاً. لكن إذا حذفت طلباً نشطاً بالخطأ، يتعطّل مسار الشحن أيضاً. لذا قبل الحذف تأكّد أنه الطلب الصحيح وأن الحذف ضروري.",
      zh: "若某订单有预付款而你删除它，系统会把这笔钱退回客户余额，以保持账目正确。但若误删活跃订单，运输流程也会被打乱。所以删除前请确认是正确的订单且确实需要删除。" },
    example: {
      ku: "ئۆردەری AZ001 پێشەکی $30ـی هەیە. ئەگەر بیسڕیتەوە، $30 دەگەڕێتەوە باڵانسی AZ001 → بەڵام دڵنیابە بەڕاستی دەتەوێت بیسڕیتەوە.",
      en: "AZ001's order has a $30 advance. If you delete it, $30 returns to AZ001's balance → but be sure you really mean to delete it.",
      ar: "طلب AZ001 له دفعة مقدّمة 30$. إذا حذفته، تعود 30$ لرصيد AZ001 → لكن تأكّد أنك تقصد حذفه فعلاً.",
      zh: "AZ001 的订单有 30 美元预付款。若删除它，30 美元退回 AZ001 的余额 → 但请确认你确实要删除。" } },
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
  { id: "tip-47",
    short: {
      ku: "نرخی ¥ (RMB) ڕۆژانە نوێ بکەرەوە — هەڵەی نرخ قازانج کەم دەکات.",
      en: "Update the ¥ (RMB) rate daily — a wrong rate eats into profit.",
      ar: "حدّث سعر اليوان (¥/RMB) يومياً — السعر الخاطئ يقلّل الربح.",
      zh: "每天更新人民币（¥）汇率——汇率错误会侵蚀利润。" },
    detail: {
      ku: "زۆربەی کاڵاکان لە چین بە یوان (¥) دەکڕدرێن، بەڵام لە عێراق بە دۆلار حساب دەکرێن، بۆیە نرخی گۆڕینەوە (¥ بۆ $) ڕاستەوخۆ کاریگەری لەسەر تێچوو هەیە. نرخی یوان ڕۆژانە دەگۆڕێت؛ ئەگەر نرخی کۆن بەکاربهێنیت، حسابی تێچوو هەڵە دەبێت و قازانج کەم دەبێتەوە. بۆیە هەموو ڕۆژێک نرخی نوێ تۆمار بکە.",
      en: "Most goods are bought in China in yuan (¥) but accounted for in Iraq in dollars, so the exchange rate (¥ to $) directly affects cost. The yuan rate changes daily; if you use an old rate, the cost calculation is wrong and profit shrinks. So enter the fresh rate every day.",
      ar: "تُشترى معظم البضائع في الصين باليوان (¥) لكن تُحتسَب في العراق بالدولار، فسعر الصرف (¥ إلى $) يؤثّر مباشرةً على التكلفة. سعر اليوان يتغيّر يومياً؛ إذا استخدمت سعراً قديماً، يصبح احتساب التكلفة خاطئاً ويقلّ الربح. لذا أدخِل السعر الجديد كل يوم.",
      zh: "大多数货物在中国以人民币（¥）采购，但在伊拉克以美元核算，因此汇率（人民币兑美元）直接影响成本。人民币汇率每日变动；若使用旧汇率，成本计算就会出错，利润随之减少。所以每天都要录入最新汇率。" },
    example: {
      ku: "ئەمڕۆ ١$ = ٧.٢¥. ئەگەر نرخی دوێنێ (٧.٠¥) بەکاربهێنیت بۆ کاڵای ٧٢٠¥، تێچوو بە هەڵە $102.86 حساب دەکرێت لەجیاتی $100.",
      en: "Today $1 = ¥7.2. If you use yesterday's rate (¥7.0) for a ¥720 item, the cost is wrongly computed as $102.86 instead of $100.",
      ar: "اليوم 1$ = 7.2¥. إذا استخدمت سعر الأمس (7.0¥) لسلعة بـ720¥، تُحتسَب التكلفة خطأً 102.86$ بدل 100$.",
      zh: "今天 1 美元 = 7.2 人民币。若对一件 720 人民币的商品使用昨天的汇率（7.0），成本会被错算为 102.86 美元，而非 100 美元。" } },
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
  { id: "tip-49",
    short: {
      ku: "هەموو گۆڕانکارییەک لە مێژووی ئۆردەردا تۆمار دەبێت — کێ، کەی، چی گۆڕی.",
      en: "Every change is recorded in the order's history — who, when, and what changed.",
      ar: "كل تغيير يُسجَّل في سجل الطلب — مَن ومتى وماذا تغيّر.",
      zh: "每次更改都会记入订单历史——谁、何时、改了什么。" },
    detail: {
      ku: "سیستەم بۆ هەر ئۆردەرێک مێژوویەک هەڵدەگرێت کە تێیدا هەموو گۆڕانکارییەک — کێ کردوویەتی، لە چ کاتێکدا و چی گۆڕاوە — تۆمار دەکات. ئەمە شەفافیەت دروست دەکات و یارمەتیدەرە بۆ دۆزینەوەی هۆکاری هەڵە یان ناکۆکی. بۆیە نیگەران مەبە لە تۆمارکردنی گۆڕانکاری دروست — مێژوو پاراستنی هەموانە.",
      en: "For each order the system keeps a history that records every change — who made it, when, and what changed. This creates transparency and helps trace the cause of an error or dispute. So don't worry about logging a legitimate change — the history protects everyone.",
      ar: "يحتفظ النظام لكل طلب بسجل يدوّن كل تغيير — من أجراه ومتى وماذا تغيّر. هذا يخلق شفافية ويساعد على تتبّع سبب خطأ أو نزاع. لذا لا تقلق من تسجيل تغيير مشروع — السجل يحمي الجميع.",
      zh: "系统为每个订单保留一份历史记录，记下每次更改——由谁、何时所做，改了什么。这带来透明度，并有助于追溯错误或纠纷的原因。所以不必担心记录正当的更改——历史记录保护每一个人。" },
    example: {
      ku: "ئۆردەری AZ001 نرخی گۆڕاوە. لە مێژوودا دەردەکەوێت: «ئاکام، ٢٠٢٦/٠٦/٣٠، نرخ لە $50 → $45».",
      en: "AZ001's order had its price changed. The history shows: \"Akam, 2026/06/30, price $50 → $45\".",
      ar: "طلب AZ001 تغيّر سعره. يُظهِر السجل: «أكام، 2026/06/30، السعر 50$ ← 45$».",
      zh: "AZ001 的订单价格被更改。历史记录显示：「阿卡姆，2026/06/30，价格 50 美元 → 45 美元」。" } },
  { id: "tip-50",
    short: {
      ku: "سڕینەوەی ئۆردەر «نەرمە» (دەگەڕێتەوە) — بەڵام هەر وردبە.",
      en: "Order deletion is \"soft\" (recoverable) — but stay careful anyway.",
      ar: "حذف الطلب «ناعم» (قابل للاسترجاع) — لكن ابقَ حذِراً مع ذلك.",
      zh: "订单删除是「软删除」（可恢复）——但仍请谨慎。" },
    detail: {
      ku: "سڕینەوەی «نەرم» واتە ئۆردەرەکە بەتەواوی لە داتابەیس نایسڕێتەوە، تەنها وەک سڕاو نیشانە دەکرێت و دەکرێت بگەڕێنرێتەوە. ئەمە تۆ دەپارێزێت لە سڕینەوەی هەڵە بەشێوەیەکی کۆتایی. لەگەڵ ئەوەشدا، با ئەمە وانەکات سادە مامەڵە لەگەڵ سڕینەوەدا بکەیت — هەر جارێک دڵنیابە.",
      en: "A \"soft\" deletion means the order isn't truly removed from the database — it's only marked as deleted and can be restored. This protects you from a final, irreversible mistaken deletion. Even so, don't let it make you careless about deleting — be sure each time.",
      ar: "الحذف «الناعم» يعني أن الطلب لا يُزال فعلياً من قاعدة البيانات — يُعلَّم فقط كمحذوف ويمكن استرجاعه. هذا يحميك من حذف خاطئ نهائي لا رجعة فيه. ومع ذلك لا تدع هذا يجعلك متهاوناً في الحذف — تأكّد في كل مرّة.",
      zh: "「软删除」意味着订单并未真正从数据库移除——只是标记为已删除，可以恢复。这能保护你免于一次不可逆的错误删除。即便如此，也别因此对删除掉以轻心——每次都要确认。" },
    example: {
      ku: "ئۆردەری AZ001ت بە هەڵە سڕیەوە → نیگەران مەبە، دەتوانیت بیگەڕێنیتەوە؛ بەڵام باشترە لە سەرەتاوە هەڵە نەکەیت.",
      en: "You deleted AZ001's order by mistake → don't panic, you can restore it; but it's better not to err in the first place.",
      ar: "حذفت طلب AZ001 بالخطأ → لا تقلق، يمكنك استرجاعه؛ لكن الأفضل ألّا تُخطئ من الأساس.",
      zh: "你误删了 AZ001 的订单 → 不必惊慌，可以恢复；但最好一开始就不出错。" } },
  { id: "tip-51",
    short: {
      ku: "دۆخی ئۆردەر بە دروستی نوێ بکەرەوە — کڕیار بەپێی دۆخ ئاگادار دەبێتەوە.",
      en: "Keep the order status up to date — the customer is notified based on it.",
      ar: "حدّث حالة الطلب باستمرار — يُخطَر العميل بناءً عليها.",
      zh: "及时更新订单状态——客户会据此收到通知。" },
    detail: {
      ku: "دۆخی ئۆردەر (وەک «گەیشتە کۆگا»، «لە ڕێگادایە»، «گەیەنرا») پیشانی دەدات ئۆردەرەکە لە چ قۆناغێکدایە، و کڕیار بەپێی ئەم دۆخە ئاگادار دەکرێتەوە. ئەگەر دۆخەکە نوێ نەکەیتەوە، کڕیار زانیاریی هەڵە وەردەگرێت یان هیچ ئاگادارییەک پێ ناگات. بۆیە هەر کاتێک قۆناغ گۆڕا، دۆخەکەش نوێ بکەرەوە.",
      en: "The order status (like \"arrived at warehouse\", \"in transit\", \"delivered\") shows which stage the order is in, and the customer is notified based on it. If you don't update the status, the customer gets wrong information or no alert at all. So whenever the stage changes, update the status too.",
      ar: "حالة الطلب (مثل «وصل المخزن»، «في الطريق»، «تم التسليم») تُظهِر المرحلة التي يمرّ بها الطلب، ويُخطَر العميل بناءً عليها. إذا لم تحدّث الحالة، يتلقّى العميل معلومات خاطئة أو لا يصله أي تنبيه. لذا كلما تغيّرت المرحلة، حدّث الحالة أيضاً.",
      zh: "订单状态（如「到达仓库」「运输途中」「已交付」）显示订单处于哪个阶段，客户据此收到通知。若不更新状态，客户会收到错误信息或根本收不到提醒。所以每当阶段变化，也要更新状态。" },
    example: {
      ku: "پاکەتی AZ001 گەیشتە کۆگای هەولێر → دۆخەکە بکە «گەیشتە کۆگا»؛ کڕیار یەکسەر پەیامی ئاگادارکردنەوە وەردەگرێت.",
      en: "AZ001's package arrives at the Erbil warehouse → set the status to \"arrived at warehouse\"; the customer immediately gets a notification.",
      ar: "يصل طرد AZ001 إلى مخزن أربيل → اضبط الحالة على «وصل المخزن»؛ يتلقّى العميل إشعاراً فوراً.",
      zh: "AZ001 的包裹到达埃尔比勒仓库 → 将状态设为「到达仓库」；客户立即收到通知。" } },
  { id: "tip-52",
    short: {
      ku: "بەشی «مەشاکل» لە داشبۆرد ڕۆژانە بپشکنە — بێ تراکینگ، قەرز، ئۆردەری گەورە.",
      en: "Check the dashboard's \"Problems\" section daily — no tracking, debt, large orders.",
      ar: "راجِع قسم «المشاكل» في لوحة التحكم يومياً — بدون تتبّع، ديون، طلبات كبيرة.",
      zh: "每天查看仪表板的「问题」区——无运单号、欠款、大额订单。" },
    detail: {
      ku: "بەشی «مەشاکل» هەموو ئەو شتانە لە یەک شوێندا کۆدەکاتەوە کە پێویستیان بە سەرنجی تۆیە — ئۆردەری بێ تراکینگ، کڕیاری قەرزدار، و ئۆردەری گەورە. پشکنینی ڕۆژانەی ئەم بەشە وایدەکات هیچ کێشەیەک بەبێ چارەسەری نەمێنێتەوە. وەک لیستی «کارەکانی ئەمڕۆ»ی تۆیە.",
      en: "The \"Problems\" section gathers in one place everything that needs your attention — orders with no tracking, debtor customers, and large orders. A daily check of this section keeps any issue from going unresolved. It's like your \"things to handle today\" list.",
      ar: "قسم «المشاكل» يجمع في مكان واحد كل ما يحتاج انتباهك — طلبات بلا تتبّع، عملاء مدينون، وطلبات كبيرة. مراجعة هذا القسم يومياً تمنع بقاء أي مشكلة دون حلّ. إنه أشبه بقائمة «مهام اليوم» لديك.",
      zh: "「问题」区把所有需要你关注的事项汇集到一处——无运单号的订单、欠款客户、大额订单。每天查看这一区，可避免任何问题被搁置。它就像你的「今日待办」清单。" },
    example: {
      ku: "بەیانی «مەشاکل» دەکەیتەوە و دەبینیت: ٣ ئۆردەری بێ تراکینگ، کڕیار AZ001 قەرزدار، و ١ ئۆردەری $1,300 → یەک بە یەک چارەسەریان بکە.",
      en: "In the morning you open \"Problems\" and see: 3 orders without tracking, customer AZ001 in debt, and 1 order of $1,300 → handle them one by one.",
      ar: "صباحاً تفتح «المشاكل» وترى: 3 طلبات بلا تتبّع، العميل AZ001 مدين، وطلب واحد بقيمة 1,300$ → عالِجها واحدة تلو الأخرى.",
      zh: "早上你打开「问题」区，看到：3 个无运单号的订单、客户 AZ001 欠款、1 个 1,300 美元的订单 → 逐一处理。" } },
  { id: "tip-53",
    short: {
      ku: "بەشی «سەرکەوتنەکانی ئەم هەفتەیە» — بزانە کام کڕیار ئاکتیفترینە و قازانجت چۆنە.",
      en: "Check \"Wins this week\" — see your most active customer and how profit is doing.",
      ar: "راجِع «إنجازات هذا الأسبوع» — لتعرف أنشط عميل وكيف يسير الربح.",
      zh: "查看「本周成绩」——了解最活跃的客户和利润情况。" },
    detail: {
      ku: "بەشی «سەرکەوتنەکانی ئەم هەفتەیە» کورتەیەکی ئەرێنی هەفتانە پیشان دەدات — کام کڕیار زۆرترین ئۆردەری کردووە و قازانج چۆن گەشە دەکات. ئەمە یارمەتیت دەدات کڕیارە بەنرخەکان بناسیت و خزمەتیان باشتر بکەیت. هەروەها وروژێنەرە بۆ بینینی ئەنجامی کارەکانت.",
      en: "The \"Wins this week\" section shows a positive weekly summary — which customer placed the most orders and how profit is growing. This helps you recognize your most valuable customers and serve them better. It's also motivating to see the results of your work.",
      ar: "قسم «إنجازات هذا الأسبوع» يعرض ملخّصاً أسبوعياً إيجابياً — أي عميل قدّم أكثر الطلبات وكيف ينمو الربح. هذا يساعدك على معرفة أثمن عملائك وخدمتهم أفضل. وهو أيضاً محفّز لرؤية نتائج عملك.",
      zh: "「本周成绩」区展示一份积极的周度总结——哪位客户下单最多、利润如何增长。这能帮你识别最有价值的客户并更好地服务他们。看到自己工作的成果也很激励人心。" },
    example: {
      ku: "ئەم هەفتە «سەرکەوتنەکان» پیشان دەدات: کڕیاری ئاکتیفترین AZ001 بە ٢٢ ئۆردەر، قازانجی هەفتە $1,840 → بزانە کام کڕیار گرنگترینە.",
      en: "This week \"Wins\" shows: most active customer AZ001 with 22 orders, weekly profit $1,840 → you see which customer matters most.",
      ar: "هذا الأسبوع تُظهِر «الإنجازات»: أنشط عميل AZ001 بـ22 طلباً، وربح الأسبوع 1,840$ → تعرف أي عميل هو الأهم.",
      zh: "本周「成绩」显示：最活跃客户 AZ001 共 22 个订单，周利润 1,840 美元 → 你能看出哪位客户最重要。" } },
  { id: "tip-54",
    short: {
      ku: "خێراییی باچەکان (چەند ڕۆژ گەیشتوون) بەراورد بکە.",
      en: "Compare batch speeds (days to arrive).",
      ar: "قارِن سرعة الدفعات (أيام الوصول).",
      zh: "比较各批次的速度（到货天数）。" },
    detail: {
      ku: "بەراوردکردنی ماوەی گەیشتنی باچەکان وایدەکات بزانیت کام لۆجیستیک پشتپێبەستراوترە و کام لای دواکەوتنی هەیە. ئەم زانیارییە بنەمای بڕیاری باشترە بۆ هەفتە و مانگەکانی داهاتوو. بەراوردێکی سادەی ژمارەی ڕۆژەکان پلانی گواستنەوەت باشتر دەکات.",
      en: "Comparing how long batches take to arrive shows you which logistics partner is more reliable and which tends to be late. This information is the basis of better decisions for the weeks and months ahead. A simple comparison of the day counts improves your shipping plan.",
      ar: "مقارنة مدّة وصول الدفعات تُظهِر لك أي شريك لوجستي أكثر موثوقية وأيّهم يميل للتأخّر. هذه المعلومة أساس قرارات أفضل للأسابيع والأشهر القادمة. مقارنة بسيطة لعدد الأيام تحسّن خطّة الشحن لديك.",
      zh: "比较各批次的到货时长，可看出哪家物流伙伴更可靠、哪家常常延误。这些信息是未来数周乃至数月作出更优决策的基础。简单比较天数即可改进你的运输计划。" },
    example: {
      ku: "ئەم مانگ سێ باچی دەریایی هەبووە: ٢٨ ڕۆژ، ٣٥ ڕۆژ، ٣٠ ڕۆژ → باچی ٣٥ ڕۆژ دواکەوتووە؛ هۆکارەکەی بپرسە.",
      en: "This month there were three sea batches: 28 days, 35 days, 30 days → the 35-day batch lagged; ask why.",
      ar: "هذا الشهر كانت هناك ثلاث دفعات بحرية: 28 يوماً، 35 يوماً، 30 يوماً → الدفعة ذات الـ35 يوماً تأخّرت؛ اسأل عن السبب.",
      zh: "本月有三个海运批次：28 天、35 天、30 天 → 35 天的批次落后了；查问原因。" } },
  { id: "tip-55",
    short: {
      ku: "کڕیارێک زۆر ئۆردەر دەکات؟ یەکجار هەڵیبژێرە و هەمووی پشتەوەپشت داخڵ بکە — فۆرم دوای سەیڤ دانەخراوە.",
      en: "Customer with many orders? Pick them once and enter all back-to-back — the form stays open after saving.",
      ar: "عميل لديه طلبات كثيرة؟ اختَره مرّة وأدخِلها كلها تباعاً — يبقى النموذج مفتوحاً بعد الحفظ.",
      zh: "客户订单很多？选定一次即可连续录入——保存后表单仍保持打开。" },
    detail: {
      ku: "کاتێک ئۆردەرێک پاشەکەوت دەکەیت، فۆرمەکە داناخرێت بەڵکو کراوە دەمێنێتەوە و کڕیارە هەڵبژێردراوەکە لەسەری دەمێنێتەوە. ئەمەت بۆ ئەوەیە بۆ کڕیارێک کە چەند ئۆردەری هەیە، تەنها یەکجار هەڵیبژێریت و هەمووی بەخێرایی پشتەوەپشت داخڵ بکەیت. ئەمە کات و کلیک دەپارێزێت.",
      en: "When you save an order, the form doesn't close — it stays open with the selected customer kept in place. This means that for a customer with several orders, you select them once and enter all of them quickly, back-to-back. It saves time and clicks.",
      ar: "عند حفظ طلب، لا يُغلَق النموذج بل يبقى مفتوحاً مع بقاء العميل المُختار في مكانه. هذا يعني أنه لعميل لديه عدّة طلبات، تختاره مرّة واحدة وتُدخِلها كلها بسرعة تباعاً. هذا يوفّر الوقت والنقرات.",
      zh: "保存订单时，表单不会关闭，而是保持打开，所选客户仍然保留。这意味着对于有多个订单的客户，你只需选定一次，便可快速连续录入全部。既省时间又省点击。" },
    example: {
      ku: "کڕیار AZ001 ٥ ئۆردەری هەیە → یەکجار AZ001 هەڵبژێرە، ئۆردەری یەکەم سەیڤ بکە، فۆرم کراوە دەمێنێتەوە، چوارەکەی دیکەش بەخێرایی داخڵ بکە.",
      en: "Customer AZ001 has 5 orders → select AZ001 once, save the first order, the form stays open, and enter the other four quickly.",
      ar: "العميل AZ001 لديه 5 طلبات → اختَر AZ001 مرّة، احفظ الطلب الأول، يبقى النموذج مفتوحاً، وأدخِل الأربعة الأخرى بسرعة.",
      zh: "客户 AZ001 有 5 个订单 → 选定 AZ001 一次，保存第一个订单，表单保持打开，再快速录入其余四个。" } },
  { id: "tip-56",
    short: {
      ku: "وێنەی کاڵای لەبیرکراو دەکرێت دواتر لە ئیدیتدا زیاد بکرێت.",
      en: "A forgotten product photo can be added later in edit mode.",
      ar: "يمكن إضافة صورة المنتج المنسيّة لاحقاً في وضع التعديل.",
      zh: "忘记添加的商品照片可稍后在编辑中补充。" },
    detail: {
      ku: "ئەگەر لە کاتی تۆمارکردندا وێنەی کاڵات لەبیر کرد، پێویست ناکات نیگەران بیت — دەتوانیت دواتر ئۆردەرەکە بکەیتەوە لە دۆخی «ئیدیت» و وێنەکە زیاد بکەیت. لەگەڵ ئەوەشدا، باشترە لە سەرەتاوە وێنە زیاد بکەیت تاکو ناسینەوەی پاکەت ئاسانتر بێت. ئەم ئیمکانە تۆ لە دووبارە تۆمارکردن دەپارێزێت.",
      en: "If you forgot the product photo while registering, don't worry — you can later open the order in \"edit\" mode and add the photo. Even so, it's better to add it from the start so the package is easier to identify. This option saves you from re-registering.",
      ar: "إذا نسيت صورة المنتج أثناء التسجيل، فلا تقلق — يمكنك لاحقاً فتح الطلب في وضع «التعديل» وإضافة الصورة. ومع ذلك، الأفضل إضافتها من البداية ليسهل التعرّف على الطرد. هذا الخيار يجنّبك إعادة التسجيل.",
      zh: "如果登记时忘了商品照片，不必担心——稍后可在「编辑」模式打开订单并补充照片。即便如此，最好一开始就添加，以便更容易识别包裹。这个功能让你免于重新登记。" },
    example: {
      ku: "ئۆردەری AZ001ت بێ وێنە تۆمارکرد → دواتر بیکەرەوە لە ئیدیت، وێنەی کاڵاکە بەرز بکەرەوە و سەیڤی بکە.",
      en: "You registered AZ001's order without a photo → later open it in edit, upload the product photo, and save.",
      ar: "سجّلت طلب AZ001 بلا صورة → افتحه لاحقاً في التعديل، ارفع صورة المنتج، واحفظ.",
      zh: "你登记 AZ001 的订单时没加照片 → 稍后在编辑中打开，上传商品照片并保存。" } },
  { id: "tip-57",
    short: {
      ku: "تراکینگ نەمبەری هەڵە = نەدۆزینەوەی پاکەت — بە وردی داخڵی بکە.",
      en: "A wrong tracking number = a package that can't be found — enter it carefully.",
      ar: "رقم تتبّع خاطئ = طرد لا يُعثَر عليه — أدخِله بدقّة.",
      zh: "运单号错误 = 找不到包裹——请仔细录入。" },
    detail: {
      ku: "تراکینگ نەمبەر تاکە ڕێگایە بۆ ناسینەوە و دۆزینەوەی پاکەت لە کاتی سکانکردن و گەیاندندا. ئەگەر تەنها یەک پیت یان ژمارەی هەڵە بێت، سیستەم پاکەتەکە ناناسێتەوە و وەک بێخاوەن دەمێنێتەوە. بۆیە بە وردی داخڵی بکە، یان باشتر، بە ئامێری سکان یان کۆپی بیخەرە ناوەوە.",
      en: "The tracking number is the only way to identify and find a package when scanning and delivering. If even one letter or digit is wrong, the system won't recognize the package and it stays as unclaimed. So enter it carefully, or better, put it in with a scanner or by copy-paste.",
      ar: "رقم التتبّع هو الطريقة الوحيدة للتعرّف على الطرد وإيجاده عند المسح والتسليم. إذا كان حرف أو رقم واحد خاطئاً، لن يتعرّف النظام على الطرد ويبقى بلا صاحب. لذا أدخِله بدقّة، أو الأفضل أدخِله بالماسح أو بالنسخ واللصق.",
      zh: "运单号是扫描和交付时识别、查找包裹的唯一途径。哪怕错了一个字母或数字，系统都无法识别该包裹，它会一直处于无主状态。所以请仔细录入，或更好的方式是用扫描枪或复制粘贴录入。" },
    example: {
      ku: "تراکینگی ڕاست YT7612345678ـە بەڵام YT7612345670 داخڵ دەکەیت → پاکەتەکە لە سکاندا نادۆزرێتەوە و بێخاوەن دەمێنێتەوە.",
      en: "The correct tracking is YT7612345678 but you enter YT7612345670 → the package won't be found on scan and stays unclaimed.",
      ar: "رقم التتبّع الصحيح YT7612345678 لكنك تُدخِل YT7612345670 → لن يُعثَر على الطرد عند المسح ويبقى بلا صاحب.",
      zh: "正确运单号是 YT7612345678，但你录入 YT7612345670 → 扫描时找不到该包裹，它会一直无主。" } },
  { id: "tip-58",
    short: {
      ku: "پێش پاشەکەوتکردنی فۆرم، خانە پێویستەکان (بەستەرە سوورەکان *) پڕبکەرەوە.",
      en: "Before saving a form, fill the required fields (marked with a red *).",
      ar: "قبل حفظ النموذج، املأ الحقول المطلوبة (المعلّمة بنجمة حمراء *).",
      zh: "保存表单前，请填写必填字段（带红色 * 标记）。" },
    detail: {
      ku: "خانە پێویستەکان بە ئەستێرەی سوور (*) نیشانە کراون، چونکە سیستەم بەبێ ئەوان ناتوانێت بە دروستی کار بکات. ئەگەر بەتاڵیان بهێڵیتەوە، فۆرم پاشەکەوت نابێت و پەیامی هەڵە دەردەکەوێت. بۆیە پێش کرتەی «سەیڤ»، دڵنیابە هەموو خانە ئەستێرەدارەکان پڕکراونەتەوە.",
      en: "Required fields are marked with a red asterisk (*) because the system can't work correctly without them. If you leave them blank, the form won't save and an error message appears. So before clicking \"Save\", make sure every starred field is filled in.",
      ar: "الحقول المطلوبة معلّمة بنجمة حمراء (*) لأن النظام لا يعمل بشكل صحيح دونها. إذا تركتها فارغة، لن يُحفَظ النموذج وتظهر رسالة خطأ. لذا قبل النقر على «حفظ» تأكّد أن كل حقل بنجمة قد مُلئ.",
      zh: "必填字段以红色星号（*）标记，因为没有它们系统无法正常工作。若留空，表单将无法保存并显示错误提示。所以点击「保存」前，确认每个带星号的字段都已填写。" },
    example: {
      ku: "لە فۆرمی ئۆردەری نوێدا، «کڕیار *» و «جۆری کاڵا *» بەتاڵن → پڕیان بکەرەوە؛ ئەگەر نا، سەیڤ ناکات و ئاگادارت دەکاتەوە.",
      en: "On the new-order form, \"Customer *\" and \"Product type *\" are empty → fill them; otherwise it won't save and warns you.",
      ar: "في نموذج الطلب الجديد، «العميل *» و«نوع المنتج *» فارغان → املأهما؛ وإلّا لن يُحفَظ ويُنبّهك.",
      zh: "在新订单表单中，「客户 *」和「商品类型 *」为空 → 请填写；否则无法保存并会提示你。" } },
  { id: "tip-59",
    short: {
      ku: "کاتێک موشتەری داوای بابەتێکی نوێ دەکات کە زانیاریمان لەسەری نییە، پێش وەڵامدانەوە چێکی بکەرەوە کە دێت یان نا.",
      en: "When a customer asks about an item we have no information on, check whether it can ship before you answer.",
      ar: "عندما يسأل العميل عن صنف لا معلومات لدينا عنه، تحقّق من إمكانية شحنه قبل أن تجيب.",
      zh: "当客户询问我们没有资料的物品时，先确认能否运输再回复。" },
    detail: {
      ku: "وەڵامێکی خێرا بەبێ دڵنیایی زیانی زۆرترە لە وەڵامێکی دواکەوتوو. ئەگەر بڵێیت «دێت» و پاشان دەرکەوێت قەدەغەیە، موشتەری کاڵاکەی کڕیوە و پارەی خەرج کردووە — کێشەکە دەکەوێتە ئەستۆی ئێمە. سەرەتا لە لیستی کاڵا قەدەغەکان و لەگەڵ بەڕێوەبەر چێک بکەرەوە، پاشان وەڵام بدەرەوە.",
      en: "A fast answer given without certainty costs more than a slow one. If you say it ships and it later turns out to be prohibited, the customer has already bought and paid — and the problem lands on us. Check the prohibited list and with a manager first, then answer.",
      ar: "الإجابة السريعة بلا يقين أكلف من إجابة متأخرة. إذا قلت إنه يُشحن ثم تبيّن أنه ممنوع، يكون العميل قد اشترى ودفع — وتقع المشكلة علينا. تحقّق أولاً من قائمة الممنوعات ومع المدير، ثم أجب.",
      zh: "没有把握的快速答复，代价比迟一点的答复更大。若你说可以运而后发现属违禁品，客户已经下单付款，问题就落到我们头上。先查违禁清单并与主管确认，再回复。" },
    example: {
      ku: "موشتەری دەپرسێت «باتری لاپتۆپ دێت؟» → یەکسەر مەڵێ بەڵێ؛ سەرەتا چێک بکەوە، پاشان وەڵامی بدەرەوە.",
      en: "A customer asks about shipping a laptop battery → don't say yes right away; check first, then answer.",
      ar: "يسأل العميل عن شحن بطارية لابتوب → لا تقل نعم فوراً؛ تحقّق أولاً ثم أجب.",
      zh: "客户问笔记本电池能否运输 → 不要立刻答应；先核实，再回复。" } },
  { id: "tip-60",
    short: {
      ku: "لەگەڵ موشتەری نرخ مەبڕەوە — بە تایبەتی لە دەریایی، لەبەر گۆڕانی نرخ و دواکەوتن.",
      en: "Don't commit to a fixed price with the customer — especially for sea freight, where rates and timing shift.",
      ar: "لا تقطع سعراً نهائياً مع العميل — خاصة في الشحن البحري، حيث تتغيّر الأسعار والمواعيد.",
      zh: "不要与客户敲定固定价格——尤其是海运，费率和时效都会变动。" },
    detail: {
      ku: "نرخی دەریایی و کاتی گەیشتن بە هۆی جەنگ، قەیرانی کەشتی، و گۆڕانی نرخی سووتەمەنی هەڵدەسێت و دادەکشێت. ئەگەر نرخێکی جێگیر بە موشتەری بڵێیت و پاشان بگۆڕێت، یان ئێمە زەرەر دەکەین یان موشتەری بێمتمانە دەبێت. هەمیشە بڵێ نرخی ئێستا ئەمەیە بەڵام دەگۆڕێت.",
      en: "Sea rates and transit times swing with war, shipping crises and fuel prices. If you quote a fixed price and it then changes, either we take the loss or the customer loses trust. Always say this is today's rate but it can change.",
      ar: "أسعار البحر ومدد العبور تتقلّب بسبب الحرب وأزمات الشحن وأسعار الوقود. إذا قدّمت سعراً ثابتاً ثم تغيّر، فإمّا نتحمّل الخسارة أو يفقد العميل ثقته. قل دائماً إن هذا سعر اليوم وقد يتغيّر.",
      zh: "海运费率和时效会因战争、航运危机和燃油价格而波动。若你报了固定价而后变动，不是我们亏损，就是客户失去信任。请始终说明这是今天的价格，可能会变。" },
    example: {
      ku: "موشتەری دەڵێت «دەریایی چەندە؟» → بڵێ ئێستا نزیکەی ئەم بڕەیە بۆ هەر CBM، بەڵام تا کاتی ناردن دەگۆڕێت.",
      en: "Customer asks the sea-freight price → say it's about this much per CBM today, but it can change by shipping time.",
      ar: "يسأل العميل عن سعر الشحن البحري → قل إنه نحو هذا المبلغ لكل CBM اليوم، لكنه قد يتغيّر حتى موعد الشحن.",
      zh: "客户询问海运价格 → 回答今天每 CBM 大约这个价，但到发货时可能变化。" } },
  { id: "tip-61",
    short: {
      ku: "موشتەری فێری ئەوە مەکە کە بەبێ پارەی پێشەکی بۆی دەکڕدرێت — پێشەکی سیستەمە و دەبێت بدرێت.",
      en: "Don't teach customers that we'll buy without a deposit — the advance is policy and must be paid.",
      ar: "لا تعوّد العميل على الشراء بلا دفعة مقدمة — الدفعة سياسة النظام ويجب دفعها.",
      zh: "不要让客户以为不付订金也能代购——预付款是制度，必须支付。" },
    detail: {
      ku: "پارەی پێشەکی ئێمە دەپارێزێت لەوەی کاڵا بکڕین و پاشان موشتەری پاشگەز بێتەوە. ئەگەر جارێک بەبێ پێشەکی بۆ کەسێک بکڕیت، جاری داهاتوو چاوەڕوانی هەمان شت دەکات و ڕەتکردنەوەی قورس دەبێت. یەک ئیستیسنا دەبێتە ڕێسا — بۆیە لە یەکەم جارەوە ڕوون بە.",
      en: "The deposit protects us from buying goods a customer then walks away from. If you buy once without it, they'll expect the same next time and refusing becomes hard. One exception becomes the rule — so be clear from the first time.",
      ar: "الدفعة المقدمة تحمينا من شراء بضاعة يتراجع عنها العميل لاحقاً. إذا اشتريت مرة بدونها، سيتوقّع المثل في المرة القادمة ويصعب الرفض. الاستثناء الواحد يصير قاعدة — فكن واضحاً من أول مرة.",
      zh: "订金能防止我们买了货客户又反悔。若你破例一次，下次他就会期待同样待遇，届时很难拒绝。一次例外会变成惯例——所以第一次就要讲清楚。" },
    example: {
      ku: "موشتەری دەڵێت «ئەم جارە بەبێ پێشەکی بۆم بکڕە» → بە ڕێزەوە بڵێ پێشەکی مەرجی سیستەمە بۆ هەموو کەس.",
      en: "Customer asks you to buy without a deposit just this once → politely say the advance is required for everyone.",
      ar: "يطلب العميل الشراء بلا دفعة هذه المرة فقط → قل بلطف إن الدفعة مطلوبة من الجميع.",
      zh: "客户请求这次先不收订金 → 礼貌说明预付款对所有人都是必需的。" } },
  { id: "tip-62",
    short: {
      ku: "فوول پاکێج و کڕین بە تێچوو بۆ ئەدرێسی ئاکۆ بنێرە.",
      en: "Send full-package and commission orders to Ako's address.",
      ar: "أرسِل طلبات الحزمة الكاملة والشراء بالعمولة إلى عنوان «أكو».",
      zh: "全包和代购订单请寄送至 Ako 的地址。" },
    detail: {
      ku: "هەر جۆرە ئۆردەرێک ئەدرێسی وەرگرتنی دیاریکراوی خۆی هەیە لە چین. ئەگەر فوول پاکێج یان کڕین بە تێچوو بۆ ئەدرێسێکی تر بنێردرێت، لە کۆگا لێک جیا ناکرێنەوە و لە کاتی وەرگرتندا تێکەڵ دەبن — ئەوەش دواکەوتن و ون بوونی پاکەت دروست دەکات.",
      en: "Each order type has its own receiving address in China. If a full-package or commission order goes to a different address, it can't be told apart at the warehouse and gets mixed in on arrival — which causes delays and lost packages.",
      ar: "لكل نوع طلب عنوان استلام خاص في الصين. إذا أُرسل طلب حزمة كاملة أو عمولة إلى عنوان آخر، لا يمكن تمييزه في المستودع ويختلط عند الاستلام — ما يسبّب التأخير وضياع الطرود.",
      zh: "每种订单类型在中国都有专属收货地址。若全包或代购订单寄到别的地址，仓库无法区分，到货时会混在一起——导致延误和包裹丢失。" },
    example: {
      ku: "ئۆردەری فوول پاکێج تۆمار دەکەیت → لە کاتی کڕین ئەدرێسی ئاکۆ بەکاربهێنە، نەک ئەدرێسی گشتی.",
      en: "You register a full-package order → use Ako's address at purchase time, not the general address.",
      ar: "تسجّل طلب حزمة كاملة → استخدم عنوان «أكو» عند الشراء، لا العنوان العام.",
      zh: "登记全包订单时 → 下单请使用 Ako 的地址，而非通用地址。" } },
  { id: "tip-63",
    short: {
      ku: "باشترین شێواز ئەوەیە ئۆردەر هەر لەگەڵ کڕین داخڵی سیستەم بکرێت، نەک کەڵەکە بێت.",
      en: "The best habit is entering an order into the system as you buy it, not letting them pile up.",
      ar: "أفضل عادة هي إدخال الطلب في النظام لحظة الشراء، لا تركه يتراكم.",
      zh: "最好的习惯是下单时即录入系统，不要堆积。" },
    detail: {
      ku: "ئەگەر چەند ئۆردەرێک کەڵەکە بن و پاشان پێکەوە داخڵ بکرێن، وردەکارییەکان تێکەڵ دەبن: کام تراکینگ بۆ کام موشتەرییە، کام نرخ بۆ کام کاڵایە. تۆمارکردن لە هەمان ساتی کڕیندا هەموو زانیارییەکە تازەیە و هەڵە ڕوو نادات.",
      en: "If several orders pile up and get entered together, the details blur: which tracking belongs to which customer, which price to which item. Logging at the moment of purchase keeps every detail fresh and error-free.",
      ar: "إذا تراكمت عدة طلبات ثم أُدخلت دفعة واحدة، تختلط التفاصيل: أي تتبّع لأي عميل، وأي سعر لأي صنف. التسجيل لحظة الشراء يُبقي كل التفاصيل طازجة وبلا أخطاء.",
      zh: "若多个订单堆积后一起录入，细节会混淆：哪个运单属于哪位客户、哪个价格对应哪件商品。购买当下即录入，信息新鲜且不易出错。" },
    example: {
      ku: "پێنج ئۆردەر بۆ پێنج موشتەر دەکڕیت → دوای هەر کڕینێک یەکسەر تۆماری بکە، نەک هەموویان لە کۆتایی ڕۆژدا.",
      en: "You buy five orders for five customers → log each one right after buying, not all at the end of the day.",
      ar: "تشتري خمسة طلبات لخمسة عملاء → سجّل كل واحد فور شرائه، لا كلها في آخر اليوم.",
      zh: "你为五位客户下了五单 → 每单买完立即录入，而不是当天结束时一起录。" } },
  { id: "tip-64",
    short: {
      ku: "ڕۆژانە هەموو پرس و کار و کێشەکان لەلای خۆت بنووسە بۆ ئەوەی لەبیریان نەکەیت.",
      en: "Write down every question, task and problem each day so nothing is forgotten.",
      ar: "دوّن كل سؤال ومهمة ومشكلة يومياً كي لا تُنسى.",
      zh: "每天记录所有问题、任务和事项，以免遗忘。" },
    detail: {
      ku: "لە ڕۆژێکی قەرەباڵغدا دەیان شت ڕوودەدەن و مێشک ناتوانێت هەمووی بپارێزێت. ئەو کێشەیەی ئەمڕۆ لەبیرت دەچێت، سبەینێ دەبێتە گلەیی موشتەری. نووسینەکە دوو خولەک دەخایەنێت و کێشەیەکی گەورەت لێ دەبڕێت.",
      en: "On a busy day dozens of things happen and memory can't hold them all. The issue you forget today becomes a customer complaint tomorrow. Writing it down takes two minutes and saves you a much bigger problem.",
      ar: "في يوم مزدحم تحدث عشرات الأمور ولا تستطيع الذاكرة حفظها كلها. المشكلة التي تنساها اليوم تصبح شكوى عميل غداً. التدوين يستغرق دقيقتين ويوفّر عليك مشكلة أكبر بكثير.",
      zh: "忙碌的一天会发生几十件事，记忆无法全部留住。你今天忘掉的问题，明天就会变成客户投诉。写下来只需两分钟，却能省去大麻烦。" },
    example: {
      ku: "موشتەرییەک دەڵێت «پاکەتەکەم نەگەیشتووە» → یەکسەر بینووسە لەگەڵ کۆدەکەی، نەک پشت بە بیرەوەری ببەستە.",
      en: "A customer reports a package hasn't arrived → note it with their code immediately, don't rely on memory.",
      ar: "يبلّغ عميل أن طرده لم يصل → دوّنها فوراً مع رمزه، ولا تعتمد على الذاكرة.",
      zh: "客户反映包裹未送达 → 立即连同其客户编号记下，不要依赖记忆。" } },
  { id: "tip-65",
    short: {
      ku: "موشتەری ڕابهێنە کە بەردەوام سەردانی پۆرتاڵی خۆی بکات و پرسیارەکانی لەوێ ئاراستە بکات.",
      en: "Train customers to check their own portal regularly and ask their questions there.",
      ar: "عوّد العميل على زيارة بوابته باستمرار وطرح أسئلته هناك.",
      zh: "引导客户经常查看自己的门户，并在那里提问。" },
    detail: {
      ku: "پۆرتاڵ هەموو زانیارییەکی — دۆخی پاکەت، باڵانس، و پسووڵەکان — بە شێوەی زیندوو پیشان دەدات. ئەگەر موشتەری فێری ئەوە بێت، بارگرانی پرسیارە دووبارەکان لەسەر کارمەندان کەم دەبێتەوە و موشتەریش خێراتر وەڵام وەردەگرێت.",
      en: "The portal shows everything live — package status, balance and invoices. Once customers get used to it, the load of repeated questions on staff drops and the customer gets answers faster.",
      ar: "تعرض البوابة كل شيء مباشرة — حالة الطرد والرصيد والفواتير. متى اعتاد العملاء عليها، خفّ عبء الأسئلة المتكرّرة عن الموظفين وحصل العميل على إجابته أسرع.",
      zh: "门户实时显示一切——包裹状态、余额和发票。客户一旦养成习惯，员工重复答疑的负担就会减少，客户也能更快得到答案。" },
    example: {
      ku: "موشتەری دەپرسێت «پاکەتەکەم لە کوێیە؟» → وەڵامی بدەرەوە و بڵێ لە پۆرتاڵەکەت هەموو کاتێک دەیبینیت.",
      en: "Customer asks where their package is → answer, then add that they can see this any time in their portal.",
      ar: "يسأل العميل عن مكان طرده → أجبه ثم أضف أنه يمكنه رؤية ذلك في بوابته في أي وقت.",
      zh: "客户询问包裹位置 → 回答后补充：随时可在自己的门户查看。" } },
  { id: "tip-66",
    short: {
      ku: "بەریدەکانی ناوخۆ لەگەڵ کۆمپانیاکانی ناوخۆ چێک بکەرەوە و لە گەیشتن و نەگەیشتنیان ئاگادار بە.",
      en: "Follow up local deliveries with the local companies and stay on top of what did and didn't arrive.",
      ar: "تابِع التوصيل المحلي مع الشركات المحلية وابقَ على اطلاع بما وصل وما لم يصل.",
      zh: "与本地公司跟进本地配送，随时掌握哪些已送达、哪些未送达。" },
    detail: {
      ku: "دوای ئەوەی پاکەت دەدەینە کۆمپانیای ناوخۆ، بەرپرسیارێتی ئێمە کۆتایی نایەت — موشتەری هێشتا لە ئێمە دەپرسێت. ئەگەر چێک نەکەیتەوە، دواکەوتن یان ون بوون دەرناکەوێت تا موشتەری گلەیی بکات. چالاکانە بەدوایاندا بگەڕێ و کێشەکان زوو چارەسەر بکە.",
      en: "Once a package goes to a local company, our responsibility doesn't end — the customer still asks us. If you don't follow up, a delay or loss only surfaces when the customer complains. Chase them actively and resolve issues early.",
      ar: "بعد تسليم الطرد لشركة محلية لا تنتهي مسؤوليتنا — العميل ما زال يسألنا. إن لم تتابع، لن يظهر التأخير أو الضياع إلا حين يشتكي العميل. تابِعهم بفاعلية وحلّ المشكلات مبكراً.",
      zh: "包裹交给本地公司后，我们的责任并未结束——客户仍会问我们。若不跟进，延误或丢失只会在客户投诉时才暴露。请主动跟进，尽早解决。" },
    example: {
      ku: "پێنج پاکەت بۆ سلێمانی نێردراون → دوای ڕۆژێک لە کۆمپانیاکە بپرسە کامەیان گەیشتووە.",
      en: "Five packages went to Sulaymaniyah → ask the company a day later which ones were delivered.",
      ar: "أُرسلت خمسة طرود إلى السليمانية → اسأل الشركة بعد يوم أيّها سُلّم.",
      zh: "五个包裹发往苏莱曼尼亚 → 一天后询问该公司哪些已送达。" } },
  { id: "tip-67",
    short: {
      ku: "هەمیشە بە موشتەری بڵێ کێش و CBM دوای گەیشتن بە مەخزەنی ئێمە دیاری دەکرێت.",
      en: "Always tell the customer that weight and CBM are set once the goods reach our warehouse.",
      ar: "أخبر العميل دائماً أن الوزن و CBM يُحدَّدان بعد وصول البضاعة إلى مستودعنا.",
      zh: "务必告知客户，重量和 CBM 需货到我们仓库后才能确定。" },
    detail: {
      ku: "کێش و قەبارەی ڕاستەقینە تەنها دوای پێواندن لە کۆگا دیاری دەبێت — ئەوەی فرۆشیار دەیڵێت زۆرجار جیاوازە. ئەگەر پێشوەخت ژمارەیەکی جێگیر بە موشتەری بڵێیت، دواتر کە نرخەکە دەگۆڕێت بە هەڵەی ئێمەی دەزانێت. لە سەرەتاوە ڕوونی بکەوە.",
      en: "The real weight and volume are only known after measuring at the warehouse — what the seller states is often different. If you give the customer a firm figure up front, they'll see the later change as our mistake. Make it clear from the start.",
      ar: "الوزن والحجم الحقيقيان لا يُعرفان إلا بعد القياس في المستودع — وما يذكره البائع يختلف غالباً. إذا أعطيت العميل رقماً نهائياً مسبقاً، سيعتبر التغيير لاحقاً خطأً منّا. وضّح ذلك من البداية.",
      zh: "真实重量和体积只有在仓库测量后才能确定——卖家所述常有出入。若你事先给出确定数字，客户会把日后的变动视为我们的失误。请从一开始就说明。" },
    example: {
      ku: "موشتەری دەڵێت فرۆشیار گوتی پێنج کیلۆیە → بڵێ دوای گەیشتن بۆ کۆگا پێوانەی دەکەین و ئەوکات نرخی کۆتایی دیار دەبێت.",
      en: "Customer says the seller quoted five kilos → reply that we weigh it at the warehouse and the final price is set then.",
      ar: "يقول العميل إن البائع ذكر خمسة كيلوغرامات → أجب أننا نزنه في المستودع وحينها يتحدّد السعر النهائي.",
      zh: "客户说卖家称是五公斤 → 回答我们会在仓库称重，届时才确定最终价格。" } },
  { id: "tip-68",
    short: {
      ku: "بۆ ئۆردەری زۆر و گەورە، پێش کڕین و ناردن ئاگاداری ئێمە بکەرەوە.",
      en: "For large or bulk orders, tell us before buying and shipping.",
      ar: "للطلبات الكبيرة أو بالجملة، أبلِغنا قبل الشراء والشحن.",
      zh: "大宗或大额订单，请在采购和发货前先通知我们。" },
    detail: {
      ku: "ئۆردەری گەورە پێویستی بە ئامادەکاری هەیە: شوێن لە کۆگا، ڕێککەوتن لەسەر نرخ، و دڵنیابوون لەوەی لە باچی داهاتوودا جێی دەبێتەوە. ئەگەر بەبێ ئاگادارکردنەوە بێت، لەوانەیە دوابخرێت یان نرخێکی چاوەڕوان‌نەکراوی لەسەر بێت. ئاگادارکردنەوەی پێشوەخت هەردوولا دەپارێزێت.",
      en: "A large order needs preparation: warehouse space, an agreed rate, and confirmation it fits the next batch. Arriving unannounced, it may be delayed or carry an unexpected cost. Advance notice protects both sides.",
      ar: "الطلب الكبير يحتاج تحضيراً: مساحة في المستودع، واتفاقاً على السعر، وتأكيداً أنه يناسب الدفعة القادمة. إذا وصل دون إشعار، قد يتأخّر أو تترتّب عليه كلفة غير متوقّعة. الإشعار المسبق يحمي الطرفين.",
      zh: "大额订单需要准备：仓储空间、议定费率，以及确认能否装入下一批次。若不打招呼就到货，可能延误或产生意外费用。提前告知对双方都有保障。" },
    example: {
      ku: "موشتەری دەیەوێت دوو سەد دانە کاڵا بکڕێت → پێش کڕین پێمان بڵێ تاوەکو ئامادەکاری بکەین.",
      en: "A customer wants to buy two hundred units → tell us before the purchase so we can prepare.",
      ar: "يريد عميل شراء مئتي قطعة → أبلِغنا قبل الشراء لنستعد.",
      zh: "客户想买两百件 → 请在采购前告知我们以便安排。" } },
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
