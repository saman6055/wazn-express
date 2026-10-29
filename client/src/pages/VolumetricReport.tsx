import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Boxes, Loader2, Package, Scale, Truck, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VolumetricDiscountButton } from "@/components/packages/VolumetricDiscount";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

type Words = { ku: string; en: string; ar: string; zh: string };
type Tab = "batch" | "customer" | "box" | "parcel";

const kg = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Number(n.toFixed(2))} kg`);
const usd = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `$${n.toFixed(2)}`);

/**
 * Volumetric parcels, for the office (owner, 2026-10-23): «لە سیستەم هیچ
 * شوێنێک و ڕیپۆرتێک نەبووە بۆ زانینی کێشە قەبارەییەکان». Per batch against
 * its carrier - what customers paid for volume, what the carrier charged us
 * for it, what is left - per customer, per box, and the parcels themselves,
 * biggest gap first, each with its discount button. Figures from
 * server/db/volumetricReport.db.ts.
 */
export default function VolumetricReport() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const [tab, setTab] = useState<Tab>("batch");
  const [batchId, setBatchId] = useState<string>("all");
  const { data: batchList } = trpc.batches.list.useQuery();
  const airBatches = useMemo(
    () => ((batchList as any[]) ?? []).filter((b) => String(b.shippingType).startsWith("air")).sort((a, z) => z.id - a.id),
    [batchList],
  );
  const report = trpc.reports.volumetric.useQuery(batchId === "all" ? {} : { batchId: Number(batchId) });
  const r = report.data;

  const tabs: Array<{ key: Tab; icon: typeof Truck; label: Words }> = [
    { key: "batch", icon: Truck, label: { ku: "باچ و کۆمپانیای گواستنەوە", en: "Batch vs carrier", ar: "الدفعة والناقل", zh: "批次与承运商" } },
    { key: "customer", icon: Users, label: { ku: "کڕیار", en: "Customers", ar: "العملاء", zh: "客户" } },
    { key: "box", icon: Boxes, label: { ku: "بۆکس", en: "Boxes", ar: "الصناديق", zh: "箱子" } },
    { key: "parcel", icon: Package, label: { ku: "پاکێجەکان", en: "Parcels", ar: "الطرود", zh: "包裹" } },
  ];

  const figureHeads = (
    <>
      <TableHead className="text-end">{L({ ku: "کێشی ڕاستەقینە", en: "Scale", ar: "الفعلي", zh: "实际" })}</TableHead>
      <TableHead className="text-end">{L({ ku: "کێشی قەبارەیی", en: "By volume", ar: "الحجمي", zh: "体积重" })}</TableHead>
      <TableHead className="text-end">{L({ ku: "زیادەی قەبارە", en: "Volume extra", ar: "زيادة الحجم", zh: "体积超出" })}</TableHead>
      <TableHead className="text-end">{L({ ku: "داشکان", en: "Discount", ar: "الخصم", zh: "优惠" })}</TableHead>
      <TableHead className="text-end">{L({ ku: "پارەی قەبارە لە کڕیار", en: "Paid for volume", ar: "مدفوع عن الحجم", zh: "体积收入" })}</TableHead>
    </>
  );
  const figureCells = (f: { actualKg: number; volumeKg: number; extraKg: number; discountKg: number; discountUsd: number; paidForVolumeUsd: number }) => (
    <>
      <TableCell className="text-end tabular-nums" dir="ltr">{kg(f.actualKg)}</TableCell>
      <TableCell className="text-end tabular-nums text-amber-700 dark:text-amber-300" dir="ltr">{kg(f.volumeKg)}</TableCell>
      <TableCell className="text-end tabular-nums font-semibold" dir="ltr">+{kg(f.extraKg)}</TableCell>
      <TableCell className="text-end tabular-nums text-emerald-700 dark:text-emerald-300" dir="ltr">
        {f.discountKg > 0 ? `${kg(f.discountKg)} · ${usd(f.discountUsd)}` : "—"}
      </TableCell>
      <TableCell className="text-end tabular-nums font-semibold" dir="ltr">{usd(f.paidForVolumeUsd)}</TableCell>
    </>
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Scale className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              {L({ ku: "بارە قەبارەییەکان", en: "Volumetric parcels", ar: "الطرود الحجمية", zh: "体积重包裹" })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {L({ ku: "تەنها ئاسمانی · تەنها بۆ ئۆفیس، کڕیار نایبینێت", en: "Air only · office only, never shown to customers", ar: "جوي فقط · للمكتب فقط", zh: "仅空运 · 仅办公室可见" })}
            </p>
          </div>
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger className="w-56" data-testid="volumetric-batch-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L({ ku: "هەموو باچەکان", en: "All batches", ar: "كل الدفعات", zh: "全部批次" })}</SelectItem>
              {airBatches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.batchCode}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {report.isLoading || !r ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="volumetric-summary">
              {[
                { label: L({ ku: "کێشی ڕاستەقینە", en: "Scale", ar: "الفعلي", zh: "实际" }), value: kg(r.total.actualKg), tone: "" },
                { label: L({ ku: "کێشی قەبارەیی", en: "By volume", ar: "الحجمي", zh: "体积重" }), value: kg(r.total.volumeKg), tone: "text-amber-700 dark:text-amber-300" },
                { label: L({ ku: "زیادەی قەبارە", en: "Volume extra", ar: "زيادة الحجم", zh: "体积超出" }), value: `+${kg(r.total.extraKg)}`, tone: "" },
                { label: L({ ku: "پارەی قەبارە لە کڕیار", en: "Paid for volume", ar: "مدفوع عن الحجم", zh: "体积收入" }), value: usd(r.total.paidForVolumeUsd), tone: "" },
                { label: L({ ku: "داشکانی قەبارە", en: "Volume discount", ar: "خصم الحجم", zh: "体积优惠" }), value: usd(r.total.discountUsd), tone: "text-emerald-700 dark:text-emerald-300" },
              ].map((c) => (
                <Card key={c.label}>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className={cn("text-xl font-bold tabular-nums", c.tone)} dir="ltr">{c.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {tabs.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium",
                    tab === key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                  data-testid={`volumetric-tab-${key}`}
                >
                  <Icon className="h-4 w-4" />
                  {L(label)}
                </button>
              ))}
            </div>

            <Card>
              <CardContent className="overflow-x-auto p-0">
                {tab === "batch" && (
                  <Table data-testid="volumetric-by-batch">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{L({ ku: "باچ", en: "Batch", ar: "الدفعة", zh: "批次" })}</TableHead>
                        {figureHeads}
                        <TableHead className="text-end">{L({ ku: "کۆمپانیا: زیادەی قەبارە", en: "Carrier: volume extra", ar: "الناقل: زيادة الحجم", zh: "承运商体积超出" })}</TableHead>
                        <TableHead className="text-end">{L({ ku: "تێچوو بۆ کیلۆ", en: "Cost per kg", ar: "التكلفة لكل kg", zh: "每公斤成本" })}</TableHead>
                        <TableHead className="text-end">{L({ ku: "لەسەر من کەوت", en: "Cost to us", ar: "التكلفة علينا", zh: "我方成本" })}</TableHead>
                        <TableHead className="text-end">{L({ ku: "بۆ من ماوە", en: "Left for us", ar: "المتبقي لنا", zh: "我方剩余" })}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.byBatch.map((b) => (
                        <TableRow key={b.batchId}>
                          <TableCell className="font-mono text-sm">
                            <Link href={`/reports/batch-financial/${b.batchId}`} className="text-primary hover:underline">{b.batchCode}</Link>
                          </TableCell>
                          {figureCells(b.figures)}
                          <TableCell className="text-end tabular-nums" dir="ltr">
                            {b.carrier.extraKg === null
                              ? <span className="text-xs text-muted-foreground">{L({ ku: "کێشی کۆمپانیا نەنووسراوە", en: "Carrier weight not entered", ar: "وزن الناقل غير مدخل", zh: "未填承运商重量" })}</span>
                              : `+${kg(b.carrier.extraKg)}`}
                          </TableCell>
                          <TableCell className="text-end tabular-nums" dir="ltr">{b.carrier.costPerKg > 0 ? usd(b.carrier.costPerKg) : "—"}</TableCell>
                          <TableCell className="text-end tabular-nums text-red-700 dark:text-red-300" dir="ltr">{usd(b.carrier.extraCostUsd)}</TableCell>
                          <TableCell
                            className={cn(
                              "text-end tabular-nums font-bold",
                              b.carrier.leftForUsUsd === null ? "" : b.carrier.leftForUsUsd >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300",
                            )}
                            dir="ltr"
                          >
                            {usd(b.carrier.leftForUsUsd)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {tab === "customer" && (
                  <Table data-testid="volumetric-by-customer">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{L({ ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</TableHead>
                        {figureHeads}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.byCustomer.map((c) => (
                        <TableRow key={c.customerId}>
                          <TableCell>
                            <span className="font-medium">{c.customerName}</span>{" "}
                            <span className="font-mono text-xs text-muted-foreground">{c.customerCode}</span>
                          </TableCell>
                          {figureCells(c.figures)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {tab === "box" && (
                  <Table data-testid="volumetric-by-box">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{L({ ku: "بۆکس", en: "Box", ar: "الصندوق", zh: "箱子" })}</TableHead>
                        {figureHeads}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.byBox.map((b) => (
                        <TableRow key={b.boxId}>
                          <TableCell className="font-mono text-sm">
                            <Link href={`/customer-delivery-scanner?box=${b.boxId}`} className="text-primary hover:underline">{b.boxCode}</Link>{" "}
                            <span className="text-xs text-muted-foreground">{b.customerCode}</span>
                          </TableCell>
                          {figureCells(b.figures)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {tab === "parcel" && (
                  <Table data-testid="volumetric-parcels">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{L({ ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "运单号" })}</TableHead>
                        <TableHead>{L({ ku: "کڕیار / باچ", en: "Customer / batch", ar: "العميل / الدفعة", zh: "客户 / 批次" })}</TableHead>
                        {figureHeads}
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.parcels.map((p) => (
                        <TableRow key={p.packageId}>
                          <TableCell className="font-mono text-sm" dir="ltr">{p.trackingNumber || p.packageCode}</TableCell>
                          <TableCell className="text-xs">
                            <span className="font-mono">{p.customerCode ?? "—"}</span> · <span className="font-mono">{p.batchCode ?? "—"}</span>
                          </TableCell>
                          {figureCells(p.figures)}
                          <TableCell>
                            <VolumetricDiscountButton
                              packageId={p.packageId}
                              billedKg={p.figures.discountKg > 0 ? p.figures.chargedKg : null}
                              language={language}
                              onDone={() => { void report.refetch(); }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
