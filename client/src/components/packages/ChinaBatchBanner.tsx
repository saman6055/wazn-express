import { CheckCircle2, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pickLang } from "@/lib/lang";

type Words = { ku: string; en: string; ar: string; zh: string };

const todayKey = () => {
  const d = new Date();
  return `wazn-qr-china-batch-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** The batch confirmed for today on this device, if any. */
export function confirmedBatchToday(): string | null {
  try { return localStorage.getItem(todayKey()); } catch { return null; }
}

export function confirmBatchToday(batchId: string) {
  try { localStorage.setItem(todayKey(), batchId); } catch { /* a convenience; the banner asks again */ }
}

/**
 * Quick Register in China (owner, 2026-10-24): the batch big at the top, and
 * asked once a day - «ئەمڕۆ بۆ باچی AIR-077 تۆمار دەکەیت؟» - so a whole day
 * is not registered on yesterday's batch. Registration waits for the yes.
 */
export function ChinaBatchBanner({
  batchCode,
  batchId,
  confirmed,
  onConfirm,
  onChange,
  language,
}: {
  batchCode: string | null;
  batchId: string;
  confirmed: boolean;
  onConfirm: () => void;
  onChange: () => void;
  language: string;
}) {
  const L = (w: Words) => pickLang(language, w);
  if (!batchCode) {
    return (
      <div className="mb-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" data-testid="china-batch-banner">
        {L({ ku: "باچ هەڵنەبژێردراوە - پێش تۆمارکردن باچ هەڵبژێرە", en: "No batch chosen - choose one before registering", ar: "لم تُختر دفعة - اختر دفعة قبل التسجيل", zh: "未选择批次 - 登记前请选择批次" })}
      </div>
    );
  }
  return (
    <div
      className={confirmed
        ? "mb-3 flex items-center justify-between gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 px-4 py-2"
        : "mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 dark:bg-amber-950/30"}
      data-testid="china-batch-banner"
      data-batch={batchId}
    >
      <div className="flex items-center gap-3">
        <Boxes className="h-6 w-6 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">
            {confirmed
              ? L({ ku: "باچی ئەمڕۆ", en: "Today's batch", ar: "دفعة اليوم", zh: "今日批次" })
              : L({ ku: "ئەمڕۆ بۆ ئەم باچە تۆمار دەکەیت؟", en: "Registering on this batch today?", ar: "هل تسجّل على هذه الدفعة اليوم؟", zh: "今天登记到此批次吗？" })}
          </p>
          <p className="font-mono text-2xl font-black tracking-wide" dir="ltr">{batchCode}</p>
        </div>
      </div>
      {confirmed ? (
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" onClick={onChange} data-testid="china-batch-change">
            {L({ ku: "گۆڕینی باچ", en: "Change batch", ar: "تغيير الدفعة", zh: "更换批次" })}
          </Button>
          <Button onClick={onConfirm} data-testid="china-batch-confirm">
            {L({ ku: "بەڵێ، ئەم باچە", en: "Yes, this batch", ar: "نعم، هذه الدفعة", zh: "是，此批次" })}
          </Button>
        </div>
      )}
    </div>
  );
}
