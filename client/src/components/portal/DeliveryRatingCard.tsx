import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { Star, X, Package as PackageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// DeliveryRatingCard — after a delivery, asks the customer to rate it (1–5
// stars + optional comment) in a bottom sheet that slides up. Shows the
// package thumbnail + description so it's clear which delivery is being rated.
// Renders only when there is a recent delivered, unrated package (single
// existing query — no extra requests). Dismissal is per-package via
// localStorage so we don't nag.
// ---------------------------------------------------------------------------

export function DeliveryRatingCard({ isDark, language }: { isDark: boolean; language: string }) {
  const utils = trpc.useUtils();
  const { data: pkg } = trpc.customerPortal.getRatablePackage.useQuery();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [closed, setClosed] = useState(false);
  const isRTL = language === "ku" || language === "ar";

  const submit = trpc.customerPortal.submitDeliveryRating.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "سوپاس بۆ هەڵسەنگاندنەکەت!", en: "Thanks for your rating!", ar: "شكرًا لتقييمك!", zh: "感谢您的评价！" }));
      setClosed(true);
      utils.customerPortal.getRatablePackage.invalidate();
    },
    onError: () => {
      toast.error(pickLang(language, { ku: "هەڵەیەک ڕوویدا", en: "Something went wrong", ar: "حدث خطأ", zh: "出错了" }));
    },
  });

  if (!pkg) return null;
  const dismissKey = `rating-dismissed-${pkg.id}`;
  const alreadyDismissed = typeof window !== "undefined" && !!localStorage.getItem(dismissKey);
  const open = !closed && !alreadyDismissed;

  const dismiss = () => {
    if (typeof window !== "undefined") localStorage.setItem(dismissKey, "1");
    setClosed(true);
  };

  const code = pkg.trackingNumber || pkg.packageCode || `#${pkg.id}`;
  const photo = Array.isArray((pkg as any).photos) && (pkg as any).photos.length ? (pkg as any).photos[0] as string : null;
  const name = (pkg as any).description as string | null;

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DrawerContent dir={isRTL ? "rtl" : "ltr"} className={cn(isDark ? "bg-slate-900 text-white" : "bg-white")}>
        <div className="mx-auto w-full max-w-lg px-5 pb-6 pt-1">
          <button
            onClick={dismiss}
            className={cn(
              "absolute top-3 end-4 p-1.5 rounded-full transition-colors",
              isDark ? "hover:bg-slate-800 text-slate-500" : "hover:bg-slate-100 text-slate-400"
            )}
            aria-label="dismiss"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Package identity: thumbnail + name + tracking */}
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center",
              isDark ? "bg-slate-800" : "bg-amber-50"
            )}>
              {photo
                ? <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <PackageIcon className={cn("w-6 h-6", isDark ? "text-slate-500" : "text-amber-500")} />}
            </div>
            <div className="flex-1 min-w-0">
              <DrawerTitle className={cn("text-base font-bold", isDark ? "text-white" : "text-slate-800")}>
                {pickLang(language, { ku: "گەیاندنەکەمان چۆن بوو؟", en: "How was your delivery?", ar: "كيف كان التسليم؟", zh: "配送体验如何？" })}
              </DrawerTitle>
              {name && <p className={cn("text-xs mt-0.5 truncate", isDark ? "text-slate-300" : "text-slate-600")}>{name}</p>}
              <DrawerDescription className={cn("text-[11px] font-mono", isDark ? "text-slate-500" : "text-slate-400")}>
                {code}
              </DrawerDescription>
            </div>
          </div>

          {/* Stars */}
          <div className="flex items-center justify-center gap-2.5 my-2" dir="ltr">
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
                    "w-9 h-9 transition-colors",
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
                className={cn("mt-3", isDark && "bg-slate-800 border-slate-700")}
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
      </DrawerContent>
    </Drawer>
  );
}
