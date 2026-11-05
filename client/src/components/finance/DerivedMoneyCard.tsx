import { Link } from "wouter";
import { Banknote, Building2, CreditCard } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";

/**
 * What the system already knows about where the money is (owner,
 * 2026-11-05: «داتا ئینتەری هەتاکەم بێ باشترە»): this month's money
 * received by place, and the last weekly FIB / Qi Card count - nothing
 * typed here. The accounts below stay for whoever wants to keep them by hand.
 * Main admin only, as working capital is; hidden for everyone else.
 */
export function DerivedMoneyCard() {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const { data, error } = trpc.ledger.workingCapital.useQuery(undefined, { retry: false });
  if (error || !data) return null;
  const by = new Map((data.receivedByMethod ?? []).map((m) => [m.method, m]));
  const last = (data.channelChecks ?? [])[0] ?? null;
  const places = [
    { key: "CASH", Icon: Banknote, name: L({ ku: "کاش", en: "Cash", ar: "نقد", zh: "现金" }), balance: null as number | null },
    { key: "FIB", Icon: Building2, name: "FIB", balance: last?.fibUsd ?? null },
    { key: "CARD", Icon: CreditCard, name: "Qi Card", balance: last?.qiUsd ?? null },
  ];
  return (
    <Card data-testid="derived-money">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{L({ ku: "پارە لە کوێیە — لە تۆمارەکانەوە", en: "Where the money is — from the records", ar: "أين المال — من السجلات", zh: "资金去向 — 来自记录" })}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {L({ ku: "هیچ شتێک لێرە نانووسرێت. پارەی هاتووی ئەم مانگە بەپێی شوێن، و دوایین باڵانسی هەفتانەی FIB و Qi.", en: "Nothing is typed here: this month's money received by place, and the last weekly FIB and Qi balance.", ar: "لا شيء يُكتب هنا: مقبوضات هذا الشهر حسب الجهة وآخر رصيد أسبوعي.", zh: "此处无需输入：本月按渠道收款及最近一次每周余额。" })}
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {places.map(({ key, Icon, name, balance }) => (
          <div key={key} className="rounded-xl border p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4" />{name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{L({ ku: "هاتووی ئەم مانگە", en: "Received this month", ar: "مقبوض هذا الشهر", zh: "本月收款" })}</div>
            <div className="font-mono text-lg font-semibold tabular-nums"><bdi dir="ltr">{fmtUsd(by.get(key)?.usd ?? 0)}</bdi></div>
            {balance !== null && (
              <div className="mt-1 text-xs text-muted-foreground">
                {L({ ku: "باڵانسی دوایین پشکنین", en: "Balance at last check", ar: "الرصيد عند آخر فحص", zh: "最近核对余额" })}: <bdi dir="ltr" className="font-mono">{fmtUsd(balance)}</bdi>
              </div>
            )}
          </div>
        ))}
        <Link href="/finance/working-capital" className="text-xs text-sky-700 underline dark:text-sky-300 sm:col-span-3">
          {L({ ku: "پشکنینی هەفتانەی FIB و Qi لە سەرمایەی کار", en: "Weekly FIB and Qi check in working capital", ar: "الفحص الأسبوعي في رأس المال العامل", zh: "在营运资金中进行每周核对" })}
        </Link>
      </CardContent>
    </Card>
  );
}
