import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { usePortalSSE } from "@/hooks/usePortalSSE";
import { PACKAGE_STATUS_LABEL } from "@/lib/packageStatus";
import { fmtUsd } from "@/lib/portalFormat";

/** Coming back to the tab refreshes at most this often. */
export const PORTAL_FOCUS_REFRESH_MS = 20_000;

/**
 * The portal's one live channel, for every skin.
 *
 * This used to live inside the classic layout only, so a customer on the
 * modern or skin3 chrome had no event stream, no toasts and no announcement
 * — and the classic one, on every event, refreshed exactly two badge
 * counters. A parcel was scanned as delivered, the bell lit up, and the
 * shipments list underneath it stayed as it was.
 *
 * Every event now invalidates the whole customerPortal router (plus the
 * prohibited and support-chat readers), so whatever is on screen refetches.
 * The same refresh runs when the tab comes back into view, because the
 * office actions that matter most — a payment recorded, a batch moved on,
 * a box delivered — emit no event at all today.
 */
export function usePortalRealtime() {
  const { language, t } = useLanguage();
  const utils = trpc.useUtils();

  const refreshEverything = () => {
    void utils.customerPortal.invalidate();
    void utils.prohibited.getMine.invalidate();
    void utils.supportChat.getUnreadCount.invalidate();
  };

  usePortalSSE({
    enabled: true,
    onPackageStatus: (d) => {
      // The customer's word for the status, never the column value.
      const label = PACKAGE_STATUS_LABEL[d.status];
      toast.info(
        t("portal.packageUpdatedNotif", {
          tracking: d.trackingNumber || d.packageId,
          status: label ? pickLang(language, label) : d.status,
        }),
      );
      refreshEverything();
    },
    onNewInvoice: (d) => {
      toast.info(t("portal.newInvoiceNotif", { invoiceNumber: d.invoiceNumber }));
      refreshEverything();
    },
    onPaymentConfirmation: (d) => {
      toast.success(t("portal.paymentConfirmedNotif", { amount: fmtUsd(d.amount) }));
      refreshEverything();
    },
    onNotification: (d) => {
      // Generic catch-all for any customerNotifications row inserted
      // server-side — package status, batch updates, refunds, etc.
      toast.info(d.title || d.body, d.title && d.body ? { description: d.body } : undefined);
      refreshEverything();
    },
    onNews: (d) => {
      const heading = pickLang(language, {
        ku: "وەزن نیوز: بابەتی نوێ",
        en: "Wazn News: new post",
        ar: "وزن نيوز: منشور جديد",
        zh: "Wazn 新闻：新帖子",
      });
      toast.info(heading, { description: d.title || undefined });
      void utils.blog.published.invalidate();
      void utils.blog.featured.invalidate();
    },
  });

  // A phone comes back from the pocket: refresh, but not on every flicker.
  const lastRefreshRef = useRef(0);
  useEffect(() => {
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshRef.current < PORTAL_FOCUS_REFRESH_MS) return;
      lastRefreshRef.current = now;
      void utils.customerPortal.invalidate();
      void utils.prohibited.getMine.invalidate();
      void utils.supportChat.getUnreadCount.invalidate();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [utils]);
}
