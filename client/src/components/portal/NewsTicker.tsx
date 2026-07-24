import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";
import { Link } from "wouter";

// ---------------------------------------------------------------------------
// NewsTicker — a TV-style scrolling headline strip pinned just above the
// portal bottom nav. Headlines come from published Wazn News posts; the strip
// only shows when the admin has the ticker enabled and there are posts.
// Tapping anywhere on it opens the full /portal/news section.
// ---------------------------------------------------------------------------

export function NewsTicker({ language, isInstalled }: { language: string; isInstalled?: boolean }) {
  const pick = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);

  const { data: channels } = trpc.customerPortal.getNewsChannels.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });
  const { data: posts } = trpc.blog.published.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (channels && channels.tickerEnabled === false) return null;

  const headlines = (posts ?? [])
    .map((p: any) =>
      (language === "ku" && p.titleKu) || (language === "ar" && p.titleAr) || p.titleEn || p.titleKu || p.titleAr,
    )
    .filter(Boolean) as string[];

  if (headlines.length === 0) return null;

  // Duplicate the run so the -50% → 0 loop is seamless.
  const run = [...headlines, ...headlines];

  // Speed scales with how much text there is, so the on-screen glide reads at
  // a natural news-ticker pace (~90px/s) no matter how many headlines exist.
  // ~14px per character is a rough width estimate for the strip's font.
  const contentPx = headlines.reduce((sum, h) => sum + h.length * 14 + 48, 0);
  const durationSec = Math.max(12, Math.round(contentPx / 90));

  return (
    <Link href="/portal/news">
      <div
        className={cn(
          "fixed inset-x-0 z-30 h-9 overflow-hidden bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-md cursor-pointer",
          isInstalled ? "bottom-[76px]" : "bottom-[68px]",
        )}
        dir="ltr"
      >
        <div className="flex items-center h-full">
          {/* Live label */}
          <span className="flex items-center gap-1 shrink-0 h-full px-2.5 bg-black/20 text-[11px] font-black tracking-wide">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            {pick({ ku: "وەزن نیوز", en: "WAZN NEWS", ar: "وزن نيوز", zh: "WAZN 新闻" })}
          </span>
          {/* Scrolling track — two identical runs so the loop is seamless. */}
          <div className="relative flex-1 overflow-hidden h-full">
            <div className="wazn-ticker-track h-full" style={{ animationDuration: `${durationSec}s` }}>
              {run.map((h, i) => (
                <span key={i} className="inline-flex items-center h-full text-[13px] font-semibold px-4 whitespace-nowrap">
                  <span className="opacity-60 mx-2">•</span>
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
