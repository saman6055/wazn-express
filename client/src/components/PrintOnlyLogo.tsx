import { useState } from "react";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { BRAND_LOGO_URL } from "@/lib/brand";

/**
 * The mark, on paper only.
 *
 * Pages printed with window.print() hide the sidebar and the top bar — the
 * only places the logo lives on screen — so a printed page carried no mark at
 * all. This sits at the top of such a page, invisible until it is printed.
 * The uploaded logo first, the built-in mark if it is missing or fails.
 */
export function PrintOnlyLogo({ className = "" }: { className?: string }) {
  const { logoUrl } = useCompanyInfo();
  const [failed, setFailed] = useState(false);
  const src = logoUrl && !failed ? logoUrl : BRAND_LOGO_URL;
  return (
    <div className={`hidden print:flex items-center justify-center pb-3 ${className}`}>
      <img src={src} alt="" className="h-12 w-auto" onError={() => setFailed(true)} />
    </div>
  );
}
