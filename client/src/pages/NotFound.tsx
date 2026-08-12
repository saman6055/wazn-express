import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Compass } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import CompanyLogo from "@/components/CompanyLogo";

export default function NotFound() {
  const { language, isRTL } = useTranslation();
  const [, setLocation] = useLocation();
  const L = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4"
    >
      <div className="pointer-events-none absolute -top-24 end-0 h-96 w-96 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 start-0 h-96 w-96 rounded-full bg-violet-300/25 blur-3xl" />

      <div className="relative text-center">
        <div className="mb-8 flex justify-center">
          <CompanyLogo size={48} iconClassName="h-6 w-6 text-white" fallbackBg="bg-gradient-to-br from-sky-500 to-violet-600" />
        </div>

        <p className="select-none bg-gradient-to-br from-sky-500 to-violet-600 bg-clip-text text-8xl font-black leading-none text-transparent md:text-9xl">
          404
        </p>

        <div className="mx-auto mt-4 mb-6 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
          <Compass className="h-4 w-4" />
          <span className="text-sm font-medium">{L({ ku: "پەڕەکە نەدۆزرایەوە", en: "Page not found", ar: "الصفحة غير موجودة", zh: "页面未找到" })}</span>
        </div>

        <p className="mx-auto max-w-md text-slate-600 dark:text-slate-300 leading-relaxed">
          {L({
            ku: "ببورە، ئەو پەڕەیەی بەدوایدا دەگەڕێیت بوونی نییە — لەوانەیە گواستراوەتەوە یان سڕاوەتەوە.",
            en: "Sorry, the page you're looking for doesn't exist — it may have been moved or deleted.",
            ar: "عذراً، الصفحة التي تبحث عنها غير موجودة — ربما تم نقلها أو حذفها.",
            zh: "抱歉，您要找的页面不存在——它可能已被移动或删除。",
          })}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => setLocation("/")}
            className="gap-2 rounded-full bg-gradient-to-br from-sky-500 to-violet-600 px-6 text-white shadow-lg shadow-sky-500/25 hover:-translate-y-0.5 transition-all"
          >
            <Home className="h-4 w-4" />
            {L({ ku: "پەڕەی سەرەکی", en: "Go home", ar: "الصفحة الرئيسية", zh: "返回首页" })}
          </Button>
          <Button variant="ghost" onClick={() => window.history.back()} className="gap-2 rounded-full text-slate-600 dark:text-slate-300">
            <ArrowLeft className={"h-4 w-4" + (isRTL ? "rotate-180" : "")} />
            {L({ ku: "گەڕانەوە", en: "Go back", ar: "رجوع", zh: "返回" })}
          </Button>
        </div>
      </div>
    </div>
  );
}
