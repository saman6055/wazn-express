import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Package, Loader2, Plane, Warehouse, CheckCircle2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { STATUS_LABEL, type BatchStatus } from "@/lib/shipmentFilters";
import { PACKAGE_STATUS_LABEL } from "@/lib/packageStatus";

/**
 * One parcel, for somebody with no account.
 *
 * A customer sends goods to their brother in Sulaymaniyah; he was given a
 * link and should not have to sign up to see whether it has left China. This
 * page shows that one parcel and nothing else — no customer, no price, no
 * other shipments. The server decides what may be shown; this only draws it.
 *
 * It is also, quietly, the best advertisement the company has. The person
 * reading it is somebody who does not use Wazn yet, meeting it at the moment
 * something they were waiting for is on its way — so the page has one line at
 * the bottom saying who is carrying it, and nothing more pushy than that.
 *
 * No language switcher and no theme: whoever opened this did not come to
 * configure anything. It reads in Kurdish, right to left, like the rest.
 */

const STAGES = [
  { key: "registered", icon: Warehouse },
  { key: "in_transit", icon: Plane },
  { key: "ready_for_delivery", icon: MapPin },
  { key: "delivered", icon: CheckCircle2 },
] as const;

/** Which of the four blocks a real package status belongs to. */
const STAGE_OF: Record<string, number> = {
  registered: 0, in_batch: 0,
  in_transit: 1, customs_processing: 1,
  ready_for_delivery: 2, out_for_delivery: 2,
  delivered: 3,
};

export default function PublicTracking() {
  const [, params] = useRoute("/t/:token");
  const token = params?.token ?? "";
  const lang = "ku";

  const { data, isLoading } = trpc.publicTracking.get.useQuery(
    { token },
    { enabled: token.length >= 10, retry: false },
  );

  const L = (k: { ku: string; en: string; ar: string; zh: string }) => pickLang(lang, k);
  const fmt = (d: Date | string | null) =>
    d ? new Intl.DateTimeFormat("ar", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d)) : null;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-5">

        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500">
            <Package className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {L({ ku: "شوێنپێهەڵگرتنی پاکێت", en: "Track a parcel", ar: "تتبع الطرد", zh: "包裹追踪" })}
          </h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {L({ ku: "بارکردن…", en: "Loading…", ar: "جارٍ التحميل…", zh: "加载中…" })}
          </div>
        ) : !data ? (
          /* One answer for every failure. Telling a stranger the difference
             between "no such link" and "that one expired" confirms which
             tokens exist, which is the only useful thing to learn here. */
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="font-medium text-slate-800 dark:text-slate-100">
              {L({ ku: "ئەم لینکە کارا نییە", en: "This link is not active", ar: "هذا الرابط غير فعال", zh: "此链接无效" })}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {L({
                ku: "لەوانەیە بەسەرچووبێت یان کوژێنرابێتەوە. داوا لەو کەسە بکە کە ناردوویەتی.",
                en: "It may have expired or been turned off. Ask whoever sent it to you.",
                ar: "قد يكون منتهيًا أو موقوفًا. اطلب من مرسله رابطًا جديدًا.",
                zh: "可能已过期或被关闭。请向发送者索取。",
              })}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              {data.photoUrl && (
                <img
                  src={data.photoUrl}
                  alt=""
                  className="mb-4 h-40 w-full rounded-xl object-cover"
                />
              )}

              {data.description && (
                <p className="font-semibold text-slate-800 dark:text-slate-100">{data.description}</p>
              )}
              {data.trackingNumber && (
                <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                  {data.trackingNumber}
                </p>
              )}

              <p className="mt-4 text-lg font-semibold text-orange-600 dark:text-orange-400">
                {data.status && PACKAGE_STATUS_LABEL[data.status]
                  ? L(PACKAGE_STATUS_LABEL[data.status]!)
                  : data.batchStatus && STATUS_LABEL[data.batchStatus as BatchStatus]
                    ? L(STATUS_LABEL[data.batchStatus as BatchStatus]!)
                    : L({ ku: "لە ڕێگادایە", en: "On its way", ar: "في الطريق", zh: "运输中" })}
              </p>

              {/* A date only when one was recorded. An invented one becomes a
                  promise, and this reader has no way to check it. */}
              {data.deliveredAt ? (
                <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                  {L({ ku: "گەیشتووە", en: "Delivered", ar: "تم التسليم", zh: "已送达" })} · {fmt(data.deliveredAt)}
                </p>
              ) : data.estimatedArrival ? (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {L({ ku: "چاوەڕوانە", en: "Expected", ar: "متوقع", zh: "预计" })} {fmt(data.estimatedArrival)}
                </p>
              ) : null}
            </div>

            {/* The journey, in four blocks a person recognises. */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                {STAGES.map((stage, i) => {
                  const reached = i <= (STAGE_OF[data.status ?? ""] ?? 0);
                  const Icon = stage.icon;
                  return (
                    <div key={stage.key} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full",
                        reached
                          ? "bg-orange-500 text-white"
                          : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={cn(
                        "text-center text-[10px] leading-tight",
                        reached
                          ? "text-slate-700 dark:text-slate-200"
                          : "text-slate-400 dark:text-slate-500",
                      )}>
                        {L(PACKAGE_STATUS_LABEL[stage.key]!)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Who is carrying it. The whole of the advertisement, and it is
                the truth: this reader is somebody who does not use Wazn yet,
                meeting it while something they were waiting for is on its
                way. Anything pushier would spoil that. */}
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              {L({
                ku: "گەیاندن لەلایەن وەزن ئێکسپرێس",
                en: "Delivered by Wazn Express",
                ar: "الشحن بواسطة وزن إكسبريس",
                zh: "由 Wazn Express 承运",
              })}
              {" · "}
              <a href="/" className="font-medium text-orange-600 hover:underline dark:text-orange-400">
                {L({ ku: "وەزن", en: "waznexpress.com", ar: "وزن", zh: "Wazn" })}
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
