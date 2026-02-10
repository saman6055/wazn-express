import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { 
  Package, Plane, Ship, Globe, Shield, BarChart3, ArrowRight, Users, 
  MapPin, Clock, CheckCircle, Star, Phone, Mail, Facebook, Instagram,
  Truck, Zap, HeadphonesIcon, Award, ChevronRight, Search
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Home() {
    const { t } = useTranslation();
const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [trackingNumber, setTrackingNumber] = useState("");

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
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
            <Package className="h-8 w-8 text-white" />
          </div>
          <p className="text-slate-400">Loading...</p>
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
    <div className="min-h-screen bg-slate-900 text-white overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-4 flex h-20 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Wazn Express
              </span>
              <p className="text-xs text-slate-400">{t("auto.text_6fcd11")} </p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-sm text-slate-300 hover:text-white transition-colors">{t("home.services")}</a>
            <a href="#features" className="text-sm text-slate-300 hover:text-white transition-colors">{t("home.features")}</a>
            <a href="#contact" className="text-sm text-slate-300 hover:text-white transition-colors">{t("home.contact")}</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/customer-login">
              <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/10">
                <Users className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{t("home.customerPortal")}</span>
              </Button>
            </Link>
            <Link href="/staff-login">
              <Button 
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30"
              >
                {t("auto.text_9b64a9")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-right">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-sm mb-6">
                <Zap className="w-4 h-4" />
                <span>{t("home.fastReliable")}</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  {t("auto.text_4904bd")}
                </span>
                <br />
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                  {t("auto.text_33d433")}
                </span>
              </h1>
              
              <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto lg:mx-0 lg:mr-0">
                {t("home.heroDescription")}
              </p>

              {/* Quick Track */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-8 max-w-md mx-auto lg:mx-0 lg:mr-0">
                <p className="text-sm text-slate-400 mb-3 text-right">{t("home.quickTrack")}</p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder={t("home.trackingPlaceholder")}
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleTrackPackage()}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 text-right"
                  />
                  <Button 
                    onClick={handleTrackPackage}
                    className="bg-amber-500 hover:bg-amber-600 px-6"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/customer-login">
                  <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-xl shadow-amber-500/30 w-full sm:w-auto">
                    <Users className="mr-2 h-5 w-5" />
                    {t("auto.text_623179")}
                  </Button>
                </Link>
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={() => window.location.href = getLoginUrl()}
                  className="border-white/20 text-white hover:bg-white/10 w-full sm:w-auto"
                >
                  {t("home.staffLogin")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative hidden lg:block">
              <div className="relative">
                {/* Main Card */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
                      <Package className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">{t("home.packageTracking")}</p>
                      <p className="text-slate-400 text-sm">{t("home.liveReliable")}</p>
                    </div>
                  </div>
                  
                  {/* Tracking Timeline */}
                  <div className="space-y-4">
                    <TrackingStep 
                      icon={<CheckCircle className="w-4 h-4" />}
                      title={t("home.receivedChina")}
                      date="٢٠٢٤/١٢/١٥"
                      active
                      completed
                    />
                    <TrackingStep 
                      icon={<Plane className="w-4 h-4" />}
                      title={t("home.onTheWay")}
                      date="٢٠٢٤/١٢/١٧"
                      active
                      completed
                    />
                    <TrackingStep 
                      icon={<Truck className="w-4 h-4" />}
                      title={t("home.arrivedIraq")}
                      date="٢٠٢٤/١٢/١٩"
                      active
                    />
                    <TrackingStep 
                      icon={<MapPin className="w-4 h-4" />}
                      title={t("home.delivery")}
                      date={t("home.expected")}
                    />
                  </div>
                </div>

                {/* Floating Stats Cards */}
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

      {/* Stats Section */}
      <section className="relative py-16 border-y border-white/10 bg-white/5">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard number="١٠,٠٠٠+" label={t("home.packagesDelivered")} icon={<Package className="w-6 h-6" />} />
            <StatCard number="٥+" label={t("home.countries")} icon={<Globe className="w-6 h-6" />} />
            <StatCard number="٢,٠٠٠+" label={t("home.happyCustomers")} icon={<Users className="w-6 h-6" />} />
            <StatCard number="٩٨%" label={t("home.satisfaction")} icon={<Star className="w-6 h-6" />} />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="relative py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                {t("auto.text_868529")}
              </span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              {t("auto.text_743b9f")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ServiceCard
              icon={<Plane className="w-8 h-8" />}
              title={t("home.airShipping")}
              description={t("home.airShippingDesc")}
              color="from-blue-500 to-cyan-500"
            />
            <ServiceCard
              icon={<Ship className="w-8 h-8" />}
              title={t("home.seaShipping")}
              description={t("home.seaShippingDesc")}
              color="from-indigo-500 to-purple-500"
            />
            <ServiceCard
              icon={<Package className="w-8 h-8" />}
              title={t("home.consolidation")}
              description={t("home.consolidationDesc")}
              color="from-amber-500 to-orange-500"
            />
            <ServiceCard
              icon={<Truck className="w-8 h-8" />}
              title={t("home.domesticDelivery")}
              description={t("home.domesticDeliveryDesc")}
              color="from-green-500 to-emerald-500"
            />
            <ServiceCard
              icon={<Shield className="w-8 h-8" />}
              title={t("home.cargoInsurance")}
              description={t("home.cargoInsuranceDesc")}
              color="from-red-500 to-pink-500"
            />
            <ServiceCard
              icon={<HeadphonesIcon className="w-8 h-8" />}
              title={t("home.support247")}
              description={t("home.support247Desc")}
              color="from-violet-500 to-purple-500"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                {t("auto.text_c038d2")}؟
              </span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              {t("auto.text_ced82c")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <FeatureItem 
              icon={<Globe className="w-5 h-5" />}
              title={t("home.liveTracking")}
              description={t("home.liveTrackingDesc")}
            />
            <FeatureItem 
              icon={<BarChart3 className="w-5 h-5" />}
              title={t("home.autoAccounting")}
              description={t("home.autoAccountingDesc")}
            />
            <FeatureItem 
              icon={<Clock className="w-5 h-5" />}
              title={t("home.estimatedDelivery")}
              description={t("home.estimatedDeliveryDesc")}
            />
            <FeatureItem 
              icon={<Award className="w-5 h-5" />}
              title={t("home.vipPricing")}
              description={t("home.vipPricingDesc")}
            />
            <FeatureItem 
              icon={<Shield className="w-5 h-5" />}
              title={t("home.dataProtection")}
              description={t("home.dataProtectionDesc")}
            />
            <FeatureItem 
              icon={<Zap className="w-5 h-5" />}
              title={t("home.fastScanner")}
              description={t("home.fastScannerDesc")}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24">
        <div className="container mx-auto px-4">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {t("auto.text_a969dd")}؟
              </h2>
              <p className="text-white/90 mb-8 max-w-xl mx-auto">
                {t("auto.text_e7a0f7")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/customer-login">
                  <Button size="lg" className="bg-white text-amber-600 hover:bg-slate-100 shadow-xl w-full sm:w-auto">
                    <Users className="mr-2 h-5 w-5" />
                    {t("auto.text_410482")}
                  </Button>
                </Link>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-white text-white hover:bg-white/20 w-full sm:w-auto"
                >
                  <Phone className="mr-2 h-5 w-5" />
                  {t("auto.text_6733ea")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="relative py-24 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold text-white">Wazn Express</span>
                  <p className="text-xs text-slate-400">{t("auto.text_6fcd11")} </p>
                </div>
              </div>
              <p className="text-slate-400 mb-6 max-w-md">
                {t("auto.text_318460")}.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-slate-400 hover:bg-amber-500 hover:text-white transition-all">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-slate-400 hover:bg-amber-500 hover:text-white transition-all">
                  <Instagram className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-white mb-4">{t("home.quickLinks")}</h3>
              <ul className="space-y-3">
                <li><a href="#services" className="text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-2"><ChevronRight className="w-4 h-4" /> {t("home.services")}</a></li>
                <li><a href="#features" className="text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-2"><ChevronRight className="w-4 h-4" /> {t("home.features")}</a></li>
                <li><Link href="/customer-login" className="text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-2"><ChevronRight className="w-4 h-4" /> {t("home.customerPortal")}</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="font-semibold text-white mb-4">{t("home.contact")}</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-slate-400">
                  <Phone className="w-4 h-4 text-amber-400" />
                  <span dir="ltr">+964 750 123 4567</span>
                </li>
                <li className="flex items-center gap-3 text-slate-400">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>info@waznexpress.com</span>
                </li>
                <li className="flex items-center gap-3 text-slate-400">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span>{t("home.erbilIraq")}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Wazn Express. {t("home.allRightsReserved")}
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href="#" className="hover:text-amber-400 transition-colors">{t("home.terms")}</a>
              <a href="#" className="hover:text-amber-400 transition-colors">{t("home.privacy")}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Component: Tracking Step
function TrackingStep({ icon, title, date, active, completed }: { 
  icon: React.ReactNode; 
  title: string; 
  date: string;
  active?: boolean;
  completed?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-all",
        completed ? "bg-green-500 text-white" : 
        active ? "bg-amber-500 text-white" : 
        "bg-slate-700 text-slate-400"
      )}>
        {icon}
      </div>
      <div className="flex-1">
        <p className={cn(
          "text-sm font-medium",
          active ? "text-white" : "text-slate-400"
        )}>{title}</p>
        <p className="text-xs text-slate-500">{date}</p>
      </div>
      {completed && <CheckCircle className="w-4 h-4 text-green-500" />}
    </div>
  );
}

// Component: Stat Card
function StatCard({ number, label, icon }: { number: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 mx-auto mb-3 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
        {icon}
      </div>
      <p className="text-3xl font-bold text-white mb-1">{number}</p>
      <p className="text-slate-400 text-sm">{label}</p>
    </div>
  );
}

// Component: Service Card
function ServiceCard({ icon, title, description, color }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  color: string;
}) {
  return (
    <div className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1">
      <div className={cn(
        "w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center text-white mb-4 shadow-lg",
        color
      )}>
        {icon}
      </div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}

// Component: Feature Item
function FeatureItem({ icon, title, description }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}
