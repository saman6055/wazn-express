import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import CompanyLogo from "@/components/CompanyLogo";
import { SocialChannels } from "@/components/portal/SocialChannels";
import {
  ArrowLeft, ArrowRight, Plane, Ship, ShoppingBag, Coins, Warehouse,
  ShieldCheck, Zap, Eye, Headset, Globe, MapPin, Phone, Mail, Link as LinkIcon,
  Target, Sparkles, CheckCircle2,
} from "lucide-react";

type L = { ku: string; en: string; ar: string; zh: string };

/** WhatsApp brand glyph. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
    </svg>
  );
}

import { TERMS_WHATSAPP_NUMBER as WHATSAPP_NUMBER } from "@/constants/portalTerms";

export default function PortalAbout() {
  const { language } = useLanguage();

  // Banner colour follows the mode the customer picked, like every other page.

  const { banner: portalBanner } = usePortalPalette();
  const { theme } = useTheme();
  const company = useCompanyInfo();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  const pick = (v: L) => pickLang(language, v);
  const [, navigate] = useLocation();
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const companyName =
    language === "ku" ? (company.nameKu || company.name) :
    language === "ar" ? (company.nameAr || company.name) : company.name;

  const services: { icon: typeof Plane; grad: string; title: L; desc: L }[] = [
    {
      icon: Plane, grad: "from-sky-500 to-blue-600",
      title: { ku: "گواستنەوەی ئاسمانی", en: "Air Freight", ar: "الشحن الجوي", zh: "空运" },
      desc: {
        ku: "خێراترین ڕێگا بۆ گەیاندنی بارە سووک و پەلەدارەکان، بەپێی کیلۆ.",
        en: "The fastest route for light, urgent cargo — priced per kilogram.",
        ar: "أسرع طريق للبضائع الخفيفة والعاجلة — بسعر الكيلوغرام.",
        zh: "轻便、紧急货物的最快方式——按公斤计价。",
      },
    },
    {
      icon: Ship, grad: "from-cyan-500 to-teal-600",
      title: { ku: "گواستنەوەی دەریایی", en: "Sea Freight", ar: "الشحن البحري", zh: "海运" },
      desc: {
        ku: "هەرزانترین بژاردە بۆ بارە قورس و گەورەکان، بەپێی مەترسێج.",
        en: "The most economical option for heavy, bulky cargo — priced per CBM.",
        ar: "الخيار الأوفر للبضائع الثقيلة والكبيرة — بسعر المتر المكعب.",
        zh: "重货、大件货物最经济的选择——按立方米计价。",
      },
    },
    {
      icon: ShoppingBag, grad: "from-violet-500 to-purple-600",
      title: { ku: "خزمەتگوزاری پاکێجی تەواو", en: "Full-Package Service", ar: "خدمة الطرد الكامل", zh: "全包服务" },
      desc: {
        ku: "بۆت دەکڕین، پارە دەدەین و دەگەیەنین — تۆ تەنها داواکارییەکەت بنێرە.",
        en: "We buy, pay, and ship on your behalf — you just send the request.",
        ar: "نشتري وندفع ونشحن نيابةً عنك — فقط أرسل طلبك.",
        zh: "我们代你采购、付款和运输——你只需发送请求。",
      },
    },
    {
      icon: Coins, grad: "from-amber-500 to-orange-600",
      title: { ku: "کڕینی یوانی چینی", en: "Yuan Exchange", ar: "شراء اليوان", zh: "人民币兑换" },
      desc: {
        ku: "یوانی چینی بە نرخێکی گونجاو و شەفاف، بۆ کڕینەکانت لە چین.",
        en: "Chinese Yuan at a fair, transparent rate for your purchases in China.",
        ar: "اليوان الصيني بسعر عادل وشفاف لمشترياتك من الصين.",
        zh: "以公平、透明的汇率兑换人民币，用于你在中国的采购。",
      },
    },
    {
      icon: Warehouse, grad: "from-emerald-500 to-green-600",
      title: { ku: "کۆگا لە چین", en: "China Warehouse", ar: "مستودع في الصين", zh: "中国仓库" },
      desc: {
        ku: "ناونیشانێکی تایبەت بە تۆ لە چین بۆ وەرگرتن و کۆکردنەوەی بارەکانت.",
        en: "A personal address in China to receive and consolidate your goods.",
        ar: "عنوان خاص بك في الصين لاستلام وتجميع بضائعك.",
        zh: "在中国的专属地址，用于接收和集运你的货物。",
      },
    },
  ];

  const values: { icon: typeof Zap; title: L; desc: L }[] = [
    {
      icon: Zap,
      title: { ku: "خێرایی", en: "Speed", ar: "السرعة", zh: "速度" },
      desc: {
        ku: "پرۆسەیەکی خێرا و بێ دواکەوتن، لە کۆگاوە تا بەردەستت.",
        en: "A fast, delay-free process from warehouse to your hands.",
        ar: "عملية سريعة وبلا تأخير من المستودع إلى يديك.",
        zh: "从仓库到你手中，快速无延迟的流程。",
      },
    },
    {
      icon: Eye,
      title: { ku: "شەفافیەت", en: "Transparency", ar: "الشفافية", zh: "透明" },
      desc: {
        ku: "نرخی ڕوون، شوێنکەوتنی زیندوو، و کەشفی حسابی تەواو.",
        en: "Clear pricing, live tracking, and a complete account statement.",
        ar: "أسعار واضحة، تتبع مباشر، وكشف حساب كامل.",
        zh: "清晰的价格、实时追踪和完整的账户对账单。",
      },
    },
    {
      icon: ShieldCheck,
      title: { ku: "متمانە", en: "Reliability", ar: "الموثوقية", zh: "可靠" },
      desc: {
        ku: "بارەکانت بە وریایی ماملە دەکرێن و بە سەلامەتی دەگەن.",
        en: "Your goods are handled with care and arrive safely.",
        ar: "تُعامَل بضائعك بعناية وتصل بأمان.",
        zh: "你的货物被小心处理并安全送达。",
      },
    },
    {
      icon: Headset,
      title: { ku: "پشتگیری", en: "Support", ar: "الدعم", zh: "支持" },
      desc: {
        ku: "تیمێکی چالاک کە هەمیشە ئامادەیە بۆ وەڵامدانەوەت.",
        en: "An active team always ready to answer you.",
        ar: "فريق نشط جاهز دائمًا للرد عليك.",
        zh: "一支随时准备为你解答的活跃团队。",
      },
    },
  ];

  const steps: L[] = [
    {
      ku: "لە چین کڕین بکە و ناونیشانی کۆگاکەمان بدە بە فرۆشیار.",
      en: "Buy from China and give our warehouse address to the seller.",
      ar: "اشترِ من الصين وأعطِ عنوان مستودعنا للبائع.",
      zh: "从中国购物，并把我们的仓库地址给卖家。",
    },
    {
      ku: "ژمارەی تراکینگ لە ئەپ تۆمار بکە بۆ ئەوەی بارەکەت بناسینەوە.",
      en: "Register the tracking number in the app so we can identify your package.",
      ar: "سجّل رقم التتبع في التطبيق كي نتعرّف على طردك.",
      zh: "在应用中登记追踪号，以便我们识别你的包裹。",
    },
    {
      ku: "بارەکەت لە کۆگا وەردەگیرێت و لەگەڵ ناردنەکەدا دەنێردرێت.",
      en: "Your goods are received at the warehouse and shipped with the next batch.",
      ar: "تُستلَم بضاعتك في المستودع وتُشحن مع الدفعة التالية.",
      zh: "你的货物在仓库被接收，并随下一批次发出。",
    },
    {
      ku: "شوێنکەوتنی بکە تا دەگاتە دەستت، پاشان پارەکەی بدە.",
      en: "Track it until it reaches you, then settle the payment.",
      ar: "تابعها حتى تصلك، ثم سدّد الدفعة.",
      zh: "追踪直到送达，然后结清付款。",
    },
  ];

  const card = cn("rounded-3xl p-5 ring-1", isDark ? "bg-slate-900 ring-white/5" : "bg-white ring-gray-100 shadow-sm");

  return (
    <PortalLayout>
      <div className={cn("min-h-screen", isDark ? "bg-slate-950" : "bg-gray-50 dark:bg-gray-950/40")} dir={isRTL ? "rtl" : "ltr"}>
        {/* Hero */}
        <div className="relative overflow-hidden text-white px-4 pt-6 pb-12" style={portalBanner}>
          <div className="absolute -top-16 -end-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -start-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />

          <button
            onClick={() => navigate("/portal/profile")}
            className="relative flex items-center gap-1.5 text-white/90 text-sm font-medium mb-6 active:scale-95 transition"
          >
            <BackArrow className="w-5 h-5" />
            {pick({ ku: "پرۆفایل", en: "Profile", ar: "الملف الشخصي", zh: "个人资料" })}
          </button>

          <div className="relative flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-white/15 backdrop-blur rounded-3xl flex items-center justify-center ring-1 ring-white/25 mb-3 overflow-hidden">
              <CompanyLogo size={56} />
            </div>
            <h1 className="text-3xl font-extrabold leading-tight">{companyName}</h1>
            <p className="text-sm text-white/85 mt-1.5 max-w-xs">
              {pick({
                ku: "پردی متمانە لە نێوان چین و عێراق",
                en: "Your trusted bridge between China and Iraq",
                ar: "جسر الثقة بينك وبين الصين والعراق",
                zh: "连接中国与伊拉克的信任之桥",
              })}
            </p>
          </div>
        </div>

        <div className="px-4 py-5 space-y-5 pb-28 max-w-lg mx-auto">
          {/* Who we are */}
          <div className={card}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <h2 className={cn("font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                {pick({ ku: "ئێمە کێین", en: "Who we are", ar: "من نحن", zh: "关于我们" })}
              </h2>
            </div>
            <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-600")}>
              {pick({
                ku: `${companyName} کۆمپانیایەکی پسپۆڕی گواستنەوە و لۆجستیکە، تایبەت بە گەیاندنی کاڵا لە چینەوە بۆ عێراق. ئێمە هەموو قۆناغەکان بۆ تۆ ئاسان دەکەین — لە وەرگرتنی بارەکەت لە کۆگاکەمان لە چین، تا گەیشتنی سەلامەت بۆ دەستت — بە نرخێکی ڕوون و شوێنکەوتنی زیندوو.`,
                en: `${companyName} is a specialist shipping and logistics company dedicated to moving goods from China to Iraq. We make every stage simple for you — from receiving your goods at our China warehouse to safe delivery into your hands — with clear pricing and live tracking.`,
                ar: `${companyName} شركة متخصصة في الشحن والخدمات اللوجستية، مكرّسة لنقل البضائع من الصين إلى العراق. نُبسّط لك كل مرحلة — من استلام بضاعتك في مستودعنا بالصين حتى تسليمها بأمان إلى يديك — بأسعار واضحة وتتبع مباشر.`,
                zh: `${companyName} 是一家专业的运输与物流公司，专注于将货物从中国运往伊拉克。我们为你简化每个环节——从在中国仓库接收货物到安全送达你手中——价格清晰、实时追踪。`,
              })}
            </p>
          </div>

          {/* Mission */}
          <div className={cn(
            "rounded-3xl p-5 ring-1 relative overflow-hidden",
            isDark ? "bg-gradient-to-br from-indigo-950/40 to-purple-950/40 ring-indigo-900/40" : "bg-gradient-to-br from-indigo-50 dark:from-indigo-950/40 to-purple-50 dark:to-purple-950/40 ring-indigo-100",
          )}>
            <div className="flex items-center gap-2.5 mb-2">
              <Target className={cn("w-5 h-5", isDark ? "text-indigo-400" : "text-indigo-600")} />
              <h2 className={cn("font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                {pick({ ku: "ئامانجی ئێمە", en: "Our mission", ar: "مهمتنا", zh: "我们的使命" })}
              </h2>
            </div>
            <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-600")}>
              {pick({
                ku: "ئاسانکردنی بازرگانی لەگەڵ چین بۆ هەمووان — بە خزمەتگوزارییەکی خێرا، شەفاف و پشتگیرییەکی بەردەوام کە جێی متمانەت بێت.",
                en: "To make trading with China effortless for everyone — through a fast, transparent service and dependable support you can trust.",
                ar: "جعل التجارة مع الصين سهلة للجميع — عبر خدمة سريعة وشفافة ودعم موثوق تثق به.",
                zh: "让每个人都能轻松与中国贸易——通过快速、透明的服务和值得信赖的支持。",
              })}
            </p>
          </div>

          {/* Services */}
          <div>
            <h2 className={cn("font-bold text-sm mb-3 px-1", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
              {pick({ ku: "خزمەتگوزارییەکانمان", en: "What we offer", ar: "خدماتنا", zh: "我们提供的服务" })}
            </h2>
            <div className="space-y-2.5">
              {services.map((s, i) => (
                <div key={i} className={cn("rounded-2xl p-4 flex items-start gap-3 ring-1", isDark ? "bg-slate-900 ring-white/5" : "bg-white ring-gray-100 shadow-sm")}>
                  <div className={cn("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0", s.grad)}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>{pick(s.title)}</h3>
                    <p className={cn("text-xs mt-0.5 leading-relaxed", isDark ? "text-slate-400" : "text-slate-500")}>{pick(s.desc)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Why choose us */}
          <div>
            <h2 className={cn("font-bold text-sm mb-3 px-1", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
              {pick({ ku: "بۆچی ئێمە؟", en: "Why choose us", ar: "لماذا نحن؟", zh: "为何选择我们" })}
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              {values.map((v, i) => (
                <div key={i} className={cn("rounded-2xl p-4 ring-1", isDark ? "bg-slate-900 ring-white/5" : "bg-white ring-gray-100 shadow-sm")}>
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2", isDark ? "bg-indigo-950/50 text-indigo-400" : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600")}>
                    <v.icon className="w-4.5 h-4.5" />
                  </div>
                  <h3 className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>{pick(v.title)}</h3>
                  <p className={cn("text-xs mt-0.5 leading-snug", isDark ? "text-slate-400" : "text-slate-500")}>{pick(v.desc)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className={card}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                <Globe className="w-4.5 h-4.5" />
              </div>
              <h2 className={cn("font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                {pick({ ku: "چۆن کار دەکات", en: "How it works", ar: "كيف تعمل", zh: "运作方式" })}
              </h2>
            </div>
            <ol className="space-y-3">
              {steps.map((st, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0", isDark ? "bg-indigo-500 text-white" : "bg-indigo-600 text-white")}>
                    {i + 1}
                  </span>
                  <span className={cn("text-sm leading-relaxed pt-0.5", isDark ? "text-slate-300" : "text-slate-600")}>{pick(st)}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Contact */}
          <div className={card}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-white">
                <Headset className="w-4.5 h-4.5" />
              </div>
              <h2 className={cn("font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                {pick({ ku: "پەیوەندیمان پێوە بکە", en: "Get in touch", ar: "تواصل معنا", zh: "联系我们" })}
              </h2>
            </div>

            <div className="space-y-2.5">
              {company.phone && (
                <a href={`tel:${company.phone}`} className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", isDark ? "bg-slate-800" : "bg-slate-100 dark:bg-slate-950/40")}>
                    <Phone className={cn("w-4 h-4", isDark ? "text-slate-300" : "text-slate-600")} />
                  </div>
                  <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")} dir="ltr">{company.phone}</span>
                </a>
              )}
              {company.email && (
                <a href={`mailto:${company.email}`} className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", isDark ? "bg-slate-800" : "bg-slate-100 dark:bg-slate-950/40")}>
                    <Mail className={cn("w-4 h-4", isDark ? "text-slate-300" : "text-slate-600")} />
                  </div>
                  <span className={cn("text-sm font-medium break-all", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")} dir="ltr">{company.email}</span>
                </a>
              )}
              {company.website && (
                <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", isDark ? "bg-slate-800" : "bg-slate-100 dark:bg-slate-950/40")}>
                    <LinkIcon className={cn("w-4 h-4", isDark ? "text-slate-300" : "text-slate-600")} />
                  </div>
                  <span className={cn("text-sm font-medium break-all", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")} dir="ltr">{company.website}</span>
                </a>
              )}
              {(pick({ ku: company.addressKu, en: company.address, ar: company.addressAr, zh: company.address })) && (
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", isDark ? "bg-slate-800" : "bg-slate-100 dark:bg-slate-950/40")}>
                    <MapPin className={cn("w-4 h-4", isDark ? "text-slate-300" : "text-slate-600")} />
                  </div>
                  <span className={cn("text-sm font-medium", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                    {pick({ ku: company.addressKu, en: company.address, ar: company.addressAr, zh: company.address })}
                  </span>
                </div>
              )}
            </div>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full h-12 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <WhatsAppIcon className="w-5 h-5" />
              {pick({ ku: "گفتوگۆ لە واتساپ", en: "Chat on WhatsApp", ar: "الدردشة على واتساب", zh: "在 WhatsApp 上聊天" })}
            </a>

            {/* Social channels (admin-managed) */}
            <div className="mt-4 flex justify-center">
              <SocialChannels />
            </div>
          </div>

          {/* Closing */}
          <div className="flex items-center justify-center gap-2 text-center pt-1">
            <CheckCircle2 className={cn("w-4 h-4", isDark ? "text-indigo-400" : "text-indigo-500")} />
            <p className={cn("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
              {pick({
                ku: "سوپاس بۆ متمانەت بە وەزن ئێکسپرێس 💜",
                en: "Thank you for trusting Wazn Express 💜",
                ar: "شكرًا لثقتك بوزن اكسبرس 💜",
                zh: "感谢你信赖 Wazn Express 💜",
              })}
            </p>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
