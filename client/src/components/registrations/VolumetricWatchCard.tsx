import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, MessageCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { buildVolumetricMessage, buildWhatsAppLink } from "@shared/volumetricAlert";

type L = { ku: string; en: string; ar: string; zh: string };

type Parcel = {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerName: string | null;
  customerCode: string | null;
  customerMobile: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  actualKg: number;
  volumetricKg: number;
  chargeableKg: number;
  extraKg: number;
  ratio: number;
  divisor: number;
  acknowledgedAt: string | Date | null;
};

const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));

/**
 * Every parcel currently billed on its size rather than its weight.
 *
 * Air sells space, so a light bulky carton is invoiced at several times what
 * the scale says. The customer weighed it themselves and will dispute the
 * invoice unless somebody explains first — and after the parcel ships is too
 * late. This is the standing list of those conversations, biggest gap first,
 * because that is the order in which they get difficult.
 *
 * Silent when there is nothing outstanding. A card that is always on screen
 * stops being read, and this one has to be read.
 */
export function VolumetricWatchCard({ className }: { className?: string }) {
  const { language } = useLanguage();
  const label = (v: L) => pickLang(language, v);
  const [showAll, setShowAll] = useState(false);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.packages.volumetricParcels.useQuery(
    { pendingOnly: true },
    { staleTime: 120_000, retry: false },
  );

  const ack = trpc.packages.acknowledgeVolumetric.useMutation({
    onSuccess: () => {
      toast.success(label({
        ku: "تۆمار کرا کە لەگەڵ کڕیار چێک کراوەتەوە",
        en: "Recorded as checked with the customer",
        ar: "تم تسجيلها كمراجَعة مع العميل",
        zh: "已记录为与客户核实",
      }));
      utils.packages.volumetricParcels.invalidate();
      utils.packages.registrations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className={cn("h-44 w-full rounded-2xl", className)} />;

  const rows = (data ?? []) as Parcel[];
  if (rows.length === 0) return null;

  const shown = showAll ? rows : rows.slice(0, 4);
  const totalExtra = rows.reduce((s, r) => s + r.extraKg, 0);

  return (
    <Card className={cn("overflow-hidden rounded-2xl border-red-300/80 dark:border-red-800/70", className)}>
      <div className="h-1 bg-gradient-to-r from-red-500 to-rose-600" />
      <CardContent className="pt-4">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <Scale className="h-5 w-5 text-red-600 dark:text-red-400" />
          <h3 className="font-bold">
            {label({
              ku: "بارە قەبارەییەکان",
              en: "Volumetric parcels",
              ar: "الطرود الحجمية",
              zh: "体积重包裹",
            })}
          </h3>
          <span className="rounded-lg bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-200">
            {rows.length}
          </span>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          {label({
            ku: `${rows.length} بار لەسەر قەبارە حساب دەکرێن — بە کۆی ${kg(totalExtra)} کیلۆ زیادە. هێشتا لەگەڵ کڕیار چێک نەکراونەتەوە.`,
            en: `${rows.length} parcel(s) billed on volume — ${kg(totalExtra)} kg extra in total. Not yet checked with the customer.`,
            ar: `${rows.length} طرد يُحتسب على الحجم — بزيادة ${kg(totalExtra)} كغ إجمالاً. لم تُراجَع مع العميل بعد.`,
            zh: `${rows.length} 个包裹按体积计费 — 合计多出 ${kg(totalExtra)} 公斤。尚未与客户核实。`,
          })}
        </p>

        <div className="space-y-1.5">
          {shown.map((r) => {
            const waLink = buildWhatsAppLink(
              r.customerMobile,
              buildVolumetricMessage({
                customerName: r.customerName || "",
                trackingNumber: r.trackingNumber || r.packageCode,
                lengthCm: r.lengthCm,
                widthCm: r.widthCm,
                heightCm: r.heightCm,
                assessment: {
                  actualKg: r.actualKg,
                  volumetricKg: r.volumetricKg,
                  chargeableKg: r.chargeableKg,
                  extraKg: r.extraKg,
                  ratio: r.ratio,
                  divisor: r.divisor,
                  billedOnVolume: true,
                  alert: true,
                },
              }),
            );

            return (
              <div key={r.id} className="rounded-xl border border-red-200 bg-red-50/40 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/20">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded-md bg-blue-100 px-1.5 py-0.5 font-mono text-[11px] text-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
                    {r.customerCode ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">{r.customerName ?? "—"}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground" dir="ltr">
                    {r.trackingNumber ?? r.packageCode}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]" dir="ltr">
                  <span><span className="text-muted-foreground">actual</span> {kg(r.actualKg)}</span>
                  <span className="font-medium"><span className="text-muted-foreground">charged</span> {kg(r.chargeableKg)}</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 text-red-800 dark:bg-red-950/50 dark:text-red-200">
                    <AlertTriangle className="h-3 w-3" />
                    +{kg(r.extraKg)} kg · ×{r.ratio.toFixed(2)}
                  </span>

                  <span className="ms-auto flex items-center gap-1.5">
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-2 py-0.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {label({ ku: "پەیام", en: "Draft", ar: "رسالة", zh: "消息" })}
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={ack.isPending}
                      onClick={() => ack.mutate({ packageId: r.id })}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-0.5 text-[11px] font-medium text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/40"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {label({ ku: "چێک کرا", en: "Checked", ar: "تمت", zh: "已核实" })}
                    </button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {rows.length > 4 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 block w-full text-center text-[11.5px] font-medium text-sky-600 dark:text-sky-400"
          >
            {showAll
              ? label({ ku: "کەمکردنەوە", en: "Show less", ar: "عرض أقل", zh: "收起" })
              : label({
                  ku: `بینینی ${rows.length - 4}ی تر`,
                  en: `Show ${rows.length - 4} more`,
                  ar: `عرض ${rows.length - 4} أخرى`,
                  zh: `再显示 ${rows.length - 4} 个`,
                })}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
