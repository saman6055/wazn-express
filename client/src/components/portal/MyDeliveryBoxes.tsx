import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PackageCheck, CheckCircle2, Loader2, Truck } from "lucide-react";

type L = { ku: string; en: string; ar: string; zh: string };

/**
 * The customer's own delivery boxes, with a way to say "I have received it".
 *
 * Until now a customer could only see their batch's status — one value shared
 * by everyone in that shipment. A box is packed for them alone, so this is the
 * first place the portal can tell them about *their* goods.
 *
 * The confirmation goes one way. Staff can undo one; a customer cannot quietly
 * take back a receipt they have already given.
 */
export function MyDeliveryBoxes({ className }: { className?: string }) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const label = (v: L) => pickLang(language, v);
  const utils = trpc.useUtils();

  const { data: boxes, isLoading } = trpc.customerPortal.getMyDeliveryBoxes.useQuery();
  const [confirming, setConfirming] = useState<number | null>(null);

  const confirm = trpc.customerPortal.confirmBoxReceived.useMutation({
    onSuccess: () => {
      toast.success(label({
        ku: "سوپاس — وەرگرتنەکەت تۆمار کرا",
        en: "Thank you — your receipt is recorded",
        ar: "شكرًا — تم تسجيل الاستلام",
        zh: "谢谢——已记录您的签收",
      }));
      utils.customerPortal.getMyDeliveryBoxes.invalidate();
      utils.customerPortal.getMyPackages.invalidate();
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setConfirming(null),
  });

  // Nothing packed yet is the normal state for most customers most of the
  // time, so this stays silent rather than showing an empty box.
  if (isLoading || !boxes || boxes.length === 0) return null;

  const card = isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 dark:border-slate-800/60 bg-white";

  return (
    <div className={cn("px-4", className)}>
      <div className="mb-2 flex items-center gap-2">
        <PackageCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h2 className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
          {label({ ku: "بۆکسەکانی من", en: "My boxes", ar: "صناديقي", zh: "我的箱子" })}
        </h2>
      </div>

      <div className="space-y-2">
        {boxes.map((box: any) => {
          const isDone = box.status === "delivered";
          const confirmedByCustomer = !!box.customerConfirmedAt;

          return (
            <div key={box.id} className={cn("rounded-2xl border p-3.5", card)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold">{box.boxCode}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {box.totalPackages}{" "}
                    {label({ ku: "پاکەت", en: "packages", ar: "طرد", zh: "件" })}
                  </p>
                </div>

                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    isDone
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
                  )}
                >
                  {isDone
                    ? label({ ku: "گەیشتە دەستت", en: "Received", ar: "تم الاستلام", zh: "已签收" })
                    : label({ ku: "لە ڕێی گەیاندنە", en: "On its way", ar: "في الطريق", zh: "配送中" })}
                </span>
              </div>

              {isDone ? (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {confirmedByCustomer
                    ? label({
                        ku: "خۆت دووپاتت کردەوە کە وەرتگرتووە",
                        en: "You confirmed you received this",
                        ar: "أكّدت أنك استلمته",
                        zh: "您已确认收到",
                      })
                    : label({
                        ku: "لەلایەن تیمی وەزنەوە گەیێنرا",
                        en: "Handed over by the Wazn team",
                        ar: "سُلّم من قِبل فريق وزن",
                        zh: "由 Wazn 团队交付",
                      })}
                </p>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setConfirming(box.id);
                      confirm.mutate({ boxId: box.id });
                    }}
                    disabled={confirming === box.id}
                    className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {confirming === box.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Truck className="h-4 w-4" />
                    )}
                    {label({
                      ku: "وەرمگرت",
                      en: "I have received it",
                      ar: "لقد استلمته",
                      zh: "我已收到",
                    })}
                  </button>
                  {/* Said plainly, because the button cannot be undone. */}
                  <p className="mt-1.5 text-center text-[10.5px] text-muted-foreground">
                    {label({
                      ku: "تەنها کاتێک کلیک بکە کە بەڕاستی بەدەستت گەیشتووە",
                      en: "Only tap this once it is actually in your hands",
                      ar: "اضغط فقط بعد أن يصل فعلًا إلى يدك",
                      zh: "仅在确实收到货后再点击",
                    })}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
