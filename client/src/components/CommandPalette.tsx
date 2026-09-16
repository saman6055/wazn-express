import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { usePermissions } from "@/hooks/usePermissions";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/lib/errorToast";
import { readOptionUsage, recordOptionUse, rankOptions, type OptionUsage } from "@/lib/optionUsage";
import { cleanTrackingPaste } from "@/lib/entry/cleanPaste";
import {
  batchScore,
  bestScore,
  customerScore,
  looksLikeTracking,
  prepareCustomers,
  rankBatches,
  rankPreparedCustomers,
} from "@/lib/ops/commandMatch";
import {
  buildManifestHtml,
  openManifestWindow,
  writeManifestAndPrint,
  type ManifestLang,
} from "@/lib/ops/manifestPrint";
import { packagesHref } from "@shared/listLinks";
import { splitCustomerCode } from "@shared/customerCode";
import {
  ArrowRight,
  ClipboardList,
  CreditCard,
  Layers,
  PackagePlus,
  PackageSearch,
  Printer,
  ShoppingBag,
  Truck,
  UserRound,
  UserSearch,
  Boxes,
  AlertTriangle,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * One thing the hub can do.
 *
 * `to` is where it goes; `mode` is for a command that needs one more answer
 * first (which batch to print, which customer to open). `requires` is the page
 * whose permission decides whether this person is offered it at all — a
 * command that opens onto "no access" is worse than no command.
 */
export interface HubAction {
  id: string;
  label: Words;
  icon: LucideIcon;
  keywords: string;
  to?: string;
  mode?: "manifest" | "customer";
  requires: string;
}

export const HUB_ACTIONS: readonly HubAction[] = [
  {
    id: "new-batch",
    label: { ku: "باچی نوێ", en: "New batch", ar: "دفعة جديدة", zh: "新建批次" },
    icon: Layers,
    keywords: "new batch create shipment container باچ نوێ",
    to: "/batches?new=1",
    requires: "/batches",
  },
  {
    id: "print-manifest",
    label: { ku: "چاپی مانیفێست…", en: "Print manifest…", ar: "طباعة بيان الدفعة…", zh: "打印批次清单…" },
    icon: Printer,
    keywords: "print manifest batch list loading چاپ مانیفێست",
    mode: "manifest",
    requires: "/batches",
  },
  {
    id: "find-customer",
    label: { ku: "گەڕان بەدوای کڕیار…", en: "Find a customer…", ar: "البحث عن عميل…", zh: "查找客户…" },
    icon: UserSearch,
    keywords: "search find customer client code phone گەڕان کڕیار",
    mode: "customer",
    requires: "/customers",
  },
  {
    id: "quick-register",
    label: { ku: "تۆماری خێرا", en: "Quick register", ar: "تسجيل سريع", zh: "快速登记" },
    icon: Truck,
    keywords: "quick register parcel package scan تۆمار",
    to: "/packages/quick-register",
    requires: "/packages/quick-register",
  },
  {
    id: "bulk-register",
    label: { ku: "تۆماری کۆمەڵ", en: "Bulk register", ar: "تسجيل جماعي", zh: "批量登记" },
    icon: ClipboardList,
    keywords: "bulk register parcels many",
    to: "/packages/bulk-register",
    requires: "/packages/bulk-register",
  },
  {
    id: "new-full-package",
    label: { ku: "پاکێجی تەواوی نوێ", en: "New full package order", ar: "طلب حزمة كاملة جديد", zh: "新建完整套餐订单" },
    icon: PackagePlus,
    keywords: "new full package order buy resell",
    to: "/full-package/new",
    requires: "/full-package",
  },
  {
    id: "new-commission",
    label: { ku: "کڕینی نوێ بە تێچوو", en: "New cost purchase", ar: "شراء جديد بالتكلفة", zh: "新建成本代购" },
    icon: DollarSign,
    keywords: "new commission markup cost purchase order عمولە",
    to: "/commission/new",
    requires: "/commission",
  },
  {
    id: "bulk-full-package",
    label: { ku: "پاکێجی تەواو بە کۆمەڵ", en: "Bulk full package orders", ar: "طلبات حزمة كاملة بالجملة", zh: "批量完整套餐订单" },
    icon: ShoppingBag,
    keywords: "bulk full package orders paste many",
    to: "/full-package/bulk-create?type=full_package",
    requires: "/full-package",
  },
  {
    id: "bulk-commission",
    label: { ku: "کڕین بە تێچوو بە کۆمەڵ", en: "Bulk cost purchases", ar: "مشتريات بالتكلفة بالجملة", zh: "批量成本代购" },
    icon: ShoppingBag,
    keywords: "bulk commission cost purchase orders paste many",
    to: "/commission/bulk-create?type=commission",
    requires: "/commission",
  },
  {
    id: "customer-delivery",
    label: { ku: "گەیاندن بە کڕیار", en: "Deliver to customer", ar: "التسليم للعميل", zh: "交付给客户" },
    icon: CreditCard,
    keywords: "delivery deliver customer box scan گەیاندن",
    to: "/customer-delivery-scanner",
    requires: "/customer-delivery-scanner",
  },
  {
    id: "batch-assignment",
    label: { ku: "خستنە ناو باچ", en: "Scan into a batch", ar: "إضافة إلى دفعة بالمسح", zh: "扫描入批次" },
    icon: Boxes,
    keywords: "batch assignment scanner scan into batch",
    to: "/batch-assignment-scanner",
    requires: "/batch-assignment-scanner",
  },
  {
    id: "unclaimed",
    label: { ku: "پاکەتە بێ خاوەنەکان", en: "Unclaimed parcels", ar: "طرود بلا مالك", zh: "无主包裹" },
    icon: AlertTriangle,
    keywords: "unclaimed parcels no owner claim بێ خاوەن",
    to: "/packages/unclaimed",
    requires: "/packages/unclaimed",
  },
];

interface Destination {
  icon: LucideIcon;
  label: string;
  path: string;
}

interface DestinationGroup {
  title: string;
  items: Destination[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The sidebar, already narrowed to what this person may open. Passed in
   * rather than copied, so every page in the menu can be found here and a
   * page added to the menu needs no second list.
   */
  destinations?: DestinationGroup[];
}

type Mode = "root" | "manifest" | "customer";

interface HubItem {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  mono?: boolean;
  badge?: string;
  score: number;
  run: () => void;
}

interface Section {
  id: string;
  heading: string;
  items: HubItem[];
}

const USAGE_LIST = "command-hub";

const T = {
  placeholder: { ku: "فەرمانێک بنووسە، کڕیار، باچ یان تراکینگ…", en: "Type a command, customer, batch or tracking…", ar: "اكتب أمرًا أو عميلًا أو دفعة أو رقم تتبع…", zh: "输入命令、客户、批次或运单号…" },
  manifestPlaceholder: { ku: "کۆدی باچ بنووسە…", en: "Type a batch code…", ar: "اكتب رمز الدفعة…", zh: "输入批次编号…" },
  customerPlaceholder: { ku: "کۆد، ناو یان ژمارەی مۆبایل…", en: "Code, name or phone…", ar: "الرمز أو الاسم أو الهاتف…", zh: "编号、姓名或电话…" },
  mostUsed: { ku: "زۆرترین بەکارهاتوو", en: "Used most", ar: "الأكثر استخدامًا", zh: "最常用" },
  actions: { ku: "کردارە خێراکان", en: "Quick actions", ar: "إجراءات سريعة", zh: "快捷操作" },
  pages: { ku: "پەڕەکان", en: "Pages", ar: "الصفحات", zh: "页面" },
  customers: { ku: "کڕیارەکان", en: "Customers", ar: "العملاء", zh: "客户" },
  batches: { ku: "باچەکان", en: "Batches", ar: "الدفعات", zh: "批次" },
  parcel: { ku: "پاکەت", en: "Parcel", ar: "الطرد", zh: "包裹" },
  findParcel: { ku: "گەڕان بۆ تراکینگ", en: "Find tracking", ar: "البحث عن رقم التتبع", zh: "查找运单号" },
  printManifestOf: { ku: "چاپی مانیفێستی", en: "Print the manifest of", ar: "طباعة بيان", zh: "打印清单：" },
  chooseBatch: { ku: "چاپی مانیفێست — باچێک هەڵبژێرە", en: "Print manifest — choose a batch", ar: "طباعة البيان — اختر دفعة", zh: "打印清单 — 选择批次" },
  chooseCustomer: { ku: "کڕیارێک هەڵبژێرە", en: "Choose a customer", ar: "اختر عميلًا", zh: "选择客户" },
  back: { ku: "گەڕانەوە", en: "Back", ar: "رجوع", zh: "返回" },
  none: { ku: "هیچ ئەنجامێک نەدۆزرایەوە", en: "No results", ar: "لا توجد نتائج", zh: "无结果" },
  hintMove: { ku: "هەڵبژاردن", en: "move", ar: "تنقل", zh: "移动" },
  hintRun: { ku: "جێبەجێکردن", en: "run", ar: "تنفيذ", zh: "执行" },
  hintClose: { ku: "داخستن", en: "close", ar: "إغلاق", zh: "关闭" },
  popupBlocked: { ku: "وێبگەڕ ڕێگەی بە پەنجەرەی چاپ نەدا — ڕێگە بە پەنجەرەی نوێ بدە و دووبارە هەوڵ بدەرەوە", en: "The browser blocked the print window — allow pop-ups and try again", ar: "منع المتصفح نافذة الطباعة — اسمح بالنوافذ المنبثقة وحاول مجددًا", zh: "浏览器阻止了打印窗口——请允许弹出窗口后重试" },
  manifestFailed: { ku: "مانیفێست نەهێنرا", en: "The manifest could not be loaded", ar: "تعذر تحميل البيان", zh: "无法加载清单" },
  parcels: { ku: "پاکەت", en: "parcels", ar: "طرود", zh: "件" },
} satisfies Record<string, Words>;

/**
 * The quick action hub — Ctrl+K from anywhere in the staff app.
 *
 * It used to be a list of pages. Now it also does things: opens a new batch,
 * prints a manifest, finds a customer by code, name or phone, a batch by its
 * code, a parcel by its tracking — each in a keystroke or two, without the
 * mouse. What a person runs most rises to the top for them (the same rule as
 * every picker in the app, lib/optionUsage.ts).
 *
 * Every command goes through the pages and procedures that already exist;
 * nothing here writes anything.
 */
export function CommandPalette({ open, onOpenChange, destinations = [] }: CommandPaletteProps) {
  const [, navigate] = useLocation();
  const { language } = useTranslation();
  const say = useCallback((w: Words) => pickLang(language, w), [language]);
  const { canViewPath } = usePermissions();
  const company = useCompanyInfo();
  const utils = trpc.useUtils();

  const [mode, setMode] = useState<Mode>("root");
  const [query, setQuery] = useState("");
  const [usage, setUsage] = useState<OptionUsage>({});
  // Which row Enter runs. Held here rather than left to the list, so that the
  // best answer is the one selected the moment the answers change.
  const [selected, setSelected] = useState("");

  // Ctrl/Cmd+K toggles the hub from anywhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Every opening starts clean, with the person's own habits read fresh.
  useEffect(() => {
    if (!open) return;
    setMode("root");
    setQuery("");
    setUsage(readOptionUsage(USAGE_LIST));
  }, [open]);

  const canCustomers = canViewPath("/customers");
  const canBatches = canViewPath("/batches");
  const canParcels = canViewPath("/packages/all");
  // What this person may run, as a value rather than a function: the
  // permission check is a new function on every render, and the lists below
  // should rebuild when the answer changes, not whenever anything re-renders.
  const allowedKey = HUB_ACTIONS.filter((a) => canViewPath(a.requires)).map((a) => a.id).join(",");
  const allowed = useMemo(() => new Set(allowedKey.split(",")), [allowedKey]);

  const { data: customers } = trpc.customers.list.useQuery(undefined, {
    enabled: open && canCustomers,
    staleTime: 5 * 60_000,
  });
  const preparedCustomers = useMemo(() => prepareCustomers(customers ?? []), [customers]);
  const { data: batchesRaw } = trpc.batches.list.useQuery(undefined, {
    enabled: open && canBatches,
    staleTime: 60_000,
  });
  const batches = useMemo(
    () => ((Array.isArray(batchesRaw) ? batchesRaw : (batchesRaw as { data?: unknown[] } | undefined)?.data) ?? []) as Array<{
      id: number;
      batchCode: string;
      status?: string | null;
      shippingType?: string | null;
      totalPackages?: number | null;
      createdAt?: Date | string | null;
    }>,
    [batchesRaw],
  );

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const go = useCallback(
    (path: string, learnKey?: string) => {
      if (learnKey) recordOptionUse(USAGE_LIST, learnKey);
      close();
      navigate(path);
    },
    [close, navigate],
  );

  const printManifest = useCallback(
    (batch: { id: number; batchCode: string; shippingType?: string | null }) => {
      const lang = (["ku", "en", "ar", "zh"].includes(language) ? language : "ku") as ManifestLang;
      // Opened now, inside the key press: after the fetch it would be a blocked popup.
      const w = openManifestWindow(lang);
      if (!w) {
        toast.error(say(T.popupBlocked));
        return;
      }
      recordOptionUse(USAGE_LIST, "action:print-manifest");
      close();
      const companyName = lang === "ku" ? company.nameKu || company.name : lang === "ar" ? company.nameAr || company.name : company.name;
      utils.packages.batchManifest
        .fetch({ batchId: batch.id })
        .then((rows) => {
          writeManifestAndPrint(
            w,
            buildManifestHtml({
              batch: { batchCode: batch.batchCode, shippingType: batch.shippingType },
              rows,
              companyName,
              logoUrl: company.logoUrl,
              language: lang,
              printedAt: new Date(),
            }),
          );
        })
        .catch((error) => {
          w.close();
          showErrorToast(error, say(T.manifestFailed));
        });
    },
    [close, company, language, say, utils],
  );

  const actionItems = useMemo<HubItem[]>(
    () =>
      HUB_ACTIONS.filter((a) => allowed.has(a.id)).map((a) => ({
        key: `action:${a.id}`,
        icon: a.icon,
        title: say(a.label),
        badge: a.mode ? "…" : undefined,
        score: 0,
        run: () => {
          if (a.mode) {
            recordOptionUse(USAGE_LIST, `action:${a.id}`);
            setMode(a.mode);
            setQuery("");
            return;
          }
          go(a.to!, `action:${a.id}`);
        },
      })),
    [allowed, say, go],
  );

  const pageItems = useMemo<Array<HubItem & { group: string }>>(
    () =>
      destinations.flatMap((group) =>
        group.items.map((item) => ({
          key: `page:${item.path}`,
          icon: item.icon,
          title: item.label,
          subtitle: group.title,
          group: group.title,
          score: 0,
          run: () => go(item.path, `page:${item.path}`),
        })),
      ),
    [destinations, go],
  );

  const sections = useMemo<Section[]>(() => {
    const q = query.trim();

    const customerItem = (c: NonNullable<typeof customers>[number], score: number): HubItem => {
      const { code, name } = splitCustomerCode(c.customerCode);
      return {
        key: `customer:${c.id}`,
        icon: UserRound,
        title: code || c.fullName || `#${c.id}`,
        mono: true,
        subtitle: [c.fullName || name, c.mobileNumber].filter(Boolean).join(" · "),
        score,
        run: () => go(`/customers/${c.id}`),
      };
    };

    // ── Print manifest: which batch? ────────────────────────────────────
    if (mode === "manifest") {
      return [
        {
          id: "manifest",
          heading: say(T.batches),
          items: rankBatches(q, batches, 30).map((b) => ({
            key: `manifest:${b.id}`,
            icon: Printer,
            title: b.batchCode,
            mono: true,
            subtitle: [b.status?.replace(/_/g, " "), b.totalPackages != null ? `${b.totalPackages} ${say(T.parcels)}` : null]
              .filter(Boolean)
              .join(" · "),
            score: 1,
            run: () => printManifest(b),
          })),
        },
      ];
    }

    // ── Find a customer: which one? ─────────────────────────────────────
    if (mode === "customer") {
      const list = q ? rankPreparedCustomers(q, preparedCustomers, 30) : (customers ?? []).filter((c) => c.isActive !== false).slice(0, 30);
      return [{ id: "customers", heading: say(T.customers), items: list.map((c) => customerItem(c, 1)) }];
    }

    // ── Nothing typed: habits first, then everything on offer ───────────
    if (!q) {
      const all = [...actionItems, ...pageItems];
      const { top } = rankOptions(all, usage, (item) => item.key);
      const out: Section[] = [];
      if (top.length > 0) out.push({ id: "used", heading: say(T.mostUsed), items: top });
      out.push({ id: "actions", heading: say(T.actions), items: actionItems });
      const byGroup = new Map<string, HubItem[]>();
      for (const p of pageItems) byGroup.set(p.group, [...(byGroup.get(p.group) ?? []), { ...p, subtitle: undefined }]);
      byGroup.forEach((items, heading) => out.push({ id: `pages:${heading}`, heading, items }));
      return out;
    }

    // ── Something typed: every kind of answer, the best kind first ───────
    const out: Section[] = [];
    const learned = (key: string) => Math.min(9, usage[key]?.count ?? 0);

    if (canParcels && looksLikeTracking(q)) {
      const tracking = cleanTrackingPaste(q);
      out.push({
        id: "parcel",
        heading: say(T.parcel),
        items: [
          {
            key: `parcel:${tracking}`,
            icon: PackageSearch,
            title: `${say(T.findParcel)} ${tracking}`,
            score: 140,
            run: () => go(packagesHref({ search: tracking })),
          },
        ],
      });
    }

    if (canCustomers && customers?.length) {
      const hits = rankPreparedCustomers(q, preparedCustomers, 6);
      if (hits.length) {
        out.push({ id: "customers", heading: say(T.customers), items: hits.map((c) => customerItem(c, customerScore(q, c))) });
      }
    }

    if (canBatches && batches.length) {
      const hits = rankBatches(q, batches, 5);
      if (hits.length) {
        const items: HubItem[] = hits.map((b) => ({
          key: `batch:${b.id}`,
          icon: Layers,
          title: b.batchCode,
          mono: true,
          subtitle: [b.status?.replace(/_/g, " "), b.totalPackages != null ? `${b.totalPackages} ${say(T.parcels)}` : null]
            .filter(Boolean)
            .join(" · "),
          score: batchScore(q, b),
          run: () => go(`/batches?edit=${b.id}`),
        }));
        // The batch asked for by its code, printed in one more keystroke.
        items.splice(1, 0, {
          key: `manifest:${hits[0].id}`,
          icon: Printer,
          title: `${say(T.printManifestOf)} ${hits[0].batchCode}`,
          score: batchScore(q, hits[0]) - 1,
          run: () => printManifest(hits[0]),
        });
        out.push({ id: "batches", heading: say(T.batches), items });
      }
    }

    const scoredActions = HUB_ACTIONS.filter((a) => allowed.has(a.id))
      .map((a) => {
        const s = bestScore(q, [say(a.label), a.label.ku, a.label.en, a.label.ar, a.label.zh, a.keywords]);
        const item = actionItems.find((i) => i.key === `action:${a.id}`)!;
        return { ...item, score: s > 0 ? s + learned(item.key) : 0 };
      })
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scoredActions.length) out.push({ id: "actions", heading: say(T.actions), items: scoredActions });

    const scoredPages = pageItems
      .map((p) => {
        const s = bestScore(q, [p.title, p.group, p.key.slice(5).replace(/[/\-_]+/g, " ")]);
        return { ...p, score: s > 0 ? s + learned(p.key) : 0 };
      })
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    if (scoredPages.length) out.push({ id: "pages", heading: say(T.pages), items: scoredPages });

    const top = (s: Section) => Math.max(...s.items.map((i) => i.score));
    return out.sort((a, b) => top(b) - top(a));
  }, [query, mode, batches, customers, preparedCustomers, actionItems, pageItems, usage, canParcels, canCustomers, canBatches, allowed, printManifest, go, say]);

  // The first answer is selected whenever the answers change and the selected
  // one is no longer among them — typing, a mode change, the list arriving.
  const valueOf = (section: Section, item: HubItem) => `${section.id}:${item.key}`;
  const values = sections.flatMap((s) => s.items.map((i) => valueOf(s, i)));
  const firstValue = values[0] ?? "";
  const valuesKey = values.join("|");
  useEffect(() => {
    setSelected(firstValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode]);
  useEffect(() => {
    if (!values.includes(selected)) setSelected(firstValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey]);

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // A command that asked a question can be left the way it was entered.
    if (e.key === "Backspace" && query === "" && mode !== "root") {
      e.preventDefault();
      setMode("root");
    }
  };

  const placeholder = mode === "manifest" ? T.manifestPlaceholder : mode === "customer" ? T.customerPlaceholder : T.placeholder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <DialogTitle className="sr-only">{say(T.actions)}</DialogTitle>
        <DialogDescription className="sr-only">{say(T.placeholder)}</DialogDescription>
        <Command
          shouldFilter={false}
          loop
          value={selected}
          onValueChange={setSelected}
          className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5"
        >
          {mode !== "root" && (
            <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm" data-testid="hub-mode">
              <button
                type="button"
                onClick={() => setMode("root")}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowRight className="h-3.5 w-3.5 ltr:rotate-180" />
                {say(T.back)}
              </button>
              <span className="font-medium">{say(mode === "manifest" ? T.chooseBatch : T.chooseCustomer)}</span>
            </div>
          )}
          <CommandInput
            value={query}
            onValueChange={setQuery}
            onKeyDown={onInputKeyDown}
            placeholder={say(placeholder)}
            autoFocus
          />
          <CommandList className="max-h-[min(60vh,28rem)]">
            <CommandEmpty>{say(T.none)}</CommandEmpty>
            {sections.map((section) =>
              section.items.length === 0 ? null : (
                <CommandGroup key={section.id} heading={section.heading}>
                  {section.items.map((item) => (
                    <CommandItem key={valueOf(section, item)} value={valueOf(section, item)} onSelect={item.run} className="gap-3">
                      <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className={cn("min-w-0 truncate", item.mono && "font-mono")} dir={item.mono ? "ltr" : undefined}>
                        {item.title}
                      </span>
                      {item.subtitle && <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                      {item.badge && <span className="ms-auto text-xs text-muted-foreground">{item.badge}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ),
            )}
          </CommandList>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> {say(T.hintMove)}</span>
            <span className="inline-flex items-center gap-1"><Kbd>Enter</Kbd> {say(T.hintRun)}</span>
            <span className="inline-flex items-center gap-1"><Kbd>Esc</Kbd> {say(T.hintClose)}</span>
            <span className="ms-auto inline-flex items-center gap-1" dir="ltr"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
