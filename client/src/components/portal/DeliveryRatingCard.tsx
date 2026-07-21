import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// DeliveryRatingCard — after a delivery, asks the customer to rate it (1–5
// stars + optional comment). Renders only when there is a recent delivered,
// unrated package. Dismissal is per-package via localStorage so we don't nag.
// ---------------------------------------------------------------------------

export function DeliveryRatingCard({ isDark, language }: { isDark: boolean; language: string }) {
  const utils = trpc.useUtils();
  const { data: pkg } = trpc.customerPortal.getRatablePackage.useQuery();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const submit = trpc.customerPortal.submitDeliveryRating.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "سوپاس بۆ هەڵسەنگاندنەکەت!", en: "Thanks for your rating!", ar: "شكرًا لتقييمك!", zh: "感谢您的评价！" }));
      utils.customerPortal.getRatablePackage.invalidate();
    },
    onError: () => {
      toast.error(pickLang(language, { ku: "هەڵەیەک ڕوویدا", en: "Something went wrong", ar: "حدث خطأ", zh: "出错了" }));
    },
  });

  if (!pkg || dismissed) return null;
  const dismissKey = `rating-dismissed-${pkg.id}`;
  if (typeof window !== "undefined" && localStorage.getItem(dismissKey)) return null;

  const code = pkg.trackingNumber || pkg.packageCode || `#${pkg.id}`;

  return (
    <div className="px-4 mt-4">
      <div className={cn(
        "relative rounded-2xl p-5 shadow-sm border",
        isDark ? "bg-slate-800 border-slate-700" : "bg-white border-amber-100"
      )}>
        <button
          onClick={() => { localStorage.setItem(dismissKey, "1"); setDismissed(true); }}
          className={cn(
            "absolute top-3 end-3 p-1 rounded-full transition-colors",
            isDark ? "hover:bg-slate-700 text-slate-500" : "hover:bg-slate-100 text-slate-400"
          )}
          aria-label="dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className={cn("font-bold text-base", isDark ? "text-white" : "text-slate-800")}>
          {pickLang(language, { ku: "گەیاندنەکەمان چۆن بوو؟", en: "How was your delivery?", ar: "كيف كان التسليم؟", zh: "配送体验如何？" })}
        </h3>
        <p className={cn("text-xs mt-0.5 font-mono", isDark ? "text-slate-400" : "text-slate-500")}>
          {code}
        </p>

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
                    : isDark ? "text-slate-600" : "text-slate-300"
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
