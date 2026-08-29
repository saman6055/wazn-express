import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Share2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { copyText } from "@/lib/copyText";
import { cn } from "@/lib/utils";

/**
 * Send whoever is receiving this parcel a link they can follow it with.
 *
 * The person they send it to has no account and should not need one. They
 * see that one parcel and nothing else, which is what makes this safe to put
 * on a button rather than behind a warning.
 *
 * Uses the phone's own share sheet where there is one — which on a phone in
 * Iraq means WhatsApp, in one tap, which is where this link is going anyway.
 * Where there is not, it copies, because a share button that silently does
 * nothing is worse than one that does the obvious thing.
 */
export function ShareParcelButton({
  packageId,
  className,
  compact = false,
}: {
  packageId: number;
  className?: string;
  compact?: boolean;
}) {
  const { language } = useTranslation();
  const [done, setDone] = useState(false);
  const L = (k: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, k);

  const create = trpc.customerPortal.createShareLink.useMutation({
    onSuccess: async (link) => {
      const url = `${window.location.origin}/t/${link.token}`;
      const text = L({
        ku: "شوێنپێهەڵگرتنی پاکێتەکە",
        en: "Track this parcel",
        ar: "تتبع هذا الطرد",
        zh: "追踪这件包裹",
      });

      // The phone's own sheet first: one tap to WhatsApp, which is where
      // this is going. It rejects when the reader dismisses it, and that is
      // not a failure worth a message.
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title: text, text, url });
          return;
        } catch {
          return;
        }
      }

      // Through the shared helper, which knows there may be no clipboard at
      // all: it is undefined on an insecure origin and inside the Facebook
      // and Instagram webviews, which is exactly how somebody arrives from an
      // advert. It reports whether it worked, so this can tell the truth.
      if (await copyText(url)) {
        setDone(true);
        setTimeout(() => setDone(false), 2500);
        toast.success(L({
          ku: "لینکەکە کۆپی کرا — بینێرە بۆ هەرکەسێک کە پاکێتەکەی بۆ دەچێت",
          en: "Link copied — send it to whoever is receiving the parcel",
          ar: "تم نسخ الرابط — أرسله لمن سيستلم الطرد",
          zh: "链接已复制——发送给收件人",
        }));
      } else {
        // Showing the address is still an answer. Silence is not.
        toast.info(url);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "sm" : "default"}
      className={cn("gap-1.5", className)}
      disabled={create.isPending}
      onClick={() => create.mutate({ packageId })}
      data-testid={`share-parcel-${packageId}`}
    >
      {create.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : done ? (
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      {!compact && L({ ku: "هاوبەشکردن", en: "Share", ar: "مشاركة", zh: "分享" })}
    </Button>
  );
}
