/**
 * Every figure on the debt card, peeled.
 *
 * The owner, 2026-10-10, on the card «ئەم قەرزە بۆ چییە؟»: «بەشە گرنگەکە
 * ئێرەیە - کلیکم لە هەرچی ئێرە کرد دیتێلی زۆر تەواو و دەقیق، هەر ژمارەیەک
 * ویستم وەکو پیاز سپی بکات بۆم، بزانم چۆن چۆنییە».
 *
 * So a press on any figure opens the lines it was added up from, and those
 * lines are rows of the customer's own account (shared/boxPaidStillOwed:
 * chargeStory, accountSums). Under each list stands what the lines come to,
 * beside the figure that was pressed: the same cent, or a line saying by how
 * much they differ. Nothing here works an amount out for itself.
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/portalFormat";
import { fmtWhen } from "@/lib/numericDate";
import { CopyButton } from "@/components/CopyButton";
import { parcelListHref } from "@shared/parcelSource";
import { storyTotal, type AccountSums, type StoryLine } from "@shared/boxPaidStillOwed";

type Words = { ku: string; en: string; ar: string; zh: string };

/** The ledger table on the account page: where "every line" leads. */
export const ACCOUNT_LINES_ANCHOR = "account-lines";

export interface DoubleLine {
  tracking: string;
  boxCode: string | null;
  boxId: number | null;
  boxChargeUsd: number;
  boxChargedAt: string | null;
  orderCharges: Array<{ id: number; usd: number; description: string; orderCode: string | null }>;
  orderChargedUsd: number;
  twiceUsd: number;
}

const KIND: Record<StoryLine["kind"], Words> = {
  charge: { ku: "نووسرا", en: "Charged", ar: "قُيّد", zh: "记账" },
  raised: { ku: "زیاد کرا", en: "Raised", ar: "زِيد", zh: "调增" },
  takenOff: { ku: "کەم کرایەوە", en: "Taken off", ar: "خُصم", zh: "调减" },
};

const same = (a: number, b: number) => Math.abs(a - b) < 0.005;
const signed = (usd: number) => (usd < 0 ? `−${fmtUsd(Math.abs(usd))}` : fmtUsd(usd));

/** A row of the card that opens: the figure on it is what the panel under it explains. */
export function PeelRow({
  open,
  onToggle,
  label,
  amount,
  tone,
  testId,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: ReactNode;
  amount: ReactNode;
  tone?: "plain" | "strong" | "red" | "muted";
  testId: string;
  children: ReactNode;
}) {
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <div className={cn(tone === "red" && "bg-red-50 dark:bg-red-950/30")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-start transition-colors hover:bg-muted/50"
        data-testid={testId}
      >
        <span className={cn("inline-flex items-center gap-2", tone === "strong" && "font-medium", tone === "muted" && "text-muted-foreground", tone === "red" && "text-red-700 dark:text-red-300")}>
          <Chevron className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
          {label}
        </span>
        <span className={cn("whitespace-nowrap", tone === "strong" || tone === "red" ? "font-semibold" : "font-medium", tone === "red" && "text-red-700 dark:text-red-300")} dir="ltr">
          {amount}
        </span>
      </button>
      {open && <div className="border-t bg-background/60 px-3 py-3" data-testid={`${testId}-panel`}>{children}</div>}
    </div>
  );
}

/** One line of a sum: what it is, and what it adds or takes off. */
function SumLine({ label, usd, minus, strong, hint }: { label: ReactNode; usd: number; minus?: boolean; strong?: boolean; hint?: ReactNode }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1 text-sm", strong && "border-t pt-2 font-semibold")}>
      <span className="min-w-0">
        {label}
        {hint && <span className="ms-2 text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className={cn("whitespace-nowrap tabular-nums", minus && "text-emerald-700 dark:text-emerald-300")} dir="ltr">
        {minus ? `−${fmtUsd(usd)}` : fmtUsd(usd)}
      </span>
    </div>
  );
}

/** Said under a list whose lines do not come to the figure above them. */
function Mismatch({ linesUsd, figureUsd }: { linesUsd: number; figureUsd: number }) {
  const { language } = useTranslation();
  if (same(linesUsd, figureUsd)) return null;
  return (
    <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" data-testid="peel-mismatch">
      {pickLang(language, {
        ku: `دێڕەکان ${fmtUsd(linesUsd)} دەکەن و ژمارەکەی سەرەوە ${fmtUsd(figureUsd)} ـە — جیاوازی ${fmtUsd(Math.abs(linesUsd - figureUsd))}. پێویستی بە سەیرکردنە.`,
        en: `The lines come to ${fmtUsd(linesUsd)} and the figure above is ${fmtUsd(figureUsd)} — a difference of ${fmtUsd(Math.abs(linesUsd - figureUsd))}. It needs a look.`,
        ar: `مجموع السطور ${fmtUsd(linesUsd)} والرقم أعلاه ${fmtUsd(figureUsd)} — الفرق ${fmtUsd(Math.abs(linesUsd - figureUsd))}. يحتاج مراجعة.`,
        zh: `各行合计 ${fmtUsd(linesUsd)}，上方数字为 ${fmtUsd(figureUsd)} — 相差 ${fmtUsd(Math.abs(linesUsd - figureUsd))}。需要查看。`,
      })}
    </p>
  );
}

/** How one owed thing came to its amount: its rows on the account, in order. */
export function StoryLines({ lines, figureUsd }: { lines: StoryLine[]; figureUsd: number }) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const total = storyTotal(lines);
  return (
    <div className="mt-2 rounded-lg border bg-background/70 p-2" data-testid="story-lines">
      <ul className="divide-y">
        {lines.map((line) => (
          <li key={line.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 py-1.5 text-xs">
            <span className="min-w-0 flex-1">
              <span className="me-2 inline-flex rounded bg-muted px-1.5 py-0.5 font-medium">{L(KIND[line.kind])}</span>
              <span className="text-muted-foreground"><bdi dir="ltr">{fmtWhen(line.at, true)}</bdi></span>
              <span className="mx-2 inline-flex items-center gap-1 text-muted-foreground">
                <bdi dir="ltr" className="font-mono">{line.transactionNumber}</bdi>
                <CopyButton value={line.transactionNumber} />
              </span>
              <span className="block break-words pt-0.5 text-foreground/90">{line.description}</span>
            </span>
            <span className={cn("whitespace-nowrap font-medium tabular-nums", line.usd < 0 && "text-emerald-700 dark:text-emerald-300")} dir="ltr">
              {signed(line.usd)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-1.5 text-xs font-semibold">
        <span>{L({ ku: "کۆی ئەم دێڕانە", en: "These lines come to", ar: "مجموع هذه السطور", zh: "以上合计" })}</span>
        <span className="whitespace-nowrap tabular-nums" dir="ltr">{fmtUsd(Math.max(0, total))}</span>
      </div>
      <Mismatch linesUsd={Math.max(0, total)} figureUsd={figureUsd} />
    </div>
  );
}

/** "Really owed": the four places goods can be, less what was paid without a receipt. */
export function OwedSumPanel({
  parts,
  paidOnAccountUsd,
  stillOwedUsd,
  onPick,
}: {
  parts: Array<{ key: string; label: string; usd: number; count: number }>;
  paidOnAccountUsd: number;
  stillOwedUsd: number;
  onPick: (key: string) => void;
}) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const open = parts.reduce((s, p) => s + Math.round(p.usd * 100), 0) / 100;
  const lines = Math.max(0, Math.round((open - paidOnAccountUsd) * 100) / 100);
  return (
    <div data-testid="owed-sum">
      {parts.map((p) => (
        <button
          key={p.key}
          type="button"
          disabled={p.count === 0}
          onClick={() => onPick(p.key)}
          className={cn("flex w-full items-baseline justify-between gap-3 py-1 text-start text-sm", p.count > 0 ? "hover:underline" : "opacity-50")}
        >
          <span>
            {p.label}
            <span className="ms-2 text-xs text-muted-foreground">{p.count}</span>
          </span>
          <span className="whitespace-nowrap tabular-nums" dir="ltr">{fmtUsd(p.usd)}</span>
        </button>
      ))}
      {paidOnAccountUsd > 0.005 && (
        <SumLine minus usd={paidOnAccountUsd} label={L({ ku: "پارەی دراو بێ واسڵی بۆکس", en: "Paid without a box receipt", ar: "مدفوع بدون وصل صندوق", zh: "无箱收据的付款" })} />
      )}
      <SumLine strong usd={lines} label={L({ ku: "قەرزی ڕاستەقینە", en: "Really owed", ar: "الدين الحقيقي", zh: "实际欠款" })} />
      <Mismatch linesUsd={lines} figureUsd={stillOwedUsd} />
      <p className="mt-2 text-xs text-muted-foreground">
        {L({
          ku: "کلیک لە هەر بەشێک بکە تا شتەکانی ناوی ببینیت؛ لە هەر شتێکیش «چۆن ئەم بڕەیە؟» دێڕەکانی حیسابەکەی نیشان دەدات.",
          en: "Press a part to see what is in it; on each thing, «How is it this amount?» shows its rows on the account.",
          ar: "اضغط على أي جزء لترى ما فيه؛ وعلى كل عنصر «كيف هذا المبلغ؟» يعرض سطوره في الحساب.",
          zh: "点击任一部分查看其中的货物；每件货物的「金额怎么来的？」会显示它在账户上的各行。",
        })}
      </p>
    </div>
  );
}

/** "Written twice": each tracking that stands on the account through its order AND through its box. */
export function DoublePanel({ lines, twiceUsd, falseDebtUsd }: { lines: DoubleLine[]; twiceUsd: number; falseDebtUsd: number }) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  return (
    <div data-testid="double-lines">
      <p className="mb-2 text-xs text-muted-foreground">
        {L({
          ku: "هەر تراکینگێکی خوارەوە دووجار لەسەر حیسابەکە نووسراوە: جارێک وەک ئۆردەر، جارێک لە بۆکسەکەیدا. بۆکسەکە واسڵ کراوە و پارەکەی وەرگیراوە؛ دێڕی ئۆردەرەکە بە قەرز ماوەتەوە.",
          en: "Each tracking below stands on the account twice: once as its order, once in its box. The box was receipted and paid; the order's line stayed as a debt.",
          ar: "كل رقم تتبع أدناه مقيّد في الحساب مرتين: مرة كطلب ومرة في صندوقه. الصندوق استُلم ثمنه؛ وبقي سطر الطلب ديناً.",
          zh: "下列每个运单在账户上记了两次：一次作为订单，一次在箱子里。箱子已收款；订单那一行仍作为欠款留着。",
        })}
      </p>
      <ul className="divide-y rounded-lg border">
        {lines.map((line) => (
          <li key={`${line.tracking}-${line.boxCode ?? ""}`} className="space-y-1 p-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1">
                <Link href={parcelListHref(line.tracking)} className="font-mono underline decoration-dotted underline-offset-2">
                  <bdi dir="ltr">{line.tracking}</bdi>
                </Link>
                <CopyButton value={line.tracking} />
              </span>
              <span className="whitespace-nowrap font-semibold text-red-700 dark:text-red-300" dir="ltr">{fmtUsd(line.twiceUsd)}</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-muted-foreground">
              <span>
                {L({ ku: "لە بۆکسدا نووسرا و دراوە", en: "Charged in the box, and paid", ar: "قُيّد في الصندوق ودُفع", zh: "在箱中记账并已付" })}
                {line.boxCode && (
                  <span className="ms-2 inline-flex items-center gap-1">
                    {line.boxId != null ? (
                      <Link href={`/customer-delivery-scanner?box=${line.boxId}`} className="font-mono underline decoration-dotted underline-offset-2"><bdi dir="ltr">{line.boxCode}</bdi></Link>
                    ) : (
                      <bdi dir="ltr" className="font-mono">{line.boxCode}</bdi>
                    )}
                    <CopyButton value={line.boxCode} />
                  </span>
                )}
                <bdi dir="ltr" className="ms-2">{fmtWhen(line.boxChargedAt)}</bdi>
              </span>
              <span className="whitespace-nowrap tabular-nums" dir="ltr">{fmtUsd(line.boxChargeUsd)}</span>
            </div>
            {line.orderCharges.map((c) => (
              <div key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 text-muted-foreground">
                <span className="min-w-0 break-words">
                  {L({ ku: "وەک ئۆردەر نووسرا — بە قەرز ماوە", en: "Charged as an order — left as debt", ar: "قُيّد كطلب — بقي ديناً", zh: "作为订单记账 — 仍为欠款" })}
                  {c.orderCode && <bdi dir="ltr" className="ms-2 font-mono">{c.orderCode}</bdi>}
                  <span className="block text-foreground/80">{c.description}</span>
                </span>
                <span className="whitespace-nowrap tabular-nums" dir="ltr">{fmtUsd(c.usd)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
      <SumLine strong usd={twiceUsd} label={L({ ku: "کۆی ئەوەی دووجار نووسراوە", en: "Written twice, in all", ar: "إجمالي ما قُيّد مرتين", zh: "重复记账合计" })} />
      {!same(twiceUsd, falseDebtUsd) && (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="double-capped">
          {L({
            ku: `لەم بڕە تەنها ${fmtUsd(falseDebtUsd)} لە باڵانسەکەدا بە قەرز دیارە. ئەوی تر پێشتر بە دەست ڕاست کراوەتەوە یان پارەی تر دایپۆشیوە، بۆیە لە باڵانس کەم ناکرێتەوە.`,
            en: `Of this, only ${fmtUsd(falseDebtUsd)} shows as debt in the balance. The rest was already put right by hand or covered by other money, so it is not taken off the balance.`,
            ar: `من هذا المبلغ يظهر ${fmtUsd(falseDebtUsd)} فقط كدين في الرصيد. الباقي صُحّح يدوياً سابقاً أو غطّته مبالغ أخرى، فلا يُخصم من الرصيد.`,
            zh: `其中只有 ${fmtUsd(falseDebtUsd)} 在余额中显示为欠款。其余部分已手工更正或被其他款项覆盖，因此不会从余额中扣除。`,
          })}
        </p>
      )}
      <Link href="/finance/box-double-charges" className="mt-2 inline-block text-xs underline">
        {L({ ku: "بەڵگە و ڕاستکردنەوە", en: "Proof and correction", ar: "الدليل والتصحيح", zh: "凭据与更正" })}
      </Link>
    </div>
  );
}

/** "What the account shows": the whole account in five sums, then the split of the balance. */
export function AccountSumsPanel({
  sums,
  balanceUsd,
  stillOwedUsd,
  falseDebtUsd,
  unexplainedUsd,
}: {
  sums: AccountSums;
  balanceUsd: number;
  stillOwedUsd: number;
  falseDebtUsd: number;
  unexplainedUsd: number;
}) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const rowsWord = (n: number) => L({ ku: `${n} دێڕ`, en: `${n} rows`, ar: `${n} سطر`, zh: `${n} 行` });
  return (
    <div data-testid="account-sums">
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {L({ ku: "لە دێڕەکانی حیسابەکەوە", en: "From the rows of the account", ar: "من سطور الحساب", zh: "来自账户各行" })}
      </p>
      <SumLine usd={sums.chargedUsd} hint={rowsWord(sums.chargedCount)} label={L({ ku: "هەموو ئەوەی لەسەری نووسراوە", en: "Everything charged", ar: "كل ما قُيّد عليه", zh: "全部记账" })} />
      {sums.raisedUsd > 0.005 && <SumLine usd={sums.raisedUsd} label={L({ ku: "دواتر زیاد کراوە", en: "Raised afterwards", ar: "زِيد لاحقاً", zh: "之后调增" })} />}
      {sums.takenOffUsd > 0.005 && <SumLine minus usd={sums.takenOffUsd} label={L({ ku: "دواتر کەم کراوەتەوە (ڕاستکردنەوە و گەڕاندنەوە)", en: "Taken off afterwards (corrections)", ar: "خُصم لاحقاً (تصحيحات)", zh: "之后调减（更正）" })} />}
      <SumLine minus usd={sums.paidUsd} hint={rowsWord(sums.paidCount)} label={L({ ku: "هەموو ئەوەی داویەتی", en: "Everything paid", ar: "كل ما دفعه", zh: "全部付款" })} />
      {sums.otherCreditUsd > 0.005 && <SumLine minus usd={sums.otherCreditUsd} label={L({ ku: "داشکاندن و هی تر", en: "Discounts and other credits", ar: "خصومات وغيرها", zh: "折扣及其他" })} />}
      <SumLine strong usd={sums.computedUsd} label={L({ ku: "دەمێنێتەوە", en: "Leaves", ar: "يبقى", zh: "余额" })} />
      <Mismatch linesUsd={sums.computedUsd} figureUsd={balanceUsd} />

      <p className="mb-1 mt-3 text-xs font-medium text-muted-foreground">
        {L({ ku: "ئەو باڵانسە لە چی پێکهاتووە", en: "What that balance is made of", ar: "ممّ يتكوّن هذا الرصيد", zh: "该余额的构成" })}
      </p>
      <SumLine usd={stillOwedUsd} label={L({ ku: "قەرزی ڕاستەقینە", en: "Really owed", ar: "الدين الحقيقي", zh: "实际欠款" })} />
      {falseDebtUsd > 0.005 && <SumLine usd={falseDebtUsd} label={L({ ku: "دووجار نووسراوە — قەرز نییە", en: "Written twice — not owed", ar: "مكتوب مرتين — ليس ديناً", zh: "重复记账 — 非欠款" })} />}
      {Math.abs(unexplainedUsd) > 0.005 && <SumLine usd={unexplainedUsd} label={L({ ku: "ڕوون نەبووەتەوە", en: "Not explained", ar: "غير مفسَّر", zh: "未能解释" })} />}
      <SumLine strong usd={Math.round((stillOwedUsd + falseDebtUsd + unexplainedUsd) * 100) / 100} label={L({ ku: "ئەوەی سیستەم نیشانی دەدات", en: "What the account shows", ar: "ما يظهره الحساب", zh: "账户显示" })} />

      <button
        type="button"
        className="mt-2 text-xs underline"
        onClick={() => document.getElementById(ACCOUNT_LINES_ANCHOR)?.scrollIntoView({ block: "start" })}
        data-testid="account-lines-link"
      >
        {L({ ku: `هەموو ${sums.rows} دێڕەکەی حیساب ببینە`, en: `See all ${sums.rows} rows of the account`, ar: `عرض كل سطور الحساب (${sums.rows})`, zh: `查看账户全部 ${sums.rows} 行` })}
      </button>
    </div>
  );
}
