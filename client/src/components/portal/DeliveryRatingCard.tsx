import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { Star, X, Package as PackageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PhotoStack } from "@/components/PhotoStack";

// ---------------------------------------------------------------------------
// DeliveryRatingCard — after a delivery, asks the customer to rate it (1–5
// stars + optional comment) as a plain inline card near the bottom of the
// home feed. Deliberately NOT a modal/bottom-sheet: it must never block the
// screen or feel forced — it just sits in the flow and can be dismissed.
// Shows the package thumbnail + description so it's clear which delivery is
// being rated. Renders only when there is a recent delivered, unrated package
// (single existing query — no extra requests). Dismissal is per-package via
// localStorage so we don't nag.
// ---------------------------------------------------------------------------

export function DeliveryRatingCard({ isDark, language }: { isDark: boolean; language: string }) {
  const utils = trpc.useUtils();
  const { data: pkg } = trpc.customerPortal.getRatablePackage.useQuery();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  // Keyed by package, not a bare boolean. `closed` used to latch for the whole
  // session, so a second delivery worth rating in the same visit was never
  // offered — and the stars and comment kept the previous parcel's values.
  const [closedFor, setClosedFor] = useState<number | null>(null);
  const isRTL = language === "ku" || language === "ar";

  const submit = trpc.customerPortal.submitDeliveryRating.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "سوپاس بۆ هەڵسەنگاندنەکەت!", en: "Thanks for your rating!", ar: "شكرًا لتقييمك!", zh: "感谢您的评价！" }));
      setClosedFor(pkg?.id ?? null);
      // The stars and comment kept the previous parcel's values, so the next
      // delivery arrived pre-rated with someone else's words in the box.
      setRating(0);
      setHover(0);
      setComment("");
      utils.customerPortal.getRatablePackage.invalidate();
    },
    onError: () => {
      toast.error(pickLang(language, { ku: "هەڵەیەک ڕوویدا", en: "Something went wrong", ar: "حدث خطأ", zh: "出错了" }));
    },
  });

  if (!pkg || closedFor === pkg.id) return null;
  const dismissKey = `rating-dismissed-${pkg.id}`;
  if (typeof window !== "undefined" && localStorage.getItem(dismissKey)) return null;

  const dismiss = () => {
    if (typeof window !== "undefined") localStorage.setItem(dismissKey, "1");
    setClosedFor(pkg.id);
  };

  const code = pkg.trackingNumber || pkg.packageCode || `#${pkg.id}`;
  const photos: string[] = Array.isArray((pkg as any).photos) ? (pkg as any).photos : [];
  const name = (pkg as any).description as string | null;

  return (
    <div className="px-4 mt-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className={cn(
        "relative rounded-2xl p-5 shadow-sm border",
        isDark ? "bg-slate-800 border-slate-700" : "bg-white border-amber-100 dark:border-amber-800/60",
      )}>
        <button
          onClick={dismiss}
          className={cn(
            "absolute top-3 end-3 p-1 rounded-full transition-colors",
            isDark ? "hover:bg-slate-700 text-slate-500" : "hover:bg-slate-100 text-slate-400",
          )}
          aria-label="dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Package identity: thumbnail + name + tracking */}
        <div className="flex items-center gap-3">
          <PhotoStack
            photos={photos}
            className="w-14 h-14 rounded-xl"
            fallback={
              <div className={cn(
                "w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center",
                isDark ? "bg-slate-900" : "bg-amber-50 dark:bg-amber-950/40",
              )}>
                <PackageIcon className={cn("w-6 h-6", isDark ? "text-slate-500" : "text-amber-500")} />
              </div>
            }
          />
          <div className="flex-1 min-w-0 pe-6">
            <h3 className={cn("text-base font-bold leading-tight", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
              {pickLang(language, { ku: "گەیاندنەکەمان چۆن بوو؟", en: "How was your delivery?", ar: "كيف كان التسليم؟", zh: "配送体验如何？" })}
            </h3>
            {name && <p className={cn("text-xs mt-0.5 truncate", isDark ? "text-slate-300" : "text-slate-600")}>{name}</p>}
            <p className={cn("text-[11px] font-mono", isDark ? "text-slate-500" : "text-slate-400")}>{code}</p>
          </div>
        </div>

        {/* Stars */}
        <div className="flex items-center gap-1.5 mt-3" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="p-0.5 transition-transform active:scale-90"
              aria-label={`${n} stars`}
            >
              <Star
                className={cn(
                  "w-8 h-8 transition-colors",
                  (hover || rating) >= n
                    ? "fill-amber-400 text-amber-400"
                    : isDark ? "text-slate-600" : "text-slate-300",
                )}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={pickLang(language, { ku: "تێبینی (ئارەزوومەندانە)", en: "Comment (optional)", ar: "تعليق (اختياري)", zh: "评论（可选）" })}
              className={cn("mt-3", isDark && "bg-slate-900 border-slate-600")}
            />
            <Button
              onClick={() => submit.mutate({ packageId: pkg.id, rating, comment: comment.trim() || undefined })}
              disabled={submit.isPending}
              className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-white font-bold"
            >
              {submit.isPending
                ? pickLang(language, { ku: "ناردن…", en: "Sending…", ar: "جارٍ الإرسال…", zh: "发送中…" })
                : pickLang(language, { ku: "ناردنی هەڵسەنگاندن", en: "Submit rating", ar: "إرسال التقييم", zh: "提交评价" })}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
