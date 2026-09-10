import { useState } from "react";
import { AlertTriangle, Copy, Check, RotateCcw, PackageX, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { buildErrorReport, getErrorBoundaryStrings } from "@/components/ErrorBoundary";
import { nothingToTakeReason, confirmedPaymentCount, type SettlementViewLike } from "@/lib/settlementState";

/**
 * What the payment window shows when there is no money to take — and when it
 * could not find out. Shared by the quick payment dialog and the full payment
 * panel so the two can never say different things. See settlementState.ts.
 */

type Words = { ku: string; en: string; ar: string; zh: string };
const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;

function useWords() {
  const { language } = useTranslation();
  return (k: Words) => pickLang(language, k);
}

/**
 * The box's payment details did not load. Said as a failure, never as
 * "nothing owed", with the same copyable report every error screen gives.
 */
export function SettlementLoadError({ error, onRetry }: { error: { message: string; stack?: string }; onRetry: () => void }) {
  const t = useWords();
  const s = getErrorBoundaryStrings();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const asError = error instanceof Error ? error : Object.assign(new Error(error.message), { stack: error.stack });
    void navigator.clipboard.writeText(buildErrorReport(asError)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-3 py-4 text-center" data-testid="settlement-load-error">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <p className="font-medium">
        {t({ ku: "زانیاریی پارەدانی ئەم بۆکسە بار نەبوو", en: "This box's payment details could not be loaded", ar: "تعذّر تحميل تفاصيل الدفع لهذا الصندوق", zh: "无法加载此箱的付款信息" })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t({ ku: "ئەمە مانای ئەوە نییە کە هیچ پارەیەک ماوە نییە. هەڵەکە کۆپی بکە و بینێرە بۆ پشتگیری.", en: "This does not mean nothing is owed. Copy the error and send it to support.", ar: "هذا لا يعني أنه لا يوجد مبلغ مستحق. انسخ الخطأ وأرسله إلى الدعم.", zh: "这并不表示没有欠款。请复制错误并发送给支持人员。" })}
      </p>
      <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-start text-xs text-muted-foreground" dir="ltr">
        {error.message}
      </pre>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="me-1 h-4 w-4" />
          {s.tryAgain}
        </Button>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="me-1 h-4 w-4" /> : <Copy className="me-1 h-4 w-4" />}
          {copied ? s.copied : s.copyDetails}
        </Button>
      </div>
    </div>
  );
}

/**
 * Nothing to take, and why: no box, no parcels in the box, or every parcel
 * covered — then with each parcel's figures, so anyone can see it for
 * themselves instead of taking the window's word for it.
 */
export function NothingToTake({ view }: { view: SettlementViewLike | null | undefined }) {
  const t = useWords();
  const reason = nothingToTakeReason(view);

  if (reason === "no_box") {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground" data-testid="settlement-no-box">
        {t({ ku: "ئەم بۆکسە نەدۆزرایەوە", en: "This box was not found", ar: "لم يُعثر على هذا الصندوق", zh: "未找到此箱" })}
      </p>
    );
  }

  if (reason === "no_parcels") {
    return (
      <div className="space-y-2 py-6 text-center" data-testid="settlement-no-parcels">
        <PackageX className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="font-medium">
          {t({ ku: "ئەم بۆکسە هیچ پاکەتێکی تێدا نییە", en: "This box has no parcels in it", ar: "لا يحتوي هذا الصندوق على أي طرد", zh: "此箱内没有包裹" })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t({ ku: "بۆیە هیچ شتێک نییە پارەی بۆ وەربگیرێت. ئەگەر لیستەکە ژمارەی پاکەت پیشان دەدات، پاکەتەکان لە بۆکسەکە دەرهێنراون.", en: "So there is nothing to take payment for. If the list shows a parcel count, the parcels were taken out of the box.", ar: "لذلك لا يوجد ما يُدفع عنه. إذا كانت القائمة تُظهر عدد طرود، فقد أُخرجت الطرود من الصندوق.", zh: "因此没有可收款的内容。如果列表显示了包裹数量，说明包裹已从箱中移出。" })}
        </p>
      </div>
    );
  }

  const payments = confirmedPaymentCount(view);
  const parcels = view?.parcels ?? [];
  return (
    <div className="space-y-3 py-2" data-testid="settlement-all-covered">
      <p className="flex items-center justify-center gap-2 text-center font-medium">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        {t({ ku: "هیچ پارەیەکی ماوە نییە لەم بۆکسە", en: "Nothing outstanding on this box", ar: "لا يوجد مبلغ مستحق على هذا الصندوق", zh: "此箱无未结款项" })}
      </p>
      <p className="text-center text-sm text-muted-foreground">
        {payments > 0
          ? t({ ku: `${payments} پارەدان لەسەر ئەم بۆکسە تۆمار کراوە.`, en: `${payments} payment(s) recorded on this box.`, ar: `تم تسجيل ${payments} دفعة على هذا الصندوق.`, zh: `此箱已记录 ${payments} 笔付款。` })
          : t({ ku: "هیچ پارەدانێک لەسەر ئەم بۆکسە تۆمار نەکراوە. نرخی پاکەتەکان لە حسابی کڕیاردا ڕاستکراوەتەوە یان بەخشراوە، وەک خشتەکەی خوارەوە.", en: "No payment is recorded on this box. The parcels' charges were corrected or forgiven on the customer's account, as the table shows.", ar: "لا توجد دفعة مسجلة على هذا الصندوق. تم تصحيح رسوم الطرود أو إعفاؤها في حساب العميل، كما يوضح الجدول.", zh: "此箱没有付款记录。包裹费用已在客户账户中更正或减免，如下表所示。" })}
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[420px] text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-muted-foreground">
              <th className="p-2 text-start font-medium">{t({ ku: "پاکەت", en: "Parcel", ar: "الطرد", zh: "包裹" })}</th>
              <th className="p-2 text-end font-medium">{t({ ku: "نرخ", en: "Charged", ar: "المبلغ", zh: "计费" })}</th>
              <th className="p-2 text-end font-medium">{t({ ku: "بەخشراو", en: "Forgiven", ar: "معفى", zh: "减免" })}</th>
              <th className="p-2 text-end font-medium">{t({ ku: "دراو", en: "Paid", ar: "مدفوع", zh: "已付" })}</th>
              <th className="p-2 text-end font-medium">{t({ ku: "ماوە", en: "Left", ar: "متبقٍ", zh: "剩余" })}</th>
            </tr>
          </thead>
          <tbody>
            {parcels.map((p) => (
              <tr key={p.lineId} className="border-b last:border-0">
                <td className="p-2 font-mono" dir="ltr">{p.packageCode || p.trackingNumber || `#${p.lineId}`}</td>
                <td className="p-2 text-end font-mono tabular-nums" dir="ltr">{money(p.chargedUsd)}</td>
                <td className="p-2 text-end font-mono tabular-nums" dir="ltr">{money(p.discountedUsd)}</td>
                <td className="p-2 text-end font-mono tabular-nums" dir="ltr">{money(p.settledUsd)}</td>
                <td className="p-2 text-end font-mono tabular-nums" dir="ltr">{money(Math.max(0, p.outstandingUsd))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
