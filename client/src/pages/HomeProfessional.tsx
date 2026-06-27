import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CompanyLogo from "@/components/CompanyLogo";
import {
  Package, Plane, Ship, Globe, Shield, BarChart3, Users, MapPin, Clock,
  CheckCircle, Phone, Mail, Facebook, Instagram, Truck, Zap, Headphones,
  Award, ChevronLeft, Search, FileText, UserCircle, Star,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { trpc } from "@/lib/trpc";

/**
 * "Professional" landing variant — a clean, light, teal-accented SaaS look
 * (inspired by himaciq.com / Himak by WaznEx). Deliberately self-contained:
 * it uses its own light palette rather than the --landing-* theme vars, so it
 * always reads as a polished, high-contrast business site regardless of the
 * dark/light/ocean landing-theme toggle. Reuses the same i18n keys and data
 * queries as the Classic variant so all content is already localized.
 */
export default function HomeProfessional() {
  const { t } = useTranslation();
  const company = useCompanyInfo();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [trackingNumber, setTrackingNumber] = useState("");
  const { data: blogPosts = [] } = trpc.blog.published.useQuery(undefined, { staleTime: 2 * 60 * 1000 });
  const { data: teamMembers = [] } = trpc.public.getLandingTeam.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const posts = Array.isArray(blogPosts) ? blogPosts.slice(0, 3) : [];
  const team = Array.isArray(teamMembers) ? teamMembers.slice(0, 6) : [];

  useEffect(() => {
    if (!loading && user) {
      setLocation(user.role === "customer" ? "/portal" : "/dashboard");
    }
  }, [user, loading, setLocation]);

  const handleTrackPackage = () => {
    if (trackingNumber.trim()) setLocation(`/customer-login?track=${trackingNumber}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <CompanyLogo size={48} fallbackBg="bg-gradient-to-br from-teal-500 to-cyan-500" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-700 overflow-x-hidden antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CompanyLogo size={32} fallbackBg="bg-gradient-to-br from-teal-500 to-cyan-500" />
            <div className="leading-tight">
              <span className="text-lg font-bold text-slate-900">{company.name}</span>
              <p className="text-[11px] text-slate-400">{t("auto.text_6fcd11")}</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors">{t("home.services")}</a>
            <a href="#features" className="text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors">{t("home.features")}</a>
            <a href="#contact" className="text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors">{t("home.contact")}</a>
          </nav>
          <Link href="/customer-login">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm">
              <Users className="me-2 h-4 w-4" />
              <span className="hidden sm:inline">{t("home.customerPortal")}</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-50/60 via-white to-white">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute -top-24 end-0 w-[28rem] h-[28rem] rounded-full bg-teal-200/30 blur-3xl" />
          <div className="absolute top-40 -start-24 w-80 h-80 rounded-full bg-cyan-200/30 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-start">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-sm font-medium mb-6">
                <Zap className="w-4 h-4" /> {t("home.fastReliable")}
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 text-slate-900">
                {t("auto.text_4904bd")}{" "}
                <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">{t("auto.text_33d433")}</span>
              </h1>
              <p className="text-lg text-slate-500 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">{t("home.heroDescription")}</p>

              {/* Tracking */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-lg shadow-slate-200/50 max-w-md mx-auto lg:mx-0 mb-6">
                <p className="text-sm font-medium text-slate-500 mb-2 text-start">{t("home.quickTrack")}</p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder={t("home.trackingPlaceholder")}
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleTrackPackage()}
                    className="border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
                  />
                  <Button onClick={handleTrackPackage} className="bg-teal-600 hover:bg-teal-700 px-5 text-white">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link href="/customer-login">
                  <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white shadow-md w-full sm:w-auto">
                    <Users className="me-2 h-5 w-5" /> {t("auto.text_623179")}
                  </Button>
                </Link>
                <a href="#services">
                  <Button size="lg" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50 w-full sm:w-auto">
                    {t("home.services")} <ChevronLeft className="ms-1 h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            {/* Tracking preview card */}
            <div className="relative hidden lg:block">
              <div className="bg-white border border-slate-200 rounded-3xl p-7 shadow-xl shadow-slate-200/60">
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-100">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{t("home.packageTracking")}</p>
                    <p className="text-sm text-slate-400">{t("home.liveReliable")}</p>
                  </div>
                </div>
                <div className="space-y-5">
                  <Step icon={<CheckCircle className="w-4 h-4" />} title={t("home.receivedChina")} date="٢٠٢٤/١٢/١٥" done />
                  <Step icon={<Plane className="w-4 h-4" />} title={t("home.onTheWay")} date="٢٠٢٤/١٢/١٧" done />
                  <Step icon={<Truck className="w-4 h-4" />} title={t("home.arrivedIraq")} date="٢٠٢٤/١٢/١٩" active />
                  <Step icon={<MapPin className="w-4 h-4" />} title={t("home.delivery")} date={t("home.expected")} />
                </div>
              </div>
              <div className="absolute -top-5 -end-5 bg-white rounded-2xl px-4 py-3 shadow-lg border border-slate-100 text-center">
                <p className="text-2xl font-extrabold text-teal-600">٩٨٪</p>
                <p className="text-xs text-slate-400">{t("home.deliveryRate")}</p>
              </div>
              <div className="absolute -bottom-5 -start-5 bg-white rounded-2xl px-4 py-3 shadow-lg border border-slate-100 text-center">
                <p className="text-2xl font-extrabold text-cyan-600">٢٤/٧</p>
                <p className="text-xs text-slate-400">{t("home.support")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <Stat number="١٠,٠٠٠+" label={t("home.packagesDelivered")} icon={<Package className="w-5 h-5" />} />
            <Stat number="٥+" label={t("home.countries")} icon={<Globe className="w-5 h-5" />} />
            <Stat number="٢,٠٠٠+" label={t("home.happyCustomers")} icon={<Users className="w-5 h-5" />} />
            <Stat number="٩٨٪" label={t("home.satisfaction")} icon={<Star className="w-5 h-5" />} />
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{t("auto.text_868529")}</h2>
            <p className="text-slate-500">{t("auto.text_743b9f")}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Service icon={<Plane className="w-6 h-6" />} title={t("home.airShipping")} description={t("home.airShippingDesc")} />
            <Service icon={<Ship className="w-6 h-6" />} title={t("home.seaShipping")} description={t("home.seaShippingDesc")} />
            <Service icon={<Package className="w-6 h-6" />} title={t("home.consolidation")} description={t("home.consolidationDesc")} />
            <Service icon={<Truck className="w-6 h-6" />} title={t("home.domesticDelivery")} description={t("home.domesticDeliveryDesc")} />
            <Service icon={<Shield className="w-6 h-6" />} title={t("home.cargoInsurance")} description={t("home.cargoInsuranceDesc")} />
            <Service icon={<Headphones className="w-6 h-6" />} title={t("home.support247")} description={t("home.support247Desc")} />
          </div>
        </div>
      </section>

      {/* Features / why us */}
      <section id="features" className="py-20 lg:py-24 bg-slate-50 border-y border-slate-200">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{t("auto.text_c038d2")}؟</h2>
            <p className="text-slate-500">{t("auto.text_ced82c")}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Feature icon={<Globe className="w-5 h-5" />} title={t("home.liveTracking")} description={t("home.liveTrackingDesc")} />
            <Feature icon={<BarChart3 className="w-5 h-5" />} title={t("home.autoAccounting")} description={t("home.autoAccountingDesc")} />
            <Feature icon={<Clock className="w-5 h-5" />} title={t("home.estimatedDelivery")} description={t("home.estimatedDeliveryDesc")} />
            <Feature icon={<Award className="w-5 h-5" />} title={t("home.vipPricing")} description={t("home.vipPricingDesc")} />
            <Feature icon={<Shield className="w-5 h-5" />} title={t("home.dataProtection")} description={t("home.dataProtectionDesc")} />
            <Feature icon={<Zap className="w-5 h-5" />} title={t("home.fastScanner")} description={t("home.fastScannerDesc")} />
          </div>
        </div>
      </section>

      {/* Blog */}
      {posts.length > 0 && (
        <section className="py-20 lg:py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-12">{t("blog.latestPosts") || "نوێترین بابەتەکان"}</h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {posts.map((post: any) => (
                <Link key={post.id} href={`/portal/blog/${post.id}`}>
                  <div className="group h-full p-6 rounded-2xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all">
                    <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 mb-4">
                      <FileText className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2">{post.titleKu || post.titleEn || post.titleAr || ""}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2">{post.summaryKu || post.summaryEn || ""}</p>
                    <span className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-teal-600">{t("blog.readMore") || "زیاتر بخوێنەوە"} <ChevronLeft className="h-4 w-4" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Team */}
      {team.length > 0 && (
        <section className="py-20 lg:py-24 bg-slate-50 border-y border-slate-200">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-12">{t("home.ourTeam")}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {team.map((m: { id: string; name: string; role: string; description: string; imageUrl: string | null }) => (
                <div key={m.id} className="p-6 rounded-2xl bg-white border border-slate-200 text-center">
                  <div className="w-20 h-20 rounded-full mx-auto mb-4 overflow-hidden bg-teal-50 flex items-center justify-center">
                    {m.imageUrl ? <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" /> : <UserCircle className="h-10 w-10 text-teal-600" />}
                  </div>
                  <h3 className="font-semibold text-slate-900">{m.name}</h3>
                  <p className="text-sm text-teal-600 mb-2">{m.role}</p>
                  <p className="text-sm text-slate-500 line-clamp-3">{m.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-600 to-cyan-500 px-8 py-14 text-center shadow-xl shadow-teal-500/20">
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{t("auto.text_a969dd")}؟</h2>
              <p className="text-white/90 mb-8">{t("auto.text_e7a0f7")}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/customer-login">
                  <Button size="lg" className="bg-white text-teal-700 hover:bg-slate-100 shadow-md w-full sm:w-auto">
                    <Users className="me-2 h-5 w-5" /> {t("auto.text_410482")}
                  </Button>
                </Link>
                {company.phone && (
                  <a href={`tel:${company.phone}`}>
                    <Button size="lg" variant="outline" className="border-white/70 text-white hover:bg-white/10 w-full sm:w-auto">
                      <Phone className="me-2 h-5 w-5" /> {t("auto.text_6733ea")}
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-14">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <CompanyLogo size={40} fallbackBg="bg-gradient-to-br from-teal-500 to-cyan-500" />
                <div className="leading-tight">
                  <span className="text-lg font-bold text-slate-900">{company.name}</span>
                  <p className="text-[11px] text-slate-400">{t("auto.text_6fcd11")}</p>
                </div>
              </div>
              <p className="text-slate-500 mb-5 max-w-md">{t("auto.text_318460")}.</p>
              <div className="flex gap-3">
                <a href="#" className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-teal-600 hover:text-white transition-all"><Facebook className="w-5 h-5" /></a>
                <a href="#" className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-teal-600 hover:text-white transition-all"><Instagram className="w-5 h-5" /></a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-4">{t("home.quickLinks")}</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#services" className="text-slate-500 hover:text-teal-600 transition-colors">{t("home.services")}</a></li>
                <li><a href="#features" className="text-slate-500 hover:text-teal-600 transition-colors">{t("home.features")}</a></li>
                <li><Link href="/customer-login" className="text-slate-500 hover:text-teal-600 transition-colors">{t("home.customerPortal")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-4">{t("home.contact")}</h3>
              <ul className="space-y-3 text-sm">
                {company.phone && <li className="flex items-center gap-2.5 text-slate-500"><Phone className="w-4 h-4 text-teal-600" /><span dir="ltr">{company.phone}</span></li>}
                {company.phone2 && <li className="flex items-center gap-2.5 text-slate-500"><Phone className="w-4 h-4 text-teal-600" /><span dir="ltr">{company.phone2}</span></li>}
                {company.email && <li className="flex items-center gap-2.5 text-slate-500"><Mail className="w-4 h-4 text-teal-600" /><span>{company.email}</span></li>}
                {(company.address || company.addressKu) && <li className="flex items-center gap-2.5 text-slate-500"><MapPin className="w-4 h-4 text-teal-600" /><span>{company.address || company.addressKu}</span></li>}
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-sm text-slate-400">© {new Date().getFullYear()} {company.name}. {t("home.allRightsReserved")}</p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-teal-600 transition-colors">{t("home.terms")}</a>
              <a href="#" className="hover:text-teal-600 transition-colors">{t("home.privacy")}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({ icon, title, date, active, done }: { icon: React.ReactNode; title: string; date: string; active?: boolean; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", done ? "bg-teal-600 text-white" : active ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-400")}>{icon}</div>
      <div className="flex-1">
        <p className={cn("text-sm font-medium", active || done ? "text-slate-900" : "text-slate-400")}>{title}</p>
        <p className="text-xs text-slate-400">{date}</p>
      </div>
      {done && <CheckCircle className="w-4 h-4 text-teal-600" />}
    </div>
  );
}

function Stat({ number, label, icon }: { number: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="w-11 h-11 mx-auto mb-3 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">{icon}</div>
      <p className="text-2xl md:text-3xl font-extrabold text-slate-900">{number}</p>
      <p className="text-sm text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function Service({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group p-6 rounded-2xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">{icon}</div>
      <h3 className="font-semibold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3.5 p-5 rounded-2xl bg-white border border-slate-200">
      <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0">{icon}</div>
      <div>
        <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
