import { Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

/**
 * Read only: says on the company's own code that it is the company's
 * (owner, 2026-11-06 - a box on every profile was one slip from turning any
 * customer into the company). It is chosen on the working-capital page.
 */
export function HouseAccountSwitch({ on }: { customerId?: number; on: boolean }) {
  const { language } = useLanguage();
  if (!on) return null;
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs text-white" data-testid="house-account-badge">
      <Building2 className="h-3 w-3" />
      {pickLang(language, { ku: "حیسابی ناوخۆی کۆمپانیا — مەسارف، نەک قەرز", en: "Company's own account — spending, not debt", ar: "حساب الشركة الداخلي — مصروف لا دين", zh: "公司内部账户 — 支出，非欠款" })}
    </span>
  );
}
