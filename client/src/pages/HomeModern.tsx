import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { pickLang } from "@/lib/lang";
import { CountUp } from "@/components/CountUp";
import CompanyLogo from "@/components/CompanyLogo";
import {
  Plane, Ship, Truck, Package, ShieldCheck, Globe2, Clock, Headphones,
  CheckCircle2, ArrowRight, MessageCircle, Search, MapPin, Boxes, Warehouse,
  Wallet, FileCheck2, Sparkles, PhoneCall, Mail,
} from "lucide-react";

/**
 * "Modern" landing variant — a premium, illustrated logistics landing for the
 * China → Iraq route. Deep-navy + sky-blue + violet palette, soft-glass cards,
 * SVG freight scenes (plane / ship / truck), animated route line and count-up
 * stats. Fully RTL-aware and localised (ku / en / ar / zh) via pickLang. No
 * external images or dependencies. Self-contained.
 */

// A small drifting cloud used across the sky scenes.
function Cloud({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 50" className={className} style={style} aria-hidden fill="currentColor">
      <ellipse cx="35" cy="32" rx="30" ry="16" />
      <ellipse cx="65" cy="26" rx="26" ry="20" />
      <ellipse cx="92" cy="34" rx="24" ry="14" />
      <rect x="20" y="30" width="80" height="16" rx="8" />
    </svg>
  );
}

export default function HomeModern() {
  const { language, isRTL } = useTranslation();
  const company = useCompanyInfo();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tracking, setTracking] = useState("");
  const L = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);

  useEffect(() => {
    if (!loading && user) setLocation(user.role === "customer" ? "/portal" : "/dashboard");
  }, [user, loading, setLocation]);

  const waPhone = (company.phone || "").replace(/[^\d]/g, "");
  const waLink = waPhone ? `https://wa.me/${waPhone}` : "/customer-login";
  const track = () => { if (tracking.trim()) setLocation(`/customer-login?track=${encodeURIComponent(tracking.trim())}`); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="animate-pulse text-2xl font-black text-white">{company.name}</p>
      </div>
    );
  }

  const nav = [
    { href: "#services", label: { ku: "خزمەتگوزاری", en: "Services", ar: "الخدمات", zh: "服务" } },
    { href: "#modes", label: { ku: "شێوازەکان", en: "Freight", ar: "الشحن", zh: "运输方式" } },
    { href: "#why", label: { ku: "بۆچی ئێمە", en: "Why us", ar: "لماذا نحن", zh: "为何选我们" } },
    { href: "#how", label: { ku: "چۆن کاردەکات", en: "How it works", ar: "كيف يعمل", zh: "运作方式" } },
    { href: "#contact", label: { ku: "پەیوەندی", en: "Contact", ar: "اتصل", zh: "联系" } },
  ];

  const trust = [
    { icon: ShieldCheck, label: { ku: "فرۆشیاری پشتڕاستکراو", en: "Verified suppliers", ar: "موردون موثوقون", zh: "认证供应商" } },
    { icon: CheckCircle2, label: { ku: "کوالیتی سەرتاسەری", en: "End-to-end quality", ar: "جودة شاملة", zh: "全程品控" } },
    { icon: Globe2, label: { ku: "پشتگیری چەند زمانی", en: "Multilingual support", ar: "دعم متعدد اللغات", zh: "多语言支持" } },
  ];

  const services = [
    { icon: Plane, t: { ku: "گواستنەوەی ئاسمانی", en: "Air freight", ar: "الشحن الجوي", zh: "空运" }, d: { ku: "گەیاندنی خێرا لە چینەوە بۆ عێراق", en: "Fast delivery from China to Iraq", ar: "توصيل سريع من الصين إلى العراق", zh: "从中国到伊拉克的快速运输" } },
    { icon: Ship, t: { ku: "گواستنەوەی دەریایی", en: "Sea freight", ar: "الشحن البحري", zh: "海运" }, d: { ku: "تێچووی کەم بۆ بارە گەورەکان", en: "Low cost for large cargo", ar: "تكلفة منخفضة للشحنات الكبيرة", zh: "大宗货物低成本" } },
    { icon: Boxes, t: { ku: "کۆکردنەوەی بار", en: "Consolidation", ar: "تجميع الشحنات", zh: "拼箱集运" }, d: { ku: "کۆکردنەوەی چەند پاکەت لە یەک بار", en: "Combine many parcels into one shipment", ar: "دمج عدة طرود في شحنة واحدة", zh: "多个包裹合并为一票" } },
    { icon: ShieldCheck, t: { ku: "بیمەی بار", en: "Cargo insurance", ar: "تأمين البضائع", zh: "货物保险" }, d: { ku: "پاراستنی بارەکەت لە هەموو ڕێگادا", en: "Protect your cargo the whole way", ar: "حماية بضاعتك طوال الطريق", zh: "全程保障您的货物" } },
    { icon: Wallet, t: { ku: "ژمێریاری خۆکار", en: "Auto accounting", ar: "محاسبة تلقائية", zh: "自动记账" }, d: { ku: "پسوڵە و باڵانسی ڕوون بۆ هەر کڕیارێک", en: "Clear invoices & balance per customer", ar: "فواتير ورصيد واضح لكل عميل", zh: "每位客户清晰的账单与余额" } },
    { icon: Headphones, t: { ku: "پشتگیری ٢٤/٧", en: "24/7 support", ar: "دعم ٢٤/٧", zh: "24/7 支持" }, d: { ku: "هەمیشە لەگەڵتاین بە زمانی خۆت", en: "Always here, in your language", ar: "دائماً معك وبلغتك", zh: "全天候，用您的语言" } },
  ];

  const stats = [
    { value: 9200, suffix: "+", label: { ku: "کردار جێبەجێکراو", en: "operations handled", ar: "عملية منجزة", zh: "已处理业务" } },
    { value: 6100, suffix: "+", label: { ku: "کڕیاری دڵخۆش", en: "happy clients", ar: "عميل سعيد", zh: "满意客户" } },
    { value: 30, suffix: "+", label: { ku: "شار لە عێراق", en: "cities in Iraq", ar: "مدينة في العراق", zh: "伊拉克城市" } },
    { value: 99, suffix: "%", label: { ku: "ڕێژەی گەیاندن", en: "delivery rate", ar: "معدل التسليم", zh: "送达率" } },
  ];

  const why = [
    { icon: MapPin, t: { ku: "بنکەی خۆمان لە چین", en: "Our own hub in China", ar: "مركزنا الخاص في الصين", zh: "我们在中国的自有仓" }, d: { ku: "وەرگرتن، پشکنین و کۆکردنەوەی بارەکانت لە شوێنی خۆیدا", en: "Receiving, checking & consolidating your goods on the ground", ar: "استلام وفحص وتجميع بضائعك ميدانياً", zh: "在当地接收、验货并集运" } },
    { icon: FileCheck2, t: { ku: "مامەڵەی گومرگ", en: "Customs handled", ar: "تخليص جمركي", zh: "清关代办" }, d: { ku: "پرۆسەی گومرگ بەبێ سەرئێشە بۆ تۆ ئەنجام دەدەین", en: "We handle the customs process hassle-free", ar: "نتولى إجراءات الجمارك دون عناء", zh: "省心搞定清关流程" } },
    { icon: Search, t: { ku: "شوێنکەوتنی زیندوو", en: "Live tracking", ar: "تتبع مباشر", zh: "实时追踪" }, d: { ku: "لە هەموو قۆناغێک بزانە بارەکەت لەکوێیە", en: "Know where your cargo is at every stage", ar: "اعرف موقع شحنتك في كل مرحلة", zh: "每个阶段都掌握货物位置" } },
    { icon: Sparkles, t: { ku: "شەفافیەتی تەواو", en: "Full transparency", ar: "شفافية كاملة", zh: "完全透明" }, d: { ku: "نرخ و تێچوو ڕوون، بەبێ سوپرایز", en: "Clear prices and costs, no surprises", ar: "أسعار وتكاليف واضحة بلا مفاجآت", zh: "价格成本清晰，无隐藏费用" } },
  ];

  const steps = [
    { icon: Warehouse, t: { ku: "وەرگرتن لە چین", en: "Received in China", ar: "الاستلام في الصين", zh: "在中国接收" }, d: { ku: "بارەکەت دەگاتە بنکەکەمان و پشکنین دەکرێت", en: "Your goods arrive at our hub and get checked", ar: "تصل بضاعتك إلى مركزنا ويتم فحصها", zh: "货物到达我们的仓库并验货" } },
    { icon: Plane, t: { ku: "لە ڕێگادا", en: "On the way", ar: "في الطريق", zh: "运输途中" }, d: { ku: "بە ئاسمان یان دەریا بۆ عێراق دەنێردرێت", en: "Shipped by air or sea to Iraq", ar: "يُشحن جواً أو بحراً إلى العراق", zh: "空运或海运至伊拉克" } },
    { icon: MapPin, t: { ku: "گەیشتنە عێراق", en: "Arrived in Iraq", ar: "الوصول إلى العراق", zh: "抵达伊拉克" }, d: { ku: "مامەڵەی گومرگ و ئامادەکردن بۆ گەیاندن", en: "Customs cleared and prepared for delivery", ar: "التخليص الجمركي والتجهيز للتسليم", zh: "清关并准备派送" } },
    { icon: Truck, t: { ku: "گەیاندن بە تۆ", en: "Delivered to you", ar: "التسليم إليك", zh: "送达给您" }, d: { ku: "گەیاندنی ناوخۆیی بۆ هەموو شارەکانی عێراق", en: "Domestic delivery across all of Iraq", ar: "توصيل داخلي لكل مدن العراق", zh: "覆盖全伊拉克的本地派送" } },
  ];

  const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-sky-500 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all";
  const btnWhats = "inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 hover:-translate-y-0.5 transition-all";

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen overflow-x-hidden bg-white text-slate-900 dark:text-slate-200 antialiased">
      <style>{`
        @keyframes wxfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes wxdrift{0%{transform:translateX(0)}100%{transform:translateX(40px)}}
        @keyframes wxdash{to{stroke-dashoffset:-24}}
        .wxfloat{animation:wxfloat 5s ease-in-out infinite}
        .wxfloat2{animation:wxfloat 6.5s ease-in-out infinite}
        .wxdrift{animation:wxdrift 9s ease-in-out infinite alternate}
        .wxdash{stroke-dasharray:6 8;animation:wxdash 1.2s linear infinite}
        @media (prefers-reduced-motion: reduce){.wxfloat,.wxfloat2,.wxdrift,.wxdash{animation:none}}
      `}</style>

      {/* ================= Navbar ================= */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <CompanyLogo size={36} iconClassName="h-5 w-5 text-white" fallbackBg="bg-gradient-to-br from-sky-500 to-violet-600" />
            <span className="text-lg font-black tracking-tight">{company.name}</span>
          </div>
          <nav className="hidden items-center gap-7 lg:flex">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">{L(n.label)}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/customer-login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 sm:inline-block">
              {L({ ku: "چوونەژوورەوە", en: "Sign in", ar: "تسجيل الدخول", zh: "登录" })}
            </Link>
            <a href={waLink} target="_blank" rel="noreferrer" className={btnPrimary + " !px-5 !py-2"}>
              {L({ ku: "داوای نرخ", en: "Get a quote", ar: "اطلب عرض سعر", zh: "获取报价" })}
              <ArrowRight className={"h-4 w-4 " + (isRTL ? "rotate-180" : "")} />
            </a>
          </div>
        </div>
      </header>

      {/* ================= Hero ================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="pointer-events-none absolute -top-24 end-0 h-96 w-96 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="pointer-events-none absolute top-40 start-0 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 md:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">
              <Sparkles className="h-3.5 w-3.5" /> {L({ ku: "چین → عێراق", en: "China → Iraq", ar: "الصين ← العراق", zh: "中国 → 伊拉克" })}
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
              {L({ ku: "گواستنەوەی", en: "Reliable", ar: "شحن", zh: "可靠的" })}{" "}
              <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent">
                {L({ ku: "متمانەپێکراو", en: "global shipping", ar: "موثوق", zh: "全球物流" })}
              </span>{" "}
              {L({ ku: "لە چینەوە بۆ عێراق", en: "from China to Iraq", ar: "من الصين إلى العراق", zh: "从中国到伊拉克" })}
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-600 md:text-lg">
              {L({ ku: "یاریدەدەری هەناردە/هاوردەکەت لە چین. گواستنەوەی ئاسمانی و دەریایی، کۆکردنەوە، مامەڵەی گومرگ و کۆنترۆڵی کوالیتی — هەمووی لە یەک شوێن.", en: "Your dedicated import/export partner in China. Air & sea freight, consolidation, customs clearance and quality control — all in one place.", ar: "شريكك المخصص للاستيراد/التصدير في الصين. شحن جوي وبحري، تجميع، تخليص جمركي ومراقبة الجودة — كل ذلك في مكان واحد.", zh: "您在中国的专属进出口伙伴。空运海运、集运、清关与质检——一站式服务。" })}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/customer-login" className={btnPrimary}>
                {L({ ku: "دەستپێبکە", en: "Get started", ar: "ابدأ الآن", zh: "开始使用" })}
                <ArrowRight className={"h-4 w-4 " + (isRTL ? "rotate-180" : "")} />
              </Link>
              <a href={waLink} target="_blank" rel="noreferrer" className={btnWhats}>
                <MessageCircle className="h-4 w-4" /> {L({ ku: "واتساپ", en: "WhatsApp", ar: "واتساب", zh: "WhatsApp" })}
              </a>
            </div>
            {/* Tracking bar */}
            <div className="mt-7 flex max-w-md items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800/60 bg-white p-1.5 shadow-sm">
              <Search className="ms-3 h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") track(); }}
                placeholder={L({ ku: "ژمارەی تراکینگ...", en: "Tracking number...", ar: "رقم التتبع...", zh: "追踪单号……" })}
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
              />
              <button onClick={track} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                {L({ ku: "شوێنکەوتن", en: "Track", ar: "تتبع", zh: "追踪" })}
              </button>
            </div>
            {/* Trust badges */}
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
              {trust.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <b.icon className="h-4 w-4 text-emerald-500" /> {L(b.label)}
                </div>
              ))}
            </div>
          </div>

          {/* Hero visual: glass tiles + route */}
          <div className="relative">
            <div className="relative mx-auto max-w-md rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-2xl ring-1 ring-white/10">
              <div className="pointer-events-none absolute -end-6 -top-6 h-24 w-24 rounded-full bg-sky-400/30 blur-2xl" />
              <div className="pointer-events-none absolute -start-6 -bottom-6 h-28 w-28 rounded-full bg-violet-400/30 blur-2xl" />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Plane, k: { ku: "ئاسمانی", en: "Air", ar: "جوي", zh: "空运" }, c: "from-sky-400 to-blue-600", cls: "wxfloat" },
                  { icon: Ship, k: { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" }, c: "from-cyan-400 to-sky-600", cls: "wxfloat2" },
                  { icon: Truck, k: { ku: "ڕێگا", en: "Road", ar: "بري", zh: "陆运" }, c: "from-violet-400 to-purple-600", cls: "wxfloat2" },
                  { icon: Package, k: { ku: "کۆگا", en: "Warehouse", ar: "مستودع", zh: "仓储" }, c: "from-indigo-400 to-violet-600", cls: "wxfloat" },
                ].map((tile, i) => (
                  <div key={i} className={"rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur " + tile.cls}>
                    <span className={"mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br " + tile.c + " text-white shadow-lg"}>
                      <tile.icon className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-bold text-white">{L(tile.k)}</p>
                    <p className="text-xs text-slate-300">{company.name}</p>
                  </div>
                ))}
              </div>
              {/* route line */}
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300"><MapPin className="h-4 w-4" /></span>
                <svg viewBox="0 0 120 12" className="h-3 flex-1 text-sky-400"><line x1="4" y1="6" x2="116" y2="6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="wxdash" /></svg>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300"><MapPin className="h-4 w-4" /></span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>{L({ ku: "چین", en: "China", ar: "الصين", zh: "中国" })}</span>
                <span>{L({ ku: "عێراق", en: "Iraq", ar: "العراق", zh: "伊拉克" })}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Stats ================= */}
      <section className="border-y border-slate-100 dark:border-slate-800/60 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4 md:px-6">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-200 md:text-4xl">
                <CountUp value={s.value} />{s.suffix}
              </p>
              <p className="mt-1 text-sm text-slate-500">{L(s.label)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= Freight modes ================= */}
      <div id="modes">
        {/* Air */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800 py-16 text-white md:py-24">
          <Cloud className="wxdrift absolute top-10 start-[8%] h-12 w-28 text-white/15" />
          <Cloud className="wxdrift absolute bottom-16 end-[10%] h-16 w-36 text-white/10" style={{ animationDelay: "1.5s" }} />
          <div className="mx-auto max-w-3xl px-4 text-center md:px-6">
            <h2 className="text-3xl font-black md:text-5xl">{L({ ku: "بارەکەت بە ئاسمان بنێرە، بە دڵنیاییەوە", en: "Fly your cargo with confidence", ar: "اشحن بضاعتك جواً بثقة", zh: "安心空运您的货物" })}</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">{L({ ku: "خێراترین ڕێگا بۆ بارە بەنرخ و پەلەکان — لە چینەوە بۆ فڕۆکەخانەکانی عێراق.", en: "The fastest route for valuable, urgent cargo — from China to Iraq's airports.", ar: "أسرع مسار للبضائع الثمينة والعاجلة — من الصين إلى مطارات العراق.", zh: "贵重、紧急货物的最快通道——从中国直达伊拉克机场。" })}</p>
            <div className="wxfloat mx-auto mt-10 flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-2xl shadow-sky-500/30">
              <Plane className="h-14 w-14 text-white" />
            </div>
            <a href={waLink} target="_blank" rel="noreferrer" className={btnWhats + " mt-10"}>
              <MessageCircle className="h-4 w-4" /> {L({ ku: "قسە لەگەڵمان بکە", en: "Let's chat", ar: "دعنا نتحدث", zh: "与我们聊聊" })}
            </a>
          </div>
        </section>

        {/* Sea */}
        <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 to-white py-16 md:py-24">
          <Cloud className="wxdrift absolute top-8 end-[12%] h-12 w-28 text-white" />
          <div className="mx-auto max-w-3xl px-4 text-center md:px-6">
            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-200 md:text-5xl">
              {L({ ku: "چارەسەری", en: "Global", ar: "حلول", zh: "全球" })}{" "}
              <span className="bg-gradient-to-r from-cyan-500 to-sky-600 bg-clip-text text-transparent">{L({ ku: "گواستنەوەی دەریایی", en: "sea freight", ar: "الشحن البحري", zh: "海运方案" })}</span>{" "}
              {L({ ku: "جیهانی", en: "solutions", ar: "عالمية", zh: "" })}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-600">{L({ ku: "کەمترین تێچوو بۆ بارە گەورە و قورسەکان، بە کۆنتەینەری تەواو یان بەشێک.", en: "The lowest cost for large, heavy cargo — full container or part load.", ar: "أقل تكلفة للشحنات الكبيرة والثقيلة — حاوية كاملة أو جزئية.", zh: "大宗重货的最低成本——整柜或拼箱。" })}</p>
            <div className="wxfloat2 mx-auto mt-10 flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-sky-600 shadow-2xl shadow-cyan-500/30">
              <Ship className="h-14 w-14 text-white" />
            </div>
            <a href={waLink} target="_blank" rel="noreferrer" className={btnPrimary + " mt-10"}>
              {L({ ku: "قسە لەگەڵمان بکە", en: "Let's chat", ar: "دعنا نتحدث", zh: "与我们聊聊" })}
              <ArrowRight className={"h-4 w-4 " + (isRTL ? "rotate-180" : "")} />
            </a>
          </div>
        </section>

        {/* Road */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50 py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center md:px-6">
            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-200 md:text-5xl">
              {L({ ku: "گەیاندنی ناوخۆیی", en: "Comprehensive road delivery" , ar: "توصيل بري شامل", zh: "全面的陆运派送" })}{" "}
              <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">{L({ ku: "بۆ هەموو عێراق", en: "across all Iraq", ar: "لكل العراق", zh: "覆盖全伊拉克" })}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-600">{L({ ku: "دوای گەیشتن، بارەکەت دەگەیەنینە دەرگای ماڵ یان کارگەکەت لە هەموو شارەکان.", en: "Once it arrives, we deliver to your door or business in every city.", ar: "بعد الوصول، نوصل إلى بابك أو عملك في كل مدينة.", zh: "货物抵达后，我们派送到各城市的您门口或公司。" })}</p>
            <div className="wxfloat mx-auto mt-10 flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-400 to-purple-600 shadow-2xl shadow-violet-500/30">
              <Truck className="h-14 w-14 text-white" />
            </div>
            {/* road line */}
            <div className="mx-auto mt-8 h-1 max-w-sm rounded-full bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          </div>
        </section>
      </div>

      {/* ================= Services ================= */}
      <section id="services" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-200 md:text-4xl">{L({ ku: "خزمەتگوزارییەکانی گواستنەوە", en: "Transport services", ar: "خدمات النقل", zh: "运输服务" })}</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">{L({ ku: "خزمەتگوزاری تەواو کە هەموو ڕێگای چین بۆ عێراق دەگرێتەوە.", en: "Comprehensive services spanning the whole China-to-Iraq journey.", ar: "خدمات شاملة تغطي كامل رحلة الصين إلى العراق.", zh: "覆盖中国到伊拉克全程的综合服务。" })}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <div key={i} className="group rounded-3xl border border-slate-200 dark:border-slate-800/60 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-sky-200">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-lg transition-transform group-hover:scale-105">
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">{L(s.t)}</h3>
              <p className="mt-2 text-sm text-slate-600">{L(s.d)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= Global route ================= */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-16 text-white md:py-24">
        <div className="mx-auto max-w-5xl px-4 text-center md:px-6">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-sky-400">{L({ ku: "ناوچەی خزمەت", en: "Service area", ar: "منطقة الخدمة", zh: "服务区域" })}</span>
          <h2 className="mt-3 text-3xl font-black md:text-5xl">{L({ ku: "پردی نێوان چین و عێراق", en: "The bridge between China & Iraq", ar: "الجسر بين الصين والعراق", zh: "连接中国与伊拉克的桥梁" })}</h2>
          <div className="mt-12 flex items-center justify-center gap-4 md:gap-8">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><Warehouse className="h-8 w-8 text-sky-300" /></div>
              <p className="mt-3 font-bold">{L({ ku: "چین", en: "China", ar: "الصين", zh: "中国" })}</p>
              <p className="text-xs text-slate-400">{L({ ku: "بنکە و کۆکردنەوە", en: "Hub & sourcing", ar: "مركز وتجميع", zh: "仓储与采购" })}</p>
            </div>
            <svg viewBox="0 0 200 40" className="h-10 flex-1 max-w-xs text-sky-400">
              <path d="M6 20 Q100 -6 194 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="wxdash" />
              <circle cx="100" cy="7" r="4" fill="#a78bfa" className="wxfloat" />
              <circle cx="6" cy="20" r="4" fill="#38bdf8" />
              <circle cx="194" cy="20" r="4" fill="#a78bfa" />
            </svg>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20"><MapPin className="h-8 w-8 text-violet-300" /></div>
              <p className="mt-3 font-bold">{L({ ku: "عێراق", en: "Iraq", ar: "العراق", zh: "伊拉克" })}</p>
              <p className="text-xs text-slate-400">{L({ ku: "گومرگ و گەیاندن", en: "Customs & delivery", ar: "جمارك وتوصيل", zh: "清关与派送" })}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Why us ================= */}
      <section id="why" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-200 md:text-4xl">{L({ ku: "بۆچی وەزن هەڵبژێریت؟", en: "Why choose us?", ar: "لماذا تختارنا؟", zh: "为什么选择我们？" })}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {why.map((w, i) => (
            <div key={i} className="flex gap-4 rounded-3xl border border-slate-200 dark:border-slate-800/60 bg-white p-6 shadow-sm">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-violet-100 text-violet-600">
                <w.icon className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">{L(w.t)}</h3>
                <p className="mt-1 text-sm text-slate-600">{L(w.d)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= How it works ================= */}
      <section id="how" className="bg-slate-50 dark:bg-slate-950/40 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-200 md:text-4xl">{L({ ku: "چۆن کاردەکات", en: "How it works", ar: "كيف يعمل", zh: "运作方式" })}</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">{L({ ku: "چوار هەنگاوی سادە لە چینەوە تا دەرگای ماڵت.", en: "Four simple steps from China to your door.", ar: "أربع خطوات بسيطة من الصين إلى بابك.", zh: "从中国到您家门口，仅需四步。" })}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={i} className="relative rounded-3xl border border-slate-200 dark:border-slate-800/60 bg-white p-6 shadow-sm">
                <span className="absolute -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-600 text-sm font-black text-white shadow-lg" style={isRTL ? { right: "1.5rem" } : { left: "1.5rem" }}>{i + 1}</span>
                <span className="mb-4 mt-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300">
                  <s.icon className="h-6 w-6" />
                </span>
                <h3 className="font-bold text-slate-900 dark:text-slate-200">{L(s.t)}</h3>
                <p className="mt-1 text-sm text-slate-600">{L(s.d)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section id="contact" className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-blue-700 to-violet-700 py-16 text-white md:py-20">
        <div className="pointer-events-none absolute -top-16 end-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="mx-auto max-w-3xl px-4 text-center md:px-6">
          <h2 className="text-3xl font-black md:text-4xl">{L({ ku: "ئامادەیت بارەکەت بگوازیتەوە؟", en: "Ready to ship your cargo?", ar: "جاهز لشحن بضاعتك؟", zh: "准备好发货了吗？" })}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">{L({ ku: "پەیوەندیمان پێوە بکە بۆ نرخێکی بێبەرامبەر و ڕاوێژکاری.", en: "Talk to us for a free quote and a consultation.", ar: "تواصل معنا للحصول على عرض سعر مجاني واستشارة.", zh: "联系我们获取免费报价与咨询。" })}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 dark:text-slate-200 shadow-lg hover:-translate-y-0.5 transition-all">
              <MessageCircle className="h-4 w-4 text-emerald-500" /> {L({ ku: "واتساپ", en: "WhatsApp", ar: "واتساب", zh: "WhatsApp" })}
            </a>
            <Link href="/customer-login" className="inline-flex items-center gap-2 rounded-full bg-white/15 px-6 py-3 text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25 transition-all">
              {L({ ku: "چوونەژوورەوەی کڕیار", en: "Customer portal", ar: "بوابة العميل", zh: "客户门户" })}
            </Link>
          </div>
        </div>
      </section>

      {/* ================= Footer ================= */}
      <footer className="bg-slate-900 py-12 text-slate-400">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <CompanyLogo size={32} iconClassName="h-4 w-4 text-white" fallbackBg="bg-gradient-to-br from-sky-500 to-violet-600" />
              <span className="text-lg font-black text-white">{company.name}</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
              {company.phone && (
                <a href={`tel:${company.phone}`} className="flex items-center gap-1.5 hover:text-white"><PhoneCall className="h-4 w-4" /> {company.phone}</a>
              )}
              {company.email && (
                <a href={`mailto:${company.email}`} className="flex items-center gap-1.5 hover:text-white"><Mail className="h-4 w-4" /> {company.email}</a>
              )}
              <Link href="/customer-login" className="hover:text-white">{L({ ku: "چوونەژوورەوە", en: "Sign in", ar: "تسجيل الدخول", zh: "登录" })}</Link>
            </div>
          </div>
          <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs">
            © {company.name} — {L({ ku: "گواستنەوەی چین بۆ عێراق. هەموو مافەکان پارێزراون.", en: "China-to-Iraq shipping. All rights reserved.", ar: "شحن من الصين إلى العراق. جميع الحقوق محفوظة.", zh: "中国到伊拉克运输。版权所有。" })}
          </div>
        </div>
      </footer>
    </div>
  );
}
