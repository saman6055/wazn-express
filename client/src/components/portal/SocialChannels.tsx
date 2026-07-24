import type { ReactElement } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Social channels row + video helpers for Wazn News.
// The admin sets the channel URLs in Portal Center → Announcements; here we
// render only the ones that are filled in. Brand glyphs are inline SVG
// (lucide has no brand icons).
// ---------------------------------------------------------------------------

function YouTubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
    </svg>
  );
}
function TelegramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 3 2.5 10.5c-1.3.5-1.3 1.3-.2 1.6l4.9 1.5 1.9 5.8c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8L23.9 4.3c.3-1.3-.5-1.9-1.9-1.3zM8.5 13.9l10-6.3c.5-.3 1-.1.6.2l-8.3 7.5-.3 3.4-2-4.8z" />
    </svg>
  );
}
function TikTokGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.8a4.8 4.8 0 0 1-1-.1v6.6a5.6 5.6 0 1 1-5.6-5.6c.2 0 .4 0 .6.1v2.9a2.8 2.8 0 1 0 2 2.7V2h2.8a4.8 4.8 0 0 0 4.4 4.3v2.8a7.6 7.6 0 0 1-3.2-.7z" />
    </svg>
  );
}
function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}

const CHANNELS: {
  key: "youtube" | "telegram" | "tiktok" | "instagram" | "facebook";
  glyph: (p: { className?: string }) => ReactElement;
  color: string;
  label: string;
}[] = [
  { key: "youtube", glyph: YouTubeGlyph, color: "bg-red-600 hover:bg-red-700", label: "YouTube" },
  { key: "telegram", glyph: TelegramGlyph, color: "bg-sky-500 hover:bg-sky-600", label: "Telegram" },
  { key: "tiktok", glyph: TikTokGlyph, color: "bg-black hover:bg-slate-800", label: "TikTok" },
  { key: "instagram", glyph: InstagramGlyph, color: "bg-gradient-to-br from-fuchsia-600 to-amber-500 hover:opacity-90", label: "Instagram" },
  { key: "facebook", glyph: FacebookGlyph, color: "bg-blue-600 hover:bg-blue-700", label: "Facebook" },
];

/** Row of round channel buttons — only the ones the admin filled in. */
export function SocialChannels({ className }: { className?: string }) {
  const { data } = trpc.customerPortal.getNewsChannels.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (!data) return null;
  const present = CHANNELS.filter((c) => data[c.key] && String(data[c.key]).trim().length > 0);
  if (present.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {present.map((c) => {
        const Glyph = c.glyph;
        return (
          <a
            key={c.key}
            href={String(data[c.key])}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={c.label}
            className={cn("inline-flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm transition active:scale-95", c.color)}
          >
            <Glyph className="h-5 w-5" />
          </a>
        );
      })}
    </div>
  );
}

// ---- Video embed helpers ---------------------------------------------------

/** First YouTube video id found in a block of text, or null. */
export function firstYouTubeId(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Responsive 16:9 YouTube embed. */
export function YouTubeEmbed({ id, title }: { id: string; title?: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-lg" style={{ paddingTop: "56.25%" }}>
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube.com/embed/${id}`}
        title={title || "video"}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
