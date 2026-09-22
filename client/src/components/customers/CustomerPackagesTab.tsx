import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { PACKAGE_STATUS_LABEL } from "@/lib/packageStatus";
import { SHIPPING_TYPE_LABEL } from "@/lib/shipmentFilters";
import { fmtDate } from "@/lib/numericDate";
import { packagesHref } from "@shared/listLinks";
import { customerCodeOnly } from "@shared/customerCode";

interface PackageRecord {
  id: number;
  packageCode: string;
  trackingNumber?: string;
  shippingType: string;
  weightKg?: string;
  calculatedCostUsd?: string;
  status: string;
  createdAt: string;
}

interface CustomerPackagesTabProps {
  packages: PackageRecord[] | undefined;
  customerId: number;
  /** The customer's code: what "all of this customer's parcels" is searched by. */
  customerCode?: string | null;
  t: (key: string) => string;
}

/**
 * The customer's parcels, on their own page.
 *
 * Owner, 2026-09-22: "each of these, if it has detail somewhere else, take me
 * to the thing itself." So every row opens that parcel in the parcels list —
 * its own row, searched by its tracking — and the count at the foot opens all
 * of them. The words were English on a Kurdish page; they are the page's
 * language now.
 */
export function CustomerPackagesTab({ packages, customerCode, t }: CustomerPackagesTabProps) {
  const { language } = useTranslation();
  const L = (words: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, words);
  const code = customerCodeOnly(customerCode);
  const shown = packages?.slice(0, 10) ?? [];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{L({ ku: "پاکەتەکان", en: "Packages", ar: "الطرود", zh: "包裹" })}</CardTitle>
            <CardDescription>
              {L({
                ku: "هەموو پاکەتەکانی ئەم کڕیارە — کلیک لەسەر ڕیزێک دەتباتە سەر خۆی",
                en: "All this customer's parcels — a row opens that parcel",
                ar: "كل طرود هذا العميل — الضغط على صف يفتح ذلك الطرد",
                zh: "该客户的全部包裹 — 点击一行即可打开该包裹",
              })}
            </CardDescription>
          </div>
          <Badge variant="secondary">{packages?.length ?? 0}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>{L({ ku: "کۆدی پاکەت", en: "Package code", ar: "كود الطرد", zh: "包裹编号" })}</TableHead>
              <TableHead>{L({ ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "运单号" })}</TableHead>
              <TableHead>{L({ ku: "جۆر", en: "Type", ar: "النوع", zh: "类型" })}</TableHead>
              <TableHead>{L({ ku: "کێش", en: "Weight", ar: "الوزن", zh: "重量" })}</TableHead>
              <TableHead>{L({ ku: "نرخ", en: "Cost", ar: "الكلفة", zh: "费用" })}</TableHead>
              <TableHead>{L({ ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
              <TableHead>{L({ ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((pkg) => {
              // The parcel's own row in the list: its tracking when it has one,
              // otherwise the code it was given here.
              const href = packagesHref({ search: pkg.trackingNumber || pkg.packageCode });
              const cell = "block w-full";
              return (
                <TableRow key={pkg.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="p-0 font-mono text-sm">
                    <Link href={href} className={`${cell} px-4 py-2 text-sky-700 underline-offset-2 hover:underline dark:text-sky-300`}>
                      {pkg.packageCode}
                    </Link>
                  </TableCell>
                  <TableCell className="p-0 text-sm">
                    <Link href={href} className={`${cell} px-4 py-2`}>
                      <bdi dir="ltr" className="font-mono">{pkg.trackingNumber ?? "-"}</bdi>
                    </Link>
                  </TableCell>
                  <TableCell className="p-0">
                    <Link href={href} className={`${cell} px-4 py-2`}>
                      {/* Shared wording — this leaked "air regular" in Latin on
                          a Kurdish page. */}
                      <Badge variant="outline" className="text-xs">
                        {SHIPPING_TYPE_LABEL[pkg.shippingType]
                          ? pickLang(language, SHIPPING_TYPE_LABEL[pkg.shippingType]!)
                          : pkg.shippingType.replace(/_/g, " ")}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="p-0 text-sm">
                    <Link href={href} className={`${cell} px-4 py-2`}>
                      {pkg.weightKg ? `${pkg.weightKg} kg` : "-"}
                    </Link>
                  </TableCell>
                  <TableCell className="p-0 font-mono text-sm tabular-nums">
                    <Link href={href} className={`${cell} px-4 py-2`}>
                      ${Number(pkg.calculatedCostUsd ?? 0).toFixed(2)}
                    </Link>
                  </TableCell>
                  <TableCell className="p-0">
                    <Link href={href} className={`${cell} px-4 py-2`}>
                      <Badge
                        variant="outline"
                        className={`capitalize text-xs ${
                          pkg.status === "delivered"
                            ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/60"
                            : pkg.status === "cancelled"
                              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60"
                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                        }`}
                      >
                        {PACKAGE_STATUS_LABEL[pkg.status]
                          ? pickLang(language, PACKAGE_STATUS_LABEL[pkg.status]!)
                          : pkg.status.replace(/_/g, " ")}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="p-0 text-sm text-muted-foreground">
                    <Link href={href} className={`${cell} px-4 py-2`}>
                      <bdi dir="ltr" className="tabular-nums">{fmtDate(new Date(pkg.createdAt))}</bdi>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">
                    {L({ ku: "هیچ پاکەتێک نییە", en: "No parcels yet", ar: "لا توجد طرود", zh: "还没有包裹" })}
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {/* The whole list, filtered to this customer — not an unfiltered one. */}
        {packages && packages.length > shown.length && code && (
          <div className="p-4 text-center border-t">
            <Button asChild variant="outline" size="sm">
              <Link href={packagesHref({ search: code })}>
                {L({
                  ku: `بینینی هەموو ${packages.length} پاکەتەکە`,
                  en: `View all ${packages.length} parcels`,
                  ar: `عرض كل الطرود (${packages.length})`,
                  zh: `查看全部 ${packages.length} 件包裹`,
                })}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
