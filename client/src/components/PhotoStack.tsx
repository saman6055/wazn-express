import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/LanguageContext";
import { dedupePhotos } from "@/lib/photoList";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

/**
 * One thumbnail that admits how many photos there really are.
 *
 * Warehouse staff photograph a parcel from several sides, and a customer
 * declaring an order attaches several product shots. Most screens showed the
 * first of them and nothing else — no count, often not even clickable — so the
 * rest may as well not have been taken. This shows the first photo with a
 * count badge, and opens the full set on click.
 *
 * Use it anywhere a single <img> was standing in for a list. For screens that
 * already have their own thumbnail styling, `PhotoLightbox` is the viewer on
 * its own.
 */

export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const { language } = useTranslation();
  const [broken, setBroken] = useState(false);
  const count = photos.length;

  const step = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setBroken(false);
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange]
  );

  // Arrow keys, because flicking through six photos of a parcel with the mouse
  // is the slowest part of checking one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const current = photos[index];
  if (!current) return null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { setBroken(false); onClose(); } }}>
      <DialogContent className="max-w-3xl p-3">
        <DialogTitle className="sr-only">
          {pickLang(language, { ku: "وێنەکان", en: "Photos", ar: "الصور", zh: "照片" })}
        </DialogTitle>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground" dir="ltr">
              {index + 1} / {count}
            </span>
            <a
              href={current}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              {pickLang(language, { ku: "کردنەوە بە قەبارەی ڕەسەن", en: "Open full size", ar: "فتح بالحجم الأصلي", zh: "查看原图" })}
            </a>
          </div>

          {broken ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-20 text-muted-foreground">
              <ImageOff className="h-8 w-8" />
              <p className="text-sm">
                {pickLang(language, {
                  ku: "پەڕگەی ئەم وێنەیە لەسەر سێرڤەر نەماوە",
                  en: "This photo's file is no longer on the server",
                  ar: "لم يعد ملف هذه الصورة على الخادم",
                  zh: "该照片的文件已不在服务器上",
                })}
              </p>
            </div>
          ) : (
            <img
              src={current}
              alt=""
              onError={() => setBroken(true)}
              className="max-h-[70vh] w-full rounded-xl object-contain"
            />
          )}

          {count > 1 && (
            <>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label={pickLang(language, { ku: "وێنەی پێشوو", en: "Previous photo", ar: "الصورة السابقة", zh: "上一张" })}
                  className="rounded-lg border border-border p-2 hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4 rtl:hidden" />
                  <ChevronLeft className="hidden h-4 w-4 rtl:block" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label={pickLang(language, { ku: "وێنەی داهاتوو", en: "Next photo", ar: "الصورة التالية", zh: "下一张" })}
                  className="rounded-lg border border-border p-2 hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4 rtl:hidden" />
                  <ChevronRight className="hidden h-4 w-4 rtl:block" />
                </button>
              </div>

              {/* The strip is the point of the whole thing: six sides of a
                  parcel visible at once, one tap to any of them. */}
              <div className="flex flex-wrap justify-center gap-1.5">
                {photos.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={() => { setBroken(false); onIndexChange(i); }}
                    className={cn(
                      "h-12 w-12 overflow-hidden rounded-lg ring-1 ring-border transition",
                      i === index ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PhotoStack({
  photos,
  className,
  fallback = null,
  showCount = true,
}: {
  photos: (string | null | undefined)[];
  /** Size and shape of the thumbnail, e.g. "h-9 w-9 rounded-lg". */
  className?: string;
  /** Rendered when there is nothing to show. */
  fallback?: React.ReactNode;
  showCount?: boolean;
}) {
  const { language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState(false);

  const list = dedupePhotos(photos);
  if (list.length === 0 || broken) return <>{fallback}</>;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // These thumbnails sit inside clickable rows and cards; opening the
          // photos must not also navigate away from the page.
          e.preventDefault();
          e.stopPropagation();
          setIndex(0);
          setOpen(true);
        }}
        aria-label={pickLang(language, {
          ku: `کردنەوەی ${list.length} وێنە`,
          en: `Open ${list.length} photo${list.length > 1 ? "s" : ""}`,
          ar: `فتح ${list.length} صورة`,
          zh: `打开 ${list.length} 张照片`,
        })}
        className={cn(
          "relative shrink-0 overflow-visible transition active:scale-95",
          className
        )}
      >
        <img
          src={list[0]}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="h-full w-full rounded-[inherit] object-cover"
        />
        {showCount && list.length > 1 && (
          <span
            className="absolute -bottom-1 -start-1 min-w-[1.15rem] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[1.15rem] text-primary-foreground ring-2 ring-background"
            dir="ltr"
          >
            {list.length}
          </span>
        )}
      </button>

      {open && (
        <PhotoLightbox
          photos={list}
          index={index}
          onIndexChange={setIndex}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
