import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ImagePlus,
  X,
  Loader2,
  ZoomIn,
  Upload,
  Camera,
  ClipboardPaste,
} from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

interface CompressedImageUploadProps {
  /** Current images array */
  images: string[];
  /** Callback when images change */
  onChange: (images: string[]) => void;
  /** Max number of images allowed */
  maxImages?: number;
  /** Max dimension for compression (default 1200px) */
  maxDimension?: number;
  /** JPEG quality 0-1 (default 0.75) */
  quality?: number;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Compact mode for bulk form rows */
  compact?: boolean;
  /** Theme color */
  accentColor?: "emerald" | "amber";
  /** Class name for container */
  className?: string;
  /**
   * Listen for Ctrl+V anywhere on the page, not only on this box.
   *
   * A picture is normally copied from a shop page or a chat and then pasted
   * while the operator is looking at the form — not while their cursor is
   * inside a 40-pixel square. Only ever acts on a clipboard that actually
   * carries an image, so pasting text into a field is never taken.
   *
   * Off by default: two uploaders on one page would both answer the same
   * paste. Turn it on for a screen that has exactly one.
   */
  pasteAnywhere?: boolean;
}

export default function CompressedImageUpload({
  images,
  onChange,
  maxImages = 5,
  maxDimension = 1200,
  quality = 0.75,
  disabled = false,
  compact = false,
  accentColor = "emerald",
  className,
  pasteAnywhere = false,
}: CompressedImageUploadProps) {
  const { t, language } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  /** True while a file is being dragged over the box, so it can say so. */
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress image client-side and return data URL (no server upload needed)
  const compressImage = useCallback(
    (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const src = e.target?.result as string;
          if (!src) { reject(new Error("FileReader returned empty")); return; }

          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              if (!ctx) { reject(new Error("No canvas context")); return; }

              let { width, height } = img;
              if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                  height = Math.round((height / width) * maxDimension);
                  width = maxDimension;
                } else {
                  width = Math.round((width / height) * maxDimension);
                  height = maxDimension;
                }
              }

              canvas.width = width || 1;
              canvas.height = height || 1;

              ctx.fillStyle = "#FFFFFF";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              const dataUrl = canvas.toDataURL("image/jpeg", quality);
              if (!dataUrl || dataUrl === "data:,") {
                reject(new Error("Canvas toDataURL returned empty"));
                return;
              }
              resolve(dataUrl);
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error("Image failed to load from data URL"));
          img.src = src;
        };
        reader.onerror = () => reject(new Error("FileReader error"));
        reader.readAsDataURL(file);
      });
    },
    [maxDimension, quality]
  );

  const handleFileSelect = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;

      const remainingSlots = maxImages - images.length;
      if (remainingSlots <= 0) {
        toast.error(t('common.maxImagesAllowed', { max: maxImages }) || `زیاترین ${maxImages} وێنە`);
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      setUploading(true);
      setUploadProgress(0);

      const newDataUrls: string[] = [];
      let processed = 0;

      for (const file of filesToProcess) {
        try {
          // Validate file type
          if (!file.type.startsWith("image/")) {
            toast.error(`${file.name} وێنە نییە`);
            continue;
          }

          // Validate file size (max 20MB before compression)
          if (file.size > 20 * 1024 * 1024) {
            toast.error(`${file.name} زۆر گەورەیە (زیاترین 20MB)`);
            continue;
          }

          // Compress client-side → get data URL
          const dataUrl = await compressImage(file);
          newDataUrls.push(dataUrl);
        } catch (err) {
          console.error("Compress error:", err);
          toast.error(`کۆمپریسکردنی ${file.name} شکستی هێنا`);
        }

        processed++;
        setUploadProgress(Math.round((processed / filesToProcess.length) * 100));
      }

      if (newDataUrls.length > 0) {
        onChange([...images, ...newDataUrls]);
        toast.success(newDataUrls.length === 1 ? "وێنەکە زیادکرا ✓" : `${newDataUrls.length} وێنە زیادکران ✓`);
      }

      setUploading(false);
      setUploadProgress(0);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [images, maxImages, compressImage, onChange]
  );

  const removeImage = useCallback(
    (index: number) => {
      const newImages = images.filter((_, i) => i !== index);
      onChange(newImages);
    },
    [images, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (!disabled) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
    [disabled, handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  /**
   * The images on a clipboard, if any.
   *
   * A screenshot arrives as a file with no name; a picture copied from a web
   * page arrives the same way. Anything that is not an image is left alone,
   * so a paste carrying only text passes straight through to whatever field
   * the cursor is in.
   */
  const imagesFromClipboard = useCallback((data: DataTransfer | null): File[] => {
    if (!data) return [];
    const files: File[] = [];
    for (const item of Array.from(data.items ?? [])) {
      if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    return files;
  }, []);

  const takePastedImages = useCallback(
    (data: DataTransfer | null): boolean => {
      if (disabled || uploading || images.length >= maxImages) return false;
      const files = imagesFromClipboard(data);
      if (files.length === 0) return false;
      handleFileSelect(files);
      return true;
    },
    [disabled, uploading, images.length, maxImages, imagesFromClipboard, handleFileSelect]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (takePastedImages(e.clipboardData)) e.preventDefault();
    },
    [takePastedImages]
  );

  /**
   * Ctrl+V while looking at the form, not only at the little square.
   *
   * The picture is copied from a shop page or a chat and pasted a moment
   * later, with the cursor wherever it happened to be. A paste that carries
   * no image is never touched, so typing and pasting text are unaffected.
   */
  useEffect(() => {
    if (!pasteAnywhere) return;
    const onPaste = (e: ClipboardEvent) => {
      if (takePastedImages(e.clipboardData)) e.preventDefault();
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [pasteAnywhere, takePastedImages]);

  const accentClasses = {
    emerald: {
      border: "border-emerald-300 dark:border-emerald-800/60 hover:border-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      text: "text-emerald-600 dark:text-emerald-400",
      icon: "text-emerald-500",
      badge: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
      ring: "ring-emerald-500/20",
    },
    amber: {
      border: "border-amber-300 dark:border-amber-800/60 hover:border-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      text: "text-amber-600 dark:text-amber-400",
      icon: "text-amber-500",
      badge: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
      ring: "ring-amber-500/20",
    },
  };

  const colors = accentClasses[accentColor];

  // ========== COMPACT MODE (for bulk form) ==========
  if (compact) {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onPaste={handlePaste}
        className={cn(
          "flex items-center gap-2 rounded-lg transition-colors",
          // The small layout used to be the only one you could not drop a
          // file on — it is the one on the two order forms, where the
          // picture is dragged in from a shop page all day.
          dragOver && cn("ring-2 ring-offset-2", colors.ring),
          className,
        )}
      >
        {/* Thumbnail previews */}
        {images.map((url, i) => (
          <div
            key={i}
            className="relative group w-10 h-10 rounded-lg overflow-hidden border bg-muted shrink-0"
          >
            <img
              src={url}
              alt=""
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setPreviewImage(url)}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeImage(i);
              }}
              aria-label={t("common.delete")}
              // Hover-only was invisible on a phone, and 16px was smaller than a fingertip.
              className="absolute -top-1.5 -end-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Upload button */}
        {images.length < maxImages && (
          <label
            className={cn(
              "w-10 h-10 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors shrink-0",
              disabled || uploading
                ? "opacity-50 cursor-not-allowed"
                : colors.border
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={disabled || uploading}
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : dragOver ? (
              <Upload className={cn("w-4 h-4", colors.icon)} />
            ) : (
              <Camera className={cn("w-4 h-4", colors.icon)} />
            )}
          </label>
        )}

        {/* Said once, quietly: the two ways in that a camera icon does not
            suggest on its own. */}
        {images.length === 0 && !uploading && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
            <ClipboardPaste className="h-3 w-3" />
            {pickLang(language, {
              ku: "ڕایبکێشە یان Ctrl+V",
              en: "Drag or Ctrl+V",
              ar: "اسحب أو Ctrl+V",
              zh: "拖入或 Ctrl+V",
            })}
          </span>
        )}

        {/* Preview modal */}
        {previewImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh]">
              <img
                src={previewImage}
                alt=""
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== FULL MODE (for single order form) ==========
  return (
    <div className={cn("space-y-3", className)}>
      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {images.map((url, i) => (
            <div
              key={i}
              className={cn(
                "relative group aspect-square rounded-xl overflow-hidden border-2 bg-muted shadow-sm transition-all hover:shadow-md",
                colors.ring,
                "ring-0 hover:ring-4"
              )}
            >
              <img
                src={url}
              alt={t('common.imageNumber', { index: i + 1 })}
              className="w-full h-full object-cover"
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/30 [@media(hover:hover)]:bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => setPreviewImage(url)}
                  aria-label={t("common.view")}
                  className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                >
                  <ZoomIn className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label={t("common.delete")}
                  className="w-8 h-8 bg-red-500/90 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              {/* Image number badge */}
              <div
                className={cn(
                  "absolute top-1.5 right-1.5 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shadow",
                  colors.badge
                )}
              >
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {images.length < maxImages && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onPaste={handlePaste}
          className={cn(
            "relative rounded-xl border-2 border-dashed transition-all cursor-pointer",
            disabled || uploading
              ? "opacity-50 cursor-not-allowed bg-muted"
              : cn(colors.border, colors.bg, "hover:shadow-md"),
            // Dropping worked here already, but silently — nothing on the
            // screen said the file had been caught.
            dragOver && !disabled && !uploading && cn("ring-2 ring-offset-2 shadow-md", colors.ring),
            images.length === 0 ? "py-10" : "py-6"
          )}
          onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => handleFileSelect(e.target.files)}
          />

          <div className="flex flex-col items-center gap-3">
            {uploading ? (
              <>
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - uploadProgress / 100)}`}
                      strokeLinecap="round"
                      className={colors.text}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn("text-sm font-bold", colors.text)}>
                      {uploadProgress}%
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('common.compressingAndUploading')}
                </p>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center",
                    colors.bg,
                    "border",
                    colors.border
                  )}
                >
                  {images.length === 0 ? (
                    <ImagePlus className={cn("w-7 h-7", colors.icon)} />
                  ) : (
                    <Upload className={cn("w-6 h-6", colors.icon)} />
                  )}
                </div>
                <div className="text-center">
                  <p className={cn("text-sm font-medium", colors.text)}>
                    {images.length === 0
                      ? t('common.uploadProductImage')
                      : t('common.uploadMoreImages')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('common.dragDropOrClick')} • {t('common.maxImagesAllowed', { max: maxImages })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('common.imagesAutoCompressed')}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Image count indicator */}
      {images.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t('common.imagesCount', { count: images.length, max: maxImages })}
          </span>
          {images.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-red-500 dark:text-red-400 hover:text-red-700 transition-colors"
            >
              {t('common.deleteAll')}
            </button>
          )}
        </div>
      )}

      {/* Full preview modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <img
              src={previewImage}
              alt=""
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 w-10 h-10 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
