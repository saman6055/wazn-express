import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

/**
 * Marks the company's own code (owner, 2026-11-05: «ئەوە کۆدی کۆمپانیاییە بۆ
 * شت کڕین و پێداویستی کۆمپانیا»). On: its balance is the office's spending,
 * not a customer's debt. The main admin alone sees it.
 */
export function HouseAccountSwitch({ customerId, on }: { customerId: number; on: boolean }) {
  const { language } = useLanguage();
  const isMainAdmin = useAuth().user?.role === "super_admin";
  const utils = trpc.useUtils();
  const set = trpc.ledger.setHouseAccount.useMutation({
    onSuccess: () => { void utils.customers.getById.invalidate({ id: customerId }); void utils.ledger.invalidate(); toast.success(pickLang(language, { ku: "پاشەکەوت کرا", en: "Saved", ar: "تم الحفظ", zh: "已保存" })); },
    onError: (e) => toast.error(e.message),
  });
  if (!isMainAdmin) return null;
  return (
    <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-white/90" data-testid="house-account-switch">
      <input type="checkbox" checked={on} disabled={set.isPending} onChange={(e) => set.mutate({ customerId, on: e.target.checked })} />
      {pickLang(language, { ku: "حیسابی ناوخۆی کۆمپانیا (مەسارف، نەک قەرز)", en: "Company's own account (spending, not debt)", ar: "حساب الشركة الداخلي (مصروف لا دين)", zh: "公司内部账户（支出，非欠款）" })}
    </label>
  );
}
