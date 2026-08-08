import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { Gift, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/copyText";

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

  // The full company pitch, exactly as the owner wrote it, with the sharer's
  // own code carried inside — so a forwarded message already contains the
  // contact details, address and channels, not just a bare code.
  const shareText = `سڵاو هاوڕێ گیان، من لەگەڵ شەریکەی وەزن ئێستا زۆر بە ئاسانی لە چین کاڵا بە نرخی کۆ داوا دەکەم لەسەر جەم ئەپلیکەیشنە چینییەکان
تۆش بۆ ئەوەی کارەکەت پێشکەوێت و کاڵا بە نرخی کۆ بکڕیت، وەزن ئێکسپرێس باشترین هەڵبژاردەیە

🔹 گەیاندنی خێرا و پارێزراو بۆ بارەکانت تەنها لە ماوەی ١٠ ڕۆژدا 🚀

🎁 کۆدی ناساندنی من لە کاتی تۆمارکردن بڵێ: ${code}

با قازانج و سەرکەوتنەکانت لەگەڵ ئێمە دەست پێبکات! 👇
📞 واتساپ: 07709183535
📞 تەلەفۆن: 07509183535

📍 عنوان: اربیل. 32 بارک سایدین جوازات
📍 ناونیشان: هەولێر، 32 پارک، جۆت سایدی جەوازات 🏢
Map: https://maps.app.goo.gl/2AXdNzfZnxtv4rX3A

📱 پەیوەندی / تواصل:
📞 07709183535
📞 07509183535
💬 07709183535
📧 waznexpress@gmail.com

وزن اكسبریس
وەزن ئێکسپرێس
🌐 www.waznexpress.com
TikTok: wazn.express
Instagram: wazn.express
Telegram: https://t.me/waznexpress
WhatsApp: https://whatsapp.com/channel/0029Vb6AukOK5cDImQtBmz3b`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch {
        // fall through to WhatsApp when the user cancels or share fails
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  };

  // Copy the whole message, not just the code — the point of the card is to
  // hand the customer something ready to paste anywhere.
  const handleCopy = async () => {
    try {
      await copyText(shareText);
      toast.success(pickLang(language, { ku: "پەیامەکە کۆپی کرا ✓", en: "Message copied ✓", ar: "تم نسخ الرسالة ✓", zh: "消息已复制 ✓" }));
    } catch {
      toast.error(pickLang(language, { ku: "نەتوانرا کۆپی بکرێت", en: "Could not copy", ar: "تعذّر النسخ", zh: "无法复制" }));
    }
  };

  return (
    <div className="px-4 mt-4">
      <div className={cn(
        "relative overflow-hidden rounded-2xl p-5 shadow-sm",
        isDark
          ? "bg-gradient-to-br from-fuchsia-900/50 to-purple-900/40 border border-fuchsia-800/40"
          : "bg-gradient-to-br from-fuchsia-50 to-purple-50 border border-fuchsia-200 dark:border-fuchsia-800/60"
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
            <h3 className={cn("font-bold text-base", isDark ? "text-fuchsia-100" : "text-fuchsia-900 dark:text-fuchsia-200")}>
              {pickLang(language, { ku: "هاوڕێکەت بانگهێشت بکە", en: "Invite a friend", ar: "ادعُ صديقًا", zh: "邀请好友" })}
            </h3>
            <p className={cn("text-xs mt-0.5 leading-relaxed", isDark ? "text-fuchsia-300/80" : "text-fuchsia-700 dark:text-fuchsia-300")}>
              {pickLang(language, {
                ku: "پەیامی تەواو لەگەڵ کۆدەکەت — هاوڕێکەت لە کاتی تۆمارکردن باسی بکات.",
                en: "The full message with your code — your friend mentions it when registering.",
                ar: "الرسالة كاملة مع رمزك — يذكره صديقك عند التسجيل.",
                zh: "含您代码的完整消息——好友注册时提及即可。",
              })}
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopy}
                /* Copies the whole pitch, not just the code — the label keeps
                   showing the code so the customer can still read it at a
                   glance. */
                title={pickLang(language, { ku: "کۆپیکردنی پەیامی تەواو", en: "Copy the full message", ar: "نسخ الرسالة كاملة", zh: "复制完整消息" })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-sm font-bold transition active:scale-95",
                  isDark ? "bg-fuchsia-950/60 text-fuchsia-200 hover:bg-fuchsia-950" : "bg-white text-fuchsia-900 dark:text-fuchsia-200 hover:bg-fuchsia-100 shadow-sm"
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
