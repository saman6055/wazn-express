import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { 
  FileText, 
  Shield, 
  Clock, 
  AlertTriangle, 
  Package, 
  DollarSign,
  Truck,
  Scale,
  CheckCircle2,
  XCircle
} from "lucide-react";

export default function PortalTerms() {
const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";

  const sections = [
    {
      icon: Package,
      title: language === "ku" ? "مەرجەکانی بار" : language === "ar" ? "شروط الشحن" : "Shipping Terms",
      color: "from-blue-500 to-blue-600",
      items: language === "ku" ? [
        "هەموو بارەکان دەبێت نیشانەی بار (Shipping Mark) هەبێت",
        "بارە بێ نیشانەکان بەرپرسیاریەتی کۆمپانیا نییە",
        "کێشی بار دەبێت لەگەڵ وەسفەکە یەک بگرێتەوە",
        "بارە قەدەغەکراوەکان وەرناگیرێن (چەک، مادەی کیمیایی، هتد)",
      ] : language === "ar" ? [
        "جميع الشحنات يجب أن تحمل علامة الشحن",
        "الشحنات بدون علامة ليست مسؤولية الشركة",
        "يجب أن يتطابق الوزن مع الوصف",
        "لا نقبل البضائع المحظورة (أسلحة، مواد كيميائية، إلخ)",
      ] : [
        "All shipments must have a shipping mark",
        "Packages without marks are not company's responsibility",
        "Weight must match the description",
        "Prohibited items are not accepted (weapons, chemicals, etc.)",
      ],
    },
    {
      icon: DollarSign,
      title: language === "ku" ? "مەرجەکانی پارەدان" : language === "ar" ? "شروط الدفع" : "Payment Terms",
      color: "from-green-500 to-green-600",
      items: language === "ku" ? [
        "پارەدان پێش گەیاندن یان کاتی گەیاندن",
        "کرێدیت تەنها بۆ کڕیارە VIP ەکان",
        "دواکەوتنی پارەدان ڕادەگرێت لە خزمەتگوزاری",
        "گۆڕینی دراو بە نرخی ڕۆژ",
      ] : language === "ar" ? [
        "الدفع قبل أو عند التسليم",
        "الائتمان متاح فقط لعملاء VIP",
        "التأخر في الدفع يؤدي إلى تعليق الخدمة",
        "سعر الصرف حسب سعر اليوم",
      ] : [
        "Payment before or upon delivery",
        "Credit available only for VIP customers",
        "Late payment results in service suspension",
        "Exchange rate based on daily rate",
      ],
    },
    {
      icon: Clock,
      title: language === "ku" ? "کاتی گەیاندن" : language === "ar" ? "وقت التسليم" : "Delivery Time",
      color: "from-orange-500 to-orange-600",
      items: language === "ku" ? [
        "بارە ئاسمانییەکان: 7-14 ڕۆژ",
        "بارە دەریاییەکان: 30-45 ڕۆژ",
        "کاتی گەیاندن گەرەنتی نییە و دەگۆڕێت",
        "دواکەوتن لەبەر هۆکاری دەرەکی بەرپرسیاریەتی کۆمپانیا نییە",
      ] : language === "ar" ? [
        "الشحن الجوي: 7-14 يوم",
        "الشحن البحري: 30-45 يوم",
        "وقت التسليم غير مضمون وقابل للتغيير",
        "التأخير بسبب عوامل خارجية ليس مسؤولية الشركة",
      ] : [
        "Air shipping: 7-14 days",
        "Sea shipping: 30-45 days",
        "Delivery time is not guaranteed and may vary",
        "Delays due to external factors are not company's responsibility",
      ],
    },
    {
      icon: Shield,
      title: language === "ku" ? "بیمە و قەرەبوو" : language === "ar" ? "التأمين والتعويض" : "Insurance & Compensation",
      color: "from-purple-500 to-purple-600",
      items: language === "ku" ? [
        "بیمەی بار بە داواکاری کڕیار و بە نرخی زیادە",
        "قەرەبوو تەنها بۆ بارە بیمەکراوەکان",
        "قەرەبووی بارە بێ بیمە: 3 دۆلار بۆ هەر کیلۆیەک",
        "داوای قەرەبوو لە ماوەی 48 کاتژمێردا",
      ] : language === "ar" ? [
        "التأمين على الشحنة بطلب العميل وبتكلفة إضافية",
        "التعويض فقط للشحنات المؤمنة",
        "تعويض الشحنات غير المؤمنة: 3 دولار لكل كيلو",
        "طلب التعويض خلال 48 ساعة",
      ] : [
        "Cargo insurance available upon request at extra cost",
        "Compensation only for insured shipments",
        "Uninsured cargo compensation: $3 per kg",
        "Compensation claims within 48 hours",
      ],
    },
    {
      icon: AlertTriangle,
      title: language === "ku" ? "بارە قەدەغەکراوەکان" : language === "ar" ? "البضائع المحظورة" : "Prohibited Items",
      color: "from-red-500 to-red-600",
      items: language === "ku" ? [
        "چەک و تەقەمەنی",
        "مادەی کیمیایی و تەقینەوە",
        "مادەی هۆشبەر",
        "پارەی ساختە",
        "کەلوپەلی نایاسایی",
      ] : language === "ar" ? [
        "الأسلحة والذخيرة",
        "المواد الكيميائية والمتفجرات",
        "المخدرات",
        "العملات المزيفة",
        "البضائع غير القانونية",
      ] : [
        "Weapons and ammunition",
        "Chemicals and explosives",
        "Narcotics",
        "Counterfeit currency",
        "Illegal goods",
      ],
    },
  ];

  const importantNotes = language === "ku" ? [
    "کۆمپانیا مافی گۆڕینی نرخ و مەرجەکانی هەیە بەبێ ئاگادارکردنەوەی پێشوەخت",
    "بەکارهێنانی خزمەتگوزارییەکانمان واتە ڕازیبوون بەم مەرجانە",
    "بۆ هەر پرسیارێک پەیوەندیمان پێوە بکەن",
  ] : language === "ar" ? [
    "تحتفظ الشركة بحق تغيير الأسعار والشروط دون إشعار مسبق",
    "استخدام خدماتنا يعني الموافقة على هذه الشروط",
    "للاستفسارات تواصل معنا",
  ] : [
    "Company reserves the right to change prices and terms without prior notice",
    "Using our services means agreeing to these terms",
    "For any questions, please contact us",
  ];

  return (
    <CustomerPortalLayout>
      <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 pt-6 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {language === "ku" ? "مەرج و ڕێساکان" : language === "ar" ? "الشروط والأحكام" : "Terms & Conditions"}
              </h1>
              <p className="text-sm text-gray-300">
                {language === "ku" ? "مەرجەکانی خزمەتگوزاری" : language === "ar" ? "شروط الخدمة" : "Service Terms"}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-6 space-y-4 pb-24">
          {sections.map((section, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Section Header */}
              <div className={`bg-gradient-to-r ${section.color} p-4 flex items-center gap-3`}>
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-white">{section.title}</h2>
              </div>
              
              {/* Section Items */}
              <div className="p-4 space-y-3">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Important Notes */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-amber-800">
                {language === "ku" ? "تێبینی گرنگ" : language === "ar" ? "ملاحظات مهمة" : "Important Notes"}
              </h3>
            </div>
            <div className="space-y-2">
              {importantNotes.map((note, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-amber-800 text-sm">{note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Last Updated */}
          <div className="text-center text-gray-400 text-sm">
            {language === "ku" ? "دوایین نوێکردنەوە: ٢٠٢٤/١٢/٢٢" : 
             language === "ar" ? "آخر تحديث: 2024/12/22" : 
             "Last updated: 2024/12/22"}
          </div>
        </div>
      </div>
    </CustomerPortalLayout>
  );
}
