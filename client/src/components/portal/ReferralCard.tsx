import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { Gift, Share2, Copy } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// ReferralCard — "invite a friend" growth card on the portal home. The
// customer's own customerCode doubles as their referral code: the shared
// message tells the friend to mention it when registering, and staff record
// it on the new account. No money moves automatically.
// ---------------------------------------------------------------------------

export function ReferralCard({ isDark, language }: { isDark: boolean; language: string }) {
  const { data: account } = trpc.customerPortal.getMyAccount.useQuery();
  const code = (account as any)?.customerCode as string | undefined;
  if (!code) return null;

  const shareText = pickLang(language, {
    ku: `سڵاو! من کارگوزاری وەزن ئێکسپرێس بەکاردەهێنم بۆ گواستنەوەی بار لە چینەوە بۆ عێراق — خێرا و متمانەپێکراوە. کاتی تۆمارکردن کۆدی من بڵێ: ${code}`,
    en: `Hi! I use Wazn Express to ship from China to Iraq — fast and reliable. Mention my code when you register: ${code}`,
    ar: `مرحبًا! أستخدم وزن إكسبريس للشحن من الصين إلى العراق — سريع وموثوق. اذكر رمزي عند التسجيل: ${code}`,
    zh: `你好！我使用 Wazn Express 从中国运货到伊拉克——快速可靠。注册时请提及我的代码：${code}`,
  });

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch {
        // fall through to WhatsApp when the user cancels or share fails
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(pickLang(language, { ku: "کۆد کۆپی کرا", en: "Code copied", ar: "تم نسخ الرمز", zh: "代码已复制" }));
    } catch {
      toast.error(code);
    }
  };

  return (
    <div className="px-4 mt-4">
      <div className={cn(
        "relative overflow-hidden rounded-2xl p-5 shadow-sm",
        isDark
          ? "bg-gradient-to-br from-fuchsia-900/50 to-purple-900/40 border border-fuchsia-800/40"
          : "bg-gradient-to-br from-fuchsia-50 to-purple-50 border border-fuchsia-200"
      )}>
        <div className="absolute -top-8 -end-8 w-28 h-28 rounded-full bg-fuchsia-500/10" />
        <div className="relative flex items-start gap-3">
          <div className={cn(
            "p-2.5 rounded-xl shrink-0",
            isDark ? "bg-fuchsia-800/50" : "bg-fuchsia-500/15"
          )}>
            <Gift className={cn("w-5 h-5", isDark ? "text-fuchsia-300" : "text-fuchsia-600")} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn("font-bold text-base", isDark ? "text-fuchsia-100" : "text-fuchsia-900")}>
              {pickLang(language, { ku: "هاوڕێکەت بانگهێشت بکە", en: "Invite a friend", ar: "ادعُ صديقًا", zh: "邀请好友" })}
            </h3>
            <p className={cn("text-xs mt-0.5 leading-relaxed", isDark ? "text-fuchsia-300/80" : "text-fuchsia-700")}>
              {pickLang(language, {
                ku: "کۆدەکەت هاوبەش بکە — هاوڕێکەت لە کاتی تۆمارکردن باسی بکات.",
                en: "Share your code — your friend mentions it when registering.",
                ar: "شارك رمزك — يذكره صديقك عند التسجيل.",
                zh: "分享您的代码——好友注册时提及即可。",
              })}
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopy}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-sm font-bold transition active:scale-95",
                  isDark ? "bg-fuchsia-950/60 text-fuchsia-200 hover:bg-fuchsia-950" : "bg-white text-fuchsia-900 hover:bg-fuchsia-100 shadow-sm"
                )}
              >
                {code}
                <Copy className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 active:scale-95 transition px-3.5 py-2 text-sm font-bold text-white shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                {pickLang(language, { ku: "هاوبەشکردن", en: "Share", ar: "مشاركة", zh: "分享" })}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
