import { Link } from "wouter";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

/**
 * "One of your parcels is waiting on your decision."
 *
 * A prohibited item is held at the depot until the customer says whether to
 * return it or destroy it. Nothing moves until they answer, and they are being
 * charged storage while it sits there — so it is the single most urgent thing
 * the portal can have to say.
 *
 * It existed only on the classic skin. A customer on modern or skin3 had no
 * way to know, and no way to reach the page: their menus linked to
 * /portal/prohibited-items, the static policy page, not to their own flagged
 * parcels. This is the same alert, in one component, mounted by all three.
 */
export function ProhibitedDecisionAlert({ isDark, className }: { isDark?: boolean; className?: string }) {
  const { language } = useTranslation();
  const { data } = trpc.prohibited.getMine.useQuery(undefined, { retry: false });

  const pending = (data ?? []).filter((p: any) => p?.status === "pending").length;
  if (pending === 0) return null;

  return (
    <Link href="/portal/prohibited-packages">
      <div
        className={cn(
          "wazn-prohibited-flash flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4",
          isDark ? "border-red-800 bg-red-950/40" : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
          className,
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-red-900 dark:text-red-200">
            {pending}{" "}
            {pickLang(language, {
              ku: "پاکەت چاوەڕێی بڕیاری تۆیە",
              en: pending === 1 ? "parcel needs your decision" : "parcels need your decision",
              ar: "طرد بانتظار قرارك",
              zh: "件包裹等待您的决定",
            })}
          </p>
          <p className="mt-0.5 text-xs text-red-800/80 dark:text-red-300/80">
            {pickLang(language, {
              ku: "تا بڕیار نەدەیت لە کۆگا دەمێنێتەوە و کرێی هەڵگرتنی لەسەرە.",
              en: "It stays at the depot, accruing storage charges, until you answer.",
              ar: "يبقى في المستودع مع رسوم تخزين حتى تردّ.",
              zh: "在您答复前将留在仓库并产生仓储费。",
            })}
          </p>
        </div>
        <ChevronLeft className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400 rtl:rotate-180" />
      </div>
    </Link>
  );
}
