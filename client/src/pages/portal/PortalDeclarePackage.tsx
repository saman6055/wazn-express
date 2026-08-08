import { useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { TutorialHint } from "@/components/TutorialHint";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CompressedImageUpload from "@/components/CompressedImageUpload";
import { PlatformBadge } from "@/components/PlatformSelect";
import {
  PackagePlus,
  ScanBarcode,
  Loader2,
  Trash2,
  CheckCircle2,
  Clock,
  Package,
  StickyNote,
  CalendarDays,
} from "lucide-react";
import { PortalErrorState } from "@/components/portal/PortalErrorState";
import { PhotoStack } from "@/components/PhotoStack";

// Platforms come from productAttributes — the same list the staff order forms
// use — so a shop the admin adds shows up here too. These are only the
// fallback for a database that has not seeded them yet.
const FALLBACK_PLATFORMS = ["Taobao", "Pinduoduo", "Alibaba", "Aliexpress", "Wechat", "1688"];

const STATUS_STYLE: Record<string, { cls: string; icon: typeof Clock }> = {
  pending: { cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: Clock },
  matched: { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 },
  received: { cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Package },
};

export default function PortalDeclarePackage() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  const utils = trpc.useUtils();

  const [trackingNumber, setTrackingNumber] = useState("");
  const [platform, setPlatform] = useState<string>("");
  // One list for the whole system — see FALLBACK_PLATFORMS above.
  const { data: platformAttrs } = trpc.productAttributes.list.useQuery({ type: "platform" });
  const platformOptions = (platformAttrs ?? []).filter((x: any) => x.isActive !== false).map((x: any) => x.value as string);
  const resolvedPlatforms = platformOptions.length > 0 ? platformOptions : FALLBACK_PLATFORMS;
  const [images, setImages] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  // Which declaration is one tap away from being cancelled.
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);

  const { data: declared, isLoading, isError, isFetching, refetch } = trpc.customerPortal.getMyDeclaredPackages.useQuery();

  const resetForm = () => {
    setTrackingNumber("");
    setPlatform("");
    setImages([]);
    setNotes("");
    setPurchaseDate("");
  };

  const declareMutation = trpc.customerPortal.declareIncomingPackage.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, {
        ku: "تراکەکەت تۆمار کرا ✓",
        en: "Tracking registered ✓",
        ar: "تم تسجيل رقم التتبع ✓",
        zh: "运单号已登记 ✓",
      }));
      resetForm();
      utils.customerPortal.getMyDeclaredPackages.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMutation = trpc.customerPortal.cancelDeclaredPackage.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "سڕایەوە", en: "Removed", ar: "تم الحذف", zh: "已删除" }));
      utils.customerPortal.getMyDeclaredPackages.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!trackingNumber.trim()) {
      toast.error(pickLang(language, {
        ku: "ژمارەی تراکینگ پێویستە",
        en: "Tracking number is required",
        ar: "رقم التتبع مطلوب",
        zh: "运单号为必填项",
      }));
      return;
    }
    declareMutation.mutate({
      trackingNumber: trackingNumber.trim(),
      platform: (platform || undefined) as any,
      productImages: images.length > 0 ? images : undefined,
      notes: notes.trim() || undefined,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
    });
  };

  const label = (o: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, o);

  return (
    <PortalLayout>
      <div dir={isRTL ? "rtl" : "ltr"} className="px-3 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <PackagePlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight">
              {label({ ku: "تۆماری تراکی پاکەت", en: "Register package tracking", ar: "تسجيل رقم تتبع الطرد", zh: "登记包裹运单号" })}
            </h1>
            <p className="text-xs text-muted-foreground">
              {label({ ku: "هەرچیت کڕیوە تراکەکەی داخڵ بکە بۆ ئەوەی بەناوی تۆ تۆمار بکرێت", en: "Declare what you bought so it's assigned to you on arrival", ar: "أدخل ما اشتريته ليُسجَّل باسمك عند وصوله", zh: "登记您购买的商品，到货即归到您名下" })}
            </p>
            <TutorialHint section="تۆماری تراک" className="mt-1.5" />
          </div>
        </div>

        {/* Form card */}
        <div className={cn("rounded-2xl border p-4 space-y-4", isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200 dark:border-slate-800/60")}>
          {/* Tracking (required) */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-semibold">
              <ScanBarcode className="h-4 w-4 text-emerald-600" />
              {label({ ku: "ژمارەی تراکینگ", en: "Tracking number", ar: "رقم التتبع", zh: "运单号" })}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              maxLength={100}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder={label({ ku: "بۆ نموونە: 78123456789", en: "e.g. 78123456789", ar: "مثال: 78123456789", zh: "例如：78123456789" })}
              className="h-12 font-mono text-base"
              dir="ltr"
              inputMode="text"
              autoFocus
            />
          </div>

          {/* Optional fields divider */}
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label({ ku: "ئارەزوومەندانە", en: "Optional", ar: "اختياري", zh: "选填" })}
          </p>

          {/* Platform */}
          <div className="space-y-1.5">
            <Label className="text-sm">{label({ ku: "پلاتفۆرم", en: "Platform", ar: "المنصة", zh: "平台" })}</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={label({ ku: "پلاتفۆرم هەڵبژێرە", en: "Choose platform", ar: "اختر المنصة", zh: "选择平台" })} />
              </SelectTrigger>
              <SelectContent>
                {resolvedPlatforms.map((name) => (
                  <SelectItem key={name} value={name}>
                    <span className="flex items-center gap-2">
                      <PlatformBadge name={name} size={18} />
                      {name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Images */}
          <div className="space-y-1.5">
            <Label className="text-sm">{label({ ku: "وێنەی کاڵا", en: "Product photo", ar: "صورة المنتج", zh: "商品图片" })}</Label>
            <CompressedImageUpload images={images} onChange={setImages} maxImages={4} />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              {label({ ku: "تێبینی", en: "Notes", ar: "ملاحظات", zh: "备注" })}
            </Label>
            <Input
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={label({ ku: "بۆ نموونە: ٢ دانە، ڕەنگی ڕەش", en: "e.g. 2 pcs, black", ar: "مثال: قطعتان، أسود", zh: "例如：2件，黑色" })}
            />
          </div>

          {/* Purchase date */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {label({ ku: "بەرواری کڕین", en: "Purchase date", ar: "تاريخ الشراء", zh: "购买日期" })}
            </Label>
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="h-11" dir="ltr" />
          </div>

          <Button onClick={handleSubmit} disabled={declareMutation.isPending} className="h-12 w-full text-base font-bold">
            {declareMutation.isPending ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : <PackagePlus className="me-2 h-5 w-5" />}
            {label({ ku: "تۆمارکردن", en: "Register", ar: "تسجيل", zh: "登记" })}
          </Button>
        </div>

        {/* My declared list */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground">
            {label({ ku: "تراکە تۆمارکراوەکانم", en: "My registered trackings", ar: "أرقام التتبع المسجّلة", zh: "我登记的运单号" })}
          </h2>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <PortalErrorState onRetry={() => void refetch()} isRetrying={isFetching} />
          ) : !declared || declared.length === 0 ? (
            <div className={cn("rounded-2xl border border-dashed py-8 text-center text-sm text-muted-foreground", isDark ? "border-slate-700" : "border-slate-300 dark:border-slate-800/60")}>
              {label({ ku: "هێشتا هیچ تراکێکت تۆمار نەکردووە", en: "You haven't registered any tracking yet", ar: "لم تسجّل أي رقم تتبع بعد", zh: "您还没有登记任何运单号" })}
            </div>
          ) : (
            declared.map((d: any) => {
              const st = STATUS_STYLE[d.status] || STATUS_STYLE.pending;
              const StIcon = st.icon;
              const platformLabel = d.platform || null;
              return (
                <div key={d.id} className={cn("flex items-center gap-3 rounded-2xl border p-3", isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-200 dark:border-slate-800/60")}>
                  <PhotoStack
                    photos={d.productImages ?? []}
                    className="h-14 w-14 rounded-xl border"
                    fallback={
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted/50">
                        <Package className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-bold" dir="ltr">{d.trackingNumber}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", st.cls)}>
                        <StIcon className="h-3 w-3" />
                        {d.status === "matched"
                          ? label({ ku: "گەیشتووە", en: "Arrived", ar: "وصل", zh: "已到货" })
                          : d.status === "received"
                          ? label({ ku: "وەرگیراوە", en: "Received", ar: "مستلم", zh: "已收货" })
                          : label({ ku: "چاوەڕوانی گەیشتن", en: "Awaiting arrival", ar: "بانتظار الوصول", zh: "等待到货" })}
                      </span>
                      {platformLabel && <span className="text-[11px] text-muted-foreground">{platformLabel}</span>}
                    </div>
                    {d.notes && <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.notes}</p>}
                  </div>
                  {d.status === "pending" && (
                    /* Was one tap on a 36-pixel icon, sitting beside the row
                       the customer was reading, and the declaration was gone.
                       The first tap now asks; the second does it. */
                    confirmCancelId === d.id ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-9"
                          onClick={() => {
                            setConfirmCancelId(null);
                            cancelMutation.mutate({ id: d.id });
                          }}
                          disabled={cancelMutation.isPending}
                        >
                          {label({ ku: "دڵنیام", en: "Cancel it", ar: "نعم، ألغِه", zh: "确认取消" })}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9"
                          onClick={() => setConfirmCancelId(null)}
                        >
                          {label({ ku: "نەخێر", en: "Keep", ar: "لا", zh: "保留" })}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => setConfirmCancelId(d.id)}
                        disabled={cancelMutation.isPending}
                        aria-label={label({ ku: "هەڵوەشاندنەوە", en: "Cancel declaration", ar: "إلغاء التصريح", zh: "取消申报" })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
