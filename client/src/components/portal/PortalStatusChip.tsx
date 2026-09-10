import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { STATUS_LABEL, batchStatusTone, type BatchStatus } from "@/lib/shipmentFilters";
import { PACKAGE_STATUS_LABEL, packageStatusTone } from "@/lib/packageStatus";

/**
 * The one status chip the portal draws.
 *
 * Every screen used to build its own: the same "delivered" came out as
 * emerald-100/700 on one page, emerald-100/800 on the next, green-100 on a
 * third, in three paddings and two radii. The words were already shared
 * (STATUS_LABEL, PACKAGE_STATUS_LABEL); the colours are now too
 * (BATCH_STATUS_TONE, PACKAGE_STATUS_TONE). This is the shape around them.
 */
export const PORTAL_CHIP =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium";

export function PortalChip({ tone, icon, children, className }: {
  tone: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(PORTAL_CHIP, tone, className)}>
      {icon}
      {children}
    </span>
  );
}

/** A batch's stage, named and coloured from the shared tables. */
export function BatchStatusChip({ status, language, icon, className }: {
  status: string | null | undefined;
  language: string;
  icon?: ReactNode;
  className?: string;
}) {
  const label = STATUS_LABEL[status as BatchStatus];
  return (
    <PortalChip tone={batchStatusTone(status)} icon={icon} className={className}>
      {label ? pickLang(language, label) : "—"}
    </PortalChip>
  );
}

/** A parcel's status, named and coloured from the shared tables. */
export function PackageStatusChip({ status, language, icon, className }: {
  status: string | null | undefined;
  language: string;
  icon?: ReactNode;
  className?: string;
}) {
  const label = PACKAGE_STATUS_LABEL[status ?? ""];
  return (
    <PortalChip tone={packageStatusTone(status)} icon={icon} className={className}>
      {label ? pickLang(language, label) : "—"}
    </PortalChip>
  );
}
