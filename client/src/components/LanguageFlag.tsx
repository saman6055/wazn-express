import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The flag beside a language, drawn rather than typed.
 *
 * The owner, 2026-09-27: Kurdish shows the flag of Kurdistan, Arabic the flag
 * of Iraq, Chinese the flag of China — everywhere a language is chosen, in
 * the portal and in the office. Emoji could not do it: there is no Kurdistan
 * flag emoji at all, and Windows prints every flag emoji as two letters
 * ("IQ", "GB"), which is what the pickers showed on office PCs. An SVG looks
 * the same on every phone and every screen.
 *
 * 3:2, rounded, with a hairline edge so the white stripes do not melt into a
 * white menu. Decorative: the language's own name always sits beside it.
 */

type Code = "ku" | "ar" | "zh" | "en";

/** A star (or sun) as polygon points: `points` tips between two radii. */
function starPoints(cx: number, cy: number, outer: number, inner: number, points: number, rotateDeg = -90): string {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((rotateDeg + (i * 180) / points) * Math.PI) / 180;
    out.push(`${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`);
  }
  return out.join(" ");
}

// Computed once: the shapes never change.
const KURDISTAN_SUN = starPoints(15, 10, 5.1, 2.9, 21);
const CHINA_BIG = starPoints(5, 5, 3, 1.15, 5);
// The four small stars each turn a point toward the big one.
const CHINA_SMALL = [
  [10, 2],
  [12, 4],
  [12, 7],
  [10, 9],
].map(([x, y]) => starPoints(x, y, 1, 0.38, 5, (Math.atan2(5 - y, 5 - x) * 180) / Math.PI));

function Flag({ code, clipId }: { code: Code; clipId: string }) {
  switch (code) {
    case "ku":
      return (
        <>
          <rect width="30" height="20" fill="#ED2024" />
          <rect y="6.667" width="30" height="6.667" fill="#FFFFFF" />
          <rect y="13.333" width="30" height="6.667" fill="#278E43" />
          <polygon points={KURDISTAN_SUN} fill="#FEBD11" />
        </>
      );
    case "ar":
      return (
        <>
          <rect width="30" height="20" fill="#CE1126" />
          <rect y="6.667" width="30" height="6.667" fill="#FFFFFF" />
          <rect y="13.333" width="30" height="6.667" fill="#000000" />
          <text
            x="15"
            y="11.6"
            textAnchor="middle"
            fontSize="4.4"
            fontWeight="700"
            fill="#007A3D"
            direction="rtl"
            fontFamily="'Noto Kufi Arabic', 'Noto Naskh Arabic', Tahoma, sans-serif"
          >
            الله أكبر
          </text>
        </>
      );
    case "zh":
      return (
        <>
          <rect width="30" height="20" fill="#EE1C25" />
          <polygon points={CHINA_BIG} fill="#FFFF00" />
          {CHINA_SMALL.map((p, i) => (
            <polygon key={i} points={p} fill="#FFFF00" />
          ))}
        </>
      );
    case "en":
      // The Union Jack, on the 2:1 grid it is defined on, fitted into 3:2.
      return (
        <svg viewBox="0 0 60 30" width="30" height="20" preserveAspectRatio="xMidYMid slice">
          <clipPath id={clipId}>
            <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
          </clipPath>
          <rect width="60" height="30" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clipId})`} stroke="#C8102E" strokeWidth="4" />
          <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
        </svg>
      );
  }
}

export function LanguageFlag({ code, className }: { code: string; className?: string }) {
  const clipId = `lf-${useId().replace(/:/g, "")}`;
  if (code !== "ku" && code !== "ar" && code !== "zh" && code !== "en") return null;
  return (
    <svg
      viewBox="0 0 30 20"
      aria-hidden="true"
      focusable="false"
      data-flag={code}
      className={cn(
        "inline-block h-[14px] w-[21px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10 dark:ring-white/15",
        className,
      )}
    >
      <Flag code={code} clipId={clipId} />
    </svg>
  );
}
