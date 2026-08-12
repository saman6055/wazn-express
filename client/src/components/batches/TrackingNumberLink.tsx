import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";
import { getAwbTracking, getContainerTracking } from "@/lib/carrierTracking";

/**
 * A batch's air waybill or container number, as a link to the carrier's own
 * tracking page.
 *
 * Most carriers show a form rather than accepting the number in the URL, so
 * when the link can't carry it we copy it to the clipboard on the way out
 * and say so. The click then costs one paste instead of a hunt back through
 * the system for a number the operator has already left behind.
 *
 * A number we can't route anywhere — a mistyped one, most often, since both
 * formats carry a check digit — renders as plain text. It is better to show
 * the number without a link than to open a tracking page that will report
 * nothing found and read as our system being broken.
 */
export function TrackingNumberLink({
  kind,
  value,
  shippingCompany,
  className,
  showCarrier = true,
}: {
  kind: "awb" | "container";
  value: string | null | undefined;
  /** Only used for containers, where it outranks the number's own prefix. */
  shippingCompany?: string | null;
  className?: string;
  showCarrier?: boolean;
}) {
  const { t } = useTranslation();
  if (!value) return null;

  const target =
    kind === "awb" ? getAwbTracking(value) : getContainerTracking(value, shippingCompany);

  if (!target) {
    return <span className={cn("font-mono", className)}>{value}</span>;
  }

  const open = () => {
    if (!target.prefilled) {
      navigator.clipboard?.writeText(value).then(
        () => toast.info(t("batches.trackingCopiedPaste")),
        () => {}
      );
    }
    window.open(target.url, "_blank", "noopener,noreferrer");
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 flex-wrap", className)}>
      <button
        type="button"
        onClick={open}
        title={t("batches.trackOnCarrierSite")}
        className="font-mono text-primary underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-1"
      >
        {value}
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      </button>
      {showCarrier && target.carrierName && (
        <span className="text-xs text-muted-foreground">{target.carrierName}</span>
      )}
    </span>
  );
}
