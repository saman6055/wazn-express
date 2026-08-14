import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useLanguage } from "@/contexts/LanguageContext";
import { compressImage } from "@/lib/imageCompression";
import { onImageError } from "@/lib/imageFallback";
import { isSafeAvatar, MAX_AVATAR_STRING_LENGTH } from "@shared/customerImages";

/**
 * The photo a customer chooses for themselves.
 *
 * One component for all three skins, because the interesting part is not the
 * circle — it is the shrinking, the checking and the two mutations, and three
 * copies of that would be three chances for one skin to send a 6 MB photo
 * straight from somebody's camera roll.
 *
 * Shrunk to 512px before it leaves the phone. A portrait taken on a modern
 * handset is several megabytes; at 512px it lands around 40 KB, which is what
 * makes it reasonable to send with the account on every screen that shows who
 * is signed in.
 *
 * The same allow-list the server uses is applied here first, so a file that
 * would be refused is refused while the customer is still looking at it,
 * rather than after a round trip that says only "Unsupported image".
 */

const AVATAR_MAX_PX = 512;

export interface PortalProfilePhotoProps {
  photoUrl?: string | null;
  fullName?: string | null;
  /** Rendered in the middle when there is no photo. Defaults to a person icon. */
  fallback?: React.ReactNode;
  /** Tailwind size classes for the frame, e.g. "w-20 h-20". */
  sizeClass?: string;
  /** Square with soft corners, or a circle — each skin has its own shape. */
  shapeClass?: string;
  /** The frame behind the fallback. */
  frameClass?: string;
  className?: string;
  onChanged?: () => void;
}

export function PortalProfilePhoto({
  photoUrl,
  fullName,
  fallback,
  sizeClass = "w-20 h-20",
  shapeClass = "rounded-2xl",
  frameClass = "bg-gradient-to-br from-indigo-500 to-purple-600",
  className,
  onChanged,
}: PortalProfilePhotoProps) {
  const { language } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Which photo failed to load, not merely that one did — otherwise a
  // failed photo would keep its replacement hidden too.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const refresh = () => {
    void utils.customerPortal.getMyAccount.invalidate();
    onChanged?.();
  };

  const setPhoto = trpc.customerPortal.setMyPhoto.useMutation({
    onSuccess: () => {
      refresh();
      toast.success(pickLang(language, {
        ku: "وێنەکەت گۆڕدرا",
        en: "Your photo has been updated",
        ar: "تم تحديث صورتك",
        zh: "您的照片已更新",
      }));
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setBusy(false),
  });

  const removePhoto = trpc.customerPortal.removeMyPhoto.useMutation({
    onSuccess: () => {
      refresh();
      toast.success(pickLang(language, {
        ku: "وێنەکە لابرا",
        en: "Photo removed",
        ar: "تمت إزالة الصورة",
        zh: "照片已移除",
      }));
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setBusy(false),
  });

  const pick = async (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(pickLang(language, {
        ku: "تەنها وێنە",
        en: "Images only",
        ar: "الصور فقط",
        zh: "仅限图片",
      }));
      return;
    }

    setBusy(true);
    try {
      const small = await compressImage(file, {
        maxWidth: AVATAR_MAX_PX,
        maxHeight: AVATAR_MAX_PX,
        quality: 0.8,
      });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(small);
      });

      // Checked here as well as on the server. A photo refused after the
      // upload finishes tells the customer nothing they can act on.
      const tooLarge = dataUrl.length > MAX_AVATAR_STRING_LENGTH;
      if (tooLarge || !isSafeAvatar(dataUrl)) {
        setBusy(false);
        toast.error(
          tooLarge
            ? pickLang(language, {
                ku: "وێنەکە زۆر گەورەیە، یەکێکی بچووکتر هەڵبژێرە",
                en: "That photo is too large — choose a smaller one",
                ar: "الصورة كبيرة جدًا — اختر صورة أصغر",
                zh: "照片太大，请选择较小的一张",
              })
            : pickLang(language, {
                ku: "ئەم جۆرە فایلە پەسەند ناکرێت",
                en: "That kind of file is not accepted",
                ar: "هذا النوع من الملفات غير مقبول",
                zh: "不接受此类文件",
              }),
        );
        return;
      }

      setPhoto.mutate({ photo: dataUrl });
    } catch {
      setBusy(false);
      toast.error(pickLang(language, {
        ku: "وێنەکە نەکرایەوە",
        en: "That photo could not be opened",
        ar: "تعذّر فتح الصورة",
        zh: "无法打开该照片",
      }));
    }
  };

  const label = pickLang(language, {
    ku: photoUrl ? "گۆڕینی وێنە" : "دانانی وێنە",
    en: photoUrl ? "Change photo" : "Add photo",
    ar: photoUrl ? "تغيير الصورة" : "إضافة صورة",
    zh: photoUrl ? "更换照片" : "添加照片",
  });

  return (
    <div className={cn("relative", className)}>
      <div className={cn(sizeClass, shapeClass, "overflow-hidden flex items-center justify-center shadow-lg", frameClass)}>
        {photoUrl && brokenUrl !== photoUrl ? (
          <img
            src={photoUrl}
            alt={fullName || label}
            className="w-full h-full object-cover"
            loading="lazy"
            // A photo that will not load leaves the initials showing rather
            // than a torn-page glyph in the middle of the profile.
            onError={(e) => {
              onImageError(e);
              setBrokenUrl(photoUrl);
            }}
          />
        ) : (
          fallback ?? <User className="w-1/2 h-1/2 text-white" />
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          // Cleared so choosing the same file twice still fires a change.
          e.target.value = "";
        }}
      />

      {/* One control, not two. A second floating button would land on the VIP
          star the classic skin already pins to that corner, and on a phone
          two 28px targets a thumb-width apart is a mis-tap waiting. */}
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={busy}
        onClick={() => (photoUrl ? setMenuOpen((open) => !open) : fileRef.current?.click())}
        className={cn(
          "absolute -bottom-1 -end-1 w-8 h-8 rounded-full flex items-center justify-center",
          "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-md",
          "text-slate-600 dark:text-slate-300 transition-transform active:scale-95",
          busy && "opacity-60",
        )}
      >
        <Camera className="w-4 h-4" />
      </button>

      {menuOpen && photoUrl && !busy && (
        <>
          {/* Tapping anywhere else closes it, including on a touch screen
              where there is no such thing as clicking away. */}
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className={cn(
            "absolute top-full mt-2 start-0 z-50 min-w-[10rem] rounded-xl overflow-hidden",
            "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl",
          )}>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                fileRef.current?.click();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60"
            >
              <Camera className="w-4 h-4" />
              {pickLang(language, { ku: "گۆڕینی وێنە", en: "Change photo", ar: "تغيير الصورة", zh: "更换照片" })}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setBusy(true);
                removePhoto.mutate();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30"
            >
              <Trash2 className="w-4 h-4" />
              {pickLang(language, { ku: "لابردنی وێنە", en: "Remove photo", ar: "إزالة الصورة", zh: "移除照片" })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
