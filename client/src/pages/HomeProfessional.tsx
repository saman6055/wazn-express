import { useAuth } from "@/_core/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { ArrowUpLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";

/**
 * "Professional" landing variant — a kinetic editorial design. Deliberately
 * NOT the card-grid + icon-chip template of the other variants: oversized
 * display typography, a scrolling marquee, numbered list rows separated by
 * hairlines, big inline stats, and minimal chrome. Warm bone canvas, ink text,
 * one bold amber accent. Self-contained, independent of the theme toggle.
 */

const BONE = "#f4f1ea";
const INK = "#141414";
const MUTED = "#6f6a62";
const FAINT = "#a8a294";
const ACCENT = "#ea580c";
const LINE = "#ddd8cd";

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

  const handleTrack = () => { if (trackingNumber.trim()) setLocation(`/customer-login?track=${trackingNumber}`); };

  const handleContact = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = [
      `${t("home.contactName") || "ناو"}: ${form.name}`,
      `${t("home.contactPhone") || "مۆبایل"}: ${form.phone}`,
      form.business ? `${t("home.contactBusiness") || "بازرگانی"}: ${form.business}` : "",
    ].filter(Boolean).join("\n");
    const phone = (company.phone || "").replace(/[^\d]/g, "");
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, "_blank");
    else if (company.email) window.location.href = `mailto:${company.email}?body=${encodeURIComponent(lines)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BONE }}>
        <p className="animate-pulse text-2xl font-black" style={{ color: INK }}>{company.name}</p>
      </div>
    );
  }

  const marquee = [t("home.airShipping"), t("home.seaShipping"), t("home.liveTracking"), t("home.cargoInsurance"), t("home.support247"), t("home.consolidation")];
  const services = [
    { t: t("home.airShipping"), d: t("home.airShippingDesc") },
    { t: t("home.seaShipping"), d: t("home.seaShippingDesc") },
    { t: t("home.consolidation"), d: t("home.consolidationDesc") },
    { t: t("home.cargoInsurance"), d: t("home.cargoInsuranceDesc") },
    { t: t("home.autoAccounting"), d: t("home.autoAccountingDesc") },
    { t: t("home.support247"), d: t("home.support247Desc") },
  ];
  const steps = [
    { t: t("home.receivedChina"), d: t("home.consolidationDesc") },
    { t: t("home.onTheWay"), d: t("home.airShippingDesc") },
    { t: t("home.arrivedIraq"), d: t("home.estimatedDeliveryDesc") },
    { t: t("home.delivery"), d: t("home.domesticDeliveryDesc") },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden antialiased" style={{ background: BONE, color: INK }}>
      <style>{`@keyframes wx-marq{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}.wx-marq{animation:wx-marq 26s linear infinite}.wx-row:hover .wx-arrow{transform:translateX(-8px)}.wx-row:hover .wx-num{color:${ACCENT}}`}</style>

      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(244,241,234,0.8)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${LINE}` }}>
        <div className="container mx-auto px-6 flex h-16 items-center justify-between">
          <span className="text-xl font-black tracking-tight" style={{ color: INK }}>{company.name}</span>
          <Link href="/customer-login" className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest hover:gap-3 transition-all" style={{ color: INK }}>
            {t("home.customerPortal")} <ArrowUpLeft className="h-4 w-4" style={{ color: ACCENT }} />
          </Link>
        </div>
      </header>

      {/* Hero — oversized headline */}
      <section className="container mx-auto px-6 pt-16 pb-10 lg:pt-24">
        <p className="text-sm font-bold uppercase tracking-[0.3em] mb-8" style={{ color: ACCENT }}>{t("home.fastReliable")}</p>
        <h1 className="font-black" style={{ color: INK, fontSize: "clamp(2.8rem, 11vw, 9.5rem)", lineHeight: 0.92, letterSpacing: "-0.04em" }}>
          {t("auto.text_4904bd")}<br /><span style={{ WebkitTextStroke: `2px ${INK}`, color: "transparent" }}>{t("auto.text_33d433")}</span>
        </h1>
        <div className="mt-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <p className="text-xl max-w-md leading-relaxed" style={{ color: MUTED }}>{t("home.heroDescription")}</p>
          <div className="w-full lg:w-[420px]">
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: FAINT }}>{t("home.quickTrack")}</label>
            <div className="flex items-center gap-3 mt-2 pb-2" style={{ borderBottom: `2px solid ${INK}` }}>
              <Input type="text" placeholder={t("home.trackingPlaceholder")} value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleTrack()}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-lg h-9 rounded-none" style={{ color: INK }} />
              <button onClick={handleTrack} className="text-sm font-black uppercase tracking-widest whitespace-nowrap inline-flex items-center gap-1.5" style={{ color: ACCENT }}>
                {t("auto.text_623179")} <ArrowUpLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="py-5 my-6 overflow-hidden whitespace-nowrap" style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div className="wx-marq inline-flex" style={{ minWidth: "200%" }}>
          {[...marquee, ...marquee].map((m, i) => (
            <span key={i} className="inline-flex items-center text-2xl md:text-3xl font-black tracking-tight" style={{ color: i % 2 ? ACCENT : INK }}>
              <span className="mx-6">{m}</span><span style={{ color: FAINT }}>—</span>
            </span>
          ))}
        </div>
      </div>

      {/* Stats — oversized inline */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {[
            { n: "١٠ﻙ+", l: t("home.packagesDelivered") },
            { n: "٩٨٪", l: t("home.deliveryRate") },
            { n: "٢٤/٧", l: t("home.support") },
            { n: "٥+", l: t("home.countries") },
          ].map((s, i) => (
            <div key={i} className="py-6 md:py-0 md:px-8">
              <p className="font-black" style={{ color: INK, fontSize: "clamp(2.6rem,5vw,4rem)", lineHeight: 1 }}>{s.n}</p>
              <p className="mt-2 text-sm uppercase tracking-widest" style={{ color: FAINT }}>{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What we do — numbered list rows (no cards, no icons) */}
      <section id="features" className="container mx-auto px-6 py-16">
        <div className="flex items-baseline justify-between mb-8" style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 16 }}>
          <h2 className="font-black tracking-tight" style={{ color: INK, fontSize: "clamp(1.8rem,4vw,3rem)", letterSpacing: "-0.02em" }}>{t("auto.text_868529")}</h2>
          <span className="text-sm font-bold uppercase tracking-widest hidden md:block" style={{ color: FAINT }}>{t("home.features")}</span>
        </div>
        {services.map((s, i) => (
          <div key={i} className="wx-row group flex items-center gap-6 md:gap-12 py-7 cursor-default" style={{ borderBottom: `1px solid ${LINE}` }}>
            <span className="wx-num font-black w-12 md:w-20 flex-shrink-0 transition-colors" style={{ color: FAINT, fontSize: "clamp(1.5rem,3vw,2.4rem)" }}>{`۰${i + 1}`}</span>
            <h3 className="font-black flex-shrink-0 w-40 md:w-72" style={{ color: INK, fontSize: "clamp(1.1rem,2.2vw,1.7rem)" }}>{s.t}</h3>
            <p className="hidden md:block flex-1 text-base" style={{ color: MUTED }}>{s.d}</p>
            <ArrowUpLeft className="wx-arrow h-6 w-6 md:h-8 md:w-8 flex-shrink-0 transition-transform ms-auto" style={{ color: ACCENT }} />
          </div>
        ))}
      </section>

      {/* How it works — big numbered sequence */}
      <section id="how" className="py-20" style={{ background: INK, color: BONE }}>
        <div className="container mx-auto px-6">
          <p className="text-sm font-bold uppercase tracking-[0.3em] mb-3" style={{ color: ACCENT }}>{t("home.howItWorksDesc") || "چوار هەنگاو"}</p>
          <h2 className="font-black tracking-tight mb-12" style={{ color: BONE, fontSize: "clamp(1.8rem,4vw,3rem)", letterSpacing: "-0.02em" }}>{t("home.howItWorks") || "چۆن کاردەکات"}</h2>
          <div className="grid md:grid-cols-4 gap-10">
            {steps.map((s, i) => (
              <div key={i} className="relative">
                <p className="font-black mb-4" style={{ color: ACCENT, fontSize: "clamp(3rem,6vw,5rem)", lineHeight: 1 }}>{`۰${i + 1}`}</p>
                <h3 className="font-black text-xl mb-2" style={{ color: BONE }}>{s.t}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(244,241,234,0.6)" }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portal — bold statement + minimal preview */}
      <section className="container mx-auto px-6 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] mb-4" style={{ color: ACCENT }}>{t("home.customerPortal")}</p>
            <h2 className="font-black tracking-tight" style={{ color: INK, fontSize: "clamp(2rem,4.5vw,3.6rem)", lineHeight: 1.04, letterSpacing: "-0.03em" }}>{t("home.portalTitle") || "پۆرتاڵی کریار"}</h2>
            <p className="mt-5 text-lg max-w-md" style={{ color: MUTED }}>{t("home.portalDesc")}</p>
            <div className="mt-10 space-y-0">
              {[
                { t: t("home.portalF1T"), d: t("home.portalF1D") },
                { t: t("home.portalF2T"), d: t("home.portalF2D") },
                { t: t("home.portalF3T"), d: t("home.portalF3D") },
              ].map((f, i) => (
                <div key={i} className="flex items-baseline gap-5 py-5" style={{ borderTop: `1px solid ${LINE}` }}>
                  <span className="font-black text-sm" style={{ color: ACCENT }}>{`۰${i + 1}`}</span>
                  <div>
                    <h3 className="font-black text-lg" style={{ color: INK }}>{f.t}</h3>
                    <p className="text-sm mt-0.5" style={{ color: MUTED }}>{f.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-8" style={{ background: "#fff", border: `1px solid ${LINE}` }}>
            {[
              { c: "AIR-2026-027", l: t("home.onTheWay"), on: true },
              { c: "AIR-2026-019", l: t("home.arrivedIraq"), on: false },
              { c: "SEA-2026-004", l: t("home.delivery"), on: false },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
                <span className="font-mono text-sm" style={{ color: INK }} dir="ltr">{r.c}</span>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: r.on ? ACCENT : FAINT }}>{r.l}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-6">
              <span className="text-sm uppercase tracking-widest" style={{ color: FAINT }}>{t("home.autoAccounting")}</span>
              <span className="font-black text-2xl" style={{ color: INK }} dir="ltr">$1,494.33</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem — bold line list */}
      <section id="problem" className="py-20" style={{ borderTop: `1px solid ${LINE}` }}>
        <div className="container mx-auto px-6">
          <h2 className="font-black tracking-tight mb-10" style={{ color: INK, fontSize: "clamp(1.8rem,4vw,3rem)", letterSpacing: "-0.02em" }}>{t("home.problemSubtitle") || "ئەمە بە تۆ ئاشنایە؟"}</h2>
          <div className="grid md:grid-cols-2 gap-x-16">
            {[
              t("home.problem1T"), t("home.problem2T"), t("home.problem3T"), t("home.problem4T"),
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-5 py-6" style={{ borderBottom: `1px solid ${LINE}` }}>
                <span className="font-black" style={{ color: FAINT, fontSize: "1.4rem" }}>—</span>
                <span className="font-black" style={{ color: INK, fontSize: "clamp(1.3rem,3vw,2rem)" }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact — big block + minimal form */}
      <section id="contact" className="py-20 lg:py-28" style={{ background: INK, color: BONE }}>
        <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-black tracking-tight" style={{ color: BONE, fontSize: "clamp(2.4rem,6vw,5rem)", lineHeight: 0.95, letterSpacing: "-0.03em" }}>{t("home.contactTitle") || "دەستپێبکە"}</h2>
            <p className="mt-6 text-lg max-w-sm" style={{ color: "rgba(244,241,234,0.6)" }}>{t("home.contactSubtitle")}</p>
            {company.phone && <a href={`tel:${company.phone}`} className="mt-8 inline-block text-2xl font-black" style={{ color: ACCENT }} dir="ltr">{company.phone}</a>}
          </div>
          <form onSubmit={handleContact} className="space-y-6">
            {[
              { k: "name" as const, ph: t("home.contactName") || "ناوت", req: true, dir: "rtl" },
              { k: "phone" as const, ph: t("home.contactPhone") || "ژمارەی مۆبایل", req: true, dir: "ltr" },
              { k: "business" as const, ph: t("home.contactBusiness") || "ناوی بازرگانی", req: false, dir: "rtl" },
            ].map((f) => (
              <input key={f.k} required={f.req} dir={f.dir} value={form[f.k]} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} placeholder={f.ph}
                className="w-full bg-transparent border-0 border-b-2 pb-3 text-xl outline-none placeholder:text-[rgba(244,241,234,0.4)]" style={{ borderColor: "rgba(244,241,234,0.3)", color: BONE }} />
            ))}
            <button type="submit" className="inline-flex items-center gap-2 text-lg font-black uppercase tracking-widest pt-2" style={{ color: ACCENT }}>
              {t("home.contactSend") || "ناردن"} <ArrowUpLeft className="h-5 w-5" />
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-14">
        <div className="flex flex-col md:flex-row justify-between gap-8" style={{ borderTop: `2px solid ${INK}`, paddingTop: 32 }}>
          <span className="font-black tracking-tight" style={{ color: INK, fontSize: "clamp(2rem,5vw,3.5rem)" }}>{company.name}</span>
          <div className="flex flex-col md:items-end gap-2 text-sm" style={{ color: MUTED }}>
            {company.phone && <span dir="ltr">{company.phone}</span>}
            {company.email && <span>{company.email}</span>}
            <div className="flex gap-5 mt-3">
              <a href="#" className="font-bold uppercase tracking-widest hover:opacity-60" style={{ color: INK }}>Facebook</a>
              <a href="#" className="font-bold uppercase tracking-widest hover:opacity-60" style={{ color: INK }}>Instagram</a>
            </div>
          </div>
        </div>
        <p className="mt-10 text-xs uppercase tracking-widest" style={{ color: FAINT }}>© {new Date().getFullYear()} {company.name} — {t("home.allRightsReserved")}</p>
      </footer>
    </div>
  );
}
