/**
 * Other costs on a box - customs, an inspection, a repack, a service in
 * China, or anything else written out (shared/extraCosts).
 *
 * Owner, 2026-10-19: he paid $12 more at customs and had only his pen to put
 * it on the receipt. Two figures per line: what the company paid, and what
 * the customer is charged - equal, more, or nothing when the company keeps
 * it. Anybody may write one; the main admin is told of each in the bell.
 * The customer's price goes on the account the moment it is written and the
 * box asks for it; a line no receipt has taken can be struck again.
 */
import { useState } from "react";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/portalFormat";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GroupedNumberInput } from "@/components/expenses/GroupedNumberInput";
import {
  EXTRA_COST_NEEDS_TEXT,
  EXTRA_COST_REASONS,
  EXTRA_COST_REASON_LABELS,
  extraCostProblem,
  extraCostProfitUsd,
  type ExtraCostReason,
} from "@shared/extraCosts";

export interface BoxExtraCostLine {
  id: number;
  reason: ExtraCostReason;
  note: string | null;
  costUsd: number;
  priceUsd: number;
  settlementId: number | null;
  trackingNumber: string | null;
  createdByName: string | null;
}

export function BoxExtraCosts({ boxId, extras, onChanged }: { boxId: number; extras: BoxExtraCostLine[]; onChanged: () => void }) {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const [adding, setAdding] = useState(false);
  const [reason, setReason] = useState<ExtraCostReason | "">("");
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [onCompany, setOnCompany] = useState(false);

  const reset = () => { setAdding(false); setReason(""); setNote(""); setCost(""); setPrice(""); setPriceTouched(false); setOnCompany(false); };
  const add = trpc.deliveryBox.addExtraCost.useMutation({
    onSuccess: () => { reset(); onChanged(); toast.success(L({ ku: "تێچووەکە زیاد کرا", en: "Cost added", ar: "أُضيفت التكلفة", zh: "已添加费用" })); },
    onError: (e) => toast.error(e.message, { duration: 15_000 }),
  });
  const remove = trpc.deliveryBox.removeExtraCost.useMutation({
    onSuccess: () => { onChanged(); toast.success(L({ ku: "تێچووەکە لابرا", en: "Cost removed", ar: "أُزيلت التكلفة", zh: "已删除费用" })); },
    onError: (e) => toast.error(e.message, { duration: 15_000 }),
  });

  // The ordinary case is passing the cost on as it was paid: the price
  // follows the cost until somebody types a price of their own.
  const costNum = Number(cost) || 0;
  const priceNum = onCompany ? 0 : (priceTouched ? Number(price) || 0 : costNum);
  const problem = reason ? extraCostProblem({ reason, note, costUsd: costNum, priceUsd: priceNum }) : L({ ku: "هۆکارێک هەڵبژێرە.", en: "Choose a reason.", ar: "اختر سبباً.", zh: "请选择原因。" });
  const profit = extraCostProfitUsd({ costUsd: costNum, priceUsd: priceNum });

  const owedHere = Math.round(extras.filter((e) => e.priceUsd > 0 && e.settlementId === null).reduce((s, e) => s + e.priceUsd * 100, 0)) / 100;

  return (
    <div className="rounded-lg border p-3 space-y-2" data-testid="box-extra-costs">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" />
          {L({ ku: "تێچووی تر", en: "Other costs", ar: "تكاليف أخرى", zh: "其他费用" })}
        </p>
        {!adding && (
          <Button size="sm" variant="outline" className="h-7" onClick={() => setAdding(true)} data-testid="extra-cost-add">
            <Plus className="me-1 h-3.5 w-3.5" />
            {L({ ku: "زیادکردن", en: "Add", ar: "إضافة", zh: "添加" })}
          </Button>
        )}
      </div>

      {extras.length > 0 && (
        <ul className="divide-y rounded-md border text-sm">
          {extras.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2.5 py-2">
              <span className="min-w-0">
                <span className="font-medium">{L(EXTRA_COST_REASON_LABELS[e.reason])}</span>
                {e.note ? <span className="text-muted-foreground"> — {e.note}</span> : null}
                {e.trackingNumber ? <bdi dir="ltr" className="ms-1 font-mono text-xs text-muted-foreground">{e.trackingNumber}</bdi> : null}
                <span className="block text-xs text-muted-foreground">
                  {L({ ku: "تێچوو", en: "cost", ar: "التكلفة", zh: "成本" })} <bdi dir="ltr">{fmtUsd(e.costUsd)}</bdi>
                  {" · "}
                  {e.priceUsd > 0
                    ? <>{L({ ku: "لە کڕیار", en: "to the customer", ar: "على العميل", zh: "向客户收" })} <bdi dir="ltr">{fmtUsd(e.priceUsd)}</bdi></>
                    : L({ ku: "لەسەر کۆمپانیا", en: "on the company", ar: "على الشركة", zh: "公司承担" })}
                  {e.createdByName ? ` · ${e.createdByName}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {e.settlementId !== null ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {L({ ku: "دراوە", en: "Paid", ar: "مدفوع", zh: "已付" })}
                  </span>
                ) : (
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0"
                    aria-label={L({ ku: "لابردن", en: "Remove", ar: "إزالة", zh: "删除" })}
                    disabled={remove.isPending}
                    onClick={async () => {
                      const yes = await confirmAction({
                        title: L({ ku: "ئەم تێچووە لاببرێت؟", en: "Remove this cost?", ar: "إزالة هذه التكلفة؟", zh: "删除此费用？" }),
                        message: e.priceUsd > 0
                          ? L({ ku: `${fmtUsd(e.priceUsd)} لە حیسابی کڕیار کەم دەبێتەوە، بە دێڕێک کە هۆکارەکەی دەڵێت.`, en: `${fmtUsd(e.priceUsd)} comes off the customer's account, with a line that says why.`, ar: `يُخصم ${fmtUsd(e.priceUsd)} من حساب العميل بسطر يذكر السبب.`, zh: `将从客户账户扣回 ${fmtUsd(e.priceUsd)}，并注明原因。` })
                          : L({ ku: "لەسەر کۆمپانیا بوو؛ لە قازانج کەم ناکرێتەوە.", en: "It was on the company; it no longer comes off the profit.", ar: "كانت على الشركة؛ لن تُخصم من الربح بعد الآن.", zh: "该费用由公司承担；将不再计入利润扣减。" }),
                      });
                      if (yes) remove.mutate({ id: e.id, reason: L({ ku: "لە شاشەی پارەدانی بۆکس لابرا", en: "removed on the box payment screen", ar: "أُزيلت من شاشة دفع الصندوق", zh: "在箱子付款界面删除" }) });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  </Button>
                )}
                <bdi dir="ltr" className="font-mono tabular-nums">{e.priceUsd > 0 ? fmtUsd(e.priceUsd) : "—"}</bdi>
              </span>
            </li>
          ))}
        </ul>
      )}
      {owedHere > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="extra-cost-owed">
          {L({ ku: `${fmtUsd(owedHere)} لەم تێچووانە لەگەڵ بۆکسەکە داوا دەکرێت.`, en: `${fmtUsd(owedHere)} of these is asked for with the box.`, ar: `يُطلب ${fmtUsd(owedHere)} من هذه مع الصندوق.`, zh: `其中 ${fmtUsd(owedHere)} 随箱收取。` })}
        </p>
      )}

      {adding && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-2.5" data-testid="extra-cost-form">
          <Select value={reason} onValueChange={(v) => setReason(v as ExtraCostReason)}>
            <SelectTrigger className="h-9" data-testid="extra-cost-reason">
              <SelectValue placeholder={L({ ku: "هۆکار", en: "Reason", ar: "السبب", zh: "原因" })} />
            </SelectTrigger>
            <SelectContent>
              {EXTRA_COST_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{L(EXTRA_COST_REASON_LABELS[r])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder={reason === EXTRA_COST_NEEDS_TEXT
              ? L({ ku: "بنووسە تێچووەکە هی چییە (پێویستە)", en: "Write what it was for (required)", ar: "اكتب لماذا (مطلوب)", zh: "写明用途（必填）" })
              : L({ ku: "تێبینی (ئارەزوومەندانە)", en: "Note (optional)", ar: "ملاحظة (اختياري)", zh: "备注（可选）" })}
            className="h-9"
            maxLength={500}
            data-testid="extra-cost-note"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">{L({ ku: "تێچوو — کۆمپانیا دای ($)", en: "Cost — what we paid ($)", ar: "التكلفة — ما دفعناه ($)", zh: "成本 — 我们支付 ($)" })}</span>
              <GroupedNumberInput value={cost} onValueChange={setCost} className="h-9" inputMode="decimal" dir="ltr" placeholder="0" data-testid="extra-cost-cost" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">{L({ ku: "نرخ — لە کڕیار ($)", en: "Price — to the customer ($)", ar: "السعر — على العميل ($)", zh: "价格 — 向客户收 ($)" })}</span>
              <GroupedNumberInput
                value={onCompany ? "0" : (priceTouched ? price : cost)}
                onValueChange={(v) => { setPriceTouched(true); setPrice(v); }}
                className={cn("h-9", onCompany && "opacity-50")}
                inputMode="decimal" dir="ltr" placeholder="0"
                disabled={onCompany}
                data-testid="extra-cost-price"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onCompany} onChange={(ev) => setOnCompany(ev.target.checked)} data-testid="extra-cost-on-company" />
            {L({ ku: "لەسەر کۆمپانیا — لە کڕیار وەرناگیرێتەوە، لە قازانج کەم دەبێتەوە", en: "On the company — not taken back, comes off the profit", ar: "على الشركة — لا يُسترد ويُخصم من الربح", zh: "公司承担 — 不向客户收取，计入利润扣减" })}
          </label>
          {costNum > 0 || priceNum > 0 ? (
            <p className={cn("text-xs", profit < 0 ? "text-red-700 dark:text-red-300" : profit > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")} data-testid="extra-cost-effect">
              {profit > 0
                ? L({ ku: `قازانجی کۆمپانیا ${fmtUsd(profit)}`, en: `Company profit ${fmtUsd(profit)}`, ar: `ربح الشركة ${fmtUsd(profit)}`, zh: `公司利润 ${fmtUsd(profit)}` })
                : profit < 0
                  ? L({ ku: `زیانی کۆمپانیا ${fmtUsd(-profit)}`, en: `Company loss ${fmtUsd(-profit)}`, ar: `خسارة الشركة ${fmtUsd(-profit)}`, zh: `公司亏损 ${fmtUsd(-profit)}` })
                  : L({ ku: "بە هەمان نرخ دەدرێتەوە بە کڕیار — نە قازانج، نە زیان", en: "Passed on at cost — no profit, no loss", ar: "يُحمّل بالتكلفة — لا ربح ولا خسارة", zh: "按成本转嫁 — 无盈亏" })}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={reset}>{L({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}</Button>
            <Button
              size="sm"
              disabled={!!problem || add.isPending}
              title={problem ?? undefined}
              onClick={() => reason && add.mutate({ boxId, reason, note: note.trim() || undefined, costUsd: costNum, priceUsd: priceNum })}
              data-testid="extra-cost-save"
            >
              {L({ ku: "زیادکردن", en: "Add", ar: "إضافة", zh: "添加" })}
            </Button>
          </div>
          {problem && reason ? <p className="text-xs text-red-700 dark:text-red-300">{problem}</p> : null}
        </div>
      )}
    </div>
  );
}
