import { useRef, useState } from "react";
import { Type, Upload, Trash2, RotateCcw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  MAX_SCALE,
  MIN_SCALE,
  fontFamilyName,
  useAppearance,
} from "@/contexts/AppearanceContext";
import { useAuth } from "../_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Text size, text colour and typeface — the reader's own controls.
 *
 * Dark mode's recurring complaint was text nobody could read. index.css
 * repairs that automatically; this is the escape hatch for whatever the
 * automatic pass gets wrong, plus the plain accessibility wish underneath it:
 * bigger text, a colour that suits the person reading it, a Kurdish typeface
 * of their own choosing.
 *
 * Every control takes effect the moment it moves and is saved for this browser
 * alone. An admin gets one extra button that pushes the current settings out
 * as the company default.
 */

/** Presets are per mode: white-on-dark and near-black-on-light are the two
 *  starting points, and the warm/cool pairs are for readers who find plain
 *  white glaring. */
const DARK_TONES = [
  { value: "#e8ecf2", label: { ku: "سپی نەرم", en: "Soft white", ar: "أبيض ناعم", zh: "柔白" } },
  { value: "#ffffff", label: { ku: "سپی تەواو", en: "Pure white", ar: "أبيض ناصع", zh: "纯白" } },
  { value: "#ffe9b8", label: { ku: "زەردی گەرم", en: "Warm amber", ar: "كهرماني دافئ", zh: "暖琥珀" } },
  { value: "#bde8f5", label: { ku: "شینی سارد", en: "Cool ice", ar: "أزرق بارد", zh: "冷蓝" } },
];

const LIGHT_TONES = [
  { value: "#1c2430", label: { ku: "ڕەشی نەرم", en: "Soft black", ar: "أسود ناعم", zh: "柔黑" } },
  { value: "#000000", label: { ku: "ڕەشی تەواو", en: "Pure black", ar: "أسود تام", zh: "纯黑" } },
  { value: "#0f2854", label: { ku: "شینی تۆخ", en: "Deep navy", ar: "كحلي غامق", zh: "深藏青" } },
  { value: "#3f3a2f", label: { ku: "قاوەیی", en: "Sepia", ar: "بني", zh: "褐色" } },
];

const ACCEPT = ".ttf,.otf,.woff,.woff2";
const MAX_MB = 5;

export function AppearanceDialog() {
  const { language } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { prefs, fonts, overridden, update, reset, refetchFonts } = useAppearance();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isDark = theme === "dark";
  const tones = isDark ? DARK_TONES : LIGHT_TONES;
  const activeText = (isDark ? prefs.textDark : prefs.textLight) ?? "";
  const activeMuted = (isDark ? prefs.mutedDark : prefs.mutedLight) ?? "";

  const setText = (value: string | null) => update(isDark ? { textDark: value } : { textLight: value });
  const setMuted = (value: string | null) => update(isDark ? { mutedDark: value } : { mutedLight: value });

  const uploadFont = trpc.settings.uploadFont.useMutation();
  const deleteFont = trpc.settings.deleteFont.useMutation();
  const saveDefaults = trpc.settings.setAppearance.useMutation();

  const title = pickLang(language, {
    ku: "ڕووکار و خوێندنەوە",
    en: "Appearance & readability",
    ar: "المظهر وسهولة القراءة",
    zh: "外观与可读性",
  });

  const handleFile = async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(pickLang(language, {
        ku: `فایلەکە زۆر گەورەیە (زۆرترین ${MAX_MB}MB)`,
        en: `File is too large (max ${MAX_MB}MB)`,
        ar: `الملف كبير جداً (الحد ${MAX_MB}MB)`,
        zh: `文件过大（最大 ${MAX_MB}MB）`,
      }));
      return;
    }
    setUploading(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const label = file.name.replace(/\.[^.]+$/, "").slice(0, 60);
      const result = await uploadFont.mutateAsync({ fileName: file.name, label, base64Data });
      refetchFonts();
      // Select it straight away — uploading a font and then having to find it
      // in a list is a step nobody wants.
      const added = result.fonts[result.fonts.length - 1];
      if (added) update({ fontFamily: added.id });
      toast.success(pickLang(language, { ku: "فۆنت زیادکرا", en: "Font added", ar: "تمت إضافة الخط", zh: "字体已添加" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    await deleteFont.mutateAsync({ id });
    if (prefs.fontFamily === id) update({ fontFamily: "default" });
    refetchFonts();
  };

  const handleSaveDefault = async () => {
    await saveDefaults.mutateAsync({
      fontScale: prefs.fontScale,
      textLight: prefs.textLight,
      textDark: prefs.textDark,
      mutedLight: prefs.mutedLight,
      mutedDark: prefs.mutedDark,
      fontFamily: prefs.fontFamily,
      autoFix: prefs.autoFix,
    });
    toast.success(pickLang(language, {
      ku: "کرا بە بنەڕەت بۆ هەموو بەکارهێنەران",
      en: "Saved as the default for everyone",
      ar: "تم الحفظ كإعداد افتراضي للجميع",
      zh: "已保存为所有人的默认设置",
    }));
  };

  const families = [
    { id: "default", label: pickLang(language, { ku: "Rudaw (بنەڕەت)", en: "Rudaw (default)", ar: "Rudaw (افتراضي)", zh: "Rudaw（默认）" }), stack: '"Rudaw", sans-serif' },
    { id: "system", label: pickLang(language, { ku: "فۆنتی سیستەم", en: "System font", ar: "خط النظام", zh: "系统字体" }), stack: "system-ui, sans-serif" },
    ...fonts.map((f) => ({ id: f.id, label: f.label, stack: `"${fontFamilyName(f.id)}", sans-serif` })),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title={title} aria-label={title}>
          <Type className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {pickLang(language, {
              ku: "گۆڕانکارییەکان دەستبەجێ کاردەکەن و بۆ ئەم براوزەرە پاشەکەوت دەبن",
              en: "Changes apply at once and are saved for this browser",
              ar: "تُطبَّق التغييرات فوراً وتُحفظ لهذا المتصفح",
              zh: "更改立即生效并保存在此浏览器中",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ---- Automatic dark-mode repair ---- */}
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <div className="flex-1 space-y-0.5">
              <Label className="text-sm">
                {pickLang(language, {
                  ku: "چاککردنی خۆکاری تێکستی نادیار",
                  en: "Auto-fix unreadable text",
                  ar: "إصلاح تلقائي للنص غير المقروء",
                  zh: "自动修复不可读文本",
                })}
              </Label>
              <p className="text-xs text-muted-foreground">
                {pickLang(language, {
                  ku: "لە دۆخی تاریکدا هەر نووسینێکی تاریک بە خۆکاری ڕوون دەکرێتەوە",
                  en: "In dark mode, any dark text is lightened automatically",
                  ar: "في الوضع الداكن، يُفتَّح أي نص داكن تلقائياً",
                  zh: "深色模式下，深色文字会自动变亮",
                })}
              </p>
            </div>
            <Switch checked={prefs.autoFix} onCheckedChange={(v) => update({ autoFix: v })} />
          </div>

          {/* ---- Font size ---- */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">
                {pickLang(language, { ku: "قەبارەی فۆنت", en: "Text size", ar: "حجم الخط", zh: "字体大小" })}
              </Label>
              <span className="text-sm font-medium tabular-nums">{Math.round(prefs.fontScale * 100)}%</span>
            </div>
            <Slider
              min={MIN_SCALE * 100}
              max={MAX_SCALE * 100}
              step={5}
              value={[Math.round(prefs.fontScale * 100)]}
              onValueChange={([v]) => update({ fontScale: v / 100 })}
            />
          </div>

          {/* ---- Text colour ---- */}
          <div className="space-y-2">
            <Label className="text-sm">
              {pickLang(language, { ku: "ڕەنگی نووسین", en: "Text colour", ar: "لون النص", zh: "文字颜色" })}
              <span className="ms-1 text-xs font-normal text-muted-foreground">
                {isDark
                  ? pickLang(language, { ku: "(دۆخی تاریک)", en: "(dark mode)", ar: "(الوضع الداكن)", zh: "（深色）" })
                  : pickLang(language, { ku: "(دۆخی ڕووناک)", en: "(light mode)", ar: "(الوضع الفاتح)", zh: "（浅色）" })}
              </span>
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={activeText ? "outline" : "secondary"}
                size="sm"
                className="h-8"
                onClick={() => setText(null)}
              >
                {pickLang(language, { ku: "بنەڕەت", en: "Theme default", ar: "افتراضي", zh: "主题默认" })}
              </Button>
              {tones.map((tone) => (
                <button
                  key={tone.value}
                  type="button"
                  onClick={() => setText(tone.value)}
                  title={pickLang(language, tone.label)}
                  aria-label={pickLang(language, tone.label)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border border-border",
                    activeText === tone.value && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                  style={{ background: tone.value }}
                >
                  {/* difference blending keeps the tick visible on a white
                      swatch and on a near-black one alike */}
                  {activeText === tone.value && <Check className="h-3.5 w-3.5 text-white mix-blend-difference" />}
                </button>
              ))}
              <Input
                type="color"
                value={activeText || (isDark ? "#e8ecf2" : "#1c2430")}
                onChange={(e) => setText(e.target.value)}
                className="h-8 w-12 cursor-pointer p-1"
                title={pickLang(language, { ku: "ڕەنگی دڵخواز", en: "Custom colour", ar: "لون مخصص", zh: "自定义颜色" })}
              />
            </div>
          </div>

          {/* ---- Secondary text colour ---- */}
          <div className="space-y-2">
            <Label className="text-sm">
              {pickLang(language, {
                ku: "ڕەنگی نووسینی لاوەکی",
                en: "Secondary text colour",
                ar: "لون النص الثانوي",
                zh: "次要文字颜色",
              })}
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={activeMuted ? "outline" : "secondary"}
                size="sm"
                className="h-8"
                onClick={() => setMuted(null)}
              >
                {pickLang(language, { ku: "بنەڕەت", en: "Theme default", ar: "افتراضي", zh: "主题默认" })}
              </Button>
              <Input
                type="color"
                value={activeMuted || (isDark ? "#a7b0bd" : "#5b6472")}
                onChange={(e) => setMuted(e.target.value)}
                className="h-8 w-12 cursor-pointer p-1"
              />
              <span className="text-xs text-muted-foreground">
                {pickLang(language, {
                  ku: "ناونیشانی بچووک و لەیبڵەکان",
                  en: "Small captions and labels",
                  ar: "التسميات والعناوين الصغيرة",
                  zh: "小标签与说明文字",
                })}
              </span>
            </div>
          </div>

          {/* ---- Typeface ---- */}
          <div className="space-y-2">
            <Label className="text-sm">
              {pickLang(language, { ku: "فۆنت", en: "Typeface", ar: "الخط", zh: "字体" })}
            </Label>
            <div className="space-y-1.5">
              {families.map((f) => {
                const custom = fonts.find((x) => x.id === f.id);
                return (
                  <div
                    key={f.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-border px-3 py-2",
                      prefs.fontFamily === f.id && "border-primary bg-accent"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => update({ fontFamily: f.id })}
                      className="flex flex-1 items-center gap-2 text-start"
                    >
                      <span className="flex-1 text-sm" style={{ fontFamily: f.stack }}>
                        {f.label} — وەزن ئێکسپرێس
                      </span>
                      {prefs.fontFamily === f.id && <Check className="h-4 w-4 text-primary" />}
                    </button>
                    {custom && isAdmin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDelete(f.id)}
                        title={pickLang(language, { ku: "سڕینەوە", en: "Delete", ar: "حذف", zh: "删除" })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {isAdmin && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {pickLang(language, {
                    ku: "فۆنتی نوێ بار بکە",
                    en: "Upload a new font",
                    ar: "رفع خط جديد",
                    zh: "上传新字体",
                  })}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {pickLang(language, {
                    ku: `ttf · otf · woff · woff2 — زۆرترین ${MAX_MB}MB. دوای بارکردن بۆ هەموو بەکارهێنەران بەردەست دەبێت.`,
                    en: `ttf · otf · woff · woff2 — max ${MAX_MB}MB. Available to everyone once uploaded.`,
                    ar: `ttf · otf · woff · woff2 — بحد أقصى ${MAX_MB}MB. متاح للجميع بعد الرفع.`,
                    zh: `ttf · otf · woff · woff2 — 最大 ${MAX_MB}MB。上传后所有人可用。`,
                  })}
                </p>
              </>
            )}
          </div>

          {/* ---- Footer actions ---- */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={reset} disabled={!overridden}>
              <RotateCcw className="h-4 w-4" />
              {pickLang(language, {
                ku: "گەڕانەوە بۆ بنەڕەت",
                en: "Reset to default",
                ar: "إعادة الضبط",
                zh: "恢复默认",
              })}
            </Button>
            {isAdmin && (
              <Button
                type="button"
                size="sm"
                onClick={handleSaveDefault}
                disabled={saveDefaults.isPending}
              >
                {saveDefaults.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {pickLang(language, {
                  ku: "بیکە بە بنەڕەت بۆ هەمووان",
                  en: "Make this the default for everyone",
                  ar: "اجعله الافتراضي للجميع",
                  zh: "设为所有人的默认",
                })}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
