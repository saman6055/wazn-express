// Wazn Express — the customer portal guide ("فهرست"): every portal section
// explained in all four UI languages with a plain-words description, what you
// can do there, and a real-life example simple enough for anyone.
// Rendered by client/src/pages/portal/PortalGuide.tsx. Each section has a
// stable `id` used as a URL anchor (/portal/guide#shipments) so other pages
// can deep-link straight to its explanation.
import {
  Home,
  Search,
  Package,
  ShoppingBag,
  Wallet,
  PackagePlus,
  AlertTriangle,
  Bell,
  MessageCircle,
  MapPin,
  Calculator,
  FileText,
  PackageX,
  User,
  type LucideIcon,
} from "lucide-react";
import type { L10n } from "./portalTerms";

export interface GuideSection {
  id: string;
  icon: LucideIcon;
  /** Tailwind gradient utility classes for the section header. */
  gradient: string;
  /** The portal route this section explains. */
  path: string;
  title: L10n;
  /** One-sentence plain answer to "what is this section?" */
  what: L10n;
  /** What you can do there — short bullets. */
  points: L10n[];
  /** A real-life story so anyone gets it instantly. */
  example: L10n;
}

export const guideHeader = {
  title: { ku: "ڕێبەری پۆرتاڵ", en: "Portal guide", ar: "دليل البوابة", zh: "门户指南" } as L10n,
  subtitle: {
    ku: "هەموo بەشەکان بە ڕوونکردنەوە و نموونەوە — هەر شتێک نەزانیت لێرە دەیدۆزیتەوە",
    en: "Every section explained with examples — anything unclear, find it here",
    ar: "كل الأقسام مشروحة مع أمثلة — أي شيء غير واضح تجده هنا",
    zh: "每个版块都有说明和示例——任何不清楚的都能在这里找到",
  } as L10n,
  searchPlaceholder: {
    ku: "گەڕان لە ڕێبەرەکەدا... (نموونە: عمولە، تراک، یوان)",
    en: "Search the guide... (e.g. commission, tracking, yuan)",
    ar: "ابحث في الدليل... (مثال: عمولة، تتبع، يوان)",
    zh: "搜索指南...（例如：佣金、运单、人民币）",
  } as L10n,
  indexTitle: { ku: "فهرست — کلیک بکە بۆ هەر بەشێک", en: "Index — tap any section", ar: "الفهرس — اضغط على أي قسم", zh: "目录——点击任意版块" } as L10n,
  whatTitle: { ku: "ئەمە چییە؟", en: "What is this?", ar: "ما هذا؟", zh: "这是什么？" } as L10n,
  pointsTitle: { ku: "لێرەدا چی دەکەیت؟", en: "What can you do here?", ar: "ماذا يمكنك أن تفعل هنا؟", zh: "在这里能做什么？" } as L10n,
  exampleTitle: { ku: "نموونە", en: "Example", ar: "مثال", zh: "示例" } as L10n,
  goTo: { ku: "بڕۆ بۆ ئەم بەشە", en: "Go to this section", ar: "اذهب إلى هذا القسم", zh: "前往此版块" } as L10n,
  notFound: {
    ku: "هیچ بەشێک نەدۆزرایەوە بەم گەڕانە — وشەیەکی تر تاقی بکەرەوە",
    en: "No section matches your search — try another word",
    ar: "لا يوجد قسم يطابق بحثك — جرب كلمة أخرى",
    zh: "没有匹配的版块——请尝试其他关键词",
  } as L10n,
};

export const guideSections: GuideSection[] = [
  {
    id: "home",
    icon: Home,
    gradient: "from-slate-700 to-slate-900",
    path: "/portal",
    title: { ku: "پەڕەی سەرەکی", en: "Home", ar: "الرئيسية", zh: "首页" },
    what: {
      ku: "یەکەم پەڕەیە کە دەیبینیت — کورتەیەکی هەموو شتێک: باڵانس، بارە چالاکەکان، کردارە خێراکان و حیسابکەری نرخ",
      en: "The first page you see — a summary of everything: balance, active shipments, quick actions and the price calculator",
      ar: "أول صفحة تراها — ملخص كل شيء: الرصيد، الشحنات النشطة، الإجراءات السريعة وحاسبة الأسعار",
      zh: "您看到的第一页——一切的摘要：余额、进行中的货运、快捷操作和价格计算器",
    },
    points: [
      { ku: "بە یەک نەزەر باڵانس و قەرزەکەت ببینە", en: "See your balance and debt at a glance", ar: "شاهد رصيدك وديونك بنظرة واحدة", zh: "一眼看到您的余额和欠款" },
      { ku: "کردارە خێراکان: شوێنکەوتن، کڕینی یوان، تۆماری تراک...", en: "Quick actions: track, buy yuan, register tracking...", ar: "إجراءات سريعة: التتبع، شراء اليوان، تسجيل التتبع...", zh: "快捷操作：追踪、购买人民币、登记运单..." },
      { ku: "حیسابکەری نرخ: کێش یان قەبارە بنووسە، نرخی گواستنەوە ببینە", en: "Price calculator: enter weight or size, see the shipping cost", ar: "حاسبة الأسعار: أدخل الوزن أو الحجم وشاهد كلفة الشحن", zh: "价格计算器：输入重量或尺寸，查看运费" },
    ],
    example: {
      ku: "دانا دەیەوێت بزانێت ٥ کیلۆ جل بە ئاسمانی چەندی تێدەچێت — لە حیسابکەرەکە ٥ دەنووسێت و یەکسەر نرخەکە دەبینێت",
      en: "Dana wants to know what 5 kg of clothes costs by air — she types 5 in the calculator and sees the price instantly",
      ar: "دانا تريد معرفة كلفة ٥ كغم ملابس جواً — تكتب ٥ في الحاسبة وترى السعر فوراً",
      zh: "达娜想知道5公斤衣服空运多少钱——在计算器输入5，立即看到价格",
    },
  },
  {
    id: "search",
    icon: Search,
    gradient: "from-blue-600 to-indigo-700",
    path: "/portal/search",
    title: { ku: "بەدواداچوون (شوێنکەوتن)", en: "Tracking search", ar: "البحث والتتبع", zh: "追踪查询" },
    what: {
      ku: "لێرەدا بە تراکینگ نەمبەر، کۆدی پاکێج یان ئۆردەر نەمبەر (FP-...) هەر شتێکت دەدۆزیتەوە و گەشتەکەی دەبینیت",
      en: "Find anything by tracking number, package code or order number (FP-...) and see its journey",
      ar: "اعثر على أي شيء برقم التتبع أو رمز الطرد أو رقم الطلب (FP-...) وشاهد رحلته",
      zh: "通过运单号、包裹编码或订单号（FP-...）查找任何物品并查看其旅程",
    },
    points: [
      { ku: "تراکینگ نەمبەرەکەت بنووسە — قۆناغەکانی گەشت و وێنەی پاکێجەکە ببینە", en: "Type your tracking number — see journey stages and package photos", ar: "اكتب رقم التتبع — شاهد مراحل الرحلة وصور الطرد", zh: "输入运单号——查看旅程阶段和包裹照片" },
      { ku: "ئۆردەر نەمبەری (FP-...) بنووسە بۆ دۆزینەوەی ئۆردەرەکانت", en: "Type an order number (FP-...) to find your orders", ar: "اكتب رقم الطلب (FP-...) للعثور على طلباتك", zh: "输入订单号（FP-...）查找您的订单" },
      { ku: "دوا گەڕانەکانت پاشەکەوت دەبن — کلیکێک و دووبارە بگەڕێ", en: "Recent searches are saved — tap once to search again", ar: "عمليات البحث الأخيرة محفوظة — اضغط مرة للبحث مجدداً", zh: "最近搜索会保存——点一下即可重新搜索" },
    ],
    example: {
      ku: "ئاسۆ تراکینگی JT12345 لە فرۆشیارەکەی وەرگرتووە — لێرە دەینووسێت و دەبینێت پاکێجەکەی گەیشتۆتە گومرگ",
      en: "Aso got tracking JT12345 from his seller — he types it here and sees his package reached customs",
      ar: "آسو حصل على رقم التتبع JT12345 من البائع — يكتبه هنا ويرى أن طرده وصل الجمارك",
      zh: "阿索从卖家那里拿到运单号JT12345——在这里输入后看到包裹已到海关",
    },
  },
  {
    id: "shipments",
    icon: Package,
    gradient: "from-emerald-600 to-teal-700",
    path: "/portal/shipments",
    title: { ku: "بارەکان", en: "Shipments", ar: "الشحنات", zh: "货运" },
    what: {
      ku: "کاڵای خۆتە کە خۆت کڕیوتە و ئێمە تەنها بۆت دەگوازینەوە — لێرەدا هەموو بارەکانت و گەشتیان دەبینیت",
      en: "Goods you bought yourself that we only ship for you — here you see all your shipments and their journey",
      ar: "بضائع اشتريتها بنفسك ونحن ننقلها لك فقط — هنا ترى كل شحناتك ورحلتها",
      zh: "您自己购买、我们只负责运输的货物——在这里查看所有货运及其旅程",
    },
    points: [
      { ku: "هێڵی کاتی گەشت: کۆگای چین ← بەڕێکەوت ← گومرگ ← گەیشت", en: "Journey timeline: China depot → in transit → customs → arrived", ar: "خط الرحلة: مخزن الصين ← في الطريق ← الجمارك ← وصلت", zh: "旅程时间线：中国仓库 → 运输中 → 海关 → 已到达" },
      { ku: "وێنەی پاکێجەکانت کە لە کۆگا گیراون ببینە", en: "See the photos of your packages taken at the warehouse", ar: "شاهد صور طرودك الملتقطة في المخزن", zh: "查看在仓库拍摄的包裹照片" },
      { ku: "کێش، نرخی گواستنەوە و بەرواری گەیشتنی خەمڵێنراو", en: "Weight, shipping cost and estimated arrival date", ar: "الوزن وكلفة الشحن وتاريخ الوصول المتوقع", zh: "重量、运费和预计到达日期" },
    ],
    example: {
      ku: "ژیار ١٠ کارتۆن کاڵای لە تاوباو کڕیوە و ناردوویەتییە کۆگاکەمان — لێرە دەبینێت بارەکەی سبەی دەگاتە سلێمانی",
      en: "Zhyar bought 10 cartons from Taobao and sent them to our depot — here he sees his shipment arrives in Sulaymaniyah tomorrow",
      ar: "زيار اشترى ١٠ كراتين من تاوباو وأرسلها لمخزننا — هنا يرى أن شحنته تصل السليمانية غداً",
      zh: "日亚尔从淘宝买了10箱货发到我们仓库——在这里看到货明天到苏莱曼尼亚",
    },
  },
  {
    id: "orders",
    icon: ShoppingBag,
    gradient: "from-violet-600 to-purple-700",
    path: "/portal/full-package",
    title: { ku: "داواکاری (ئۆردەرەکانم)", en: "My orders (requests)", ar: "طلباتي", zh: "我的订单" },
    what: {
      ku: "لێرەدا ئێمە بۆت دەکڕین: یان «پاکێجی تەواو» (هەموو شتێک لە ئەستۆی ئێمە) یان «کڕین بە عمولە» (نرخی کاڵا + عمولە)",
      en: "Here WE buy for you: either 'full package' (we handle everything) or 'commission buying' (item price + fee)",
      ar: "هنا نحن نشتري لك: إما «الباقة الكاملة» (نتولى كل شيء) أو «الشراء بالعمولة» (سعر السلعة + عمولة)",
      zh: "在这里我们替您购买：\"全包\"（我们包办一切）或\"佣金代购\"（商品价+佣金）",
    },
    points: [
      { ku: "لینکی کاڵا یان وێنە بنێرە — ئێمە بۆت دەکڕین و دەیهێنین", en: "Send a product link or photo — we buy and bring it for you", ar: "أرسل رابط المنتج أو صورته — نشتريه ونجلبه لك", zh: "发送商品链接或图片——我们替您购买并送达" },
      { ku: "ئۆردەر نەمبەر (FP-...) بە کلیکێک کۆپی بکە", en: "Copy the order number (FP-...) with one tap", ar: "انسخ رقم الطلب (FP-...) بضغطة واحدة", zh: "一键复制订单号（FP-...）" },
      { ku: "دۆخی کڕینەکە ببینە: داواکراو ← کڕدرا ← نێردرا ← گەیشت", en: "See the buying status: requested → purchased → shipped → arrived", ar: "شاهد حالة الشراء: مطلوب ← تم الشراء ← أُرسل ← وصل", zh: "查看购买状态：已请求 → 已购买 → 已发货 → 已到达" },
      { ku: "عەدەد و وێنەی کاڵا و کۆی پارەکە هەر لەسەر کارتەکەیە", en: "Quantity, product photo and total are right on the card", ar: "الكمية وصورة السلعة والمجموع على البطاقة مباشرة", zh: "数量、商品图片和总额都在卡片上" },
    ],
    example: {
      ku: "شادی سێ دانە لە هەمان کەوتنی ژنانە دەوێت بەڵام نازانێت چۆن لە چین بیکڕێت — لینکەکە دەنێرێت، ئێمە دەیکڕین و لە ئۆردەرەکان بە FP-XXXX بەدوایدا دەچێت",
      en: "Shadi wants three of the same dress but can't buy from China herself — she sends the link, we buy it, and she tracks it in Orders by FP-XXXX",
      ar: "شادي تريد ثلاث قطع من نفس الفستان لكن لا تعرف الشراء من الصين — ترسل الرابط، نشتريه، وتتابعه في الطلبات برقم FP-XXXX",
      zh: "莎迪想要三件同款连衣裙但不会从中国购买——她发来链接，我们购买，她在订单中用FP-XXXX追踪",
    },
  },
  {
    id: "financial",
    icon: Wallet,
    gradient: "from-indigo-600 to-blue-700",
    path: "/portal/financial",
    title: { ku: "دارایی", en: "Financial", ar: "المالية", zh: "财务" },
    what: {
      ku: "هەموو شتێکی پارە لێرەیە: باڵانس، قەرز، مامەڵەکان، وەصڵەکان و کەشفی حساب",
      en: "Everything money-related: balance, debt, transactions, invoices and your account statement",
      ar: "كل ما يتعلق بالمال: الرصيد، الدين، المعاملات، الفواتير وكشف الحساب",
      zh: "所有与钱相关的：余额、欠款、交易、发票和对账单",
    },
    points: [
      { ku: "«حیسابی هەر ئۆردەرێک بە یەکەوە»: کڕین + عمولە + گواستنەوەی یەک ئۆردەر لە یەک کارتدا — سەرت لێ ناشێوێت", en: "'Billing per order': purchase + commission + shipping of one order in ONE card — no confusion", ar: "«فواتير كل طلب معاً»: الشراء + العمولة + الشحن لطلب واحد في بطاقة واحدة — لا التباس", zh: "\"按订单汇总账单\"：一个订单的采购+佣金+运费合并为一张卡——不混乱" },
      { ku: "کەشفی حسابەکەت وەک PDF دابگرە", en: "Download your account statement as PDF", ar: "حمّل كشف حسابك PDF", zh: "下载PDF对账单" },
      { ku: "هەر مامەڵەیەک وەصڵی خۆی هەیە — دەکرێ دایبگریت", en: "Every transaction has its receipt — downloadable", ar: "كل معاملة لها إيصالها — قابل للتنزيل", zh: "每笔交易都有收据——可下载" },
    ],
    example: {
      ku: "هێمن پانتۆڵێکی بە عمولە کڕیوە — لە دارایی یەک کارت دەبینێت: کاڵا ٢٠$ + عمولە ٣$ + گواستنەوە ٧$ = ٣٠$، نەک سێ وەصڵی لێکترازاو",
      en: "Hemn bought pants via commission — in Financial he sees ONE card: item $20 + fee $3 + shipping $7 = $30, not three scattered receipts",
      ar: "هيمن اشترى بنطالاً بالعمولة — في المالية يرى بطاقة واحدة: السلعة ٢٠$ + العمولة ٣$ + الشحن ٧$ = ٣٠$، وليس ثلاثة إيصالات متفرقة",
      zh: "希门通过佣金代购买了裤子——在财务中看到一张卡：商品$20+佣金$3+运费$7=$30，而不是三张零散收据",
    },
  },
  {
    id: "yuan",
    icon: Calculator,
    gradient: "from-red-600 to-rose-700",
    path: "/portal/yuan-exchange",
    title: { ku: "کڕینی یوانی چینی", en: "Buy Chinese Yuan", ar: "شراء اليوان الصيني", zh: "购买人民币" },
    what: {
      ku: "بۆ پارەدان بە فرۆشیارە چینییەکانت (Alipay...) یوان لە ئێمە بکڕە بە دۆلار — نرخی ڕۆژانە هەر لەوێ دیارە",
      en: "Buy yuan from us with USD to pay your Chinese sellers (Alipay...) — the daily rate is shown right there",
      ar: "اشترِ اليوان منا بالدولار لتدفع لبائعيك الصينيين (Alipay...) — السعر اليومي معروض هناك",
      zh: "用美元向我们购买人民币，支付给您的中国卖家（支付宝等）——每日汇率就显示在那里",
    },
    points: [
      { ku: "حاسیبە: دۆلار بنووسە → یوان ببینە، یان بەپێچەوانەوە", en: "Calculator: type USD → see CNY, or the reverse", ar: "حاسبة: اكتب الدولار ← شاهد اليوان، أو العكس", zh: "计算器：输入美元→看到人民币，反之亦然" },
      { ku: "داواکاری لەناو پۆرتاڵ تۆمار بکە یان یەکسەر بە واتسئاپ داوا بکە", en: "Place the order in the portal or ask instantly on WhatsApp", ar: "سجّل الطلب في البوابة أو اطلب فوراً عبر واتساب", zh: "在门户下单或直接通过WhatsApp订购" },
      { ku: "دۆخی داواکارییەکانت ببینە — کە تەواو بوو ئاگادار دەکرێیتەوە", en: "Track your requests — you're notified when completed", ar: "تابع طلباتك — يتم إشعارك عند الاكتمال", zh: "追踪您的申请——完成时会收到通知" },
    ],
    example: {
      ku: "ڕێبوار دەبێ ٦٤٠ یوان بداتە فرۆشیارێک لە چین — لێرە ١٠٠$ دەدات، ئێمە یوانەکە دەنێرین بۆ Alipay ی فرۆشیارەکەی",
      en: "Rebwar must pay a Chinese seller ¥640 — he pays $100 here and we send the yuan to the seller's Alipay",
      ar: "ريبوار يجب أن يدفع لبائع صيني ٦٤٠ يوان — يدفع ١٠٠$ هنا ونرسل اليوان إلى Alipay البائع",
      zh: "雷布瓦需要付给中国卖家640元——他在这里支付100美元，我们把人民币转到卖家的支付宝",
    },
  },
  {
    id: "declare",
    icon: PackagePlus,
    gradient: "from-teal-600 to-cyan-700",
    path: "/portal/declare",
    title: { ku: "تۆماری تراک (پێشوەخت)", en: "Pre-register tracking", ar: "تسجيل التتبع المسبق", zh: "预登记运单" },
    what: {
      ku: "کاتێک خۆت شتێک دەکڕیت لە چین، پێشوەخت تراکینگەکەی لێرە تۆمار بکە — کە گەیشتە کۆگا خۆکارانە دەناسرێتەوە کە هی تۆیە",
      en: "When you buy something yourself from China, pre-register its tracking here — when it reaches our depot it's automatically recognized as yours",
      ar: "عندما تشتري شيئاً بنفسك من الصين، سجّل رقم تتبعه هنا مسبقاً — عند وصوله لمخزننا يُعرف تلقائياً أنه لك",
      zh: "当您自己从中国购买商品时，提前在这里登记运单号——货到我们仓库时会自动识别为您的",
    },
    points: [
      { ku: "تراکینگ + وەسفی کاڵاکە تۆمار بکە", en: "Register the tracking + item description", ar: "سجّل رقم التتبع + وصف السلعة", zh: "登记运单号+商品描述" },
      { ku: "کە گەیشت، ئاگادارکردنەوەت بۆ دێت", en: "You get a notification when it arrives", ar: "يصلك إشعار عند الوصول", zh: "到货时您会收到通知" },
      { ku: "پاکێجەکەت هەرگیز بێ خاوەن نامێنێتەوە", en: "Your package never ends up unclaimed", ar: "طردك لا يبقى بلا صاحب أبداً", zh: "您的包裹永远不会无人认领" },
    ],
    example: {
      ku: "کارزان لە تاوباو کڕی و تراکینگەکەی لێرە تۆمارکرد — دوو هەفتە دواتر پەیامی هات: «پاکێجەکەت گەیشتە کۆگای چین»",
      en: "Karzan bought on Taobao and registered the tracking here — two weeks later he got: 'Your package reached our China depot'",
      ar: "كارزان اشترى من تاوباو وسجّل التتبع هنا — بعد أسبوعين وصلته رسالة: «طردك وصل مخزن الصين»",
      zh: "卡尔赞在淘宝购物并在这里登记了运单号——两周后收到消息：\"您的包裹已到达中国仓库\"",
    },
  },
  {
    id: "unclaimed",
    icon: AlertTriangle,
    gradient: "from-orange-500 to-amber-600",
    path: "/portal/no-mark",
    title: { ku: "پاکێجی بێ خاوەن", en: "Unclaimed packages", ar: "الطرود بلا صاحب", zh: "无主包裹" },
    what: {
      ku: "پاکێجی وا هەیە دەگاتە کۆگا بەڵام نازانرێت هی کێیە — لێرەدا بیانبینە و ئەگەر هی تۆ بوو داوای خاوەنداری بکە",
      en: "Some packages reach the depot with no known owner — browse them here and claim yours with proof",
      ar: "بعض الطرود تصل المخزن دون معرفة صاحبها — تصفحها هنا وطالب بطردك مع الإثبات",
      zh: "有些包裹到仓库时不知道是谁的——在这里浏览，如果是您的请凭凭证认领",
    },
    points: [
      { ku: "وێنە و تراکینگی پاکێجە بێ خاوەنەکان ببینە", en: "See photos and tracking of unclaimed packages", ar: "شاهد صور وتتبع الطرود بلا صاحب", zh: "查看无主包裹的照片和运单号" },
      { ku: "بەڵگە بنێرە (وەصڵی کڕین، سکرینشۆت) و داوای خاوەنداری بکە", en: "Send proof (purchase receipt, screenshot) and claim it", ar: "أرسل الإثبات (إيصال الشراء، لقطة شاشة) وطالب به", zh: "发送凭证（购买收据、截图）并认领" },
    ],
    example: {
      ku: "پاکێجێک بە تراکینگی نیوە‌سڕاوە گەیشتووە — ڤیان لە لیستەکە دەیناسێتەوە، وەصڵی تاوباوەکەی دەنێرێت و پاکێجەکە دەبێتەوە هی خۆی",
      en: "A package arrived with a half-erased tracking — Vian spots it in the list, sends her Taobao receipt and gets it assigned to her",
      ar: "وصل طرد برقم تتبع ممسوح جزئياً — فيان تتعرف عليه في القائمة، ترسل إيصال تاوباو ويُسند إليها",
      zh: "一个包裹运单号磨损了一半——薇安在列表中认出它，发送淘宝收据后包裹归还给她",
    },
  },
  {
    id: "notifications",
    icon: Bell,
    gradient: "from-amber-500 to-yellow-600",
    path: "/portal/notifications",
    title: { ku: "ئاگادارکردنەوەکان", en: "Notifications", ar: "الإشعارات", zh: "通知" },
    what: {
      ku: "هەر شتێک ڕوو بدات — گۆڕینی دۆخی بار، وەصڵی نوێ، وەڵامی داواکاری — لێرە و لەسەر مۆبایلەکەت پێت دەگات",
      en: "Anything that happens — shipment status change, new invoice, request reply — reaches you here and on your phone",
      ar: "أي شيء يحدث — تغيّر حالة الشحنة، فاتورة جديدة، رد على طلب — يصلك هنا وعلى هاتفك",
      zh: "任何动态——货运状态变化、新发票、申请回复——都会在这里和您的手机上通知您",
    },
    points: [
      { ku: "زەنگەکە دەجوڵێت و دەنگ دەدات کە شتێکی نوێ هەبێت", en: "The bell rings and animates when something new arrives", ar: "الجرس يرن ويتحرك عند وصول جديد", zh: "有新消息时铃铛会响并晃动" },
      { ku: "کلیک لە ئاگادارکردنەوەکە = ڕاستەوخۆ بۆ بەشە پەیوەندیدارەکە", en: "Tap a notification = straight to the related section", ar: "اضغط الإشعار = مباشرة للقسم المعني", zh: "点击通知=直达相关版块" },
    ],
    example: {
      ku: "مۆبایلی سارا زرینگایەوە: «باری WZN-B-88 گەیشت» — کلیکی کرد و یەکسەر وردەکاری بارەکەی بینی",
      en: "Sara's phone buzzed: 'Shipment WZN-B-88 arrived' — she tapped and saw the shipment details instantly",
      ar: "رنّ هاتف سارة: «الشحنة WZN-B-88 وصلت» — ضغطت ورأت تفاصيل الشحنة فوراً",
      zh: "萨拉的手机响了：\"货运WZN-B-88已到达\"——她点击后立即看到货运详情",
    },
  },
  {
    id: "messages",
    icon: MessageCircle,
    gradient: "from-pink-500 to-rose-600",
    path: "/portal/messages",
    title: { ku: "نامەکان و پشتگیری", en: "Messages & support", ar: "الرسائل والدعم", zh: "消息与客服" },
    what: {
      ku: "چاتی ڕاستەوخۆ لەگەڵ تیمەکەمان لەناو پۆرتاڵدا — یان لە هەر بەشێک دوگمەی سەوزی «پرسیارت هەیە؟» دابگرە بۆ واتسئاپ",
      en: "Direct chat with our team inside the portal — or tap the green 'Need help?' button in any section for WhatsApp",
      ar: "دردشة مباشرة مع فريقنا داخل البوابة — أو اضغط زر «تحتاج مساعدة؟» الأخضر في أي قسم لواتساب",
      zh: "在门户内与我们的团队直接聊天——或在任何版块点击绿色\"需要帮助？\"按钮转到WhatsApp",
    },
    points: [
      { ku: "نامە بنێرە و وەڵام لەناو پۆرتاڵ وەربگرە", en: "Send messages and get replies inside the portal", ar: "أرسل رسائل واستلم الردود داخل البوابة", zh: "在门户内发送消息并接收回复" },
      { ku: "دوگمەی «پرسیارت هەیە؟» خۆکارانە ناوت، کۆدەکەت و ئەو بەشە دەنێرێت کە لێیدایت — ستاف یەکسەر دەزانن باسی چی دەکەیت", en: "'Need help?' automatically sends your name, code and the section you're in — staff instantly know the context", ar: "زر «تحتاج مساعدة؟» يرسل تلقائياً اسمك ورمزك والقسم الذي أنت فيه — الموظفون يعرفون السياق فوراً", zh: "\"需要帮助？\"自动发送您的姓名、编码和所在版块——客服立即了解情况" },
    ],
    example: {
      ku: "لە کارتی بارێک هەڵێن «پرسیارت هەیە؟»ی داگرت — واتسئاپ کرایەوە و نامەکە ئامادە بوو: ناوی، کۆدی و کۆدی بارەکەی تێدا بوو",
      en: "From a shipment card Helen tapped 'Need help?' — WhatsApp opened with the message ready: her name, code and the shipment code inside",
      ar: "من بطاقة شحنة ضغطت هيلين «تحتاج مساعدة؟» — فُتح واتساب والرسالة جاهزة: اسمها ورمزها ورمز الشحنة",
      zh: "海伦从货运卡片点击\"需要帮助？\"——WhatsApp打开，消息已备好：她的姓名、编码和货运编码",
    },
  },
  {
    id: "addresses",
    icon: MapPin,
    gradient: "from-green-600 to-emerald-700",
    path: "/portal/addresses",
    title: { ku: "ناونیشانەکان", en: "Addresses", ar: "العناوين", zh: "地址" },
    what: {
      ku: "ناونیشانی کۆگاکانمان لە چین — ئەمانە بەکاربهێنە وەک ناونیشانی گەیاندن کاتێک لە ماڵپەڕە چینییەکان دەکڕیت",
      en: "Our depot addresses in China — use these as the delivery address when buying on Chinese sites",
      ar: "عناوين مخازننا في الصين — استخدمها كعنوان التسليم عند الشراء من المواقع الصينية",
      zh: "我们在中国的仓库地址——在中国网站购物时用作收货地址",
    },
    points: [
      { ku: "ناونیشانەکە کۆپی بکە و لە تاوباو/1688 دایبنێ", en: "Copy the address and paste it on Taobao/1688", ar: "انسخ العنوان وألصقه في تاوباو/1688", zh: "复制地址并粘贴到淘宝/1688" },
      { ku: "کۆدی کڕیاری خۆت لەگەڵ ناونیشانەکە بنووسە تا پاکێجەکە بناسرێتەوە", en: "Include your customer code with the address so the package is recognized", ar: "أضف رمز العميل الخاص بك مع العنوان ليُعرف الطرد", zh: "地址中包含您的客户编码以便识别包裹" },
    ],
    example: {
      ku: "زانا لە 1688 کڕی — ناونیشانی کۆگای گوانجۆی کۆپی کرد و کۆدەکەی (AZ012) لە کۆتایی زیاد کرد، پاکێجەکەی ڕاستەوخۆ ناسرایەوە",
      en: "Zana bought on 1688 — he copied the Guangzhou depot address and added his code (AZ012) at the end; his package was recognized right away",
      ar: "زانا اشترى من 1688 — نسخ عنوان مخزن غوانزو وأضاف رمزه (AZ012) في النهاية؛ عُرف طرده فوراً",
      zh: "扎纳在1688购物——复制了广州仓库地址并在末尾加上他的编码（AZ012），包裹立即被识别",
    },
  },
  {
    id: "prohibited",
    icon: PackageX,
    gradient: "from-rose-600 to-red-700",
    path: "/portal/prohibited-items",
    title: { ku: "کاڵا قەدەغەکراوەکان", en: "Prohibited items", ar: "البضائع الممنوعة", zh: "禁运物品" },
    what: {
      ku: "پێش کڕین سەیری ئەم لیستە بکە: چی قەدەغەیە، چی سنووردارە (ئاسمانی/دەریایی) و چی مۆڵەتی دەوێت",
      en: "Check this list before buying: what's banned, what's restricted (air/sea) and what needs permits",
      ar: "راجع هذه القائمة قبل الشراء: ما هو ممنوع، ما هو مقيّد (جوي/بحري) وما يحتاج تصاريح",
      zh: "购买前查看此清单：什么被禁止、什么受限（空运/海运）、什么需要许可证",
    },
    points: [
      { ku: "٣ پۆل: قەدەغەی تەواو / سنووردار / پێویست بە مۆڵەت", en: "3 groups: fully banned / restricted / needs permit", ar: "٣ فئات: ممنوع تماماً / مقيّد / يحتاج تصريحاً", zh: "3类：完全禁止/受限/需要许可" },
      { ku: "لە هەر خاڵێک دڵنیا نەبوویت، کلیک بکە و لە واتسئاپ بپرسە", en: "Unsure about any item? Tap it and ask on WhatsApp", ar: "غير متأكد من أي بند؟ اضغطه واسأل عبر واتساب", zh: "对任何条目不确定？点击并通过WhatsApp询问" },
    ],
    example: {
      ku: "بەفرین دەیویست پاوەربانک بکڕێت — لە لیستەکە بینی «بە ئاسمانی سنووردارە»، کلیکی کرد و پرسی، وتمان بە دەریایی بینێرێت",
      en: "Bafrin wanted to buy power banks — the list said 'restricted by air', she tapped, asked, and we told her to ship by sea",
      ar: "بفرين أرادت شراء باور بانك — القائمة قالت «مقيّد جواً»، ضغطت وسألت، فأخبرناها بالشحن بحراً",
      zh: "巴弗琳想买充电宝——清单显示\"空运受限\"，她点击询问，我们告诉她走海运",
    },
  },
  {
    id: "terms",
    icon: FileText,
    gradient: "from-cyan-600 to-sky-700",
    path: "/portal/terms",
    title: { ku: "مەرج و ڕێساکان", en: "Terms & conditions", ar: "الشروط والأحكام", zh: "条款与条件" },
    what: {
      ku: "ڕێساکانی کارکردنمان بە زمانێکی سادە — بەرپرسیارێتی، کێش و قەبارە، پارەدان، ماوەکان و زیاتر",
      en: "Our working rules in plain language — responsibility, weight & size, payment, timelines and more",
      ar: "قواعد عملنا بلغة بسيطة — المسؤولية، الوزن والحجم، الدفع، المدد وأكثر",
      zh: "用简单语言说明我们的工作规则——责任、重量与尺寸、付款、时限等",
    },
    points: [
      { ku: "هەر خاڵێک ڕوون نەبوو، کلیکی بکە و لە واتسئاپ بپرسە", en: "Any point unclear? Tap it and ask on WhatsApp", ar: "أي بند غير واضح؟ اضغطه واسأل عبر واتساب", zh: "任何条款不清楚？点击并通过WhatsApp询问" },
    ],
    example: {
      ku: "ئاکام دەیویست بزانێت کێشی قەبارەیی چۆن حیساب دەکرێت — لە مەرجەکان خاڵەکەی دۆزییەوە و بە کلیکێک پرسیاری لێکرد",
      en: "Akam wanted to know how volumetric weight is calculated — he found the point in the terms and asked with one tap",
      ar: "أكام أراد معرفة كيفية حساب الوزن الحجمي — وجد البند في الشروط وسأل بضغطة واحدة",
      zh: "阿卡姆想知道体积重如何计算——他在条款中找到该条目并一键提问",
    },
  },
  {
    id: "profile",
    icon: User,
    gradient: "from-fuchsia-600 to-purple-700",
    path: "/portal/profile",
    title: { ku: "پڕۆفایل", en: "Profile", ar: "الملف الشخصي", zh: "个人资料" },
    what: {
      ku: "زانیارییەکانت، کۆدی کڕیاری، زمان، ڕەنگی ڕووکار (تاریک/ڕووناک) و دەرچوون — هەموو ڕێکخستنەکانت لێرەیە",
      en: "Your info, customer code, language, theme (dark/light) and logout — all your settings live here",
      ar: "معلوماتك، رمز العميل، اللغة، المظهر (داكن/فاتح) وتسجيل الخروج — كل إعداداتك هنا",
      zh: "您的信息、客户编码、语言、主题（深色/浅色）和退出登录——所有设置都在这里",
    },
    points: [
      { ku: "زمان بگۆڕە: کوردی، عەرەبی، ئینگلیزی، چینی", en: "Switch language: Kurdish, Arabic, English, Chinese", ar: "غيّر اللغة: كردية، عربية، إنجليزية، صينية", zh: "切换语言：库尔德语、阿拉伯语、英语、中文" },
      { ku: "لینکی خێرا بۆ یوان، قەدەغەکراوەکان، مەرجەکان و ئەم ڕێبەرە", en: "Quick links to Yuan, prohibited items, terms and this guide", ar: "روابط سريعة لليوان والممنوعات والشروط وهذا الدليل", zh: "快捷链接：人民币、禁运品、条款和本指南" },
    ],
    example: {
      ku: "باوکی هێرش کوردی نازانێت — لە پڕۆفایل زمانی گۆڕی بۆ عەرەبی و هەموو پۆرتاڵەکە بە عەرەبی بوو",
      en: "Hersh's father doesn't read Kurdish — he switched the language to Arabic in Profile and the whole portal changed",
      ar: "والد هيرش لا يقرأ الكردية — غيّر اللغة إلى العربية في الملف فتغيّرت البوابة كلها",
      zh: "赫尔什的父亲不懂库尔德语——在个人资料中切换为阿拉伯语，整个门户都变了",
    },
  },
];
