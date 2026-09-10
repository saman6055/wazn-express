import { useState } from "react";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { BRAND_LOGO_ON_DARK_URL, BRAND_LOGO_URL } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

type Surface = "theme" | "light" | "dark" | "tile";

interface CompanyLogoProps {
  size?: number;
  className?: string;
  iconClassName?: string;
  fallbackBg?: string;
  /**
   * What the mark sits on. It has no background of its own — the colour of
   * its card shows through — so it has to know which ink to use: black on a
   * light surface, the white-ink twin on a dark one. "theme" follows the
   * app's light/dark theme; "tile" keeps a white tile, for a surface whose
   * colour is not known in advance.
   */
  surface?: Surface;
}

/**
 * The company mark, square.
 *
 * The black mark comes from the logo uploaded in Settings, then the mark built
 * into every deploy (lib/brand); only when both fail does a generic box icon
 * appear. On a dark surface the built-in white-ink twin is used, because an
 * uploaded file comes in one colour. The white tile it used to sit on is gone
 * at the owner's request: the mark sits straight on its card.
 */
export default function CompanyLogo({
  size = 40,
  className = "",
  iconClassName = "h-5 w-5 text-white",
  fallbackBg = "bg-gradient-to-br from-emerald-500 to-emerald-600",
  surface = "theme",
}: CompanyLogoProps) {
  const { logoUrl } = useCompanyInfo();
  const [failed, setFailed] = useState<string[]>([]);
  const [darkFailed, setDarkFailed] = useState(false);
  const lightSrc = [logoUrl, BRAND_LOGO_URL].find((url) => url && !failed.includes(url));

  if (!lightSrc) {
    return (
      <div
        className={`rounded-xl ${fallbackBg} flex items-center justify-center shadow-lg ${className}`}
        style={{ width: size, height: size }}
      >
        <Package className={iconClassName} />
      </div>
    );
  }

  const box = { width: size, height: size };
  const onLightError = () => setFailed((prev) => [...prev, lightSrc]);

  // The white-ink twin failing to load is the one case that brings the tile
  // back on a dark surface: black ink on dark would simply not be there.
  const tile = surface === "tile" || (surface !== "light" && darkFailed);
  if (tile || surface === "light") {
    return (
      <img
        src={lightSrc}
        alt="Logo"
        className={cn("object-contain", tile && "rounded-xl", className)}
        style={tile ? { ...box, padding: Math.round(size * 0.08), background: "#fff" } : box}
        onError={onLightError}
      />
    );
  }

  const darkMark = (extra?: string) => (
    <img
      src={BRAND_LOGO_ON_DARK_URL}
      alt="Logo"
      className={cn("object-contain", extra, className)}
      style={box}
      onError={() => setDarkFailed(true)}
    />
  );

  if (surface === "dark") return darkMark();

  return (
    <>
      <img
        src={lightSrc}
        alt="Logo"
        className={cn("object-contain dark:hidden", className)}
        style={box}
        onError={onLightError}
      />
      {darkMark("hidden dark:block")}
    </>
  );
}
