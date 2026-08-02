import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SHIPPING_TYPE_LABEL } from "@/lib/shipmentFilters";
import {
  ClipboardList, LayoutGrid, Table2, Camera, CameraOff, Copy, User, Search,
  Plane, Ship, AlertTriangle, Users, Package as PackageIcon,
} from "lucide-react";

type L = { ku: string; en: string; ar: string; zh: string };

/** A registration row as the list endpoint returns it. */
type Registration = {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  categoryId: number | null;
  isUnclaimed: boolean;
  weightKg: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  volumeCbm: string | null;
  shippingType: "air_regular" | "air_irregular" | "sea";
  description: string | null;
  photos: string[] | null;
  calculatedCostUsd: string | null;
  status: string;
  createdAt: string | Date;
  registeredAt?: string | Date | null;
  registeredByName?: string | null;
  orderType?: string | null;
};

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/** Local midnight, not UTC — "today" has to mean today in Erbil. */
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
/** yyyy-mm-dd for <input type="date">, built from local parts so the day never shifts. */
function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type RangeKey = "today" | "yesterday" | "week" | "month" | "custom";

function rangeFor(key: Exclude<RangeKey, "custom">): { from: Date; to: Date } {
  const today = startOfDay(new Date());
  switch (key) {
    case "today":
      return { from: today, to: addDays(today, 1) };
    case "yesterday":
      return { from: addDays(today, -1), to: today };
    case "week":
      return { from: addDays(today, -6), to: addDays(today, 1) };
    case "month":
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: addDays(today, 1) };
  }
}

/**
 * Everything that came in through Quick Register, with the photos taken at the
 * warehouse shown first.
 *
 * This used to be a tab buried inside the packages page, rendered with the
 * generic 12-column packages table — no photos, no category, no dimensions, no
 * record of who entered it. Which is the wrong shape: what staff want here is
 * "what came in today, from whom, and does it look right", and that is a
 * question you answer by looking at pictures, not at a row of codes.
 */
export default function Registrations() {
  const { language } = useLanguage();
  const label = (v: L) => pickLang(language, v);

  const [view, setView] = useState<"cards" | "table">("cards");
  const [groupByCustomer, setGroupByCustomer] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState(toInputDate(startOfDay(new Date())));
  const [customTo, setCustomTo] = useState(toInputDate(startOfDay(new Date())));
  const [search, setSearch] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { from, to } = useMemo(() => {
    if (rangeKey !== "custom") return rangeFor(rangeKey);
    // The picker's end date is inclusive; the query bound is exclusive.
    return { from: startOfDay(new Date(customFrom)), to: addDays(startOfDay(new Date(customTo)), 1) };
  }, [rangeKey, customFrom, customTo]);

  const { data, isLoading } = trpc.packages.list.useQuery({
    status: "registered",
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
    pageSize: 500,
    search: search.trim() || undefined,
  });

  const { data: customers } = trpc.customers.list.useQuery(undefined, { staleTime: 300_000 });
  const { data: categories } = trpc.productCategories.list.useQuery(undefined, { staleTime: 300_000 });

  const customerById = useMemo(() => {
    const m = new Map<number, { name: string; code: string }>();
    for (const c of (customers as any[]) ?? []) {
      m.set(c.id, { name: c.fullName ?? "", code: c.customerCode ?? "" });
    }
    return m;
  }, [customers]);

  const categoryById = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of (categories as any[]) ?? []) {
      // Only nameEn is guaranteed; the translated columns are nullable, so
      // fall back rather than render an empty chip.
      m.set(c.id, pickLang(language, { ku: c.nameKu, en: c.nameEn, ar: c.nameAr, zh: c.nameEn }) || c.nameEn);
    }
    return m;
  }, [categories, language]);

  const rows: Registration[] = useMemo(() => {
    const list = ((data as any)?.data ?? []) as Registration[];
    return [...list].sort((a, b) => {
      const at = new Date(a.registeredAt ?? a.createdAt).getTime();
      const bt = new Date(b.registeredAt ?? b.createdAt).getTime();
      return bt - at; // newest first — "what came in today" reads top-down
    });
  }, [data]);

  const totals = useMemo(() => {
    let airKg = 0, seaCbm = 0, value = 0, noPhoto = 0, noWeight = 0, unclaimed = 0;
    const custs = new Set<number>();
    for (const r of rows) {
      if (r.shippingType === "sea") seaCbm += num(r.volumeCbm);
      else airKg += num(r.weightKg);
      value += num(r.calculatedCostUsd);
      if (!r.photos || r.photos.length === 0) noPhoto++;
      if (num(r.weightKg) <= 0) noWeight++;
      if (r.isUnclaimed || !r.customerId) unclaimed++;
      else custs.add(r.customerId);
    }
    return { pieces: rows.length, customers: custs.size, airKg, seaCbm, value, noPhoto, noWeight, unclaimed };
  }, [rows]);

  /** Rows in display order: flat by time, or bucketed per customer. */
  const groups = useMemo(() => {
    if (!groupByCustomer) return null;
    const m = new Map<string, { key: string; code: string; name: string; items: Registration[] }>();
    for (const r of rows) {
      const key = r.customerId ? String(r.customerId) : "unclaimed";
      if (!m.has(key)) {
        const c = r.customerId ? customerById.get(r.customerId) : undefined;
        m.set(key, {
          key,
          code: c?.code || label({ ku: "بێ خاوەن", en: "Unclaimed", ar: "بلا مالك", zh: "无主" }),
          name: c?.name || "—",
          items: [],
        });
      }
      m.get(key)!.items.push(r);
    }
    return Array.from(m.values()).sort((a, b) => b.items.length - a.items.length);
  }, [rows, groupByCustomer, customerById, language]);

  const copyTracking = (tn: string) => {
    navigator.clipboard.writeText(tn);
    toast.success(label({ ku: "تراک کۆپی کرا", en: "Tracking copied", ar: "تم نسخ التتبّع", zh: "已复制追踪号" }));
  };

  const rangeButtons: { key: RangeKey; text: L }[] = [
    { key: "today", text: { ku: "ئەمڕۆ", en: "Today", ar: "اليوم", zh: "今天" } },
    { key: "yesterday", text: { ku: "دوێنێ", en: "Yesterday", ar: "أمس", zh: "昨天" } },
    { key: "week", text: { ku: "٧ ڕۆژ", en: "7 days", ar: "٧ أيام", zh: "7 天" } },
    { key: "month", text: { ku: "ئەم مانگە", en: "This month", ar: "هذا الشهر", zh: "本月" } },
    { key: "custom", text: { ku: "دیاریکراو", en: "Custom", ar: "مخصّص", zh: "自定义" } },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <ClipboardList className="h-6 w-6 text-sky-600 dark:text-sky-400" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold">
            {label({ ku: "تۆمارەکان", en: "Registrations", ar: "التسجيلات", zh: "登记记录" })}
          </h1>
          <p className="text-xs text-muted-foreground">
            {label({
              ku: "هەرچی بە تۆماری خێرا داخڵ کراوە — بە وێنە و زانیاری تەواو",
              en: "Everything entered through Quick Register — with photos and full detail",
              ar: "كل ما أُدخل عبر التسجيل السريع — بالصور والتفاصيل الكاملة",
              zh: "通过快速登记录入的全部记录 — 含照片与完整信息",
            })}
          </p>
        </div>
        <div className="ms-auto flex gap-1.5">
          <Button size="sm" variant={groupByCustomer ? "default" : "outline"} onClick={() => setGroupByCustomer((v) => !v)}>
            <Users className="me-1.5 h-4 w-4" />
            {label({ ku: "بە کڕیار", en: "By customer", ar: "حسب العميل", zh: "按客户" })}
          </Button>
          <Button size="sm" variant={view === "cards" ? "default" : "outline"} onClick={() => setView("cards")}>
            <LayoutGrid className="me-1.5 h-4 w-4" />
            {label({ ku: "کارت", en: "Cards", ar: "بطاقات", zh: "卡片" })}
          </Button>
          <Button size="sm" variant={view === "table" ? "default" : "outline"} onClick={() => setView("table")}>
            <Table2 className="me-1.5 h-4 w-4" />
            {label({ ku: "خشتە", en: "Table", ar: "جدول", zh: "表格" })}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {rangeButtons.map((b) => (
          <Button
            key={b.key}
            size="sm"
            variant={rangeKey === b.key ? "default" : "outline"}
            onClick={() => setRangeKey(b.key)}
          >
            {label(b.text)}
          </Button>
        ))}
        {rangeKey === "custom" && (
          <div className="flex items-center gap-1.5" dir="ltr">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-[9.5rem]" />
            <span className="text-muted-foreground">→</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-[9.5rem]" />
          </div>
        )}
        <div className="relative ms-auto min-w-[13rem] flex-1 sm:max-w-xs">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={label({ ku: "گەڕان بە تراک، کۆد، کڕیار…", en: "Search tracking, code, customer…", ar: "بحث بالتتبّع أو الكود أو العميل…", zh: "搜索追踪号、编号、客户…" })}
            className="h-9 ps-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat value={String(totals.pieces)} caption={label({ ku: "پارچە", en: "pieces", ar: "قطعة", zh: "件" })} />
        <Stat value={String(totals.customers)} caption={label({ ku: "کڕیار", en: "customers", ar: "عميل", zh: "客户" })} />
        <Stat value={totals.airKg.toFixed(1)} caption={label({ ku: "کیلۆ · ئاسمانی", en: "kg · air", ar: "كغ · جوي", zh: "公斤 · 空运" })} />
        <Stat value={totals.seaCbm.toFixed(2)} caption={label({ ku: "CBM · دەریایی", en: "CBM · sea", ar: "م³ · بحري", zh: "立方米 · 海运" })} />
        <Stat value={`$${Math.round(totals.value)}`} caption={label({ ku: "بڕی گشتی", en: "total value", ar: "القيمة", zh: "总额" })} />
        <Stat
          value={String(totals.noPhoto + totals.noWeight + totals.unclaimed)}
          caption={label({ ku: "کەموکوڕی", en: "incomplete", ar: "ناقص", zh: "不完整" })}
          warn={totals.noPhoto + totals.noWeight + totals.unclaimed > 0}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <PackageIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {label({
                ku: "لەم ماوەیەدا هیچ تۆمارێک نەکراوە",
                en: "Nothing was registered in this period",
                ar: "لم يُسجَّل شيء في هذه الفترة",
                zh: "此期间没有登记记录",
              })}
            </p>
            <Link href="/packages/quick-register">
              <Button size="sm" variant="outline">
                {label({ ku: "تۆماری خێرا", en: "Quick Register", ar: "تسجيل سريع", zh: "快速登记" })}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : groups ? (
        <div className="space-y-4">
          {groups.map((g) => {
            const kg = g.items.filter((r) => r.shippingType !== "sea").reduce((s, r) => s + num(r.weightKg), 0);
            const cbm = g.items.filter((r) => r.shippingType === "sea").reduce((s, r) => s + num(r.volumeCbm), 0);
            return (
              <div key={g.key} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                  <span className="rounded-md bg-sky-50 px-2 py-0.5 font-mono text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                    {g.code}
                  </span>
                  <span className="text-sm font-medium">{g.name}</span>
                  <span className="ms-auto font-mono text-xs text-muted-foreground" dir="ltr">
                    {g.items.length} · {cbm > 0 ? `${cbm.toFixed(2)} CBM` : `${kg.toFixed(2)} kg`}
                  </span>
                </div>
                {view === "cards"
                  ? g.items.map((r) => (
                      <RegistrationCard key={r.id} row={r} customerById={customerById} categoryById={categoryById}
                        language={language} onCopy={copyTracking} onPhoto={setLightbox} />
                    ))
                  : <RegistrationTable rows={g.items} customerById={customerById} language={language} onCopy={copyTracking} />}
              </div>
            );
          })}
        </div>
      ) : view === "cards" ? (
        <div className="space-y-2">
          {rows.map((r) => (
            <RegistrationCard key={r.id} row={r} customerById={customerById} categoryById={categoryById}
              language={language} onCopy={copyTracking} onPhoto={setLightbox} />
          ))}
        </div>
      ) : (
        <RegistrationTable rows={rows} customerById={customerById} language={language} onCopy={copyTracking} />
      )}

      <Dialog open={Boolean(lightbox)} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightbox && <img src={lightbox} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ value, caption, warn }: { value: string; caption: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3 py-2">
      <p className={cn("text-lg font-bold tabular-nums", warn && "text-amber-600 dark:text-amber-400")} dir="ltr">
        {value}
      </p>
      <p className="text-[10.5px] text-muted-foreground">{caption}</p>
    </div>
  );
}

const SHIPPING_ICON = { air_regular: Plane, air_irregular: Plane, sea: Ship } as const;

const ORDER_TYPE_LABEL: Record<string, L> = {
  full_package: { ku: "کرین بە تێچوو", en: "Cost purchase", ar: "شراء بالتكلفة", zh: "成本采购" },
  commission: { ku: "کرین بە عمولە", en: "Commission", ar: "بالعمولة", zh: "佣金采购" },
  purchase_request: { ku: "داواکاری کڕین", en: "Purchase request", ar: "طلب شراء", zh: "采购请求" },
};

function RegistrationCard({
  row, customerById, categoryById, language, onCopy, onPhoto,
}: {
  row: Registration;
  customerById: Map<number, { name: string; code: string }>;
  categoryById: Map<number, string>;
  language: string;
  onCopy: (tn: string) => void;
  onPhoto: (url: string) => void;
}) {
  const label = (v: L) => pickLang(language, v);
  const photos = row.photos ?? [];
  const customer = row.customerId ? customerById.get(row.customerId) : undefined;
  const unclaimed = row.isUnclaimed || !row.customerId;
  const noWeight = num(row.weightKg) <= 0;
  const Icon = SHIPPING_ICON[row.shippingType] ?? Plane;
  const when = new Date(row.registeredAt ?? row.createdAt);
  const dims = [row.lengthCm, row.widthCm, row.heightCm].every((v) => num(v) > 0)
    ? `${num(row.lengthCm)}×${num(row.widthCm)}×${num(row.heightCm)}`
    : null;

  return (
    <Card className={cn(unclaimed || noWeight ? "border-amber-300 dark:border-amber-800" : undefined)}>
      <CardContent className="flex gap-3 p-3">
        <div className="flex shrink-0 gap-1">
          {photos.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => onPhoto(photos[0])}
                className="h-16 w-16 overflow-hidden rounded-lg border"
                aria-label={label({ ku: "گەورەکردنی وێنە", en: "Enlarge photo", ar: "تكبير الصورة", zh: "放大照片" })}
              >
                <img src={photos[0]} alt="" className="h-full w-full object-cover" />
              </button>
              {photos.length > 1 && (
                <button
                  type="button"
                  onClick={() => onPhoto(photos[1])}
                  className="flex h-16 w-8 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground"
                >
                  +{photos.length - 1}
                </button>
              )}
            </>
          ) : (
            <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-muted-foreground">
              <CameraOff className="h-5 w-5" />
              <span className="text-[10px]">{label({ ku: "بێ وێنە", en: "no photo", ar: "بلا صورة", zh: "无照片" })}</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "rounded-md px-2 py-0.5 font-mono text-xs",
              unclaimed
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                : "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
            )}>
              {unclaimed ? label({ ku: "بێ خاوەن", en: "Unclaimed", ar: "بلا مالك", zh: "无主" }) : customer?.code || "—"}
            </span>
            <span className={cn("truncate text-sm", unclaimed ? "text-muted-foreground" : "font-medium")}>
              {unclaimed
                ? label({ ku: "کڕیار دیاری نەکراوە", en: "No customer assigned", ar: "لم يُحدَّد عميل", zh: "未指定客户" })
                : customer?.name || "—"}
            </span>
            <span className="ms-auto shrink-0 font-mono text-[11px] text-muted-foreground" dir="ltr">
              {`${String(when.getDate()).padStart(2, "0")}/${String(when.getMonth() + 1).padStart(2, "0")}`}
              {" · "}
              {when.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5" dir="ltr">
            <button
              type="button"
              onClick={() => row.trackingNumber && onCopy(row.trackingNumber)}
              className="inline-flex items-center gap-1 font-mono text-[13px] text-foreground hover:text-sky-600 dark:hover:text-sky-400"
            >
              {row.trackingNumber || "—"}
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <span className="font-mono text-[11px] text-muted-foreground">· {row.packageCode}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip tone="sky">
              <Icon className="h-3 w-3" />
              {pickLang(language, SHIPPING_TYPE_LABEL[row.shippingType])}
            </Chip>
            {row.categoryId && categoryById.get(row.categoryId) && (
              <Chip tone="slate">{categoryById.get(row.categoryId)}</Chip>
            )}
            <Chip tone="violet">
              {row.orderType && ORDER_TYPE_LABEL[row.orderType]
                ? label(ORDER_TYPE_LABEL[row.orderType])
                : label({ ku: "سێلف ئۆردەر", en: "Self order", ar: "طلب ذاتي", zh: "自购订单" })}
            </Chip>
            {photos.length === 0 && (
              <Chip tone="amber"><Camera className="h-3 w-3" />{label({ ku: "وێنەی نییە", en: "no photo", ar: "بلا صورة", zh: "无照片" })}</Chip>
            )}
            {noWeight && (
              <Chip tone="amber"><AlertTriangle className="h-3 w-3" />{label({ ku: "کێش نەنووسراوە", en: "no weight", ar: "بلا وزن", zh: "无重量" })}</Chip>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-[12.5px]" dir="ltr">
            <span><span className="text-muted-foreground">kg</span> {noWeight ? "—" : num(row.weightKg).toFixed(2)}</span>
            {dims && <span><span className="text-muted-foreground">cm</span> {dims}</span>}
            {num(row.volumeCbm) > 0 && <span><span className="text-muted-foreground">CBM</span> {num(row.volumeCbm).toFixed(3)}</span>}
            <span className="font-medium">{num(row.calculatedCostUsd) > 0 ? `$${num(row.calculatedCostUsd).toFixed(2)}` : "—"}</span>
            {row.registeredByName && (
              <span className="ms-auto inline-flex items-center gap-1 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {row.registeredByName}
              </span>
            )}
          </div>

          {row.description && (
            <p className="mt-1.5 truncate text-xs text-muted-foreground">{row.description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Chip({ tone, children }: { tone: "sky" | "slate" | "violet" | "amber"; children: React.ReactNode }) {
  const tones = {
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    slate: "bg-muted text-muted-foreground",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px]", tones[tone])}>
      {children}
    </span>
  );
}

/** Dense view, for when you want to scan a lot of rows rather than look at them. */
function RegistrationTable({
  rows, customerById, language, onCopy,
}: {
  rows: Registration[];
  customerById: Map<number, { name: string; code: string }>;
  language: string;
  onCopy: (tn: string) => void;
}) {
  const label = (v: L) => pickLang(language, v);
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-start font-medium">{label({ ku: "وێنە", en: "Photo", ar: "صورة", zh: "照片" })}</th>
            <th className="px-3 py-2 text-start font-medium">{label({ ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</th>
            <th className="px-3 py-2 text-start font-medium">{label({ ku: "تراک", en: "Tracking", ar: "التتبّع", zh: "追踪号" })}</th>
            <th className="px-3 py-2 text-start font-medium">{label({ ku: "ڕێگا", en: "Route", ar: "المسار", zh: "路线" })}</th>
            <th className="px-3 py-2 text-end font-medium">{label({ ku: "کێش", en: "Weight", ar: "الوزن", zh: "重量" })}</th>
            <th className="px-3 py-2 text-end font-medium">CBM</th>
            <th className="px-3 py-2 text-end font-medium">{label({ ku: "نرخ", en: "Price", ar: "السعر", zh: "价格" })}</th>
            <th className="px-3 py-2 text-start font-medium">{label({ ku: "تۆمارکەر", en: "By", ar: "بواسطة", zh: "登记人" })}</th>
            <th className="px-3 py-2 text-start font-medium">{label({ ku: "کات", en: "Time", ar: "الوقت", zh: "时间" })}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = r.customerId ? customerById.get(r.customerId) : undefined;
            const when = new Date(r.registeredAt ?? r.createdAt);
            const photo = r.photos?.[0];
            return (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  {photo ? (
                    <img src={photo} alt="" className="h-9 w-9 rounded object-cover" />
                  ) : (
                    <CameraOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="font-mono text-xs">{c?.code || label({ ku: "بێ خاوەن", en: "Unclaimed", ar: "بلا مالك", zh: "无主" })}</div>
                  <div className="truncate text-xs text-muted-foreground">{c?.name || "—"}</div>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => r.trackingNumber && onCopy(r.trackingNumber)}
                    className="font-mono text-xs hover:text-sky-600 dark:hover:text-sky-400"
                    dir="ltr"
                  >
                    {r.trackingNumber || "—"}
                  </button>
                </td>
                <td className="px-3 py-2 text-xs">{pickLang(language, SHIPPING_TYPE_LABEL[r.shippingType])}</td>
                <td className="px-3 py-2 text-end font-mono text-xs" dir="ltr">{num(r.weightKg) > 0 ? num(r.weightKg).toFixed(2) : "—"}</td>
                <td className="px-3 py-2 text-end font-mono text-xs" dir="ltr">{num(r.volumeCbm) > 0 ? num(r.volumeCbm).toFixed(3) : "—"}</td>
                <td className="px-3 py-2 text-end font-mono text-xs" dir="ltr">{num(r.calculatedCostUsd) > 0 ? `$${num(r.calculatedCostUsd).toFixed(2)}` : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.registeredByName || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground" dir="ltr">
                  {`${String(when.getDate()).padStart(2, "0")}/${String(when.getMonth() + 1).padStart(2, "0")}`}
                  {" "}
                  {when.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
