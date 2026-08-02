import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageOff, Search, Trash2, Loader2, CheckCircle2 } from "lucide-react";

type L = { ku: string; en: string; ar: string; zh: string };

type Result = {
  dryRun: boolean;
  scanned: number;
  affectedPackages: number;
  removedPhotos: number;
  emptiedPackages: number;
  samples: Array<{ packageCode: string; removed: string[] }>;
};

/**
 * Clears photo URLs left pointing at files that no longer exist.
 *
 * Photos taken at the warehouse were written into the container and served
 * from a route production never mounted, so redeploys took the files while
 * their URLs stayed on the package rows. Those rows render a broken image; a
 * package with no photo should say so.
 *
 * Two steps on purpose. The check reports and changes nothing; only after
 * seeing a number does the delete button appear. Deleting is never one click
 * away from landing on this page.
 */
export function DeadPhotoCleanupCard() {
  const { language } = useLanguage();
  const label = (v: L) => pickLang(language, v);

  const [result, setResult] = useState<Result | null>(null);

  const cleanup = trpc.packages.cleanupDeadPhotos.useMutation({
    onSuccess: (data) => {
      setResult(data as Result);
      if (!data.dryRun) {
        toast.success(label({
          ku: `${data.removedPhotos} وێنەی مردوو سڕایەوە`,
          en: `${data.removedPhotos} dead photo links removed`,
          ar: `تم حذف ${data.removedPhotos} رابط صورة مفقود`,
          zh: `已移除 ${data.removedPhotos} 个失效照片链接`,
        }));
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const busy = cleanup.isPending;
  const nothingToDo = result !== null && result.removedPhotos === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageOff className="h-5 w-5 text-amber-500" />
          {label({
            ku: "پاککردنەوەی وێنە مردووەکان",
            en: "Clean up dead photo links",
            ar: "تنظيف روابط الصور المفقودة",
            zh: "清理失效照片链接",
          })}
        </CardTitle>
        <CardDescription>
          {label({
            ku: "هەندێ پاکەت لینکی وێنەیان هەیە بەڵام پەڕگەکەیان نەماوە — بۆیە وێنەی شکاو پیشان دەدەن. ئەم کارە تەنها ئەو لینکە مردووانە دەسڕێتەوە، تا کارتەکان بە ڕاستگۆیی «بێ وێنە» پیشان بدەن. هیچ وێنەیەکی ساغ دەست لێ نادرێت.",
            en: "Some packages hold photo links whose files are gone, so they render as broken images. This clears only those dead links, so the cards say “no photo” honestly. No working photo is touched.",
            ar: "بعض الطرود تحمل روابط صور اختفت ملفاتها، فتظهر كصور مكسورة. هذا يحذف تلك الروابط فقط لتظهر البطاقات «بلا صورة» بصدق. لا تُمسّ أي صورة سليمة.",
            zh: "部分包裹的照片文件已丢失，链接仍在，因而显示为损坏图片。此操作只清除这些失效链接，使卡片如实显示“无照片”。不会影响任何正常照片。",
          })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => cleanup.mutate({ apply: false })}>
            {busy && cleanup.variables?.apply === false
              ? <Loader2 className="me-2 h-4 w-4 animate-spin" />
              : <Search className="me-2 h-4 w-4" />}
            {label({ ku: "پشکنین", en: "Check", ar: "فحص", zh: "检查" })}
          </Button>

          {/* Only offered once a check has found something to remove. */}
          {result?.dryRun && result.removedPhotos > 0 && (
            <Button variant="destructive" disabled={busy} onClick={() => cleanup.mutate({ apply: true })}>
              {busy && cleanup.variables?.apply === true
                ? <Loader2 className="me-2 h-4 w-4 animate-spin" />
                : <Trash2 className="me-2 h-4 w-4" />}
              {label({
                ku: `سڕینەوەی ${result.removedPhotos} لینکی مردوو`,
                en: `Remove ${result.removedPhotos} dead links`,
                ar: `حذف ${result.removedPhotos} رابطاً مفقوداً`,
                zh: `移除 ${result.removedPhotos} 个失效链接`,
              })}
            </Button>
          )}
        </div>

        {result && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            {nothingToDo ? (
              <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                {label({
                  ku: "هیچ لینکێکی مردوو نەدۆزرایەوە — هەموو وێنەکان ساغن",
                  en: "No dead links found — every photo is intact",
                  ar: "لا توجد روابط مفقودة — جميع الصور سليمة",
                  zh: "未发现失效链接 — 所有照片完好",
                })}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric value={result.scanned} caption={label({ ku: "پشکنراو", en: "scanned", ar: "مفحوص", zh: "已扫描" })} />
                  <Metric value={result.affectedPackages} caption={label({ ku: "پاکەتی سکاو", en: "packages", ar: "طرود", zh: "包裹" })} warn />
                  <Metric value={result.removedPhotos} caption={label({ ku: "لینکی مردوو", en: "dead links", ar: "روابط مفقودة", zh: "失效链接" })} warn />
                  <Metric value={result.emptiedPackages} caption={label({ ku: "بێ وێنە دەبن", en: "left with none", ar: "بلا صور", zh: "将无照片" })} />
                </div>

                <p className="text-xs text-muted-foreground">
                  {result.dryRun
                    ? label({
                        ku: "ئەمە تەنها پشکنین بوو — هێشتا هیچ نەسڕاوەتەوە",
                        en: "This was a check only — nothing has been removed yet",
                        ar: "كان هذا فحصاً فقط — لم يُحذف شيء بعد",
                        zh: "这只是检查 — 尚未移除任何内容",
                      })
                    : label({
                        ku: "سڕایەوە",
                        en: "Removed",
                        ar: "تم الحذف",
                        zh: "已移除",
                      })}
                </p>

                {result.samples.length > 0 && (
                  <div className="space-y-0.5 border-t pt-2">
                    {result.samples.map((s) => (
                      <p key={s.packageCode} className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                        {s.packageCode} · {s.removed.length}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ value, caption, warn }: { value: number; caption: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-background px-3 py-2">
      <p className={warn && value > 0 ? "text-lg font-bold text-amber-600 dark:text-amber-400" : "text-lg font-bold"} dir="ltr">
        {value}
      </p>
      <p className="text-[10.5px] text-muted-foreground">{caption}</p>
    </div>
  );
}
