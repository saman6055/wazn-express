import { useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { ContactGlyph } from "@/components/BrandIcons";
import {
  DIRECT_CHANNELS,
  SOCIAL_CHANNELS,
  CONTACT_ADDRESS,
  CONTACT_PAGE_TITLE,
  CONTACT_PAGE_SUBTITLE,
  type ContactChannel,
} from "@/constants/contactChannels";
import { PhoneCall, Copy, Check, ExternalLink } from "lucide-react";
import { copyText } from "@/lib/copyText";

/**
 * Contact — every way to reach the company, on one page.
 *
 * Numbers carry a copy button as well as a link: a customer on a desktop
 * browser cannot dial a tel: link, and often wants to paste the number
 * somewhere rather than call from the portal.
 */
export default function PortalContact() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  const label = (o: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, o);

  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (channel: ContactChannel) => {
    try {
      await copyText(channel.value);
      setCopied(channel.id);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard is blocked on insecure origins; the link still works, so
      // there is nothing worth interrupting the customer about.
    }
  };

  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

  const card = isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 dark:border-slate-800/60 bg-white";

  /** The address row shows the translated address, not a stored literal. */
  const valueOf = (c: ContactChannel) => (c.id === "address" ? label(CONTACT_ADDRESS) : c.value);

  return (
    <PortalLayout>
      <div dir={isRTL ? "rtl" : "ltr"} className="px-3 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <PhoneCall className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight">{label(CONTACT_PAGE_TITLE)}</h1>
            <p className="text-xs text-muted-foreground">{label(CONTACT_PAGE_SUBTITLE)}</p>
          </div>
        </div>

        {/* One tap each — the four things a customer actually wants to do. */}
        <div className="grid grid-cols-4 gap-2">
          {DIRECT_CHANNELS.map((c) => (
            <button
              key={c.id}
              onClick={() => open(c.href)}
              className="flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-white transition active:scale-95"
              style={{ backgroundColor: c.color }}
            >
              <ContactGlyph icon={c.icon} className="h-5 w-5" />
              <span className="text-[11px] font-semibold leading-tight">{label(c.label)}</span>
            </button>
          ))}
        </div>

        {/* Details, with copy where it helps */}
        <div className={cn("divide-y overflow-hidden rounded-2xl border", card, isDark ? "divide-slate-700" : "divide-slate-100")}>
          {DIRECT_CHANNELS.map((c) => (
            <div key={c.id} className="flex items-start gap-3 p-3.5">
              <span className="mt-0.5 shrink-0" style={{ color: c.color }}>
                <ContactGlyph icon={c.icon} className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">{label(c.label)}</p>
                <p
                  className="mt-0.5 break-words text-sm font-medium leading-relaxed"
                  // Numbers and emails read left-to-right even on an RTL page.
                  dir={c.id === "address" ? undefined : "ltr"}
                  style={c.id === "address" ? undefined : { textAlign: isRTL ? "right" : "left" }}
                >
                  {valueOf(c)}
                </p>
                {c.id === "address" && (
                  <button
                    onClick={() => open(c.href)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {label({ ku: "کردنەوە لە گوگڵ ماپ", en: "Open in Google Maps", ar: "افتح في خرائط جوجل", zh: "在 Google 地图中打开" })}
                  </button>
                )}
              </div>

              {c.copyable && (
                <button
                  onClick={() => copy(c)}
                  aria-label="copy"
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-black/5 active:scale-90 dark:hover:bg-white/10"
                >
                  {copied === c.id
                    ? <Check className="h-4 w-4 text-emerald-600" />
                    : <Copy className="h-4 w-4" />}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Social */}
        <div>
          <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">
            {label({ ku: "لە سەکۆکانی کۆمەڵایەتی", en: "On social media", ar: "على وسائل التواصل", zh: "社交平台" })}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SOCIAL_CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => open(c.href)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 text-white transition active:scale-95",
                  // The website sits on its own full-width row at the end.
                  c.id === "website" && "col-span-3 flex-row justify-center",
                )}
                style={{ backgroundColor: c.color }}
              >
                <ContactGlyph icon={c.icon} className="h-5 w-5" />
                <span className="text-[11px] font-semibold leading-tight">{label(c.label)}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="px-1 pb-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          {label({
            ku: "کاتی کارکردن: شەممە — پێنجشەممە. هەر پرسیارێکت هەبوو، لە واتساپ زووترین وەڵام وەردەگریت.",
            en: "Working days: Saturday to Thursday. WhatsApp gets you the fastest reply.",
            ar: "أيام العمل: السبت إلى الخميس. واتساب يمنحك أسرع ردّ.",
            zh: "工作日：周六至周四。通过 WhatsApp 回复最快。",
          })}
        </p>
      </div>
    </PortalLayout>
  );
}
