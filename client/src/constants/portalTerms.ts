// Wazn Express — customer-facing Terms & Conditions content, in all four UI
// languages (ku / en / ar / zh). Rendered by
// client/src/pages/portal/PortalTerms.tsx. Each item is tappable and opens a
// pre-filled WhatsApp chat asking for clarification on that point.
//
// Every point is written as a request rather than an order, and each one names
// the party it binds. Points come in pairs: something asked of the customer,
// then the matching commitment from the company. A customer reading the page
// should be able to see the balance, not just be told about it.
import {
  Building2,
  Handshake,
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

/** Who a point binds — the customer, or Wazn Express. */
export type TermsParty = "you" | "us";

export interface TermsItem {
  party: TermsParty;
  text: L10n;
}

export interface TermsSection {
  id: string;
  icon: LucideIcon;
  /** Tailwind gradient utility classes for the section header bar. */
  gradient: string;
  title: L10n;
  items: TermsItem[];
}

/** WhatsApp support number in international (wa.me) format: +964 770 918 3535. */
export const TERMS_WHATSAPP_NUMBER = "9647709183535";

/** Badge text beside each point. */
export const termsPartyLabel: Record<TermsParty, L10n> = {
  you: { ku: "تۆ", en: "You", ar: "أنت", zh: "您" },
  us: { ku: "ئێمە", en: "Us", ar: "نحن", zh: "我们" },
};

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
    ku: "بەڵێنی نێوان تۆ و وەزن ئێکسپرێس",
    en: "What you and Wazn Express promise each other",
    ar: "ما نتعهّد به أنت ووزن إكسبريس لبعضنا",
    zh: "您与 Wazn Express 之间的相互承诺",
  } as L10n,
  tapTip: {
    ku: "کلیک لەسەر هەر خاڵێک بکە بۆ پرسیارکردنی لە واتساپ",
    en: "Tap any point to ask about it on WhatsApp",
    ar: "اضغط على أي نقطة للاستفسار عنها عبر واتساب",
    zh: "点击任意条款即可通过 WhatsApp 咨询",
  } as L10n,
  consent: {
    ku: "سوپاس بۆ متمانەت. بەکارهێنانی خزمەتگوزارییەکانمان واتە ڕازیبوونت بەم مەرجانە — و بەڵێنی ئێمە بەرامبەرت.",
    en: "Thank you for your trust. Using our services means you accept these terms — and our promises to you.",
    ar: "شكرًا لثقتك. استخدام خدماتنا يعني موافقتك على هذه الشروط — وعلى تعهّداتنا تجاهك.",
    zh: "感谢您的信任。使用我们的服务即表示您接受本条款，以及我们对您的承诺。",
  } as L10n,
  updated: {
    ku: "دوایین نوێکردنەوە: ٢٠٢٦/٠٧/٣١",
    en: "Last updated: 2026/07/31",
    ar: "آخر تحديث: 2026/07/31",
    zh: "最后更新：2026/07/31",
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
        party: "us",
        text: {
          ku: "بەخێربێیت بۆ وەزن ئێکسپرێس. ئێمە کۆمپانیایەکی گواستنەوەی بار و بریکاری لۆجستیکین، ناوەندمان لە هەولێری هەرێمی کوردستانی عێراقە، و دڵخۆشین کە متمانەت پێماندا.",
          en: "Welcome to Wazn Express. We are a freight forwarder and logistics agent based in Erbil, Kurdistan Region of Iraq, and we are glad you have placed your trust in us.",
          ar: "أهلًا بك في وزن إكسبريس. نحن شركة شحن ووكيل لوجستي مقرّها أربيل في إقليم كوردستان العراق، ويسعدنا أنك منحتنا ثقتك.",
          zh: "欢迎来到 Wazn Express。我们是一家货运代理与物流代理公司，总部位于伊拉克库尔德斯坦地区埃尔比勒，很高兴获得您的信任。",
        },
      },
      {
        party: "us",
        text: {
          ku: "بارەکانت لە چینەوە بۆ عێراق دەگوازینەوە لە ڕێگەی کۆمپانیای فڕۆکە و هێڵی کەشتی و بریکاری گومرگی متمانەپێکراوەوە، و لە هەموو قۆناغێکدا شوێنی بارەکەت هەڵدەگرین تاوەکو دەگاتە دەستت.",
          en: "We move your goods from China to Iraq through trusted airlines, shipping lines, and customs brokers, and we keep track of your shipment at every stage until it reaches you.",
          ar: "ننقل بضائعك من الصين إلى العراق عبر شركات طيران وخطوط شحن ووسطاء جمارك موثوقين، ونتابع شحنتك في كل مرحلة حتى تصل إليك.",
          zh: "我们通过值得信赖的航空公司、船运公司和报关行，将您的货物从中国运至伊拉克，并在每个环节跟踪，直至送达您手中。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئێمە خۆمان ڕاستەوخۆ لەگەڵ هێڵی فڕۆکەوانی یان هێڵی کەشتی وەک بریکار لەسەر هێڵ دەبین. ئەرکی ئێمە ئەوەیە هەموو ئەم پرۆسە ئاڵۆزە لە جیاتی تۆ بەڕێوەببەین — تۆ خەریکی بازرگانییەکەی خۆت بە، گەیاندنەکە بەئێمە بسپێرە.",
          en: "We deal directly with the airlines and shipping lines as their agent. Our job is to run this whole complex process on your behalf — you get on with your business, and leave the shipping to us.",
          ar: "نتعامل مباشرةً مع شركات الطيران وخطوط الشحن بصفتنا وكيلًا لديها. مهمّتنا أن ندير هذه العملية المعقّدة نيابةً عنك — انشغل أنت بتجارتك، واترك الشحن لنا.",
          zh: "我们作为代理直接与航空公司和船运公司对接。我们的工作是代您处理这一整套复杂流程——您专注于自己的生意，运输交给我们。",
        },
      },
    ],
  },
  {
    id: "mutual-commitments",
    icon: Handshake,
    gradient: "from-emerald-500 to-teal-600",
    title: {
      ku: "بەڵێنی نێوانمان",
      en: "Our Commitments to Each Other",
      ar: "التزاماتنا المتبادلة",
      zh: "我们彼此的承诺",
    },
    items: [
      {
        party: "you",
        text: {
          ku: "تکایە زانیاری بارەکەت پێمان بڵێ: وەسف، نرخ، کێش و قەبارە. ئەمە یارمەتیمان دەدات بۆ هەڵسەنگاندنی سەرەتایی لە ڕووی نرخ و ئامادەکاری.",
          en: "Please tell us about your goods: description, value, weight, and size. This lets us give you an initial estimate and prepare properly.",
          ar: "أخبرنا رجاءً عن بضائعك: الوصف والقيمة والوزن والحجم. يساعدنا ذلك على إعطائك تقديرًا أوّليًا والاستعداد جيدًا.",
          zh: "请告诉我们您的货物信息：描述、价值、重量和尺寸。这样我们才能给出初步估价并做好准备。",
        },
      },
      {
        party: "us",
        text: {
          ku: "هەر کات بارەکانت گەیشتنە کۆگاکانی ئێمە لە چین، دووبارە پرۆسەی کێش و قەبارەی دروستی بۆ دەکرێت بەپێی ستانداردی جیهانی کە هێڵی گواستنەوەی ئاسمانی و دەریایی پەیڕەوی دەکەن.",
          en: "Once your goods reach our warehouse in China, we weigh and measure them again properly, using the international standard that the air and sea lines themselves apply.",
          ar: "وحين تصل بضائعك إلى مستودعنا في الصين، نعيد وزنها وقياسها بدقّة وفق المعيار الدولي الذي تعتمده خطوط الشحن الجوي والبحري نفسها.",
          zh: "货物抵达我们中国仓库后，我们会按照航空和海运公司采用的国际标准重新准确称重和量方。",
        },
      },
      {
        party: "you",
        text: {
          ku: "تکایە دڵنیابە کاڵاکانت ڕێگەپێدراون بۆ هەناردەکردن لە چین و هاوردەکردن بۆ عێراق. ئەگەر دڵنیا نەبوویت، پێش کڕین پرسیارمان لێ بکە — ئێمە لێرەین بۆ ئەوە.",
          en: "Please make sure your goods are allowed to leave China and enter Iraq. If you are unsure, ask us before you buy — that is what we are here for.",
          ar: "تأكّد رجاءً من أن بضائعك مسموح بتصديرها من الصين واستيرادها إلى العراق. وإن لم تكن متأكّدًا، اسألنا قبل الشراء — فنحن هنا لهذا.",
          zh: "请确认您的货物可以合法出口中国并进口伊拉克。如不确定，请在购买前咨询我们——这正是我们存在的意义。",
        },
      },
      {
        party: "us",
        text: {
          ku: "لە لای خۆمانەوە، ئەگەر پێش کڕین و ناردنی کاڵا بە ناردنی زانیاری و وێنە ئاگادارمان بکەیتەوە لەسەر دۆخی یاسایی بوونی کاڵاکە، تیمی ئێمە ڕوونکردنەوەیەکی دڵنیاکەرەوەت پێدەبەخشێت. بەڵام هەر بارێک نایاسایی بێت، یان شتێکی شاراوەی نایاسایی تێدا بێت، بەدوای لێبوردنەوە ئێمە بەرپرس نین لە هیچ لێپرسینەوەیەکی یاسایی و دارایی و ئاسایشی.",
          en: "For our part, if you send us details and photos before buying and shipping, our team will give you a clear answer on whether the item is allowed. But if a shipment turns out to be illegal, or hides something illegal inside, then with our apologies we cannot carry the legal, financial, or security consequences.",
          ar: "ومن جانبنا، إن أرسلت لنا التفاصيل والصور قبل الشراء والشحن، فسيمنحك فريقنا إجابة واضحة عن مدى قانونية الغرض. لكن إن تبيّن أن الشحنة غير قانونية، أو أنها تُخفي شيئًا غير قانوني، فمع اعتذارنا لا نتحمّل أي تبعات قانونية أو مالية أو أمنية.",
          zh: "在我们这边，若您在购买和发货前把详情和照片发给我们，我们的团队会明确答复该物品是否允许寄运。但如果货物本身违法，或内藏违法物品，我们很抱歉无法承担由此产生的法律、财务和安全责任。",
        },
      },
      {
        party: "you",
        text: {
          ku: "باشترین کار ئەوەیە داوا لە فرۆشیارەکەت بکەیت کەل و پەلەکانت بە ڕێکی پاکێج بکات و بنێرێت — پاکێجی باش لە سەرچاوەوە باشترین پاراستنی بارەکەتە.",
          en: "The best thing you can do is ask your supplier to pack and send your items properly — good packing at source is the best protection your shipment can have.",
          ar: "أفضل ما يمكنك فعله هو أن تطلب من المورّد تغليف أغراضك وإرسالها بشكل سليم — فالتغليف الجيّد من المصدر هو أفضل حماية لشحنتك.",
          zh: "您能做的最好一件事，就是要求供应商妥善包装并寄出——源头的良好包装是货物最好的保护。",
        },
      },
      {
        party: "us",
        text: {
          ku: "کاتێ بارەکەت گەیشتە کۆگاکەمان، کارمەندانی کۆگا بەقەدەر توانا پشکنینی بۆ دەکەن. ئەگەر پاکێجەکەی لاواز بوو ئاگادارت دەکەینەوە و پێش ناردن پێشنیاری پاکێجکردنەوەت بۆ دەکەین — تێچووی پاکێجکردنەوە دەکەوێتە سەر بەڕێزتان. مەبەستمان ئەوەیە زیانەکە پێش ڕوودان ڕێگری لێ بکەین، نەک دوای ڕوودانی باسی بکەین.",
          en: "When your goods reach our warehouse, our staff check them as far as they can. If the packing looks weak we will tell you and suggest repacking before shipping — the repacking cost is yours. Our aim is to prevent the damage, not to explain it afterwards.",
          ar: "وحين تصل بضاعتك إلى مستودعنا، يفحصها موظفونا قدر المستطاع. فإن بدا التغليف ضعيفًا أبلغناك واقترحنا إعادة التغليف قبل الشحن — وتكون تكلفة إعادة التغليف عليك. هدفنا منع الضرر قبل وقوعه، لا شرحه بعده.",
          zh: "货物到达我们仓库后，仓库人员会尽力检查。若包装看起来薄弱，我们会通知您并建议在发货前重新包装——重新包装的费用由您承担。我们的目的是防患于未然，而不是事后解释。",
        },
      },
      {
        party: "you",
        text: {
          ku: "تکایە ئەو بەڵگەنامانەی داوای دەکەین (پسووڵەی کڕین، وەسفی کاڵا) بەخێرایی بۆمان بنێرە. هەرچەندە زووتر بێت، بارەکەت خێراتر لە گومرگ دەردەچێت.",
          en: "Please send us the documents we ask for (purchase invoice, item description) as quickly as you can. The sooner they arrive, the faster your shipment clears customs.",
          ar: "أرسل لنا رجاءً المستندات التي نطلبها (فاتورة الشراء، وصف البضاعة) بأسرع وقت. فكلّما وصلت أبكر، خرجت شحنتك من الجمارك أسرع.",
          zh: "请尽快把我们索要的文件（采购发票、货物描述）发给我们。文件到得越早，您的货物清关就越快。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئێمە پرۆسەی گومرگ لە چین و عێراق بۆ تۆ بەڕێوەدەبەین، و هەموو ئەو بەڵگەنامانەت بۆ ئامادە دەکەین — پێویست ناکات خۆت ڕووبەڕووی هیچ ڕێوشوێنێکی ئیداری ببیتەوە.",
          en: "We handle the customs process for you in both China and Iraq, and prepare all the paperwork — you never have to deal with the bureaucracy yourself.",
          ar: "نتولّى عنك إجراءات الجمارك في الصين والعراق، ونُعدّ كل المستندات — فلا تحتاج أن تواجه أي روتين إداري بنفسك.",
          zh: "中国和伊拉克两地的清关流程都由我们代办，所有文件我们准备——您无需亲自面对任何行政手续。",
        },
      },
      {
        party: "you",
        text: {
          ku: "کاڵای براندی ساختە (کۆپی) لە گومرگ زۆر بەئاسانی دەناسرێتەوە. تکایە پێش کڕین سەرنج بدە کە لۆگۆ یان دیزاینی پارێزراوی بەبێ مۆڵەت لەسەر نەبێت — ئەمە پاراستنی پارەکەی خۆتە پێش هەموو شتێک.",
          en: "Counterfeit branded goods are spotted very easily at customs. Please check before buying that there is no logo or protected design used without permission — this protects your own money first of all.",
          ar: "البضائع ذات العلامات المقلّدة تُكتشف بسهولة شديدة في الجمارك. تحقّق رجاءً قبل الشراء من خلوّها من أي شعار أو تصميم محميّ مستخدَم دون إذن — فهذا يحمي مالك أنت قبل كل شيء.",
          zh: "仿冒品牌商品在海关极易被识别。请在购买前确认没有未经许可使用的标志或受保护设计——这首先是在保护您自己的钱。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئێمە ناتوانین بەڵێنی پشکنینی هەموو پاکەتێک بدەین، چونکە ڕۆژانە هەزاران پاکەت بەناو کۆگاکاندا تێدەپەڕن. ئەگەر شتێکمان بەرچاو کەوت، پێش ناردن ئاگادارت دەکەینەوە؛ بەڵام باشترین پاراستن ئەوەیە خۆت لە کاتی کڕیندا زۆر وریا بیت و خۆت لە زیانی یاسایی و دارایی بەدوور بگریت.",
          en: "We cannot promise to check every single package — thousands pass through our warehouses every day. If something catches our eye we will tell you before shipping; but the best protection is your own care at the moment of buying, keeping yourself clear of legal and financial trouble.",
          ar: "لا يمكننا أن نَعِد بفحص كل طرد — فآلاف الطرود تمرّ عبر مستودعاتنا يوميًا. وإن لفت انتباهنا شيء أبلغناك قبل الشحن؛ لكن أفضل حماية هي انتباهك أنت لحظة الشراء، وأن تُبعد نفسك عن أي ضرر قانوني أو مالي.",
          zh: "我们无法承诺检查每一个包裹——每天有数千件经过我们的仓库。若发现异常，我们会在发货前告知您；但最好的保护，是您在购买时格外谨慎，让自己远离法律和财务风险。",
        },
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
        party: "you",
        text: {
          ku: "تکایە بارەکانت تەنها بۆ ئەو ناونیشانە بنێرە کە لە پرۆفایلی خۆت لە پۆرتاڵدا بۆت دانراوە، لەگەڵ کۆدی تایبەتی خۆت. هەمیشە پێش ناردنی کەل و پەلەکانت ناونیشانەکە بپشکنە و لەگەڵمان لەسەر هێڵ بە، چونکە لەوانەیە ناونیشان بگۆڕێت.",
          en: "Please send your goods only to the address shown in your portal profile, together with your own code. Always check the address before sending and stay in touch with us, because the address may change.",
          ar: "أرسل بضائعك رجاءً إلى العنوان الظاهر في ملفّك على البوابة فقط، مع رمزك الخاص. وتحقّق دائمًا من العنوان قبل الإرسال وابقَ على تواصل معنا، فقد يتغيّر العنوان.",
          zh: "请仅将货物寄到您门户资料中显示的地址，并附上您的专属代码。寄件前请务必核对地址并与我们保持联系，因为地址可能变更。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئەو ناونیشانە هەر بۆ خۆت تۆمار کراوە، و کۆدەکەت وا دەکات هەر پاکەتێک بگات ڕاستەوخۆ بە ناوی تۆوە تۆمار بکرێت. ئەگەر ناونیشانی کۆگا بگۆڕێت، پێشوەخت لە پۆرتاڵ و لە واتساپ ئاگادارت دەکەینەوە.",
          en: "That address is registered to you, and your code means every parcel that arrives is logged straight to your name. If the warehouse address changes, we will tell you in advance in the portal and on WhatsApp.",
          ar: "ذلك العنوان مسجَّل باسمك، ورمزك يجعل كل طرد يصل يُسجَّل مباشرةً باسمك. وإن تغيّر عنوان المستودع، سنُبلغك مسبقًا عبر البوابة وواتساب.",
          zh: "该地址是为您专门登记的，您的代码可确保每件到达的包裹直接记到您名下。若仓库地址变更，我们会提前在门户和 WhatsApp 上通知您。",
        },
      },
      {
        party: "us",
        text: {
          ku: "هەر کات پاکەتێکت گەیشتە کۆگاکەمان، دەستبەجێ لە پۆرتاڵەکەتدا تۆماری دەکەین و ئاگادارت دەکەینەوە. ئەو تۆمارە بەڵگەی فەرمیی ئێمەیە کە بارەکەمان وەرگرتووە.",
          en: "As soon as a parcel of yours reaches our warehouse, we log it in your portal and notify you. That record is our official proof that we received it.",
          ar: "وحالما يصل طردك إلى مستودعنا، نُسجّله في بوابتك ونُبلغك. وهذا السجل هو دليلنا الرسمي على استلامه.",
          zh: "您的包裹一到我们仓库，我们就会在您的门户中登记并通知您。该记录就是我们已收货的正式凭证。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر فرۆشیارەکەت وتی بارەکە گەیشتووە بەڵام لە پۆرتاڵەکەتدا نەیبینی، تکایە دەستبەجێ پەیوەندیمان پێوە بکە — بەم شێوەیە زوو بۆت بەدوایدا دەگەڕێین.",
          en: "If your supplier says the parcel has arrived but you cannot see it in your portal, please contact us straight away — then we can start looking for it early.",
          ar: "إن قال المورّد إن الطرد وصل ولم تجده في بوابتك، تواصل معنا فورًا رجاءً — عندها نبدأ البحث عنه مبكّرًا.",
          zh: "如果供应商说包裹已到，但您在门户中看不到，请立即联系我们——这样我们可以尽早为您查找。",
        },
      },
      {
        party: "us",
        text: {
          ku: "بۆ پاراستنی سەلامەتی هەموو بارەکان و بۆ ڕێکخستنی کاغەزی گومرگ، لەوانەیە پێویست بێت پاکەتێک بکەینەوە و پشکنینی بکەین. ئەمە بەشێکە لە کاری هەموو کۆگایەکی گواستنەوە لە جیهاندا، و بە ڕێزەوە لەگەڵ کەلوپەلەکانت هەڵسوکەوت دەکەین.",
          en: "To keep every shipment safe and to get the customs paperwork right, we may need to open and inspect a package. This is part of the work of every freight warehouse in the world, and we handle your belongings with respect.",
          ar: "حفاظًا على سلامة كل الشحنات ولإتمام مستندات الجمارك بشكل صحيح، قد نحتاج إلى فتح طرد وفحصه. وهذا جزء من عمل كل مستودع شحن في العالم، ونتعامل مع أغراضك باحترام.",
          zh: "为保障所有货物的安全并正确办理报关文件，我们可能需要开箱查验。这是全世界每一家货运仓库的常规工作，我们会尊重地对待您的物品。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر شتێکی هەستیارت هەیە یان نایەوێت بکرێتەوە، تکایە پێشوەخت پێمان بڵێ تاوەکو ڕێگایەکی گونجاوی بۆ بدۆزینەوە.",
          en: "If you have something sensitive, or you would rather it were not opened, please tell us in advance so we can find a suitable arrangement.",
          ar: "إن كان لديك شيء حسّاس أو تفضّل ألّا يُفتح، أخبرنا مسبقًا رجاءً لنجد ترتيبًا مناسبًا.",
          zh: "如果您有敏感物品，或不希望被打开，请提前告知我们，以便安排合适的处理方式。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئەگەر چەند پاکەتێکت پێکەوە هەبوو، بەبێ کرێی زیادە یەکیان دەخەین بۆ ئەوەی قەبارەکە کەم بێتەوە و کرێی گواستنەوەت کەمتر بێت. ئەگەر پاکێجکردنەوەیەکی تایبەت پێویست بوو کە تێچووی هەبێت، پێشوەخت نرخەکەت پێ دەڵێین و بەبێ ڕەزامەندی تۆ ناینێرین.",
          en: "If you have several parcels together, we combine them at no extra charge so the volume drops and your freight costs less. If special repacking is needed that carries a cost, we tell you the price first and never ship without your agreement.",
          ar: "إن كان لديك عدّة طرود معًا، نجمعها دون رسوم إضافية ليقلّ الحجم وتقلّ كلفة الشحن. وإن لزمت إعادة تغليف خاصّة لها تكلفة، نُخبرك بالسعر أولًا ولا نشحن دون موافقتك.",
          zh: "如果您有多个包裹，我们会免费合并，以减小体积、降低您的运费。若需要产生费用的特殊重新包装，我们会先告知价格，未经您同意绝不发货。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر پێت باشە پاکەتەکانت جیا بمێننەوە، تەنها پێمان بڵێ و وا دەکەین.",
          en: "If you would rather your parcels stayed separate, just tell us and we will keep them that way.",
          ar: "وإن كنت تفضّل بقاء طرودك منفصلة، أخبرنا فقط وسنفعل.",
          zh: "如果您希望包裹保持独立，只需告诉我们，我们照办。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر چەندین شتی بچووکت لە یەک کارتۆندا هەبوو، تکایە لەبیرت بێت کرێی گواستنەوە بەپێی کارتۆنی تەواو حیساب دەکرێت، نەک بەپێی ژمارەی ئەو شتانەی ناوی. لە هێڵی ئاسمانیدا هەمیشە گەورەترین لە نێوان کێشی ڕاستەقینە و کێشی قەبارەیی حیساب دەکرێت — بۆ نموونە ئەگەر بارێک کێشی ٥ کیلۆ بێت بەڵام کێشی قەبارەیی ١٠ کیلۆ بێت، ئەوا ١٠ کیلۆ حیساب دەکرێت. تکایە پێش ناردن لەسەر کێش و قەبارەی بارەکەت لەگەڵمان لەسەر هێڵ بە.",
          en: "If you have many small items in one carton, please remember that freight is charged on the full carton, not on how many items are inside. For air freight the greater of actual and volumetric weight always applies — for example, a shipment weighing 5 kg but measuring 10 kg volumetric is charged as 10 kg. Please talk to us about weight and size before sending.",
          ar: "إن كان لديك عدّة أغراض صغيرة في كرتونة واحدة، فتذكّر رجاءً أن الشحن يُحتسب على الكرتونة كاملة، لا على عدد الأغراض داخلها. وفي الشحن الجوي يُعتمد دائمًا الأكبر بين الوزن الفعلي والوزن الحجمي — فمثلًا شحنة وزنها 5 كغ لكن وزنها الحجمي 10 كغ تُحتسب 10 كغ. تواصل معنا رجاءً بشأن الوزن والحجم قبل الإرسال.",
          zh: "若一个纸箱内有多件小物品，请记住运费按整箱计算，而不是按里面有多少件。空运始终按实际重量与体积重量中的较大者计费——例如实重 5 公斤、体积重 10 公斤的货物，按 10 公斤计费。寄件前请就重量和尺寸与我们沟通。",
        },
      },
      {
        party: "us",
        text: {
          ku: "پێش ناردن، کێش و قەبارەی کارتۆنەکەت پیشان دەدەین لەگەڵ نرخەکەی، تاوەکو پێش دەرچوونی بارەکە لە چین بزانیت چەندی دەکات — نەک لە کاتی وەرگرتندا سەرسام ببیت.",
          en: "Before shipping we show you the carton's weight and size along with the price, so you know the cost before it leaves China — not as a surprise on collection.",
          ar: "وقبل الشحن نعرض عليك وزن الكرتونة وحجمها مع السعر، لتعرف التكلفة قبل مغادرتها الصين — لا كمفاجأة عند الاستلام.",
          zh: "发货前，我们会向您展示纸箱的重量、体积和价格，让您在货物离开中国前就知道费用——而不是在取货时才意外发现。",
        },
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
        party: "us",
        text: {
          ku: "ئێمە باشترین هێڵی گواستنەوە و ڕێگا بۆ بارەکەت هەڵدەبژێرین، بەپێی خێرایی و نرخ و سەلامەتی. ئەمە کارێکی ڕۆژانەی ئێمەیە و ئەزموونەکەمان لە خزمەتی تۆدایە.",
          en: "We choose the best carrier and route for your shipment, weighing speed, price, and safety. This is our daily work, and our experience is at your service.",
          ar: "نختار أفضل ناقل ومسار لشحنتك، موازنين بين السرعة والسعر والأمان. هذا عملنا اليومي، وخبرتنا في خدمتك.",
          zh: "我们会综合速度、价格和安全性，为您的货物选择最合适的承运方和路线。这是我们的日常工作，我们的经验为您服务。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر بژاردەیەکی دیاریکراوت دەوێت (بۆ نموونە بە فڕۆکە بێت نەک بە کەشتی، یان بە پەلە بێت)، تەنها پێش ناردن پێمان بڵێ و ڕێکدەکەوین.",
          en: "If you want a particular option — air rather than sea, say, or an express service — just tell us before shipping and we will arrange it.",
          ar: "وإن أردت خيارًا معيّنًا — جوًّا بدل بحرًا مثلًا، أو خدمة سريعة — أخبرنا قبل الشحن فقط وسنرتّبه.",
          zh: "如果您想要特定方案——例如走空运而非海运，或走加急——只需在发货前告诉我们，我们会安排。",
        },
      },
      {
        party: "us",
        text: {
          ku: "کاتی خەمڵێندراوی گەیشتن پێت دەڵێین، و لە هەموو قۆناغێکدا (کۆگا، دەرچوون، گەیشتن، گومرگ) دۆخی بارەکەت لە پۆرتاڵدا نوێ دەکەینەوە.",
          en: "We give you an estimated arrival time and update your shipment's status in the portal at every stage — warehouse, departure, arrival, customs.",
          ar: "نُعطيك وقتًا تقديريًا للوصول، ونُحدّث حالة شحنتك في البوابة في كل مرحلة — المستودع، المغادرة، الوصول، الجمارك.",
          zh: "我们会给出预计到达时间，并在每个环节（入库、发出、抵达、清关）在门户中更新货物状态。",
        },
      },
      {
        party: "you",
        text: {
          ku: "تکایە لەبیرت بێت ئەو کاتە خەمڵێندراوە، نەک بەڵێن. کەش و هەوا، قەرەباڵغی گومرگ، جەدوەلی فڕۆکە و کەشتی، شەڕ و ئاڵۆزییەکانی ناوچەکە، زیادبوونی ڕێوشوێنی گومرگ و هەر هۆکارێکی دەرەکیتر — هەموویان لە دەسەڵاتی ئێمە دەرن. بەڵام هەوڵ دەدەین هەر دواکەوتنێک لە پۆرتاڵدا نوێ بکەینەوە و ئاگادارت بکەینەوە.",
          en: "Please remember that time is an estimate, not a promise. Weather, customs backlogs, airline and shipping schedules, war and regional instability, tighter customs procedures, and any other outside factor are all beyond our control. But we do try to reflect any delay in the portal and let you know.",
          ar: "تذكّر رجاءً أن ذلك الوقت تقدير لا وعد. فالطقس، وازدحام الجمارك، وجداول الطيران والشحن، والحروب واضطرابات المنطقة، وتشديد الإجراءات الجمركية، وأي عامل خارجي آخر — كلّها خارجة عن سيطرتنا. لكننا نحرص على تحديث أي تأخير في البوابة وإبلاغك به.",
          zh: "请记住那只是预估时间，而非承诺。天气、海关积压、航班与船期、战争与地区局势、海关手续收紧以及任何其他外部因素，都不在我们掌控之内。但我们会努力在门户中更新任何延误并及时告知您。",
        },
      },
      {
        party: "you",
        text: {
          ku: "باج و گومرگی فەرمی بەشی خاوەنی بارەکەیە، چونکە بە ناوی ئەوەوە دەبڕدرێت. ئێمە هیچ سوودێکمان لەم بڕەدا نییە — تەنها بۆتی دەبڕین.",
          en: "Official duties and taxes fall to the owner of the goods, because they are paid in that name. We gain nothing from this amount — we simply pay it for you.",
          ar: "الرسوم والضرائب الرسمية تقع على مالك البضاعة، لأنها تُدفع باسمه. ونحن لا نستفيد شيئًا من هذا المبلغ — إنما ندفعه عنك فقط.",
          zh: "官方关税和税费由货主承担，因为它们以货主名义缴纳。我们从这笔款项中不获取任何利益——只是代您缴付。",
        },
      },
      {
        party: "us",
        text: {
          ku: "بەڵێن دەدەین بڕەکەت پێشوەخت پیشان بدەین، و هیچ بڕێکی زیادە بەبێ ئاگادارکردنەوەت زیاد نەکەین. ئەگەر داواشت کرد، پسووڵەی فەرمیی گومرگت پیشان دەدەین. ئێمە هەمیشە هەوڵ دەدەین کارەکانمان بە کەمترین تێچوو جێبەجێ بکەین.",
          en: "We promise to show you the amount in advance and never to add anything without telling you. If you ask, we will show you the official customs receipt. We always try to get the work done at the lowest cost.",
          ar: "نتعهّد بأن نعرض عليك المبلغ مسبقًا وألّا نضيف أي شيء دون إبلاغك. وإن طلبت، نُريك الإيصال الجمركي الرسمي. ونحرص دائمًا على إنجاز أعمالنا بأقل تكلفة.",
          zh: "我们承诺提前向您展示金额，绝不在未告知的情况下追加任何费用。如您要求，我们会出示官方海关收据。我们始终努力以最低成本完成工作。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر گومرگ بڕیاری پشکنینی بارەکەی دا، ئەوە بڕیارێکی فەرمییە و هیچ کۆمپانیایەکی گواستنەوە لە جیهاندا ناتوانێت ڕێگری لێ بکات.",
          en: "If customs decides to inspect a shipment, that is an official decision, and no freight company anywhere in the world can prevent it.",
          ar: "إذا قرّرت الجمارك تفتيش شحنة، فذلك قرار رسمي، ولا تستطيع أي شركة شحن في العالم منعه.",
          zh: "如果海关决定查验货物，那是官方决定，全世界没有任何货运公司能够阻止。",
        },
      },
      {
        party: "us",
        text: {
          ku: "لە کاتی پشکنیندا نوێنەرمان ئامادە دەبێت، هەوڵ دەدەین بەخێرایی دەریبکەین و هەموو هەنگاوێکت پێ ڕادەگەیەنین. بەڵام ئەو ماوەیەی گومرگ بارەکە ڕادەگرێت لە دەسەڵاتی ئێمە دەرە، و بەداخەوە ناتوانین قەرەبووی بکەینەوە.",
          en: "Our representative attends the inspection, we push to clear it quickly, and we keep you informed at every step. But how long customs holds the goods is out of our hands, and unfortunately we cannot compensate for it.",
          ar: "يحضر مندوبنا التفتيش، ونسعى للتخليص بسرعة، ونُطلعك على كل خطوة. لكن مدّة احتجاز الجمارك للبضاعة خارجة عن أيدينا، ولا يمكننا للأسف التعويض عنها.",
          zh: "查验时我们的代表会在场，我们会争取尽快放行，并随时向您通报每一步进展。但海关扣留的时长不在我们掌控之中，我们很抱歉无法就此赔偿。",
        },
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
        party: "us",
        text: {
          ku: "ئەگەر بارەکەت لە ماوەی ئەوەی لە دەستی ئێمەدایە بزر بێت یان زیانی پێ بگات، قەرەبووت دەکەینەوە. ئەمە بەڵێنێکی ڕوونی ئێمەیە، نەک بەخشش.",
          en: "If your goods are lost or damaged while they are in our hands, we compensate you. This is a clear commitment on our part, not a favour.",
          ar: "إذا فُقدت بضاعتك أو تضرّرت وهي في عهدتنا، فسنعوّضك. هذا التزام واضح منّا، لا تفضّل.",
          zh: "若您的货物在我们保管期间丢失或损坏，我们会赔偿您。这是我们明确的承诺，而非施惠。",
        },
      },
      {
        party: "you",
        text: {
          ku: "تکایە پسووڵەی کڕینەکەت هەڵبگرە. ئەوە تاکە شتێکە کە پێویستمانە بۆ ئەوەی بڕی قەرەبووەکە بە دادپەروەرانە دیاری بکەین.",
          en: "Please keep your purchase invoice. It is the one thing we need in order to work out the compensation fairly.",
          ar: "احتفظ رجاءً بفاتورة الشراء. فهي الشيء الوحيد الذي نحتاجه لتحديد التعويض بإنصاف.",
          zh: "请保留您的采购发票。这是我们公平计算赔偿金额所需要的唯一凭证。",
        },
      },
      {
        party: "us",
        text: {
          ku: "بڕی قەرەبوو بەم شێوەیە دیاری دەکرێت: ئەو نرخەی بەڕاستی داوتە (بەپێی پسووڵەی کڕینەکەت)، یان سنووری کۆمپانیا — کامەیان کەمتر بێت. ئەم ڕێسایە ستانداردێکی جیهانییە و هەموو کۆمپانیاکانی گواستنەوە پەیڕەوی دەکەن.",
          en: "Compensation is worked out like this: the price you actually paid (per your purchase invoice), or the company's limit — whichever is lower. This rule is an international standard that every freight company follows.",
          ar: "يُحتسب التعويض هكذا: السعر الذي دفعته فعلًا (بحسب فاتورة الشراء)، أو حدّ الشركة الأقصى — أيّهما أقل. وهذه القاعدة معيار دولي تتبعه كل شركات الشحن.",
          zh: "赔偿这样计算：您实际支付的价格（以采购发票为准），或公司的赔付上限——以较低者为准。这一规则是所有货运公司都遵循的国际标准。",
        },
      },
      {
        party: "you",
        text: {
          ku: "بۆیە باشترین شت ئەوەیە پسووڵەی ڕاستەقینەی کڕینەکەت هەڵبگریت. هەرچەندە پسووڵەکەت ڕوونتر بێت، قەرەبووەکەت تەواوتر دەبێت.",
          en: "So the best thing you can do is keep the real purchase invoice. The clearer your invoice, the fuller your compensation.",
          ar: "لذا فأفضل ما تفعله هو الاحتفاظ بفاتورة الشراء الحقيقية. فكلّما كانت فاتورتك أوضح، كان تعويضك أوفى.",
          zh: "因此，您最好保留真实的采购发票。发票越清晰，您获得的赔偿就越完整。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئەگەر بارێک بزر بێت، قەرەبووەکە بەپێی کێشی بارەکە حیساب دەکرێت: بۆ هەر کیلۆیەک لە بارگەی ئاسمانی تا ٢٥ دۆلار، و بۆ هەر مەتر سێجایەک لە بارگەی دەریایی تا ٤٠٠ دۆلار. بۆ نموونە، پاکەتێکی ٢ کیلۆیی تا ٥٠ دۆلاری بۆ دەدرێتەوە.",
          en: "If a shipment is lost, compensation is calculated on its weight: up to $25 per kilogram by air, and up to $400 per cubic metre by sea. So a 2 kg parcel is covered up to $50.",
          ar: "إذا فُقدت شحنة، يُحتسب التعويض على وزنها: حتى 25 دولارًا لكل كيلوغرام جوًّا، وحتى 400 دولار لكل متر مكعّب بحرًا. فطردٌ وزنه 2 كغ يُغطّى حتى 50 دولارًا.",
          zh: "若货物丢失，赔偿按其重量计算：空运每公斤最高 25 美元，海运每立方米最高 400 美元。因此一件 2 公斤的包裹最高赔付 50 美元。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەمە بۆ زۆربەی کاڵاکان تەواوە. بەڵام ئەگەر شتێکی بەنرخ و سووکت هەیە (مۆبایل، ساعەت، خشڵ)، تکایە پێش ناردنی لە چین پێمان بڵێ تاوەکو بیمەی زیادەی بۆ بکەین — ئەگەرنا لە کاتی بزربووندا تەنها ئەم سنوورە وەردەگریتەوە.",
          en: "For most goods this is enough. But if you have something valuable and light — a phone, a watch, jewellery — please tell us before it ships from China so we can add insurance; otherwise, if it is lost, this limit is all you receive.",
          ar: "هذا يكفي لمعظم البضائع. لكن إن كان لديك شيء ثمين وخفيف — هاتف، ساعة، مجوهرات — فأخبرنا قبل شحنه من الصين لنضيف تأمينًا؛ وإلّا فلن تستردّ عند الفقدان سوى هذا الحدّ.",
          zh: "对大多数货物而言这已足够。但如果您有贵重而轻便的物品（手机、手表、珠宝），请在从中国发货前告知我们以便加保；否则一旦丢失，您只能获得这一上限金额。",
        },
      },
      {
        party: "us",
        text: {
          ku: "دوو نموونە بۆ ڕوونکردنەوە: کاڵایەکی ٢ کیلۆیی کە ٣٠ دۆلاری تێچووە — سنوورەکە ٥٠ دۆلارە، بەڵام نرخی کاڵاکە ٣٠ دۆلارە، بۆیە ٣٠ دۆلارت دەدەینەوە. کاڵایەکی ٢ کیلۆیی کە ٥٠٠ دۆلاری تێچووە — سنوورەکە ٥٠ دۆلارە، بۆیە ٥٠ دۆلارت دەدەینەوە؛ ئەمە ئەو حاڵەتەیە کە بیمە پێویستە.",
          en: "Two examples. A 2 kg item that cost $30: the limit is $50, but the item cost $30, so we pay you $30. A 2 kg item that cost $500: the limit is $50, so we pay you $50 — this is the case where insurance matters.",
          ar: "مثالان: غرض وزنه 2 كغ كلّف 30 دولارًا — الحدّ 50 دولارًا، لكن قيمته 30 دولارًا، فندفع لك 30 دولارًا. وغرض وزنه 2 كغ كلّف 500 دولار — الحدّ 50 دولارًا، فندفع لك 50 دولارًا؛ وهذه هي الحالة التي يلزم فيها التأمين.",
          zh: "两个例子。一件 2 公斤、价值 30 美元的物品：上限 50 美元，但物品价值 30 美元，所以赔您 30 美元。一件 2 公斤、价值 500 美元的物品：上限 50 美元，所以赔您 50 美元——这正是需要保险的情形。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر نموونەی دووەم لەگەڵ کاڵاکەت دەگونجێت، تکایە پێش ناردن پەیوەندیمان پێوە بکە.",
          en: "If the second example fits your goods, please get in touch with us before shipping.",
          ar: "إن كان المثال الثاني ينطبق على بضاعتك، فتواصل معنا رجاءً قبل الشحن.",
          zh: "如果第二个例子符合您的货物情况，请在发货前联系我们。",
        },
      },
      {
        party: "you",
        text: {
          ku: "بۆ داواکردنی قەرەبوو، دوو شت پێویستە: پسووڵەی کڕینەکەت، و پەیوەندیکردن لە ماوەی ٧ ڕۆژ دوای وەرگرتنی بارەکە.",
          en: "To claim, two things are needed: your purchase invoice, and contact from you within 7 days of receiving the shipment.",
          ar: "للمطالبة يلزم أمران: فاتورة الشراء، وتواصلك خلال 7 أيام من استلام الشحنة.",
          zh: "索赔需要两样：您的采购发票，以及在收货后 7 天内联系我们。",
        },
      },
      {
        party: "us",
        text: {
          ku: "هەر کات ئەم دووانەمان پێگەیشت، داواکارییەکەت دەپشکنین و ئەنجامەکەت پێ ڕادەگەیەنین. بەبێ پسووڵە بەداخەوە ناتوانین هیچ بڕێک دیاری بکەین — نەک لەبەر ئەوەی نامانەوێت، بەڵکو چونکە هیچ ڕێگایەکمان نییە بزانین کاڵاکە چەندی تێچووە.",
          en: "As soon as we have both, we review your claim and tell you the outcome. Without an invoice we unfortunately cannot set any figure — not because we do not want to, but because we have no way of knowing what the goods cost.",
          ar: "وحالما يصلنا الأمران، ندرس مطالبتك ونُبلغك بالنتيجة. أما بدون فاتورة فلا يمكننا للأسف تحديد أي مبلغ — ليس لأننا لا نريد، بل لأنه لا سبيل لدينا لمعرفة كلفة البضاعة.",
          zh: "两样齐备后，我们会审核您的索赔并告知结果。没有发票，我们很遗憾无法确定任何金额——不是不愿意，而是我们无从得知货物的价值。",
        },
      },
      {
        party: "us",
        text: {
          ku: "چەند حاڵەتێک هەن کە بەداخەوە ناتوانین قەرەبووی بکەینەوە، چونکە لە دەسەڵاتی ئێمە دەرن: دواکەوتنی گەیاندن، قازانجی لەدەستچوو، زیانی بەهۆی پاکێجی لاواز لە فرۆشیارەوە، کاڵای لەلایەن گومرگ دەستبەسەرکراو بەهۆی نایاسایی بوون، و ڕووداوی وەک شەڕ و ئاڵۆزی و کارەسات و مانگرتن و پەتا. هەروەها گۆڕانی تەعریفەی گومرگی لە دەسەڵاتی ئێمە دەرە — ئەگەر لە نێوان ناردنی بارەکە و گەیشتنی بە گومرگ تەعریفە بەرز بێتەوە، بڕە نوێیەکە جێبەجێ دەکرێت. بەڵام لە هەموو ئەم حاڵەتانەدا بەتەنها بەجێت ناهێڵین — دۆخەکەت پێ ڕادەگەیەنین و لەگەڵت دەمێنینەوە تاوەکو باشترین ڕێگاچارە بدۆزینەوە.",
          en: "There are cases we unfortunately cannot compensate, because they are outside our control: delivery delays, lost profit, damage from weak packing by the supplier, goods seized by customs for being illegal, and events such as war, unrest, disaster, strikes, and pandemics. Changes in customs tariffs are also out of our hands — if the tariff rises between shipping and arrival at customs, the new rate applies. But in every one of these cases we do not leave you alone: we keep you informed and stay with you until we find the best way through.",
          ar: "هناك حالات لا يمكننا التعويض عنها للأسف لأنها خارجة عن سيطرتنا: تأخير التسليم، والأرباح الضائعة، والضرر الناتج عن ضعف التغليف من المورّد، والبضائع التي تصادرها الجمارك لكونها غير قانونية، وأحداث كالحرب والاضطرابات والكوارث والإضرابات والأوبئة. كذلك تغيّر التعرفة الجمركية خارج عن أيدينا — فإن ارتفعت بين الشحن والوصول إلى الجمارك، طُبِّقت التعرفة الجديدة. لكننا في كل هذه الحالات لا نتركك وحدك: نُطلعك على الوضع ونبقى معك حتى نجد أفضل حلّ.",
          zh: "有些情形我们很遗憾无法赔偿，因为它们不在我们掌控之内：交付延误、利润损失、供应商包装不良导致的损坏、因违法被海关扣押的货物，以及战争、动荡、灾害、罢工和疫情等事件。海关税率变动同样不在我们掌控之中——若在发货与到达海关之间税率上调，则按新税率执行。但在上述每一种情形下，我们都不会让您独自面对：我们会随时通报情况，并陪您一起找到最好的解决办法。",
        },
      },
      {
        party: "you",
        text: {
          ku: "تکایە ناوەناوە داوای نوێکردنەوەی دۆخی بارەکەت لێ بکە، و ئەگەر دواکەوت ئاگادارمان بکەرەوە. ژمارەی بارەکان زۆرە، و بیرخستنەوەی تۆ یارمەتیمان دەدات زووتر سەرنج بدەینە بارەکەی تۆ.",
          en: "Please ask us for an update on your shipment from time to time, and tell us if it is running late. The number of shipments is large, and a reminder from you helps us turn our attention to yours sooner.",
          ar: "اطلب منّا رجاءً تحديثًا عن شحنتك بين الحين والآخر، وأبلغنا إن تأخّرت. فعدد الشحنات كبير، وتذكيرك يساعدنا على الالتفات إلى شحنتك أسرع.",
          zh: "请不时向我们询问货物的最新状态，若有延误也请告知我们。货量很大，您的提醒能帮助我们更快关注到您的货物。",
        },
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
        party: "us",
        text: {
          ku: "بیمە بە شێوەی خۆکار لەگەڵ گواستنەوەدا نایەت، چونکە کرێیەکی زیادەی هەیە و نامانەوێت بەبێ ئاگاداری تۆ لەسەرت دابنێین. لە جیاتی ئەوە، هەڵبژاردنەکە بە تۆ دەدەین.",
          en: "Insurance does not come automatically with shipping, because it carries an extra fee and we do not want to charge you for it without your knowledge. We leave the choice to you instead.",
          ar: "التأمين لا يأتي تلقائيًا مع الشحن، لأن له رسمًا إضافيًا ولا نريد تحميلك إياه دون علمك. لذا نترك الخيار لك.",
          zh: "保险不会随运输自动附加，因为它有额外费用，我们不想在您不知情的情况下向您收取。我们把选择权留给您。",
        },
      },
      {
        party: "you",
        text: {
          ku: "تا خۆت داوای بیمە نەکەیت، ئێمە لە خۆڕا بۆت بیمە ناکەین. بۆ زۆربەی بارە ئاساییەکان پێویست ناکات، بەڵام ئەگەر کاڵاکەت بەنرخە، بیمە باشترین بڕیارە — تەنها پێمان بڵێ.",
          en: "Unless you ask for insurance yourself, we will not add it on our own initiative. For most ordinary shipments it is not needed, but if your goods are valuable, insurance is the right call — just tell us.",
          ar: "ما لم تطلب التأمين بنفسك، فلن نضيفه من تلقاء أنفسنا. ولمعظم الشحنات العادية لا حاجة له، لكن إن كانت بضاعتك ثمينة فالتأمين هو القرار الصائب — أخبرنا فقط.",
          zh: "除非您自己提出，我们不会主动为您投保。对大多数普通货物并不需要，但若您的货物贵重，投保是明智之选——只需告诉我们。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر بیمەت دەوێت، تەنها پێش ئەوەی بارەکە لە چین بنێردرێت لە واتساپ یان لە پۆرتاڵ پێمان بڵێ. دوای دەرچوونی بارەکە بەداخەوە نامێنێت — بیمە تەنها پێش ڕێکەوت کاری دەکات.",
          en: "If you want insurance, just tell us on WhatsApp or in the portal before the goods leave China. Once they have shipped it is unfortunately too late — insurance only works before the event.",
          ar: "إن أردت التأمين، أخبرنا عبر واتساب أو البوابة قبل مغادرة البضاعة الصين. وبعد الشحن يفوت الأوان للأسف — فالتأمين لا يعمل إلا قبل وقوع الحادث.",
          zh: "如需保险，只需在货物离开中国前通过 WhatsApp 或门户告诉我们。一旦发出便为时已晚——保险只在事发之前生效。",
        },
      },
      {
        party: "us",
        text: {
          ku: "نرخی بیمەکەت پێش هەموو شتێک پیشان دەدەین، تاوەکو خۆت بەراورد بکەیت و بڕیار بدەیت. ئەگەر ڕازی بوویت، ڕێکی دەخەین و بەڵگەنامەکەت پێدەدەین.",
          en: "We show you the insurance price first of all, so you can compare and decide for yourself. If you agree, we arrange it and give you the certificate.",
          ar: "نعرض عليك سعر التأمين أولًا، لتقارن وتقرّر بنفسك. فإن وافقت، رتّبناه وسلّمناك الوثيقة.",
          zh: "我们会先向您展示保险价格，让您自行比较和决定。若您同意，我们会办理并把保单交给您。",
        },
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
        party: "us",
        text: {
          ku: "نرخی گواستنەوە لەگەڵ بازاڕی جیهانی دەگۆڕێت (کرێی سووتەمەنی، وەرزی قەرەباڵغی، نرخی هێڵەکان). ئێمە هەمیشە هەوڵ دەدەین باشترین نرخت بۆ بەدەست بهێنین، و هەر گۆڕانێکی نرخ لە پۆرتاڵدا نوێ دەکەینەوە.",
          en: "Freight prices move with the world market — fuel costs, peak season, carrier rates. We always try to get you the best price, and any change is updated in the portal.",
          ar: "أسعار الشحن تتحرّك مع السوق العالمية — كلفة الوقود، وموسم الذروة، وأسعار الناقلين. ونحرص دائمًا على تحصيل أفضل سعر لك، وأي تغيير يُحدَّث في البوابة.",
          zh: "运价随国际市场波动——燃油成本、旺季、承运方费率。我们始终努力为您争取最优价格，任何变动都会在门户中更新。",
        },
      },
      {
        party: "you",
        text: {
          ku: "تکایە پێش هەر ناردنێک نرخی ئەو ڕۆژە بپشکنە، چونکە نرخی مانگی ڕابردوو لەوانەیە ئێستا جیاواز بێت.",
          en: "Please check the current price before each shipment, as last month's rate may no longer apply.",
          ar: "تحقّق رجاءً من سعر اليوم قبل كل شحنة، فقد لا يكون سعر الشهر الماضي ساريًا الآن.",
          zh: "每次发货前请查看当日价格，上个月的费率现在可能已经不同。",
        },
      },
      {
        party: "us",
        text: {
          ku: "بارگەی ئاسمانی بەپێی کێشی ڕاستەقینە یان کێشی قەبارەیی حیساب دەکرێت، کامەیان گەورەتر بێت. کەمترین بڕی حیسابکراو ١ کیلۆیە — واتە پاکەتێکی ٢٠٠ گرامیش وەک ١ کیلۆ حیساب دەکرێت، چونکە هێڵەکانی فڕۆکەوانی بەم شێوەیە لە ئێمە وەردەگرن.",
          en: "Air freight is charged on actual or volumetric weight, whichever is greater. The minimum billed is 1 kg — so even a 200 g parcel counts as 1 kg, because that is how the airlines charge us.",
          ar: "يُحتسب الشحن الجوي بالوزن الفعلي أو الحجمي، أيّهما أكبر. والحد الأدنى للاحتساب 1 كغ — أي أن طردًا وزنه 200 غرام يُحتسب كيلوغرامًا واحدًا، لأن شركات الطيران تحاسبنا هكذا.",
          zh: "空运按实际重量或体积重量中的较大者计费。最低计费为 1 公斤——即使 200 克的包裹也按 1 公斤计算，因为航空公司就是这样向我们收费的。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر چەند کاڵایەکی بچووکت هەیە، باشترە پێکەوە بیانێریت. ئێمە بەخۆڕایی یەکیان دەخەین و بەم شێوەیە یەک جار کرێی گواستنەوە دەدەیت، نەک چەند جار.",
          en: "If you have several small items, it is better to send them together. We combine them free of charge, so you pay freight once rather than several times.",
          ar: "إن كان لديك عدّة أغراض صغيرة، فالأفضل إرسالها معًا. نجمعها لك مجّانًا، فتدفع الشحن مرّة واحدة بدل عدّة مرّات.",
          zh: "如果您有多件小物品，最好一起寄。我们免费为您合并，这样您只需支付一次运费，而不是多次。",
        },
      },
      {
        party: "us",
        text: {
          ku: "بارگەی دەریایی بەپێی قەبارە حیساب دەکرێت (مەتر سێجا / CBM)، نەک بەپێی کێش. کەمترین بڕی حیسابکراو ٠.٢٥ مەتر سێجایە. قەبارە بەم شێوەیە دەرهێنراوە: درێژی × پانی × بەرزی.",
          en: "Sea freight is charged on volume (cubic metres / CBM), not weight. The minimum billed is 0.25 CBM. Volume is worked out as length × width × height.",
          ar: "يُحتسب الشحن البحري بالحجم (متر مكعّب / CBM) لا بالوزن. والحد الأدنى للاحتساب 0.25 متر مكعّب. ويُحسب الحجم هكذا: الطول × العرض × الارتفاع.",
          zh: "海运按体积（立方米 / CBM）计费，而非重量。最低计费为 0.25 立方米。体积计算方式为：长 × 宽 × 高。",
        },
      },
      {
        party: "you",
        text: {
          ku: "بۆیە بارگەی دەریایی هەڵبژاردنی باشترە بۆ کاڵای قورس و بچووک (وەک کەلوپەلی کارەبایی، پارچە، ئامێر) — لەوێدا کێش گرنگ نییە. ئەگەر دڵنیا نەبوویت کام باشترە، پێمان بڵێ و هەردوو نرخەکەت بۆ حیساب دەکەین.",
          en: "So sea freight is the better choice for heavy, compact goods — hardware, fabric, machinery — where weight does not count against you. If you are not sure which suits you, tell us and we will price both.",
          ar: "لذا فالشحن البحري خيار أفضل للبضائع الثقيلة صغيرة الحجم — كالعدد الكهربائية والأقمشة والآلات — حيث لا يُحسب الوزن ضدّك. وإن لم تكن متأكّدًا أيّهما أنسب، أخبرنا ونُسعّر لك الاثنين.",
          zh: "因此，海运更适合重而体积小的货物——五金、布料、机械——因为重量不会成为负担。如果不确定哪种更划算，告诉我们，我们会把两种价格都算给您。",
        },
      },
      {
        party: "us",
        text: {
          ku: "پسووڵەکانت بە دۆلار، یوان یان دیناری عێراقی دەردەکەین، بەپێی ئەوەی بۆ تۆ گونجاوترە. نرخی گۆڕینی دراویش لە کاتی پسووڵەکەدا بە ڕوونی نیشان دەدەین.",
          en: "We issue your invoices in USD, CNY, or IQD — whichever suits you best. The exchange rate used is shown clearly on the invoice itself.",
          ar: "نُصدر فواتيرك بالدولار أو اليوان أو الدينار العراقي — أيّها أنسب لك. ويظهر سعر الصرف المستخدم بوضوح على الفاتورة نفسها.",
          zh: "我们可按美元、人民币或伊拉克第纳尔开具发票——以您最方便的为准。所用汇率会清楚地显示在发票上。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر دراوێکی دیاریکراوت پێ باشترە، تەنها پێمان بڵێ و بەو دراوە بۆت دەردەکەین.",
          en: "If you prefer a particular currency, just tell us and we will issue it that way.",
          ar: "وإن كنت تفضّل عملة معيّنة، أخبرنا فقط ونُصدرها بها.",
          zh: "如果您偏好某种货币，只需告诉我们，我们就按那种货币开具。",
        },
      },
      {
        party: "you",
        text: {
          ku: "کاتێک پارە بۆ ئێمە دەنێریت، بانکەکان کرێیەکی گواستنەوە وەردەگرن — ئەو کرێیە بەشی نێرەرە.",
          en: "When you send us money, the banks take a transfer fee — that fee falls to the sender.",
          ar: "عند إرسال المال إلينا، تأخذ البنوك رسم تحويل — وهذا الرسم على المُرسِل.",
          zh: "您向我们汇款时，银行会收取转账手续费——该费用由汇款方承担。",
        },
      },
      {
        party: "us",
        text: {
          ku: "بۆ ئەوەی ئەم کرێیە کەم بێتەوە، چەند ڕێگایەکی پارەدانت پێشکەش دەکەین. تەنها پێمان بڵێ لە کوێ و بە چ ڕێگایەک دەتەوێت بدەیت، و ئێمە ئەو ڕێگایەت پێ دەڵێین کە کەمترین کرێی هەیە.",
          en: "To keep that fee down we offer several payment routes. Just tell us where and how you want to pay, and we will point you to the one that costs least.",
          ar: "ولتخفيف هذا الرسم نوفّر عدّة طرق للدفع. أخبرنا فقط من أين وكيف تريد الدفع، ونَدُلّك على الطريقة الأقل كلفة.",
          zh: "为降低这笔费用，我们提供多种付款渠道。只需告诉我们您想在哪里、以何种方式付款，我们会为您指出费用最低的一种。",
        },
      },
      {
        party: "you",
        text: {
          ku: "بارەکەت لەگەڵ بڕی پسووڵەکە تەسلیم دەکرێت. ئەگەر بۆ ماوەیەک ناتوانیت وەریبگریت یان بیدەیت، تەنها پێمان بڵێ — بۆ زۆربەی حاڵەتەکان چارەسەرێک دەدۆزینەوە.",
          en: "Your goods are handed over against the invoice amount. If for a while you cannot collect or cannot pay, just tell us — for most situations we can find a way.",
          ar: "تُسلَّم بضاعتك مقابل مبلغ الفاتورة. وإن تعذّر عليك الاستلام أو الدفع لفترة، أخبرنا فقط — ففي معظم الحالات نجد حلًّا.",
          zh: "您的货物凭发票金额交付。如果一段时间内您无法提货或付款，只需告诉我们——大多数情况下我们都能找到办法。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئەگەر بارێک تا ٣٠ ڕۆژ وەرنەگیرا و هیچ پەیوەندییەکیش نەکرا، ناچار دەبین بیفرۆشین بۆ داپۆشینی ئەو بڕەی ماوەتەوە. پێش ئەو هەنگاوە چەند جارێک لە پۆرتاڵ و لە واتساپ ئاگادارت دەکەینەوە — هەرگیز بەبێ ئاگادارکردنەوە ئەو کارە ناکەین.",
          en: "If goods go uncollected for 30 days with no contact at all, we are forced to sell them to cover what is owed. Before that step we notify you several times, in the portal and on WhatsApp — we never do it without warning.",
          ar: "إن بقيت البضاعة دون استلام 30 يومًا ودون أي تواصل، نضطر لبيعها لتغطية المبلغ المستحق. وقبل تلك الخطوة نُبلغك عدّة مرّات عبر البوابة وواتساب — ولا نفعلها أبدًا دون إنذار.",
          zh: "若货物 30 天无人提取且完全没有联系，我们将不得不将其出售以抵偿欠款。在此之前，我们会通过门户和 WhatsApp 多次通知您——绝不会在毫无预警的情况下这样做。",
        },
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
        party: "us",
        text: {
          ku: "لقی سەرەکیمان لە هەولێرە، و لەوێوە بۆ هەموو شوێنێکی عێراق دەگەیەنین. کرێی ناردنی ناوخۆیی پێشوەخت پێت دەڵێین، و بە کۆمپانیایەکی متمانەپێکراوەوە بۆت ڕێک دەخەین.",
          en: "Our main branch is in Erbil, and from there we deliver anywhere in Iraq. We tell you the domestic delivery cost in advance and arrange it through a company we trust.",
          ar: "فرعنا الرئيسي في أربيل، ومنه نُوصِل إلى أي مكان في العراق. ونُخبرك بكلفة التوصيل الداخلي مسبقًا، ونرتّبه عبر شركة نثق بها.",
          zh: "我们的主要分部在埃尔比勒，从那里可配送至伊拉克各地。国内配送费用我们会提前告知，并通过我们信任的公司安排。",
        },
      },
      {
        party: "you",
        text: {
          ku: "دەتوانیت خۆت لە هەولێر وەریبگریت، یان بۆ شارەکەی خۆت بۆت بنێرین — کرێی ناردنی ناوخۆیی بەشی کڕیارە. تەنها پێمان بڵێ کامەت پێ باشترە.",
          en: "You can collect in Erbil yourself, or we can send it on to your city — the domestic delivery cost is the customer's. Just tell us which you prefer.",
          ar: "يمكنك الاستلام بنفسك في أربيل، أو نُرسلها إلى مدينتك — وكلفة التوصيل الداخلي على العميل. أخبرنا فقط أيّهما تفضّل.",
          zh: "您可以自行在埃尔比勒提货，也可以由我们转寄到您所在城市——国内配送费用由客户承担。只需告诉我们您的选择。",
        },
      },
      {
        party: "you",
        text: {
          ku: "تکایە پێش واژووکردن بارەکەت بپشکنە و بیژمێرە. ئەگەر شتێکت بینی کە ڕێک نییە، هەر لەوێ پێمان بڵێ — لەو ساتەدا چارەسەرکردنی ئاسانە.",
          en: "Please check and count your goods before signing. If you see anything that is not right, tell us there and then — at that moment it is easy to put right.",
          ar: "افحص بضاعتك وعُدّها رجاءً قبل التوقيع. وإن رأيت ما ليس على ما يُرام، أخبرنا في حينه — ففي تلك اللحظة يسهل تداركه.",
          zh: "签收前请检查并清点您的货物。若发现任何不对之处，请当场告诉我们——在那一刻最容易处理。",
        },
      },
      {
        party: "us",
        text: {
          ku: "کاتی پێویستت دەدەینێ بۆ پشکنین و هیچ پەلەت لێ ناکەین. بەڵام دوای واژووکردن بەداخەوە ناتوانین سکاڵای کەمبوون یان زیان وەربگرین، چونکە ئیتر هیچ ڕێگایەکمان نییە بزانین کەی و لە کوێ ڕوویداوە.",
          en: "We give you the time you need to check and never rush you. But after you sign we unfortunately cannot accept claims for shortages or damage, because we then have no way of knowing when or where it happened.",
          ar: "نمنحك الوقت الذي تحتاجه للفحص ولا نستعجلك أبدًا. لكن بعد التوقيع لا يمكننا للأسف قبول مطالبات النقص أو التلف، إذ لا يبقى لدينا سبيل لمعرفة متى وأين حدث.",
          zh: "我们会给您充分的检查时间，绝不催促。但签字之后，我们很遗憾无法受理短少或损坏的索赔，因为那时已无从判断问题发生在何时何地。",
        },
      },
      {
        party: "us",
        text: {
          ku: "کاتێ بارەکەت گەیشتە هەولێر، دەستبەجێ ئاگادارت دەکەینەوە. ٤ ڕۆژی یەکەم بەخۆڕاییە بۆ خەزنکردن.",
          en: "When your shipment reaches Erbil we notify you at once. The first 4 days of storage are free.",
          ar: "حين تصل شحنتك إلى أربيل نُبلغك فورًا. والأيام الأربعة الأولى من التخزين مجّانية.",
          zh: "货物抵达埃尔比勒后，我们会立即通知您。前 4 天仓储免费。",
        },
      },
      {
        party: "you",
        text: {
          ku: "تکایە لە ماوەی ئەو ٤ ڕۆژەدا وەریبگرە. دوای ئەوە کرێی خەزنکردنی ڕۆژانە دەست پێدەکات، چونکە شوێنی کۆگا سنووردارە و بارەکانی تریش پێویستیان بە جێگایە. ئەگەر ناتوانیت بێیت، تەنها پێمان بڵێ.",
          en: "Please collect within those 4 days. After that a daily storage fee begins, because warehouse space is limited and other shipments need the room. If you cannot come, just tell us.",
          ar: "استلمها رجاءً خلال تلك الأيام الأربعة. وبعدها تبدأ رسوم تخزين يومية، لأن مساحة المستودع محدودة وشحنات أخرى تحتاج المكان. وإن تعذّر عليك الحضور، أخبرنا فقط.",
          zh: "请在这 4 天内提货。之后将开始按日收取仓储费，因为仓库空间有限，其他货物也需要位置。如果您无法前来，只需告诉我们。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئەگەر بارێک ماوەیەکی درێژ وەرنەگیرا، پێش هەر هەنگاوێک چەند جارێک لە پۆرتاڵ و لە واتساپ ئاگادارت دەکەینەوە. تەنها دوای ٣٠ ڕۆژ و دوای ئاگادارکردنەوەی کۆتایی، ناچار دەبین بیفرۆشین.",
          en: "If a shipment goes uncollected for a long time, we notify you several times in the portal and on WhatsApp before taking any step. Only after 30 days, and after a final notice, are we forced to sell it.",
          ar: "إن بقيت شحنة دون استلام مدّة طويلة، نُبلغك عدّة مرّات عبر البوابة وواتساب قبل أي خطوة. ولا نضطر لبيعها إلا بعد 30 يومًا وبعد إشعار أخير.",
          zh: "若货物长期无人提取，我们会在采取任何措施前，通过门户和 WhatsApp 多次通知您。只有在 30 天之后并发出最终通知后，我们才不得不将其出售。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر کێشەیەکت هەیە و ناتوانیت لە کاتی خۆیدا وەریبگریت، تەنها پێمان بڵێ. ماوەکەت بۆ درێژ دەکەینەوە — ئێمە بەدوای فرۆشتنی باری کڕیاراندا ناگەڕێین.",
          en: "If something is preventing you from collecting on time, just tell us. We will extend the period for you — we are not looking to sell our customers' goods.",
          ar: "إن كان ثمّة ما يمنعك من الاستلام في وقته، أخبرنا فقط. سنمدّد لك المهلة — فنحن لا نسعى لبيع بضائع عملائنا.",
          zh: "如果有什么原因让您无法按时提货，只需告诉我们。我们会为您延长期限——我们并不想出售客户的货物。",
        },
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
        party: "you",
        text: {
          ku: "ئەم کاڵایانە بەپێی یاسا ناگوازرێنەوە: چەک، تەقەمەنی، مادەی هۆشبەر، ئەلکهول، جگەرە، پارەی کاش، خشڵ، کانزای بەنرخ، ئاژەڵ یان ڕووەکی زیندوو، مادەی کیمیایی مەترسیدار، و هەر کاڵایەک نیشانەی ڕەچەڵەکی ساختەی هەبێت.",
          en: "These goods cannot be shipped under the law: weapons, explosives, drugs, alcohol, tobacco, cash, jewellery, precious metals, live animals or plants, hazardous chemicals, and anything carrying a false origin label.",
          ar: "هذه البضائع لا يجوز شحنها قانونًا: الأسلحة، والمتفجّرات، والمخدّرات، والكحول، والتبغ، والنقد، والمجوهرات، والمعادن الثمينة، والحيوانات أو النباتات الحيّة، والمواد الكيميائية الخطرة، وأي غرض يحمل بطاقة منشأ مزيّفة.",
          zh: "以下货物依法不可运输：武器、爆炸物、毒品、酒类、烟草、现金、珠宝、贵金属、活体动植物、危险化学品，以及任何带有虚假原产地标签的物品。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئەمانە یاسای دەوڵەتی چین و عێراقن، نەک ڕێسای ئێمە — هیچ کۆمپانیایەکی گواستنەوە ناتوانێت ڕێگەیان پێبدات. ئەگەر دڵنیا نەبوویت کاڵاکەت لەم لیستەدایە، پێش کڕین وێنەکەی بۆمان بنێرە و بەخۆڕایی پشکنینت بۆ دەکەین.",
          en: "These are the laws of China and Iraq, not our own rules — no freight company can allow them. If you are unsure whether your item is on this list, send us a photo before buying and we will check it for you free of charge.",
          ar: "هذه قوانين دولتَي الصين والعراق، لا قواعدنا نحن — ولا تستطيع أي شركة شحن السماح بها. وإن لم تكن متأكّدًا إن كان غرضك ضمن هذه القائمة، أرسل لنا صورته قبل الشراء ونفحصه لك مجّانًا.",
          zh: "这些是中国和伊拉克的法律，而非我们的公司规定——任何货运公司都无法放行。如果您不确定自己的物品是否在此列，请在购买前把照片发给我们，我们免费为您核查。",
        },
      },
      {
        party: "you",
        text: {
          ku: "هەندێک کاڵا قەدەغە نین، بەڵام مەرجی تایبەتیان هەیە: پاتری، موگناتیس، شلە، جوانکاری، خۆراک، تەواوکەری خۆراک و دەرمان. تکایە پێش کڕین پێمان بڵێ.",
          en: "Some goods are not banned but do have special conditions: batteries, magnets, liquids, cosmetics, food, supplements, and medicine. Please tell us before you buy.",
          ar: "بعض البضائع ليست محظورة لكن لها شروط خاصّة: البطاريات، والمغناطيس، والسوائل، ومستحضرات التجميل، والأطعمة، والمكمّلات، والأدوية. أخبرنا رجاءً قبل الشراء.",
          zh: "有些货物并非禁运，但有特殊条件：电池、磁铁、液体、化妆品、食品、保健品和药品。购买前请告知我们。",
        },
      },
      {
        party: "us",
        text: {
          ku: "بۆ هەر یەکێک لەمانە ڕێگای گونجاوی گواستنەوەیان هەیە (هێڵێکی تایبەت، پاکێجێکی تایبەت، یان بەڵگەنامەی زیادە). ئەگەر پێشوەخت پێمان بڵێیت، بۆت ڕێک دەخەین — بەڵام ئەگەر بەبێ ئاگادارکردنەوە بنێردرێن، لەوانەیە لە چین ڕاگیرێن.",
          en: "Each of these has a proper way to be shipped — a particular line, special packing, or extra paperwork. Tell us in advance and we will arrange it; but if they are sent without warning, they may be held in China.",
          ar: "لكلٍّ منها طريقة شحن مناسبة — خط معيّن، أو تغليف خاص، أو مستندات إضافية. أخبرنا مسبقًا ونرتّبها لك؛ أما إن أُرسلت دون إبلاغ، فقد تُحتجز في الصين.",
          zh: "这些物品各有合适的运输方式——特定航线、特殊包装或额外文件。提前告知我们，我们会为您安排；但如果未经告知就寄出，可能会被扣留在中国。",
        },
      },
      {
        party: "us",
        text: {
          ku: "لیستی تەواوی کاڵا قەدەغە و سنوورکراوەکان لە پۆرتاڵدا بەردەستە لە بەشی «کاڵای قەدەغە»، و بەردەوام نوێی دەکەینەوە بەپێی گۆڕانی یاساکان.",
          en: "The full list of prohibited and restricted goods is available in the portal under \"Prohibited Items\", and we keep it updated as the laws change.",
          ar: "القائمة الكاملة للبضائع المحظورة والمقيّدة متاحة في البوابة ضمن قسم «البضائع المحظورة»، ونُحدّثها باستمرار مع تغيّر القوانين.",
          zh: "禁运和受限物品的完整清单可在门户的「禁运物品」栏目中查看，我们会随法规变化持续更新。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر کاڵاکەت لە لیستەکەدا نەبوو بەڵام دڵنیا نەبوویت، تکایە پرسیارمان لێ بکە. هەرگیز شەرم مەکە — پرسیارێکی پێش کڕین، لە بارێکی گیراو باشترە.",
          en: "If your item is not on the list but you are still unsure, please ask us. Never feel shy — one question before buying beats a seized shipment.",
          ar: "وإن لم يكن غرضك في القائمة ولا تزال غير متأكّد، اسألنا رجاءً. ولا تتردّد أبدًا — فسؤال قبل الشراء خير من شحنة محتجزة.",
          zh: "如果您的物品不在清单上但仍不确定，请咨询我们。不必客气——购买前问一句，胜过货物被扣。",
        },
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
        party: "us",
        text: {
          ku: "ئەگەر داوات کرد کاڵا بۆت بکڕین، ئێمە وەک بریکاری کڕینی تۆ کار دەکەین: لەگەڵ فرۆشیار مامەڵە دەکەین، پارەکەی دەدەین، و بۆ کۆگاکەمانی دەهێنین.",
          en: "If you ask us to buy goods for you, we act as your purchasing agent: we deal with the supplier, pay for the goods, and bring them to our warehouse.",
          ar: "إن طلبت منّا شراء بضاعة لك، نعمل بصفتنا وكيل الشراء لديك: نتعامل مع المورّد، وندفع ثمن البضاعة، ونُحضرها إلى مستودعنا.",
          zh: "如果您委托我们代购，我们将作为您的采购代理：与供应商洽谈、支付货款，并把货物运到我们的仓库。",
        },
      },
      {
        party: "you",
        text: {
          ku: "تۆ خاوەنی کاڵاکەیت لە یەکەم ساتەوە. ئێمە بە ناوی خۆمان ناکڕین — هەموو پسووڵە و بەڵگەنامەکان بە ناوی تۆوەن.",
          en: "You own the goods from the very first moment. We do not buy in our own name — every invoice and document is in yours.",
          ar: "أنت مالك البضاعة منذ اللحظة الأولى. فنحن لا نشتري باسمنا — وكل فاتورة ومستند يكون باسمك أنت.",
          zh: "从第一刻起货物就属于您。我们不以自己的名义购买——所有发票和单据都以您的名义开具。",
        },
      },
      {
        party: "you",
        text: {
          ku: "هەڵبژاردنی بەرهەم و فرۆشیار بە تۆیە: نرخ، جۆری کاڵا، و ڕەنگ و قەبارە. تکایە پێش داواکردن لینکی بەرهەمەکە و وێنەکەی بۆمان بنێرە.",
          en: "Choosing the product and the supplier is yours: price, type, colour, and size. Please send us the product link and a photo before ordering.",
          ar: "اختيار المنتج والمورّد لك: السعر، والنوع، واللون، والمقاس. أرسل لنا رجاءً رابط المنتج وصورته قبل الطلب.",
          zh: "选择产品和供应商由您决定：价格、款式、颜色和尺寸。下单前请把产品链接和照片发给我们。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئێمە هەر ئەو کاڵایە دەکڕین کە خۆت هەڵتبژاردووە، و پێش پارەدان دووبارە پشتڕاستی دەکەینەوە. ئەگەر جیاوازییەکمان بینی لە نێوان ئەوەی داوات کردووە و ئەوەی فرۆشیار پیشانی دەدات، پێش کڕین پێت دەڵێین.",
          en: "We buy exactly what you chose, and confirm it once more before paying. If we spot any difference between what you asked for and what the supplier is showing, we tell you before buying.",
          ar: "نشتري تمامًا ما اخترته، ونؤكّده مرّة أخرى قبل الدفع. وإن لاحظنا فرقًا بين ما طلبته وما يعرضه المورّد، أخبرناك قبل الشراء.",
          zh: "我们会严格按您选定的商品采购，并在付款前再次确认。若发现您的要求与供应商展示的商品有差异，我们会在购买前告知您。",
        },
      },
      {
        party: "us",
        text: {
          ku: "کاری سەرەکی ئێمە گواستنەوەیە. ئەگەر لە کاتی وەرگرتندا شکاوی یان کەموکوڕییەکی ئاشکرامان بەرچاو کەوت، وێنەت بۆ دەنێرین پێش ناردنی بۆ عێراق — بەڵام ناتوانین بەڵێنی پشکنینی سەدلەسەدی هەموو کاڵایەک بدەین.",
          en: "Our core business is shipping. If obvious breakage or a clear defect catches our eye on receipt, we send you a photo before shipping it to Iraq — but we cannot promise a hundred-percent inspection of every item.",
          ar: "عملنا الأساسي هو الشحن. فإن لفت انتباهنا كسر ظاهر أو عيب واضح عند الاستلام، أرسلنا لك صورة قبل شحنها إلى العراق — لكن لا يمكننا الوعد بفحص كل غرض فحصًا كاملًا.",
          zh: "我们的主营业务是运输。若收货时明显破损或缺陷引起我们注意，我们会在发往伊拉克前给您发照片——但我们无法承诺对每件商品做百分之百的检验。",
        },
      },
      {
        party: "you",
        text: {
          ku: "بۆیە باشترین کار ئەوەیە خۆت لەگەڵ فرۆشیارەکەت لەسەر هەموو شتێک دڵنیا ببیت پێش کڕین: جۆر، قەبارە، ڕەنگ و کوالیتی. کوالیتی بەرهەمەکە لە نێوان تۆ و فرۆشیارەکەدایە، چونکە ئێمە دروستکەری کاڵاکە نین.",
          en: "So the best thing is to settle everything with your supplier before buying: type, size, colour, and quality. Product quality is between you and the supplier, because we are not the ones who made it.",
          ar: "لذا فالأفضل أن تحسم كل شيء مع المورّد قبل الشراء: النوع والمقاس واللون والجودة. فجودة المنتج تبقى بينك وبين المورّد، لأننا لسنا من صنعه.",
          zh: "因此最好在购买前与供应商把一切确认清楚：款式、尺寸、颜色和质量。产品质量属于您与供应商之间的事，因为货不是我们生产的。",
        },
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
        party: "us",
        text: {
          ku: "زانیاری تۆ تەنها بۆ تەواوکردنی بارەکەت بەکاردەهێنین، و تەنها لەگەڵ گومرگ و هێڵی گواستنەوە و بریکارەکان هاوبەشی دەکەین — بەو ڕادەیەی کە بارەکەت پێویستی پێیەتی. هەرگیز زانیاری کڕیارەکانمان نافرۆشین و نایدەینە هیچ لایەنێکی بازرگانی.",
          en: "We use your information only to complete your shipment, and share it only with customs, carriers, and agents — and only as far as your shipment requires. We never sell our customers' data or pass it to any commercial party.",
          ar: "نستخدم معلوماتك فقط لإتمام شحنتك، ونشاركها فقط مع الجمارك والناقلين والوكلاء — وبالقدر الذي تتطلّبه شحنتك. ولا نبيع أبدًا بيانات عملائنا ولا نُعطيها لأي جهة تجارية.",
          zh: "我们仅为完成您的货物运输而使用您的信息，且仅在货物所需范围内与海关、承运方和代理共享。我们绝不出售客户数据，也不会提供给任何商业方。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر دەتەوێت بزانیت چ زانیارییەکت لای ئێمە هەیە، یان دەتەوێت بیسڕینەوە، تەنها داوای بکە.",
          en: "If you want to know what information we hold about you, or want it deleted, just ask.",
          ar: "وإن أردت معرفة ما لدينا من معلومات عنك، أو أردت حذفها، فاطلب ذلك فقط.",
          zh: "如果您想知道我们保存了您的哪些信息，或希望删除它们，只需提出即可。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئەگەر ناکۆکییەک ڕوویدا، هەمیشە سەرەتا بە دانوستان چارەسەری دەکەین. دەرگای ئێمە هەمیشە کراوەیە و گوێمان لە قسەکانت دەبێت پێش هەموو شتێک.",
          en: "If a dispute arises, we always try to settle it by talking first. Our door is always open, and we listen to you before anything else.",
          ar: "إن نشأ نزاع، نسعى دائمًا لتسويته بالحوار أولًا. فبابنا مفتوح دائمًا، ونستمع إليك قبل كل شيء.",
          zh: "若发生争议，我们始终先通过沟通解决。我们的大门永远敞开，我们会先倾听您的意见。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر ڕازی نەبوویت بە چارەسەرەکەمان، مافی تۆیە بەدوای ڕێگای یاسایی بکەویت — بەپێی یاساکانی ئەو وڵاتەی ناکۆکییەکەی تێدا ڕوویداوە.",
          en: "If you are not satisfied with our solution, it is your right to pursue legal remedies — under the laws of the country where the dispute arose.",
          ar: "وإن لم تقتنع بالحلّ الذي نقدّمه، فمن حقّك اللجوء إلى القضاء — وفق قوانين البلد الذي نشأ فيه النزاع.",
          zh: "如果您对我们的解决方案不满意，您有权寻求法律途径——依据争议发生地所在国家的法律。",
        },
      },
      {
        party: "us",
        text: {
          ku: "ئەم مەرجانە ڕێککەوتنی نێوان ئێمە و تۆن. ئەگەر بەشێکیان بەپێی یاسا نادروست دەرکەوت، بەشەکانی تر بەردەوام دەبن. هەر گۆڕانکارییەکی داهاتوو لە پۆرتاڵدا بڵاو دەکەینەوە و ئاگادارت دەکەینەوە.",
          en: "These terms are the agreement between us and you. If any part is found invalid in law, the rest remains in force. Any future change is published in the portal and notified to you.",
          ar: "هذه الشروط هي الاتفاق بيننا وبينك. وإن تبيّن بطلان أي جزء منها قانونًا، بقي الباقي ساريًا. وأي تعديل مستقبلي يُنشَر في البوابة ونُبلغك به.",
          zh: "本条款是我们与您之间的协议。若其中任何部分在法律上被认定无效，其余部分仍然有效。今后的任何变更都会在门户中公布并通知您。",
        },
      },
      {
        party: "you",
        text: {
          ku: "ئەگەر هەر خاڵێک ڕوون نەبوو، تەنها لە واتساپ پرسیارمان لێ بکە. باشترین مامەڵە ئەوەیە کە هەردوولا بەڕوونی بزانن چییان لەسەرە و چییان بۆیە.",
          en: "If any point is unclear, just ask us on WhatsApp. The best dealings are the ones where both sides know clearly what they owe and what they are owed.",
          ar: "وإن لم تكن أي نقطة واضحة، اسألنا عبر واتساب فقط. فأفضل التعاملات ما يعرف فيها الطرفان بوضوح ما لهما وما عليهما.",
          zh: "如果有任何一点不清楚，通过 WhatsApp 问我们即可。最好的合作，是双方都清楚各自的义务与权利。",
        },
      },
    ],
  },
];
