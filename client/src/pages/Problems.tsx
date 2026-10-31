import { useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, ChevronDown, ExternalLink, LifeBuoy } from "lucide-react";
import { checkDefinition, type CheckSeverity } from "@shared/auditSweep";

/**
 * One page for what is wrong right now (owner, 2026-10-30): the warnings that
 * came and went, and the checks that lived on a page of their own. Each row
 * says what, why and how to put it right, and opens the record itself. Nothing
 * here writes; a row leaves by itself once the fault is put right.
 *
 * The money checks need the audit permission; the box row needs the box desk.
 */
const TONE: Record<CheckSeverity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
};
const LEVEL: Record<CheckSeverity, { ku: string; en: string; ar: string; zh: string }> = {
  critical: { ku: "پەلە", en: "Urgent", ar: "عاجل", zh: "紧急" },
  warning: { ku: "گرنگ", en: "Important", ar: "مهم", zh: "重要" },
  info: { ku: "بۆ زانین", en: "To know", ar: "للعلم", zh: "知悉" },
};

function Row({ severity, title, open, onToggle, children }: { severity: CheckSeverity; title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { language } = useTranslation();
  return (
    <div className="rounded-xl border bg-card shadow-sm" data-testid="problem-row">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 p-3 text-start">
        <span className={cn("shrink-0 rounded px-2 py-0.5 text-xs font-medium", TONE[severity])}>{pickLang(language, LEVEL[severity])}</span>
        <span className="min-w-0 flex-1 font-medium">{title}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-3 border-t p-3 text-sm">{children}</div>}
    </div>
  );
}

export default function Problems() {
  const { language } = useTranslation();
  const { canViewPath } = usePermissions();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const [openId, setOpenId] = useState<string | null>("left-out");
  const toggle = (id: string) => setOpenId((was) => (was === id ? null : id));

  const leftOut = trpc.audit.leftOutOfBoxes.useQuery(undefined, { refetchOnWindowFocus: false });
  const mayAudit = canViewPath("/audit-sweep");
  const sweep = trpc.audit.sweep.useQuery(undefined, { enabled: mayAudit, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const customers = leftOut.data ?? [];
  const parcels = customers.reduce((n, c) => n + c.parcels.length, 0);
  const found = (sweep.data?.results ?? []).filter((r) => r.status === "found");
  const loading = leftOut.isLoading || (mayAudit && sweep.isLoading);
  const none = !loading && parcels === 0 && found.length === 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-3 p-4">
        <div className="flex items-center gap-3">
          <LifeBuoy className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{L({ ku: "کێشەکانی ئێستا", en: "Problems now", ar: "المشاكل الآن", zh: "当前问题" })}</h1>
            <p className="text-xs text-muted-foreground">{L({ ku: "هەر کێشەیەک لێرەیە تا چارەسەر دەکرێت، ئەوسا خۆی لادەچێت", en: "A problem stays here until it is put right, then it leaves by itself", ar: "تبقى المشكلة هنا حتى تُحل ثم تختفي وحدها", zh: "问题解决后自动消失" })}</p>
          </div>
        </div>

        {loading && <Skeleton className="h-24 w-full rounded-xl" />}

        {none && (
          <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm" data-testid="problems-none">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {L({ ku: "ئێستا هیچ کێشەیەک نییە", en: "Nothing is wrong right now", ar: "لا توجد مشاكل الآن", zh: "目前没有问题" })}
          </div>
        )}

        {parcels > 0 && (
          <Row
            severity="warning"
            open={openId === "left-out"}
            onToggle={() => toggle("left-out")}
            title={L({ ku: `${parcels} پاکێج گەیشتوون و لە هیچ بۆکسێکدا نین`, en: `${parcels} parcels arrived and are in no box`, ar: `${parcels} طرد وصل وليس في أي صندوق`, zh: `${parcels} 个已到达包裹未装箱` })}
          >
            <p><span className="text-muted-foreground">{L({ ku: "بۆچی؟", en: "Why?", ar: "لماذا؟", zh: "原因" })} </span>
              {L({ ku: "باچەکەیان پێش زیاتر لە 3 ڕۆژ گەیشتووە، بەڵام نەخراونەتە بۆکسی خاوەنەکانیان.", en: "Their batch arrived over 3 days ago, but they were never put in their owners' boxes.", ar: "وصلت دفعتها قبل أكثر من 3 أيام ولم توضع في صناديق أصحابها.", zh: "其批次到达已超过 3 天，但未装入客户的箱子。" })}</p>
            <p><span className="text-muted-foreground">{L({ ku: "چارەسەر:", en: "Fix:", ar: "الحل:", zh: "解决：" })} </span>
              {L({ ku: "1. کڕیارێک بکەرەوە · 2. پاکێجەکان سکان بکە بۆ بۆکسەکەی", en: "1. Open a customer · 2. Scan the parcels into their box", ar: "1. افتح العميل · 2. امسح الطرود إلى صندوقه", zh: "1. 打开客户 · 2. 将包裹扫描入箱" })}</p>
            <div className="divide-y">
              {customers.map((c) => (
                <div key={c.customerId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" data-testid="left-out-customer">
                  <span className="font-medium">{c.customerCode}</span>
                  <span className="text-muted-foreground">{c.customerName}</span>
                  <span className="tabular-nums">{c.parcels.length}</span>
                  <span className="flex flex-wrap gap-2 text-xs text-muted-foreground" dir="ltr">
                    {Array.from(new Set(c.parcels.map((p) => p.batchCode))).map((b) => <span key={b}>{b}</span>)}
                  </span>
                  <Button asChild size="sm" variant="outline" className="ms-auto h-8 gap-1.5">
                    <Link href={`/customer-delivery-scanner?customer=${c.customerId}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      {L({ ku: "بیکەرەوە", en: "Open", ar: "افتح", zh: "打开" })}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </Row>
        )}

        {found.map((r) => {
          const def = checkDefinition(r.id);
          if (!def) return null;
          return (
            <Row key={r.id} severity={def.severity} open={openId === r.id} onToggle={() => toggle(r.id)} title={`${pickLang(language, def.title)} (${r.count})`}>
              <p>{pickLang(language, def.meaning)}</p>
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                <Link href={def.path ?? "/audit-sweep"}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  {L({ ku: "بیکەرەوە", en: "Open", ar: "افتح", zh: "打开" })}
                </Link>
              </Button>
            </Row>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
