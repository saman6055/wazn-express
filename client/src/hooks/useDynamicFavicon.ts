import { useEffect } from "react";
import { useCompanyInfo } from "./useCompanyInfo";

export function useDynamicFavicon() {
  const { logoUrl } = useCompanyInfo();

  useEffect(() => {
    if (!logoUrl) return;

    // Update all favicon link tags
    const selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
    ];

    selectors.forEach((selector) => {
      const links = document.querySelectorAll(selector);
      links.forEach((link) => {
        (link as HTMLLinkElement).href = logoUrl;
      });
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
