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
  Wallet, FileCheck2, PhoneCall, Mail,
} from "lucide-react";

/**
 * "Logistick" landing variant — a premium public landing for the China → Iraq
 * route styled after the Logistick logistics HTML template. Red accent
 * (#dc2626) over deep navy-teal (#07485E) dark bands and light neutral
 * sections. Uses the copied /theme PNG decorations (about-plane, bg-pattern,
 * call-to-action-shape) as faint low-opacity accents. Fully RTL-aware and
 * localised (ku / en / ar / zh) via pickLang. Self-contained, no external libs.
 */

const NAVY = "#07485E";

type Loc = { ku: string; en: string; ar: string; zh: string };

export default function HomeLogistick() {
  const { language, isRTL } = useTranslation();
  const company = useCompanyInfo();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tracking, setTracking] = useState("");
  const L = (v: Loc) => pickLang(language, v);

  useEffect(() => {
    if (!loading && user) setLocation(user.role === "customer" ? "/portal" : "/dashboard");
  }, [user, loading, setLocation]);

  const waPhone = (company.phone || "").replace(/[^\d]/g, "");
  const waLink = waPhone ? `https://wa.me/${waPhone}` : "/customer-login";
  const track = () => { if (tracking.trim()) setLocation(`/customer-login?track=${encodeURIComponent(tracking.trim())}`); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NAVY }}>
        <p className="animate-pulse text-2xl font-black text-white">{company.name}</p>
      </div>
    );
  }

  const nav = [
    { href: "#services", label: { ku: "خزمەتگوزاری", en: "Services", ar: "الخدمات", zh: "服务" } },
    { href: "#why", label: { ku: "بۆچی ئێمە", en: "Why us", ar: "لماذا نحن", zh: "为何选我们" } },
    { href: "#how", label: { ku: "چۆن کاردەکات", en: "How it works", ar: "كيف يعمل", zh: "运作方式" } },
    { href: "#contact", label: { ku: "پەیوەندی", en: "Contact", ar: "اتصل", zh: "联系" } },
  ];

  const trust = [
    { icon: ShieldCheck, label: { ku: "فرۆشیاری پشتڕاستکراو", en: "Verified suppliers", ar: "موردون موثوقون", zh: "认证供应商" } },
    { icon: CheckCircle2, label: { ku: "کوالیتی سەرتاسەری", en: "End-to-end quality", ar: "جودة شاملة", zh: "全程品控" } },
    { icon: Globe2, label: { ku: "پشتگیری چەند زمانی", en: "Multilingual support", ar: "دعم متعدد اللغات", zh: "多语言支持" } },
  ];

  const features = [
    { icon: Truck, t: { ku: "گەیاندنی خێرا و پارێزراو", en: "Fast & secure delivery", ar: "توصيل سريع وآمن", zh: "快速安全的派送" }, d: { ku: "بارەکەت بە سەلامەتی و لە کاتی خۆیدا دەگات", en: "Your cargo arrives safely and on time", ar: "تصل بضاعتك بأمان وفي الوقت المحدد", zh: "货物安全准时送达" } },
    { icon: Warehouse, t: { ku: "یارمەتی بار و کۆگاکردن", en: "Full freight & warehousing", ar: "شحن وتخزين كامل", zh: "全程货运与仓储" }, d: { ku: "کۆگا لە چین، کۆکردنەوە و ئامادەکردنی بار", en: "China warehouse, consolidation & prep", ar: "مستودع في الصين، تجميع وتجهيز", zh: "中国仓库、集运与备货" } },
    { icon: ShieldCheck, t: { ku: "فرۆشیاری پشتڕاستکراو", en: "Verified suppliers", ar: "موردون موثوقون", zh: "认证供应商" }, d: { ku: "پشکنینی کوالیتی پێش ناردن", en: "Quality checks before we ship", ar: "فحص الجودة قبل الشحن", zh: "发货前的质量检查" } },
    { icon: Search, t: { ku: "شوێنکەوتنی زیندوو", en: "Live tracking", ar: "تتبع مباشر", zh: "实时追踪" }, d: { ku: "لە هەموو قۆناغێک بزانە بارەکەت لەکوێیە", en: "Know where your cargo is at every stage", ar: "اعرف موقع شحنتك في كل مرحلة", zh: "全程掌握货物位置" } },
  ];

  const services = [
    { icon: Plane, t: { ku: "گواستنەوەی ئاسمانی", en: "Air freight", ar: "الشحن الجوي", zh: "空运" }, d: { ku: "گەیاندنی خێرا لە چینەوە بۆ عێراق", en: "Fast delivery from China to Iraq", ar: "توصيل سريع من الصين إلى العراق", zh: "从中国到伊拉克的快速运输" } },
    { icon: Ship, t: { ku: "گواستنەوەی دەریایی", en: "Sea freight", ar: "الشحن البحري", zh: "海运" }, d: { ku: "تێچووی کەم بۆ بارە گەورەکان", en: "Low cost for large cargo", ar: "تكلفة منخفضة للشحنات الكبيرة", zh: "大宗货物低成本" } },
    { icon: Boxes, t: { ku: "کۆکردنەوەی بار", en: "Consolidation", ar: "تجميع الشحنات", zh: "拼箱集运" }, d: { ku: "کۆکردنەوەی چەند پاکەت لە یەک بار", en: "Combine many parcels into one shipment", ar: "دمج عدة طرود في شحنة واحدة", zh: "多个包裹合并为一票" } },
    { icon: FileCheck2, t: { ku: "بیمەی بار", en: "Cargo insurance", ar: "تأمين البضائع", zh: "货物保险" }, d: { ku: "پاراستنی بارەکەت لە هەموو ڕێگادا", en: "Protect your cargo the whole way", ar: "حماية بضاعتك طوال الطريق", zh: "全程保障您的货物" } },
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
    { icon: CheckCircle2, t: { ku: "شەفافیەتی تەواو", en: "Full transparency", ar: "شفافية كاملة", zh: "完全透明" }, d: { ku: "نرخ و تێچوو ڕوون، بەبێ سوپرایز", en: "Clear prices and costs, no surprises", ar: "أسعار وتكاليف واضحة بلا مفاجآت", zh: "价格成本清晰，无隐藏费用" } },
  ];

  const steps = [
    { icon: Warehouse, t: { ku: "وەرگرتن لە چین", en: "Received in China", ar: "الاستلام في الصين", zh: "在中国接收" }, d: { ku: "بارەکەت دەگاتە بنکەکەمان و پشکنین دەکرێت", en: "Your goods arrive at our hub and get checked", ar: "تصل بضاعتك إلى مركزنا ويتم فحصها", zh: "货物到达我们的仓库并验货" } },
    { icon: Plane, t: { ku: "لە ڕێگادا", en: "On the way", ar: "في الطريق", zh: "运输途中" }, d: { ku: "بە ئاسمان یان دەریا بۆ عێراق دەنێردرێت", en: "Shipped by air or sea to Iraq", ar: "يُشحن جواً أو بحراً إلى العراق", zh: "空运或海运至伊拉克" } },
    { icon: MapPin, t: { ku: "گەیشتنە عێراق", en: "Arrived in Iraq", ar: "الوصول إلى العراق", zh: "抵达伊拉克" }, d: { ku: "مامەڵەی گومرگ و ئامادەکردن بۆ گەیاندن", en: "Customs cleared and prepared for delivery", ar: "التخليص الجمركي والتجهيز للتسليم", zh: "清关并准备派送" } },
    { icon: Truck, t: { ku: "گەیاندن بە تۆ", en: "Delivered to you", ar: "التسليم إليك", zh: "送达给您" }, d: { ku: "گەیاندنی ناوخۆیی بۆ هەموو شارەکانی عێراق", en: "Domestic delivery across all of Iraq", ar: "توصيل داخلي لكل مدن العراق", zh: "覆盖全伊拉克的本地派送" } },
  ];

  const btnRed = "inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/25 hover:bg-red-700 hover:-translate-y-0.5 transition-all";
  const btnWhats = "inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 hover:-translate-y-0.5 transition-all";

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen overflow-x-hidden bg-white dark:bg-card text-slate-900 dark:text-slate-200 antialiased">
      <style>{`
        @keyframes lkdrift{0%{transform:translateX(0) translateY(0)}50%{transform:translateX(28px) translateY(-10px)}100%{transform:translateX(0) translateY(0)}}
        @keyframes lkfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes lkdash{to{stroke-dashoffset:-24}}
        .lkdrift{animation:lkdrift 16s ease-in-out infinite}
        .lkfloat{animation:lkfloat 5s ease-in-out infinite}
        .lkfloat2{animation:lkfloat 6.5s ease-in-out infinite}
        .lkdash{stroke-dasharray:6 8;animation:lkdash 1.4s linear infinite}
        @media (prefers-reduced-motion: reduce){.lkdrift,.lkfloat,.lkfloat2,.lkdash{animation:none}}
      `}</style>

      {/* ================= Navbar ================= */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 dark:border-slate-800/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <CompanyLogo size={36} iconClassName="h-5 w-5 text-white" fallbackBg="bg-red-600" />
            <span className="text-lg font-black tracking-tight">{company.name}</span>
          </div>
          <nav className="hidden items-center gap-7 lg:flex">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-red-600 transition-colors">{L(n.label)}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/customer-login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 sm:inline-block">
              {L({ ku: "چوونەژوورەوە", en: "Sign in", ar: "تسجيل الدخول", zh: "登录" })}
            </Link>
            <a href={waLink} target="_blank" rel="noreferrer" className={btnRed + "!px-5 !py-2"}>
              {L({ ku: "داوای نرخ", en: "Get a quote", ar: "اطلب عرض سعر", zh: "获取报价" })}
              <ArrowRight className={"h-4 w-4" + (isRTL ? "rotate-180" : "")} />
            </a>
          </div>
        </div>
      </header>

      {/* ================= Hero ================= */}
      <section className="relative overflow-hidden bg-neutral-50 dark:bg-neutral-950/40">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "url(/theme/bg-pattern.png)", backgroundSize: "480px" }}
          aria-hidden
        />
        <img
          src="/theme/about-plane.png"
          alt=""
          aria-hidden
          loading="lazy"
          className="lkdrift pointer-events-none absolute -top-6 end-[6%] w-64 max-w-[45%] opacity-10 md:w-80"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 md:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-700 dark:text-red-300">
              <Plane className="h-3.5 w-3.5" /> {L({ ku: "چین → عێراق", en: "China → Iraq", ar: "الصين ← العراق", zh: "中国 → 伊拉克" })}
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
              {L({ ku: "گواستنەوەی", en: "Reliable", ar: "شحن", zh: "可靠的" })}{" "}
              <span className="text-red-600 dark:text-red-300">
                {L({ ku: "متمانەپێکراو", en: "shipping", ar: "موثوق", zh: "物流" })}
              </span>{" "}
              {L({ ku: "لە چینەوە بۆ عێراق", en: "from China to Iraq", ar: "من الصين إلى العراق", zh: "从中国到伊拉克" })}
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-600 dark:text-slate-300 md:text-lg">
              {L({ ku: "یاریدەدەری هەناردە/هاوردەکەت لە چین. گواستنەوەی ئاسمانی و دەریایی، کۆکردنەوە، مامەڵەی گومرگ و کۆنترۆڵی کوالیتی — هەمووی لە یەک شوێن.", en: "Your dedicated import/export partner in China. Air & sea freight, consolidation, customs clearance and quality control — all in one place.", ar: "شريكك المخصص للاستيراد/التصدير في الصين. شحن جوي وبحري، تجميع، تخليص جمركي ومراقبة الجودة — كل ذلك في مكان واحد.", zh: "您在中国的专属进出口伙伴。空运海运、集运、清关与质检——一站式服务。" })}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/customer-login" className={btnRed}>
                {L({ ku: "دەستپێبکە", en: "Get started", ar: "ابدأ الآن", zh: "开始使用" })}
                <ArrowRight className={"h-4 w-4" + (isRTL ? "rotate-180" : "")} />
              </Link>
              <a href={waLink} target="_blank" rel="noreferrer" className={btnWhats}>
                <MessageCircle className="h-4 w-4" /> {L({ ku: "واتساپ", en: "WhatsApp", ar: "واتساب", zh: "WhatsApp" })}
              </a>
            </div>
            {/* Tracking bar */}
            <div className="mt-7 flex max-w-md items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-card p-1.5 shadow-sm">
              <Search className="ms-3 h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") track(); }}
                placeholder={L({ ku: "ژمارەی تراکینگ...", en: "Tracking number...", ar: "رقم التتبع...", zh: "追踪单号……" })}
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
              />
              <button onClick={track} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors">
                {L({ ku: "شوێنکەوتن", en: "Track", ar: "تتبع", zh: "追踪" })}
              </button>
            </div>
            {/* Trust badges */}
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
              {trust.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <b.icon className="h-4 w-4 text-red-600 dark:text-red-300" /> {L(b.label)}
                </div>
              ))}
            </div>
          </div>

          {/* Hero visual: navy-teal card with mode chips + route */}
          <div className="relative">
            <div className="relative mx-auto max-w-md rounded-[2rem] p-6 shadow-2xl ring-1 ring-white/10" style={{ backgroundColor: NAVY }}>
              <div className="pointer-events-none absolute -end-6 -top-6 h-24 w-24 rounded-full bg-red-500/25 blur-2xl" />
              <div className="pointer-events-none absolute -start-6 -bottom-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Plane, k: { ku: "ئاسمانی", en: "Air", ar: "جوي", zh: "空运" }, cls: "lkfloat", red: true },
                  { icon: Ship, k: { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" }, cls: "lkfloat2", red: false },
                  { icon: Truck, k: { ku: "ڕێگا", en: "Road", ar: "بري", zh: "陆运" }, cls: "lkfloat2", red: false },
                  { icon: Warehouse, k: { ku: "کۆگا", en: "Warehouse", ar: "مستودع", zh: "仓储" }, cls: "lkfloat", red: true },
                ].map((tile, i) => (
                  <div key={i} className={"rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur" + tile.cls}>
                    <span className={"mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg" + (tile.red ? "bg-red-600" : "bg-white/20")}>
                      <tile.icon className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-bold text-white">{L(tile.k)}</p>
                    <p className="text-xs text-white/60">{company.name}</p>
                  </div>
                ))}
              </div>
              {/* route line */}
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-300"><MapPin className="h-4 w-4" /></span>
                <svg viewBox="0 0 120 12" className="h-3 flex-1 text-red-400"><line x1="4" y1="6" x2="116" y2="6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="lkdash" /></svg>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white"><MapPin className="h-4 w-4" /></span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-semibold text-white/70">
                <span>{L({ ku: "چین", en: "China", ar: "الصين", zh: "中国" })}</span>
                <span>{L({ ku: "عێراق", en: "Iraq", ar: "العراق", zh: "伊拉克" })}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Features strip ================= */}
      <section className="border-y border-slate-100 dark:border-slate-800/60 bg-white dark:bg-card">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 md:grid-cols-2 md:px-6 lg:grid-cols-4">
          {features.map((f, i) => (
            <div key={i} className="group rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-red-200">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg transition-transform group-hover:scale-105">
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-200">{L(f.t)}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{L(f.d)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= About ================= */}
      <section className="relative overflow-hidden bg-neutral-50 dark:bg-neutral-950/40 py-16 md:py-24">
        <img
          src="/theme/about-plane.png"
          alt=""
          aria-hidden
          loading="lazy"
          className="lkdrift pointer-events-none absolute bottom-6 start-[3%] w-56 max-w-[40%] opacity-[0.08]"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 md:px-6 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="flex items-baseline gap-3">
              <span className="text-6xl font-black text-red-600 dark:text-red-300 md:text-7xl"><CountUp value={12} />+</span>
              <span className="max-w-[10rem] text-sm font-semibold text-slate-500 dark:text-slate-400">{L({ ku: "ساڵ ئەزموون لە گواستنەوەی چین بۆ عێراق", en: "years of China-to-Iraq shipping experience", ar: "سنوات خبرة في الشحن من الصين إلى العراق", zh: "年中国至伊拉克运输经验" })}</span>
            </div>
            <h2 className="mt-6 text-3xl font-black text-slate-900 dark:text-slate-200 md:text-4xl">{L({ ku: "بۆچی ئێمە بە باشترین دادەنرێین", en: "Why we're considered the best", ar: "لماذا نُعتبر الأفضل", zh: "为何我们被视为最佳之选" })}</h2>
            <p className="mt-4 max-w-xl text-slate-600 dark:text-slate-300">{L({ ku: "لە بنکەکەمانەوە لە چین تا دەرگای ماڵت لە عێراق، هەموو هەنگاوێک بە شەفافیەت و کوالیتییەوە بەڕێوە دەبەین.", en: "From our hub in China to your door in Iraq, we manage every step with transparency and quality.", ar: "من مركزنا في الصين إلى بابك في العراق، ندير كل خطوة بشفافية وجودة.", zh: "从我们在中国的仓库到您在伊拉克的家门口，我们以透明和品质管理每一步。" })}</p>
            <ul className="mt-6 space-y-3">
              {[
                { ku: "بنکەی خۆمان لە چین بۆ وەرگرتن و پشکنین", en: "Our own hub in China for receiving & inspection", ar: "مركزنا الخاص في الصين للاستلام والفحص", zh: "我们在中国的自有仓库负责接收与验货" },
                { ku: "مامەڵەی گومرگ بەبێ سەرئێشە", en: "Hassle-free customs clearance", ar: "تخليص جمركي دون عناء", zh: "省心的清关服务" },
                { ku: "شوێنکەوتنی زیندوو بۆ هەموو بارێک", en: "Live tracking for every shipment", ar: "تتبع مباشر لكل شحنة", zh: "每票货物的实时追踪" },
                { ku: "پشتگیری بە چوار زمان", en: "Support in four languages", ar: "دعم بأربع لغات", zh: "四种语言的客户支持" },
              ].map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
                  <span className="text-sm font-medium">{L(b)}</span>
                </li>
              ))}
            </ul>
            <a href={waLink} target="_blank" rel="noreferrer" className={btnRed + "mt-8"}>
              {L({ ku: "پەیوەندیمان پێوە بکە", en: "Get in touch", ar: "تواصل معنا", zh: "联系我们" })}
              <ArrowRight className={"h-4 w-4" + (isRTL ? "rotate-180" : "")} />
            </a>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-md rounded-[2rem] p-8 text-white shadow-2xl" style={{ backgroundColor: NAVY }}>
              <div className="pointer-events-none absolute -end-5 -top-5 h-24 w-24 rounded-full bg-red-500/25 blur-2xl" />
              <div className="grid grid-cols-2 gap-6">
                {stats.map((s, i) => (
                  <div key={i} className="text-center">
                    <p className="text-3xl font-black text-white md:text-4xl">
                      <span className="text-red-400"><CountUp value={s.value} />{s.suffix}</span>
                    </p>
                    <p className="mt-1 text-xs text-white/70">{L(s.label)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <Globe2 className="h-5 w-5 text-red-300" />
                <p className="text-sm font-semibold">{L({ ku: "پردی متمانەپێکراو نێوان چین و عێراق", en: "A trusted bridge between China & Iraq", ar: "جسر موثوق بين الصين والعراق", zh: "连接中国与伊拉克的可靠桥梁" })}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Services ================= */}
      <section id="services" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <div className="mb-12 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-red-600 dark:text-red-300">{L({ ku: "خزمەتگوزارییەکانمان", en: "Our services", ar: "خدماتنا", zh: "我们的服务" })}</span>
          <h2 className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-200 md:text-4xl">{L({ ku: "خزمەتگوزارییەکانی گواستنەوە", en: "Transport services", ar: "خدمات النقل", zh: "运输服务" })}</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">{L({ ku: "خزمەتگوزاری تەواو کە هەموو ڕێگای چین بۆ عێراق دەگرێتەوە.", en: "Comprehensive services spanning the whole China-to-Iraq journey.", ar: "خدمات شاملة تغطي كامل رحلة الصين إلى العراق.", zh: "覆盖中国到伊拉克全程的综合服务。" })}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <div key={i} className="group rounded-3xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-red-200">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg transition-transform group-hover:scale-105">
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">{L(s.t)}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{L(s.d)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= Counter band ================= */}
      <section className="relative overflow-hidden py-16 text-white md:py-20" style={{ backgroundColor: NAVY }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "url(/theme/bg-pattern.png)", backgroundSize: "420px" }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 md:grid-cols-4 md:px-6">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-4xl font-black tracking-tight md:text-5xl">
                <span className="text-red-400"><CountUp value={s.value} />{s.suffix}</span>
              </p>
              <p className="mt-2 text-sm text-white/75">{L(s.label)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= Why us ================= */}
      <section id="why" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <div className="mb-12 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-red-600 dark:text-red-300">{L({ ku: "بۆچی ئێمە", en: "Why us", ar: "لماذا نحن", zh: "为何选我们" })}</span>
          <h2 className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-200 md:text-4xl">{L({ ku: "بۆچی وەزن هەڵبژێریت؟", en: "Why choose us?", ar: "لماذا تختارنا؟", zh: "为什么选择我们？" })}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {why.map((w, i) => (
            <div key={i} className="flex gap-4 rounded-3xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-red-200">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300">
                <w.icon className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">{L(w.t)}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{L(w.d)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= How it works ================= */}
      <section id="how" className="bg-neutral-50 dark:bg-neutral-950/40 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-12 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-red-600 dark:text-red-300">{L({ ku: "پرۆسەکە", en: "The process", ar: "العملية", zh: "流程" })}</span>
            <h2 className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-200 md:text-4xl">{L({ ku: "چۆن کاردەکات", en: "How it works", ar: "كيف يعمل", zh: "运作方式" })}</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">{L({ ku: "چوار هەنگاوی سادە لە چینەوە تا دەرگای ماڵت.", en: "Four simple steps from China to your door.", ar: "أربع خطوات بسيطة من الصين إلى بابك.", zh: "从中国到您家门口，仅需四步。" })}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={i} className="relative rounded-3xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-card p-6 pt-8 shadow-sm">
                <span className="absolute -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-black text-white shadow-lg" style={isRTL ? { right: "1.5rem" } : { left: "1.5rem" }}>{i + 1}</span>
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: NAVY }}>
                  <s.icon className="h-6 w-6" />
                </span>
                <h3 className="font-bold text-slate-900 dark:text-slate-200">{L(s.t)}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{L(s.d)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA band ================= */}
      <section id="contact" className="relative overflow-hidden py-16 text-white md:py-20" style={{ background: `linear-gradient(120deg, #dc2626 0%, ${NAVY} 100%)` }}>
        <img
          src="/theme/call-to-action-shape.png"
          alt=""
          aria-hidden
          loading="lazy"
          className="pointer-events-none absolute bottom-0 end-0 w-72 max-w-[40%] opacity-20"
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center md:px-6">
          <h2 className="text-3xl font-black md:text-4xl">{L({ ku: "ئامادەیت بارەکەت بگوازیتەوە؟", en: "Ready to ship your cargo?", ar: "جاهز لشحن بضاعتك؟", zh: "准备好发货了吗？" })}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">{L({ ku: "پەیوەندیمان پێوە بکە بۆ نرخێکی بێبەرامبەر و ڕاوێژکاری.", en: "Talk to us for a free quote and a consultation.", ar: "تواصل معنا للحصول على عرض سعر مجاني واستشارة.", zh: "联系我们获取免费报价与咨询。" })}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-card px-6 py-3 text-sm font-bold text-slate-900 dark:text-slate-200 shadow-lg hover:-translate-y-0.5 transition-all">
              <MessageCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> {L({ ku: "واتساپ", en: "WhatsApp", ar: "واتساب", zh: "WhatsApp" })}
            </a>
            <Link href="/customer-login" className="inline-flex items-center gap-2 rounded-full bg-white/15 px-6 py-3 text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25 transition-all">
              {L({ ku: "چوونەژوورەوەی کڕیار", en: "Customer portal", ar: "بوابة العميل", zh: "客户门户" })}
            </Link>
          </div>
        </div>
      </section>

      {/* ================= Footer ================= */}
      <footer className="py-12 text-white/70" style={{ backgroundColor: NAVY }}>
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <CompanyLogo size={32} iconClassName="h-4 w-4 text-white" fallbackBg="bg-red-600" />
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
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-white/50">
            <Clock className="h-3.5 w-3.5" />
            <span>© {company.name} — {L({ ku: "گواستنەوەی چین بۆ عێراق. هەموو مافەکان پارێزراون.", en: "China-to-Iraq shipping. All rights reserved.", ar: "شحن من الصين إلى العراق. جميع الحقوق محفوظة.", zh: "中国到伊拉克运输。版权所有。" })}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
