import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

/**
 * The nightly copy of the accounts by email (owner, 2026-11-06, point 41.4):
 * the address, a "send now" to try it, and how the last one went.
 */
export function NightlyMailCard() {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const utils = trpc.useUtils();
  const { data } = trpc.ledger.nightlyMail.useQuery(undefined, { retry: false });
  const [to, setTo] = useState("");
  useEffect(() => { if (data?.to) setTo(data.to); }, [data?.to]);
  const save = trpc.ledger.setNightlyMail.useMutation({
    onSuccess: () => { void utils.ledger.nightlyMail.invalidate(); toast.success(L({ ku: "پاشەکەوت کرا", en: "Saved", ar: "تم الحفظ", zh: "已保存" })); },
    onError: (e) => toast.error(e.message),
  });
  const send = trpc.ledger.sendNightlyMailNow.useMutation({
    onSuccess: (r) => { void utils.ledger.nightlyMail.invalidate(); if (r.lastError) toast.error(r.lastError); else toast.success(L({ ku: "نێردرا", en: "Sent", ar: "تم الإرسال", zh: "已发送" })); },
    onError: (e) => toast.error(e.message),
  });
  if (!data) return null;
  return (
    <Card data-testid="nightly-mail">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{L({ ku: "کۆپیی شەوانەی حیسابات بۆ ئیمەیڵ", en: "Nightly copy of the accounts by email", ar: "نسخة ليلية من الحسابات بالبريد", zh: "每晚账目副本邮件" })}</CardTitle>
        <p className="text-xs text-muted-foreground">{L({ ku: "هەموو شەوێک کاتژمێر 12ی شەو فایلێکی Excel (لیستی قەرزداران، باڵانسەکان و پارەی هاتوو) بۆ ئەم ئیمەیڵە دەنێردرێت، بۆ ئەوەی ئەگەر سێرڤەر تووشی کێشە بوو هیچ ژمارەیەک نەفەوتێت.", en: "Every night at 00:00 a spreadsheet (debtors, balances, money received) goes to this address, so no server trouble can lose the figures.", ar: "كل ليلة الساعة 12 يُرسل ملف Excel إلى هذا البريد.", zh: "每晚 00:00 发送一份表格到此邮箱。" })}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@gmail.com" className="h-9 max-w-xs" data-testid="nightly-mail-to" />
          <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ to: to.trim() || null })}>{L({ ku: "پاشەکەوت", en: "Save", ar: "حفظ", zh: "保存" })}</Button>
          <Button size="sm" disabled={!data.to || send.isPending} onClick={() => send.mutate()}>{L({ ku: "ئێستا بینێرە", en: "Send now", ar: "أرسل الآن", zh: "立即发送" })}</Button>
        </div>
        {!data.keySet && (
          <p className="text-xs text-amber-700 dark:text-amber-300">{L({ ku: "ناردنی ئیمەیڵ لەسەر سێرڤەر چالاک نییە (RESEND_API_KEY دانەنراوە). لە Coolify دایبنێ.", en: "Email is not switched on on the server (RESEND_API_KEY is not set). Set it in Coolify.", ar: "البريد غير مفعّل على الخادم (RESEND_API_KEY).", zh: "服务器未启用邮件（未设置 RESEND_API_KEY）。" })}</p>
        )}
        {data.lastSentAt && <p className="text-xs text-emerald-700 dark:text-emerald-300">{L({ ku: "دوایین ناردن", en: "Last sent", ar: "آخر إرسال", zh: "上次发送" })}: <bdi dir="ltr">{new Date(data.lastSentAt).toLocaleString("en-GB")}</bdi></p>}
        {data.lastError && <p className="text-xs text-red-700 dark:text-red-300">{L({ ku: "دوایین هەڵە", en: "Last error", ar: "آخر خطأ", zh: "上次错误" })}: <bdi dir="ltr">{data.lastError}</bdi></p>}
      </CardContent>
    </Card>
  );
}
