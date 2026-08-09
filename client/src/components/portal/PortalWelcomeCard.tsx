import { Copy, PackagePlus, Check } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { copyText } from "@/lib/copyText";
import { cn } from "@/lib/utils";

/**
 * The first thing a new customer sees — instead of nothing.
 *
 * A customer who has just signed up used to land on a screen of zeroes and a
 * grey box reading "no shipments yet · your shipments will appear here". No
 * button, no explanation of what this company does, and no mention of the one
 * thing they have to do to make anything happen: put their customer code on
 * the parcel. That is the single most important moment in the funnel and it
 * was an empty state.
 *
 * Three steps, their own code ready to copy, and one tap to register a
 * tracking number.
 */
export function PortalWelcomeCard({
  customerCode,
  isDark,
  className,
}: {
  customerCode?: string | null;
  isDark?: boolean;
  className?: string;
}) {
  const { language } = useTranslation();

  const steps = [
    {
      ku: "کۆدەکەت کۆپی بکە",
      en: "Copy your customer code",
      ar: "انسخ رمز العميل الخاص بك",
      zh: "复制您的客户编号",
    },
    {
      ku: "لە کاتی کڕیندا بیدە بە فرۆشیارەکە",
      en: "Give it to the seller when you buy",
      ar: "أعطه للبائع عند الشراء",
      zh: "购买时把编号给卖家",
    },
    {
      ku: "ژمارەی تراکینگەکە لێرە تۆمار بکە",
      en: "Register the tracking number here",
      ar: "سجّل رقم التتبع هنا",
      zh: "在这里登记运单号",
    },
  ];

  const copyCode = async () => {
    if (!customerCode) return;
    const ok = await copyText(customerCode);
    if (ok) toast.success(pickLang(language, { ku: "کۆد کۆپی کرا", en: "Code copied", ar: "تم نسخ الرمز", zh: "编号已复制" }));
    else toast.error(pickLang(language, { ku: "نەتوانرا کۆپی بکرێت", en: "Couldn't copy", ar: "تعذّر النسخ", zh: "复制失败" }));
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        isDark
          ? "border-emerald-800/50 bg-emerald-950/30"
          : "border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 dark:border-emerald-800/60 dark:from-emerald-950/30 dark:to-teal-950/30",
        className,
      )}
    >
      <p className={cn("text-base font-bold", isDark ? "text-white" : "text-emerald-900 dark:text-emerald-100")}>
        {pickLang(language, {
          ku: "بەخێربێیت! بەم سێ هەنگاوە دەست پێبکە",
          en: "Welcome — here's how to start",
          ar: "أهلاً بك — ابدأ بهذه الخطوات الثلاث",
          zh: "欢迎 — 三步开始使用",
        })}
      </p>

      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                isDark ? "bg-emerald-800 text-emerald-200" : "bg-emerald-600 text-white",
              )}
              dir="ltr"
            >
              {i + 1}
            </span>
            <span className={cn("text-sm leading-relaxed", isDark ? "text-slate-200" : "text-emerald-900/90 dark:text-emerald-100/90")}>
              {pickLang(language, step)}
            </span>
          </li>
        ))}
      </ol>

      {customerCode && (
        <button
          type="button"
          onClick={copyCode}
          className={cn(
            "mt-4 flex w-full items-center justify-between gap-2 rounded-xl border-2 border-dashed px-4 py-3 transition active:scale-[0.99]",
            isDark ? "border-emerald-700 bg-emerald-900/40" : "border-emerald-300 bg-white/70 dark:border-emerald-700 dark:bg-emerald-900/40",
          )}
        >
          <span className={cn("text-xs", isDark ? "text-emerald-300" : "text-emerald-700 dark:text-emerald-300")}>
            {pickLang(language, { ku: "کۆدی تۆ", en: "Your code", ar: "رمزك", zh: "您的编号" })}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={cn("font-mono text-lg font-black tracking-wider", isDark ? "text-white" : "text-emerald-900 dark:text-emerald-100")}
              dir="ltr"
            >
              {customerCode}
            </span>
            <Copy className={cn("h-4 w-4", isDark ? "text-emerald-400" : "text-emerald-600")} />
          </span>
        </button>
      )}

      <Link href="/portal/declare">
        <span
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-[0.99]"
        >
          <PackagePlus className="h-4 w-4" />
          {pickLang(language, {
            ku: "تراکی کڕینەکەم تۆمار دەکەم",
            en: "Register my tracking number",
            ar: "تسجيل رقم التتبع",
            zh: "登记我的运单号",
          })}
        </span>
      </Link>

      <p className={cn("mt-3 flex items-center gap-1.5 text-[11px]", isDark ? "text-emerald-400/70" : "text-emerald-700/70 dark:text-emerald-400/70")}>
        <Check className="h-3 w-3 shrink-0" />
        {pickLang(language, {
          ku: "کاتێک کاڵاکەت گەیشتە کۆگاکەمان لە چین، خۆکار لێرە دەردەکەوێت.",
          en: "Once your goods reach our depot in China, they appear here automatically.",
          ar: "بمجرد وصول بضاعتك إلى مستودعنا في الصين ستظهر هنا تلقائياً.",
          zh: "货物抵达我们的中国仓库后会自动显示在这里。",
        })}
      </p>
    </div>
  );
}
