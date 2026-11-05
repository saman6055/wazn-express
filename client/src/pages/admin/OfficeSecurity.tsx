import { useState } from "react";
import { ShieldAlert, Laptop, Check, X, Trash2, LockOpen, Loader2, Power } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmDanger } from "@/components/ConfirmDialog";
import { fmtWhen } from "@/lib/numericDate";
import { KIND_WORDS } from "@shared/securityWatch";

/**
 * The main admin's security page (owner, 2026-11-05):
 *  - which devices may open the office system, and who is asking now;
 *  - which customers were held for what their sessions did, with the report.
 * Written in Kurdish: it is his page alone.
 */
export default function OfficeSecurity() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.officeSecurity.overview.useQuery(undefined, { refetchInterval: 5000 });
  const refresh = () => void utils.officeSecurity.overview.invalidate();
  const onError = (e: { message: string }) => toast.error(e.message);

  const setEnforced = trpc.officeSecurity.setEnforced.useMutation({ onSuccess: refresh, onError });
  const approve = trpc.officeSecurity.approve.useMutation({ onSuccess: () => { toast.success("ئامێرەکە ناسێنرا."); refresh(); }, onError });
  const approveThis = trpc.officeSecurity.approveThisDevice.useMutation({ onSuccess: () => { toast.success("ئەم ئامێرە ناسێنرا."); refresh(); }, onError });
  const [thisLabel, setThisLabel] = useState("");
  const refuse = trpc.officeSecurity.refuse.useMutation({ onSuccess: refresh, onError });
  const remove = trpc.officeSecurity.remove.useMutation({ onSuccess: refresh, onError });
  const clearHold = trpc.officeSecurity.clearHold.useMutation({ onSuccess: () => { toast.success("هەژمارەکە کرایەوە."); refresh(); }, onError });
  const [labels, setLabels] = useState<Record<string, string>>({});

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const labelFor = (id: string, fallback: string) => labels[id] ?? fallback;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-7 h-7" />
          پاراستنی سیستەم
        </h1>
        <p className="text-muted-foreground mt-1">ئامێرە ناسراوەکانی ئۆفیس، و ئەو کڕیارانەی بۆ پاراستن ڕاگیراون.</p>
      </div>

      {/* Customers held */}
      <Card className={data.held.length ? "border-red-500" : undefined}>
        <CardHeader>
          <CardTitle>کڕیارە ڕاگیراوەکان ({data.held.length})</CardTitle>
          <CardDescription>
            هەژمارێک دەگیرێت کاتێک کارێک دەکات کە پۆرتاڵی ئاسایی هەرگیز نایکات. پێش کردنەوە پرسیار لە کەسەکە بکە بۆچی.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.held.length === 0 && <p className="text-sm text-muted-foreground">هیچ کڕیارێک ڕانەگیراوە.</p>}
          {data.held.map((h) => (
            <div key={h.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{h.fullName}</span>
                <span dir="ltr" className="font-mono text-sm">{h.customerCode}</span>
                <span dir="ltr" className="text-sm text-muted-foreground">{h.mobileNumber}</span>
                {h.at && <Badge variant="destructive">{fmtWhen(h.at, true)}</Badge>}
              </div>
              {h.report && (
                <>
                  <p className="text-sm">{KIND_WORDS[h.report.kind] ?? h.report.summary}</p>
                  <details className="text-xs">
                    <summary className="cursor-pointer">ڕاپۆرتی ورد ({h.report.events.length} جووڵە)</summary>
                    <div className="mt-2 max-h-56 overflow-auto rounded bg-muted p-2" dir="ltr">
                      {h.report.events.map((e, i) => (
                        <div key={i} className="font-mono whitespace-nowrap">
                          {new Date(e.at).toISOString().slice(11, 19)} · {e.kind} · {e.path} · {e.ip}
                        </div>
                      ))}
                      {h.report.events[0]?.agent && <div className="mt-2 whitespace-normal opacity-70">{h.report.events[0].agent}</div>}
                    </div>
                  </details>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={clearHold.isPending}
                onClick={async () => {
                  if (await confirmDanger(`هەژماری ${h.fullName} بکرێتەوە؟ تەنها دوای قسەکردن لەگەڵی و دڵنیابوون.`)) clearHold.mutate({ customerId: h.id });
                }}
              >
                <LockOpen className="w-4 h-4 me-1" /> کردنەوە
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Devices waiting */}
      {data.waiting.length > 0 && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle>ئامێر داوای کردنەوەی سیستەم دەکات</CardTitle>
            <CardDescription>کۆدەکە لەگەڵ ئەو کۆدەی لەسەر شاشەی کەسەکە دەرکەوتووە بەراورد بکە.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.waiting.map((d) => (
              <div key={d.id} className="rounded-lg border p-3 space-y-2">
                <p dir="ltr" className="text-center text-2xl font-bold tracking-[0.3em]">{d.code?.slice(0, 3)} {d.code?.slice(3)}</p>
                <p className="text-sm">
                  <span className="font-semibold">{d.lastUser}</span> — {d.kind} — <span dir="ltr">{d.ip}</span> — {fmtWhen(d.lastSeenAt, true)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="max-w-xs"
                    value={labelFor(d.id, `${d.lastUser} — ${d.kind}`)}
                    onChange={(e) => setLabels({ ...labels, [d.id]: e.target.value })}
                    placeholder="ناوی ئامێر، بۆ نموونە: لاپتۆپی دکتۆر"
                  />
                  <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: d.id, label: labelFor(d.id, `${d.lastUser} — ${d.kind}`) })}>
                    <Check className="w-4 h-4 me-1" /> ڕێگە بدە
                  </Button>
                  <Button size="sm" variant="outline" disabled={refuse.isPending} onClick={() => refuse.mutate({ id: d.id })}>
                    <X className="w-4 h-4 me-1" /> ڕەتکردنەوە
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* The rule and the known devices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Laptop className="w-5 h-5" /> ئامێرە ناسراوەکانی ئۆفیس</CardTitle>
          <CardDescription>
            کاتێک ئەم ڕێسایە کراوەیە، هەر چوونەژوورەوەیەکی نوێ لە ئامێرێکی نەناسراو ڕێگەی تۆی دەوێت. ئەوەی پێش کردنەوەی ڕێساکە کراوە بووە وەک خۆی دەمێنێتەوە. پۆرتاڵی کڕیار دەستی لێنادرێت.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3">
            <Badge className={data.enforced ? "bg-green-600" : "bg-gray-500"}>{data.enforced ? "کراوەیە" : "کوژاوەیە"}</Badge>
            {data.enforced && data.enforcedAt && <span className="text-sm text-muted-foreground">کراوەتەوە: {fmtWhen(data.enforcedAt, true)}</span>}
            {data.killSwitch && <Badge variant="destructive">OFFICE_DEVICES_OFF لە Coolify کوژاندوویەتی</Badge>}
            <Button
              size="sm"
              variant={data.enforced ? "outline" : "default"}
              disabled={setEnforced.isPending}
              onClick={async () => {
                if (!data.enforced) {
                  if (await confirmDanger("ڕێسا بکرێتەوە؟ ئەم ئامێرەی ئێستا لەسەرییت خۆکار دەناسێنرێت. ئەوانەی ئێستا کراوەن وەک خۆیان دەمێننەوە؛ تەنها چوونەژوورەوەی نوێ لە ئامێری نەناسراو ڕێگەی تۆی دەوێت.")) setEnforced.mutate({ on: true });
                } else if (await confirmDanger("ڕێسا بکوژێنرێتەوە؟ هەر ئامێرێک دەتوانێت دیسان بچێتە ژوورەوە.")) {
                  setEnforced.mutate({ on: false });
                }
              }}
            >
              <Power className="w-4 h-4 me-1" /> {data.enforced ? "کوژاندنەوە" : "کردنەوەی ڕێسا"}
            </Button>
            {!data.enforced && <span className="text-sm text-muted-foreground">پێشنیار: سەرەتا ئامێرەکانی خۆت لە خوارەوە بناسێنە، پاشان ڕێساکە بکەرەوە.</span>}
          </div>

          {!data.thisDeviceApproved && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-500 p-3">
              <span className="text-sm font-semibold">ئەم ئامێرەی ئێستا لەسەرییت هێشتا نەناسراوە.</span>
              <Input
                className="max-w-xs"
                value={thisLabel}
                onChange={(e) => setThisLabel(e.target.value)}
                placeholder="ناوی ئامێر، بۆ نموونە: لاپتۆپی خاوەن"
              />
              <Button
                size="sm"
                disabled={approveThis.isPending}
                onClick={() => approveThis.mutate({ label: thisLabel.trim() || "ئەم ئامێرە" })}
              >
                <Check className="w-4 h-4 me-1" /> ئەم ئامێرە بناسێنە
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <p className="font-semibold text-sm">ناسراو ({data.approved.length})</p>
            {data.approved.length === 0 && <p className="text-sm text-muted-foreground">هێشتا هیچ ئامێرێک نەناسێنراوە.</p>}
            {data.approved.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm">
                <span className="font-semibold">{d.label}</span>
                {d.isThis && <Badge className="bg-blue-600">ئەم ئامێرە</Badge>}
                <span className="text-muted-foreground">{d.kind}</span>
                {d.lastSeenAt && <span className="text-muted-foreground">دوایین جار: {fmtWhen(d.lastSeenAt, true)} {d.lastUser ? `— ${d.lastUser}` : ""}</span>}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  disabled={remove.isPending}
                  onClick={async () => {
                    if (await confirmDanger(`«${d.label}» لە لیستی ناسراو لابدرێت؟`)) remove.mutate({ id: d.id });
                  }}
                >
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-300" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-sm">ئامێرە نەناسراوەکان کە چوونەتە ژوورەوە ({data.seen.length})</p>
            {data.seen.length === 0 && <p className="text-sm text-muted-foreground">هیچ.</p>}
            {data.seen.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm">
                <span className="font-semibold">{d.lastUser}</span>
                {d.isThis && <Badge className="bg-blue-600">ئەم ئامێرە</Badge>}
                <span className="text-muted-foreground">{d.kind} — <span dir="ltr">{d.ip}</span> — {fmtWhen(d.lastSeenAt, true)}</span>
                <Input
                  className="max-w-[14rem] h-8"
                  value={labelFor(d.id, `${d.lastUser} — ${d.kind}`)}
                  onChange={(e) => setLabels({ ...labels, [d.id]: e.target.value })}
                />
                <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: d.id, label: labelFor(d.id, `${d.lastUser} — ${d.kind}`) })}>
                  <Check className="w-4 h-4 me-1" /> بناسێنە
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
