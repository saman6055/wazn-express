import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/CompanyLogo";
import {
  Plane, Ship, Truck, Users, ArrowRight, Search, Phone, Mail, MapPin,
  ChevronRight, FileText, UserCircle, Package, Globe, Star, Shield,
  BarChart3, Clock, HeadphonesIcon, Zap, Menu, X, ShoppingBag, Handshake
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useLandingTheme } from "@/contexts/LandingThemeContext";
import { trpc } from "@/lib/trpc";
import { CompactLanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

const BLOG_LIMIT = 6;
const TEAM_LIMIT = 4;

/** Contact & hero from settings; fallback to company_info */
function useSiteInfo() {
  const company = useCompanyInfo();
  const { data: siteInfo } = trpc.settings.getPublicWebsiteInfo.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  return {
    phone: siteInfo?.company_phone ?? company.phone ?? "",
    phone2: siteInfo?.company_phone2 ?? company.phone2 ?? "",
    email: siteInfo?.company_email ?? company.email ?? "",
    address: siteInfo?.company_address ?? company.address ?? "",
    addressKu: siteInfo?.company_address_ku ?? company.addressKu ?? "",
    addressAr: siteInfo?.company_address_ar ?? company.addressAr ?? "",
    logoUrl: siteInfo?.company_logo_url ?? company.logoUrl ?? "",
    name: siteInfo?.company_name ?? company.name ?? "Wazn Express",
    nameKu: siteInfo?.company_name_ku ?? company.nameKu ?? "",
    heroTitle: siteInfo?.website_hero_title ?? "",
    heroTitleKu: siteInfo?.website_hero_title_ku ?? "",
    heroSubtitle: siteInfo?.website_hero_subtitle ?? "",
    heroSubtitleKu: siteInfo?.website_hero_subtitle_ku ?? "",
    about: siteInfo?.website_about ?? "",
    aboutKu: siteInfo?.website_about_ku ?? "",
    social: {
      facebook: siteInfo?.social_facebook ?? "",
      instagram: siteInfo?.social_instagram ?? "",
      whatsapp: siteInfo?.social_whatsapp ?? "",
      tiktok: siteInfo?.social_tiktok ?? "",
      telegram: siteInfo?.social_telegram ?? "",
    },
  };
}

export default function HomeMinimal() {
  const { t } = useTranslation();
  const company = useCompanyInfo();
  const site = useSiteInfo();
  const { landingTheme } = useLandingTheme();
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: blogPosts = [] } = trpc.blog.published.useQuery(undefined, { staleTime: 2 * 60 * 1000 });
  const { data: featuredPosts = [] } = trpc.blog.featured.useQuery(undefined, { staleTime: 2 * 60 * 1000 });
  const { data: teamMembers = [] } = trpc.public.getLandingTeam.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const featured = Array.isArray(featuredPosts) ? featuredPosts.slice(0, 2) : [];
  const published = Array.isArray(blogPosts) ? blogPosts : [];
  const posts = [...featured, ...published.filter((p: { id: number }) => !featured.some((f: { id: number }) => f.id === p.id))].slice(0, BLOG_LIMIT);
  const team = Array.isArray(teamMembers) ? teamMembers.slice(0, TEAM_LIMIT) : [];

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "customer") setLocation("/portal");
      else setLocation("/dashboard");
    }
  }, [user, authLoading, setLocation]);

  const handleTrack = () => {
    if (trackingNumber.trim()) setLocation(`/customer-login?track=${trackingNumber}`);
  };

  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const nodes = el.querySelectorAll(".landing-fade-in");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0.05 }
    );
    nodes.forEach((node) => obs.observe(node));
    return () => { obs.disconnect(); };
  }, []);

  return (
    <div ref={pageRef} className="landing-page min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)] overflow-x-hidden" data-theme={landingTheme}>
      {/* Subtle gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-[var(--landing-blur-1)] opacity-30 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-[var(--landing-blur-2)] opacity-20 blur-[100px]" />
      </div>

      {/* A. Navigation — sticky, logo, nav links, language, Track + Login, mobile hamburger */}
      <header className="relative z-50 border-b border-[var(--landing-border)] bg-[var(--landing-bg-header)]/90 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-4 flex h-16 md:h-18 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <CompanyLogo
              size={32}
              className="opacity-95"
              iconClassName="h-6 w-6 text-[var(--landing-text)]"
              fallbackBg="bg-gradient-to-br from-amber-400 to-orange-500"
            />
            <span className="text-lg font-bold text-[var(--landing-text)]">{site.name}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#services" className="text-[var(--landing-text-muted)] hover:text-[var(--landing-text)] transition-colors">{t("home.services")}</a>
            <a href="#about" className="text-[var(--landing-text-muted)] hover:text-[var(--landing-text)] transition-colors">{t("home.about")}</a>
            <a href="#blog" className="text-[var(--landing-text-muted)] hover:text-[var(--landing-text)] transition-colors">{t("home.blog")}</a>
            <a href="#contact" className="text-[var(--landing-text-muted)] hover:text-[var(--landing-text)] transition-colors">{t("home.contact")}</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <CompactLanguageSwitcher className="text-[var(--landing-text-muted)] hover:text-[var(--landing-text)]" />
            {site.phone && (
              <a href={`tel:${site.phone}`} className="hidden lg:flex items-center gap-1.5 text-sm text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)] transition-colors" dir="ltr">
                <Phone className="h-4 w-4" />
                <span>{site.phone}</span>
              </a>
            )}
            <Button size="sm" variant="ghost" className="hidden sm:inline-flex text-[var(--landing-text-muted)] hover:text-[var(--landing-text)]" onClick={() => setLocation("/customer-login")}>
              <Search className="h-4 w-4 me-1" />
              {t("home.trackPackage")}
            </Button>
            <Link href="/customer-login">
              <Button variant="ghost" size="sm" className="text-[var(--landing-text-muted)] hover:text-[var(--landing-text)]">
                <Users className="me-1.5 h-4 w-4" />
                <span className="hidden sm:inline">{t("home.customerPortal")}</span>
              </Button>
            </Link>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-[var(--landing-text)]">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] bg-[var(--landing-bg)] border-[var(--landing-border)]">
                <div className="flex flex-col gap-4 pt-6">
                  <a href="#services" className="text-[var(--landing-text)]" onClick={() => setMobileMenuOpen(false)}>{t("home.services")}</a>
                  <a href="#about" className="text-[var(--landing-text)]" onClick={() => setMobileMenuOpen(false)}>{t("home.about")}</a>
                  <a href="#blog" className="text-[var(--landing-text)]" onClick={() => setMobileMenuOpen(false)}>{t("home.blog")}</a>
                  <a href="#contact" className="text-[var(--landing-text)]" onClick={() => setMobileMenuOpen(false)}>{t("home.contact")}</a>
                  <hr className="border-[var(--landing-border)]" />
                  <Link href="/customer-login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full border-[var(--landing-border)]">{t("home.trackPackage")}</Button>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* B. Hero — headline from settings, tracking box, trust badges, CTAs */}
      <section className="relative pt-16 md:pt-24 pb-20 md:pb-28">
        <div className="container mx-auto px-4 max-w-3xl mx-auto text-center">
          <p className="text-sm font-medium tracking-wide text-[var(--landing-accent)] uppercase mb-4">
            {t("home.fastReliable")}
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
            <span className="text-[var(--landing-text)]">
              {site.heroTitleKu || site.heroTitle || t("auto.text_4904bd")}
            </span>
            <br />
            <span className="bg-[linear-gradient(to_right,var(--landing-cta-from),var(--landing-cta-to))] bg-clip-text text-transparent">
              {site.heroSubtitleKu || site.heroSubtitle || t("auto.text_33d433")}
            </span>
          </h1>
          <p className="text-lg text-[var(--landing-text-muted)] mb-10 max-w-xl mx-auto">
            {t("home.heroDescription")}
          </p>

          <div className="bg-[var(--landing-card)]/80 backdrop-blur border border-[var(--landing-border)] rounded-2xl p-5 mb-10 max-w-md mx-auto">
            <p className="text-sm text-[var(--landing-text-muted)] mb-3">{t("home.quickTrack")}</p>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={t("home.trackingPlaceholder")}
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                className="bg-[var(--landing-stats-bg)] border-[var(--landing-border)] text-[var(--landing-text)] placeholder:text-[var(--landing-text-muted)] text-center"
              />
              <Button onClick={handleTrack} className="bg-[var(--landing-accent)] hover:opacity-90 text-white px-6">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-sm text-[var(--landing-text-muted)] mb-6">
            {t("home.trustBadges")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/customer-login">
              <Button size="lg" className="bg-[linear-gradient(to_right,var(--landing-cta-from),var(--landing-cta-to))] text-white hover:opacity-90 shadow-xl w-full sm:w-auto">
                <Users className="me-2 h-5 w-5" />
                {t("home.customerPortal")}
              </Button>
            </Link>
            <Button size="lg" variant="outline" onClick={handleTrack} className="border-[var(--landing-border)] text-[var(--landing-text)] hover:bg-[var(--landing-card)] w-full sm:w-auto">
              <Search className="me-2 h-4 w-4" />
              {t("home.trackPackage")}
            </Button>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="landing-fade-in relative py-6 border-y border-[var(--landing-border)] bg-[var(--landing-stats-bg)]/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 text-sm text-[var(--landing-text-muted)]">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[var(--landing-accent)]" />
              {t("home.fastReliable")}
            </span>
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--landing-accent)]" />
              {t("home.autoAccountingDesc")}
            </span>
            <span className="flex items-center gap-2">
              <HeadphonesIcon className="h-4 w-4 text-[var(--landing-accent)]" />
              {t("home.support247")}
            </span>
          </div>
        </div>
      </section>

      {/* Stats — 4 numbers */}
      <section className="landing-fade-in relative py-12 md:py-16 border-b border-[var(--landing-border)]">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <MinimalStatCard label={t("home.packagesDelivered")} icon={<Package className="h-5 w-5" />} animate={{ value: 10000, suffix: "+" }} />
            <MinimalStatCard label={t("home.countries")} icon={<Globe className="h-5 w-5" />} animate={{ value: 5, suffix: "+" }} />
            <MinimalStatCard label={t("home.happyCustomers")} icon={<Users className="h-5 w-5" />} animate={{ value: 2000, suffix: "+" }} />
            <MinimalStatCard label={t("home.satisfaction")} icon={<Star className="h-5 w-5" />} animate={{ value: 98, suffix: "%" }} />
          </div>
        </div>
      </section>

      {/* C. Services — Air, Sea, Full Package, Commission, Domestic, Support */}
      <section id="services" className="landing-fade-in relative py-16 md:py-20 border-b border-[var(--landing-border)]">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--landing-text)] mb-4">
            {t("auto.text_868529")}
          </h2>
          <p className="text-center text-[var(--landing-text-muted)] mb-10 max-w-2xl mx-auto">{t("auto.text_743b9f")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <MinimalServiceCard icon={<Plane className="h-7 w-7" />} title={t("home.airShipping")} description={t("home.airShippingDesc")} color="from-blue-500 to-cyan-500" />
            <MinimalServiceCard icon={<Ship className="h-7 w-7" />} title={t("home.seaShipping")} description={t("home.seaShippingDesc")} color="from-indigo-500 to-purple-500" />
            <MinimalServiceCard icon={<ShoppingBag className="h-7 w-7" />} title={t("home.fullPackage")} description={t("home.fullPackageDesc")} color="from-amber-500 to-orange-500" />
            <MinimalServiceCard icon={<Handshake className="h-7 w-7" />} title={t("home.commissionPurchase")} description={t("home.commissionPurchaseDesc")} color="from-emerald-500 to-teal-500" />
            <MinimalServiceCard icon={<Truck className="h-7 w-7" />} title={t("home.domesticDelivery")} description={t("home.domesticDeliveryDesc")} color="from-cyan-500 to-blue-500" />
            <MinimalServiceCard icon={<HeadphonesIcon className="h-7 w-7" />} title={t("home.support247")} description={t("home.support247Desc")} color="from-violet-500 to-purple-500" />
          </div>
        </div>
      </section>

      {/* D. Why choose us / Features */}
      <section id="features" className="landing-fade-in relative py-16 md:py-20 border-b border-[var(--landing-border)] bg-[var(--landing-stats-bg)]/50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--landing-text)] mb-4">
            {t("auto.text_c038d2")}؟
          </h2>
          <p className="text-center text-[var(--landing-text-muted)] mb-10 max-w-2xl mx-auto">{t("auto.text_ced82c")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <MinimalFeatureItem icon={<Globe className="h-5 w-5" />} title={t("home.liveTracking")} description={t("home.liveTrackingDesc")} />
            <MinimalFeatureItem icon={<BarChart3 className="h-5 w-5" />} title={t("home.autoAccounting")} description={t("home.autoAccountingDesc")} />
            <MinimalFeatureItem icon={<Clock className="h-5 w-5" />} title={t("home.estimatedDelivery")} description={t("home.estimatedDeliveryDesc")} />
            <MinimalFeatureItem icon={<Star className="h-5 w-5" />} title={t("home.vipPricing")} description={t("home.vipPricingDesc")} />
            <MinimalFeatureItem icon={<Shield className="h-5 w-5" />} title={t("home.dataProtection")} description={t("home.dataProtectionDesc")} />
            <MinimalFeatureItem icon={<Zap className="h-5 w-5" />} title={t("home.fastScanner")} description={t("home.fastScannerDesc")} />
          </div>
        </div>
      </section>

      {/* E. How it works — 4 steps */}
      <section className="landing-fade-in relative py-16 md:py-20 border-b border-[var(--landing-border)]">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--landing-text)] mb-4">
            {t("home.howItWorks")}
          </h2>
          <p className="text-center text-[var(--landing-text-muted)] mb-12 max-w-2xl mx-auto">{t("home.howItWorksDesc")}</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <HowStep t={t} step={1} title={t("home.step1Title")} desc={t("home.step1Desc")} icon={<UserCircle className="h-6 w-6" />} />
            <HowStep t={t} step={2} title={t("home.step2Title")} desc={t("home.step2Desc")} icon={<Package className="h-6 w-6" />} />
            <HowStep t={t} step={3} title={t("home.step3Title")} desc={t("home.step3Desc")} icon={<Truck className="h-6 w-6" />} />
            <HowStep t={t} step={4} title={t("home.step4Title")} desc={t("home.step4Desc")} icon={<MapPin className="h-6 w-6" />} />
          </div>
        </div>
      </section>

      {/* F. Blog / Latest News — cards with image, category, excerpt, date, view count */}
      <section id="blog" className="landing-fade-in relative py-16 md:py-20 border-t border-[var(--landing-border)] bg-[var(--landing-stats-bg)]/50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--landing-text)] mb-4">
            {t("home.latestNewsUpdates")}
          </h2>
          <p className="text-center text-[var(--landing-text-muted)] mb-10">{t("blog.latestPosts")}</p>
          {posts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {posts.map((post: any) => (
                  <BlogCard key={post.id} post={post} t={t} />
                ))}
              </div>
              <div className="text-center mt-10">
                <Link href="/portal/blog">
                  <Button variant="outline" className="border-[var(--landing-border)] text-[var(--landing-text)]">
                    {t("home.viewAllBlogPosts")}
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="max-w-md mx-auto text-center py-8 px-6 rounded-2xl bg-[var(--landing-card)] border border-[var(--landing-border)]">
              <FileText className="h-12 w-12 mx-auto text-[var(--landing-text-muted)]/60 mb-4" />
              <p className="text-[var(--landing-text-muted)] mb-4">{t("blog.noPostsYet")}</p>
              <Link href="/customer-login">
                <Button variant="outline" size="sm" className="border-[var(--landing-border)] text-[var(--landing-text)]">
                  {t("home.customerPortal")}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Team */}
      {team.length > 0 && (
        <section className="landing-fade-in relative py-16 md:py-20 border-t border-[var(--landing-border)]">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-[var(--landing-text)] mb-10">
              {t("home.ourTeam") || "تیمی ئێمە"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {team.map((member: { id: string; name: string; role: string; description: string; imageUrl: string | null }) => (
                <div
                  key={member.id}
                  className="p-5 rounded-2xl bg-[var(--landing-card)] border border-[var(--landing-border)] text-center"
                >
                  <div className="w-20 h-20 rounded-full mx-auto mb-4 overflow-hidden bg-[var(--landing-accent-subtle)] flex items-center justify-center">
                    {member.imageUrl ? (
                      <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle className="h-10 w-10 text-[var(--landing-accent)]" />
                    )}
                  </div>
                  <h3 className="font-semibold text-[var(--landing-text)]">{member.name}</h3>
                  <p className="text-sm text-[var(--landing-accent)] mb-2">{member.role}</p>
                  <p className="text-sm text-[var(--landing-text-muted)] line-clamp-3">{member.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Quick links */}
      <section className="landing-fade-in relative py-12 border-t border-[var(--landing-border)]">
        <div className="container mx-auto px-4">
          <h2 className="text-lg font-semibold text-center text-[var(--landing-text)] mb-6">{t("home.quickLinks")}</h2>
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            <a href="#services" className="flex items-center gap-2 text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)] transition-colors">
              <ChevronRight className="h-4 w-4" />
              {t("home.services")}
            </a>
            <a href="#features" className="flex items-center gap-2 text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)] transition-colors">
              <ChevronRight className="h-4 w-4" />
              {t("home.features")}
            </a>
            <Link href="/customer-login" className="flex items-center gap-2 text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)] transition-colors">
              <ChevronRight className="h-4 w-4" />
              {t("home.customerPortal")}
            </Link>
            <a href="#contact" className="flex items-center gap-2 text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)] transition-colors">
              <ChevronRight className="h-4 w-4" />
              {t("home.contact")}
            </a>
          </div>
        </div>
      </section>

      {/* H. About — from settings or default */}
      <section id="about" className="landing-fade-in relative py-16 md:py-20 border-t border-[var(--landing-border)] bg-[var(--landing-stats-bg)]/50">
        <div className="container mx-auto px-4 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--landing-text)] mb-6">{t("home.aboutUs")}</h2>
          <p className="text-[var(--landing-text-muted)] whitespace-pre-line">
            {site.aboutKu || site.about || t("home.aboutDefault")}
          </p>
        </div>
      </section>

      {/* I. Contact — phone, email, address, WhatsApp, social from settings */}
      <section id="contact" className="landing-fade-in relative py-12 md:py-16 border-t border-[var(--landing-border)]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl font-bold text-[var(--landing-text)] mb-6">{t("home.contact")}</h2>
          <div className="flex flex-wrap justify-center gap-6 md:gap-10 text-[var(--landing-text-muted)] mb-6">
            {site.phone && (
              <a href={`tel:${site.phone}`} className="flex items-center gap-2 hover:text-[var(--landing-accent)] transition-colors" dir="ltr">
                <Phone className="h-4 w-4 text-[var(--landing-accent)]" />
                {site.phone}
              </a>
            )}
            {site.email && (
              <a href={`mailto:${site.email}`} className="flex items-center gap-2 hover:text-[var(--landing-accent)] transition-colors">
                <Mail className="h-4 w-4 text-[var(--landing-accent)]" />
                {site.email}
              </a>
            )}
            {(site.address || site.addressKu) && (
              <span className="flex items-center gap-2 justify-center">
                <MapPin className="h-4 w-4 text-[var(--landing-accent)] flex-shrink-0" />
                {site.address || site.addressKu}
              </span>
            )}
          </div>
          {site.social.whatsapp && (
            <a href={site.social.whatsapp.startsWith("http") ? site.social.whatsapp : `https://wa.me/${site.social.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 transition-colors">
              {t("home.sendWhatsApp")}
            </a>
          )}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {site.social.facebook && <a href={site.social.facebook} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[var(--landing-card)] border border-[var(--landing-border)] hover:border-[var(--landing-accent)] text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)]" aria-label="Facebook">f</a>}
            {site.social.instagram && <a href={site.social.instagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[var(--landing-card)] border border-[var(--landing-border)] hover:border-[var(--landing-accent)] text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)]" aria-label="Instagram">📷</a>}
            {site.social.tiktok && <a href={site.social.tiktok} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[var(--landing-card)] border border-[var(--landing-border)] hover:border-[var(--landing-accent)] text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)]" aria-label="TikTok">♪</a>}
            {site.social.telegram && <a href={site.social.telegram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[var(--landing-card)] border border-[var(--landing-border)] hover:border-[var(--landing-accent)] text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)]" aria-label="Telegram">✈</a>}
          </div>
        </div>
      </section>

      {/* J. Footer — quick links, contact, social, Powered by */}
      <footer className="border-t border-[var(--landing-border)] bg-[var(--landing-bg-footer)]">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CompanyLogo size={24} iconClassName="h-5 w-5 text-[var(--landing-text)]" fallbackBg="bg-gradient-to-br from-amber-400 to-orange-500" />
                <span className="font-semibold text-[var(--landing-text)]">{site.name}</span>
              </div>
              <p className="text-sm text-[var(--landing-text-muted)]">{t("home.footerDescription")}</p>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--landing-text)] mb-3">{t("home.quickLinks")}</h3>
              <ul className="space-y-2 text-sm text-[var(--landing-text-muted)]">
                <li><a href="#services" className="hover:text-[var(--landing-accent)]">{t("home.services")}</a></li>
                <li><a href="#features" className="hover:text-[var(--landing-accent)]">{t("home.features")}</a></li>
                <li><a href="#blog" className="hover:text-[var(--landing-accent)]">{t("home.blog")}</a></li>
                <li><Link href="/customer-login" className="hover:text-[var(--landing-accent)]">{t("home.customerPortal")}</Link></li>
                <li><a href="#contact" className="hover:text-[var(--landing-accent)]">{t("home.contact")}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--landing-text)] mb-3">{t("home.contact")}</h3>
              {site.phone && <p className="text-sm text-[var(--landing-text-muted)]" dir="ltr">{site.phone}</p>}
              {site.email && <p className="text-sm text-[var(--landing-text-muted)]">{site.email}</p>}
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 border-t border-[var(--landing-border)]">
            <p className="text-sm text-[var(--landing-text-muted)]">
              © {new Date().getFullYear()} {site.name}. {t("home.allRightsReserved")}
            </p>
            <p className="text-xs text-[var(--landing-text-muted)]">{t("home.poweredBy")}</p>
            <div className="flex gap-4 text-sm">
              <a href="#" className="hover:text-[var(--landing-accent)]">{t("home.terms")}</a>
              <a href="#" className="hover:text-[var(--landing-accent)]">{t("home.privacy")}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

type BlogPostRow = { id: number; titleEn?: string; titleKu?: string; titleAr?: string; summaryEn?: string; summaryKu?: string; summaryAr?: string; coverImageUrl?: string | null; category?: string | null; publishedAt?: Date | null; viewCount?: number | null; slug?: string | null };
function BlogCard({ post, t }: { post: BlogPostRow; t: (k: string) => string }) {
  const title = post.titleKu || post.titleEn || post.titleAr || "";
  const excerpt = post.summaryKu || post.summaryEn || post.summaryAr || "";
  const href = `/portal/blog/${post.id}`;
  const dateStr = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "";
  const categoryLabel = post.category ? t(`blog.${post.category}`) : "";
  return (
    <Link href={href}>
      <div className="group h-full rounded-2xl bg-[var(--landing-card)] border border-[var(--landing-border)] hover:border-[var(--landing-accent)]/50 overflow-hidden transition-all duration-300">
        <div className="aspect-video bg-gradient-to-br from-[var(--landing-accent-subtle)] to-[var(--landing-border)] flex items-center justify-center">
          {post.coverImageUrl ? (
            <img src={post.coverImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <FileText className="h-12 w-12 text-[var(--landing-text-muted)]/50" />
          )}
        </div>
        <div className="p-4">
          {categoryLabel && <Badge variant="secondary" className="mb-2 text-xs bg-[var(--landing-accent-subtle)] text-[var(--landing-accent)]">{categoryLabel}</Badge>}
          <h3 className="font-semibold text-[var(--landing-text)] mb-2 line-clamp-2">{title}</h3>
          <p className="text-sm text-[var(--landing-text-muted)] line-clamp-2 mb-2">{excerpt}</p>
          <div className="flex items-center gap-3 text-xs text-[var(--landing-text-muted)]">
            {dateStr && <span>{dateStr}</span>}
            {(post.viewCount ?? 0) > 0 && <span>{post.viewCount} {t("blog.views")}</span>}
          </div>
          <span className="inline-flex items-center gap-1 mt-2 text-sm text-[var(--landing-accent)] group-hover:gap-2 transition-all">
            {t("blog.readMore")} <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function HowStep({ t, step, title, desc, icon }: { t: (k: string) => string; step: number; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-[var(--landing-accent-subtle)] text-[var(--landing-accent)] flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-bold text-[var(--landing-accent)] mb-2">{t("home.step")} {step}</p>
      <h3 className="font-semibold text-[var(--landing-text)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--landing-text-muted)]">{desc}</p>
    </div>
  );
}

function MinimalServiceCard({ icon, title, description, color }: { icon: React.ReactNode; title: string; description?: string; color: string }) {
  return (
    <div className="p-6 rounded-2xl bg-[var(--landing-card)] border border-[var(--landing-border)] hover:border-[var(--landing-accent)]/30 transition-all duration-300 text-center">
      <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-3`}>
        {icon}
      </div>
      <h3 className="font-semibold text-[var(--landing-text)]">{title}</h3>
      {description && <p className="mt-2 text-sm text-[var(--landing-text-muted)] line-clamp-2">{description}</p>}
    </div>
  );
}

/** Counts up from 0 to value when element enters viewport. */
function AnimatedCounter({ value, suffix = "", durationMs = 1600 }: { value: number; suffix?: string; durationMs?: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (started) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setStarted(true);
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started || count >= value) return;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - (1 - t) * (1 - t);
      const next = Math.round(eased * value);
      setCount(next);
      if (next < value) requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [started, value, durationMs, count]);

  const display = value >= 1000 ? count.toLocaleString() : String(count);
  return <span ref={ref}>{display}{suffix}</span>;
}

function MinimalStatCard({ number, label, icon, animate }: { number?: string; label: string; icon: React.ReactNode; animate?: { value: number; suffix: string } }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--landing-accent-subtle)] text-[var(--landing-accent)] mb-3">
        {icon}
      </div>
      <p className="text-2xl md:text-3xl font-bold text-[var(--landing-text)]">
        {animate ? <AnimatedCounter value={animate.value} suffix={animate.suffix} /> : (number ?? "")}
      </p>
      <p className="text-sm text-[var(--landing-text-muted)] mt-1">{label}</p>
    </div>
  );
}

function MinimalFeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-5 rounded-2xl bg-[var(--landing-card)] border border-[var(--landing-border)] hover:border-[var(--landing-accent)]/30 transition-all duration-300">
      <div className="w-10 h-10 rounded-xl bg-[var(--landing-accent-subtle)] flex items-center justify-center text-[var(--landing-accent)] mb-3">
        {icon}
      </div>
      <h3 className="font-semibold text-[var(--landing-text)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--landing-text-muted)]">{description}</p>
    </div>
  );
}
