import { useEffect } from "react";
import { useCompanyInfo } from "./useCompanyInfo";

export function useDynamicFavicon() {
  const { logoUrl } = useCompanyInfo();

  useEffect(() => {
    if (!logoUrl) return;

    // Browser-tab favicon → the raw logo is fine at small sizes.
    // apple-touch-icon (iOS "Add to Home Screen") → the server-rendered
    // square 180px icon so iOS gets a properly padded, aspect-correct icon
    // instead of a possibly-non-square logo. The ?v busts iOS's cache when
    // the logo changes.
    const v = encodeURIComponent(logoUrl).length.toString(36);
    const appleTouchHref = `/app-icons/icon-180.png?v=${v}`;

    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => {
      (link as HTMLLinkElement).href = logoUrl;
    });
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((link) => {
      (link as HTMLLinkElement).href = appleTouchHref;
    });

    // If no favicon link exists, create one
    if (!document.querySelector('link[rel="icon"]')) {
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = logoUrl;
      document.head.appendChild(link);
    }
  }, [logoUrl]);
}
