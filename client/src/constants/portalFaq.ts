// Wazn Express — customer-facing FAQ content in all four UI languages
// (ku / en / ar / zh). Rendered by client/src/pages/portal/PortalFAQ.tsx as a
// searchable, categorised accordion. Each answer is written to be genuinely
// useful for a China→Iraq shipping customer.
import {
  Truck, Wallet, MapPin, Search, Coins, PackageX, UserCog,
  type LucideIcon,
} from "lucide-react";

export type L10n = { ku: string; en: string; ar: string; zh: string };

import { TERMS_WHATSAPP_NUMBER } from "./portalTerms";

/** Same support line as everywhere else — alias kept for existing imports. */
export const FAQ_WHATSAPP_NUMBER = TERMS_WHATSAPP_NUMBER;

export interface FaqItem {
  q: L10n;
  a: L10n;
}

export interface FaqCategory {
  id: string;
  icon: LucideIcon;
  /** Tailwind gradient utility classes for the category header. */
  gradient: string;
  title: L10n;
  items: FaqItem[];
}

export const faqHeader = {
  title: { ku: "پرسیارە باوەکان", en: "FAQ", ar: "الأسئلة الشائعة", zh: "常见问题" } as L10n,
  subtitle: {
    ku: "وەڵامی خێرا بۆ باوترین پرسیارەکان",
    en: "Quick answers to the most common questions",
    ar: "إجابات سريعة لأكثر الأسئلة شيوعًا",
    zh: "最常见问题的快速解答",
  } as L10n,
  searchPlaceholder: {
    ku: "گەڕان بۆ پرسیار...",
    en: "Search questions...",
    ar: "ابحث عن سؤال...",
    zh: "搜索问题...",
  } as L10n,
  noResults: {
    ku: "هیچ پرسیارێک نەدۆزرایەوە — هەوڵبدە بە وشەیەکی تر یان پەیوەندیمان پێوە بکە.",
    en: "No questions found — try another word or contact us.",
    ar: "لم يتم العثور على أسئلة — جرّب كلمة أخرى أو تواصل معنا.",
    zh: "未找到问题 — 请尝试其他词或联系我们。",
  } as L10n,
  stillStuck: {
    ku: "وەڵامەکەت نەدۆزییەوە؟",
    en: "Didn't find your answer?",
    ar: "لم تجد إجابتك؟",
    zh: "没找到答案？",
  } as L10n,
  askOnWhatsApp: {
    ku: "پرسیار لە واتساپ بکە",
    en: "Ask on WhatsApp",
    ar: "اسأل عبر واتساب",
    zh: "在 WhatsApp 上咨询",
  } as L10n,
};

// Pre-filled WhatsApp message when a customer taps "ask about this question".
export const faqAskPrefix: L10n = {
  ku: "سڵاو، پرسیارم هەیە دەربارەی:",
  en: "Hello, I have a question about:",
  ar: "مرحبًا، لدي سؤال حول:",
  zh: "你好，我想咨询关于：",
};

export const faqCategories: FaqCategory[] = [
  {
    id: "shipping",
    icon: Truck,
    gradient: "from-blue-500 to-indigo-600",
    title: { ku: "گەیاندن و ناردن", en: "Shipping & delivery", ar: "الشحن والتوصيل", zh: "运输与配送" },
    items: [
      {
        q: {
          ku: "جیاوازی نێوان ئاسمانی و دەریایی چییە؟",
          en: "What's the difference between air and sea shipping?",
          ar: "ما الفرق بين الشحن الجوي والبحري؟",
          zh: "空运和海运有什么区别？",
        },
        a: {
          ku: "ئاسمانی خێراترە و بەپێی کیلۆ (kg) حساب دەکرێت — گونجاوە بۆ بارە سووک و پەلە. دەریایی هەرزانترە و بەپێی مەترسێج (CBM) حساب دەکرێت — گونجاوە بۆ بارە قورس و گەورە کە پەلەت نییە.",
          en: "Air is faster and priced per kilogram (kg) — best for light, urgent goods. Sea is cheaper and priced per cubic meter (CBM) — best for heavy or bulky goods when you're not in a hurry.",
          ar: "الجوي أسرع ويُحسب بالكيلوغرام (kg) — مناسب للبضائع الخفيفة والعاجلة. البحري أرخص ويُحسب بالمتر المكعب (CBM) — مناسب للبضائع الثقيلة أو الكبيرة عند عدم الاستعجال.",
          zh: "空运更快，按公斤（kg）计价，适合轻便、紧急的货物。海运更便宜，按立方米（CBM）计价，适合不急的重货或大件货物。",
        },
      },
      {
        q: {
          ku: "گەیاندن چەند دەخایەنێت؟",
          en: "How long does delivery take?",
          ar: "كم يستغرق التوصيل؟",
          zh: "配送需要多长时间？",
        },
        a: {
          ku: "کاتی وردی گەیاندن بەپێی جۆری ناردن و بارەکە دەگۆڕێت. دوای گەیشتنی بارەکە بۆ کۆگاکەمان لە چین، دۆخی بارەکەت لە بەشی «بارەکان» بە زیندوویی دەبینیت. بۆ کاتی وردتر لەگەڵ پشتگیری پەیوەندی بکە.",
          en: "Exact times depend on the shipping type and the batch. Once your goods reach our warehouse in China, you can track the live status in the 'Shipments' section. For a precise estimate, contact support.",
          ar: "تعتمد المدة الدقيقة على نوع الشحن والدفعة. بمجرد وصول بضاعتك إلى مستودعنا في الصين، يمكنك متابعة الحالة مباشرة في قسم «الشحنات». لتقدير دقيق، تواصل مع الدعم.",
          zh: "具体时间取决于运输方式和批次。货物到达我们中国仓库后，你可在「运单」部分实时追踪状态。如需精确估算，请联系客服。",
        },
      },
      {
        q: {
          ku: "بارەکەم لە کوێیە ئێستا؟",
          en: "Where is my shipment right now?",
          ar: "أين شحنتي الآن؟",
          zh: "我的货物现在在哪里？",
        },
        a: {
          ku: "بڕۆ بۆ بەشی «بارەکان»، بارەکەت هەڵبژێرە و هێڵی کاتی گەشتەکە دەبینیت — لە کۆگای چینەوە تا گەیشتن. هەر گۆڕانکارییەک ڕوو بدات، ئاگادارکردنەوەت بۆ دێت.",
          en: "Go to the 'Shipments' section, open your batch, and you'll see the journey timeline — from the China warehouse to arrival. You'll get a notification whenever the status changes.",
          ar: "اذهب إلى قسم «الشحنات»، افتح دفعتك، وسترى المخطط الزمني للرحلة — من مستودع الصين حتى الوصول. ستصلك إشعارات عند كل تغيير في الحالة.",
          zh: "进入「运单」部分，打开你的批次，即可看到运输时间线——从中国仓库到抵达。状态变化时你会收到通知。",
        },
      },
    ],
  },
  {
    id: "warehouse",
    icon: MapPin,
    gradient: "from-emerald-500 to-teal-600",
    title: { ku: "کۆگا و تۆمارکردن", en: "Warehouse & registration", ar: "المستودع والتسجيل", zh: "仓库与登记" },
    items: [
      {
        q: {
          ku: "چۆن پاکەتەکەم تۆمار بکەم؟",
          en: "How do I register my package?",
          ar: "كيف أسجّل طردي؟",
          zh: "如何登记我的包裹？",
        },
        a: {
          ku: "دوای کڕین لە چین، ژمارەی تراکینگی بارەکە لە بەشی «ناساندنی پاکەت» تۆمار بکە. بەمە کاتێک دەگاتە کۆگاکەمان، دەزانین هی تۆیە و بە ناوی تۆ تۆماری دەکەین.",
          en: "After buying from China, register the package's tracking number in the 'Declare Package' section. That way, when it reaches our warehouse, we know it's yours and log it under your name.",
          ar: "بعد الشراء من الصين، سجّل رقم تتبع الطرد في قسم «تعريف الطرد». بهذا، عند وصوله إلى مستودعنا نعرف أنه لك ونسجّله باسمك.",
          zh: "从中国购物后，在「申报包裹」部分登记包裹的追踪号。这样货物到达我们仓库时，我们就知道是你的并以你的名义登记。",
        },
      },
      {
        q: {
          ku: "ناونیشانی کۆگاکەتان لە چین چییە؟",
          en: "What's your warehouse address in China?",
          ar: "ما عنوان مستودعكم في الصين؟",
          zh: "你们在中国的仓库地址是什么？",
        },
        a: {
          ku: "ناونیشانی کۆگاکەمان لە بەشی «ناونیشانەکان» دەبینیت — بە کۆدی تایبەت بە تۆ. ئەم ناونیشانە بدە بە فرۆشیارە چینییەکان کاتی ناردن.",
          en: "You'll find our warehouse address in the 'Addresses' section — with your personal code. Give this address to Chinese sellers when they ship.",
          ar: "ستجد عنوان مستودعنا في قسم «العناوين» — مع رمزك الشخصي. أعطِ هذا العنوان للبائعين الصينيين عند الشحن.",
          zh: "你可在「地址」部分找到我们的仓库地址——含你的专属代码。发货时把此地址给中国卖家。",
        },
      },
      {
        q: {
          ku: "پاکەتەکەم بێ ناو گەیشت، چی بکەم؟",
          en: "My package arrived without my name — what now?",
          ar: "وصل طردي دون اسمي — ماذا أفعل؟",
          zh: "我的包裹到了但没有我的名字，怎么办？",
        },
        a: {
          ku: "بڕۆ بۆ بەشی «پاکەتی بێ نیشانە»، ئەگەر پاکەتەکەت لەوێ بوو داوای خاوەندارییەتی بکە بە پیشاندانی ژمارەی تراکینگ. تیمەکەمان پشکنینی دەکات و بۆت تۆماری دەکات.",
          en: "Go to the 'Unclaimed Packages' section; if your package is there, claim it by showing the tracking number. Our team will verify and register it for you.",
          ar: "اذهب إلى قسم «الطرود غير المطالب بها»؛ إذا كان طردك هناك، طالب به بإظهار رقم التتبع. سيتحقق فريقنا ويسجّله لك.",
          zh: "进入「无主包裹」部分；如果你的包裹在那里，出示追踪号进行认领。我们的团队会核实并为你登记。",
        },
      },
    ],
  },
  {
    id: "payment",
    icon: Wallet,
    gradient: "from-amber-500 to-orange-600",
    title: { ku: "پارەدان و حساب", en: "Payment & billing", ar: "الدفع والحساب", zh: "付款与账单" },
    items: [
      {
        q: {
          ku: "چۆن نرخی بارەکەم دەزانم؟",
          en: "How do I know my shipping cost?",
          ar: "كيف أعرف تكلفة الشحن؟",
          zh: "如何知道我的运费？",
        },
        a: {
          ku: "نرخ بەپێی کێش (بۆ ئاسمانی) یان قەبارە (بۆ دەریایی) حساب دەکرێت. نرخە نوێکراوەکان لە پەڕەی سەرەکی دەبینیت، و کۆستی هەر پاکەتێک لە کاتی گەیشتن لە بەشی «دارایی» دەردەکەوێت.",
          en: "Cost is calculated by weight (for air) or volume (for sea). You can see the current rates on the home page, and each package's cost appears in the 'Finance' section once it arrives.",
          ar: "تُحسب التكلفة بالوزن (للجوي) أو الحجم (للبحري). يمكنك رؤية الأسعار الحالية في الصفحة الرئيسية، وتظهر تكلفة كل طرد في قسم «المالية» عند وصوله.",
          zh: "费用按重量（空运）或体积（海运）计算。你可在首页查看当前价格，每个包裹的费用在到达后显示于「财务」部分。",
        },
      },
      {
        q: {
          ku: "چۆن حسابەکەم و قەرزەکەم دەبینم؟",
          en: "How do I check my balance and dues?",
          ar: "كيف أتحقق من رصيدي ومستحقاتي؟",
          zh: "如何查看我的余额和欠款？",
        },
        a: {
          ku: "بەشی «دارایی» باڵانس و مامەڵە داراییەکانت پیشان دەدات. هەروەها دەتوانیت کەشفی حساب (PDF) بە هەموو وردەکارییەکانەوە داگریت.",
          en: "The 'Finance' section shows your balance and transactions. You can also download a full account statement (PDF) with every detail.",
          ar: "يعرض قسم «المالية» رصيدك ومعاملاتك. يمكنك أيضًا تنزيل كشف حساب كامل (PDF) بكل التفاصيل.",
          zh: "「财务」部分显示你的余额和交易。你还可以下载包含所有明细的完整账户对账单（PDF）。",
        },
      },
      {
        q: {
          ku: "بە چ دراوێک دەتوانم پارە بدەم؟",
          en: "Which currencies can I pay in?",
          ar: "بأي عملات يمكنني الدفع؟",
          zh: "我可以用哪些货币付款？",
        },
        a: {
          ku: "بۆ زانیاری وردی شێوازەکانی پارەدان و دراوەکان، لەگەڵ پشتگیری پەیوەندی بکە لە ڕێگەی واتساپ — بە دڵنیاییەوە یارمەتیت دەدەین.",
          en: "For exact payment methods and currencies, contact support on WhatsApp — we'll gladly help.",
          ar: "لمعرفة طرق الدفع والعملات بدقة، تواصل مع الدعم عبر واتساب — يسعدنا مساعدتك.",
          zh: "有关具体付款方式和货币，请通过 WhatsApp 联系客服——我们很乐意帮助。",
        },
      },
    ],
  },
  {
    id: "yuan",
    icon: Coins,
    gradient: "from-red-500 to-rose-600",
    title: { ku: "کڕینی یوان", en: "Buying Yuan", ar: "شراء اليوان", zh: "购买人民币" },
    items: [
      {
        q: {
          ku: "چۆن یوانی چینی دەکڕم؟",
          en: "How do I buy Chinese Yuan?",
          ar: "كيف أشتري اليوان الصيني؟",
          zh: "如何购买人民币？",
        },
        a: {
          ku: "بڕۆ بۆ بەشی «کڕینی یوانی چینی» لە پەڕەی سەرەکی، بڕی دۆلار یان یوان بنووسە، حاسیبەکە بڕەکەت پیشان دەدات بەپێی نرخی ئەمڕۆ، پاشان داواکارییەکە بنێرە.",
          en: "Go to 'Buy Chinese Yuan' on the home page, enter the dollar or yuan amount, the calculator shows the result at today's rate, then submit your request.",
          ar: "اذهب إلى «شراء اليوان الصيني» في الصفحة الرئيسية، أدخل مبلغ الدولار أو اليوان، تعرض الحاسبة النتيجة بسعر اليوم، ثم أرسل طلبك.",
          zh: "在首页进入「购买人民币」，输入美元或人民币金额，计算器按当日汇率显示结果，然后提交请求。",
        },
      },
      {
        q: {
          ku: "نرخی یوان چەندە؟",
          en: "What's the Yuan rate?",
          ar: "ما سعر اليوان؟",
          zh: "人民币汇率是多少？",
        },
        a: {
          ku: "نرخی نوێکراوە بە زیندوویی لە بەشی «کڕینی یوانی چینی» و لەسەر لیستی نرخەکان دەردەکەوێت. نرخەکە بەردەوام بەپێی بازاڕ نوێ دەکرێتەوە.",
          en: "The live, updated rate is shown in the 'Buy Chinese Yuan' section and on the price list. It's kept current with the market.",
          ar: "يظهر السعر المحدّث مباشرة في قسم «شراء اليوان الصيني» وعلى قائمة الأسعار. يُحدّث باستمرار حسب السوق.",
          zh: "实时更新的汇率显示在「购买人民币」部分和价格表上，随市场持续更新。",
        },
      },
    ],
  },
  {
    id: "prohibited",
    icon: PackageX,
    gradient: "from-rose-500 to-red-600",
    title: { ku: "کاڵا قەدەغەکراوەکان", en: "Prohibited items", ar: "البضائع الممنوعة", zh: "禁运物品" },
    items: [
      {
        q: {
          ku: "چ کاڵایەک ناردنی قەدەغەیە؟",
          en: "Which items are prohibited to ship?",
          ar: "ما البضائع الممنوع شحنها؟",
          zh: "哪些物品禁止运输？",
        },
        a: {
          ku: "هەندێک کاڵا (وەک ماددە تەقەمەنی، بەهۆشبەر، هەندێک شل و باتری) قەدەغەن یان مەرجی تایبەتیان هەیە. تکایە بەشی «کاڵا قەدەغەکراوەکان» بخوێنەوە پێش ناردن بۆ دووربوون لە کێشە.",
          en: "Some items (like flammables, narcotics, certain liquids and batteries) are prohibited or restricted. Please read the 'Prohibited Items' section before shipping to avoid problems.",
          ar: "بعض البضائع (كالمواد القابلة للاشتعال والمخدرات وبعض السوائل والبطاريات) ممنوعة أو مقيّدة. يرجى قراءة قسم «البضائع الممنوعة» قبل الشحن لتجنّب المشاكل.",
          zh: "某些物品（如易燃品、毒品、某些液体和电池）被禁止或受限。请在运输前阅读「禁运物品」部分以避免问题。",
        },
      },
    ],
  },
  {
    id: "account",
    icon: UserCog,
    gradient: "from-cyan-500 to-blue-600",
    title: { ku: "هەژمار و ڕێکخستن", en: "Account & settings", ar: "الحساب والإعدادات", zh: "账户与设置" },
    items: [
      {
        q: {
          ku: "چۆن وشەی نهێنیم دەگۆڕم؟",
          en: "How do I change my password?",
          ar: "كيف أغيّر كلمة مروري؟",
          zh: "如何修改密码？",
        },
        a: {
          ku: "بڕۆ بۆ «پرۆفایل» ← «پاراستن»، وشەی ئێستا و نوێ بنووسە و پاشەکەوتی بکە. ئەگەر وشەکەت لەبیرچووە، لەگەڵ پشتگیری پەیوەندی بکە بۆ ڕیسێتکردنی.",
          en: "Go to 'Profile' → 'Security', enter your current and new password, and save. If you forgot your password, contact support to reset it.",
          ar: "اذهب إلى «الملف الشخصي» ← «الأمان»، أدخل كلمة المرور الحالية والجديدة واحفظ. إذا نسيت كلمة المرور، تواصل مع الدعم لإعادة تعيينها.",
          zh: "进入「个人资料」→「安全」，输入当前和新密码并保存。如果忘记密码，请联系客服重置。",
        },
      },
      {
        q: {
          ku: "چۆن زمانی ئەپەکە دەگۆڕم؟",
          en: "How do I change the app language?",
          ar: "كيف أغيّر لغة التطبيق؟",
          zh: "如何更改应用语言？",
        },
        a: {
          ku: "بڕۆ بۆ «پرۆفایل» ← «زمان»، و لە نێوان کوردی، ئینگلیزی، عەرەبی و چینی هەڵبژێرە.",
          en: "Go to 'Profile' → 'Language' and choose between Kurdish, English, Arabic and Chinese.",
          ar: "اذهب إلى «الملف الشخصي» ← «اللغة» واختر بين الكردية والإنجليزية والعربية والصينية.",
          zh: "进入「个人资料」→「语言」，在库尔德语、英语、阿拉伯语和中文之间选择。",
        },
      },
    ],
  },
];
