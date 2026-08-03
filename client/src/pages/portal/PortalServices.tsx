import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

import { 
  Plane, 
  Ship, 
  AlertTriangle,
  Package,
  Banknote,
  RefreshCw,
  ShoppingCart,
  Box,
  Shield,
  Warehouse,
  FileCheck,
  Truck,
  Sparkles,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle2
} from "lucide-react";

export default function PortalServices() {
const { language } = useLanguage();

// Banner colour follows the mode the customer picked, like every other page.

const { banner: portalBanner } = usePortalPalette();
  const isRTL = language === "ku" || language === "ar";

  const shippingServices = [
    {
      icon: Plane,
      title: language === "ku" ? "بارکردنی ئاسمانی ئاسایی" : language === "ar" ? "الشحن الجوي العادي" : "Air Regular",
      description: language === "ku" ? "خێرا و پارێزراو" : language === "ar" ? "سريع وآمن" : "Fast and secure",
      time: language === "ku" ? "7-14 ڕۆژ" : language === "ar" ? "7-14 يوم" : "7-14 days",
      color: "from-blue-500 to-blue-600",
      features: language === "ku" ? [
        "بەدواداچوونی ڕاستەوخۆ",
        "بیمەی بنەڕەتی",
        "گەیاندنی ماڵەوە",
      ] : language === "ar" ? [
        "تتبع مباشر",
        "تأمين أساسي",
        "توصيل للمنزل",
      ] : [
        "Real-time tracking",
        "Basic insurance",
        "Home delivery",
      ],
    },
    {
      icon: Ship,
      title: language === "ku" ? "بارکردنی دەریایی" : language === "ar" ? "الشحن البحري" : "Sea Shipping",
      description: language === "ku" ? "هەرزان بۆ بارە قورسەکان" : language === "ar" ? "اقتصادي للشحنات الثقيلة" : "Economical for heavy cargo",
      time: language === "ku" ? "30-45 ڕۆژ" : language === "ar" ? "30-45 يوم" : "30-45 days",
      color: "from-cyan-500 to-cyan-600",
      features: language === "ku" ? [
        "نرخی هەرزان",
        "بۆ بارە قورسەکان",
        "بێ سنووری کێش",
      ] : language === "ar" ? [
        "أسعار منخفضة",
        "للشحنات الثقيلة",
        "بدون حد للوزن",
      ] : [
        "Low prices",
        "For heavy cargo",
        "No weight limit",
      ],
    },
    {
      icon: AlertTriangle,
      title: language === "ku" ? "بارکردنی ئاسمانی نائاسایی" : language === "ar" ? "الشحن الجوي الخاص" : "Air Irregular",
      description: language === "ku" ? "بۆ کەلوپەلی تایبەت" : language === "ar" ? "للبضائع الخاصة" : "For special items",
      time: language === "ku" ? "10-20 ڕۆژ" : language === "ar" ? "10-20 يوم" : "10-20 days",
      color: "from-orange-500 to-orange-600",
      features: language === "ku" ? [
        "باتری و شلە",
        "کەلوپەلی ئەلیکترۆنی",
        "پاکەتی تایبەت",
      ] : language === "ar" ? [
        "البطاريات والسوائل",
        "الإلكترونيات",
        "الطرود الخاصة",
      ] : [
        "Batteries and liquids",
        "Electronics",
        "Special packages",
      ],
    },
  ];

  const additionalServices = [
    {
      icon: Banknote,
      title: language === "ku" ? "گواستنەوەی RMB" : language === "ar" ? "تحويل RMB" : "RMB Transfer",
      description: language === "ku" ? "گواستنەوەی پارە بۆ چین" : language === "ar" ? "تحويل الأموال إلى الصين" : "Money transfer to China",
      color: "bg-red-100 dark:bg-red-950/40 text-red-600",
    },
    {
      icon: RefreshCw,
      title: language === "ku" ? "گۆڕینی دراو" : language === "ar" ? "صرف العملات" : "Currency Exchange",
      description: language === "ku" ? "گۆڕینی دراوی بیانی" : language === "ar" ? "صرف العملات الأجنبية" : "Foreign currency exchange",
      color: "bg-green-100 dark:bg-green-950/40 text-green-600",
    },
    {
      icon: ShoppingCart,
      title: language === "ku" ? "کڕین لە چین" : language === "ar" ? "الشراء من الصين" : "Purchase from China",
      description: language === "ku" ? "ئێمە بۆت دەیکڕین" : language === "ar" ? "نشتري لك" : "We buy for you",
      color: "bg-purple-100 dark:bg-purple-950/40 text-purple-600",
    },
    {
      icon: Box,
      title: language === "ku" ? "پاکەتکردنی تایبەت" : language === "ar" ? "تغليف خاص" : "Custom Packaging",
      description: language === "ku" ? "پاکەتکردنی پارێزراو" : language === "ar" ? "تغليف آمن" : "Secure packaging",
      color: "bg-amber-100 dark:bg-amber-950/40 text-amber-600",
    },
    {
      icon: Shield,
      title: language === "ku" ? "بیمە" : language === "ar" ? "التأمين" : "Insurance",
      description: language === "ku" ? "بیمەی تەواوی بار" : language === "ar" ? "تأمين شامل" : "Full cargo insurance",
      color: "bg-blue-100 dark:bg-blue-950/40 text-blue-600",
    },
    {
      icon: Warehouse,
      title: language === "ku" ? "کرێی کۆگا" : language === "ar" ? "رسوم التخزين" : "Storage Fee",
      description: language === "ku" ? "هێشتنەوەی بار لە کۆگا" : language === "ar" ? "تخزين البضائع" : "Cargo storage",
      color: "bg-slate-100 dark:bg-slate-950/40 text-slate-600",
    },
    {
      icon: FileCheck,
      title: language === "ku" ? "ڕێکخستنی گومرگ" : language === "ar" ? "التخليص الجمركي" : "Customs Clearance",
      description: language === "ku" ? "ڕێکخستنی کاغەزەکان" : language === "ar" ? "ترتيب الأوراق" : "Document processing",
      color: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600",
    },
    {
      icon: Truck,
      title: language === "ku" ? "گەیاندنی ناوخۆیی" : language === "ar" ? "التوصيل المحلي" : "Domestic Delivery",
      description: language === "ku" ? "گەیاندن بۆ ماڵەوە" : language === "ar" ? "توصيل للمنزل" : "Home delivery",
      color: "bg-teal-100 dark:bg-teal-950/40 text-teal-600",
    },
  ];

  const contactInfo = [
    {
      icon: Phone,
      label: language === "ku" ? "تەلەفۆن" : language === "ar" ? "الهاتف" : "Phone",
      value: "+964 750 123 4567",
    },
    {
      icon: MessageCircle,
      label: language === "ku" ? "واتسئەپ" : language === "ar" ? "واتساب" : "WhatsApp",
      value: "+964 750 123 4567",
    },
  ];

  return (
    <CustomerPortalLayout>
      <div className={`min-h-screen bg-gray-50 dark:bg-gray-950/40 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="text-white px-4 pt-6 pb-8" style={portalBanner}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {language === "ku" ? "خزمەتگوزارییەکانمان" : language === "ar" ? "خدماتنا" : "Our Services"}
              </h1>
              <p className="text-sm text-indigo-100">
                {language === "ku" ? "هەموو خزمەتگوزارییەکان" : language === "ar" ? "جميع الخدمات" : "All services"}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-6 space-y-6 pb-24">
          {/* Shipping Services */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              {language === "ku" ? "خزمەتگوزاری بارکردن" : language === "ar" ? "خدمات الشحن" : "Shipping Services"}
            </h2>
            <div className="space-y-4">
              {shippingServices.map((service, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className={`bg-gradient-to-r ${service.color} p-4 flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <service.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{service.title}</h3>
                        <p className="text-sm text-white/80">{service.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-white/80 text-sm">
                        <Clock className="w-4 h-4" />
                        {service.time}
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {service.features.map((feature, fIndex) => (
                        <div key={fIndex} className="flex items-center gap-1 text-sm text-gray-600 bg-gray-100 dark:bg-gray-950/40 px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Services */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              {language === "ku" ? "خزمەتگوزاری زیادە" : language === "ar" ? "خدمات إضافية" : "Additional Services"}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {additionalServices.map((service, index) => (
                <div key={index} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className={`w-10 h-10 ${service.color} rounded-xl flex items-center justify-center mb-3`}>
                    <service.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-200 text-sm mb-1">{service.title}</h3>
                  <p className="text-xs text-gray-500">{service.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Section */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
            <h2 className="text-lg font-bold mb-2">
              {language === "ku" ? "پەیوەندیمان پێوە بکە" : language === "ar" ? "تواصل معنا" : "Contact Us"}
            </h2>
            <p className="text-sm text-gray-300 mb-4">
              {language === "ku" ? "بۆ زانیاری زیاتر یان داواکاری" : 
               language === "ar" ? "للمزيد من المعلومات أو الطلبات" : 
               "For more information or requests"}
            </p>
            <div className="space-y-3">
              {contactInfo.map((info, index) => (
                <div key={index} className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    <info.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{info.label}</p>
                    <p className="font-semibold">{info.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </CustomerPortalLayout>
  );
}
