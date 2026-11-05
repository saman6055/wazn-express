/**
 * The hand advance written on the receipt the customer was sent (owner,
 * 2026-11-05: Vian's receipt said 76,000 IQD taken, 721,000 left, and the
 * payment window knew nothing of it). The dinars were already taken in hand,
 * so the money this box receives is that advance and what is paid now -
 * the button puts the advance into the dinar field beside what is typed.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtNumber, fmtUsd } from "@/lib/portalFormat";

export function HandAdvanceNote({ boxId, iqd, onAddIqd }: { boxId: number; iqd: string; onAddIqd: (next: string) => void }) {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  // Once per opening: a second press would take the same dinars twice.
  const [added, setAdded] = useState(false);
  const sent = trpc.deliveryBox.lastReceiptEvent.useQuery({ boxId }, { enabled: boxId > 0, staleTime: 0 });
  const e = sent.data;
  if (!e || !(e.advanceIqd > 0 || e.advanceUsd > 0)) return null;
  const inIqd = e.advanceIqd > 0;
  const typed = Number(String(iqd).replace(/[^\d.]/g, "")) || 0;
  return (
    <div className="mt-3 space-y-1.5 rounded-md border border-violet-300 bg-violet-50/70 p-2.5 text-start text-xs text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100" data-testid="hand-advance-note">
      <div className="flex items-baseline justify-between gap-2 font-semibold">
        <span>{L({ ku: "پێشەکی بە دەست وەرگیراوە", en: "Advance already taken in hand", ar: "مقدمة استُلمت يداً بيد", zh: "已当面收取的预付款" })}</span>
        <bdi dir="ltr" className="font-mono text-sm">{inIqd ? `${fmtNumber(e.advanceIqd, 0)} IQD` : fmtUsd(e.advanceUsd)}</bdi>
      </div>
      <div className="text-violet-800 dark:text-violet-300">
        {L({ ku: "لەسەر وەسڵی", en: "On the receipt of", ar: "على إيصال", zh: "收据日期" })}{" "}
        <bdi dir="ltr">{new Date(e.at).toLocaleDateString("en-GB")}</bdi>
        {e.dueIqd ? <> · {L({ ku: "ماوە لەسەر وەسڵ", en: "left on the paper", ar: "المتبقي على الورقة", zh: "收据余额" })} <bdi dir="ltr" className="font-mono">{fmtNumber(e.dueIqd, 0)} IQD</bdi></> : null}
      </div>
      <div className="text-violet-800 dark:text-violet-300">
        {L({
          ku: "ئەم پارەیە پێشتر وەرگیراوە: لەگەڵ ئەوەی ئێستا دەدرێت بیخەرە ناو «بە دینار».",
          en: "This money was taken already: add it to what is paid now, under «In dinars».",
          ar: "هذا المبلغ استُلم مسبقاً: أضفه إلى ما يُدفع الآن في «بالدينار».",
          zh: "这笔钱已收取：请与现在支付的金额一起填入「第纳尔」。",
        })}
      </div>
      {inIqd && (
        <button
          type="button"
          className="rounded-md bg-violet-600 px-2.5 py-1 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          disabled={added}
          onClick={() => { setAdded(true); onAddIqd(String(typed + e.advanceIqd)); }}
          data-testid="hand-advance-add"
        >
          {L({ ku: "زیادکردنی پێشەکییەکە", en: "Add the advance", ar: "أضف المقدمة", zh: "加入预付款" })}
          {" +"}<bdi dir="ltr" className="font-mono">{fmtNumber(e.advanceIqd, 0)}</bdi>
        </button>
      )}
    </div>
  );
}
