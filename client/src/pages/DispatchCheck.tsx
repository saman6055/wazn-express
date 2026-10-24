import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Lock, LockOpen, PackageCheck, PackagePlus, ScanBarcode, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSystemAlert } from "@/components/SystemAlert";
import { soundManager } from "@/lib/soundManager";
import { pickLang } from "@/lib/lang";
import { batchHasShipmentNumber, shipmentNumberName } from "@shared/parcelStage";
import { cn } from "@/lib/utils";

type Words = { ku: string; en: string; ar: string; zh: string };

type ScanLine = {
  key: number;
  code: string;
  kind: "added" | "already_here" | "in_other_carton" | "not_registered" | "other_batch";
  cartonNo?: number;
  customerCode?: string | null;
  batchCode?: string | null;
  packageId?: number;
  done?: boolean;
};

/**
 * «خستنە ناو کارتۆن» - the dispatch check in China (owner, 2026-10-24).
 *
 * Every parcel of the batch scanned into a numbered carton before it leaves:
 * one that was never registered, or was registered on another batch, is
 * stopped here, loudly, in China. The batch is finished when nothing is left
 * out - or by an admin working in China, or the main admin, with a reason -
 * and every member of staff is told (server/db/dispatch.db.ts).
 */
export default function DispatchCheck() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const utils = trpc.useUtils();
  const systemAlert = useSystemAlert();
  const scanRef = useRef<HTMLInputElement>(null);
  const [batchId, setBatchId] = useState<number | null>(() => {
    try { return Number(localStorage.getItem("wazn-dispatch-batch")) || null; } catch { return null; }
  });
  const [cartonId, setCartonId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");

  const { data: batchList } = trpc.batches.list.useQuery();
  const open = useMemo(
    () => ((batchList as any[]) ?? []).filter((b) => b.status === "preparing" || b.status === "in_transit").sort((a, z) => z.id - a.id),
    [batchList],
  );
  const state = trpc.dispatch.state.useQuery({ batchId: batchId ?? 0 }, { enabled: !!batchId });
  const s = state.data;
  const carton = s?.cartons.find((c) => c.id === cartonId) ?? null;

  useEffect(() => {
    try { if (batchId) localStorage.setItem("wazn-dispatch-batch", String(batchId)); } catch { /* a convenience */ }
    setCartonId(null);
    setLines([]);
  }, [batchId]);
  // The open carton is the one being filled, when none is chosen.
  useEffect(() => {
    if (s && cartonId === null) {
      const openOne = [...s.cartons].reverse().find((c) => c.status === "open");
      if (openOne) setCartonId(openOne.id);
    }
  }, [s, cartonId]);
  useEffect(() => { scanRef.current?.focus(); }, [cartonId]);

  const refresh = () => { void utils.dispatch.state.invalidate(); };
  const err = (e: { message: string }) => systemAlert({ kind: "error", title: L({ ku: "نەکرا", en: "Not done", ar: "لم يتم", zh: "未完成" }), message: e.message });

  const openCarton = trpc.dispatch.openCarton.useMutation({
    onSuccess: (c) => { setCartonId(c.id); setLines([]); refresh(); },
    onError: err,
  });
  const scan = trpc.dispatch.scan.useMutation({
    onSuccess: (r, v) => {
      const line: ScanLine = { key: Date.now(), code: v.code, ...(r as any) };
      setLines((prev) => [line, ...prev].slice(0, 50));
      if (r.kind === "added") soundManager.playSuccess();
      else if (r.kind === "already_here") soundManager.playNotice();
      else soundManager.playError();
      refresh();
    },
    onError: err,
  });
  const moveHere = trpc.dispatch.moveHere.useMutation({
    onSuccess: (_r, v) => {
      setLines((prev) => prev.map((l) => (l.packageId === v.packageId ? { ...l, done: true } : l)));
      soundManager.playSuccess();
      refresh();
      scanRef.current?.focus();
    },
    onError: err,
  });
  const moveToBatch = trpc.dispatch.moveToBatch.useMutation({ onSuccess: refresh, onError: err });
  const removeItem = trpc.dispatch.removeItem.useMutation({ onSuccess: refresh, onError: err });
  const closeCarton = trpc.dispatch.closeCarton.useMutation({ onSuccess: () => { setWeight(""); refresh(); }, onError: err });
  const reopenCarton = trpc.dispatch.reopenCarton.useMutation({ onSuccess: refresh, onError: err });
  const finish = trpc.dispatch.finish.useMutation({
    onSuccess: (d) => {
      soundManager.playComplete();
      toast.success(L({
        ku: `پشکنینی ناردن تەواو بوو: ${d.cartons} کارتۆن، ${d.parcels} پاکێج`,
        en: `Dispatch check done: ${d.cartons} cartons, ${d.parcels} parcels`,
        ar: `اكتمل فحص الإرسال: ${d.cartons} كرتون، ${d.parcels} طرد`,
        zh: `发货核对完成：${d.cartons} 箱，${d.parcels} 件`,
      }));
      /**
       * The number it travels under is what tells every customer in this
       * batch that their goods have left China. Asked for here, at the one
       * moment the person who will have it is already looking at the batch.
       */
      if (!batchHasShipmentNumber(s?.batch)) {
        const name = L(shipmentNumberName(s?.batch?.shippingType));
        toast.warning(L({
          ku: `${name} بنووسە — بەبێ ئەو، کڕیارەکان هێشتا دەڵێن کاڵاکەیان لە چینە`,
          en: `Add the ${name.toLowerCase()} — without it customers still read "in China"`,
          ar: `أضف ${name} — بدونه يرى العملاء أن بضاعتهم ما زالت في الصين`,
          zh: `请填写${name} — 否则客户仍会看到货物"在中国"`,
        }), { duration: 10000 });
      }
      refresh();
    },
    onError: err,
  });

  const submit = () => {
    const v = code.trim();
    if (!v || !cartonId) return;
    setCode("");
    scan.mutate({ cartonId, code: v });
  };

  const say = (l: ScanLine): { tone: string; icon: typeof CheckCircle2; text: string } => {
    switch (l.kind) {
      case "added":
        return { tone: "border-emerald-300 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30", icon: CheckCircle2, text: L({ ku: `خرایە کارتۆنی ${l.cartonNo} · ${l.customerCode ?? ""}`, en: `Into carton ${l.cartonNo} · ${l.customerCode ?? ""}`, ar: `في الكرتون ${l.cartonNo} · ${l.customerCode ?? ""}`, zh: `已装入第 ${l.cartonNo} 箱 · ${l.customerCode ?? ""}` }) };
      case "already_here":
        return { tone: "border-sky-300 bg-sky-50 dark:border-sky-800/60 dark:bg-sky-950/30", icon: CheckCircle2, text: L({ ku: "پێشتر لەم کارتۆنەدایە", en: "Already in this carton", ar: "موجود في هذا الكرتون", zh: "已在本箱中" }) };
      case "in_other_carton":
        return { tone: "border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30", icon: AlertTriangle, text: L({ ku: `ئەمە لە کارتۆنی ${l.cartonNo} دایە`, en: `This is in carton ${l.cartonNo}`, ar: `هذا في الكرتون ${l.cartonNo}`, zh: `此件在第 ${l.cartonNo} 箱` }) };
      case "not_registered":
        return { tone: "border-red-400 bg-red-50 dark:border-red-800/60 dark:bg-red-950/40", icon: XCircle, text: L({ ku: "تۆماری خێرای بۆ نەکراوە - سەرەتا تۆماری بکە", en: "Not registered - register it first", ar: "غير مسجل - سجّله أولاً", zh: "未登记 - 请先快速登记" }) };
      default:
        return { tone: "border-red-400 bg-red-50 dark:border-red-800/60 dark:bg-red-950/40", icon: XCircle, text: l.batchCode
          ? L({ ku: `هی باچی ${l.batchCode}ـە · ${l.customerCode ?? ""}`, en: `Belongs to ${l.batchCode} · ${l.customerCode ?? ""}`, ar: `من الدفعة ${l.batchCode} · ${l.customerCode ?? ""}`, zh: `属于批次 ${l.batchCode} · ${l.customerCode ?? ""}` })
          : L({ ku: `لەسەر هیچ باچێک نییە · ${l.customerCode ?? ""}`, en: `On no batch · ${l.customerCode ?? ""}`, ar: `ليس في أي دفعة · ${l.customerCode ?? ""}`, zh: `未分配批次 · ${l.customerCode ?? ""}` }) };
    }
  };

  const finished = !!s?.batch.dispatchCheckedAt;
  const left = s?.unpacked.length ?? 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <PackageCheck className="h-6 w-6 text-primary" />
            {L({ ku: "خستنە ناو کارتۆن", en: "Dispatch check", ar: "التعبئة في الكراتين", zh: "装箱核对" })}
          </h1>
          <Select value={batchId ? String(batchId) : ""} onValueChange={(v) => setBatchId(Number(v))}>
            <SelectTrigger className="w-60" data-testid="dispatch-batch">
              <SelectValue placeholder={L({ ku: "باچ هەڵبژێرە", en: "Choose a batch", ar: "اختر دفعة", zh: "选择批次" })} />
            </SelectTrigger>
            <SelectContent>
              {open.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.batchCode}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {!batchId ? null : !s ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* The batch's own code, big: the one thing that must not be mistaken. */}
            <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{L({ ku: "باچ", en: "Batch", ar: "الدفعة", zh: "批次" })}</p>
                  <p className="font-mono text-3xl font-black tracking-wide" dir="ltr" data-testid="dispatch-batch-code">{s.batch.batchCode}</p>
                </div>
                <div className="text-end">
                  <p className="text-xs text-muted-foreground">{L({ ku: "خراوەتە ناو کارتۆن", en: "Packed", ar: "تمت التعبئة", zh: "已装箱" })}</p>
                  <p className="text-2xl font-bold tabular-nums" dir="ltr" data-testid="dispatch-progress">{s.packedParcels} / {s.totalParcels}</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${s.totalParcels ? (100 * s.packedParcels) / s.totalParcels : 0}%` }} />
              </div>
              {finished && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300" data-testid="dispatch-finished">
                  <CheckCircle2 className="h-4 w-4" />
                  {L({ ku: "پشکنینی ناردن تەواو کراوە", en: "Dispatch check finished", ar: "اكتمل فحص الإرسال", zh: "发货核对已完成" })}
                  {s.batch.dispatchCheckedBy ? ` · ${s.batch.dispatchCheckedBy}` : ""}
                  <Link href={`/dispatch-check/${s.batch.id}/report`} className="ms-2 inline-flex items-center gap-1 text-primary hover:underline">
                    <FileText className="h-4 w-4" />
                    {L({ ku: "ڕاپۆرت", en: "Report", ar: "التقرير", zh: "报告" })}
                  </Link>
                </p>
              )}
            </div>

            {/* The cartons. */}
            <div className="flex flex-wrap gap-2" data-testid="dispatch-cartons">
              {s.cartons.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCartonId(c.id); setLines([]); }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold",
                    c.id === cartonId ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {c.status === "closed" ? <Lock className="h-3.5 w-3.5" /> : <PackagePlus className="h-3.5 w-3.5" />}
                  {L({ ku: `کارتۆنی ${c.cartonNo}`, en: `Carton ${c.cartonNo}`, ar: `كرتون ${c.cartonNo}`, zh: `第 ${c.cartonNo} 箱` })}
                  <span className="rounded bg-background/30 px-1.5 tabular-nums">{c.items.length}</span>
                </button>
              ))}
              <Button variant="outline" onClick={() => batchId && openCarton.mutate({ batchId })} disabled={openCarton.isPending} data-testid="dispatch-new-carton">
                <PackagePlus className="me-1.5 h-4 w-4" />
                {L({ ku: "کارتۆنی نوێ", en: "New carton", ar: "كرتون جديد", zh: "新箱" })}
              </Button>
            </div>

            {carton && (
              <div className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-bold">
                    {L({ ku: `کارتۆنی ${carton.cartonNo}`, en: `Carton ${carton.cartonNo}`, ar: `كرتون ${carton.cartonNo}`, zh: `第 ${carton.cartonNo} 箱` })}
                    <span className="ms-2 text-sm font-normal text-muted-foreground">{carton.items.length} {L({ ku: "پاکێج", en: "parcels", ar: "طرد", zh: "件" })}</span>
                  </p>
                  {carton.status === "open" ? (
                    <div className="flex items-center gap-2">
                      <Input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" className="h-9 w-28" placeholder="kg" dir="ltr" />
                      <Button variant="outline" onClick={() => closeCarton.mutate({ cartonId: carton.id, weightKg: parseFloat(weight) || null })} data-testid="dispatch-close-carton">
                        <Lock className="me-1.5 h-4 w-4" />
                        {L({ ku: "داخستنی کارتۆن", en: "Close carton", ar: "إغلاق الكرتون", zh: "封箱" })}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => reopenCarton.mutate({ cartonId: carton.id })}>
                      <LockOpen className="me-1.5 h-4 w-4" />
                      {L({ ku: "کردنەوەی کارتۆن", en: "Reopen", ar: "إعادة فتح", zh: "重新开箱" })}
                    </Button>
                  )}
                </div>

                {carton.status === "open" && (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ScanBarcode className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={scanRef}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
                        placeholder={L({ ku: "تراکینگ سکان بکە…", en: "Scan the tracking…", ar: "امسح رقم التتبع…", zh: "扫描运单号…" })}
                        className="h-12 ps-10 font-mono text-lg"
                        dir="ltr"
                        autoFocus
                        data-testid="dispatch-scan"
                      />
                    </div>
                    <Button className="h-12" onClick={submit} disabled={scan.isPending}>
                      {scan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanBarcode className="h-4 w-4" />}
                    </Button>
                  </div>
                )}

                {/* This session's scans, newest on top, with what to do about each. */}
                {lines.length > 0 && (
                  <div className="space-y-1.5" data-testid="dispatch-lines">
                    {lines.map((l) => {
                      const { tone, icon: Icon, text } = say(l);
                      return (
                        <div key={l.key} className={cn("flex flex-wrap items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm", tone, l.done && "opacity-60")}>
                          <Icon className="h-4 w-4 shrink-0" />
                          <bdi dir="ltr" className="font-mono">{l.code}</bdi>
                          <span className="font-medium">{l.done ? L({ ku: "گوازرایەوە بۆ ئەم باچە و خرایە کارتۆن", en: "Moved here and packed", ar: "نُقل وعُبّئ", zh: "已移入并装箱" }) : text}</span>
                          {l.kind === "other_batch" && !l.done && l.packageId && (
                            <Button size="sm" className="ms-auto h-7" onClick={() => moveHere.mutate({ packageId: l.packageId!, cartonId: carton.id })} data-testid="dispatch-move-here">
                              {L({ ku: "بیگوازەوە بۆ ئەم باچە", en: "Move into this batch", ar: "انقله إلى هذه الدفعة", zh: "移入本批次" })}
                            </Button>
                          )}
                          {l.kind === "not_registered" && (
                            <Link href="/quick-register" className="ms-auto text-xs font-semibold text-primary hover:underline">
                              {L({ ku: "تۆماری خێرا", en: "Quick Register", ar: "تسجيل سريع", zh: "快速登记" })}
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {carton.items.length > 0 && (
                  <details className="rounded-lg border">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                      {L({ ku: "ناوەڕۆکی کارتۆن", en: "In this carton", ar: "محتوى الكرتون", zh: "本箱内容" })} ({carton.items.length})
                    </summary>
                    <div className="divide-y">
                      {carton.items.map((i) => (
                        <div key={i.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                          <bdi dir="ltr" className="font-mono">{i.trackingNumber}</bdi>
                          <span className="text-muted-foreground">{i.customerCode}</span>
                          {carton.status === "open" && (
                            <Button size="icon" variant="ghost" className="ms-auto h-7 w-7" onClick={() => removeItem.mutate({ itemId: i.id })} aria-label="remove">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Left out: on the batch, in no carton. */}
            <div className={cn("rounded-xl border-2 p-4", left > 0 ? "border-red-300 dark:border-red-800/60" : "border-emerald-300 dark:border-emerald-800/60")} data-testid="dispatch-left-out">
              <p className="mb-2 flex items-center gap-2 font-bold">
                {left > 0 ? <AlertTriangle className="h-5 w-5 text-red-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                {left > 0
                  ? L({ ku: `${left} پاکێج لەسەر ئەم باچەن بەڵام لە هیچ کارتۆنێکدا نین`, en: `${left} parcels on this batch are in no carton`, ar: `${left} طرد في الدفعة خارج الكراتين`, zh: `本批次有 ${left} 件未装箱` })
                  : L({ ku: "هەموو پاکێجەکان خراونەتە ناو کارتۆن", en: "Every parcel is packed", ar: "كل الطرود معبأة", zh: "全部已装箱" })}
              </p>
              {left > 0 && (
                <div className="divide-y rounded-lg border">
                  {s.unpacked.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm">
                      <bdi dir="ltr" className="font-mono">{p.trackingNumber || p.packageCode}</bdi>
                      <span className="text-muted-foreground">{p.customerCode} {p.customerName}</span>
                      <Select onValueChange={(v) => moveToBatch.mutate({ packageId: p.id, batchId: Number(v) })}>
                        <SelectTrigger className="ms-auto h-7 w-48 text-xs">
                          <SelectValue placeholder={L({ ku: "بیگوازەوە بۆ باچێکی تر", en: "Move to another batch", ar: "انقله لدفعة أخرى", zh: "移至其他批次" })} />
                        </SelectTrigger>
                        <SelectContent>
                          {open.filter((b) => b.id !== batchId).map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.batchCode}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Finish. */}
            <div className="space-y-2 rounded-xl border p-4">
              {left > 0 && s.mayFinishShort && (
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={L({ ku: "هۆکار: بۆچی باچەکە بەبێ ئەم پاکێجانە دەڕوات؟", en: "Reason: why does the batch go without them?", ar: "السبب: لماذا تُرسل الدفعة بدونها؟", zh: "原因：为何不带这些包裹发货？" })}
                  data-testid="dispatch-note"
                />
              )}
              {left > 0 && !s.mayFinishShort && (
                <p className="text-sm text-red-700 dark:text-red-300">
                  {L({ ku: "تا هەموو پاکێجەکان نەخرێنە ناو کارتۆن، تەنها ئادمینی چین دەتوانێت تەواوی بکات.", en: "Until every parcel is packed, only an admin in China can finish.", ar: "حتى تُعبأ كل الطرود، يمكن لمسؤول الصين فقط الإنهاء.", zh: "全部装箱前，只有中国管理员可以完成。" })}
                </p>
              )}
              <Button
                className="w-full h-12 text-base"
                disabled={finish.isPending || s.cartons.length === 0 || (left > 0 && (!s.mayFinishShort || note.trim().length < 3))}
                onClick={() => batchId && finish.mutate({ batchId, note: note.trim() || undefined })}
                data-testid="dispatch-finish"
              >
                {finish.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                <PackageCheck className="me-2 h-5 w-5" />
                {finished
                  ? L({ ku: "دووبارە تەواوکردنی پشکنینی ناردن", en: "Finish the dispatch check again", ar: "إنهاء الفحص مجدداً", zh: "重新完成发货核对" })
                  : L({ ku: "تەواوکردنی پشکنینی ناردن", en: "Finish the dispatch check", ar: "إنهاء فحص الإرسال", zh: "完成发货核对" })}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
