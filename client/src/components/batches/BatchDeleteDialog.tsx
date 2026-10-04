import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { planCleanup, type CleanupSelection } from "@shared/batchCleanup";

/**
 * The main admin deletes a batch with what hangs from it (owner, 2026-10-04:
 * "tell me which ones, put a tick beside each, and let them go with it").
 *
 * Everything tied to the batch is listed with a tick; what each tick does to
 * every customer's account is shown as it is ticked, and anything that cannot
 * be done as ticked is said in red before the button is pressed. The server
 * checks the same rules (shared/batchCleanup) and does nothing if one fails.
 */
export function BatchDeleteDialog({
  batch,
  onClose,
  onDeleted,
}: {
  batch: { id: number; batchCode: string } | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { language } = useTranslation();
  const L = (t: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, t);
  const factsQ = trpc.batches.cleanupFacts.useQuery({ id: batch?.id ?? 0 }, { enabled: !!batch, retry: false });
  const facts = factsQ.data;
  const del = trpc.batches.deleteWithTies.useMutation();

  const empty: CleanupSelection = { receiptIds: [], parcelIds: [], boxIds: [], invoiceIds: [] };
  const [sel, setSel] = useState<CleanupSelection>(empty);
  const [reason, setReason] = useState("");
  useEffect(() => {
    setSel(empty);
    setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.id]);

  const plan = useMemo(() => (facts ? planCleanup(facts, sel) : null), [facts, sel]);

  type Key = keyof CleanupSelection;
  const toggle = (key: Key, id: number, on: boolean) =>
    setSel((s) => ({ ...s, [key]: on ? Array.from(new Set([...s[key], id])) : s[key].filter((x) => x !== id) }));
  const everything = () => {
    if (!facts) return;
    setSel({
      receiptIds: facts.receipts.filter((r) => r.eligible).map((r) => r.id),
      parcelIds: facts.parcels.filter((p) => p.eligible).map((p) => p.id),
      boxIds: facts.boxes.filter((b) => b.eligible).map((b) => b.id),
      invoiceIds: facts.invoices.map((i) => i.id),
    });
  };
  const codeOf = (customerId: number | null) => facts?.customers.find((c) => c.id === customerId)?.code ?? "";

  const submit = async () => {
    if (!batch) return;
    try {
      const res = await del.mutateAsync({ id: batch.id, ...sel, reason: reason.trim() || undefined });
      toast.success(L({
        ku: `باچی ${res.batchCode} سڕایەوە — ${res.done.length} هەنگاو کرا`,
        en: `Batch ${res.batchCode} deleted — ${res.done.length} steps done`,
        ar: `حُذفت الدفعة ${res.batchCode} — ${res.done.length} خطوات`,
        zh: `批次 ${res.batchCode} 已删除 — 完成 ${res.done.length} 步`,
      }));
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), { duration: 15000 });
      void factsQ.refetch();
    }
  };

  const section = (title: string, children: React.ReactNode, count: number) =>
    count === 0 ? null : (
      <section className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">{title} ({count})</p>
        <ul className="divide-y rounded-lg border">{children}</ul>
      </section>
    );
  const row = (key: Key, id: number, eligible: boolean, main: React.ReactNode, side: React.ReactNode, why?: string) => (
    <li key={`${key}-${id}`} className={eligible ? "" : "opacity-60"}>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm">
        <Checkbox
          checked={sel[key].includes(id)}
          disabled={!eligible}
          onCheckedChange={(v) => toggle(key, id, v === true)}
          data-testid={`cleanup-${key}-${id}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{main}</span>
          {why && <span className="block text-xs text-amber-600 dark:text-amber-400">{why}</span>}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{side}</span>
      </label>
    </li>
  );

  return (
    <Dialog open={!!batch} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            {L({ ku: `سڕینەوەی باچی ${batch?.batchCode ?? ""}`, en: `Delete batch ${batch?.batchCode ?? ""}`, ar: `حذف الدفعة ${batch?.batchCode ?? ""}`, zh: `删除批次 ${batch?.batchCode ?? ""}` })}
          </DialogTitle>
          <DialogDescription>
            {L({
              ku: "ئەوەی پێوەی بەستراوە لێرەدایە. هەرچییەکت هەڵبژارد لەگەڵ باچەکە دەڕوات؛ ئەوەی هەڵینەبژێریت وەک خۆی دەمێنێت. باچەکە دەچێتە سەتڵی خۆڵ.",
              en: "Everything tied to it is listed. What you tick goes with the batch; what you leave stays as it is. The batch goes to the recycle bin.",
              ar: "كل ما يرتبط بها مُدرج. ما تختاره يُحذف معها؛ وما تتركه يبقى. تذهب الدفعة إلى سلة المحذوفات.",
              zh: "列出了与之相关的一切。勾选的随批次一起删除；未勾选的保持不变。批次进入回收站。",
            })}
          </DialogDescription>
        </DialogHeader>

        {!facts ? (
          <div className="flex justify-center py-8">
            {factsQ.isError
              ? <p className="text-sm text-red-600">{factsQ.error.message}</p>
              : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          </div>
        ) : (
          <div className="space-y-4">
            {(facts.receipts.length + facts.parcels.length + facts.boxes.length + facts.invoices.length) > 0 && (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={everything}>
                  {L({ ku: "هەمووی هەڵبژێرە", en: "Tick everything", ar: "اختر الكل", zh: "全选" })}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSel(empty)}>
                  {L({ ku: "هیچ", en: "None", ar: "لا شيء", zh: "全不选" })}
                </Button>
              </div>
            )}

            {section(L({ ku: "وەسڵەکان — هەڵدەوەشێنرێنەوە: ئەو پارەدانە لادەچێت و قەرزی کڕیار دەگەڕێتەوە بۆ پێش وەسڵەکە (هیچ پارەیەک نادرێتەوە)", en: "Receipts — undone: the payment is removed and the debt returns to what it was before it (no money is paid out)", ar: "الإيصالات — تُلغى: تُزال الدفعة ويعود الدين كما كان (لا يُدفع أي مبلغ)", zh: "收据 — 撤销：删除该付款，欠款恢复到收据之前（不退任何钱）" }),
              facts.receipts.map((r) => row("receiptIds", r.id, r.eligible,
                <><bdi dir="ltr">{r.number}</bdi> · <bdi dir="ltr">{r.boxCode}</bdi> · {codeOf(r.customerId)}</>,
                <>{L({ ku: "قەرز", en: "debt", ar: "دين", zh: "欠款" })} +{fmtUsd(r.putBackUsd)}</>, r.why)), facts.receipts.length)}

            {section(L({ ku: "پاکەتەکان — دەسڕدرێنەوە، قەرزەکەیان لە حیساب لادەچێت", en: "Parcels — deleted, their charges come off the account", ar: "الطرود — تُحذف وتُزال رسومها", zh: "包裹 — 删除，费用从账户扣除" }),
              facts.parcels.map((p) => row("parcelIds", p.id, p.eligible,
                <><bdi dir="ltr">{p.code}</bdi>{p.tracking ? <> · <bdi dir="ltr">{p.tracking}</bdi></> : null} · {codeOf(p.customerId)} · <bdi dir="ltr">{p.weightKg} kg</bdi></>,
                <>{p.chargedUsd > 0 ? `${L({ ku: "قەرز", en: "debt", ar: "دين", zh: "欠款" })} −${fmtUsd(p.chargedUsd)}` : L({ ku: "قەرزی نییە", en: "no charge", ar: "بلا رسوم", zh: "无费用" })}</>, p.why)), facts.parcels.length)}

            {section(L({ ku: "بۆکسەکان — دەسڕدرێنەوە (دەچنە سەتڵی خۆڵ)", en: "Boxes — deleted (to the recycle bin)", ar: "الصناديق — تُحذف (إلى السلة)", zh: "箱子 — 删除（进回收站）" }),
              facts.boxes.map((b) => row("boxIds", b.id, b.eligible,
                <><bdi dir="ltr">{b.code}</bdi> · {codeOf(b.customerId)} · {b.parcelIds.length} {L({ ku: "پاکەت", en: "parcels", ar: "طرود", zh: "包裹" })}</>,
                <>{b.status}</>, b.why)), facts.boxes.length)}

            {section(L({ ku: "پسوولەکان — هەڵدەوەشێنرێنەوە (دەمێننەوە، بە «هەڵوەشێنراو»)", en: "Invoices — cancelled (kept, marked cancelled)", ar: "الفواتير — تُلغى (تبقى مؤشرة ملغاة)", zh: "发票 — 作废（保留，标记作废）" }),
              facts.invoices.map((i) => row("invoiceIds", i.id, true,
                <bdi dir="ltr">{i.number}</bdi>, <>{fmtUsd(i.totalUsd)}</>)), facts.invoices.length)}

            {facts.liveOrders > 0 && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-2 text-xs dark:bg-amber-950/20">
                {L({
                  ku: `${facts.liveOrders} ئۆردەری زیندوو ئەم باچەیان لەسەرە — لێرەوە دەستیان لێ نادرێت، تەنها باچەکەیان لێ لادەچێت.`,
                  en: `${facts.liveOrders} live orders point at this batch — they are not touched here; they just lose the batch.`,
                  ar: `${facts.liveOrders} طلبات حية مرتبطة — لا تُمس هنا.`,
                  zh: `${facts.liveOrders} 个有效订单指向此批次——此处不处理。`,
                })}
              </p>
            )}

            {plan && plan.effects.length > 0 && (
              <section className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  {L({ ku: "حیسابی کڕیارەکان دوای ئەمە", en: "Customer accounts after this", ar: "حسابات العملاء بعد ذلك", zh: "之后的客户账户" })}
                </p>
                <ul className="rounded-lg border text-sm">
                  {plan.effects.map((e) => (
                    <li key={e.customerId} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span>{e.code}</span>
                      <span className="tabular-nums" dir="ltr">
                        {fmtUsd(e.beforeUsd)} → <b className={e.afterUsd < 0 ? "text-red-600" : ""}>{fmtUsd(e.afterUsd)}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {plan && plan.problems.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-red-500/40 bg-red-50/60 p-2 text-xs text-red-700 dark:bg-red-950/20 dark:text-red-300" data-testid="cleanup-problems">
                {plan.problems.map((p, i) => <li key={i}>• {p}</li>)}
              </ul>
            )}

            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder={L({ ku: "هۆکار (ئارەزوومەندانە) — بۆ نموونە: باچی تاقیکردنەوە", en: "Reason (optional) — e.g. a test batch", ar: "السبب (اختياري)", zh: "原因（可选）" })}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {L({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
          </Button>
          <Button
            type="button"
            className="bg-red-600 hover:bg-red-700"
            disabled={!facts || !plan || plan.problems.length > 0 || del.isPending}
            onClick={submit}
            data-testid="cleanup-delete"
          >
            {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span className="ms-1">{L({ ku: "سڕینەوە", en: "Delete", ar: "حذف", zh: "删除" })}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
