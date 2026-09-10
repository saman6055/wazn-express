import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { BRAND_LOGO_URL } from "@/lib/brand";
import { Package } from "lucide-react";
import { useState } from "react";

interface CompanyLogoProps {
  size?: number;
  className?: string;
  iconClassName?: string;
  fallbackBg?: string;
}

/**
 * The company mark, square, on a white tile.
 *
 * Source order: the logo uploaded in Settings, then the mark built into every
 * deploy (lib/brand), and only when both fail to load, a generic box icon.
 * The tile is always white because the mark is black ink — on the dark
 * sidebar or the dark login pages a transparent logo would simply disappear.
 */
export default function CompanyLogo({
  size = 40,
  className = "",
  iconClassName = "h-5 w-5 text-white",
  fallbackBg = "bg-gradient-to-br from-emerald-500 to-emerald-600",
}: CompanyLogoProps) {
  const { logoUrl } = useCompanyInfo();
  const [failed, setFailed] = useState<string[]>([]);
  const src = [logoUrl, BRAND_LOGO_URL].find((url) => url && !failed.includes(url));

  if (src) {
    return (
      <img
        src={src}
        alt="Logo"
        className={`object-contain rounded-xl ${className}`}
        style={{ width: size, height: size, padding: Math.round(size * 0.08), background: "#fff" }}
        onError={() => setFailed((prev) => [...prev, src])}
      />
    );
  }

  return (
    <div
      className={`rounded-xl ${fallbackBg} flex items-center justify-center shadow-lg ${className}`}
      style={{ width: size, height: size }}
    >
      <Package className={iconClassName} />
    </div>
  );
}
