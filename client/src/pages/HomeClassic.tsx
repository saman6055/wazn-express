import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/CompanyLogo";
import {
  Package, Plane, Ship, Globe, Shield, BarChart3, Users,
  MapPin, Clock, CheckCircle, Star, Phone, Mail, Facebook, Instagram,
  Truck, Zap, HeadphonesIcon, Award, ChevronRight, Search, FileText, UserCircle
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useLandingTheme } from "@/contexts/LandingThemeContext";
import { trpc } from "@/lib/trpc";

export default function HomeClassic() {
  const { t } = useTranslation();
  const company = useCompanyInfo();
  const { landingTheme } = useLandingTheme();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [trackingNumber, setTrackingNumber] = useState("");
  const { data: blogPosts = [] } = trpc.blog.published.useQuery(undefined, { staleTime: 2 * 60 * 1000 });
  const { data: teamMembers = [] } = trpc.public.getLandingTeam.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const posts = Array.isArray(blogPosts) ? blogPosts.slice(0, 3) : [];
  const team = Array.isArray(teamMembers) ? teamMembers.slice(0, 6) : [];

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "customer") {
        setLocation("/portal");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="landing-page min-h-screen flex items-center justify-center bg-[var(--landing-bg)]" data-theme={landingTheme}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <CompanyLogo
            size={48}
            iconClassName="h-8 w-8 text-[var(--landing-text)]"
            fallbackBg="bg-gradient-to-br from-amber-400 to-orange-500"
          />
          <p className="text-[var(--landing-text-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  const handleTrackPackage = () => {
    if (trackingNumber.trim()) {
      setLocation(`/customer-login?track=${trackingNumber}`);
    }
  };

  return (
    <div className="landing-page min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)] overflow-x-hidden" data-theme={landingTheme}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-pulse bg-[var(--landing-blur-1)]" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 rounded-full blur-3xl animate-pulse bg-[var(--landing-blur-2)]" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-20 right-1/4 w-64 h-64 rounded-full blur-3xl animate-pulse bg-[var(--landing-blur-3)]" style={{ animationDelay: '2s' }} />
      </div>

      <header className="relative z-50 border-b border-[var(--landing-border)] bg-[var(--landing-bg-header)] backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-4 flex h-20 items-center justify-between">
          <div className="flex items-center gap-3">
            <CompanyLogo
              size={28}
              className="shadow-lg opacity-90"
              iconClassName="h-5 w-5 text-[var(--landing-text)]"
              fallbackBg="bg-gradient-to-br from-amber-400 to-orange-500"
            />
            <div>
              <span className="text-xl font-bold text-[var(--landing-text)]">{company.name}</span>
              <p className="text-xs text-[var(--landing-text-muted)]">{t("auto.text_6fcd11")} </p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-sm text-[var(--landing-text-muted)] hover:text-[var(--landing-text)] transition-colors">{t("home.services")}</a>
            <a href="#features" className="text-sm text-[var(--landing-text-muted)] hover:text-[var(--landing-text)] transition-colors">{t("home.features")}</a>
            <a href="#contact" className="text-sm text-[var(--landing-text-muted)] hover:text-[var(--landing-text)] transition-colors">{t("home.contact")}</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/customer-login">
              <Button variant="ghost" className="text-[var(--landing-text-muted)] hover:text-[var(--landing-text)] hover:opacity-90">
                <Users className="me-2 h-4 w-4" />
                <span className="hidden sm:inline">{t("home.customerPortal")}</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--landing-accent-subtle)] border border-[var(--landing-border)] rounded-full text-[var(--landing-accent)] text-sm mb-6">
                <Zap className="w-4 h-4" />
                <span>{t("home.fastReliable")}</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                <span className="text-[var(--landing-text)]">{t("auto.text_4904bd")}</span>
                <br />
                <span className="bg-[linear-gradient(to_right,var(--landing-cta-from),var(--landing-cta-to))] bg-clip-text text-transparent">{t("auto.text_33d433")}</span>
              </h1>
              <p className="text-lg text-[var(--landing-text-muted)] mb-8 max-w-xl mx-auto lg:mx-0 lg:me-0">{t("home.heroDescription")}</p>
              <div className="bg-[var(--landing-card)] backdrop-blur-sm border border-[var(--landing-border)] rounded-2xl p-4 mb-8 max-w-md mx-auto lg:mx-0 lg:me-0">
                <p className="text-sm text-[var(--landing-text-muted)] mb-3 text-right">{t("home.quickTrack")}</p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder={t("home.trackingPlaceholder")}
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleTrackPackage()}
                    className="bg-[var(--landing-stats-bg)] border-[var(--landing-border)] text-[var(--landing-text)] placeholder:text-[var(--landing-text-muted)] text-right"
                  />
                  <Button onClick={handleTrackPackage} className="bg-[var(--landing-accent)] hover:opacity-90 px-6 text-white">
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/customer-login">
                  <Button size="lg" className="bg-[linear-gradient(to_right,var(--landing-cta-from),var(--landing-cta-to))] hover:opacity-90 text-white shadow-xl w-full sm:w-auto">
                    <Users className="me-2 h-5 w-5" />
                    {t("auto.text_623179")}
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="relative">
                <div className="bg-[var(--landing-card)] border border-[var(--landing-border)] rounded-3xl p-8 shadow-2xl">
                  <div className="flex items-center gap-4 mb-6">
                    <CompanyLogo size={48} iconClassName="h-8 w-8 text-[var(--landing-text)]" fallbackBg="bg-gradient-to-br from-amber-400 to-orange-500" />
                    <div>
                      <p className="text-[var(--landing-text)] font-semibold">{t("home.packageTracking")}</p>
                      <p className="text-[var(--landing-text-muted)] text-sm">{t("home.liveReliable")}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <TrackingStep icon={<CheckCircle className="w-4 h-4" />} title={t("home.receivedChina")} date="٢٠٢٤/١٢/١٥" active completed />
                    <TrackingStep icon={<Plane className="w-4 h-4" />} title={t("home.onTheWay")} date="٢٠٢٤/١٢/١٧" active completed />
                    <TrackingStep icon={<Truck className="w-4 h-4" />} title={t("home.arrivedIraq")} date="٢٠٢٤/١٢/١٩" active />
                    <TrackingStep icon={<MapPin className="w-4 h-4" />} title={t("home.delivery")} date={t("home.expected")} />
                  </div>
                </div>
                <div className="absolute -top-6 -right-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 shadow-xl shadow-green-500/30 animate-bounce" style={{ animationDuration: '3s' }}>
                  <p className="text-3xl font-bold text-white">٩٨%</p>
                  <p className="text-green-100 text-sm">{t("home.deliveryRate")}</p>
                </div>
                <div className="absolute -bottom-4 -left-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 shadow-xl shadow-blue-500/30 animate-bounce" style={{ animationDuration: '4s' }}>
                  <p className="text-3xl font-bold text-white">٢٤/٧</p>
                  <p className="text-blue-100 text-sm">{t("home.support")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-16 border-y border-[var(--landing-border)] bg-[var(--landing-stats-bg)]">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard number="١٠,٠٠٠+" label={t("home.packagesDelivered")} icon={<Package className="w-6 h-6" />} />
            <StatCard number="٥+" label={t("home.countries")} icon={<Globe className="w-6 h-6" />} />
            <StatCard number="٢,٠٠٠+" label={t("home.happyCustomers")} icon={<Users className="w-6 h-6" />} />
            <StatCard number="٩٨%" label={t("home.satisfaction")} icon={<Star className="w-6 h-6" />} />
          </div>
        </div>
      </section>

      <section id="services" className="relative py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[var(--landing-text)]">{t("auto.text_868529")}</h2>
            <p className="text-[var(--landing-text-muted)] max-w-2xl mx-auto">{t("auto.text_743b9f")}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ServiceCard icon={<Plane className="w-8 h-8" />} title={t("home.airShipping")} description={t("home.airShippingDesc")} color="from-blue-500 to-cyan-500" />
            <ServiceCard icon={<Ship className="w-8 h-8" />} title={t("home.seaShipping")} description={t("home.seaShippingDesc")} color="from-indigo-500 to-purple-500" />
            <ServiceCard icon={<Package className="w-8 h-8" />} title={t("home.consolidation")} description={t("home.consolidationDesc")} color="from-amber-500 to-orange-500" />
            <ServiceCard icon={<Truck className="w-8 h-8" />} title={t("home.domesticDelivery")} description={t("home.domesticDeliveryDesc")} color="from-green-500 to-emerald-500" />
            <ServiceCard icon={<Shield className="w-8 h-8" />} title={t("home.cargoInsurance")} description={t("home.cargoInsuranceDesc")} color="from-red-500 to-pink-500" />
            <ServiceCard icon={<HeadphonesIcon className="w-8 h-8" />} title={t("home.support247")} description={t("home.support247Desc")} color="from-violet-500 to-purple-500" />
          </div>
        </div>
      </section>

      <section id="features" className="landing-features-section relative py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-[linear-gradient(to_right,var(--landing-cta-from),var(--landing-cta-to))] bg-clip-text text-transparent">{t("auto.text_c038d2")}؟</span>
            </h2>
            <p className="text-[var(--landing-text-muted)] max-w-2xl mx-auto">{t("auto.text_ced82c")}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <FeatureItem icon={<Globe className="w-5 h-5" />} title={t("home.liveTracking")} description={t("home.liveTrackingDesc")} />
            <FeatureItem icon={<BarChart3 className="w-5 h-5" />} title={t("home.autoAccounting")} description={t("home.autoAccountingDesc")} />
            <FeatureItem icon={<Clock className="w-5 h-5" />} title={t("home.estimatedDelivery")} description={t("home.estimatedDeliveryDesc")} />
            <FeatureItem icon={<Award className="w-5 h-5" />} title={t("home.vipPricing")} description={t("home.vipPricingDesc")} />
            <FeatureItem icon={<Shield className="w-5 h-5" />} title={t("home.dataProtection")} description={t("home.dataProtectionDesc")} />
            <FeatureItem icon={<Zap className="w-5 h-5" />} title={t("home.fastScanner")} description={t("home.fastScannerDesc")} />
          </div>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="relative py-24 border-t border-[var(--landing-border)] bg-[var(--landing-stats-bg)]/50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-[var(--landing-text)] mb-12">{t("blog.latestPosts") || "نوێترین بابەتەکان"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {posts.map((post: any) => (
                <Link key={post.id} href={`/portal/blog/${post.id}`}>
                  <div className="group p-6 rounded-2xl bg-[var(--landing-card)] border border-[var(--landing-border)] hover:border-[var(--landing-accent)]/50 transition-all">
                    <div className="w-12 h-12 rounded-xl bg-[var(--landing-accent-subtle)] flex items-center justify-center text-[var(--landing-accent)] mb-3">
                      <FileText className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-[var(--landing-text)] mb-2 line-clamp-2">{post.titleKu || post.titleEn || post.titleAr || ""}</h3>
                    <p className="text-sm text-[var(--landing-text-muted)] line-clamp-2">{post.summaryKu || post.summaryEn || ""}</p>
                    <span className="inline-flex items-center gap-1 mt-3 text-sm text-[var(--landing-accent)]">{t("blog.readMore") || "زیاتر بخوێنەوە"} <ChevronRight className="h-4 w-4" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {team.length > 0 && (
        <section className="relative py-24 border-t border-[var(--landing-border)]">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-[var(--landing-text)] mb-12">{t("home.ourTeam")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {team.map((member: { id: string; name: string; role: string; description: string; imageUrl: string | null }) => (
                <div key={member.id} className="p-6 rounded-2xl bg-[var(--landing-card)] border border-[var(--landing-border)] text-center">
                  <div className="w-20 h-20 rounded-full mx-auto mb-4 overflow-hidden bg-[var(--landing-accent-subtle)] flex items-center justify-center">
                    {member.imageUrl ? <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" /> : <UserCircle className="h-10 w-10 text-[var(--landing-accent)]" />}
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

      <section className="relative py-24">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl p-12 text-center relative overflow-hidden bg-[linear-gradient(to_right,var(--landing-cta-from),var(--landing-cta-to))]">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t("auto.text_a969dd")}؟</h2>
              <p className="text-white/90 mb-8 max-w-xl mx-auto">{t("auto.text_e7a0f7")}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/customer-login">
                  <Button size="lg" className="bg-white text-amber-600 hover:bg-slate-100 shadow-xl w-full sm:w-auto">
                    <Users className="me-2 h-5 w-5" />
                    {t("auto.text_410482")}
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/20 w-full sm:w-auto">
                  <Phone className="me-2 h-5 w-5" />
                  {t("auto.text_6733ea")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="relative py-24 border-t border-[var(--landing-border)]">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <CompanyLogo size={48} iconClassName="h-6 w-6 text-[var(--landing-text)]" fallbackBg="bg-gradient-to-br from-amber-400 to-orange-500" />
                <div>
                  <span className="text-xl font-bold text-[var(--landing-text)]">{company.name}</span>
                  <p className="text-xs text-[var(--landing-text-muted)]">{t("auto.text_6fcd11")} </p>
                </div>
              </div>
              <p className="text-[var(--landing-text-muted)] mb-6 max-w-md">{t("auto.text_318460")}.</p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-[var(--landing-card)] rounded-lg flex items-center justify-center text-[var(--landing-text-muted)] hover:bg-[var(--landing-accent)] hover:text-white transition-all"><Facebook className="w-5 h-5" /></a>
                <a href="#" className="w-10 h-10 bg-[var(--landing-card)] rounded-lg flex items-center justify-center text-[var(--landing-text-muted)] hover:bg-[var(--landing-accent)] hover:text-white transition-all"><Instagram className="w-5 h-5" /></a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--landing-text)] mb-4">{t("home.quickLinks")}</h3>
              <ul className="space-y-3">
                <li><a href="#services" className="text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)] transition-colors flex items-center gap-2"><ChevronRight className="w-4 h-4" /> {t("home.services")}</a></li>
                <li><a href="#features" className="text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)] transition-colors flex items-center gap-2"><ChevronRight className="w-4 h-4" /> {t("home.features")}</a></li>
                <li><Link href="/customer-login" className="text-[var(--landing-text-muted)] hover:text-[var(--landing-accent)] transition-colors flex items-center gap-2"><ChevronRight className="w-4 h-4" /> {t("home.customerPortal")}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--landing-text)] mb-4">{t("home.contact")}</h3>
              <ul className="space-y-3">
                {company.phone && (
                  <li className="flex items-center gap-3 text-[var(--landing-text-muted)]">
                    <Phone className="w-4 h-4 text-[var(--landing-accent)]" />
                    <span dir="ltr">{company.phone}</span>
                  </li>
                )}
                {company.phone2 && (
                  <li className="flex items-center gap-3 text-[var(--landing-text-muted)]">
                    <Phone className="w-4 h-4 text-[var(--landing-accent)]" />
                    <span dir="ltr">{company.phone2}</span>
                  </li>
                )}
                {company.email && (
                  <li className="flex items-center gap-3 text-[var(--landing-text-muted)]">
                    <Mail className="w-4 h-4 text-[var(--landing-accent)]" />
                    <span>{company.email}</span>
                  </li>
                )}
                {(company.address || company.addressKu) && (
                  <li className="flex items-center gap-3 text-[var(--landing-text-muted)]">
                    <MapPin className="w-4 h-4 text-[var(--landing-accent)]" />
                    <span>{company.address || company.addressKu || t("home.erbilIraq")}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--landing-border)] bg-[var(--landing-bg-footer)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-[var(--landing-text-muted)]">© {new Date().getFullYear()} {company.name}. {t("home.allRightsReserved")}</p>
            <div className="flex items-center gap-6 text-sm text-[var(--landing-text-muted)]">
              <a href="#" className="hover:text-[var(--landing-accent)] transition-colors">{t("home.terms")}</a>
              <a href="#" className="hover:text-[var(--landing-accent)] transition-colors">{t("home.privacy")}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TrackingStep({ icon, title, date, active, completed }: { icon: React.ReactNode; title: string; date: string; active?: boolean; completed?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all", completed ? "bg-green-500 text-white" : active ? "bg-[var(--landing-accent)] text-white" : "bg-[var(--landing-card)] text-[var(--landing-text-muted)]")}>{icon}</div>
      <div className="flex-1">
        <p className={cn("text-sm font-medium", active ? "text-[var(--landing-text)]" : "text-[var(--landing-text-muted)]")}>{title}</p>
        <p className="text-xs text-[var(--landing-text-muted)] opacity-80">{date}</p>
      </div>
      {completed && <CheckCircle className="w-4 h-4 text-green-500" />}
    </div>
  );
}

function StatCard({ number, label, icon }: { number: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 mx-auto mb-3 bg-[var(--landing-accent-subtle)] rounded-xl flex items-center justify-center text-[var(--landing-accent)]">{icon}</div>
      <p className="text-3xl font-bold text-[var(--landing-text)] mb-1">{number}</p>
      <p className="text-[var(--landing-text-muted)] text-sm">{label}</p>
    </div>
  );
}

function ServiceCard({ icon, title, description, color }: { icon: React.ReactNode; title: string; description: string; color: string }) {
  return (
    <div className="group p-6 rounded-2xl bg-[var(--landing-card)] border border-[var(--landing-border)] hover:bg-[var(--landing-stats-bg)] transition-all duration-300 hover:-translate-y-1">
      <div className={cn("w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center text-white mb-4 shadow-lg", color)}>{icon}</div>
      <h3 className="font-semibold text-[var(--landing-text)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--landing-text-muted)]">{description}</p>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--landing-card)] border border-[var(--landing-border)]">
      <div className="w-10 h-10 rounded-lg bg-[var(--landing-accent-subtle)] flex items-center justify-center text-[var(--landing-accent)] flex-shrink-0">{icon}</div>
      <div>
        <h3 className="font-semibold text-[var(--landing-text)] mb-1">{title}</h3>
        <p className="text-sm text-[var(--landing-text-muted)]">{description}</p>
      </div>
    </div>
  );
}
