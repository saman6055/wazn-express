import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

/**
 * The company's one code (owner, 2026-11-06). Chosen here only, by typing it;
 * choosing another moves it. Main admin only, as the page is.
 */
export function HouseAccountSetting() {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const utils = trpc.useUtils();
  const { data: current } = trpc.ledger.houseAccount.useQuery(undefined, { retry: false });
  const [code, setCode] = useState("");
  const [editing, setEditing] = useState(false);
  const set = trpc.ledger.setHouseAccount.useMutation({
    onSuccess: () => { setEditing(false); setCode(""); void utils.ledger.invalidate(); toast.success(L({ ku: "پاشەکەوت کرا", en: "Saved", ar: "تم الحفظ", zh: "已保存" })); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="rounded-lg border p-3 text-sm" data-testid="house-account-setting">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {L({ ku: "کۆدی کۆمپانیا (کڕینی کۆمپانیا بۆ خۆی):", en: "The company's own code:", ar: "رمز الشركة:", zh: "公司自用代码：" })}{" "}
          {current
            ? <Link href={`/finance/customer/${current.id}`} className="font-semibold underline">{current.customerCode}</Link>
            : <span className="text-muted-foreground">{L({ ku: "دانەنراوە", en: "not set", ar: "غير محدد", zh: "未设置" })}</span>}
        </span>
        {!editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>{L({ ku: "گۆڕین", en: "Change", ar: "تغيير", zh: "更改" })}</Button>}
      </div>
      {editing && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="AZ341" className="h-9 w-40" data-testid="house-account-code" />
          <Button size="sm" disabled={code.trim().length < 2 || set.isPending} onClick={() => set.mutate({ customerCode: code.trim() })}>{L({ ku: "دانان", en: "Set", ar: "تعيين", zh: "设置" })}</Button>
          {current && <Button size="sm" variant="ghost" disabled={set.isPending} onClick={() => set.mutate({ customerCode: null })}>{L({ ku: "لابردن", en: "Clear", ar: "إزالة", zh: "清除" })}</Button>}
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setCode(""); }}>{L({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}</Button>
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{L({ ku: "تەنها یەک کۆد. هەرچی لەسەری بنووسرێت مەسارفی کۆمپانیایە، نەک قەرزی کڕیار.", en: "One code only. What is written on it is the company's spending, not customer debt.", ar: "رمز واحد فقط. ما يُقيَّد عليه مصروف للشركة.", zh: "仅一个代码。其上记账为公司支出。" })}</p>
    </div>
  );
}
