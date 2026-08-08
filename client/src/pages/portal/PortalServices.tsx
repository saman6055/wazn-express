import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { pickLang } from "@/lib/lang";

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
      title: pickLang(language, { ku: "بارکردنی ئاسمانی ئاسایی", en: "Air Regular", ar: "الشحن الجوي العادي", zh: "普通空运" }),
      description: pickLang(language, { ku: "خێرا و پارێزراو", en: "Fast and secure", ar: "سريع وآمن", zh: "快速且安全" }),
      time: pickLang(language, { ku: "7-14 ڕۆژ", en: "7-14 days", ar: "7-14 يوم", zh: "7-14 天" }),
      color: "from-blue-500 to-blue-600",
      features: language === "ku" ? [
        "بەدواداچوونی ڕاستەوخۆ",
        "بیمەی بنەڕەتی",
        "گەیاندنی ماڵەوە",
      ] : language === "ar" ? [
        "تتبع مباشر",
        "تأمين أساسي",
        "توصيل للمنزل",
      ] : language === "zh" ? [
        "实时追踪",
        "基础保险",
        "送货上门",
      ] : [
        "Real-time tracking",
        "Basic insurance",
        "Home delivery",
      ],
    },
    {
      icon: Ship,
      title: pickLang(language, { ku: "بارکردنی دەریایی", en: "Sea Shipping", ar: "الشحن البحري", zh: "海运" }),
      description: pickLang(language, { ku: "هەرزان بۆ بارە قورسەکان", en: "Economical for heavy cargo", ar: "اقتصادي للشحنات الثقيلة", zh: "重货更经济" }),
      time: pickLang(language, { ku: "30-45 ڕۆژ", en: "30-45 days", ar: "30-45 يوم", zh: "30-45 天" }),
      color: "from-cyan-500 to-cyan-600",
      features: language === "ku" ? [
        "نرخی هەرزان",
        "بۆ بارە قورسەکان",
        "بێ سنووری کێش",
      ] : language === "ar" ? [
        "أسعار منخفضة",
        "للشحنات الثقيلة",
        "بدون حد للوزن",
      ] : language === "zh" ? [
        "价格实惠",
        "适合重货",
        "无重量限制",
      ] : [
        "Low prices",
        "For heavy cargo",
        "No weight limit",
      ],
    },
    {
      icon: AlertTriangle,
      title: pickLang(language, { ku: "بارکردنی ئاسمانی نائاسایی", en: "Air Irregular", ar: "الشحن الجوي الخاص", zh: "特殊空运" }),
      description: pickLang(language, { ku: "بۆ کەلوپەلی تایبەت", en: "For special items", ar: "للبضائع الخاصة", zh: "适用于特殊货物" }),
      time: pickLang(language, { ku: "10-20 ڕۆژ", en: "10-20 days", ar: "10-20 يوم", zh: "10-20 天" }),
      color: "from-orange-500 to-orange-600",
      features: language === "ku" ? [
        "باتری و شلە",
        "کەلوپەلی ئەلیکترۆنی",
        "پاکەتی تایبەت",
      ] : language === "ar" ? [
        "البطاريات والسوائل",
        "الإلكترونيات",
        "الطرود الخاصة",
      ] : language === "zh" ? [
        "电池与液体",
        "电子产品",
        "特殊包装货物",
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
      title: pickLang(language, { ku: "گواستنەوەی RMB", en: "RMB Transfer", ar: "تحويل RMB", zh: "人民币汇款" }),
      description: pickLang(language, { ku: "گواستنەوەی پارە بۆ چین", en: "Money transfer to China", ar: "تحويل الأموال إلى الصين", zh: "汇款至中国" }),
      color: "bg-red-100 dark:bg-red-950/40 text-red-600",
    },
    {
      icon: RefreshCw,
      title: pickLang(language, { ku: "گۆڕینی دراو", en: "Currency Exchange", ar: "صرف العملات", zh: "货币兑换" }),
      description: pickLang(language, { ku: "گۆڕینی دراوی بیانی", en: "Foreign currency exchange", ar: "صرف العملات الأجنبية", zh: "外币兑换" }),
      color: "bg-green-100 dark:bg-green-950/40 text-green-600",
    },
    {
      icon: ShoppingCart,
      title: pickLang(language, { ku: "کڕین لە چین", en: "Purchase from China", ar: "الشراء من الصين", zh: "中国代购" }),
      description: pickLang(language, { ku: "ئێمە بۆت دەیکڕین", en: "We buy for you", ar: "نشتري لك", zh: "我们代您采购" }),
      color: "bg-purple-100 dark:bg-purple-950/40 text-purple-600",
    },
    {
      icon: Box,
      title: pickLang(language, { ku: "پاکەتکردنی تایبەت", en: "Custom Packaging", ar: "تغليف خاص", zh: "定制包装" }),
      description: pickLang(language, { ku: "پاکەتکردنی پارێزراو", en: "Secure packaging", ar: "تغليف آمن", zh: "安全包装" }),
      color: "bg-amber-100 dark:bg-amber-950/40 text-amber-600",
    },
    {
      icon: Shield,
      title: pickLang(language, { ku: "بیمە", en: "Insurance", ar: "التأمين", zh: "保险" }),
      description: pickLang(language, { ku: "بیمەی تەواوی بار", en: "Full cargo insurance", ar: "تأمين شامل", zh: "全额货物保险" }),
      color: "bg-blue-100 dark:bg-blue-950/40 text-blue-600",
    },
    {
      icon: Warehouse,
      title: pickLang(language, { ku: "کرێی کۆگا", en: "Storage Fee", ar: "رسوم التخزين", zh: "仓储费" }),
      description: pickLang(language, { ku: "هێشتنەوەی بار لە کۆگا", en: "Cargo storage", ar: "تخزين البضائع", zh: "货物仓储" }),
      color: "bg-slate-100 dark:bg-slate-950/40 text-slate-600",
    },
    {
      icon: FileCheck,
      title: pickLang(language, { ku: "ڕێکخستنی گومرگ", en: "Customs Clearance", ar: "التخليص الجمركي", zh: "清关服务" }),
      description: pickLang(language, { ku: "ڕێکخستنی کاغەزەکان", en: "Document processing", ar: "ترتيب الأوراق", zh: "单证处理" }),
      color: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600",
    },
    {
      icon: Truck,
      title: pickLang(language, { ku: "گەیاندنی ناوخۆیی", en: "Domestic Delivery", ar: "التوصيل المحلي", zh: "本地配送" }),
      description: pickLang(language, { ku: "گەیاندن بۆ ماڵەوە", en: "Home delivery", ar: "توصيل للمنزل", zh: "送货上门" }),
      color: "bg-teal-100 dark:bg-teal-950/40 text-teal-600",
    },
  ];

  const contactInfo = [
    {
      icon: Phone,
      label: pickLang(language, { ku: "تەلەفۆن", en: "Phone", ar: "الهاتف", zh: "电话" }),
      value: "+964 750 123 4567",
    },
    {
      icon: MessageCircle,
      label: pickLang(language, { ku: "واتسئەپ", en: "WhatsApp", ar: "واتساب", zh: "WhatsApp" }),
      value: "+964 750 123 4567",
    },
  ];

  return (
    <PortalLayout>
      <div className={`min-h-screen bg-gray-50 dark:bg-gray-950/40 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="text-white px-4 pt-6 pb-8" style={portalBanner}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {pickLang(language, { ku: "خزمەتگوزارییەکانمان", en: "Our Services", ar: "خدماتنا", zh: "我们的服务" })}
              </h1>
              <p className="text-sm text-indigo-100">
                {pickLang(language, { ku: "هەموو خزمەتگوزارییەکان", en: "All services", ar: "جميع الخدمات", zh: "全部服务" })}
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
              {pickLang(language, { ku: "خزمەتگوزاری بارکردن", en: "Shipping Services", ar: "خدمات الشحن", zh: "运输服务" })}
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
              {pickLang(language, { ku: "خزمەتگوزاری زیادە", en: "Additional Services", ar: "خدمات إضافية", zh: "增值服务" })}
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
              {pickLang(language, { ku: "پەیوەندیمان پێوە بکە", en: "Contact Us", ar: "تواصل معنا", zh: "联系我们" })}
            </h2>
            <p className="text-sm text-gray-300 mb-4">
              {pickLang(language, { ku: "بۆ زانیاری زیاتر یان داواکاری", en: "For more information or requests", ar: "للمزيد من المعلومات أو الطلبات", zh: "如需更多信息或下单" })}
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
    </PortalLayout>
  );
}
