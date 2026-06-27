import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CompanyLogo from "@/components/CompanyLogo";
import {
  Package, Plane, Ship, Shield, Users, MapPin, Clock,
  Phone, Mail, Facebook, Instagram, Truck, Headphones,
  ChevronLeft, Search, ShoppingCart, ClipboardCheck, HelpCircle, DollarSign,
  AlertTriangle, Wallet, Receipt, Send,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";

/**
 * "Professional" landing variant — modelled section-by-section on himaciq.com
 * (Himak by WaznEx, the sister product) for brand consistency: a premium dark
 * teal-charcoal palette, bright emerald-teal accents, large white headlines,
 * and glass cards. The STRUCTURE mirrors Himak's page (hero → problem →
 * how it works → portal showcase → features → contact), not just the colors.
 * Self-contained palette, independent of the landing-theme toggle.
 */

const TEAL = "#2dd4bf";
const BG = "radial-gradient(1100px 560px at 12% -5%, rgba(190,214,210,0.14), transparent 55%), radial-gradient(900px 520px at 88% 12%, rgba(20,184,166,0.12), transparent 55%), linear-gradient(165deg, #0e2a26 0%, #0a1f1d 48%, #06120f 100%)";
const CARD = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.10)";
const tealBtn = `linear-gradient(180deg, ${TEAL}, #14b8a6)`;

export default function HomeProfessional() {
  const { t } = useTranslation();
  const company = useCompanyInfo();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", business: "" });

  useEffect(() => {
    if (!loading && user) setLocation(user.role === "customer" ? "/portal" : "/dashboard");
  }, [user, loading, setLocation]);

  const handleTrack = () => {
    if (trackingNumber.trim()) setLocation(`/customer-login?track=${trackingNumber}`);
  };

  const handleContact = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = [
      `${t("home.contactName") || "ناو"}: ${form.name}`,
      `${t("home.contactPhone") || "مۆبایل"}: ${form.phone}`,
      form.business ? `${t("home.contactBusiness") || "بازرگانی"}: ${form.business}` : "",
    ].filter(Boolean).join("\n");
    const phone = (company.phone || "").replace(/[^\d]/g, "");
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, "_blank");
    } else if (company.email) {
      window.location.href = `mailto:${company.email}?subject=${encodeURIComponent(t("home.contactTitle") || "داواکاری")}&body=${encodeURIComponent(lines)}`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a1f1d" }}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <CompanyLogo size={48} fallbackBg="bg-teal-500" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-300 overflow-x-hidden antialiased" style={{ background: BG, backgroundAttachment: "fixed" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ borderColor: BORDER, background: "rgba(8,20,18,0.55)", backdropFilter: "blur(14px)" }}>
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CompanyLogo size={32} fallbackBg="bg-teal-500" />
            <div className="leading-tight">
              <span className="text-lg font-bold text-white">{company.name}</span>
              <p className="text-[10px] tracking-wider uppercase" style={{ color: TEAL }}>{t("auto.text_6fcd11")}</p>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-8">
            <a href="#problem" className="text-sm text-slate-300 hover:text-white transition-colors">{t("home.problemTitle") || "کێشەکان"}</a>
            <a href="#how" className="text-sm text-slate-300 hover:text-white transition-colors">{t("home.howItWorks") || "چۆن کاردەکات"}</a>
            <a href="#features" className="text-sm text-slate-300 hover:text-white transition-colors">{t("home.features")}</a>
            <a href="#contact" className="text-sm text-slate-300 hover:text-white transition-colors">{t("home.contact")}</a>
          </nav>
          <Link href="/customer-login">
            <Button className="rounded-full text-[#06231f] font-semibold hover:opacity-90" style={{ background: tealBtn }}>
              <Users className="me-2 h-4 w-4" />
              <span className="hidden sm:inline">{t("home.customerPortal")}</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="container mx-auto px-4 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-start">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium" style={{ color: TEAL, border: `1px solid rgba(45,212,191,0.30)`, background: "rgba(45,212,191,0.06)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: TEAL }} /> {t("home.fastReliable")}
              </span>
              <h1 className="mt-6 mb-5 font-extrabold tracking-tight leading-[1.05]">
                <span className="block text-4xl md:text-5xl lg:text-6xl" style={{ color: TEAL }}>{company.name}</span>
                <span className="block text-3xl md:text-4xl lg:text-[3.1rem] text-white mt-1">{t("auto.text_4904bd")} {t("auto.text_33d433")}</span>
              </h1>
              <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">{t("home.heroDescription")}</p>
              <div className="flex items-center gap-2 rounded-xl p-2 max-w-lg mx-auto lg:mx-0" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <Search className="h-5 w-5 ms-2 text-slate-500 flex-shrink-0" />
                <Input type="text" placeholder={t("home.trackingPlaceholder")} value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleTrack()}
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-white placeholder:text-slate-500 h-10" />
                <Button onClick={handleTrack} className="rounded-lg text-[#06231f] font-semibold px-5 h-10 flex-shrink-0" style={{ background: tealBtn }}>{t("home.quickTrack")}</Button>
              </div>
              <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link href="/customer-login">
                  <Button size="lg" className="rounded-full text-[#06231f] font-semibold w-full sm:w-auto hover:opacity-90" style={{ background: tealBtn, boxShadow: "0 10px 30px -10px rgba(20,184,166,0.5)" }}>
                    <Users className="me-2 h-5 w-5" /> {t("auto.text_623179")}
                  </Button>
                </Link>
                <a href="#how">
                  <Button size="lg" variant="outline" className="rounded-full bg-transparent text-white w-full sm:w-auto hover:bg-white/5" style={{ borderColor: BORDER }}>
                    {t("home.howItWorks") || "چۆن کاردەکات"} <ChevronLeft className="ms-1 h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl p-5 shadow-2xl" style={{ background: CARD, border: `1px solid ${BORDER}`, backdropFilter: "blur(10px)" }}>
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {[
                    { icon: <Package className="h-4 w-4" />, label: t("home.receivedChina"), on: true },
                    { icon: <Plane className="h-4 w-4" />, label: t("home.onTheWay"), on: true },
                    { icon: <Truck className="h-4 w-4" />, label: t("home.arrivedIraq"), on: false },
                    { icon: <MapPin className="h-4 w-4" />, label: t("home.delivery"), on: false },
                  ].map((tab, i) => (
                    <div key={i} className="rounded-xl px-2 py-3 text-center" style={{ background: tab.on ? "rgba(45,212,191,0.10)" : "transparent", border: `1px solid ${tab.on ? "rgba(45,212,191,0.30)" : BORDER}` }}>
                      <div className="flex justify-center mb-1.5" style={{ color: tab.on ? TEAL : "#64748b" }}>{tab.icon}</div>
                      <p className="text-[10px] leading-tight" style={{ color: tab.on ? TEAL : "#64748b" }}>{tab.label}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-4" style={{ border: `1px solid rgba(45,212,191,0.25)` }}>
                  <div className="flex items-end justify-center gap-[3px] h-20">
                    {[6,3,7,2,5,8,3,6,2,7,4,8,3,5,7,2,6,4,8,3,6,2,7,5,3,8,4,6,2,7].map((h, i) => (
                      <span key={i} className="rounded-sm" style={{ width: 3, height: `${h * 9}%`, background: i % 5 === 0 ? TEAL : "rgba(226,232,240,0.6)" }} />
                    ))}
                  </div>
                  <div className="mt-3 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-1 rounded-full" style={{ width: "62%", background: `linear-gradient(90deg, ${TEAL}, #14b8a6)` }} />
                  </div>
                </div>
                <p className="text-center text-xs text-slate-500 mt-3 tracking-widest" dir="ltr">AIR-2026-027 · {t("home.onTheWay")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section id="problem" className="py-20 lg:py-24 border-y" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.015)" }}>
        <div className="container mx-auto px-4">
          <Head title={t("home.problemTitle") || "کێشە باوەکان"} subtitle={t("home.problemSubtitle") || "ئەمە بە تۆ ئاشنایە؟"} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Problem icon={<HelpCircle className="w-5 h-5" />} title={t("home.problem1T") || "بارەکانم لەکوێن؟"} desc={t("home.problem1D") || "بێ شوێنکەوتن، نازانیت بارەکەت لە چ قۆناغێکدایە"} />
            <Problem icon={<DollarSign className="w-5 h-5" />} title={t("home.problem2T") || "خەرجی شاراوە"} desc={t("home.problem2D") || "نرخی کۆتایی نادیار و خەرجی چاوەڕواننەکراو"} />
            <Problem icon={<Clock className="w-5 h-5" />} title={t("home.problem3T") || "گەیاندنی دواکەوتوو"} desc={t("home.problem3D") || "دواکەوتن لە گومرگ و گەیاندن بەبێ ئاگاداری"} />
            <Problem icon={<AlertTriangle className="w-5 h-5" />} title={t("home.problem4T") || "حسابی تێکەڵ"} desc={t("home.problem4D") || "پسوڵە و قەرز ڕوون نین و دیاری ناکرێن"} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 lg:py-24">
        <div className="container mx-auto px-4">
          <Head title={t("home.howItWorks") || "چۆن کاردەکات"} subtitle={t("home.howItWorksDesc") || "لە چوار هەنگاوی ساکار، بارەکەت لە چینەوە دەگاتە دەستت"} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <HowStep n="١" icon={<ShoppingCart className="w-6 h-6" />} title={t("home.receivedChina")} desc={t("home.consolidationDesc")} />
            <HowStep n="٢" icon={<ClipboardCheck className="w-6 h-6" />} title={t("home.onTheWay")} desc={t("home.airShippingDesc")} />
            <HowStep n="٣" icon={<Plane className="w-6 h-6" />} title={t("home.arrivedIraq")} desc={t("home.estimatedDeliveryDesc")} />
            <HowStep n="٤" icon={<Truck className="w-6 h-6" />} title={t("home.delivery")} desc={t("home.domesticDeliveryDesc")} />
          </div>
        </div>
      </section>

      {/* Portal showcase */}
      <section className="py-20 lg:py-24 border-y" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.015)" }}>
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            {/* App mockup */}
            <div className="rounded-3xl p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(6,18,15,0.6)", border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: BORDER }}>
                  <CompanyLogo size={22} fallbackBg="bg-teal-500" />
                  <span className="text-sm font-semibold text-white">{t("home.customerPortal")}</span>
                </div>
                <div className="p-4 space-y-3">
                  <PortalRow code="AIR-2026-027" label={t("home.onTheWay")} tone="teal" />
                  <PortalRow code="AIR-2026-019" label={t("home.arrivedIraq")} tone="blue" />
                  <PortalRow code="SEA-2026-004" label={t("home.delivery")} tone="muted" />
                  <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(45,212,191,0.08)", border: `1px solid rgba(45,212,191,0.25)` }}>
                    <span className="text-sm text-slate-300">{t("home.autoAccounting")}</span>
                    <span className="text-sm font-bold" style={{ color: TEAL }} dir="ltr">$1,494.33</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Description */}
            <div className="text-center lg:text-start">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{t("home.portalTitle") || "پۆرتاڵی کریار"}</h2>
              <p className="text-slate-400 mb-8 max-w-lg mx-auto lg:mx-0">{t("home.portalDesc") || "کریارەکانت خۆیان هەموو شتێک بەڕێوەدەبەن — لە یەک شوێن، بەبێ پەیوەندی"}</p>
              <div className="space-y-5">
                <PortalFeature icon={<MapPin className="w-5 h-5" />} title={t("home.portalF1T") || "شوێنکەوتنی ڕاستەوخۆ"} desc={t("home.portalF1D") || "بینینی قۆناغی هەر بارێک بە کاتی خۆی"} />
                <PortalFeature icon={<Receipt className="w-5 h-5" />} title={t("home.portalF2T") || "پسوڵە و حسابات"} desc={t("home.portalF2D") || "بینینی پسوڵە، قەرز و پارەدانەکان بە ئاشکرا"} />
                <PortalFeature icon={<ShoppingCart className="w-5 h-5" />} title={t("home.portalF3T") || "داواکاری ئۆردەر"} desc={t("home.portalF3D") || "داواکاری کڕین و گەیاندن ڕاستەوخۆ لە ئەپەکەوە"} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 lg:py-24">
        <div className="container mx-auto px-4">
          <Head title={t("auto.text_c038d2") + "؟"} subtitle={t("auto.text_ced82c")} />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Service icon={<Plane className="w-6 h-6" />} title={t("home.airShipping")} description={t("home.airShippingDesc")} />
            <Service icon={<Ship className="w-6 h-6" />} title={t("home.seaShipping")} description={t("home.seaShippingDesc")} />
            <Service icon={<Package className="w-6 h-6" />} title={t("home.consolidation")} description={t("home.consolidationDesc")} />
            <Service icon={<Shield className="w-6 h-6" />} title={t("home.cargoInsurance")} description={t("home.cargoInsuranceDesc")} />
            <Service icon={<Wallet className="w-6 h-6" />} title={t("home.autoAccounting")} description={t("home.autoAccountingDesc")} />
            <Service icon={<Headphones className="w-6 h-6" />} title={t("home.support247")} description={t("home.support247Desc")} />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 lg:py-24 border-t" style={{ borderColor: BORDER }}>
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto rounded-3xl p-8 lg:p-10" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="text-center mb-7">
              <h2 className="text-3xl font-bold text-white mb-2">{t("home.contactTitle") || "دەستپێبکە"}</h2>
              <p className="text-slate-400">{t("home.contactSubtitle") || "ئامادەیت دەست پێبکەیت؟ زانیارییەکانت بنووسە و پەیوەندیت پێوە دەکەین"}</p>
            </div>
            <form onSubmit={handleContact} className="space-y-3">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("home.contactName") || "ناوت"} className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-11" />
              <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={t("home.contactPhone") || "ژمارەی مۆبایل"} dir="ltr" className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-11" />
              <Input value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })}
                placeholder={t("home.contactBusiness") || "ناوی بازرگانی (ئارەزوومەندانە)"} className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 h-11" />
              <Button type="submit" size="lg" className="w-full rounded-xl text-[#06231f] font-semibold" style={{ background: tealBtn }}>
                <Send className="me-2 h-4 w-4" /> {t("home.contactSend") || "ناردنی داواکاری"}
              </Button>
              <p className="text-center text-xs text-slate-500">{t("home.contactNote") || "پێویست بە بەشداربوون یان کارتی بانکی ناکات"}</p>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: BORDER }}>
        <div className="container mx-auto px-4 py-14">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <CompanyLogo size={40} fallbackBg="bg-teal-500" />
                <div className="leading-tight">
                  <span className="text-lg font-bold text-white">{company.name}</span>
                  <p className="text-[10px] tracking-wider uppercase" style={{ color: TEAL }}>{t("auto.text_6fcd11")}</p>
                </div>
              </div>
              <p className="text-slate-400 mb-5 max-w-md text-sm leading-relaxed">{t("auto.text_318460")}.</p>
              <div className="flex gap-3">
                <a href="#" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-all" style={{ background: CARD, border: `1px solid ${BORDER}` }}><Facebook className="w-4 h-4" /></a>
                <a href="#" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-all" style={{ background: CARD, border: `1px solid ${BORDER}` }}><Instagram className="w-4 h-4" /></a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">{t("home.quickLinks")}</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#problem" className="text-slate-400 hover:text-white transition-colors">{t("home.problemTitle") || "کێشەکان"}</a></li>
                <li><a href="#how" className="text-slate-400 hover:text-white transition-colors">{t("home.howItWorks") || "چۆن کاردەکات"}</a></li>
                <li><a href="#features" className="text-slate-400 hover:text-white transition-colors">{t("home.features")}</a></li>
                <li><Link href="/customer-login" className="text-slate-400 hover:text-white transition-colors">{t("home.customerPortal")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">{t("home.contact")}</h3>
              <ul className="space-y-3 text-sm">
                {company.phone && <li className="flex items-center gap-2.5 text-slate-400"><Phone className="w-4 h-4" style={{ color: TEAL }} /><span dir="ltr">{company.phone}</span></li>}
                {company.phone2 && <li className="flex items-center gap-2.5 text-slate-400"><Phone className="w-4 h-4" style={{ color: TEAL }} /><span dir="ltr">{company.phone2}</span></li>}
                {company.email && <li className="flex items-center gap-2.5 text-slate-400"><Mail className="w-4 h-4" style={{ color: TEAL }} /><span>{company.email}</span></li>}
                {(company.address || company.addressKu) && <li className="flex items-center gap-2.5 text-slate-400"><MapPin className="w-4 h-4" style={{ color: TEAL }} /><span>{company.address || company.addressKu}</span></li>}
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-slate-500" style={{ borderColor: BORDER }}>
            <p>© {new Date().getFullYear()} {company.name}. {t("home.allRightsReserved")}</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white transition-colors">{t("home.terms")}</a>
              <a href="#" className="hover:text-white transition-colors">{t("home.privacy")}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Head({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12">
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{title}</h2>
      {subtitle && <p className="text-slate-400">{subtitle}</p>}
    </div>
  );
}

function Problem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="p-6 rounded-2xl" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: "rgba(248,113,113,0.10)", color: "#f87171" }}>{icon}</div>
      <h3 className="font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function HowStep({ n, icon, title, desc }: { n: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="relative p-6 rounded-2xl text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-[#06231f] mb-4" style={{ background: tealBtn }}>{icon}</div>
      <span className="absolute top-4 end-4 text-3xl font-extrabold" style={{ color: "rgba(45,212,191,0.18)" }}>{n}</span>
      <h3 className="font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function Service({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group p-6 rounded-2xl transition-all duration-300 hover:-translate-y-0.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(45,212,191,0.40)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(45,212,191,0.10)", color: TEAL }}>{icon}</div>
      <h3 className="font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

function PortalFeature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(45,212,191,0.10)", color: TEAL }}>{icon}</div>
      <div>
        <h3 className="font-semibold text-white mb-0.5">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function PortalRow({ code, label, tone }: { code: string; label: string; tone: "teal" | "blue" | "muted" }) {
  const color = tone === "teal" ? TEAL : tone === "blue" ? "#60a5fa" : "#94a3b8";
  return (
    <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2.5">
        <Package className="w-4 h-4" style={{ color }} />
        <span className="text-sm font-mono text-slate-300" dir="ltr">{code}</span>
      </div>
      <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: `${color}1a`, color }}>{label}</span>
    </div>
  );
}
