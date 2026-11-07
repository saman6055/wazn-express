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
import { CheckCircle2, ChevronDown, ExternalLink, LifeBuoy, PackageOpen, PackageSearch, ShieldAlert, Clock } from "lucide-react";
import { checkDefinition, type CheckSeverity } from "@shared/auditSweep";
import { FIX_STEPS } from "@shared/auditFixSteps";
import { CopyButton } from "@/components/CopyButton";
import { soundManager } from "@/lib/soundManager";
import "../dashboard/dashboardLive.css";

/**
 * One page for what is wrong right now (owner, 2026-10-30): the warnings that
 * came and went, and the checks that lived on a page of their own. Each row
 * says what, why and how to put it right, and opens the record itself. Nothing
 * here writes, except settling a lost parcel; a row leaves by itself once the
 * fault is put right.
 *
 * Redrawn 2026-11-07 (owner: «وابکە زیاتر سوودی هەبێ... ئاسان بێت و جوان
 * بێت»): a count by urgency at the top, a filter by area, customers in the
 * order they have waited, each with how long and one button to their box.
 * Every figure is a count of real rows - nothing estimated, no money.
 *
 * The money checks need the audit permission; the box row needs the box desk.
 */
const TONE: Record<CheckSeverity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
};
const STRIPE: Record<CheckSeverity, string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};
const LEVEL: Record<CheckSeverity, { ku: string; en: string; ar: string; zh: string }> = {
  critical: { ku: "پەلە", en: "Urgent", ar: "عاجل", zh: "紧急" },
  warning: { ku: "گرنگ", en: "Important", ar: "مهم", zh: "重要" },
  info: { ku: "بۆ زانین", en: "To know", ar: "للعلم", zh: "知悉" },
};

type Area = "all" | "boxes" | "lost" | "checks";
const AREAS: Array<{ id: Area; icon: typeof LifeBuoy; label: { ku: string; en: string; ar: string; zh: string } }> = [
  { id: "all", icon: LifeBuoy, label: { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" } },
  { id: "boxes", icon: PackageOpen, label: { ku: "بۆکس", en: "Boxes", ar: "الصناديق", zh: "装箱" } },
  { id: "lost", icon: PackageSearch, label: { ku: "پاکێجی ون", en: "Lost parcels", ar: "طرود مفقودة", zh: "丢失包裹" } },
  { id: "checks", icon: ShieldAlert, label: { ku: "پشکنین", en: "Checks", ar: "الفحوص", zh: "检查" } },
];

/** The records a finding names, whichever column carries their code. */
const CODE_FIELDS = ["batchCode", "packageCode", "orderCode", "orderNumber", "invoiceNumber", "settlementNumber", "accountNumber", "customerCode", "trackingNumber", "number"];
function codesIn(sample: unknown[] | undefined): string[] {
  const codes = (sample ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const field = CODE_FIELDS.find((f) => r[f]);
    return field ? String(r[field]) : null;
  });
  return Array.from(new Set(codes.filter((c): c is string => !!c)));
}

/** How long a customer's parcels have waited, as a colour: a week is late, two is very late. */
function waitTone(days: number): string {
  if (days >= 14) return "bg-red-500";
  if (days >= 7) return "bg-amber-500";
  return "bg-sky-500";
}

function Row({ severity, title, meta, open, onToggle, children }: { severity: CheckSeverity; title: string; meta?: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { language } = useTranslation();
  return (
    <div data-slot="card" className="relative overflow-hidden rounded-xl border bg-card shadow-sm" data-testid="problem-row" data-severity={severity}>
      <span aria-hidden="true" className={cn("absolute inset-y-0 start-0 w-1", STRIPE[severity])} />
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 p-3 ps-4 text-start" aria-expanded={open}>
        <span className={cn("shrink-0 rounded px-2 py-0.5 text-xs font-medium", TONE[severity])}>{pickLang(language, LEVEL[severity])}</span>
        <span data-slot="card-title" className="min-w-0 flex-1 font-medium">{title}</span>
        {meta && <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{meta}</span>}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-3 border-t p-3 ps-4 text-sm">{children}</div>}
    </div>
  );
}

export default function Problems() {
  const { language } = useTranslation();
  const { canViewPath } = usePermissions();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const [openId, setOpenId] = useState<string | null>("left-out");
  const [area, setArea] = useState<Area>("all");
  const [showAll, setShowAll] = useState(false);
  const toggle = (id: string) => setOpenId((was) => (was === id ? null : id));

  const leftOut = trpc.audit.leftOutOfBoxes.useQuery(undefined, { refetchOnWindowFocus: false });
  const mayAudit = canViewPath("/audit-sweep");
  const sweep = trpc.audit.sweep.useQuery(undefined, { enabled: mayAudit, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 });

  const lost = trpc.audit.lostParcels.useQuery(undefined, { refetchOnWindowFocus: false });
  const settle = trpc.packages.settleLost.useMutation({ onSuccess: () => void lost.refetch() });
  const lostRows = lost.data ?? [];
  const customers = leftOut.data ?? [];
  const parcels = customers.reduce((n, c) => n + c.parcels.length, 0);
  const oldest = customers.reduce((n, c) => Math.max(n, c.oldestDays ?? 0), 0);
  const found = (sweep.data?.results ?? []).filter((r) => r.status === "found");
  // Urgent first: the urgent checks go above the box row, the rest below it.
  const urgentFound = found.filter((r) => checkDefinition(r.id)?.severity === "critical");
  const otherFound = found.filter((r) => checkDefinition(r.id)?.severity !== "critical");
  const loading = leftOut.isLoading || (mayAudit && sweep.isLoading);
  const none = !loading && parcels === 0 && found.length === 0 && lostRows.length === 0;

  // The count at the top: one per problem row on the page, by its urgency.
  const counts: Record<CheckSeverity, number> = { critical: 0, warning: 0, info: 0 };
  if (lostRows.length > 0) counts.critical += 1;
  if (parcels > 0) counts.warning += 1;
  for (const r of found) {
    const def = checkDefinition(r.id);
    if (def) counts[def.severity] += 1;
  }
  const areaCount: Record<Area, number> = {
    all: counts.critical + counts.warning + counts.info,
    boxes: parcels > 0 ? 1 : 0,
    lost: lostRows.length > 0 ? 1 : 0,
    checks: found.filter((r) => checkDefinition(r.id)).length,
  };
  const shows = (a: Exclude<Area, "all">) => area === "all" || area === a;
  const VISIBLE = 8;
  const shownCustomers = showAll ? customers : customers.slice(0, VISIBLE);

  const renderChecks = (list: typeof found) => (
    <>
        {shows("checks") && list.map((r) => {
              const def = checkDefinition(r.id);
              if (!def) return null;
              return (
                <Row key={r.id} severity={def.severity} open={openId === r.id} onToggle={() => toggle(r.id)} title={`${pickLang(language, def.title)} (${r.count})`}>
                  <p>{pickLang(language, def.meaning)}</p>
                  <div>
                    <p className="text-muted-foreground">{L({ ku: "چارەسەر:", en: "Fix:", ar: "الحل:", zh: "解决：" })}</p>
                    <ol className="list-inside list-decimal space-y-0.5" data-testid="problem-steps">
                      {FIX_STEPS[r.id].map((s) => <li key={s.en}>{pickLang(language, s)}</li>)}
                    </ol>
                  </div>
                  {codesIn(r.sample).length > 0 && (
                    <div className="flex flex-wrap items-center gap-2" dir="ltr" data-testid="problem-codes">
                      {codesIn(r.sample).map((code) => (
                        <span key={code} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {code}
                          <CopyButton value={code} />
                        </span>
                      ))}
                    </div>
                  )}
                  <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                    <Link href={def.path ?? "/audit-sweep"}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      {L({ ku: "بیکەرەوە", en: "Open", ar: "افتح", zh: "打开" })}
                    </Link>
                  </Button>
                </Row>
              );
            })}
        </>
  );

  return (
    <DashboardLayout>
      {/* `dash-live`: the same moving, glowing layer as the dashboard, and a soft tap on every button. */}
      <div
        className="dash-live mx-auto max-w-4xl space-y-3 p-4"
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest("button, a, [role='button']")) soundManager.playTap();
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-md">
            <LifeBuoy className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{L({ ku: "کێشەکانی ئێستا", en: "Problems now", ar: "المشاكل الآن", zh: "当前问题" })}</h1>
            <p className="text-xs text-muted-foreground">{L({ ku: "هەر کێشەیەک لێرەیە تا چارەسەر دەکرێت، ئەوسا خۆی لادەچێت", en: "A problem stays here until it is put right, then it leaves by itself", ar: "تبقى المشكلة هنا حتى تُحل ثم تختفي وحدها", zh: "问题解决后自动消失" })}</p>
          </div>
        </div>

        {!loading && !none && (
          <div className="grid grid-cols-3 gap-2" data-testid="problems-summary">
            {(["critical", "warning", "info"] as const).map((sev) => (
              <div key={sev} data-slot="card" className="rounded-xl border bg-card p-3 text-center">
                <p className={cn("text-2xl font-bold tabular-nums", sev === "critical" ? "text-red-600 dark:text-red-400" : sev === "warning" ? "text-amber-600 dark:text-amber-400" : "text-sky-600 dark:text-sky-400")}>{counts[sev]}</p>
                <p className="text-xs text-muted-foreground">{L(LEVEL[sev])}</p>
              </div>
            ))}
          </div>
        )}

        {!loading && !none && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" data-testid="problems-areas">
            {AREAS.map((a) => {
              const Icon = a.icon;
              const on = area === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setArea(a.id)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm transition-colors",
                    on ? "border-violet-400 bg-violet-100 font-medium text-violet-800 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-200" : "bg-card hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {L(a.label)}
                  <span className="tabular-nums text-xs opacity-80">{areaCount[a.id]}</span>
                </button>
              );
            })}
          </div>
        )}

        {loading && <Skeleton className="h-24 w-full rounded-xl" />}

        {none && (
          <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm" data-testid="problems-none">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {L({ ku: "ئێستا هیچ کێشەیەک نییە", en: "Nothing is wrong right now", ar: "لا توجد مشاكل الآن", zh: "目前没有问题" })}
          </div>
        )}

        {shows("lost") && lostRows.length > 0 && (
          <Row
            severity="critical"
            open={openId === "lost"}
            onToggle={() => toggle("lost")}
            title={L({ ku: `${lostRows.length} پاکێج ون بووە و هێشتا چارەسەر نەکراوە`, en: `${lostRows.length} lost parcels not yet settled`, ar: `${lostRows.length} طرد مفقود`, zh: `${lostRows.length} 个丢失包裹待处理` })}
          >
            <p><span className="text-muted-foreground">{L({ ku: "چارەسەر:", en: "Fix:", ar: "الحل:", zh: "解决：" })} </span>
              {L({ ku: "1. قەرەبووی کڕیاری سێلف ئۆردەر بە دەست لە حیسابەکەی بنووسە · 2. ئەگەر لای کۆمپانیا ون بووە، پارەکە لێیان وەربگرەوە · 3. «چارەسەر کرا» لێبدە", en: "1. Enter a self order's compensation on its account by hand · 2. If the carrier lost it, claim it back · 3. Press settled", ar: "1. سجّل التعويض يدوياً · 2. استرد المبلغ من الشركة · 3. اضغط تمت التسوية", zh: "1. 手动录入赔偿 · 2. 向承运商索赔 · 3. 点击已处理" })}</p>
            <div className="divide-y">
              {lostRows.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" data-testid="lost-parcel">
                  <span className="font-mono text-xs" dir="ltr">{p.trackingNumber || p.packageCode}</span>
                  <span>{p.customerCode}</span>
                  <span className="text-muted-foreground">{p.side === "carrier" ? L({ ku: "لای کۆمپانیا", en: "With the carrier", ar: "عند الشركة", zh: "承运商" }) : L({ ku: "لای ئێمە", en: "With us", ar: "عندنا", zh: "我方" })}</span>
                  <span className="tabular-nums">{p.selfOrder ? `$${Number(p.compensationUsd ?? 0).toFixed(2)}` : L({ ku: "لەسەر کۆمپانیا", en: "On the company", ar: "على الشركة", zh: "公司承担" })}</span>
                  <Button size="sm" variant="outline" className="ms-auto h-8" disabled={settle.isPending} onClick={() => settle.mutate({ packageId: p.id })}>
                    {L({ ku: "چارەسەر کرا", en: "Settled", ar: "تمت التسوية", zh: "已处理" })}
                  </Button>
                </div>
              ))}
            </div>
          </Row>
        )}

        {renderChecks(urgentFound)}

        {shows("boxes") && parcels > 0 && (
          <Row
            severity="warning"
            open={openId === "left-out"}
            onToggle={() => toggle("left-out")}
            title={L({ ku: `${parcels} پاکێج گەیشتوون و لە هیچ بۆکسێکدا نین`, en: `${parcels} parcels arrived and are in no box`, ar: `${parcels} طرد وصل وليس في أي صندوق`, zh: `${parcels} 个已到达包裹未装箱` })}
            meta={L({ ku: `${customers.length} کڕیار · کۆنترین ${oldest} ڕۆژ`, en: `${customers.length} customers · oldest ${oldest} days`, ar: `${customers.length} عميل · الأقدم ${oldest} يوم`, zh: `${customers.length} 位客户 · 最久 ${oldest} 天` })}
          >
            <p><span className="text-muted-foreground">{L({ ku: "بۆچی؟", en: "Why?", ar: "لماذا؟", zh: "原因" })} </span>
              {L({ ku: "باچەکەیان پێش زیاتر لە 3 ڕۆژ گەیشتووە، بەڵام نەخراونەتە بۆکسی خاوەنەکانیان. تا نەخرێنە بۆکس، کڕیار چاوەڕێیە و پارەکەشیان وەرناگیرێت.", en: "Their batch arrived over 3 days ago, but they were never put in their owners' boxes. Until they are, the customer waits and nothing is collected.", ar: "وصلت دفعتها قبل أكثر من 3 أيام ولم توضع في صناديق أصحابها؛ العميل ينتظر ولا يُحصّل شيء.", zh: "其批次到达已超过 3 天，但未装入客户的箱子；客户在等，款项也未收。" })}</p>
            <p><span className="text-muted-foreground">{L({ ku: "چارەسەر:", en: "Fix:", ar: "الحل:", zh: "解决：" })} </span>
              {L({ ku: "«بیخە بۆکس» لێبدە و پاکێجەکان سکان بکە بۆ بۆکسەکەی — کۆنترینەکان لە سەرەوەن", en: "Press «Box them» and scan the parcels into the box — the longest waits are on top", ar: "اضغط «ضعها في صندوق» وامسح الطرود — الأقدم في الأعلى", zh: "点击「装箱」并扫描包裹 — 等待最久的在最上面" })}</p>
            <div className="divide-y">
              {shownCustomers.map((c) => {
                const days = c.oldestDays ?? 0;
                const batchesOf = Array.from(new Set(c.parcels.map((p) => p.batchCode).filter(Boolean)));
                return (
                  <div key={c.customerId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5" data-testid="left-out-customer">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                      {c.parcels.length}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/customers/${c.customerId}`} className="font-medium hover:text-sky-700 hover:underline dark:hover:text-sky-300">
                        {c.customerName || c.customerCode}
                      </Link>
                      <span className="ms-2 font-mono text-xs text-muted-foreground" dir="ltr">{c.customerCode}</span>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1" data-testid="left-out-days"><Clock className="h-3 w-3" />{L({ ku: `${days} ڕۆژ لە کۆگا`, en: `${days} days in store`, ar: `${days} يوم في المخزن`, zh: `在库 ${days} 天` })}</span>
                        <span dir="ltr" className="truncate">{batchesOf.join(" · ")}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-[width] duration-700", waitTone(days))} style={{ width: `${Math.min(100, Math.max(6, (days / 21) * 100))}%` }} />
                      </div>
                    </div>
                    <Button asChild size="sm" className="h-8 gap-1.5 bg-gradient-to-r from-sky-600 to-violet-600 text-white hover:from-sky-500 hover:to-violet-500">
                      <Link href={`/customer-delivery-scanner?customer=${c.customerId}`}>
                        <PackageOpen className="h-3.5 w-3.5" />
                        {L({ ku: "بیخە بۆکس", en: "Box them", ar: "ضعها في صندوق", zh: "装箱" })}
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
            {customers.length > VISIBLE && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((v) => !v)} data-testid="left-out-more">
                {showAll
                  ? L({ ku: "کەمتر پیشان بدە", en: "Show fewer", ar: "عرض أقل", zh: "收起" })
                  : L({ ku: `+ ${customers.length - VISIBLE} کڕیاری تر`, en: `+ ${customers.length - VISIBLE} more customers`, ar: `+ ${customers.length - VISIBLE} عملاء آخرين`, zh: `+ 另外 ${customers.length - VISIBLE} 位客户` })}
              </Button>
            )}
          </Row>
        )}

        {renderChecks(otherFound)}
      </div>
    </DashboardLayout>
  );
}
