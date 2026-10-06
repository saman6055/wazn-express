import { useEffect, useState } from "react";
import { Banknote, Check, ChevronLeft, ChevronRight, Loader2, Package, PencilLine, Percent, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/portalFormat";
import { fmtDateTime } from "@/lib/numericDate";
import { CopyButton } from "@/components/CopyButton";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  MONEY_KIND_LABEL, moneyLineHref, unseenCredit, unseenMovements, unseenRestated, type MoneyKind,
} from "@shared/moneyFeed";
import { customerCodeOnly } from "@shared/customerCode";

type Words = { ku: string; en: string; ar: string; zh: string };

/** Per person, per browser: the newest movement they had seen. */
const seenKey = (userId: number) => `wazn-money-bell-seen:${userId}`;
/** The same, for charges put right in place - they are numbered by their own records. */
const seenRestatedKey = (userId: number) => `wazn-money-bell-restated-seen:${userId}`;

function readSeen(userId: number, key: (userId: number) => string = seenKey): number {
  if (!userId) return 0;
  try {
    return Number(localStorage.getItem(key(userId)) || 0) || 0;
  } catch {
    return 0;
  }
}

/** How many of the newest lines the bell lists. The page behind it has all. */
const SHOWN = 40;

/**
 * Between what a charge was and what it is now. The pair sits in a
 * left-to-right island (<bdi dir="ltr">), so the arrow points the way the
 * figures are read in every language.
 */
const RESTATED_ARROW = "→";

/**
 * The record's note opens by naming the parcel, which the line above it
 * already does. What is left is the part worth reading: what was changed.
 */
const whatChanged = (note: string): string => {
  const cut = note.indexOf(" — ");
  return cut === -1 ? note : note.slice(cut + 3);
};

/**
 * The money side of the bell, for the main admin.
 *
 * Owner, 2026-10-02: every movement of money notifies him, with a link to
 * where it happened; and an extra somebody was handed waits here for his
 * yes before it reaches the customer's account (shared/creditGuard,
 * shared/moneyFeed).
 *
 * The hook is kept apart from the list so the bell can count and flash
 * before it is opened. Nobody but the main admin asks the server anything.
 */
export function useMoneyBell(userId: number, role: string) {
  const enabled = userId > 0 && role === "super_admin";
  const [seenId, setSeenId] = useState(() => readSeen(userId));
  /** What was new when the bell was opened — kept while it stays open. */
  const [newSince, setNewSince] = useState<number | null>(null);
  const [seenRestatedId, setSeenRestatedId] = useState(() => readSeen(userId, seenRestatedKey));
  const [newRestatedSince, setNewRestatedSince] = useState<number | null>(null);
  useEffect(() => {
    setSeenId(readSeen(userId));
    setSeenRestatedId(readSeen(userId, seenRestatedKey));
  }, [userId]);

  const feedQ = trpc.ledger.moneyFeed.useQuery(undefined, {
    enabled,
    staleTime: 20_000,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const pendingQ = trpc.ledger.pendingCredits.useQuery(undefined, {
    enabled,
    staleTime: 20_000,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const lines = feedQ.data?.lines ?? [];
  const restated = feedQ.data?.restated ?? [];
  const pending = pendingQ.data ?? [];
  const unseen = unseenMovements(lines, seenId) + unseenRestated(restated, seenRestatedId);

  return {
    enabled,
    lines,
    /** Charges put right in place: they leave no movement, so they are listed on their own. */
    restated,
    pending,
    /** What the badge adds: things waiting for him, and movements not yet looked at. */
    count: enabled ? pending.length + unseen : 0,
    /** Red and ringing: something waits for his yes, or a credit was made. */
    urgent: enabled && (pending.length > 0 || unseenCredit(lines, seenId)),
    /** Lines newer than this are marked new in the open list. */
    newSince: newSince ?? seenId,
    newRestatedSince: newRestatedSince ?? seenRestatedId,
    onOpen: () => {
      setNewRestatedSince(seenRestatedId);
      const newestRestated = feedQ.data?.newestRestatedId ?? 0;
      if (newestRestated > seenRestatedId) {
        setSeenRestatedId(newestRestated);
        try {
          localStorage.setItem(seenRestatedKey(userId), String(newestRestated));
        } catch {
          // Storage refused: they show as new again next time — the safe side.
        }
      }
      setNewSince(seenId);
      const newest = feedQ.data?.newestId ?? 0;
      if (newest > seenId) {
        setSeenId(newest);
        try {
          localStorage.setItem(seenKey(userId), String(newest));
        } catch {
          // Storage refused: they show as new again next time — the safe side.
        }
      }
    },
    onClose: () => {
      setNewSince(null);
      setNewRestatedSince(null);
    },
    refetch: () => {
      void feedQ.refetch();
      void pendingQ.refetch();
    },
  };
}

export type MoneyBellState = ReturnType<typeof useMoneyBell>;

const KIND_ICON: Record<MoneyKind, typeof Banknote> = {
  payment: Banknote,
  refund: Banknote,
  charge: Package,
  discount: Percent,
  correction_down: PencilLine,
  correction_up: PencilLine,
  hand_down: PencilLine,
  hand_up: PencilLine,
};

/** Amber: a person changed a figure by hand, lowered a price, or cancelled. */
const BY_DECISION: readonly MoneyKind[] = ["hand_down", "hand_up", "correction_down", "discount", "refund"];

export function MoneyBellSection({
  money,
  language,
  onNavigate,
}: {
  money: MoneyBellState;
  language: string;
  onNavigate: (href: string) => void;
}) {
  const L = (w: Words) => pickLang(language, w);
  const isRTL = language === "ku" || language === "ar";
  const Arrow = isRTL ? ChevronLeft : ChevronRight;
  const utils = trpc.useUtils();

  const decide = trpc.ledger.decidePendingCredit.useMutation({
    onSuccess: (decision) => {
      toast.success(
        decision.status === "approved"
          ? L({ ku: `پەسەند کرا — ${fmtUsd(decision.amountUsd)} چووە سەر حیسابی کڕیار`, en: `Approved — ${fmtUsd(decision.amountUsd)} is on the customer's account`, ar: `تمت الموافقة — ${fmtUsd(decision.amountUsd)} على حساب العميل`, zh: `已批准——${fmtUsd(decision.amountUsd)} 已记入客户账户` })
          : L({ ku: "ڕەت کرایەوە — هیچ شتێک نەچووە سەر حیساب", en: "Refused — nothing was posted", ar: "رُفض — لم يُقيَّد شيء", zh: "已拒绝——未入账" }),
      );
      money.refetch();
      void utils.ledger.invalidate();
    },
    onError: (err) => toast.error(err.message, { duration: 20000 }),
  });

  const answer = async (id: number, approve: boolean, code: string, amountUsd: number) => {
    const yes = await confirmAction({
      title: approve
        ? L({ ku: "پەسەندکردنی پارەی زیادە", en: "Approve the extra", ar: "الموافقة على المبلغ الزائد", zh: "批准多付款项" })
        : L({ ku: "ڕەتکردنەوەی پارەی زیادە", en: "Refuse the extra", ar: "رفض المبلغ الزائد", zh: "拒绝多付款项" }),
      message: approve
        ? L({
            ku: `${fmtUsd(amountUsd)} دەبێتە کریدیت لەسەر حیسابی ${code}. واتە وەزن ئەم بڕە قەرزاری کڕیار دەبێت.`,
            en: `${fmtUsd(amountUsd)} becomes credit on ${code}'s account — Wazn will owe the customer this amount.`,
            ar: `${fmtUsd(amountUsd)} يصبح رصيداً على حساب ${code} — أي أن وزن مدينة للعميل بهذا المبلغ.`,
            zh: `${fmtUsd(amountUsd)} 将成为 ${code} 账户上的余额——即我方欠客户该金额。`,
          })
        : L({
            ku: `${fmtUsd(amountUsd)} ناچێتە سەر حیسابی ${code}. ئەگەر پارەکە بەڕاستی وەرگیراوە، دەبێت بدرێتەوە بە کڕیار.`,
            en: `${fmtUsd(amountUsd)} will not go on ${code}'s account. If the money really was taken, it must be handed back to the customer.`,
            ar: `${fmtUsd(amountUsd)} لن يُقيَّد على حساب ${code}. إن كان المبلغ قد استُلم فعلاً فيجب إعادته للعميل.`,
            zh: `${fmtUsd(amountUsd)} 不会记入 ${code} 的账户。如果确实收了这笔钱，必须退还客户。`,
          }),
      confirmLabel: approve
        ? L({ ku: "بەڵێ، پەسەندی بکە", en: "Yes, approve", ar: "نعم، وافق", zh: "是，批准" })
        : L({ ku: "بەڵێ، ڕەتی بکەرەوە", en: "Yes, refuse", ar: "نعم، ارفض", zh: "是，拒绝" }),
      danger: !approve,
    });
    if (yes) decide.mutate({ id, approve });
  };

  if (!money.enabled) return null;
  const shown = money.lines.slice(0, SHOWN);

  return (
    <>
      {money.pending.length > 0 && (
        <section data-testid="money-bell-pending">
          <p className="bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-700 dark:text-red-300">
            {L({ ku: "چاوەڕێی پەسەندکردنی تۆ", en: "Waiting for your yes", ar: "بانتظار موافقتك", zh: "等待您的批准" })}
          </p>
          <ul className="divide-y">
            {money.pending.map((p) => {
              const code = customerCodeOnly(p.customerCode);
              return (
                <li key={p.id} className="space-y-1.5 px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {L({ ku: "پارەی زیادە", en: "Extra handed over", ar: "مبلغ زائد", zh: "多付款项" })}{" "}
                      <bdi dir="ltr" className="font-mono text-red-600 dark:text-red-400">{fmtUsd(p.amountUsd)}</bdi>
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        className="font-mono text-xs text-primary hover:underline"
                        onClick={() => onNavigate(p.boxId ? `/customer-delivery-scanner?box=${p.boxId}` : `/finance/customer/${p.customerId}`)}
                      >
                        <bdi dir="ltr">{code}</bdi>
                      </button>
                      <CopyButton value={code} />
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {p.boxCode && <><bdi dir="ltr" className="font-mono">{p.boxCode}</bdi> · </>}
                    {p.requestedByName} · <bdi dir="ltr">{fmtDateTime(new Date(p.createdAt))}</bdi>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={decide.isPending}
                      onClick={() => void answer(p.id, true, code, p.amountUsd)}
                      className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      data-testid="pending-credit-approve"
                    >
                      {decide.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      {L({ ku: "پەسەند", en: "Approve", ar: "موافقة", zh: "批准" })}
                    </button>
                    <button
                      type="button"
                      disabled={decide.isPending}
                      onClick={() => void answer(p.id, false, code, p.amountUsd)}
                      className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md border text-xs font-semibold hover:bg-muted disabled:opacity-60"
                      data-testid="pending-credit-reject"
                    >
                      <X className="h-3.5 w-3.5" />
                      {L({ ku: "ڕەتکردنەوە", en: "Refuse", ar: "رفض", zh: "拒绝" })}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {money.restated.length > 0 && (
        <section data-testid="money-bell-restated">
          <p className="bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            {L({ ku: "نرخی پاکەت ڕاست کرایەوە", en: "Parcel price put right", ar: "صُحّح سعر طرد", zh: "包裹价格已更正" })}
          </p>
          <ul className="divide-y">
            {money.restated.map((line) => {
              const credit = line.creditCreatedUsd > 0.005;
              const isNew = line.id > money.newRestatedSince;
              const code = customerCodeOnly(line.customerCode);
              return (
                <li key={line.id} className={cn("relative", credit ? "bg-red-500/10" : line.direction < 0 && "bg-amber-500/10")}>
                  <div className="flex items-start gap-2 px-3 py-2">
                    <PencilLine className={cn("mt-0.5 h-4 w-4 shrink-0", credit ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1">
                          <bdi dir="ltr" className="truncate font-mono text-sm font-medium">{line.subject}</bdi>
                          {line.subject && <CopyButton value={line.subject} />}
                        </span>
                        <bdi dir="ltr" className={cn("shrink-0 font-mono text-sm", line.direction > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                          {fmtUsd(line.wasUsd)} {RESTATED_ARROW} {fmtUsd(line.nowUsd)}
                        </bdi>
                      </span>
                      {credit && (
                        <span className="mt-0.5 block text-[11px] font-semibold text-red-700 dark:text-red-300">
                          {L({ ku: "کریدیت دروست بوو", en: "Credit made", ar: "نشأ رصيد دائن", zh: "产生贷方余额" })}: <bdi dir="ltr">{fmtUsd(line.creditCreatedUsd)}</bdi>
                        </span>
                      )}
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] text-muted-foreground">
                        <button
                          type="button"
                          className="font-mono text-primary hover:underline"
                          onClick={() => onNavigate(moneyLineHref({ kind: "correction_down", customerId: line.customerId }))}
                          data-testid="restated-open-account"
                        >
                          <bdi dir="ltr">{code}</bdi>
                        </button>
                        {code && <CopyButton value={code} />}
                        {line.balanceAfterUsd !== null && (
                          <span>
                            {" · "}
                            {L({ ku: "باڵانس", en: "balance", ar: "الرصيد", zh: "余额" })}{" "}
                            <bdi dir="ltr">{line.balanceAfterUsd < 0 ? "−" : ""}{fmtUsd(Math.abs(line.balanceAfterUsd))}</bdi>
                          </span>
                        )}
                      </span>
                      {line.note && <span className="mt-0.5 block text-[11px] text-muted-foreground">{whatChanged(line.note)}</span>}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {line.byName} · <bdi dir="ltr">{fmtDateTime(new Date(line.at))}</bdi>
                      </span>
                    </span>
                    {isNew && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label={L({ ku: "نوێ", en: "new", ar: "جديد", zh: "新" })} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {shown.length > 0 && (
        <section data-testid="money-bell-feed">
          <p className="bg-muted/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            {L({ ku: "جوڵەکانی پارە", en: "Money movements", ar: "حركات المال", zh: "资金变动" })}
          </p>
          <ul className="divide-y">
            {shown.map((line) => {
              const Icon = KIND_ICON[line.kind];
              const credit = line.creditCreatedUsd > 0.005;
              const amber = !credit && BY_DECISION.includes(line.kind);
              const isNew = line.id > money.newSince;
              const code = customerCodeOnly(line.customerCode);
              return (
                <li key={line.id} className={cn("relative", credit && "bg-red-500/10", amber && "bg-amber-500/10")}>
                  <button
                    type="button"
                    onClick={() => onNavigate(moneyLineHref(line))}
                    className="flex w-full items-start gap-2 px-3 py-2 text-start transition hover:bg-muted"
                  >
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", credit ? "text-red-600 dark:text-red-400" : amber ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("text-sm font-medium leading-snug", credit && "text-red-700 dark:text-red-300")}>
                          {credit
                            ? <>{L({ ku: "کریدیت دروست بوو", en: "Credit made", ar: "نشأ رصيد دائن", zh: "产生贷方余额" })}: <bdi dir="ltr">{fmtUsd(line.creditCreatedUsd)}</bdi></>
                            : <>{L(MONEY_KIND_LABEL[line.kind])}{line.count > 1 && <> · <bdi dir="ltr">{line.count}</bdi></>}</>}
                        </span>
                        <bdi dir="ltr" className={cn("shrink-0 font-mono text-sm", line.direction > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                          {line.direction > 0 ? "+" : "−"}{fmtUsd(line.amountUsd)}
                        </bdi>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {credit && <>{L(MONEY_KIND_LABEL[line.kind])} · </>}
                        <bdi dir="ltr" className="font-mono">{code}</bdi>
                        {line.boxCode && <> · <bdi dir="ltr" className="font-mono">{line.boxCode}</bdi></>}
                        {" · "}
                        {L({ ku: "باڵانس", en: "balance", ar: "الرصيد", zh: "余额" })}{" "}
                        <bdi dir="ltr">{line.balanceAfterUsd < 0 ? "−" : ""}{fmtUsd(Math.abs(line.balanceAfterUsd))}</bdi>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {line.byName} · <bdi dir="ltr">{fmtDateTime(new Date(line.at))}</bdi>
                      </span>
                    </span>
                    {isNew && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label={L({ ku: "نوێ", en: "new", ar: "جديد", zh: "新" })} />}
                    <Arrow className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
