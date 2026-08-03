import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, ChevronLeft, ChevronRight, ZoomIn, Download, Maximize2 } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

interface ImageGalleryProps {
  images: string[];
  accentColor?: "emerald" | "amber" | "blue" | "indigo";
}

const accentClasses = {
  emerald: {
    ring: "ring-emerald-500",
    bg: "bg-emerald-500",
    text: "text-emerald-600",
    border: "border-emerald-200 dark:border-emerald-800/60",
    lightBg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  amber: {
    ring: "ring-amber-500",
    bg: "bg-amber-500",
    text: "text-amber-600",
    border: "border-amber-200 dark:border-amber-800/60",
    lightBg: "bg-amber-50 dark:bg-amber-950/40",
  },
  blue: {
    ring: "ring-blue-500",
    bg: "bg-blue-500",
    text: "text-blue-600",
    border: "border-blue-200 dark:border-blue-800/60",
    lightBg: "bg-blue-50 dark:bg-blue-950/40",
  },
  indigo: {
    ring: "ring-indigo-500",
    bg: "bg-indigo-500",
    text: "text-indigo-600",
    border: "border-indigo-200 dark:border-indigo-800/60",
    lightBg: "bg-indigo-50 dark:bg-indigo-950/40",
  },
};

export default function ImageGallery({ images, accentColor = "emerald" }: ImageGalleryProps) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const accent = accentClasses[accentColor];

  const openLightbox = useCallback((index: number) => {
    setSelectedIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const goNext = useCallback(() => {
    setSelectedIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setSelectedIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.key === "ArrowRight" ? goNext() : goPrev();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen, closeLightbox, goNext, goPrev]);

  if (!images || images.length === 0) return null;

  return (
    <>
      {/* Gallery Grid */}
      {images.length === 1 ? (
        /* Single image - large display */
        <div
          className="relative group cursor-pointer rounded-xl overflow-hidden border-2 border-gray-100 dark:border-gray-800/60 hover:border-gray-200 transition-all duration-300 shadow-sm hover:shadow-md"
          onClick={() => openLightbox(0)}
        >
          <img
            src={images[0]}
            alt={t('common.productImage')}
            className="w-full max-h-80 object-contain bg-gray-50 dark:bg-gray-950/40"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg">
              <ZoomIn className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </div>
          </div>
        </div>
      ) : images.length === 2 ? (
        /* Two images - side by side */
        <div className="grid grid-cols-2 gap-3">
          {images.map((img, idx) => (
            <div
              key={idx}
              className="relative group cursor-pointer rounded-xl overflow-hidden border-2 border-gray-100 dark:border-gray-800/60 hover:border-gray-200 transition-all duration-300 shadow-sm hover:shadow-md"
              onClick={() => openLightbox(idx)}
            >
              <img
                src={img}
                alt={t('common.productImageNumber', { index: idx + 1 })}
                className="w-full h-48 object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full p-2.5 shadow-lg">
                  <ZoomIn className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Three or more - featured + grid */
        <div className="grid grid-cols-3 gap-3">
          {/* Featured image */}
          <div
            className="col-span-2 row-span-2 relative group cursor-pointer rounded-xl overflow-hidden border-2 border-gray-100 dark:border-gray-800/60 hover:border-gray-200 transition-all duration-300 shadow-sm hover:shadow-md"
            onClick={() => openLightbox(0)}
          >
            <img
              src={images[0]}
              alt={t('common.mainImage')}
              className="w-full h-full min-h-[280px] object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg">
                <Maximize2 className="h-6 w-6 text-gray-700 dark:text-gray-300" />
              </div>
            </div>
            <div className={cn("absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold text-white", accent.bg)}>
              {t('common.mainImage')}
            </div>
          </div>

          {/* Smaller images */}
          {images.slice(1).map((img, idx) => (
            <div
              key={idx + 1}
              className="relative group cursor-pointer rounded-xl overflow-hidden border-2 border-gray-100 dark:border-gray-800/60 hover:border-gray-200 transition-all duration-300 shadow-sm hover:shadow-md"
              onClick={() => openLightbox(idx + 1)}
            >
              <img
                src={img}
                alt={t('common.productImageNumber', { index: idx + 2 })}
                className="w-full h-[134px] object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
                  <ZoomIn className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

          {/* Content */}
          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4 md:p-8">
            {/* Top bar */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
              <div className="flex items-center gap-3">
                <span className="text-white/80 text-sm font-medium bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  {selectedIndex + 1} / {images.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={images[selectedIndex]}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
                  onClick={(e) => e.stopPropagation()}
                  title={t('common.download')}
                >
                  <Download className="h-5 w-5" />
                </a>
                <button
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
                  onClick={closeLightbox}
                  title={t('common.close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Main image */}
            <div
              className="relative max-w-[90vw] max-h-[80vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={images[selectedIndex]}
                alt={t('common.imageNumber', { index: selectedIndex + 1 })}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
            </div>

            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  title={t('common.previous')}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  title={t('common.next')}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="absolute bottom-6 flex items-center gap-2 z-20">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    className={cn(
                      "w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-105",
                      idx === selectedIndex
                        ? "border-white shadow-lg scale-105 ring-2 ring-white/50"
                        : "border-white/30 opacity-60 hover:opacity-100"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(idx);
                    }}
                  >
                    <img
                      src={img}
                      alt={t('common.imageNumber', { index: idx + 1 })}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
