import { useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { cn } from "@/lib/utils";

/**
 * The box receipts (owner, 2026-11-05: «هەموو شتمان بە بۆکس بەستاوە… حیساباتی
 * بۆکس و پسوولەکانی بۆکس لێرە خەزن بێت»). Newest first, searchable; each
 * opens its box. The per-parcel invoices below stay for the history.
 */
export function BoxReceiptsCard() {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const [search, setSearch] = useState("");
  const { data, isLoading } = trpc.deliveryBox.listReceipts.useQuery({ search: search.trim() || undefined, limit: 100 });
  const rows = data ?? [];
  const method = (m: string | null) => {
    const u = String(m ?? "").toUpperCase();
    return u === "CARD" ? "Qi Card" : u === "FIB" ? "FIB" : u === "CASH" || !u ? L({ ku: "کاش", en: "Cash", ar: "نقد", zh: "现金" }) : u;
  };

  return (
    <Card data-testid="box-receipts">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{L({ ku: "وەسڵی بۆکسەکان", en: "Box receipts", ar: "إيصالات الصناديق", zh: "箱子收据" })}</CardTitle>
        <p className="text-xs text-muted-foreground">{L({ ku: "هەر پارەیەک کە بۆ بۆکسێک وەرگیراوە، نوێترین لە سەرەوە. کلیک بکە بۆ کردنەوەی بۆکسەکە.", en: "Every payment taken for a box, newest first. Click to open the box.", ar: "كل دفعة لصندوق، الأحدث أولاً. اضغط لفتح الصندوق.", zh: "每笔箱子收款，最新在上。点击打开箱子。" })}</p>
        <div className="relative mt-2">
          <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 ps-8" placeholder={L({ ku: "ژمارەی وەسڵ، بۆکس یان کڕیار", en: "Receipt, box or customer", ar: "إيصال أو صندوق أو عميل", zh: "收据、箱子或客户" })} data-testid="box-receipts-search" />
        </div>
      </CardHeader>
      <CardContent className="max-h-[420px] overflow-y-auto p-0">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{L({ ku: "هیچ وەسڵێک نییە", en: "No receipts", ar: "لا إيصالات", zh: "无收据" })}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cn("border-t", r.status === "reversed" && "opacity-60")}>
                  <td className="px-3 py-2">
                    <Link href={`/customer-delivery-scanner?box=${r.boxId}`} className="font-mono text-sky-700 hover:underline dark:text-sky-300">{r.boxCode ?? r.boxId}</Link>
                    <div className="text-xs text-muted-foreground"><bdi dir="ltr" className="font-mono">{r.settlementNumber}</bdi>{r.status === "reversed" ? ` · ${L({ ku: "هەڵوەشێنراوە", en: "reversed", ar: "ملغى", zh: "已撤销" })}` : ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="truncate">{r.customerName ?? r.customerCode}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("en-GB")} · {method(r.paymentMethod)}</div>
                  </td>
                  <td className="px-3 py-2 text-end">
                    <bdi dir="ltr" className="font-mono font-semibold tabular-nums">{fmtUsd(r.paidUsd)}</bdi>
                    {r.discountUsd > 0.005 && <div className="text-xs text-amber-700 dark:text-amber-300">{L({ ku: "داشکان", en: "discount", ar: "خصم", zh: "折扣" })} <bdi dir="ltr" className="font-mono">{fmtUsd(r.discountUsd)}</bdi></div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
