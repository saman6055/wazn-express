import { Loader2, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { VIEW_AS_WORDS } from "@shared/viewAsCustomer";

/**
 * Opens a customer's portal, look-only, in a tab of its own
 * (shared/viewAsCustomer).
 *
 * One button for every list that offers it: Portal Center and the customers
 * list (owner, 2026-11-05: «لێرەش ڕێگا بدە... لە تابێکی نوێ ببێتەوە»).
 *
 * The tab is opened on the click itself and filled when the token arrives.
 * Opened after the round trip instead, it is no longer the click's own
 * window and the browser may block it as a pop-up.
 */
export function ViewAsCustomerButton({ customerId, name }: { customerId: number; name?: string }) {
  const { language } = useTranslation();
  const label = pickLang(language, VIEW_AS_WORDS.open);
  const view = trpc.portalCenter.viewAsCustomer.useMutation();

  const open = () => {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      toast.error(pickLang(language, {
        ku: "وێبگەڕەکە تابی نوێی ڕێگە نەدا — مۆڵەتی پەنجەرەی نوێ (pop-up) بدە و دووبارە هەوڵ بدە",
        en: "The browser blocked the new tab — allow pop-ups and try again",
        ar: "حجب المتصفح العلامة الجديدة — اسمح بالنوافذ المنبثقة وأعد المحاولة",
        zh: "浏览器阻止了新标签页 — 请允许弹窗后重试",
      }));
      return;
    }
    // The new tab must not be able to reach back into this office page.
    tab.opener = null;
    view.mutate(
      { customerId },
      {
        onSuccess: (result) => {
          tab.location.href = "/portal?viewas=" + encodeURIComponent(result.token);
        },
        onError: (err) => {
          tab.close();
          toast.error(err.message);
        },
      },
    );
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-violet-600 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
      title={name ? `${label} — ${name}` : label}
      aria-label={label}
      disabled={view.isPending}
      data-testid={`view-as-${customerId}`}
      onClick={open}
    >
      {view.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorSmartphone className="h-4 w-4" />}
    </Button>
  );
}
