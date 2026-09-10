import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

/**
 * A staff page this account has no permission for.
 *
 * The sidebar already left such pages out, but the address still opened them:
 * a bookmark, a link in a message or a typed URL showed the whole page, and
 * the first thing that failed was a request half-way down it, in English.
 * Now the page says plainly that it is not part of this account's role.
 */
export function NoAccessPanel() {
  const { language } = useTranslation();
  const L = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);
  return (
    <div role="alert" className="mx-auto my-12 flex w-full max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center shadow-sm">
      <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
        <ShieldAlert className="size-6 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        {L({ ku: "ئەم پەڕەیە بۆ هەژماری تۆ نییە", en: "This page is not part of your account", ar: "هذه الصفحة ليست ضمن صلاحيات حسابك", zh: "此页面不在您的账户权限内" })}
      </h2>
      <p className="text-sm text-muted-foreground">
        {L({
          ku: "ئەگەر پێویستت پێیەتی، داوا لە بەڕێوەبەر بکە ڕێگەت پێ بدات.",
          en: "If you need it, ask an administrator to give you access.",
          ar: "إن كنت تحتاجها، اطلب من المدير منحك الصلاحية.",
          zh: "如需使用，请联系管理员为您开通权限。",
        })}
      </p>
      <Button asChild className="mt-2">
        <Link href="/dashboard">{L({ ku: "گەڕانەوە بۆ داشبۆرد", en: "Back to the dashboard", ar: "العودة إلى لوحة التحكم", zh: "返回仪表板" })}</Link>
      </Button>
    </div>
  );
}
