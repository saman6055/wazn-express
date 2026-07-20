// Wazn Express — customer-facing Terms & Conditions content, in all four UI
// languages (ku / en / ar / zh). Source of truth: the simplified terms doc.
// Rendered by client/src/pages/portal/PortalTerms.tsx. Each item is tappable
// and opens a pre-filled WhatsApp chat asking for clarification on that point.
import {
  Building2,
  ClipboardCheck,
  Warehouse,
  Ship,
  ShieldCheck,
  Umbrella,
  Wallet,
  Truck,
  Ban,
  ShoppingBag,
  Scale,
  type LucideIcon,
} from "lucide-react";

export type L10n = { ku: string; en: string; ar: string; zh: string };

export interface TermsSection {
  id: string;
  icon: LucideIcon;
  /** Tailwind gradient utility classes for the section header bar. */
  gradient: string;
  title: L10n;
  items: L10n[];
}

/** WhatsApp support number in international (wa.me) format: +964 770 918 3535. */
export const TERMS_WHATSAPP_NUMBER = "9647709183535";

/** Closing line appended to the pre-filled WhatsApp message, after the point. */
export const termsClosing: L10n = {
  ku: "سڵاو بەڕێزان، ئەزیەت نەبن، لەسەر ئەم خاڵە ڕوونکردنەوەی زیاترم دەوێ.",
  en: "Hello, sorry to bother you — I'd like more clarification on this point.",
  ar: "السلام عليكم، عذرًا على الإزعاج — أودّ مزيدًا من التوضيح بشأن هذه النقطة.",
  zh: "您好，抱歉打扰——我想就这一点获得更多说明。",
};

/** Small hint shown under every point. */
export const termsHint: L10n = {
  ku: "بۆ زانیاری زیاتر یان ئەگەر ڕوون نییە، لێرە پەیوەندیمان پێوە بکە",
  en: "For more info, or if this isn't clear, tap to contact us",
  ar: "لمزيدٍ من المعلومات أو إن لم يكن واضحًا، اضغط للتواصل معنا",
  zh: "如需更多信息或不清楚，请点击联系我们",
};

/** Header + intro copy. */
export const termsHeader = {
  title: {
    ku: "مەرج و ڕێساکان",
    en: "Terms & Conditions",
    ar: "الشروط والأحكام",
    zh: "条款和条件",
  } as L10n,
  subtitle: {
    ku: "مەرجەکانی خزمەتگوزاری وەزن ئێکسپرێس",
    en: "Wazn Express service terms",
    ar: "شروط خدمة وزن إكسبريس",
    zh: "Wazn Express 服务条款",
  } as L10n,
  tapTip: {
    ku: "کلیک لەسەر هەر خاڵێک بکە بۆ پرسیارکردنی لە واتساپ",
    en: "Tap any point to ask about it on WhatsApp",
    ar: "اضغط على أي نقطة للاستفسار عنها عبر واتساب",
    zh: "点击任意条款即可通过 WhatsApp 咨询",
  } as L10n,
  consent: {
    ku: "بەکارهێنانی خزمەتگوزارییەکانی وەزن ئێکسپرێس واتە ڕازیبوونت بەم مەرجانە.",
    en: "Using Wazn Express services means you agree to these terms.",
    ar: "استخدام خدمات وزن إكسبريس يعني موافقتك على هذه الشروط.",
    zh: "使用 Wazn Express 的服务即表示您同意本条款。",
  } as L10n,
  updated: {
    ku: "دوایین نوێکردنەوە: ٢٠٢٦/٠٧/٢٠",
    en: "Last updated: 2026/07/20",
    ar: "آخر تحديث: 2026/07/20",
    zh: "最后更新：2026/07/20",
  } as L10n,
  contactCta: {
    ku: "هێشتا پرسیارت هەیە؟ پەیوەندیمان پێوە بکە لە واتساپ",
    en: "Still have questions? Contact us on WhatsApp",
    ar: "لا تزال لديك أسئلة؟ تواصل معنا عبر واتساب",
    zh: "还有疑问？通过 WhatsApp 联系我们",
  } as L10n,
};

/** General (no specific point) opener for the bottom contact button. */
export const termsGeneralOpener: L10n = {
  ku: "سڵاو بەڕێزان، پرسیارم هەیە دەربارەی مەرج و ڕێساکان.",
  en: "Hello, I have a question about the Terms & Conditions.",
  ar: "السلام عليكم، لديّ سؤال بخصوص الشروط والأحكام.",
  zh: "您好，我有关于条款和条件的问题。",
};

export const termsSections: TermsSection[] = [
  {
    id: "who-we-are",
    icon: Building2,
    gradient: "from-sky-500 to-blue-600",
    title: {
      ku: "کێ ئێمەین",
      en: "Who We Are",
      ar: "من نحن",
      zh: "关于我们",
    },
    items: [
      {
        ku: "وەزن ئێکسپرێس کۆمپانیایەکی گواستنەوەی بار و بریکاری لۆجستیکییە، ناوەندەکەی لە هەولێری هەرێمی کوردستانی عێراقە.",
        en: "Wazn Express is a freight forwarder and logistics agent based in Erbil, Kurdistan Region of Iraq.",
        ar: "وزن إكسبريس شركة شحن ووكيل لوجستي مقرها في أربيل، إقليم كوردستان العراق.",
        zh: "Wazn Express 是一家货运代理和物流代理公司，总部位于伊拉克库尔德斯坦地区埃尔比勒。",
      },
      {
        ku: "بارەکانتان لە چینەوە بۆ عێراق دەگوازینەوە لە ڕێگەی کۆمپانیای فڕۆکە و هێڵی کەشتی و بریکاری گومرگی لایەنی سێیەم.",
        en: "We arrange shipping your goods from China to Iraq using third-party airlines, shipping lines, and customs brokers.",
        ar: "نُرتّب شحن بضائعك من الصين إلى العراق عبر شركات طيران وخطوط شحن ووسطاء جمارك من طرف ثالث.",
        zh: "我们通过第三方航空公司、船运公司和报关行安排将您的货物从中国运往伊拉克。",
      },
      {
        ku: "ئێمە خۆمان کۆمپانیای فڕۆکە یان هێڵی کەشتی نین — بەڵکو پرۆسەکە لە جیاتی ئێوە بەڕێوەدەبەین.",
        en: "We are not an airline or shipping carrier ourselves — we manage the process on your behalf.",
        ar: "نحن لسنا شركة طيران أو ناقل شحن بأنفسنا — بل ندير العملية نيابةً عنك.",
        zh: "我们本身不是航空公司或船运承运人——我们代表您管理整个流程。",
      },
    ],
  },
  {
    id: "your-responsibilities",
    icon: ClipboardCheck,
    gradient: "from-emerald-500 to-teal-600",
    title: {
      ku: "بەرپرسیارێتییەکانت",
      en: "Your Responsibilities",
      ar: "مسؤولياتك",
      zh: "您的责任",
    },
    items: [
      {
        ku: "زانیاری ڕاست دەربارەی بارەکانت بدە: وەسف، نرخ، کێش، و قەبارە.",
        en: "Give us correct information about your goods: description, value, weight, and size.",
        ar: "زوّدنا بمعلومات صحيحة عن بضائعك: الوصف والقيمة والوزن والحجم.",
        zh: "向我们提供准确的货物信息：描述、价值、重量和尺寸。",
      },
      {
        ku: "بارەکانت دەبێت بە یاسایی بن بۆ هەناردەکردن لە چین و هاوردەکردن بۆ عێراق. ئەگەر نەبن، هەر سزا یان زیانێک لەسەر تۆیە — نەک ئێمە.",
        en: "Your goods must be legal to export from China and import into Iraq. If not, you pay any fines or losses — not us.",
        ar: "يجب أن تكون بضائعك قانونية للتصدير من الصين والاستيراد إلى العراق. وإن لم تكن، فأنت من يدفع أي غرامات أو خسائر — لا نحن.",
        zh: "您的货物必须可合法地从中国出口并进口到伊拉克。若非如此，任何罚款或损失由您承担，而非我们。",
      },
      {
        ku: "بارەکانت بە باشی پاکێج بکە، بەتایبەت شتە شکێنراو یان مەترسیدارەکان. ئەگەر پاکێجی خراپ ببێتە هۆی زیان، ئێمە بەرپرس نین.",
        en: "Pack your goods properly, especially fragile or dangerous items. If poor packing causes damage, we are not responsible.",
        ar: "غلّف بضائعك بشكل سليم، خصوصًا الأشياء القابلة للكسر أو الخطرة. وإن تسبب التغليف السيئ بضرر، فلسنا مسؤولين.",
        zh: "妥善包装您的货物，尤其是易碎或危险物品。若因包装不良造成损坏，我们概不负责。",
      },
      {
        ku: "هەموو یاسا گومرگی و یاساییەکانی بارەکەت جێبەجێ بکە.",
        en: "Follow all customs and legal rules for your shipment.",
        ar: "التزم بجميع القواعد الجمركية والقانونية الخاصة بشحنتك.",
        zh: "遵守与您货物相关的所有海关及法律规定。",
      },
      {
        ku: "بارەکانت نابێت براند، لۆگۆ، یان دیزاینی پارێزراوی ساختە بەکاربهێنن بەبێ مۆڵەت. هەر سکاڵایەک لەم بارەیەوە لەسەر تۆیە.",
        en: "Your goods must not use a fake brand, logo, or copyrighted design without permission. Any claims are your responsibility.",
        ar: "يجب ألا تحمل بضائعك علامة تجارية أو شعارًا أو تصميمًا محفوظ الحقوق مزيّفًا دون إذن. وأي مطالبات بهذا الشأن مسؤوليتك.",
        zh: "您的货物不得未经许可使用假冒品牌、标志或受版权保护的设计。任何相关索赔由您负责。",
      },
    ],
  },
  {
    id: "china-warehouse",
    icon: Warehouse,
    gradient: "from-violet-500 to-purple-600",
    title: {
      ku: "وەرگرتنی بار لە کۆگای چین",
      en: "Receiving Goods at Our China Warehouse",
      ar: "استلام البضائع في مستودعنا بالصين",
      zh: "在我们的中国仓库收货",
    },
    items: [
      {
        ku: "بارەکانت تەنها بۆ ناونیشانی فەرمیی کۆگاکەمان لە چین بنێرە.",
        en: "Send your goods only to our official warehouse address in China.",
        ar: "أرسل بضائعك فقط إلى عنوان مستودعنا الرسمي في الصين.",
        zh: "仅将货物寄送至我们在中国的官方仓库地址。",
      },
      {
        ku: "پسووڵەی ئێمە تەنها بەڵگەی دروستە کە بارەکەمان وەرگرتووە.",
        en: "Our receipt is the only valid proof that we received your goods.",
        ar: "إيصالنا هو الدليل الصحيح الوحيد على استلامنا لبضائعك.",
        zh: "我们出具的收据是我们已收到您货物的唯一有效凭证。",
      },
      {
        ku: "لەوانەیە هەر پاکەتێک بکەینەوە و بیپشکنین بۆ مەبەستی سەلامەتی یان گومرگ.",
        en: "We may open and check any package for safety or customs reasons.",
        ar: "قد نفتح أي طرد ونفحصه لأسباب تتعلق بالسلامة أو الجمارك.",
        zh: "出于安全或海关原因，我们可能会打开并检查任何包裹。",
      },
      {
        ku: "ئەگەر پێویست بێت لەوانەیە بارەکەت دووبارە پاکێج بکەینەوە. تێچووی پاکێجکردنەوە و هەر کێشێکی زیادکراو لەسەر تۆیە.",
        en: "We may repack your goods if needed. Repacking costs and any added weight are charged to you.",
        ar: "قد نُعيد تغليف بضائعك عند الحاجة. تُحتسب عليك تكاليف إعادة التغليف وأي وزن مُضاف.",
        zh: "如有需要，我们可能会重新包装您的货物。重新包装的费用及任何增加的重量由您承担。",
      },
      {
        ku: "ئەگەر چەندین شتی بچووک لە یەک کارتۆندا پاکێج کرابن، بۆ تەواوی کێشی کارتۆنەکە پارە دەدەیت.",
        en: "If many small items are packed into one carton, you are charged for the full weight of the carton.",
        ar: "إذا عُبّئت عدة أغراض صغيرة في كرتونة واحدة، تُحتسب عليك الكرتونة بوزنها الكامل.",
        zh: "若多件小物品装入一个纸箱，将按该纸箱的总重量向您收费。",
      },
    ],
  },
  {
    id: "shipping-customs",
    icon: Ship,
    gradient: "from-cyan-500 to-sky-600",
    title: {
      ku: "گواستنەوە و گومرگ",
      en: "Shipping & Customs",
      ar: "الشحن والجمارك",
      zh: "运输与海关",
    },
    items: [
      {
        ku: "ئێمە کۆمپانیای فڕۆکە و هێڵی کەشتی و ڕێگا هەڵدەبژێرین، مەگەر بە نووسراوی لەگەڵت لەسەر بژاردەیەکی دیاریکراو ڕێک بکەوین.",
        en: "We choose the airline, shipping line, and route, unless we agree with you in writing on a specific option.",
        ar: "نحن نختار شركة الطيران وخط الشحن والمسار، ما لم نتفق معك كتابيًا على خيار محدد.",
        zh: "除非我们与您书面约定特定方案，否则由我们选择航空公司、船运公司和路线。",
      },
      {
        ku: "ئێمە وەک بریکاری گومرگیت کار دەکەین لە چین و عێراقدا بۆ دەرکردنی بارەکەت.",
        en: "We act as your customs agent in both China and Iraq to clear your shipment.",
        ar: "نعمل كوكيل جمركي لك في كل من الصين والعراق لتخليص شحنتك.",
        zh: "我们在中国和伊拉克均作为您的报关代理，为您的货物办理清关。",
      },
      {
        ku: "هەموو باج و گومرگ و هەر سزایەکی حکومی لەسەر تۆیە.",
        en: "You pay all customs duties, taxes, and any government fines.",
        ar: "أنت تدفع جميع الرسوم الجمركية والضرائب وأي غرامات حكومية.",
        zh: "所有关税、税费及任何政府罚款均由您支付。",
      },
      {
        ku: "ئێمە بەرپرس نین لە دواکەوتن یان زیان کە بەهۆی پشکنینی گومرگ یان زانیاری هەڵەی تۆوە ڕوویداوە.",
        en: "We are not responsible for delays or losses caused by customs inspections or by wrong information you gave us.",
        ar: "لسنا مسؤولين عن التأخير أو الخسائر الناتجة عن تفتيش الجمارك أو عن معلومات خاطئة قدّمتها لنا.",
        zh: "对于因海关检查或您提供的错误信息造成的延误或损失，我们概不负责。",
      },
    ],
  },
  {
    id: "our-responsibility",
    icon: ShieldCheck,
    gradient: "from-indigo-500 to-blue-600",
    title: {
      ku: "بەرپرسیارێتیمان بۆ بارەکەت",
      en: "Our Responsibility for Your Goods",
      ar: "مسؤوليتنا عن بضائعك",
      zh: "我们对您货物的责任",
    },
    items: [
      {
        ku: "ئەگەر بارەکەت لەکاتی بەدەستەوەبوونیدا لای ئێمە بزر بێت یان زیانی پێبگات، قەرەبووت دەکەینەوە — بەڵام تەنها تا سنوورێکی دیاریکراو.",
        en: "If your goods are lost or damaged while in our care, we will pay you back — but only up to a limit.",
        ar: "إذا فُقدت بضائعك أو تضررت أثناء وجودها في عهدتنا، فسنعوّضك — لكن ضمن حدٍّ أقصى فقط.",
        zh: "若您的货物在我们保管期间丢失或损坏，我们将赔偿您——但仅限于一定上限。",
      },
      {
        ku: "ئەوەی کەمترە دەیدەین: ئەو نرخەی بەڕاستی داوتە (لەسەر پسووڵەی کڕینەکەت)، یان سنووری ئێمە.",
        en: "We pay whichever is lower: the price you actually paid (on your purchase invoice), or our limit.",
        ar: "ندفع الأقل من الاثنين: السعر الذي دفعته فعليًا (على فاتورة الشراء)، أو حدّنا الأقصى.",
        zh: "我们按两者中较低者赔付：您实际支付的价格（以采购发票为准），或我们的上限。",
      },
      {
        ku: "سنووری زۆرینەمان: ٢٥ دۆلار بۆ هەر کیلۆیەک لە بارگەی ئاسمانی، یان ٤٠٠ دۆلار بۆ هەر مەتر سێجایەک لە بارگەی دەریایی.",
        en: "Our maximum limit: $25 per kilogram for air freight, or $400 per cubic meter for sea freight.",
        ar: "حدّنا الأقصى: 25 دولارًا لكل كيلوغرام للشحن الجوي، أو 400 دولار لكل متر مكعب للشحن البحري.",
        zh: "我们的最高上限：空运每公斤 25 美元，海运每立方米 400 美元。",
      },
      {
        ku: "نموونە: شتێکی ٢ کیلۆ کە ٣٠ دۆلاری تێچووە. سنووری ئێمە بۆ ٢ کیلۆ ٥٠ دۆلارە. لەبەرئەوەی ٣٠ دۆلار کەمترە، ٣٠ دۆلارت دەدەینەوە.",
        en: "Example: a 2 kg item that cost $30. Our limit for 2 kg is $50. Since $30 is lower, we pay you $30.",
        ar: "مثال: غرض بوزن 2 كغ كلّف 30 دولارًا. حدّنا لوزن 2 كغ هو 50 دولارًا. وبما أن 30 دولارًا أقل، ندفع 30 دولارًا.",
        zh: "示例：一件 2 公斤、价值 30 美元的物品。2 公斤的上限为 50 美元。由于 30 美元较低，我们赔付 30 美元。",
      },
      {
        ku: "بۆ داواکردنی قەرەبوو، پسووڵەی ڕەسەنی کڕینەکەت بنێرە و لە ماوەی ٧ ڕۆژدا دوای گەیاندن بە نووسراوی پەیوەندیمان پێوە بکە. بەبێ پسووڵە ناتوانین هیچ قەرەبووێک بدەین — تەنانەت ئەگەر بارەکە بەتەواوی بزریش بێت.",
        en: "To claim, send your original purchase invoice and contact us in writing within 7 days of delivery. Without an invoice, we cannot pay — even if the goods are completely lost.",
        ar: "للمطالبة، أرسل فاتورة الشراء الأصلية وتواصل معنا كتابيًا خلال 7 أيام من التسليم. وبدون فاتورة لا يمكننا الدفع — حتى لو فُقدت البضاعة بالكامل.",
        zh: "如需索赔，请提交原始采购发票并在交货后 7 天内以书面形式联系我们。没有发票，我们无法赔付——即使货物完全丢失。",
      },
      {
        ku: "قەرەبوو نادەینەوە بۆ: دواکەوتنی گەیاندن، قازانجی لەدەستچوو، زیانی پاکێجی خراپ، بارە دەستبەسەرکراوەکان لەلایەن گومرگ بەهۆی نایاسایی بوون، یان ڕووداوی دەرەوەی دەسەڵاتمان (جەنگ، کارەسات، مانگرتن، پەتا).",
        en: "We do not pay for: delivery delays, lost profit, damage from poor packing, goods seized by customs for being illegal, or events outside our control (war, disasters, strikes, pandemics).",
        ar: "لا نعوّض عن: تأخير التسليم، أو الأرباح الضائعة، أو الضرر الناتج عن سوء التغليف، أو البضائع التي تصادرها الجمارك لكونها غير قانونية، أو الأحداث الخارجة عن سيطرتنا (حرب، كوارث، إضرابات، أوبئة).",
        zh: "以下情形我们不予赔付：交货延误、利润损失、包装不良造成的损坏、因违法被海关扣押的货物，或我们无法控制的事件（战争、灾害、罢工、疫情）。",
      },
    ],
  },
  {
    id: "insurance",
    icon: Umbrella,
    gradient: "from-fuchsia-500 to-purple-600",
    title: {
      ku: "بیمە",
      en: "Insurance",
      ar: "التأمين",
      zh: "保险",
    },
    items: [
      {
        ku: "ئێمە بە شێوەیەکی خۆکار بارەکەت بیمە ناکەین.",
        en: "We do not automatically insure your goods.",
        ar: "لا نؤمّن على بضائعك تلقائيًا.",
        zh: "我们不会自动为您的货物投保。",
      },
      {
        ku: "ئەگەر بیمەی تەواوت دەوێت، پێش ناردنی بارەکە لە چین بە نووسراوی داوای بکە. کرێیەکی زیادە دەبێت.",
        en: "If you want full insurance, request it in writing before we ship your goods from China. An extra fee applies.",
        ar: "إن أردت تأمينًا كاملًا، فاطلبه كتابيًا قبل شحن بضائعك من الصين. وتُطبَّق رسوم إضافية.",
        zh: "如需全额保险，请在我们从中国发货前以书面形式提出申请。将收取额外费用。",
      },
    ],
  },
  {
    id: "prices-payment",
    icon: Wallet,
    gradient: "from-green-500 to-emerald-600",
    title: {
      ku: "نرخ و پارەدان",
      en: "Prices & Payment",
      ar: "الأسعار والدفع",
      zh: "价格与付款",
    },
    items: [
      {
        ku: "نرخەکان لەکاتی گواستنەوەدا دیاری دەکرێن و لەگەڵ بازاڕ دەگۆڕێن.",
        en: "Prices are set at the time of shipping and may change with the market.",
        ar: "تُحدَّد الأسعار وقت الشحن وقد تتغيّر حسب السوق.",
        zh: "价格在发货时确定，并可能随市场变化。",
      },
      {
        ku: "بارگەی ئاسمانی بەپێی کێشی ڕاستەقینە یان کێشی قەبارەیی حیساب دەکرێت، ئەوەی گەورەترە (کەمترین ١ کیلۆ).",
        en: "Air freight is charged by actual or volumetric weight, whichever is greater (minimum 1 kg).",
        ar: "يُحتسب الشحن الجوي بالوزن الفعلي أو الحجمي، أيهما أكبر (بحد أدنى 1 كغ).",
        zh: "空运按实际重量或体积重量中的较大者计费（最低 1 公斤）。",
      },
      {
        ku: "بارگەی دەریایی بەپێی قەبارە حیساب دەکرێت (کەمترین ٠.٢٥ مەتر سێجا).",
        en: "Sea freight is charged by volume (minimum 0.25 CBM).",
        ar: "يُحتسب الشحن البحري بالحجم (بحد أدنى 0.25 متر مكعب).",
        zh: "海运按体积计费（最低 0.25 立方米）。",
      },
      {
        ku: "پسووڵەکان لەوانەیە بە دۆلار، یوان، یان دیناری عێراقی دەربکرێن.",
        en: "Invoices may be issued in USD, CNY, or IQD.",
        ar: "قد تُصدَر الفواتير بالدولار الأمريكي أو اليوان الصيني أو الدينار العراقي.",
        zh: "发票可能以美元、人民币或伊拉克第纳尔开具。",
      },
      {
        ku: "کرێی گواستنەوەی بانکی لەسەر تۆیە.",
        en: "Bank transfer fees are your responsibility.",
        ar: "رسوم التحويل البنكي على عاتقك.",
        zh: "银行转账费用由您承担。",
      },
      {
        ku: "دەبێت هەموو پارەکان بەتەواوی بدرێن پێش ئەوەی بارەکەت ئازاد بکرێت.",
        en: "All charges must be paid in full before your goods are released.",
        ar: "يجب سداد جميع الرسوم بالكامل قبل الإفراج عن بضائعك.",
        zh: "在放行您的货物之前，必须全额支付所有费用。",
      },
      {
        ku: "ئەگەر بارەکە لە ماوەی ٣٠ ڕۆژدا وەرنەگیرا یان پارەکەی نەدرا، لەوانەیە بیفرۆشین بۆ داپۆشینی بڕە نەدراوەکە.",
        en: "If goods are not collected or paid for within 30 days, we may sell them to cover the unpaid amount.",
        ar: "إذا لم تُستلَم البضائع أو يُدفع ثمنها خلال 30 يومًا، فقد نبيعها لتغطية المبلغ غير المدفوع.",
        zh: "若货物在 30 天内未被提取或付款，我们可能将其出售以抵偿未付款项。",
      },
    ],
  },
  {
    id: "delivery-iraq",
    icon: Truck,
    gradient: "from-orange-500 to-amber-600",
    title: {
      ku: "گەیاندن لە عێراق",
      en: "Delivery in Iraq",
      ar: "التسليم في العراق",
      zh: "在伊拉克的配送",
    },
    items: [
      {
        ku: "ئێمە یەک لقمان هەیە، لە هەولێر. لەوێوە، بۆ کڕیاران لە هەر شوێنێکی عێراق دەگەیەنین.",
        en: "We have one branch, in Erbil. From there, we deliver to customers anywhere in Iraq.",
        ar: "لدينا فرع واحد في أربيل. ومن هناك نُوصِل للعملاء في أي مكان في العراق.",
        zh: "我们在埃尔比勒设有一个分支机构。我们从那里向伊拉克各地的客户配送。",
      },
      {
        ku: "پێش واژووکردن بارەکەت بپشکنە و بیژمێرە. کاتێک واژوو دەکەیت، بارەکە وەک وەرگیراو قبوڵ دەکرێت، و ناتوانین دواتر هیچ سکاڵایەک بۆ شتی کەمبوو یان زیانلێکەوتوو وەربگرین.",
        en: "Check and count your goods before signing. Once you sign, goods are accepted as received, and we cannot accept later claims for missing or damaged items.",
        ar: "افحص بضائعك وعُدّها قبل التوقيع. فبمجرد توقيعك، تُعتبر البضاعة مستلمة، ولا يمكننا قبول أي مطالبات لاحقة عن نقص أو تلف.",
        zh: "签收前请检查并清点您的货物。一旦签字，即视为货物已接收，之后我们无法受理任何缺失或损坏的索赔。",
      },
      {
        ku: "ئەگەر بارەکە لە ماوەی ٤ ڕۆژدا دوای گەیشتن وەرنەگیرا، کرێی خەزنکردنی ڕۆژانە دەبێت.",
        en: "If goods are not collected within 4 days of arrival, daily storage fees apply.",
        ar: "إذا لم تُستلَم البضائع خلال 4 أيام من وصولها، تُطبَّق رسوم تخزين يومية.",
        zh: "若货物在到达后 4 天内未被提取，将收取每日仓储费。",
      },
      {
        ku: "بارە وەرنەگیراو یان قەدەغەکراوەکان لەوانەیە دوای ٧ ڕۆژ ئاگادارکردنەوەی نووسراوی بفرۆشرێن.",
        en: "Uncollected or prohibited goods may be sold after 7 days' written notice.",
        ar: "قد تُباع البضائع غير المستلَمة أو المحظورة بعد إشعار كتابي مدته 7 أيام.",
        zh: "未提取或被禁运的货物，可能在发出为期 7 天的书面通知后被出售。",
      },
    ],
  },
  {
    id: "prohibited-items",
    icon: Ban,
    gradient: "from-red-500 to-rose-600",
    title: {
      ku: "کەلوپەلی قەدەغە و سنووردار",
      en: "Prohibited & Restricted Items",
      ar: "البضائع المحظورة والمقيّدة",
      zh: "禁运及受限物品",
    },
    items: [
      {
        ku: "نابێت بنێریت: چەک، تەقەمەنی، مادەی هۆشبەر، ئەلکهول، جگەرە، پارەی کاش، خشڵ، کانزای بەنرخ، ئاژەڵ یان ڕووەکی زیندوو، مادەی کیمیایی مەترسیدار، یان هەر شتێک نیشانەی ڕەچەڵەکی ساختەی هەبێت.",
        en: "You may not send: weapons, explosives, drugs, alcohol, tobacco, cash, jewelry, precious metals, live animals or plants, hazardous chemicals, or any item with a fake origin label.",
        ar: "لا يجوز إرسال: أسلحة، متفجرات، مخدرات، كحول، تبغ، نقود، مجوهرات، معادن ثمينة، حيوانات أو نباتات حية، مواد كيميائية خطرة، أو أي غرض يحمل بطاقة منشأ مزيّفة.",
        zh: "不得寄送：武器、爆炸物、毒品、酒类、烟草、现金、珠宝、贵金属、活体动植物、危险化学品，或任何带有虚假原产地标签的物品。",
      },
      {
        ku: "هەندێک شت — پاتری، موگناتیس، شلە، جوانکاری، خۆراک، تەواوکەر، دەرمان — تەنها بە مۆڵەتی نووسراوی پێشوەخت ڕێگەپێدراون.",
        en: "Some items — batteries, magnets, liquids, cosmetics, food, supplements, medicine — are allowed only with prior written approval.",
        ar: "بعض الأغراض — البطاريات، المغناطيس، السوائل، مستحضرات التجميل، الأطعمة، المكمّلات، الأدوية — مسموحة فقط بموافقة كتابية مسبقة.",
        zh: "某些物品——电池、磁铁、液体、化妆品、食品、保健品、药品——仅在事先获得书面批准后方可寄送。",
      },
      {
        ku: "لیستی تەواو بە داواکردن بەردەستە.",
        en: "A full list is available on request.",
        ar: "تتوفّر قائمة كاملة عند الطلب.",
        zh: "如有需要，可索取完整清单。",
      },
    ],
  },
  {
    id: "buying-on-behalf",
    icon: ShoppingBag,
    gradient: "from-pink-500 to-rose-600",
    title: {
      ku: "کڕین لە جیاتی تۆ",
      en: "Buying on Your Behalf",
      ar: "الشراء نيابةً عنك",
      zh: "代您采购",
    },
    items: [
      {
        ku: "ئەگەر بارت بۆ بکڕین لە فرۆشیارێک لە چین، ئێمە تەنها وەک بریکاری کڕینت کار دەکەین.",
        en: "If we buy goods for you from a supplier in China, we act only as your purchasing agent.",
        ar: "إذا اشترينا لك بضائع من مورّد في الصين، فنحن نعمل فقط كوكيل شراء لك.",
        zh: "若我们从中国供应商为您采购货物，我们仅作为您的采购代理。",
      },
      {
        ku: "تۆ بەرپرسیت لە هەڵبژاردنی بەرهەم و پشکنینی کوالیتیەکەی.",
        en: "You are responsible for choosing the product and checking its quality.",
        ar: "أنت المسؤول عن اختيار المنتج والتحقق من جودته.",
        zh: "您负责选择产品并检查其质量。",
      },
      {
        ku: "هەر کێشەیەکی کوالیتی بەرهەم لەنێوان تۆ و فرۆشیارەکەیە — ئێمە تەنها بەرپرسین لە پرۆسەی کڕین و گواستنەوە.",
        en: "Any product quality issue is between you and the supplier — we are only responsible for the purchase and shipping process.",
        ar: "أي مشكلة في جودة المنتج تكون بينك وبين المورّد — نحن مسؤولون فقط عن عملية الشراء والشحن.",
        zh: "任何产品质量问题由您与供应商之间解决——我们仅对采购和运输流程负责。",
      },
    ],
  },
  {
    id: "privacy-legal",
    icon: Scale,
    gradient: "from-slate-500 to-slate-700",
    title: {
      ku: "پاراستنی داتا و مەرجە یاساییەکان",
      en: "Data Privacy & Legal Terms",
      ar: "خصوصية البيانات والشروط القانونية",
      zh: "数据隐私与法律条款",
    },
    items: [
      {
        ku: "زانیاری بارەکەت تەنها بەقەدەر پێویست بۆ تەواوکردنی بارەکە لەگەڵ گومرگ و گواستنەوەکاران و بریکاران هاوبەش دەکەین، بەپێی یاساکانی پاراستنی داتا.",
        en: "We share your shipment info with customs, carriers, and agents only as needed to complete your shipment, following data protection laws.",
        ar: "نشارك معلومات شحنتك مع الجمارك والناقلين والوكلاء بالقدر اللازم لإتمام شحنتك فقط، وفقًا لقوانين حماية البيانات.",
        zh: "我们仅在完成您货物所需的范围内，依据数据保护法律，与海关、承运人和代理共享您的货物信息。",
      },
      {
        ku: "ئەگەر ناکۆکییەک ڕوویدا، سەرەتا هەوڵدەدەین ڕاستەوخۆ لەگەڵ تۆ چارەسەری بکەین. ئەگەر سەرکەوتوو نەبوو، بەپێی یاساکانی ئەو وڵاتەی ناکۆکییەکەی تێدا ڕوودەدات مامەڵەی لەگەڵ دەکرێت.",
        en: "If a dispute arises, we first try to resolve it directly with you. If that fails, it is handled under the laws of the country where the dispute occurs.",
        ar: "إذا نشأ نزاع، نحاول أولًا حلّه معك مباشرة. وإن تعذّر ذلك، يُعالَج وفقًا لقوانين البلد الذي يقع فيه النزاع.",
        zh: "若发生争议，我们首先尝试与您直接解决。若无法解决，则依据争议发生地所在国家的法律处理。",
      },
      {
        ku: "ئەم مەرجانە ڕێککەوتنی تەواون. ئەگەر هەر بەشێکیان نادروست دەرکەوت، بەشەکانی تر بەردەوام دەبن لەسەر کاریگەری.",
        en: "These Terms are the complete agreement. If any part is found invalid, the rest remains valid.",
        ar: "هذه الشروط هي الاتفاق الكامل. وإن وُجد أي جزء منها باطلًا، يبقى الباقي ساريًا.",
        zh: "本条款构成完整协议。若任何部分被认定无效，其余部分仍然有效。",
      },
    ],
  },
];
