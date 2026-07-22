// Wazn Express — customer-facing prohibited / restricted goods guide, in all
// four UI languages (ku / en / ar / zh). Rendered by
// client/src/pages/portal/PortalProhibitedItems.tsx. Each item is tappable and
// opens a pre-filled WhatsApp chat asking whether a specific product can ship.
import {
  Ban,
  AlertTriangle,
  FileCheck2,
  type LucideIcon,
} from "lucide-react";
import type { L10n } from "./portalTerms";

export interface ProhibitedSection {
  id: string;
  icon: LucideIcon;
  /** Tailwind gradient utility classes for the section header bar. */
  gradient: string;
  title: L10n;
  subtitle: L10n;
  items: L10n[];
}

export const prohibitedHeader = {
  title: {
    ku: "کاڵا قەدەغە و سنووردارەکان",
    en: "Prohibited & restricted goods",
    ar: "البضائع الممنوعة والمقيّدة",
    zh: "禁运与受限物品",
  } as L10n,
  subtitle: {
    ku: "پێش کڕین و ناردن، دڵنیابە کاڵاکەت ڕێگەپێدراوە",
    en: "Before buying or shipping, make sure your item is allowed",
    ar: "قبل الشراء أو الشحن، تأكد أن بضاعتك مسموح بها",
    zh: "购买或寄送前，请确认您的物品可以运输",
  } as L10n,
  tapTip: {
    ku: "دڵنیا نیت لە کاڵایەک؟ لەسەر هەر خاڵێک کلیک بکە و لە واتسئاپ بپرسە",
    en: "Not sure about an item? Tap any point to ask us on WhatsApp",
    ar: "لست متأكداً من بضاعة؟ اضغط على أي نقطة واسألنا عبر واتساب",
    zh: "不确定某件物品？点击任意条目通过 WhatsApp 询问我们",
  } as L10n,
  consent: {
    ku: "بەرپرسیارێتی ناردنی کاڵای قەدەغەکراو دەکەوێتە سەر خاوەنی کاڵاکە — سزای گومرگی و لەدەستدانی کاڵاکەی لێدەکەوێتەوە",
    en: "Shipping prohibited goods is the sender's responsibility — it can lead to customs penalties and loss of the goods",
    ar: "مسؤولية شحن البضائع الممنوعة تقع على صاحب البضاعة — وقد تؤدي إلى غرامات جمركية ومصادرة البضاعة",
    zh: "寄送违禁品的责任由货主承担——可能导致海关处罚和货物没收",
  } as L10n,
};

/** Pre-filled WhatsApp question wrapped around the tapped item. */
export const prohibitedAsk: L10n = {
  ku: "سڵاو بەڕێزان، دەمەوێ بزانم ئایا دەکرێ ئەم جۆرە کاڵایە بنێردرێت؟",
  en: "Hello, I'd like to know — can this kind of item be shipped?",
  ar: "السلام عليكم، أودّ أن أعرف — هل يمكن شحن هذا النوع من البضائع؟",
  zh: "您好，我想了解——这类物品可以运输吗？",
};

export const prohibitedHint: L10n = {
  ku: "لێرە بپرسە لە واتسئاپ",
  en: "Ask us on WhatsApp",
  ar: "اسألنا عبر واتساب",
  zh: "通过 WhatsApp 询问",
};

export const prohibitedSections: ProhibitedSection[] = [
  {
    id: "banned",
    icon: Ban,
    gradient: "from-red-600 to-rose-600",
    title: { ku: "قەدەغەی تەواو", en: "Completely prohibited", ar: "ممنوع منعاً باتاً", zh: "完全禁止" },
    subtitle: {
      ku: "بە هیچ شێوەیەک ناردنیان ناکرێت — نە ئاسمانی نە دەریایی",
      en: "Cannot be shipped in any way — neither by air nor by sea",
      ar: "لا يمكن شحنها بأي شكل — لا جواً ولا بحراً",
      zh: "任何方式都不能运输——无论空运还是海运",
    },
    items: [
      { ku: "چەک و فیشەک و پارچەکانیان — هەر جۆرە چەکێکی ئاگرین یان سارد (شمشێر، خەنجەری شەڕ)", en: "Weapons, ammunition and their parts — any firearm or combat blade (swords, combat knives)", ar: "الأسلحة والذخيرة وقطعها — أي سلاح ناري أو أبيض قتالي (سيوف، خناجر قتالية)", zh: "武器、弹药及其零件——任何枪支或格斗刀具（刀剑、格斗匕首）" },
      { ku: "ماددە هۆشبەرەکان و هەر شتێکی پەیوەست بە ماددە بێهۆشکەرەکان", en: "Narcotics and anything related to illegal drugs", ar: "المخدرات وكل ما يتعلق بالمواد المخدرة", zh: "毒品及任何与非法药物相关的物品" },
      { ku: "تەقەمەنی، فیشەکی ئاسمانی (یاری ئاگرین) و ماددە تەقێنەرەوەکان", en: "Explosives, fireworks and blasting materials", ar: "المتفجرات والألعاب النارية والمواد المتفجرة", zh: "爆炸物、烟花爆竹及起爆材料" },
      { ku: "ماددە تیشکدەرەکان (ڕادیۆئاکتیڤ) و کیمیاوییە مەترسیدارەکان", en: "Radioactive materials and dangerous chemicals", ar: "المواد المشعة والمواد الكيميائية الخطرة", zh: "放射性材料和危险化学品" },
      { ku: "پارەی درۆینە، بەڵگەنامەی ساختە و کارتی بانکی ساختە", en: "Counterfeit money, forged documents and fake bank cards", ar: "العملات المزيفة والوثائق المزورة والبطاقات المصرفية المزيفة", zh: "假币、伪造证件和假银行卡" },
      { ku: "ئاژەڵ و ڕووەکی زیندوو", en: "Live animals and plants", ar: "الحيوانات والنباتات الحية", zh: "活体动物和植物" },
      { ku: "ئامێری بەربەست کردنی ئیشارە (Jammer) و ئامێری چاودێری نهێنی", en: "Signal jammers and covert surveillance devices", ar: "أجهزة التشويش وأجهزة المراقبة السرية", zh: "信号干扰器和隐蔽监控设备" },
      { ku: "هەر کاڵایەک کە پێچەوانەی یاسا و ئادابی گشتی عێراق بێت", en: "Any goods against Iraqi law or public morals", ar: "أي بضاعة مخالفة للقانون العراقي أو الآداب العامة", zh: "任何违反伊拉克法律或公序良俗的物品" },
    ],
  },
  {
    id: "restricted",
    icon: AlertTriangle,
    gradient: "from-amber-500 to-orange-600",
    title: { ku: "سنووردار — پێش ناردن بپرسە", en: "Restricted — ask before shipping", ar: "مقيّدة — اسأل قبل الشحن", zh: "受限——寄送前请询问" },
    subtitle: {
      ku: "هەندێکیان بە دەریایی دەکرێت بەڵام بە ئاسمانی نا، یان مەرجی تایبەتیان هەیە",
      en: "Some can go by sea but not by air, or have special conditions",
      ar: "بعضها يمكن شحنه بحراً لا جواً، أو له شروط خاصة",
      zh: "有些可海运但不可空运，或有特殊条件",
    },
    items: [
      { ku: "پاتری لیتیۆم و پاوەربانک — بە ئاسمانی زۆر سنووردارە، پێویستە پێشتر ئاگادارمان بکەیتەوە", en: "Lithium batteries and power banks — heavily restricted by air; tell us beforehand", ar: "بطاريات الليثيوم وباور بانك — مقيّدة جداً جواً؛ أخبرنا مسبقاً", zh: "锂电池和充电宝——空运严格受限，请提前告知我们" },
      { ku: "شل و بۆن و سپرەی (عەترەکان) — بە ئاسمانی سنووردارە، بە دەریایی باشترە", en: "Liquids, perfumes and sprays — restricted by air; sea is better", ar: "السوائل والعطور والبخاخات — مقيّدة جواً؛ البحري أفضل", zh: "液体、香水和喷雾——空运受限，海运更合适" },
      { ku: "موگناتیسی بەهێز — بە ئاسمانی قەدەغەیە", en: "Strong magnets — prohibited by air", ar: "المغناطيسات القوية — ممنوعة جواً", zh: "强磁铁——空运禁止" },
      { ku: "درۆن و هەندێک ئامێری فڕۆکەیی — پێویستی بە ڕەزامەندی پێشوەختە هەیە", en: "Drones and some aerial devices — need prior approval", ar: "الدرونات وبعض الأجهزة الطائرة — تحتاج موافقة مسبقة", zh: "无人机及某些飞行设备——需要事先批准" },
      { ku: "چەقۆ و ئامێرە تیژەکانی ئاشپەزخانە/کار — تەنها بە دەریایی و بە بڕی ئاسایی", en: "Kitchen/work knives and sharp tools — sea only, in normal quantities", ar: "سكاكين المطبخ/العمل والأدوات الحادة — بحراً فقط وبكميات عادية", zh: "厨房/工作刀具及利器——仅限海运，数量正常" },
      { ku: "جگەرەی ئەلیکترۆنی (ڤەیپ) و کەرەستەکانی — سنووردارە، پێشتر بپرسە", en: "E-cigarettes (vapes) and accessories — restricted; ask first", ar: "السجائر الإلكترونية (فيب) ولوازمها — مقيّدة؛ اسأل أولاً", zh: "电子烟及配件——受限，请先询问" },
      { ku: "کاڵای براندی ناسراو (کۆپی) — مەترسی دەستبەسەرداگرتنی گومرگی هەیە", en: "Branded replica goods — risk of customs seizure", ar: "بضائع الماركات المقلدة — خطر المصادرة الجمركية", zh: "名牌仿品——有被海关查扣的风险" },
    ],
  },
  {
    id: "permit",
    icon: FileCheck2,
    gradient: "from-sky-500 to-indigo-600",
    title: { ku: "پێویستی بە مۆڵەت/بەڵگەنامەیە", en: "Needs a permit / paperwork", ar: "تحتاج إجازة / مستندات", zh: "需要许可证/文件" },
    subtitle: {
      ku: "دەکرێت بنێردرێن بەڵام مۆڵەتی هاوردە یان بەڵگەنامەی تایبەتیان دەوێت",
      en: "Can be shipped but require an import permit or special paperwork",
      ar: "يمكن شحنها لكنها تتطلب إجازة استيراد أو مستندات خاصة",
      zh: "可以运输，但需要进口许可或特殊文件",
    },
    items: [
      { ku: "دەرمان و کەرەستەی پزیشکی — مۆڵەتی وەزارەتی تەندروستی دەوێت", en: "Medicines and medical supplies — need Ministry of Health permits", ar: "الأدوية والمستلزمات الطبية — تحتاج إجازة وزارة الصحة", zh: "药品和医疗用品——需要卫生部许可" },
      { ku: "خواردەمەنی و پێداویستی خواردن — پێویستی بە پشکنین و مۆڵەتی تایبەتە", en: "Food items — need inspection and special permits", ar: "المواد الغذائية — تحتاج فحصاً وإجازات خاصة", zh: "食品——需要检验和特殊许可" },
      { ku: "جوانکاری و کریمەکان بە بڕی بازرگانی — مۆڵەتی هاوردەی دەوێت", en: "Cosmetics in commercial quantities — need an import permit", ar: "مستحضرات التجميل بكميات تجارية — تحتاج إجازة استيراد", zh: "商业数量的化妆品——需要进口许可" },
      { ku: "ئامێری پەیوەندی و ئینتەرنێت (ڕاوتەر، واکی تۆکی...) — ڕەزامەندی وەزارەتی گەیاندن", en: "Telecom devices (routers, walkie-talkies...) — Ministry of Communications approval", ar: "أجهزة الاتصالات (راوترات، لاسلكي...) — موافقة وزارة الاتصالات", zh: "通信设备（路由器、对讲机等）——需通信部批准" },
      { ku: "کیمیاوی پیشەسازی و بۆیاخ — بەڵگەنامەی MSDS و مۆڵەت دەوێت", en: "Industrial chemicals and paints — need MSDS documents and permits", ar: "الكيماويات الصناعية والأصباغ — تحتاج مستندات MSDS وإجازات", zh: "工业化学品和涂料——需要 MSDS 文件和许可" },
    ],
  },
];
