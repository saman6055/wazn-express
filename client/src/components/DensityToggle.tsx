import { useEffect, useState } from "react";
import { Rows3, Rows4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

const KEY = "wazn-density";

// Toggles a `data-density="compact"` attribute on <html>, which pure CSS uses to
// tighten every table at once (see index.css). Choice persists in localStorage.
export function DensityToggle() {
  const { language } = useTranslation();
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY) === "compact";
    setCompact(stored);
    document.documentElement.dataset.density = stored ? "compact" : "comfortable";
  }, []);

  const toggle = () => {
    setCompact((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, next ? "compact" : "comfortable");
      document.documentElement.dataset.density = next ? "compact" : "comfortable";
      return next;
    });
  };

  const label = compact
    ? pickLang(language, { ku: "دۆخی ئاسوودە", en: "Comfortable rows", ar: "صفوف مريحة", zh: "宽松行距" })
    : pickLang(language, { ku: "دۆخی چڕ", en: "Compact rows", ar: "صفوف مضغوطة", zh: "紧凑行距" });

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" title={label} aria-label={label} onClick={toggle}>
      {compact ? <Rows3 className="h-4 w-4 text-muted-foreground" /> : <Rows4 className="h-4 w-4 text-muted-foreground" />}
    </Button>
  );
}
