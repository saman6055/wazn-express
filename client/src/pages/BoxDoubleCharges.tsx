import { useState } from "react";
import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { cn } from "@/lib/utils";
import { seenList } from "@shared/boxDoubleChargeAll";

type Words = { ku: string; en: string; ar: string; zh: string };

function Money({ value, className }: { value: number; className?: string }) {
  return <bdi dir="ltr" className={cn("tabular-nums", className)}>{fmtUsd(value)}</bdi>;
}

/**
 * Customers shown owing for goods in a box they paid (owner, 2026-10-08:
 * "whoever had a box receipted must not, in any way, owe for that box and
 * its trackings"). Each one with the proof: the same tracking written on the
 * account twice — through its order and through its box — and the receipt
 * that paid it once. The main admin takes the second writing off; no credit
 * is made and no payment is touched.
 */
export default function BoxDoubleCharges() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const { user } = useAuth();
  const isMainAdmin = user?.role === "super_admin";
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.ledger.boxDoubleCharges.useQuery();
  const [open, setOpen] = useState<number | null>(null);
  const [asking, setAsking] = useState<number | null>(null);
  // Every false debt at one yes (owner, 2026-10-10) - to the list on screen.
  const [askingAll, setAskingAll] = useState(false);
  const rows = data ?? [];
  const owing = rows.filter((r) => r.falseDebtUsd > 0.005);
  const settled = rows.filter((r) => r.falseDebtUsd <= 0.005);
  const total = owing.reduce((s, r) => s + r.falseDebtUsd, 0);

  const fix = trpc.ledger.correctBoxDoubleCharge.useMutation({
    onSuccess: (res) => {
      void utils.ledger.boxDoubleCharges.invalidate();
      void utils.ledger.financeDashboard.invalidate();
      void utils.ledger.workingCapital.invalidate();
      void utils.dashboard.risks.invalidate();
      setAsking(null);
      toast.success(L({ ku: `${fmtUsd(res.removedUsd)} لەسەری لابرا — حیسابی ئێستا ${fmtUsd(res.balanceUsd)}`, en: `${fmtUsd(res.removedUsd)} taken off — balance now ${fmtUsd(res.balanceUsd)}`, ar: `خُصم ${fmtUsd(res.removedUsd)} — الرصيد الآن ${fmtUsd(res.balanceUsd)}`, zh: `已减去 ${fmtUsd(res.removedUsd)} — 现余额 ${fmtUsd(res.balanceUsd)}` }));
    },
    onError: (e) => toast.error(e.message, { duration: 20_000 }),
  });

  const refresh = () => {
    void utils.ledger.boxDoubleCharges.invalidate();
    void utils.ledger.financeDashboard.invalidate();
    void utils.ledger.workingCapital.invalidate();
    void utils.dashboard.risks.invalidate();
  };
  const fixAll = trpc.ledger.correctAllBoxDoubleCharges.useMutation({
    onSuccess: (res) => {
      refresh();
      setAskingAll(false);
      toast.success(L({
        ku: `${res.corrected} کڕیار ڕاست کرانەوە — ${fmtUsd(res.removedUsd)} قەرزی درۆ لابرا`,
        en: `${res.corrected} customers put right — ${fmtUsd(res.removedUsd)} of false debt taken off`,
        ar: `تم تصحيح ${res.corrected} عميلاً — خُصم ${fmtUsd(res.removedUsd)} من الدين غير الصحيح`,
        zh: `已更正 ${res.corrected} 位客户 — 减去虚假欠款 ${fmtUsd(res.removedUsd)}`,
      }), { duration: 15_000 });
      for (const f of res.failed) toast.error(`${f.customerCode ?? f.customerId}: ${f.message}`, { duration: 30_000 });
    },
    onError: (e) => { refresh(); toast.error(e.message, { duration: 20_000 }); },
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-6" data-testid="box-double-charges">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><ShieldAlert className="h-5 w-5" />{L({ ku: "بۆکسی واسڵکراو، قەرزی ماوە", en: "Box receipted, debt still shown", ar: "صندوق مُسدَّد وما زال الدين ظاهراً", zh: "已收款的箱子仍显示欠款" })}</h1>
          <p className="text-sm text-muted-foreground">
            {L({
              ku: "ئەو کڕیارانەی کاڵاکەیان لە بۆکسێکدا واسڵ کراوە، بەڵام هەمان کاڵا دوو جار لەسەریان نووسراوە و یەکێکیان وەک قەرز ماوەتەوە. بۆکس سەنگی مەحەکە: ئەوەی واسڵ کراوە نابێت قەرز بێت.",
              en: "Customers whose goods were receipted in a box, but the same goods were written on their account twice and one writing is left as a debt. The box is the touchstone: what was receipted is not owed.",
              ar: "عملاء سُدّدت بضائعهم في صندوق لكنها قُيّدت مرتين وبقي أحد القيدين ديناً.",
              zh: "货物已在箱子收款，但同一货物被记账两次，其中一次仍显示为欠款的客户。",
            })}
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{L({ ku: "کڕیار بە قەرزی درۆ", en: "Customers with a false debt", ar: "عملاء بدين غير صحيح", zh: "虚假欠款客户" })}</div>
                <div className={cn("text-2xl font-semibold", owing.length > 0 && "text-red-700 dark:text-red-400")}><bdi dir="ltr">{owing.length}</bdi></div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{L({ ku: "کۆی قەرزی درۆ", en: "False debt in all", ar: "إجمالي الدين غير الصحيح", zh: "虚假欠款合计" })}</div>
                <div className={cn("text-2xl font-semibold", total > 0 && "text-red-700 dark:text-red-400")}><Money value={total} /></div>
              </div>
            </div>

            {isMainAdmin && owing.length > 1 && !askingAll && (
              <div className="flex justify-end">
                <Button data-testid="double-charge-all" onClick={() => setAskingAll(true)}>
                  {L({ ku: `هەمووی ڕاست بکەوە (${owing.length})`, en: `Put all right (${owing.length})`, ar: `صحّح الكل (${owing.length})`, zh: `全部更正 (${owing.length})` })}
                </Button>
              </div>
            )}
            {askingAll && (
              <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="double-charge-all-confirm">
                <p className="font-medium">
                  {L({
                    ku: `${fmtUsd(total)} قەرزی درۆ لەسەر ${owing.length} کڕیار لادەبرێت. هیچ پارەدانێک دەستی لێ نادرێت و هیچ کرێدیتێک دروست نابێت. ئەوەی بەڕاستی قەرزە لەسەر هەر کەسێک دەمێنێتەوە.`,
                    en: `${fmtUsd(total)} of false debt comes off ${owing.length} customers. No payment is touched and no credit is made. What each really owes stays on the account.`,
                    ar: `يُخصم ${fmtUsd(total)} من الدين غير الصحيح عن ${owing.length} عميلاً. لا تُمس أي دفعة ولا يُنشأ رصيد دائن.`,
                    zh: `将从 ${owing.length} 位客户账上减去虚假欠款 ${fmtUsd(total)}。不动任何付款，也不产生贷方余额。`,
                  })}
                </p>
                <ul className="max-h-72 divide-y divide-amber-300/60 overflow-y-auto rounded-md border border-amber-300/60 bg-background/60 text-foreground dark:divide-amber-500/30 dark:border-amber-500/30" data-testid="double-charge-all-list">
                  <li className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 text-xs text-muted-foreground">
                    <span>{L({ ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</span>
                    <span className="text-end">{L({ ku: "لادەبرێت", en: "Comes off", ar: "يُخصم", zh: "减去" })}</span>
                    <span className="w-20 text-end">{L({ ku: "دەمێنێت", en: "Stays", ar: "يبقى", zh: "剩余" })}</span>
                  </li>
                  {owing.map((c) => (
                    <li key={c.customerId} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-1.5">
                      <span className="min-w-0 truncate"><bdi dir="ltr">{c.customerCode}</bdi></span>
                      <Money value={c.falseDebtUsd} className="text-end font-medium text-red-700 dark:text-red-400" />
                      <Money value={c.balanceUsd - c.falseDebtUsd} className="w-20 text-end" />
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="ghost" disabled={fixAll.isPending} onClick={() => setAskingAll(false)}>{L({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}</Button>
                  <Button size="sm" disabled={fixAll.isPending} data-testid="double-charge-all-yes" onClick={() => fixAll.mutate(seenList(owing))}>
                    {fixAll.isPending
                      ? L({ ku: "ڕاست دەکرێنەوە…", en: "Putting right…", ar: "جارٍ التصحيح…", zh: "更正中…" })
                      : L({ ku: `بەڵێ، هەر ${owing.length} کەسەکە ڕاست بکەوە`, en: `Yes, put all ${owing.length} right`, ar: `نعم، صحّح الجميع (${owing.length})`, zh: `是，全部更正 (${owing.length})` })}
                  </Button>
                </div>
              </div>
            )}

            {owing.length === 0 ? (
              <Card><CardContent className="py-6 text-sm text-muted-foreground">{L({ ku: "هیچ کڕیارێک بۆ بۆکسێکی واسڵکراو قەرزار نییە.", en: "Nobody owes for a box that was receipted.", ar: "لا أحد مدين بصندوق تم تسديده.", zh: "没有人因已收款的箱子而欠款。" })}</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0 text-sm">
                  <ul className="divide-y">
                    {owing.map((c) => (
                      <li key={c.customerId} className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="min-w-0 flex-1">
                            <Link href={`/finance/customer/${c.customerId}`} className="font-medium underline">{c.customerName ?? c.customerCode}</Link>{" "}
                            <span className="text-xs text-muted-foreground"><bdi dir="ltr">{c.customerCode}</bdi></span>
                            <span className="block text-xs text-muted-foreground">
                              {L({ ku: "حیسابی ئێستا", en: "balance now", ar: "الرصيد الآن", zh: "现余额" })} <Money value={c.balanceUsd} /> ·{" "}
                              {L({ ku: "دوو جار نووسراوە", en: "written twice", ar: "قُيِّد مرتين", zh: "重复记账" })} <Money value={c.twiceUsd} /> ·{" "}
                              {L({ ku: `${c.lines.length} تراک`, en: `${c.lines.length} tracking(s)`, ar: `${c.lines.length} تتبع`, zh: `${c.lines.length} 个运单` })}
                            </span>
                          </span>
                          <span className="shrink-0 text-end">
                            <Money value={c.falseDebtUsd} className="font-semibold text-red-700 dark:text-red-400" />
                            <span className="block text-xs text-muted-foreground">{L({ ku: "قەرزی درۆ", en: "false debt", ar: "دين غير صحيح", zh: "虚假欠款" })}</span>
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(open === c.customerId ? null : c.customerId)}>
                            {open === c.customerId ? L({ ku: "داخستن", en: "Hide", ar: "إخفاء", zh: "收起" }) : L({ ku: "بەڵگەکەی ببینە", en: "See the proof", ar: "اعرض الدليل", zh: "查看依据" })}
                          </Button>
                          {isMainAdmin && asking !== c.customerId && (
                            <Button size="sm" className="h-8" onClick={() => { setAsking(c.customerId); setOpen(c.customerId); }}>{L({ ku: "ڕاستی بکەوە", en: "Put it right", ar: "صحّحه", zh: "更正" })}</Button>
                          )}
                        </div>
                        {open === c.customerId && (
                          <ul className="mt-2 divide-y rounded-md border" data-testid="double-charge-proof">
                            {c.lines.map((l) => (
                              <li key={l.boxChargeId} className="px-3 py-2">
                                <div className="font-medium"><bdi dir="ltr">{l.trackingNumber}</bdi> · <bdi dir="ltr">{l.boxCode}</bdi></div>
                                <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                                  <div>
                                    <div className="text-muted-foreground">{L({ ku: "جاری یەکەم — وەک داواکاری", en: "First — as an order", ar: "الأولى — كطلب", zh: "第一次 — 作为订单" })}</div>
                                    {l.orderCharges.map((o) => (
                                      <div key={o.id} className="flex justify-between gap-2"><span className="min-w-0 truncate">{o.description}</span><Money value={o.usd} /></div>
                                    ))}
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">{L({ ku: "جاری دووەم — لە بۆکسدا (وەسڵ ئەمەی داپۆشی)", en: "Second — at the box (the receipt paid this one)", ar: "الثانية — عند الصندوق (سدّدها الإيصال)", zh: "第二次 — 在箱子（收据付的是这笔）" })}</div>
                                    <div className="flex justify-between gap-2"><span><bdi dir="ltr">{new Date(l.boxChargedAt).toLocaleDateString("en-GB")}</bdi></span><Money value={l.boxChargeUsd} /></div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        {asking === c.customerId && (
                          <div className="mt-2 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="double-charge-confirm">
                            <p>
                              {L({
                                ku: `${fmtUsd(c.falseDebtUsd)} لەسەر ${c.customerName ?? c.customerCode ?? ""} لادەبرێت، و حیسابەکەی دەبێتە ${fmtUsd(c.balanceUsd - c.falseDebtUsd)}. هیچ پارەدانێک دەستی لێ نادرێت و هیچ کرێدیتێک دروست نابێت. هەر دێڕێک بە هۆکارەکەیەوە لە حیسابەکەیدا دەمێنێتەوە.`,
                                en: `${fmtUsd(c.falseDebtUsd)} comes off ${c.customerName ?? c.customerCode ?? ""}, leaving a balance of ${fmtUsd(c.balanceUsd - c.falseDebtUsd)}. No payment is touched and no credit is made. Every line stays on the account with its reason.`,
                                ar: `يُخصم ${fmtUsd(c.falseDebtUsd)} من ${c.customerName ?? c.customerCode ?? ""} ليصبح الرصيد ${fmtUsd(c.balanceUsd - c.falseDebtUsd)}. لا تُمس أي دفعة ولا يُنشأ رصيد دائن.`,
                                zh: `将从 ${c.customerName ?? c.customerCode ?? ""} 账上减去 ${fmtUsd(c.falseDebtUsd)}，余额变为 ${fmtUsd(c.balanceUsd - c.falseDebtUsd)}。不动任何付款，也不产生贷方余额。`,
                              })}
                            </p>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>{L({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}</Button>
                              <Button size="sm" disabled={fix.isPending} onClick={() => fix.mutate({ customerId: c.customerId })}>{L({ ku: "بەڵێ، ڕاستی بکەوە", en: "Yes, put it right", ar: "نعم، صحّحه", zh: "是，更正" })}</Button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {settled.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {L({
                  ku: `${settled.length} کڕیاری تر هەمان دووجار نووسینیان هەبووە، بەڵام حیسابەکەیان پێشتر بە دەست ڕاست کراوەتەوە و ئێستا هیچ قەرزێکیان لێی نەماوە.`,
                  en: `${settled.length} more customers had the same double writing, but their accounts were put right by hand earlier and nothing of it is owed now.`,
                  ar: `${settled.length} عملاء آخرون كان لديهم القيد المزدوج نفسه لكن حساباتهم صُحّحت يدوياً سابقاً.`,
                  zh: `另有 ${settled.length} 位客户有同样的重复记账，但其账户此前已手工更正。`,
                })}
              </p>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
