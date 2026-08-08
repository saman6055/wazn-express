import { lazy, Suspense, type ReactNode } from "react";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";

// Lazy, so a customer only downloads the chrome their skin actually uses.
const ModernPortalLayout = lazy(() =>
  import("@/components/ModernPortalLayout").then((m) => ({ default: m.ModernPortalLayout })),
);
const Skin3PortalLayout = lazy(() => import("@/components/Skin3PortalLayout"));

/**
 * The portal chrome, whichever skin the company has chosen.
 *
 * The skin is a global admin setting, but only five of the portal's
 * twenty-seven screens ever asked what it was — the other twenty-two imported
 * the classic layout directly. So a customer on the modern skin tapped
 * "Messages" or "Track" and landed on a page with an entirely different bottom
 * bar, a different header, and a search field that appeared from nowhere. The
 * app changed shape as they walked through it, which reads as unfinished
 * however good each screen is on its own.
 *
 * Every page renders this instead. The four screens that have real per-skin
 * designs still branch on their own, because for those the difference is the
 * point; for the rest, the chrome follows and the content stays as it is.
 */
export function PortalLayout({ children }: { children: ReactNode }) {
  const { portalTheme } = usePortalTheme();

  if (portalTheme === "modern") {
    return (
      <Suspense fallback={<CustomerPortalLayout>{children}</CustomerPortalLayout>}>
        <ModernPortalLayout>{children}</ModernPortalLayout>
      </Suspense>
    );
  }

  if (portalTheme === "skin3") {
    return (
      <Suspense fallback={<CustomerPortalLayout>{children}</CustomerPortalLayout>}>
        <Skin3PortalLayout>{children}</Skin3PortalLayout>
      </Suspense>
    );
  }

  return <CustomerPortalLayout>{children}</CustomerPortalLayout>;
}
