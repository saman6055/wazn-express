import { useLayoutEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { postText, isPostInLanguage } from "@/lib/blogLang";
import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";
import { Link } from "wouter";

// ---------------------------------------------------------------------------
// NewsTicker — a TV-style scrolling headline strip pinned just above the
// portal bottom nav. Headlines come from published Wazn News posts; the strip
// only shows when the admin has the ticker enabled and there are posts.
// Tapping anywhere on it opens the full /portal/news section.
// ---------------------------------------------------------------------------

export function NewsTicker({ language }: { language: string }) {
  const pick = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);

  const { data: channels } = trpc.customerPortal.getNewsChannels.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });
  const { data: posts } = trpc.blog.published.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Measure the REAL rendered track width and derive the loop duration from
  // it — character-count estimates overshoot badly for Arabic-script text
  // (connected, narrow glyphs), which made the ticker crawl. The track holds
  // the headlines twice, so one full loop travels scrollWidth / 2 pixels;
  // at ~80px/s the glide reads at a calm, unhurried pace on any screen.
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [durationSec, setDurationSec] = useState(20);
  // How many times the headline set repeats inside ONE run. On wide screens a
  // single short set is narrower than the viewport, which would leave a blank
  // gap in the loop — so the set repeats until one run covers the screen.
  const [repeats, setRepeats] = useState(1);
  // Only posts written in the reader's language — no cross-language leakage.
  const headlines = (posts ?? [])
    .filter((p: any) => isPostInLanguage(p, language))
    .map((p: any) => postText(p, "title", language))
    .filter(Boolean) as string[];
  const headlinesKey = headlines.join("|");

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      const oneRunPx = el.scrollWidth / 2;
      if (oneRunPx <= 0) return;
      const containerPx = el.parentElement?.clientWidth || window.innerWidth;
      const oneSetPx = oneRunPx / repeats;
      const needed = Math.max(1, Math.ceil(containerPx / oneSetPx));
      if (needed !== repeats) {
        setRepeats(needed);
        return; // duration recomputes on the next pass with the final width
      }
      setDurationSec(Math.max(10, Math.round(oneRunPx / 80)));
    };
    measure();
    // Fonts loading late change the width — re-measure once they're ready.
    if (typeof document !== "undefined" && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(measure).catch(() => {});
    }
  }, [headlinesKey, repeats]);

  if (channels && channels.tickerEnabled === false) return null;
  if (headlines.length === 0) return null;

  // One run = the headline set repeated enough to cover the screen; the track
  // holds that run twice so the -50% → 0 loop is seamless.
  const oneRun = Array.from({ length: repeats }, () => headlines).flat();
  const run = [...oneRun, ...oneRun];

  return (
    <Link href="/portal/news">
      <div
        className={cn(
          // In-flow (not fixed): the strip lives at the very bottom of the page
          // content, so it only comes into view when the reader scrolls to the
          // end — never a permanently-moving band competing for attention.
          "relative w-full h-9 overflow-hidden bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-md cursor-pointer",
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
            <div ref={trackRef} className="wazn-ticker-track h-full" style={{ animationDuration: `${durationSec}s` }}>
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
