import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import {
  STANDING_REASONS,
  STANDING_REASON_WORDS,
  STANDING_WORDS,
  standingTextFault,
  type Standing,
  type StandingEvent,
  type StandingReason,
} from "@shared/customerStanding";

type Words = { ku: string; en: string; ar: string; zh: string };

const TONE: Record<Standing, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  caution: "text-amber-700 dark:text-amber-400",
  blocked: "text-red-700 dark:text-red-400",
};

const EVENT_WORDS: Record<StandingEvent, Words> = {
  caution: { ku: "تێبینیی ئاگاداری", en: "Caution note", ar: "ملاحظة تنبيه", zh: "提醒" },
  blocked: { ku: "خرایە لیستی ڕەش", en: "Blacklisted", ar: "أُضيف للقائمة السوداء", zh: "已拉黑" },
  cleared: { ku: "لە لیست دەرکرا", en: "Taken off", ar: "أُزيل من القائمة", zh: "已解除" },
};

/**
 * Cautions and the blacklist (owner, 2026-10-07). Find a customer by code,
 * read how they came to be where they are, add a note, block them, or — the
 * main admin only, with the condition written — take them off.
 */
export default function CustomerStanding() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const { user } = useAuth();
  const isMainAdmin = user?.role === "super_admin";
  const isAdmin = isMainAdmin || user?.role === "admin";
  const search = useSearch();
  const fromLink = Number(new URLSearchParams(search).get("customer")) || 0;
  const utils = trpc.useUtils();
  const [code, setCode] = useState("");
  const [asked, setAsked] = useState("");
  const [pickedId, setPickedId] = useState<number>(fromLink);
  const byCode = trpc.ledger.customerStandingByCode.useQuery({ code: asked }, { enabled: asked.length > 0, retry: false });
  const customerId = byCode.data?.customer.id ?? pickedId;
  const one = trpc.ledger.customerStanding.useQuery({ customerId }, { enabled: customerId > 0 });
  const flagged = trpc.ledger.flaggedCustomers.useQuery();
  const data = one.data ?? null;
  const [event, setEvent] = useState<StandingEvent | null>(null);
  const [reason, setReason] = useState<StandingReason | "">("");
  const [text, setText] = useState("");
  const [fault, setFault] = useState("");

  const save = trpc.ledger.setCustomerStanding.useMutation({
    onSuccess: () => {
      void utils.ledger.customerStanding.invalidate();
      void utils.ledger.customerStandingByCode.invalidate();
      void utils.ledger.flaggedCustomers.invalidate();
      setEvent(null);
      setReason("");
      setText("");
      toast.success(L({ ku: "تۆمار کرا", en: "Recorded", ar: "تم التسجيل", zh: "已记录" }));
    },
    onError: (e) => toast.error(e.message, { duration: 15_000 }),
  });

  const submit = () => {
    if (!event || !data) return;
    const f = standingTextFault(event, reason || null, text);
    if (f === "reason") return setFault(L({ ku: "هۆکارێک هەڵبژێرە", en: "Choose a reason", ar: "اختر سبباً", zh: "请选择原因" }));
    if (f === "text") {
      return setFault(event === "cleared"
        ? L({ ku: "بنووسە بە چ مەرجێک دەگەڕێتەوە", en: "Write the condition they come back on", ar: "اكتب شرط العودة", zh: "请写明恢复条件" })
        : L({ ku: "بنووسە چی ڕوویداوە", en: "Write what happened", ar: "اكتب ما حدث", zh: "请写明情况" }));
    }
    setFault("");
    save.mutate({ customerId: data.customerId, event, reason: event === "cleared" ? undefined : reason || undefined, text: text.trim() || undefined });
  };

  const name = byCode.data?.customer.fullName ?? flagged.data?.find((f) => f.customerId === customerId)?.customerName ?? null;
  const shownCode = byCode.data?.customer.customerCode ?? flagged.data?.find((f) => f.customerId === customerId)?.customerCode ?? null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6" data-testid="customer-standing">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><Ban className="h-5 w-5" />{L({ ku: "لیستی ڕەش و ئاگادارییەکان", en: "Blacklist and cautions", ar: "القائمة السوداء والتنبيهات", zh: "黑名单与提醒" })}</h1>
          <p className="text-sm text-muted-foreground">
            {L({
              ku: "تێبینی لەسەر کڕیار بنووسە بۆ ئەوەی حەزەر وەربگیرێت؛ ئەگەر دووبارەی کردەوە، بیخە لیستی ڕەش. کڕیاری لیستی ڕەش هیچ داواکارییەکی نوێی بۆ ناکڕدرێت.",
              en: "Write a note on a customer so care is taken; if it happens again, blacklist them. Nothing new is bought for a blacklisted customer.",
              ar: "اكتب ملاحظة على العميل للحذر؛ وإن تكرر، أضفه للقائمة السوداء. لا يُشترى شيء جديد لعميل في القائمة السوداء.",
              zh: "为客户写提醒以便留意；若再犯则拉黑。不会为黑名单客户购买新货。",
            })}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <Input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AZ018" onKeyDown={(e) => { if (e.key === "Enter") { setPickedId(0); setAsked(code.trim()); } }} data-testid="standing-search" />
          <Button variant="outline" onClick={() => { setPickedId(0); setAsked(code.trim()); }}>{L({ ku: "کڕیارەکە بدۆزەوە", en: "Find the customer", ar: "ابحث عن العميل", zh: "查找客户" })}</Button>
        </div>
        {asked && !byCode.isFetching && byCode.data === null && (
          <p className="text-sm text-red-700 dark:text-red-400">{L({ ku: "کڕیارێک بەم کۆدە نەدۆزرایەوە.", en: "No customer with this code.", ar: "لا يوجد عميل بهذا الرمز.", zh: "没有此编号的客户。" })}</p>
        )}

        {customerId > 0 && (one.isLoading ? <Skeleton className="h-40 w-full" /> : data && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>
                  {name ?? L({ ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}{" "}
                  {shownCode && <span className="text-xs font-normal text-muted-foreground"><bdi dir="ltr">{shownCode}</bdi></span>}
                </span>
                <span className={cn("text-sm", TONE[data.standing])}>{L(STANDING_WORDS[data.standing])}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span>{L({ ku: `${data.cautions} تێبینیی ئاگاداری`, en: `${data.cautions} caution note(s)`, ar: `${data.cautions} تنبيه`, zh: `${data.cautions} 条提醒` })}</span>
                <span>{L({ ku: `${data.refusals} جار کاڵای ڕەت کردۆتەوە`, en: `refused goods ${data.refusals} time(s)`, ar: `رفض البضاعة ${data.refusals} مرة`, zh: `拒收 ${data.refusals} 次` })}</span>
                <Link href={`/finance/customer/${data.customerId}`} className="underline">{L({ ku: "حیسابەکەی", en: "Account", ar: "الحساب", zh: "账户" })}</Link>
              </div>

              {isAdmin && event === null && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEvent("caution"); setFault(""); }}>{L({ ku: "تێبینیی ئاگاداری بنووسە", en: "Write a caution", ar: "اكتب تنبيهاً", zh: "写提醒" })}</Button>
                  {data.standing !== "blocked" && (
                    <Button size="sm" variant="outline" className="text-red-700 dark:text-red-400" onClick={() => { setEvent("blocked"); setFault(""); }}>{L({ ku: "بیخە لیستی ڕەش", en: "Blacklist", ar: "أضف للقائمة السوداء", zh: "拉黑" })}</Button>
                  )}
                  {isMainAdmin && data.standing !== "ok" && (
                    <Button size="sm" variant="ghost" onClick={() => { setEvent("cleared"); setFault(""); }}>
                      {data.standing === "blocked" ? L({ ku: "بە مەرج لە لیستی ڕەش دەری بکە", en: "Take off the blacklist, on a condition", ar: "أزله من القائمة بشرط", zh: "有条件解除拉黑" }) : L({ ku: "ئاگادارییەکە لابە", en: "Clear the caution", ar: "أزل التنبيه", zh: "解除提醒" })}
                    </Button>
                  )}
                </div>
              )}

              {event !== null && (
                <div className="space-y-2 rounded-lg border p-3" data-testid="standing-form">
                  <div className="font-medium">{L(EVENT_WORDS[event])}</div>
                  {event !== "cleared" && (
                    <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={reason} onChange={(e) => { setReason(e.target.value as StandingReason); setFault(""); }}>
                      <option value="">{L({ ku: "هۆکار هەڵبژێرە…", en: "Choose a reason…", ar: "اختر السبب…", zh: "请选择原因…" })}</option>
                      {STANDING_REASONS.map((r) => <option key={r} value={r}>{L(STANDING_REASON_WORDS[r])}</option>)}
                    </select>
                  )}
                  <Input
                    value={text}
                    onChange={(e) => { setText(e.target.value); setFault(""); }}
                    placeholder={event === "cleared"
                      ? L({ ku: "بە چ مەرجێک دەگەڕێتەوە (پێویستە)", en: "The condition they come back on (required)", ar: "شرط العودة (مطلوب)", zh: "恢复条件（必填）" })
                      : L({ ku: "چی ڕوویداوە", en: "What happened", ar: "ماذا حدث", zh: "发生了什么" })}
                  />
                  {event === "blocked" && (
                    <p className="text-red-700 dark:text-red-400">
                      {L({ ku: "دوای ئەمە هیچ داواکارییەکی نوێی بۆ هەڵناگیرێت تا ئادمینی سەرەکی دەری نەکات. وەرگرتنی پارە و تۆمارکردنی پاکەتی گەیشتوو هەر دەکرێت.", en: "After this no new order will save for them until the main admin takes them off. Taking payment and registering an arrived parcel still work.", ar: "بعد هذا لن يُحفظ له طلب جديد حتى يزيله المدير الرئيسي. استلام الدفعات وتسجيل الطرود الواصلة يبقيان متاحين.", zh: "此后无法为其保存新订单，直至主管理员解除。收款与登记已到包裹仍可进行。" })}
                    </p>
                  )}
                  {fault && <p className="text-red-700 dark:text-red-400">{fault}</p>}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEvent(null)}>{L({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}</Button>
                    <Button size="sm" onClick={submit} disabled={save.isPending}>{L({ ku: "تۆماری بکە", en: "Record it", ar: "سجّل", zh: "记录" })}</Button>
                  </div>
                </div>
              )}

              {data.rows.length > 0 && (
                <ul className="divide-y rounded-md border" data-testid="standing-history">
                  {data.rows.map((r) => (
                    <li key={r.id} className="px-3 py-2">
                      <span className={cn("font-medium", r.event === "blocked" ? TONE.blocked : r.event === "caution" ? TONE.caution : TONE.ok)}>{L(EVENT_WORDS[r.event])}</span>
                      {r.reason ? <> · {L(STANDING_REASON_WORDS[r.reason as StandingReason])}</> : null}
                      {r.text ? <span className="block">{r.text}</span> : null}
                      <span className="block text-xs text-muted-foreground"><bdi dir="ltr">{new Date(r.createdAt).toLocaleDateString("en-GB")}</bdi>{r.by ? ` · ${r.by}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{L({ ku: "هەموو ئەوانەی ئاگاداری یان لیستی ڕەشیان لەسەرە", en: "Everyone with a caution or on the blacklist", ar: "كل من عليه تنبيه أو في القائمة السوداء", zh: "所有被提醒或拉黑的客户" })}</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {flagged.isLoading ? <Skeleton className="h-16 w-full" /> : (flagged.data ?? []).length === 0 ? (
              <p className="py-2 text-muted-foreground">{L({ ku: "هیچ کڕیارێک نییە.", en: "Nobody.", ar: "لا أحد.", zh: "暂无。" })}</p>
            ) : (
              <ul className="divide-y">
                {(flagged.data ?? []).map((f) => (
                  <li key={f.customerId}>
                    <button type="button" className={cn("flex w-full flex-wrap items-center justify-between gap-2 px-2 py-2 text-start hover:bg-muted/50", customerId === f.customerId && "bg-muted")} onClick={() => { setAsked(""); setCode(""); setPickedId(f.customerId); setEvent(null); }}>
                      <span className="min-w-0">
                        <span className="font-medium">{f.customerName ?? f.customerCode}</span>{" "}
                        <span className="text-xs text-muted-foreground"><bdi dir="ltr">{f.customerCode}</bdi></span>
                        <span className="block text-xs text-muted-foreground">
                          {f.last.reason ? L(STANDING_REASON_WORDS[f.last.reason as StandingReason]) : ""}{f.last.text ? ` — ${f.last.text}` : ""}
                        </span>
                      </span>
                      <span className={cn("shrink-0 text-xs font-medium", TONE[f.standing])}>{L(STANDING_WORDS[f.standing])}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
