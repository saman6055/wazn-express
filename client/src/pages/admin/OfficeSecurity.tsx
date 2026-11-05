import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ShieldAlert, Laptop, Check, X, Trash2, LockOpen, Loader2, Power, ArrowRight, ChevronLeft, AlertTriangle, Globe } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmDanger } from "@/components/ConfirmDialog";
import { fmtWhen } from "@/lib/numericDate";
import { KIND_WORDS } from "@shared/securityWatch";
import { fullTraits } from "@/lib/deviceTraits";

type DeviceView = {
  id: string;
  plate: string;
  details: string[];
  ip: string | null;
  kind: string;
  lastSeenAt?: string | null;
  lastUser?: string | null;
  firstSeenAt?: string | null;
  isThis?: boolean;
  mismatch: { at: string; ip: string; user?: string } | null;
  mismatchKind: string | null;
};

/**
 * One device as the owner asked to see it: a plate like a car's, and what is
 * known of the machine under it (shared/devicePlate).
 */
function DeviceCard({ d, title, children, onSameDevice }: { d: DeviceView; title: string; children?: ReactNode; onSameDevice?: () => void }) {
  return (
    <div className={`rounded-lg border p-3 space-y-2 text-sm ${d.mismatch ? "border-red-500" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span dir="ltr" className="rounded-md border-2 border-foreground bg-muted px-2 py-0.5 font-mono text-base font-bold tracking-widest">
          {d.plate}
        </span>
        <span className="font-semibold">{title}</span>
        {d.isThis && <span className="text-xs text-muted-foreground">— ئێستا لەسەر ئەم ئامێرەیت</span>}
        <div className="ms-auto flex flex-wrap items-center gap-2">{children}</div>
      </div>
      <div className="grid gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-2">
        {d.details.length > 0 ? d.details.map((line, i) => <span key={i}>{line}</span>) : <span>{d.kind}</span>}
        {d.ip && (
          <span className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" /> IP: <span dir="ltr">{d.ip}</span>
          </span>
        )}
        {d.firstSeenAt && <span>یەکەم جار: {fmtWhen(d.firstSeenAt, true)}</span>}
        {d.lastSeenAt && <span>دوایین جار: {fmtWhen(d.lastSeenAt, true)}{d.lastUser ? ` — ${d.lastUser}` : ""}</span>}
      </div>
      {d.mismatch && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="w-4 h-4" />
          <span>
            ئەم پلێتە لە ئامێرێکی جیاوازەوە بەکارهات — {d.mismatchKind} — IP <span dir="ltr">{d.mismatch.ip}</span> — {fmtWhen(d.mismatch.at, true)}
            {d.mismatch.user ? ` — ${d.mismatch.user}` : ""}
          </span>
          {onSameDevice && (
            <Button size="sm" variant="outline" className="ms-auto" onClick={onSameDevice}>
              <Check className="w-4 h-4 me-1" /> ئەمە هەمان ئامێرە
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

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
  const acceptPrint = trpc.officeSecurity.acceptPrint.useMutation({ onSuccess: () => { toast.success("پلێتەکە نوێ کرایەوە."); refresh(); }, onError });
  const [, navigate] = useLocation();
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else navigate("/staff-management");
  };
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
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Button size="sm" variant="outline" onClick={goBack}>
            <ArrowRight className="w-4 h-4 me-1" /> گەڕانەوە
          </Button>
          <button type="button" className="hover:underline" onClick={() => navigate("/staff-management")}>بەکارهێنەران</button>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-foreground">پاراستنی سیستەم</span>
        </div>
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
                <DeviceCard d={d} title={d.lastUser} />
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
                onClick={() => void fullTraits().then((device) => approveThis.mutate({ label: thisLabel.trim() || "ئەم ئامێرە", device: { ...device } }))}
              >
                <Check className="w-4 h-4 me-1" /> ئەم ئامێرە بناسێنە
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <p className="font-semibold text-sm">ناسراو ({data.approved.length})</p>
            {data.approved.length === 0 && <p className="text-sm text-muted-foreground">هێشتا هیچ ئامێرێک نەناسێنراوە.</p>}
            {data.approved.map((d) => (
              <DeviceCard key={d.id} d={d} title={d.label} onSameDevice={() => acceptPrint.mutate({ id: d.id })}>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="لابردن"
                  disabled={remove.isPending}
                  onClick={async () => {
                    if (await confirmDanger(`«${d.label}» لە لیستی ناسراو لابدرێت؟`)) remove.mutate({ id: d.id });
                  }}
                >
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-300" />
                </Button>
              </DeviceCard>
            ))}
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-sm">ئامێرە نەناسراوەکان کە چوونەتە ژوورەوە ({data.seen.length})</p>
            {data.seen.length === 0 && <p className="text-sm text-muted-foreground">هیچ.</p>}
            {data.seen.map((d) => (
              <DeviceCard key={d.id} d={d} title={d.lastUser} onSameDevice={() => acceptPrint.mutate({ id: d.id })}>
                <Input
                  className="max-w-[14rem] h-8"
                  value={labelFor(d.id, `${d.lastUser} — ${d.kind}`)}
                  onChange={(e) => setLabels({ ...labels, [d.id]: e.target.value })}
                />
                <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: d.id, label: labelFor(d.id, `${d.lastUser} — ${d.kind}`) })}>
                  <Check className="w-4 h-4 me-1" /> بناسێنە
                </Button>
              </DeviceCard>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
