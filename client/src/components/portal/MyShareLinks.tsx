import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link2, Loader2, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { copyText } from "@/lib/copyText";
import { cn } from "@/lib/utils";

/**
 * The links this customer has handed out, and the way to close one.
 *
 * Sharing a parcel was built without this, which was a hole rather than a
 * simplification: a link that cannot be seen cannot be turned off, and one
 * sent to the wrong chat is then out in the world for ninety days with
 * nothing anybody can do about it.
 *
 * It also answers a question the customer has and nobody else can: how many
 * people have opened it. A link they sent to one person and that has been
 * read forty times has travelled further than they meant, and they are the
 * only one who can decide that matters.
 *
 * Shows nothing when nothing has been shared, which is most customers.
 */
export function MyShareLinks({ isDark, language }: { isDark: boolean; language: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.customerPortal.myShareLinks.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const L = (k: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, k);

  const revoke = trpc.customerPortal.revokeShareLink.useMutation({
    onSuccess: () => {
      utils.customerPortal.myShareLinks.invalidate();
      toast.success(L({
        ku: "لینکەکە کوژێنرایەوە — چیتر کار ناکات",
        en: "Link turned off — it no longer works",
        ar: "تم إيقاف الرابط — لم يعد يعمل",
        zh: "链接已关闭——不再有效",
      }));
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data || data.length === 0) return null;

  return (
    <div className="px-4 mt-4" data-testid="my-share-links">
      <div
        className={cn(
          "rounded-2xl p-4 ring-1",
          isDark ? "bg-slate-800/60 ring-white/5" : "bg-white dark:bg-slate-800/60 ring-slate-200 dark:ring-white/5",
        )}
      >
        <div className="flex items-center gap-2.5">
          <Link2 className={cn("h-4 w-4", isDark ? "text-slate-400" : "text-slate-500 dark:text-slate-400")} />
          <p className={cn("font-semibold text-sm", isDark ? "text-white" : "text-slate-800 dark:text-slate-100")}>
            {L({
              ku: "ئەو لینکانەی ناردووتن",
              en: "Links you have shared",
              ar: "الروابط التي شاركتها",
              zh: "你分享的链接",
            })}
          </p>
        </div>

        <div className="mt-3 space-y-2">
          {data.map((link: any) => (
            <div
              key={link.id}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg p-2.5",
                isDark ? "bg-slate-900/50" : "bg-slate-50 dark:bg-slate-900/50",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={cn("flex items-center gap-1.5 text-xs",
                                 isDark ? "text-slate-300" : "text-slate-600 dark:text-slate-300")}>
                  <Eye className="h-3.5 w-3.5" />
                  {/* How far it has travelled. Their link, their judgement. */}
                  {link.viewCount === 0
                    ? L({ ku: "هێشتا کەس نەیکردووەتەوە", en: "Not opened yet", ar: "لم يُفتح بعد", zh: "尚未打开" })
                    : `${link.viewCount} ${L({ ku: "جار کراوەتەوە", en: "opens", ar: "مرة فتح", zh: "次打开" })}`}
                </p>
                <p className={cn("text-[11px] mt-0.5",
                                 isDark ? "text-slate-500" : "text-slate-400 dark:text-slate-500")}>
                  {L({ ku: "بەسەردەچێت", en: "Expires", ar: "ينتهي", zh: "到期" })}{" "}
                  {new Intl.DateTimeFormat("ar", { day: "numeric", month: "long" })
                    .format(new Date(link.expiresAt))}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={async () => {
                  const url = `${window.location.origin}/t/${link.token}`;
                  if (await copyText(url)) {
                    toast.success(L({ ku: "کۆپی کرا", en: "Copied", ar: "تم النسخ", zh: "已复制" }));
                  } else {
                    toast.info(url);
                  }
                }}
                data-testid={`share-link-copy-${link.id}`}
              >
                {L({ ku: "کۆپی", en: "Copy", ar: "نسخ", zh: "复制" })}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-red-600 hover:text-red-700 dark:text-red-400"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate({ token: link.token })}
                data-testid={`share-link-revoke-${link.id}`}
              >
                {revoke.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <EyeOff className="h-3.5 w-3.5 me-1" />}
                {L({ ku: "کوژاندنەوە", en: "Turn off", ar: "إيقاف", zh: "关闭" })}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
