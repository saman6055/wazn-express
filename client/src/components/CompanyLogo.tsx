import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { Package } from "lucide-react";
import { useState } from "react";

interface CompanyLogoProps {
  size?: number;
  className?: string;
  iconClassName?: string;
  fallbackBg?: string;
}

export default function CompanyLogo({
  size = 40,
  className = "",
  iconClassName = "h-5 w-5 text-white",
  fallbackBg = "bg-gradient-to-br from-emerald-500 to-emerald-600",
}: CompanyLogoProps) {
  const { logoUrl } = useCompanyInfo();
  const [imgError, setImgError] = useState(false);

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt="Logo"
        className={`object-contain rounded-xl ${className}`}
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
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
