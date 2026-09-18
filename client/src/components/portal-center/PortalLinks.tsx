import { createContext, useContext, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/CopyButton";
import { AlertParcelSheet, type AlertParcel } from "@/components/registrations/AlertParcelSheet";
import { customerCodeOnly } from "@shared/customerCode";

/**
 * The Portal Center's codes, each leading where it lives (owner, 2026-09-18):
 * a customer code opens the customer's profile, a box code opens that box, a
 * tracking opens the parcel — weight, photos, history — in a drawer, and every
 * one of them copies. Nothing in a portal list is left as bare text.
 */

type Words = { ku: string; en: string; ar: string; zh: string };

/** A customer's code: their profile on a click, the code on the copy button. */
export function CustomerCodeLink({ id, code, className }: { id?: number | null; code?: string | null; className?: string }) {
  const { language } = useLanguage();
  if (!code) return null;
  const short = customerCodeOnly(code);
  const L = (w: Words) => pickLang(language, w);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} onClick={(e) => e.stopPropagation()}>
      {id ? (
        <Link
          href={`/customers/${id}`}
          title={L({ ku: "پڕۆفایلی کڕیار", en: "Customer profile", ar: "ملف العميل", zh: "客户资料" })}
          className="font-mono text-sky-700 hover:underline dark:text-sky-300"
          data-customer-link={id}
        >
          <bdi dir="ltr">{short}</bdi>
        </Link>
      ) : (
        <bdi dir="ltr" className="font-mono">{short}</bdi>
      )}
      <CopyButton value={short} label={L({ ku: "کۆپی کۆدی کڕیار", en: "Copy customer code", ar: "نسخ رمز العميل", zh: "复制客户编号" })} />
    </span>
  );
}

/** A box's code: the box itself, open on the boxes page. */
export function BoxCodeLink({ id, code, className }: { id?: number | null; code?: string | null; className?: string }) {
  const { language } = useLanguage();
  if (!code) return null;
  const L = (w: Words) => pickLang(language, w);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} onClick={(e) => e.stopPropagation()}>
      {id ? (
        <Link
          href={`/customer-delivery-scanner?box=${id}`}
          title={L({ ku: "کردنەوەی بۆکس", en: "Open the box", ar: "فتح الصندوق", zh: "打开箱子" })}
          className="font-mono text-sky-700 hover:underline dark:text-sky-300"
          data-box-link={id}
        >
          <bdi dir="ltr">{code}</bdi>
        </Link>
      ) : (
        <bdi dir="ltr" className="font-mono">{code}</bdi>
      )}
      <CopyButton value={code} label={L({ ku: "کۆپی کۆدی بۆکس", en: "Copy box code", ar: "نسخ رمز الصندوق", zh: "复制箱号" })} />
    </span>
  );
}

const ParcelSheetContext = createContext<{ openTracking: (tracking: string) => void; opening: string | null } | null>(null);

/**
 * One parcel drawer for the whole page. A tracking is looked up in the
 * warehouse when clicked; one not registered yet says so instead of opening
 * an empty drawer.
 */
export function ParcelSheetProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const [parcel, setParcel] = useState<AlertParcel | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const openTracking = async (tracking: string) => {
    const wanted = tracking.trim();
    if (!wanted || opening) return;
    setOpening(wanted);
    try {
      const found = await utils.scanning.searchByTracking.fetch({ trackingNumber: wanted });
      if (!found?.found || !found.package) {
        toast.info(
          pickLang(language, {
            ku: "ئەم تراکە هێشتا لە مەخزەن تۆمار نەکراوە",
            en: "This tracking is not registered in the warehouse yet",
            ar: "لم يُسجَّل رقم التتبع هذا في المستودع بعد",
            zh: "此运单号尚未在仓库登记",
          }),
        );
        return;
      }
      const pkg = found.package as Record<string, any>;
      const customer = found.customer as Record<string, any> | null;
      setParcel({
        id: pkg.id,
        packageCode: pkg.packageCode,
        trackingNumber: pkg.trackingNumber ?? wanted,
        customerId: pkg.customerId ?? null,
        customerName: customer?.fullName ?? null,
        customerCode: customer?.customerCode ?? null,
        customerMobile: customer?.mobileNumber ?? null,
        shippingType: pkg.shippingType ?? null,
        registeredAt: pkg.registeredAt ?? null,
        batchId: pkg.batchId ?? null,
        weightKg: pkg.weightKg ?? null,
        lengthCm: pkg.lengthCm ?? null,
        widthCm: pkg.widthCm ?? null,
        heightCm: pkg.heightCm ?? null,
        orderNumbers: found.orderNumbers ?? [],
      });
    } catch (error: any) {
      toast.error(error?.message || pickLang(language, { ku: "هەڵەیەک ڕوویدا", en: "Something went wrong", ar: "حدث خطأ", zh: "出错了" }));
    } finally {
      setOpening(null);
    }
  };

  return (
    <ParcelSheetContext.Provider value={{ openTracking, opening }}>
      {children}
      <AlertParcelSheet parcel={parcel} kind="check" level="high" onClose={() => setParcel(null)} />
    </ParcelSheetContext.Provider>
  );
}

/** A tracking: the parcel's drawer on a click, the tracking on the copy button. */
export function TrackingButton({ tracking, className }: { tracking?: string | null; className?: string }) {
  const { language } = useLanguage();
  const sheet = useContext(ParcelSheetContext);
  if (!tracking) return null;
  const L = (w: Words) => pickLang(language, w);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} onClick={(e) => e.stopPropagation()}>
      {sheet ? (
        <button
          type="button"
          onClick={() => sheet.openTracking(tracking)}
          disabled={sheet.opening === tracking}
          title={L({ ku: "زانیاری پاکەت: کێش، وێنە، مێژوو", en: "The parcel: weight, photos, history", ar: "الطرد: الوزن والصور والسجل", zh: "包裹：重量、照片、记录" })}
          className="font-mono font-semibold text-sky-700 hover:underline disabled:opacity-60 dark:text-sky-300"
          data-tracking-link={tracking}
        >
          <bdi dir="ltr">{tracking}</bdi>
        </button>
      ) : (
        <bdi dir="ltr" className="font-mono font-semibold">{tracking}</bdi>
      )}
      <CopyButton value={tracking} label={L({ ku: "کۆپی تراکینگ", en: "Copy tracking", ar: "نسخ رقم التتبع", zh: "复制运单号" })} />
    </span>
  );
}
