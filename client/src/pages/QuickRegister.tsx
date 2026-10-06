import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Package, Plane, Ship, Search, User, Loader2, CheckCircle2, Plus, Calculator, Zap, AlertTriangle, ExternalLink, Tags, ChevronDown, ImagePlus, X, Camera, PackageSearch, Clipboard, Scale, Ruler, Info, RotateCcw, Calendar, TrendingUp, Warehouse, Palette, Layers, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformChip } from "@/components/PlatformChip";
import { useTranslation } from "@/contexts/LanguageContext";
import { Link, useLocation } from "wouter";
import { confirmAction } from "@/components/ConfirmDialog";
import { oddParcelNumbers, oddParcelQuestion } from "@shared/parcelNumberSense";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { isRecentEntry } from "@shared/lastEntry";
import { StickyFormBar } from "@/components/forms/sticky-form-bar";
import { volumetricWeightKg, DEFAULT_VOLUMETRIC_DIVISOR } from "@shared/chargeableWeight";
import { parcelListHref, parcelSourceTarget, type ParcelOrderType } from "@shared/parcelSource";
import { useAuth } from "@/_core/hooks/useAuth";
import { pickLang } from "@/lib/lang";
import { OrderNote } from "@/components/scanner/OrderNote";
import { useIsMobile } from "@/hooks/useMobile";

import { soundManager } from "@/lib/soundManager";
import { useSystemAlert } from "@/components/SystemAlert";
import { PhotoStack } from "@/components/PhotoStack";
import { OrderNumbers } from "@/components/OrderNumbers";
import { CopyButton } from "@/components/CopyButton";

/** Short enough to be half a number: not worth asking about yet. */
const MIN_TRACKING_LOOKUP = 8;
/** How long a pause in the typing means "that is the whole number". */
const TRACKING_LOOKUP_PAUSE_MS = 800;

/**
 * The order behind a shared tracking, and the way to it.
 *
 * One rule for every screen — @shared/parcelSource — so the warning here and
 * the alert card elsewhere send the same person to the same page.
 */
function orderHref(order: { id: number; orderCode: string; orderType?: string | null }): string {
  return parcelSourceTarget([
    { orderId: order.id, orderType: (order.orderType as ParcelOrderType) ?? "full_package", orderCode: order.orderCode },
  ]).href;
}

export default function QuickRegister() {
  const systemAlert = useSystemAlert();
  /**
   * Where the weight box lives.
   *
   * On a desktop it is on the bottom bar, because a scan used to push it off
   * the screen at the moment it was wanted. A phone has no such bar to spare:
   * the bottom of the screen already carries the tab bar and the two round
   * buttons, and a form bar with a number box in it becomes three rows of
   * chrome over the page. The owner, 2026-09-29: «بۆ مۆبایل کێش هەر لە جێگای
   * خۆی بێت». So on a phone it stays a card in the flow, where scrolling to
   * it is the ordinary way of working anyway.
   *
   * One box either way — never two bound to the same state.
   */
  const isMobile = useIsMobile();
  const { t, language } = useTranslation();
  const { user } = useAuth();

  // Tracking search state
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundOrder, setFoundOrder] = useState<{
    found: boolean;
    source: "full_package" | "commission" | "purchase_request" | "package" | null;
    order: any;
    customer: any;
    package: any;
    createdByName?: string | null;
  } | null>(null);
  // Expanded lookup result so we can render shared / multi / conflict
  // banners and decide which order IDs to link at submit time.
  const [expandedLookup, setExpandedLookup] = useState<{
    case: 'single' | 'shared' | 'multi' | 'duplicate' | 'regular';
    orders: Array<{
      order: { id: number; orderCode: string; orderType: string; orderNumber: string | null; platform: string | null; productName: string; quantity: number; status: string; customerId: number | null; batchId: number | null; trackingNumber: string | null };
      customer: { id: number; customerCode: string | null; fullName: string | null } | null;
      batch: { id: number; batchCode: string | null; status: string } | null;
      trackings: Array<{ id: number; trackingNumber: string; cartonIndex: number }>;
    }>;
    existingPackages: Array<{ trackingNumber: string; id: number; packageCode: string; status: string }>;
    flags: { customerMismatch: boolean; batchConflict: boolean; cartonsRegistered: number | null; cartonsTotal: number | null };
  } | null>(null);
  // Default: link package to ALL sharing orders. Staff can opt out per scan.
  const [linkAllSharingOrders, setLinkAllSharingOrders] = useState(true);
  
  // Form state
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [shippingType, setShippingType] = useState<"air_regular" | "air_irregular" | "sea">("air_regular");
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [batchId, setBatchId] = useState<string>("");
  const [originWarehouseId, setOriginWarehouseId] = useState<number | null>(null);
  const [isUnclaimed, setIsUnclaimed] = useState(false);
  /** A moment's ring on the weight box, so the handover is seen, not guessed. */
  const [weightGlow, setWeightGlow] = useState(false);
  // Portal pre-declaration match: set when a scanned tracking was pre-declared
  // by a customer from the portal, so we can auto-own it + show a badge.
  const [declaredMatch, setDeclaredMatch] = useState<any>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [directCbm, setDirectCbm] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [volumetricDivisor, setVolumetricDivisor] = useState("6000");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Arrow key navigation state for customer dropdown
  const [highlightedCustomerIndex, setHighlightedCustomerIndex] = useState(-1);
  
  // Refs for auto-focus
  const trackingRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const searchVersionRef = useRef(0);
  // Soft batch reminder: first Save with no batch warns and stops; a second
  // Save (still no batch) goes through, registering the package with no batch.
  // Reset per package so each new registration gets its own reminder.
  const confirmNoBatchRef = useRef(false);

  /**
   * The last registration, back in the form to be put right.
   *
   * The owner, 2026-10-05: «ئەگەر هەڵەت لە کێش یا قیاس یا لە شتێ کرد، خۆشە
   * ڕیتێرنی دوایین ئۆردەری تۆمار کراو هەبێ، ئەو کات دەستکاری بکەیت». The
   * weight is read off the scales and typed with a carton in the other hand;
   * 15 for 1.5 is one slipped key, and until now the cure was an admin, a
   * deletion and a second registration under a new code.
   *
   * So the banner that names the last registration can hand it back. The same
   * form, the same boxes — nothing new to learn — and the save goes to the
   * correction instead of the register: the same parcel, the same code, and
   * its one line on the customer's account reading the right figure
   * (server/lib/correctRegisteredParcel). Only the last one, and only the
   * caller's own.
   *
   * While it is open the tracking is not for changing (a scanner read it),
   * and the warehouse, the shipping type and the batch belong to the parcel,
   * not to the next one — they are put back as they were when it closes.
   */
  const [correcting, setCorrecting] = useState<{
    id: number;
    packageCode: string;
    orderLinked: boolean;
    /** As they were when it was opened, to tell whether they changed. */
    photos: string[];
  } | null>(null);
  const [openingCorrection, setOpeningCorrection] = useState(false);
  /** The form as it stood, so closing a correction hands the screen back. */
  const beforeCorrectionRef = useRef<{
    batchId: string;
    shippingType: "air_regular" | "air_irregular" | "sea";
    originWarehouseId: number | null;
    customerId: number | null;
    customerSearch: string;
    isUnclaimed: boolean;
  } | null>(null);

  // Queries — handle errors so one failed API doesn't block the form
  const { data: customers, isError: customersError, refetch: refetchCustomers } = trpc.customers.list.useQuery();
  const { data: batchesRaw, isError: batchesError, refetch: refetchBatches } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesRaw) ? batchesRaw : batchesRaw?.data;
  const { data: warehouses, isError: warehousesError, refetch: refetchWarehouses } = trpc.warehouses.list.useQuery();
  const { data: categories, isError: categoriesError, refetch: refetchCategories } = trpc.productCategories.list.useQuery();
  const { data: packageStats, isError: statsError, refetch: refetchStats } = trpc.packages.stats.useQuery();
  // The configured divisor, not the literal: with the default state alone,
  // an install that changed the setting saw one weight here and another on
  // the invoice. The price was already server-resolved; the kg now agrees too.
  const { data: divisorData } = trpc.packages.getCbmDivisor.useQuery();
  useEffect(() => {
    if (divisorData?.divisor) setVolumetricDivisor(String(divisorData.divisor));
  }, [divisorData]);

  // Customer-level order progress (commission + full_package only) — display
  // only. Powers the "N of this customer's orders registered / remaining"
  // readout and the "all registered → ready for delivery" banner. Fetched only
  // once a customer is set (an order lock or a manual pick).
  const { data: customerOrderProgress } = trpc.scanning.customerOrderProgress.useQuery(
    { customerId: customerId ?? 0 },
    { enabled: !!customerId },
  );

  const hasQueryError = customersError || batchesError || warehousesError || categoriesError || statsError;
  const refetchAll = () => {
    refetchCustomers();
    refetchBatches();
    refetchWarehouses();
    refetchCategories();
    refetchStats();
  };
  
  // Search tracking - use trpc client directly for manual search
  const trpcUtils = trpc.useUtils();
  
  /**
   * Look the tracking up. Quietly, when it runs by itself as the number is
   * typed (owner, 2026-09-21): a quiet run still stops the person on a
   * parcel already registered — that warning is the whole point of looking
   * early — but it does not take the caret out of the tracking box, does not
   * say "not found" for a number half typed, and does not cheer a match the
   * person has not finished entering.
   */
  const handleTrackingSearch = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    // The parcel in the form is the one being corrected: looking its tracking
    // up would only "find" the parcel itself and call it a duplicate.
    if (correcting) return;
    const currentTracking = trackingRef.current?.value || trackingNumber;
    if (currentTracking.trim().length < 1) return;

    const thisSearchVersion = ++searchVersionRef.current;

    setIsSearching(true);
    try {
      /**
       * Asked afresh, never from the cache.
       *
       * The owner, 2026-09-23: he searched a tracking, found the record that
       * held it, deleted it — and Quick Register went on showing the same
       * warning. The app's queries are good for two minutes by default, and
       * `.fetch()` honours that, so the screen was answering from a copy of
       * the world as it had been before he fixed it. A lookup here is the one
       * question that must never be answered from memory.
       */
      const result = await trpcUtils.scanning.searchTrackingAllTypes.fetch(
        { trackingNumber: currentTracking.trim() },
        { staleTime: 0 },
      );

      if (searchVersionRef.current !== thisSearchVersion) {
        console.log(`[QuickRegister] Stale search ignored: "${currentTracking}"`);
        return;
      }

      if (result) {
        setFoundOrder(result);
        // A real order/package match clears any prior pre-declaration badge;
        // the not-found branch below re-sets it when a declaration matches.
        setDeclaredMatch(null);
        // Fan out to the expanded procedure so we know if this tracking is
        // shared, multi-tracking, or has any conflict flags. Failures here
        // never block the existing flow — we just leave expandedLookup null.
        try {
          if (result.found && (result.source === 'full_package' || result.source === 'commission')) {
            const exp = await trpcUtils.packages.lookupTrackingExpanded.fetch(
              { trackingNumber: currentTracking.trim() },
              { staleTime: 0 },
            );
            if (searchVersionRef.current === thisSearchVersion && exp) {
              setExpandedLookup(exp as any);
              setLinkAllSharingOrders(true);
            }
          } else {
            setExpandedLookup(null);
          }
        } catch {
          setExpandedLookup(null);
        }
        if (result.found) {
          // Customer policy:
          // • FP / commission orders → ALWAYS lock the customer to the
          //   order's owner. The package belongs to that customer by
          //   contract; staff cannot reassign it. Overrides any earlier
          //   manual selection or "بێ خاوەن" toggle.
          // • Regular packages (existing tracking, no linked order) →
          //   only auto-fill if the staff member has not already
          //   selected someone, so manual choices on regular packages
          //   are preserved.
          if (result.customer) {
            const isLinkedOrder = result.source === 'full_package' || result.source === 'commission';
            if (isLinkedOrder) {
              setCustomerId(result.customer.id);
              setCustomerSearch(result.customer.customerCode || result.customer.fullName || "");
              setIsUnclaimed(false);
            } else if (!customerId && !isUnclaimed) {
              setCustomerId(result.customer.id);
              setCustomerSearch(result.customer.customerCode || result.customer.fullName || "");
              setIsUnclaimed(false);
            }
          }
          const sourceLabels: Record<string, string> = {
            full_package: t("quickRegister.sourceFullPackage"),
            commission: t("quickRegister.sourceCommission"),
            package: t("quickRegister.sourcePackageRegistered")
          };

          if (result.source === "package") {
            /**
             * This parcel has been registered before, and saying so in the
             * corner of the screen was not enough.
             *
             * The operator scanned, the toast appeared and faded behind the
             * form, and they went on weighing, photographing and choosing a
             * customer — finding out only when the save came back refusing
             * it. A minute of work per parcel, and on a bad day the second
             * registration is the one that gets kept.
             *
             * So it stops them at the scan, which is the moment the
             * information is worth anything. This one is not routine: a
             * parcel registered twice is a parcel charged twice.
             */
            const already = result.package as {
              packageCode?: string | null;
              registeredAt?: Date | string | null;
              weightKg?: string | number | null;
              calculatedCostUsd?: string | number | null;
            } | null;
            const when = already?.registeredAt ? new Date(already.registeredAt) : null;
            /**
             * What it was registered as — the weight and the price already
             * charged for it. The owner asks for these here (2026-09-21):
             * knowing the parcel is a duplicate is half the answer; the
             * other half is whether the figures on it are the right ones.
             */
            const alreadyKg = Number(already?.weightKg);
            const alreadyUsd = Number(already?.calculatedCostUsd);
            const facts = [
              Number.isFinite(alreadyKg) && alreadyKg > 0 ? `${alreadyKg} kg` : null,
              Number.isFinite(alreadyUsd) && alreadyUsd > 0 ? `$${alreadyUsd.toFixed(2)}` : null,
            ].filter(Boolean).join(" · ");
            systemAlert({
              kind: "warning",
              title: t("quickRegister.trackingAlreadyRegistered"),
              message: pickLang(language, {
                ku: `ئەم پاکێجە پێشتر تۆمار کراوە${
                  result.customer?.customerCode ? ` بۆ ${result.customer.customerCode}` : ""
                }${when ? ` لە ${when.toLocaleString("en-GB")}` : ""}${facts ? ` — ${facts}` : ""}. دووبارە تۆمارکردنی واتە دوو جار حیسابکردنی.`,
                en: `This parcel is already registered${
                  result.customer?.customerCode ? ` to ${result.customer.customerCode}` : ""
                }${when ? ` on ${when.toLocaleString("en-GB")}` : ""}${facts ? ` — ${facts}` : ""}. Registering it again means charging for it twice.`,
                ar: `هذا الطرد مسجل مسبقاً${
                  result.customer?.customerCode ? ` باسم ${result.customer.customerCode}` : ""
                }${when ? ` بتاريخ ${when.toLocaleString("en-GB")}` : ""}${facts ? ` — ${facts}` : ""}. إعادة تسجيله تعني احتسابه مرتين.`,
                zh: `该包裹已登记${
                  result.customer?.customerCode ? `（${result.customer.customerCode}）` : ""
                }${when ? `，时间 ${when.toLocaleString("en-GB")}` : ""}${facts ? `（${facts}）` : ""}。再次登记会重复计费。`,
              }),
              // The parcel's own code, not the tracking: it is what finds the
              // existing row, and the tracking is already on screen.
              detail: already?.packageCode || currentTracking.trim(),
              // And a way to it: the owner, 2026-09-23 — an alert that names
              // a record and leaves you to find it is half an alert.
              openHref: parcelListHref(already?.packageCode || currentTracking.trim()),
              openLabel: pickLang(language, {
                ku: "پاکەتەکە بکەرەوە",
                en: "Open the parcel",
                ar: "افتح الطرد",
                zh: "打开包裹",
              }),
            });
          } else if (!silent) {
            soundManager.playFound();
            toast.success(
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400" />
                <div>
                  <div className="font-medium">{t("quickRegister.trackingFound")}</div>
                  <div className="text-sm text-muted-foreground">
                    {sourceLabels[result.source || ""] || t("quickRegister.unknown")}
                  </div>
                </div>
              </div>
            );
          }
          setTimeout(() => {
            if (result.source === "package") {
              // A duplicate: the next thing to happen is the next parcel,
              // not the weight of this one. Putting the caret in the weight
              // box would be the form inviting exactly the second
              // registration the dialog just warned about. And on the quiet
              // path nothing has been said yet, so nothing is moved either.
              if (silent) return;
              trackingRef.current?.focus();
              trackingRef.current?.select();
              return;
            }
            focusWeight();
          }, 100);
        } else if (result.declaredMatch?.customer) {
          // The customer pre-declared this tracking from the portal — auto-own
          // the package to them so it never lands as unclaimed.
          const dm = result.declaredMatch;
          const dmCustomer = dm.customer!;
          setDeclaredMatch(dm);
          if (!customerId && !isUnclaimed) {
            setCustomerId(dmCustomer.id);
            setCustomerSearch(dmCustomer.customerCode || dmCustomer.fullName || "");
            setIsUnclaimed(false);
          }
          // The customer already said what kind of goods these are when they
          // declared the tracking. That was being thrown away, leaving the
          // category empty on the very parcels we knew the most about.
          // Never overwrites a choice the person scanning has already made.
          if (!categoryId && dm.categoryId) {
            setCategoryId(String(dm.categoryId));
          }
          if (!silent) soundManager.playFound();
          if (!silent) toast.success(
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              <div>
                <div className="font-medium">{pickLang(language, { ku: "کڕیار پێشوەخت ئەم تراکەی داخڵ کردووە", en: "Customer pre-declared this tracking", ar: "العميل سجّل هذا التتبع مسبقاً", zh: "客户已预先登记此运单号" })}</div>
                <div className="text-sm text-muted-foreground">{dmCustomer.customerCode || dmCustomer.fullName}</div>
              </div>
            </div>
          );
          setTimeout(() => focusWeight(), 100);
        } else {
          setDeclaredMatch(null);
          if (silent) {
            // A tracking the system has never seen is the ordinary case here
            // — the parcel is new. No alert while somebody is still at the
            // keyboard, and the caret goes to the customer, not the kilos:
            // nobody owns this parcel yet.
            if (!customerId && !isUnclaimed) setTimeout(() => focusCustomer(), 100);
            return;
          }
          // Not a toast. On a warehouse screen at arm's length a notice in
          // the corner is not read: the parcel goes on the shelf and nobody
          // learns it was never registered until the customer asks.
          systemAlert({
            kind: "warning",
            // Loud and large, but it takes itself away: on this screen a
            // tracking the system has never seen is the ordinary case — the
            // parcel is new and about to be registered. A dismissal per
            // parcel is what makes a warning stop being read.
            autoDismissMs: 4000,
            title: t("quickRegister.trackingNotFound"),
            message: pickLang(language, {
              ku: "ئەم ژمارە تراکینگە لە سیستەمدا نییە. دەتوانیت بەردەوام بیت و پاکێجەکە بە نوێی تۆمار بکەیت.",
              en: "This tracking number is not in the system. You can carry on and register the parcel as new.",
              ar: "رقم التتبع هذا غير موجود في النظام. يمكنك المتابعة وتسجيل الطرد كجديد.",
              zh: "系统中没有此运单号。可以继续，将该包裹登记为新包裹。",
            }),
            detail: trackingNumber,
          });
          // Same rule when the alert was shown: the customer first, unless
          // this parcel already has one from the parcel before it.
          setTimeout(() => (customerId || isUnclaimed ? focusWeight() : focusCustomer()), 100);
        }
      }
    } catch (error: any) {
      if (searchVersionRef.current !== thisSearchVersion) return;

      console.error("Search error:", error);
      soundManager.playError();
      if (error?.message?.includes("UNAUTHORIZED")) {
        toast.error(t("quickRegister.pleaseLogIn"));
      } else {
        toast.error(t("quickRegister.searchError"));
      }
    } finally {
      if (searchVersionRef.current === thisSearchVersion) {
        setIsSearching(false);
      }
    }
  };
  
  // Default to first warehouse when list loads; keep user selection when list refetches
  useEffect(() => {
    if (warehouses?.length && originWarehouseId === null) {
      setOriginWarehouseId(warehouses[0].id);
    }
  }, [warehouses, originWarehouseId]);

  const selectedWarehouse = useMemo(
    () => (warehouses?.find((w) => w.id === originWarehouseId) ?? warehouses?.[0]) ?? null,
    [warehouses, originWarehouseId]
  );

  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter((b: any) => {
      const batchType = b.shippingType as string;
      if (shippingType === "air_regular" || shippingType === "air_irregular") {
        return batchType === "air" || batchType.startsWith("air");
      }
      return batchType === "sea";
    }).filter((b: any) => b.status === "preparing" || b.status === "in_transit");
  }, [batches, shippingType]);
  
  const filteredCustomers = useMemo(() => {
    if (!customers || !customerSearch) return [];
    const search = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.customerCode?.toLowerCase().includes(search) ||
      c.fullName?.toLowerCase().includes(search) ||
      c.mobileNumber?.includes(search)
    ).slice(0, 10);
  }, [customers, customerSearch]);
  
  // Reset highlighted index when filtered customers change
  useEffect(() => {
    setHighlightedCustomerIndex(-1);
  }, [filteredCustomers.length]);
  
  const calculatedCbm = useMemo(() => {
    if (lengthCm && widthCm && heightCm) {
      return (parseFloat(lengthCm) * parseFloat(widthCm) * parseFloat(heightCm)) / 1000000;
    }
    return 0;
  }, [lengthCm, widthCm, heightCm]);
  
  /**
   * The parcel's volume: the one typed in, else the three sides.
   *
   * Owner, 2026-09-23: "sometimes you do not need to measure — the CBM is
   * already there", and, asked whether it should set the air price too, "it
   * must decide the volumetric price". So it is no longer a sea-only field:
   * the shared rule (@shared/chargeableWeight) reads a given volume for air
   * as well, and turns it into volumetric kilos the same way the sides would.
   */
  const cbm = useMemo(() => {
    const typed = parseFloat(directCbm);
    if (Number.isFinite(typed) && typed > 0) return typed;
    return calculatedCbm;
  }, [calculatedCbm, directCbm]);
  
  // The same rule the server prices with: a volume given stands for the
  // sides, and one cubic metre is 1,000,000 cm³ (@shared/chargeableWeight).
  const volumetricWeight = useMemo(
    () => volumetricWeightKg(
      { lengthCm, widthCm, heightCm, volumeCbm: directCbm },
      parseFloat(volumetricDivisor) || DEFAULT_VOLUMETRIC_DIVISOR,
    ),
    [lengthCm, widthCm, heightCm, directCbm, volumetricDivisor],
  );
  
  const chargeableWeight = useMemo(() => {
    const actualWeight = parseFloat(weightKg) || 0;
    if (shippingType === "air_regular" || shippingType === "air_irregular") {
      return Math.max(actualWeight, volumetricWeight);
    }
    return actualWeight;
  }, [weightKg, volumetricWeight, shippingType]);
  
  const uploadMutation = trpc.storage.upload.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        setPhotos(prev => [...prev, data.url]);
      }
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  /**
   * The upload procedure reports a storage failure by RETURNING
   * `{ success: false, url: null, error }` instead of throwing, so onError
   * never fires and the caller's success toast used to appear over a photo
   * that was never attached. Treat a missing url as the failure it is.
   */
  const uploadPhoto = async (fileName: string, contentType: string, base64Data: string) => {
    const result = await uploadMutation.mutateAsync({ fileName, contentType, base64Data });
    if (!result?.url) {
      throw new Error(result?.error || t("quickRegister.uploadNoUrl"));
    }
  };
  
  const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<{ base64: string; type: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64 = dataUrl.split(',')[1];
          
          resolve({ base64, type: 'image/jpeg' });
        };
        img.onerror = () => reject(new Error('Could not load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    for (const file of Array.from(files)) {
      try {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(t("quickRegister.fileTooLarge", { name: file.name }));
          continue;
        }

        toast.info(t("quickRegister.compressing", { name: file.name }));
        const { base64, type } = await compressImage(file);

        await uploadPhoto(file.name.replace(/\.[^.]+$/, '.jpg'), type, base64);

        toast.success(t("quickRegister.uploadSuccess", { name: file.name }));
      } catch (error) {
        // Show the reason, not just "failed" — a storage misconfiguration and
        // a corrupt file need different people to fix them.
        const reason = error instanceof Error ? error.message : String(error);
        toast.error(`${t("quickRegister.uploadError", { name: file.name })} — ${reason}`, {
          duration: 8000,
        });
      }
    }
    
    setIsUploading(false);
    e.target.value = '';
  };
  
  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };
  
  /**
   * The quoted price, from the server's own resolver — the same one the
   * register will store with. The screen used to multiply the batch's list
   * rate here itself, which is how a customer with an agreed $9/kg watched
   * the counter quote $11 while the invoice was going to say $9: the list
   * rate knows nothing about per-customer prices or tiers.
   */
  const estimateFacts = useMemo(() => ({
    customerId: isUnclaimed ? null : customerId,
    batchId: batchId && batchId !== "none" ? parseInt(batchId) : null,
    originWarehouseId: selectedWarehouse?.id ?? null,
    shippingType,
    weightKg: weightKg || undefined,
    lengthCm: lengthCm || undefined,
    widthCm: widthCm || undefined,
    heightCm: heightCm || undefined,
    volumeCbm: directCbm || undefined,
  }), [isUnclaimed, customerId, batchId, selectedWarehouse, shippingType, weightKg, lengthCm, widthCm, heightCm, directCbm]);

  // A keystroke in the weight field should not fire a request per digit.
  const [debouncedFacts, setDebouncedFacts] = useState(estimateFacts);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedFacts(estimateFacts), 250);
    return () => clearTimeout(id);
  }, [estimateFacts]);

  const hasMeasure = shippingType === "sea" ? cbm > 0 : chargeableWeight > 0;
  const { data: estimate } = trpc.packages.estimateCost.useQuery(debouncedFacts, {
    enabled: hasMeasure,
    placeholderData: keepPreviousData,
  });
  /**
   * The tracking is done; the kilos are next.
   *
   * The owner, 2026-09-29: «پاش تراک، ئەبێ ماوس خۆی یەکسەر بێتە سەر کیلۆ و
   * ئەوێ گلۆ بکات». It used to happen only when a scanner sent its own
   * Enter — a number typed by hand was looked up quietly and the caret was
   * left where it was, deliberately, because the weight box was in the
   * middle of the page and jumping to it scrolled away what had just been
   * scanned. On a bar that never leaves the screen there is nothing to
   * scroll, so both ways end in the same place.
   *
   * The ring is the point of it: a caret that moved without being seen to
   * move is a caret somebody types past.
   */
  const focusWeight = useCallback(() => {
    weightRef.current?.focus();
    weightRef.current?.select();
    setWeightGlow(true);
    window.setTimeout(() => setWeightGlow(false), 1800);
  }, []);

  /**
   * And when it goes there.
   *
   * The owner, 2026-09-29: «ئەگەر تراک داخڵ کرا و کڕین بە تێچوو بوو یان
   * پاکێجی تەواو، یەکسەر ئەبێ ماوس بچێتە ناو کێش. ئەگەر ئەوانیش نەبوون، دوای
   * دیاری کردنی کۆدی کڕیار ئەبێ ماوس یەکسەر بچێتە لای کێش.»
   *
   * Which is one rule: **the kilos are next once it is known whose parcel
   * this is.** A tracking that finds an order answers that in the same breath
   * — the customer comes with it, locked — so the caret carries straight on.
   * A tracking nobody has seen before does not, and the weight of a parcel
   * with no owner is a number that will have to be found again later, so the
   * caret stops at the customer box and waits there.
   */
  const focusCustomer = useCallback(() => {
    customerInputRef.current?.focus();
    customerInputRef.current?.select();
  }, []);

  /**
   * Leaving does not throw the parcel away.
   *
   * The owner, 2026-10-01: «لە سیستەم، لە ئەپی مۆبایل، کاتێ چوویتە ناو تراک
   * تۆمارکردن، دوگمەی گەڕانەوە … بنووسرێ دڵنیایت دەتەوێ دەرچیت؟ ئەگەر دەستی
   * بەر دوگمەی تریش کەوت لە بێ ئاگایی، دیسان بڵێت.»
   *
   * A scanned tracking, a weight read off the scales, three sides measured
   * and a photograph of the carton — one accidental swipe and all of it is
   * typed again. Both ways out are held: Back, and the tab bar underneath.
   *
   * Not the warehouse, the shipping type or the batch: those stay from the
   * parcel before and a screen nobody has touched lets Back straight through.
   */
  const hasParcelInProgress = Boolean(
    correcting ||
    trackingNumber.trim() || weightKg.trim() || lengthCm.trim() || widthCm.trim() ||
    heightCm.trim() || directCbm.trim() || photos.length > 0 || customerId || isUnclaimed,
  );
  useLeaveGuard(hasParcelInProgress, () =>
    confirmAction({
      // What would be lost is said as it is: a correction left half way is
      // not "a parcel not registered yet" — the parcel is in, and wrong.
      message: correcting
        ? pickLang(language, {
            ku: "دڵنیایت دەتەوێت دەرچیت؟ چاککردنەوەکە هێشتا پاشەکەوت نەکراوە — پاکەتەکە وەک خۆی دەمێنێتەوە.",
            en: "Leave this screen? The correction has not been saved — the parcel stays as it was.",
            ar: "هل تريد الخروج؟ لم يُحفظ التصحيح بعد — يبقى الطرد كما كان.",
            zh: "要离开吗？更正尚未保存 — 包裹保持原样。",
          })
        : pickLang(language, {
        ku: "دڵنیایت دەتەوێت دەرچیت؟ ئەم پاکێتە هێشتا تۆمار نەکراوە.",
        en: "Leave this screen? This parcel has not been registered yet.",
        ar: "هل تريد الخروج؟ لم يُسجَّل هذا الطرد بعد.",
        zh: "要离开吗？这件包裹尚未登记。",
      }),
      confirmLabel: pickLang(language, { ku: "دەرچوون", en: "Leave", ar: "خروج", zh: "离开" }),
      cancelLabel: pickLang(language, { ku: "مانەوە", en: "Stay", ar: "البقاء", zh: "留下" }),
    }),
  );

  /**
   * What one tracking carries.
   *
   * The owner, 2026-10-05: «کاتێ یەک تراک زیاتر لە یەک پارچە بوو، نیشان بدات
   * ئەو تراکە چەند پارچەی تێدایە، ئۆردەر نەمبەری پلاتفۆرم و پلاتفۆرمەکەشی».
   * The person holding the carton is counting what comes out of it; the
   * number to count to was in the order, behind a fold, and only for one
   * order even when several had been sent under the same tracking.
   *
   * Summed across every order sharing the tracking. One exception said
   * honestly: an order sent in several cartons has its pieces spread over
   * them, and nothing recorded says how many are in this one — so that case
   * reads "N pieces in M cartons", never "this tracking carries N".
   */
  const trackingOrders = (expandedLookup?.orders ?? []).map((o) => o.order);
  const trackingPieces = trackingOrders.length > 0
    ? trackingOrders.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0)
    : Number(foundOrder?.order?.quantity) || 0;
  const trackingCartons = trackingOrders.length === 1 ? (expandedLookup?.orders?.[0]?.trackings?.length ?? 1) : 1;
  const trackingOrderNumbers: (string | null | undefined)[] = trackingOrders.length > 0
    ? trackingOrders.map((o) => o.orderNumber)
    : [foundOrder?.order?.orderNumber];
  const trackingPlatforms = Array.from(new Set(
    (trackingOrders.length > 0 ? trackingOrders.map((o) => o.platform) : [foundOrder?.order?.platform])
      .map((p) => String(p ?? "").trim())
      .filter(Boolean),
  ));

  const estimatedPrice = hasMeasure && estimate ? estimate.amountUsd : 0;

  /** The parcel being corrected belongs to an order's customer, by contract. */
  const ownerFollowsOrder = Boolean(correcting?.orderLinked);

  /**
   * What the bottom bar says beside the weight — and it says nothing it does
   * not have to.
   *
   * The owner, 2026-09-29: «تەنها لەکاتی گونجاو زانیاری تر بێت، با زۆریش
   * قەرباڵغ نەبێ». So each of these is a question with an answer only
   * sometimes, and the bar stays a weight, a price and two buttons for an
   * ordinary parcel.
   */
  /**
   * The rate behind the price, so an agreed per-customer rate is not a figure
   * that changed for no visible reason.
   *
   * The rate alone, not "20.00 × 11.00": the number it multiplies is already
   * on the bar, in the weight box or in the billed chip beside it. Printing
   * it again is how a bar of four facts became a bar of seven.
   */
  const priceWorking = estimate?.rate && estimatedPrice > 0
    ? `× ${Number(estimate.rate).toFixed(2)}`
    : null;
  
  const [, setLocation] = useLocation();
  const [returnToScanner, setReturnToScanner] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    const tracking = params.get('tracking');
    
    if (from === 'scanner') {
      setReturnToScanner('/scanner');
    }
    
    if (tracking) {
      setTrackingNumber(tracking);
    }
  }, []);
  
  // Manual/keyboard-friendly: typing just updates the field (no noisy
  // partial-search). The search runs when the user presses Enter (or a barcode
  // scanner sends its trailing Enter) via the input's onKeyDown handler, or when
  // the Search button is clicked.
  const handleTrackingChange = (value: string) => {
    // The tracking of a parcel being corrected was read by a scanner and is
    // not for changing here.
    if (correcting) return;
    setTrackingNumber(value);
    setFoundOrder(null);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      setSearchTimeout(null);
    }
    /**
     * A number typed or pasted by hand is looked up when the typing stops.
     *
     * A scanner sends its own Enter and never waited for this. A person does
     * not: they typed the number and went to the scales, and "this parcel is
     * already registered" waited for the save to refuse it — after the
     * weighing, the photograph and the customer (owner, 2026-09-21).
     */
    if (value.trim().length < MIN_TRACKING_LOOKUP) return;
    const timer = setTimeout(() => {
      setSearchTimeout(null);
      void handleTrackingSearch({ silent: true });
    }, TRACKING_LOOKUP_PAUSE_MS);
    setSearchTimeout(timer);
  };
  
  const selectCustomer = (customer: any) => {
    setCustomerId(customer.id);
    setCustomerSearch(customer.customerCode || customer.fullName || "");
    setShowCustomerDropdown(false);
    setIsUnclaimed(false);
    setHighlightedCustomerIndex(-1);
    // Whose it is, is now known — so the kilos are next.
    setTimeout(() => focusWeight(), 50);
  };
  
  const toggleUnclaimed = () => {
    setIsUnclaimed(!isUnclaimed);
    if (!isUnclaimed) {
      setCustomerId(null);
      setCustomerSearch("");
      // "No owner" is an answer to the same question, deliberately given.
      setTimeout(() => focusWeight(), 50);
    }
  };
  
  // Handle arrow key navigation in customer dropdown
  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (!showCustomerDropdown || filteredCustomers.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedCustomerIndex(prev => 
        prev < filteredCustomers.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedCustomerIndex(prev => 
        prev > 0 ? prev - 1 : filteredCustomers.length - 1
      );
    } else if (e.key === 'Enter' && highlightedCustomerIndex >= 0) {
      e.preventDefault();
      selectCustomer(filteredCustomers[highlightedCustomerIndex]);
    } else if (e.key === 'Escape') {
      setShowCustomerDropdown(false);
      setHighlightedCustomerIndex(-1);
    }
  };
  
  // State for last registered package
  const [lastRegistered, setLastRegistered] = useState<{ packageCode: string; trackingNumber: string; customerName: string; time: Date; enteredBy?: string; orderDate?: Date | null; orderNumber?: string | null } | null>(null);

  /**
   * The banner survives a reload.
   *
   * A phone puts the app to sleep and wakes it as a fresh page; the banner was
   * only ever in memory, so the one registration somebody wanted to go back
   * to was the one the screen had just forgotten. Asked once, and only a
   * registration from this working day is offered — last week's parcel is not
   * "the last thing I did".
   */
  const { data: myLastRegistration } = trpc.packages.lastRegisteredByMe.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (!myLastRegistration || !isRecentEntry(myLastRegistration.registeredAt)) return;
    const when = new Date(myLastRegistration.registeredAt as string | Date);
    setLastRegistered((prev) => prev ?? {
      packageCode: myLastRegistration.packageCode,
      trackingNumber: myLastRegistration.trackingNumber ?? "",
      customerName: myLastRegistration.customerCode || myLastRegistration.customerName || t("quickRegister.unclaimed"),
      time: when,
    });
    // Only when the answer arrives: the banner belongs to whatever was
    // registered since, once anything has been.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLastRegistration]);
  
  /**
   * Take this tracking off an order that should not carry it.
   *
   * The owner, 2026-09-23: he removed a tracking from the order that held it
   * and this screen went on warning that the tracking belonged to another
   * customer. Editing an order used to leave the row in the multi-tracking
   * table behind (fixed in fullPackage.db), but the rows already left behind
   * are still there — and this is the screen where they get in the way. So
   * the warning carries the cure: one click takes the tracking off that
   * order, which also releases any parcel that was linked because of it.
   */
  const unlinkTracking = trpc.fullPackage.removeOrderTracking.useMutation({
    onSuccess: async () => {
      toast.success(pickLang(language, {
        ku: "تراکەکە لەو داواکارییە بڕایەوە",
        en: "The tracking was taken off that order",
        ar: "أُزيل التتبع من ذلك الطلب",
        zh: "已从该订单移除该运单号",
      }));
      // Ask again, from the server: the whole point is that the screen must
      // now show what is true.
      await handleTrackingSearch({ silent: true });
    },
    onError: (err) => toast.error(err.message),
  });

  const registerMutation = trpc.packages.register.useMutation({
    meta: { skipGlobalToast: true },
    onSuccess: (data) => {
      // Play success beep sound
      soundManager.playSuccess();

      // Save last registered package info (who entered it, and — when this
      // package came from an existing order — that order's own registration
      // date, so we can show how long it took to reach quick-register).
      const orderCreatedAt = (foundOrder as unknown as { orderData?: { order?: { createdAt?: string | Date } } })?.orderData?.order?.createdAt;
      setLastRegistered({
        packageCode: data.packageCode,
        trackingNumber: trackingNumber,
        customerName: customerSearch || t("quickRegister.unclaimed"),
        time: new Date(),
        enteredBy: ((user?.name as string) || "").trim() || undefined,
        orderDate: orderCreatedAt ? new Date(orderCreatedAt) : null,
        orderNumber: (foundOrder as { order?: { orderNumber?: string | null } } | null)?.order?.orderNumber ?? null,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-300" />
          </div>
          <div>
            <div className="font-bold text-lg">{t("quickRegister.packageRegistered")}</div>
            <div className="text-base font-mono text-muted-foreground">{data.packageCode}</div>
          </div>
        </div>
      );
      
      resetForm();
      
      // Invalidate stats to update today's count, and the customer's order
      // progress so the "registered / remaining" readout reflects this scan.
      trpcUtils.packages.stats.invalidate();
      trpcUtils.scanning.customerOrderProgress.invalidate();

      if (returnToScanner) {
        setLocation(returnToScanner);
      }
    },
    onError: (error) => {
      const msg = (error?.message ?? "").trim();
      console.error("[QuickRegister] register error:", error);
      // Server returns Kurdish for known errors; show as-is. Map common English to Kurdish.
      if (msg.includes("کۆگا") || msg.includes("کڕیار") || msg.includes("گرووپ") || msg.includes("جۆری") || msg.includes("تکایە") || msg.includes("تراکینگە پێشتر") || msg.includes("هەڵەی داتابەیس")) {
        toast.error(msg);
      } else if (msg.includes("Warehouse not found")) {
        toast.error(t("quickRegister.warehouseNotFound"));
      } else if (msg.includes("Customer not found")) {
        toast.error(t("quickRegister.customerNotFound"));
      } else if (msg.includes("duplicate") || /تۆمار کراوە|already registered|CONFLICT/i.test(msg)) {
        toast.error(t("quickRegister.trackingAlreadyRegisteredShort"));
      } else {
        toast.error(msg || t("quickRegister.genericError"));
      }
    },
  });
  
  /** Hand the screen back as it was before the correction was opened. */
  const closeCorrection = (keepCustomer: boolean) => {
    const was = beforeCorrectionRef.current;
    beforeCorrectionRef.current = null;
    setCorrecting(null);
    resetForm();
    if (!was) return;
    setBatchId(was.batchId);
    setShippingType(was.shippingType);
    setOriginWarehouseId(was.originWarehouseId);
    // After a save the parcel's owner stays in the box, as after any
    // registration; after a cancel the box goes back to who was in it.
    if (!keepCustomer) {
      setCustomerId(was.customerId);
      setCustomerSearch(was.customerSearch);
      setIsUnclaimed(was.isUnclaimed);
    }
  };

  const correctMutation = trpc.packages.correctLastRegistration.useMutation({
    meta: { skipGlobalToast: true },
    onSuccess: (data) => {
      soundManager.playSuccess();
      setLastRegistered((prev) => ({
        ...(prev ?? { time: new Date() }),
        packageCode: data.packageCode,
        trackingNumber: data.trackingNumber ?? "",
        customerName: isUnclaimed ? t("quickRegister.unclaimed") : (customerSearch || t("quickRegister.unclaimed")),
      }));
      // What the account said, what it says now, and that only the
      // difference was written — long enough on screen to be read.
      toast.success(
        <div className="flex items-start gap-3" data-testid="qr-correction-done">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-300" />
          <div>
            <div className="font-mono text-sm font-bold">{data.packageCode}</div>
            <div className="text-sm leading-relaxed">{pickLang(language, data.words)}</div>
          </div>
        </div>,
        { duration: 12000 },
      );
      closeCorrection(true);
      trpcUtils.packages.stats.invalidate();
      trpcUtils.packages.lastRegisteredByMe.invalidate();
      trpcUtils.scanning.customerOrderProgress.invalidate();
    },
    onError: (error) => {
      soundManager.playError();
      // A refusal here carries its cure in numbered steps; a toast in the
      // corner is not where anybody reads four lines.
      systemAlert({
        kind: "warning",
        title: pickLang(language, { ku: "چاک نەکرایەوە", en: "Not corrected", ar: "لم يُصحَّح", zh: "未更正" }),
        message: error.message,
        detail: correcting?.packageCode,
      });
    },
  });

  /** Put the last registration back into the form. */
  const openCorrection = async () => {
    if (correcting || openingCorrection) return;
    setOpeningCorrection(true);
    try {
      // Asked afresh: what is corrected is what the server holds now.
      const last = await trpcUtils.packages.lastRegisteredByMe.fetch(undefined, { staleTime: 0 });
      if (!last) {
        toast.info(pickLang(language, {
          ku: "هیچ تۆمارێکت نییە بۆ چاککردنەوە",
          en: "You have no registration to correct",
          ar: "لا يوجد تسجيل لتصحيحه",
          zh: "没有可更正的登记",
        }));
        return;
      }
      if (last.blocked) {
        systemAlert({
          kind: "warning",
          title: pickLang(language, { ku: "لێرە چاک ناکرێتەوە", en: "It cannot be corrected here", ar: "لا يمكن تصحيحه هنا", zh: "无法在此更正" }),
          message: last.blocked,
          detail: last.packageCode,
          openHref: parcelListHref(last.packageCode),
          openLabel: pickLang(language, { ku: "پاکەتەکە بکەرەوە", en: "Open the parcel", ar: "افتح الطرد", zh: "打开包裹" }),
        });
        return;
      }

      beforeCorrectionRef.current = { batchId, shippingType, originWarehouseId, customerId, customerSearch, isUnclaimed };
      if (searchTimeout) {
        clearTimeout(searchTimeout);
        setSearchTimeout(null);
      }
      searchVersionRef.current++;
      setFoundOrder(null);
      setExpandedLookup(null);
      setDeclaredMatch(null);
      setIsSearching(false);
      setShowCustomerDropdown(false);

      setTrackingNumber(last.trackingNumber ?? "");
      setCustomerId(last.customerId);
      setCustomerSearch(last.customerCode || last.customerName || "");
      setIsUnclaimed(last.isUnclaimed);
      setWeightKg(last.weightKg);
      setLengthCm(last.lengthCm);
      setWidthCm(last.widthCm);
      setHeightCm(last.heightCm);
      setDirectCbm(last.typedCbm);
      setDescription(last.description);
      setCategoryId(last.categoryId ? String(last.categoryId) : "");
      setPhotos(last.photos);
      setShippingType(last.shippingType as "air_regular" | "air_irregular" | "sea");
      setBatchId(last.batchId ? String(last.batchId) : "");
      setOriginWarehouseId(last.originWarehouseId);
      setLastRegistered((prev) => ({
        ...(prev ?? { time: last.registeredAt ? new Date(last.registeredAt) : new Date() }),
        packageCode: last.packageCode,
        trackingNumber: last.trackingNumber ?? "",
        customerName: last.customerCode || last.customerName || t("quickRegister.unclaimed"),
      }));
      setCorrecting({ id: last.id, packageCode: last.packageCode, orderLinked: last.orderLinked, photos: last.photos });
      // The weight is what is usually wrong, so that is where the caret goes.
      setTimeout(() => focusWeight(), 80);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setOpeningCorrection(false);
    }
  };

  /** Save the correction: the form is the whole truth, as on a registration. */
  const submitCorrection = async () => {
    if (!correcting || correctMutation.isPending) return;
    if (!customerId && !isUnclaimed) {
      soundManager.playError();
      toast.error(t("quickRegister.pleaseSelectCustomerOrUnclaimed"));
      return;
    }
    const odd = oddParcelNumbers({ weightKg, lengthCm, widthCm, heightCm, volumeCbm: directCbm });
    if (odd.length > 0) {
      const sure = await confirmAction({
        title: pickLang(language, { ku: "ئەم ژمارەیە لۆجیکی نییە", en: "This number does not look right", ar: "هذا الرقم غير منطقي", zh: "这个数字不合逻辑" }),
        message: oddParcelQuestion(odd),
        confirmLabel: pickLang(language, { ku: "بەڵێ، ڕاستە", en: "Yes, it is right", ar: "نعم، صحيح", zh: "是的，正确" }),
        cancelLabel: pickLang(language, { ku: "دەگەڕێمەوە ڕاستی دەکەمەوە", en: "Go back and fix it", ar: "أعود وأصححه", zh: "返回修改" }),
      });
      if (!sure) return;
    }
    const photosChanged =
      photos.length !== correcting.photos.length || photos.some((url, i) => url !== correcting.photos[i]);
    correctMutation.mutate({
      id: correcting.id,
      customerId: isUnclaimed ? null : customerId,
      isUnclaimed,
      weightKg,
      lengthCm,
      widthCm,
      heightCm,
      volumeCbm: directCbm,
      description,
      categoryId: categoryId ? parseInt(categoryId) : null,
      ...(photosChanged ? { photos } : {}),
    });
  };

  const resetForm = () => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      setSearchTimeout(null);
    }
    searchVersionRef.current++;
    setTrackingNumber("");
    setFoundOrder(null);
    setExpandedLookup(null);
    setLinkAllSharingOrders(true);
    setIsSearching(false);
    setWeightKg("");
    setLengthCm("");
    setWidthCm("");
    setHeightCm("");
    setCategoryId("");
    setDescription("");
    setDirectCbm("");
    setPhotos([]);
    confirmNoBatchRef.current = false;
    trackingRef.current?.focus();
  };

  // Clear ALL form fields including sticky ones
  const clearAllForm = () => {
    // While a correction is open, "clear" means "leave it as it was": an
    // emptied form saved as the correction would blank a real parcel.
    if (correcting) {
      closeCorrection(false);
      return;
    }
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      setSearchTimeout(null);
    }
    searchVersionRef.current++;
    setTrackingNumber("");
    setFoundOrder(null);
    setIsSearching(false);
    setCustomerId(null);
    setCustomerSearch("");
    setIsUnclaimed(false);
    setWeightKg("");
    setLengthCm("");
    setWidthCm("");
    setHeightCm("");
    setBatchId("");
    setOriginWarehouseId(warehouses?.[0]?.id ?? null);
    setShippingType("air_regular");
    setCategoryId("");
    setDescription("");
    setDirectCbm("");
    setPhotos([]);
    setHighlightedCustomerIndex(-1);
    confirmNoBatchRef.current = false;
    trackingRef.current?.focus();
    toast.info(t("quickRegister.formCleared"));
  };
  
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // A correction is open: Enter saves the correction, never a registration.
    if (correcting) {
      await submitCorrection();
      return;
    }
    
    // Require tracking number - cannot register without it
    if (!trackingNumber.trim()) {
      soundManager.playError();
      toast.error(t("quickRegister.pleaseEnterTracking"));
      trackingRef.current?.focus();
      return;
    }

    // Prevent duplicate registration - if tracking already exists as package
    if (foundOrder?.source === "package") {
      soundManager.playDuplicate();
      toast.error(
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
          <div>
            <div className="font-medium">{t("quickRegister.trackingAlreadyRegistered")}</div>
            <div className="text-sm">{t("quickRegister.cannotReRegister")}</div>
          </div>
        </div>
      );
      return;
    }

    if (!customerId && !isUnclaimed) {
      soundManager.playError();
      toast.error(t("quickRegister.pleaseSelectCustomerOrUnclaimed"));
      return;
    }

    if (!selectedWarehouse) {
      soundManager.playError();
      toast.error(t("quickRegister.pleaseSelectWarehouse"));
      return;
    }


    // Soft, non-blocking batch reminder. Batch stays optional: on the FIRST
    // Save with no batch selected we warn and stop so staff can pick one — but
    // pressing Save again (still no batch) registers the package without a
    // batch, exactly as intended. The flag resets per package (see resetForm /
    // clearAllForm), so every new registration gets its own reminder.
    const hasBatch = !!batchId && batchId !== "none";
    if (!hasBatch && !confirmNoBatchRef.current) {
      soundManager.playError();
      toast.warning(t("quickRegister.noBatchReminder"));
      confirmNoBatchRef.current = true;
      return;
    }

    const packageData: any = {
      customerId: isUnclaimed ? undefined : customerId!,
      isUnclaimed: isUnclaimed,
      originWarehouseId: selectedWarehouse.id,
      trackingNumber: trackingNumber || undefined,
      weightKg: weightKg || undefined,
      lengthCm: lengthCm || undefined,
      widthCm: widthCm || undefined,
      heightCm: heightCm || undefined,
      volumeCbm: directCbm || undefined,
      shippingType,
      description: description || undefined,
      batchId: batchId && batchId !== "none" ? parseInt(batchId) : undefined,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      photos: photos.length > 0 ? photos : undefined,
    };
    
    // Block submit on customer-mismatch — single-customer rule.
    if (expandedLookup?.flags?.customerMismatch) {
      soundManager.playError();
      toast.error(t("quickRegister.trackingDifferentCustomer"));
      return;
    }

    // Build linkedOrderIds[] from the expanded lookup. Falls back to the
    // legacy single-link fullPackageOrderId for old "regular package found"
    // paths the expanded procedure does not cover.
    if (expandedLookup && (expandedLookup.case === 'single' || expandedLookup.case === 'shared' || expandedLookup.case === 'multi')) {
      if (expandedLookup.case === 'shared' && linkAllSharingOrders) {
        packageData.linkedOrderIds = expandedLookup.orders.map((o) => o.order.id);
      } else if (expandedLookup.orders[0]) {
        packageData.linkedOrderIds = [expandedLookup.orders[0].order.id];
      }
    } else if (foundOrder?.found && foundOrder.order && foundOrder.source === "full_package") {
      packageData.fullPackageOrderId = foundOrder.order.id;
    }

    // A slipped digit (224 kg, 500 cm) is asked about once before it is
    // saved — never refused (shared/parcelNumberSense, owner 2026-10-04).
    const odd = oddParcelNumbers({ weightKg, lengthCm, widthCm, heightCm, volumeCbm: directCbm });
    if (odd.length > 0) {
      const sure = await confirmAction({
        title: pickLang(language, { ku: "ئەم ژمارەیە لۆجیکی نییە", en: "This number does not look right", ar: "هذا الرقم غير منطقي", zh: "这个数字不合逻辑" }),
        message: oddParcelQuestion(odd),
        confirmLabel: pickLang(language, { ku: "بەڵێ، ڕاستە", en: "Yes, it is right", ar: "نعم، صحيح", zh: "是的，正确" }),
        cancelLabel: pickLang(language, { ku: "دەگەڕێمەوە ڕاستی دەکەمەوە", en: "Go back and fix it", ar: "أعود وأصححه", zh: "返回修改" }),
      });
      if (!sure) return;
    }

    registerMutation.mutate(packageData);
  };
  // Handle Enter key for form submission
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Don't submit if customer dropdown is open and item is highlighted
      if (showCustomerDropdown && highlightedCustomerIndex >= 0) {
        return;
      }
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      // Esc to clear form
      clearAllForm();
    }
  };
  
  const getOrderTypeInfo = (source: string | null) => {
    switch (source) {
      case "full_package":
        return { label: t("quickRegister.sourceFullPackage"), color: "bg-gradient-to-r from-purple-500 to-purple-600 text-white", icon: "📦" };

      case "commission":
        return { label: t("quickRegister.sourceCommission"), color: "bg-gradient-to-r from-green-500 to-green-600 text-white", icon: "💰" };
      case "package":
        return { label: t("quickRegister.sourcePackage"), color: "bg-gradient-to-r from-gray-500 to-gray-600 text-white", icon: "📦" };
      default:
        return { label: t("quickRegister.unknown"), color: "bg-gray-100 dark:bg-gray-950/40 text-gray-800 dark:text-gray-200", icon: "❓" };
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-2" onKeyDown={handleKeyDown}>
        {/* Non-blocking error banner when list APIs fail */}
        {hasQueryError && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t("quickRegister.dataLoadError")}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={refetchAll} className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/40">
              {t("quickRegister.retry")}
            </Button>
          </div>
        )}


        {/* Professional Header with Stats */}
        <div className="mb-4">
          {/* Top Bar with Title and Stats.
              Clipped, not hidden: the glow below hangs 64px past the end of
              this card, and a box that merely hides its overflow can still be
              scrolled to it. Focusing the button at the end of the banner did
              exactly that — the whole header slid 64px sideways and cut its
              own title off. A clipped box cannot scroll at all. */}
          <div className="relative overflow-clip rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 px-4 py-2.5 shadow-md ring-1 ring-white/10 text-white">
            <div className="pointer-events-none absolute -end-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/10 to-transparent" />
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              {/* Title Section */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/25 text-white shadow-lg flex items-center justify-center">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-white drop-shadow-sm">{t("quickRegister.title")}</h1>
                  <p className="text-white/85 text-[11px]">{t("quickRegister.shortcutsHint")}</p>
                </div>
              </div>

              {/* Today's Counter */}
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/15 backdrop-blur ring-1 ring-white/25 px-3 py-1.5 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-white/80">{t("quickRegister.todayRegistered")}</div>
                    <div className="text-xl font-bold text-white leading-none">{packageStats?.todayCount || 0}</div>
                  </div>
                </div>

                {/* Clear All Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearAllForm}
                  className="h-9 px-3 text-sm bg-white/15 text-white border-white/25 hover:bg-white/25 hover:text-white backdrop-blur"
                >
                  <RotateCcw className="h-4 w-4 ms-1.5" />
                  {t("quickRegister.clear")}
                </Button>
              </div>
            </div>

            {/* Last Registered Package — richer, wraps cleanly, never overflows.
                The same strip, in amber, while that registration is open for
                correction: it is the one place on the screen that already
                names the parcel, so it is where the screen says what is
                being changed. */}
            {lastRegistered && (
              <div
                className={cn(
                  "mt-3 rounded-xl border px-4 py-3",
                  correcting
                    ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40"
                    : "border-emerald-200/70 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20",
                )}
                data-testid="qr-last-registered"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                  {correcting ? (
                    <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200" data-testid="qr-correcting">
                      <PencilLine className="h-4 w-4 shrink-0" />
                      {pickLang(language, { ku: "چاککردنەوەی دوایین تۆمار", en: "Correcting the last registration", ar: "تصحيح آخر تسجيل", zh: "正在更正上一条登记" })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" /> {t("quickRegister.lastRegistered")}
                    </span>
                  )}
                  <span className="font-mono font-bold text-foreground">{lastRegistered.packageCode}</span>
                  {lastRegistered.trackingNumber && (
                    <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                      <PackageSearch className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-mono truncate max-w-[14rem]" title={lastRegistered.trackingNumber}>{lastRegistered.trackingNumber}</span>
                    </span>
                  )}
                  <OrderNumbers numbers={lastRegistered.orderNumber} className="text-xs" />
                  <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate max-w-[12rem]">{lastRegistered.customerName}</span>
                  </span>
                  {lastRegistered.enteredBy && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      {pickLang(language, { ku: "داخڵکرا لەلایەن", en: "By", ar: "بواسطة", zh: "录入" })}: <span className="font-medium text-foreground">{lastRegistered.enteredBy}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {lastRegistered.time.toLocaleString("en-GB")}
                  </span>
                  {lastRegistered.orderDate && (
                    <>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {pickLang(language, { ku: "بەرواری ئۆردەر", en: "Order date", ar: "تاريخ الطلب", zh: "订单日期" })}: {lastRegistered.orderDate.toLocaleDateString("en-GB")}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                        {pickLang(language, { ku: "ماوەی گەیشتن", en: "Transit", ar: "مدة الوصول", zh: "运达" })}: {Math.max(0, Math.round((lastRegistered.time.getTime() - lastRegistered.orderDate.getTime()) / 86400000))} {pickLang(language, { ku: "ڕۆژ", en: "days", ar: "يوم", zh: "天" })}
                      </span>
                    </>
                  )}
                  {/* The way back to it. Dark on the pale strip, because the
                      header behind is orange and white text would vanish. */}
                  {correcting ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => closeCorrection(false)}
                      disabled={correctMutation.isPending}
                      className="ms-auto h-8 gap-1.5 border-amber-400 bg-white/80 text-amber-900 hover:bg-white dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-900/60"
                      data-testid="qr-correction-cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                      {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "تراجع", zh: "取消" })}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={openCorrection}
                      disabled={openingCorrection}
                      className="ms-auto h-8 gap-1.5 border-emerald-300 bg-white/80 text-emerald-800 hover:bg-white dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:bg-emerald-900/60"
                      data-testid="qr-correct-last"
                    >
                      {openingCorrection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PencilLine className="h-3.5 w-3.5" />}
                      {pickLang(language, { ku: "هەڵەیە؟ چاکی بکەرەوە", en: "Wrong? Correct it", ar: "خطأ؟ صحّحه", zh: "有误？更正" })}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Two-column layout: all fields on the left, the summary as a
              sticky sidebar on the right — keeps the whole form on one
              screen (no downward scrolling), like before. */}
        {/* Quick access: register a prohibited item (goes to its own fast flow).
            A link, not a button that navigates. The leave guard holds every
            link on the page while a parcel is half entered; a button calling
            the router directly walked straight past it — the widest target
            on the screen, one row above the tracking box, and the one way
            off the page that never asked (found 2026-10-05, by pressing it
            by accident with a correction open). */}
        <Link
          href="/packages/prohibited-register"
          className="mb-2 w-full flex items-center justify-between gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
        >
          <span className="flex items-center gap-2.5 text-xs font-medium text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            {pickLang(language, { ku: "کەلوپەلی قەدەغە؟ لێرەوە تۆماری بکە", en: "Prohibited item? Register it here", ar: "بضاعة ممنوعة؟ سجّلها من هنا", zh: "违禁物品？在此登记" })}
          </span>
          <ChevronDown className="h-4 w-4 -rotate-90 rtl:rotate-90 text-red-400" />
        </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
            {/* Fields column */}
            <div className="lg:col-span-2 min-w-0 space-y-3">

              {/* Tracking + Customer + Warehouse + Shipping + Weight —
                  two per row so each field is a comfortable, wide rectangle */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch [&>*]:h-full">
                {/* Tracking Number — spans the full row so the field is a
                    wide, comfortable rectangle (it's the primary input) */}
                <Card className="md:col-span-5 border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    {/*
                      One frame for the two things a person does here (owner,
                      2026-09-29: «ئەو دووانە لە چوارچێوەی یەک کارتدا بن،
                      پێویست ناکات زۆر مەسافە داگیر بکەن»). Two cards for two
                      short fields meant two borders, two headings and twice
                      the height, for scanning a parcel and saying whose it
                      is — which is one action, done in one breath.

                      Side by side from `md` up, stacked on a phone. What the
                      lookup finds runs full width underneath both, because it
                      belongs to neither on its own.
                    */}
                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center">
                            <PackageSearch className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{t("quickRegister.stepTracking")}</span>
                          {isSearching && <Loader2 className="h-4 w-4 animate-spin text-amber-500 dark:text-amber-400" />}
                        </div>
                        {/* A box the width of a tracking number, not of the
                            card it sits in (owner, 2026-09-23). */}
                        <div className="flex gap-2 max-w-xl">
                          <Input
                            ref={trackingRef}
                            placeholder={t("quickRegister.trackingPlaceholder")}
                            value={trackingNumber}
                            readOnly={!!correcting}
                            onChange={(e) => handleTrackingChange(e.target.value)}
                            onKeyDown={(e) => {
                              // Barcode scanners send Enter at the end of the
                              // scan. Without this handler the Enter bubbles to
                              // the form's outer onKeyDown and triggers
                              // handleSubmit — which (because customerId is
                              // sticky between registrations) succeeds with an
                              // empty weight on every package after the first.
                              // Intercept Enter here, run the search
                              // immediately (cancelling the 300ms debounce),
                              // and let handleTrackingSearch's success path
                              // move focus to the weight field.
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                // A correction is open: Enter here is the
                                // same Enter as anywhere else on the form.
                                if (correcting) {
                                  void handleSubmit();
                                  return;
                                }
                                if (searchTimeout) {
                                  clearTimeout(searchTimeout);
                                  setSearchTimeout(null);
                                }
                                handleTrackingSearch();
                              }
                            }}
                            className={cn("font-mono text-base h-11 flex-1", correcting && "bg-muted text-muted-foreground")}
                            autoFocus
                          />
                          <Button
                            type="button"
                            size="lg"
                            onClick={() => handleTrackingSearch()}
                            disabled={trackingNumber.trim().length < 1 || isSearching || !!correcting}
                            className="h-11 px-3 bg-amber-500 hover:bg-amber-600 text-white"
                          >
                            {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                          </Button>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{t("quickRegister.stepCustomer")}</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              ref={customerInputRef}
                              placeholder={t("quickRegister.customerSearchPlaceholder")}
                              value={customerSearch}
                              onChange={(e) => {
                                setCustomerSearch(e.target.value);
                                setShowCustomerDropdown(true);
                                if (e.target.value === "") setCustomerId(null);
                              }}
                              onFocus={() => setShowCustomerDropdown(true)}
                              onKeyDown={handleCustomerKeyDown}
                              disabled={isUnclaimed || (foundOrder?.customer != null) || ownerFollowsOrder}
                              className="text-base h-12"
                            />
                            {showCustomerDropdown && filteredCustomers.length > 0 && !isUnclaimed && !foundOrder?.customer && (
                              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-xl shadow-lg max-h-48 overflow-auto">
                                {filteredCustomers.map((customer, index) => (
                                  <button
                                    key={customer.id}
                                    type="button"
                                    className={cn(
                                      "w-full px-4 py-3 text-sm text-start transition-colors",
                                      index === highlightedCustomerIndex
                                        ? "bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
                                        : "hover:bg-muted"
                                    )}
                                    onClick={() => selectCustomer(customer)}
                                    onMouseEnter={() => setHighlightedCustomerIndex(index)}
                                  >
                                    <span className="font-bold text-blue-600 dark:text-blue-400">{customer.customerCode}</span>
                                    <span className="text-muted-foreground me-2">- {customer.fullName}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* A lone warning triangle said nothing about what
                              pressing it would do (owner, 2026-09-29: «ئایکۆنی
                              داخل کردنی بێ ناو جوانتر و واضحتر بکە، بنووسە تۆماری
                              پاکەتی بێ ناو»). It carries the sentence now, and
                              says plainly when it is on. */}
                          <Button
                            type="button"
                            size="lg"
                            variant={isUnclaimed ? "default" : "outline"}
                            onClick={toggleUnclaimed}
                            disabled={foundOrder?.customer != null || ownerFollowsOrder}
                            aria-pressed={isUnclaimed}
                            data-testid="qr-unclaimed"
                            className={cn(
                              "h-12 shrink-0 gap-2 px-4 font-semibold",
                              isUnclaimed
                                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
                                : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40",
                            )}
                          >
                            {isUnclaimed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                            {/* Short on a phone rather than nothing: a lone
                                triangle is exactly what the sentence was
                                added to fix. */}
                            <span className="hidden sm:inline">
                              {isUnclaimed
                                ? pickLang(language, { ku: "پاکەتی بێ ناو", en: "Nameless parcel", ar: "طرد بلا اسم", zh: "无主包裹" })
                                : pickLang(language, { ku: "تۆماری پاکەتی بێ ناو", en: "Register a nameless parcel", ar: "تسجيل طرد بلا اسم", zh: "登记无主包裹" })}
                            </span>
                            <span className="sm:hidden">
                              {pickLang(language, { ku: "بێ ناو", en: "No name", ar: "بلا اسم", zh: "无主" })}
                            </span>
                          </Button>
                        </div>
                        {(customerId || isUnclaimed) && (() => {
                          const lockedByOrder = ownerFollowsOrder || (foundOrder?.customer != null
                            && (foundOrder.source === 'full_package' || foundOrder.source === 'commission'));
                          return (
                            <div className={cn("mt-3 p-2 rounded-lg text-sm flex items-center gap-2",
                              isUnclaimed ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60" : "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/60"
                            )}>
                              {isUnclaimed ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                              <span className="font-bold">{isUnclaimed ? t("quickRegister.unclaimed") : customers?.find(c => c.id === customerId)?.customerCode}</span>
                              {lockedByOrder && (
                                <span className="ms-auto text-[11px] bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full font-semibold">
                                  🔒 {t("quickRegister.locked")}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    {/* Tracking Info Display */}
                    {foundOrder?.found && (
                      <div className={cn(
                        "mt-3 p-3 rounded-lg text-sm",
                        foundOrder.source === "package"
                          ? "bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800/60"
                          : "bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/60"
                      )}>
                        <div className="flex items-center gap-2">
                          {foundOrder.source === "package" ? (
                            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-300" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-300" />
                          )}
                          <span className={cn(
                            "font-bold",
                            foundOrder.source === "package" ? "text-yellow-700 dark:text-yellow-300" : "text-green-700 dark:text-green-300"
                          )}>
                            {getOrderTypeInfo(foundOrder.source).label}
                          </span>
                        </div>
                        {foundOrder.customer && (
                          <div className="mt-1 text-muted-foreground">
                            {t("quickRegister.customerLabel")}: <span className="font-bold text-primary">{foundOrder.customer.customerCode}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Shared / multi / mismatch panel — only shown when the
                        expanded lookup found something interesting. Mirrors
                        the inline panel from BulkRegister but adapted to the
                        single-row, scanner-friendly layout of QuickRegister. */}
                    {expandedLookup && expandedLookup.flags?.customerMismatch && (
                      <div className="mt-3 p-3 rounded-lg border-2 border-rose-300 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30">
                        <div className="flex items-start gap-2 text-rose-900 dark:text-rose-200">
                          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold">{t("quickRegister.sharedTrackingDifferentCustomer")}</div>
                            <div className="text-xs opacity-90">{t("quickRegister.submitDisabledFixInAlerts")}</div>
                            {/* The record that holds it, one click away — the
                                owner, 2026-09-23: "it is very important that
                                there is a link to the very place that has that
                                tracking." */}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {expandedLookup.orders.map((od) => (
                                <span key={od.order.id} className="inline-flex items-center gap-1">
                                  <Link
                                    href={orderHref(od.order)}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white/80 px-2 py-1 font-mono text-xs font-medium text-rose-900 transition-colors hover:bg-white dark:border-rose-800 dark:bg-black/30 dark:text-rose-200"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {od.order.orderCode}
                                    <span className="font-sans opacity-80">{od.customer?.customerCode ?? "?"}</span>
                                  </Link>
                                  {/* The cure beside the complaint: take this
                                      tracking off that order (owner, 2026-09-23). */}
                                  {(() => {
                                    const row = od.trackings?.find((tr) => tr.trackingNumber === trackingNumber.trim());
                                    if (!row) return null;
                                    return (
                                      <button
                                        type="button"
                                        disabled={unlinkTracking.isPending}
                                        onClick={async () => {
                                          const ok = await confirmAction(pickLang(language, {
                                            ku: `تراکی ${trackingNumber.trim()} لە داواکاری ${od.order.orderCode} (${od.customer?.customerCode ?? "?"}) ببڕدرێتەوە؟`,
                                            en: `Take tracking ${trackingNumber.trim()} off order ${od.order.orderCode} (${od.customer?.customerCode ?? "?"})?`,
                                            ar: `إزالة التتبع ${trackingNumber.trim()} من الطلب ${od.order.orderCode} (${od.customer?.customerCode ?? "?"})؟`,
                                            zh: `将运单号 ${trackingNumber.trim()} 从订单 ${od.order.orderCode}（${od.customer?.customerCode ?? "?"}）移除？`,
                                          }));
                                          if (ok) unlinkTracking.mutate({ id: row.id });
                                        }}
                                        className="inline-flex items-center gap-1 rounded-md border border-rose-400 px-1.5 py-1 text-[11px] font-medium text-rose-800 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-950/50"
                                        data-testid={`unlink-tracking-${od.order.id}`}
                                      >
                                        {unlinkTracking.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                                        {pickLang(language, { ku: "بیبڕەوە", en: "Unlink", ar: "أزل", zh: "解除" })}
                                      </button>
                                    );
                                  })()}
                                </span>
                              ))}
                              <Link
                                href="/tracking-alerts"
                                className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white/80 px-2 py-1 text-xs font-medium text-rose-900 transition-colors hover:bg-white dark:border-rose-800 dark:bg-black/30 dark:text-rose-200"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                Tracking Alerts
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {expandedLookup?.case === 'shared' && !expandedLookup.flags?.customerMismatch && (
                      <div className="mt-3 p-3 rounded-lg border-2 border-orange-300 dark:border-orange-800/60 bg-orange-50 dark:bg-orange-950/30">
                        <div className="flex items-center gap-2 text-orange-900 dark:text-orange-200 mb-2">
                          <span>🔗</span>
                          <span className="font-bold">{t("quickRegister.sharedTrackingOrders", { count: expandedLookup.orders.length })}</span>
                        </div>
                        <div className="space-y-1 mb-2">
                          {expandedLookup.orders.map((od) => (
                            <Link
                              key={od.order.id}
                              href={orderHref(od.order)}
                              className="flex items-center gap-2 text-xs p-1.5 rounded bg-white/70 dark:bg-black/30 border border-orange-200/60 dark:border-orange-800/40 transition-colors hover:border-orange-400 hover:bg-white dark:hover:bg-black/50"
                            >
                              <span className="font-mono font-medium underline-offset-2">{od.order.orderCode}</span>
                              <OrderNumbers numbers={od.order.orderNumber} />
                              {/* Which shop it was bought from — context only,
                                  and absent for orders that never recorded one. */}
                              <PlatformChip platform={od.order.platform} size="xs" />
                              <span className="truncate">{od.order.productName}</span>
                              {od.order.quantity > 1 && <span className="text-muted-foreground">×{od.order.quantity}</span>}
                              <span className="text-primary ms-auto font-medium">{od.customer?.customerCode ?? '?'}</span>
                              {od.batch && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-[10px]">
                                  {od.batch.batchCode}
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                        {expandedLookup.flags?.batchConflict && (
                          <div className="text-xs text-amber-800 dark:text-amber-300 mb-2">
                            ⚠ {t("quickRegister.linkedOrdersDifferentBatches")}
                          </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={linkAllSharingOrders}
                            onChange={(e) => setLinkAllSharingOrders(e.target.checked)}
                            className="h-3.5 w-3.5 cursor-pointer"
                          />
                          <span>
                            {linkAllSharingOrders
                              ? t("quickRegister.linkAllOrders", { count: expandedLookup.orders.length })
                              : t("quickRegister.linkPrimaryOnly")}
                          </span>
                        </label>
                      </div>
                    )}
                    {expandedLookup?.case === 'multi' && expandedLookup.orders[0] && !expandedLookup.flags?.customerMismatch && (
                      <div className="mt-3 p-3 rounded-lg border-2 border-blue-300 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30">
                        <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 mb-2">
                          <span>📦</span>
                          <span className="font-bold">
                            {t("quickRegister.orderWithCartons", { orderCode: expandedLookup.orders[0].order.orderCode, count: expandedLookup.orders[0].trackings.length })}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {expandedLookup.orders[0].trackings.map((tr) => {
                            const reg = expandedLookup.existingPackages.find((p) => p.trackingNumber === tr.trackingNumber);
                            const isThis = tr.trackingNumber === trackingNumber.trim();
                            return (
                              <div key={tr.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-white/70 dark:bg-black/30 border border-blue-200/60 dark:border-blue-800/40">
                                <span className="font-mono w-12">{t("quickRegister.carton", { index: tr.cartonIndex })}</span>
                                <span className="font-mono truncate">{tr.trackingNumber}</span>
                                <span className="ms-auto">
                                  {isThis ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-[10px]">{t("quickRegister.cartonNow")}</span>
                                  ) : reg ? (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-[10px]">✅ {reg.packageCode}</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded border border-muted text-muted-foreground text-[10px]">⏳ {t("quickRegister.cartonWaiting")}</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

              {foundOrder?.found && foundOrder.order && (
                <Card className="md:col-span-5 border-2 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-card rounded-2xl shadow-sm overflow-hidden">
                  <CardContent className="p-5 space-y-4">
                    {/* Header: type + order code + product name. The picture
                        of the goods is in the photo card on the other side —
                        one place for photographs, not two (owner,
                        2026-09-29). */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-600 text-white">
                            {foundOrder.order.orderType === "commission"
                              ? pickLang(language, { ku: "کڕین بە تێچوو", en: "Commission", ar: "شراء بعمولة", zh: "代购" })
                              : foundOrder.order.orderType === "purchase_request"
                              ? pickLang(language, { ku: "داواکاری کڕین", en: "Purchase request", ar: "طلب شراء", zh: "采购请求" })
                              : pickLang(language, { ku: "پاکێجی تەواو", en: "Full package", ar: "طرد كامل", zh: "整包" })}
                          </span>
                          {foundOrder.order.orderCode && (
                            <span className="text-sm font-mono font-bold text-indigo-900 dark:text-indigo-200" dir="ltr">{foundOrder.order.orderCode}</span>
                          )}
                        </div>
                        {foundOrder.order.productName && (
                          <p className="text-base font-semibold text-foreground truncate mt-1" title={String(foundOrder.order.productName)}>{foundOrder.order.productName}</p>
                        )}

                        {/* What the parcel should contain, beside the picture
                            of it. The person holding the goods is checking
                            them against the order, and size and colour are
                            what they are checking — they were recorded and
                            then shown nowhere on this screen. Hidden when
                            blank rather than shown as a dash: an empty field
                            here is normal, and four "—" would crowd out the
                            two that are filled in. */}
                        {(foundOrder.order.size || foundOrder.order.color || trackingPieces > 1
                          || trackingPlatforms.length > 0 || trackingOrderNumbers.some(Boolean)) && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-2">
                            {/* How many pieces to count out of this carton —
                                first, because it is the one the hands need. */}
                            {trackingPieces > 1 && (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-bold rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-2 py-1"
                                data-testid="qr-tracking-pieces"
                              >
                                <Layers className="h-3.5 w-3.5" />
                                {trackingCartons > 1
                                  ? pickLang(language, {
                                      ku: `${trackingPieces} پارچە لە ${trackingCartons} کارتۆن`,
                                      en: `${trackingPieces} pieces in ${trackingCartons} cartons`,
                                      ar: `${trackingPieces} قطعة في ${trackingCartons} كراتين`,
                                      zh: `${trackingPieces} 件，分 ${trackingCartons} 箱`,
                                    })
                                  : pickLang(language, {
                                      ku: `ئەم تراکە ${trackingPieces} پارچەی تێدایە${trackingOrders.length > 1 ? ` — ${trackingOrders.length} ئۆردەر` : ""}`,
                                      en: `This tracking carries ${trackingPieces} pieces${trackingOrders.length > 1 ? ` — ${trackingOrders.length} orders` : ""}`,
                                      ar: `هذا التتبع يحمل ${trackingPieces} قطعة${trackingOrders.length > 1 ? ` — ${trackingOrders.length} طلبات` : ""}`,
                                      zh: `此运单含 ${trackingPieces} 件${trackingOrders.length > 1 ? ` — ${trackingOrders.length} 张订单` : ""}`,
                                    })}
                              </span>
                            )}
                            {/* Which shop, and the shop's own number for it:
                                what the customer is asked about at the
                                counter. */}
                            {trackingPlatforms.map((name) => (
                              <PlatformChip key={name} platform={name} size="xs" />
                            ))}
                            <OrderNumbers numbers={trackingOrderNumbers} className="text-xs" />
                            {foundOrder.order.size && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-white/70 dark:bg-card/40 px-2 py-1">
                                <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                                {pickLang(language, { ku: "قەبارە", en: "Size", ar: "المقاس", zh: "尺码" })}:
                                <b className="font-bold">{foundOrder.order.size}</b>
                              </span>
                            )}
                            {foundOrder.order.color && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-white/70 dark:bg-card/40 px-2 py-1">
                                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                                {pickLang(language, { ku: "ڕەنگ", en: "Colour", ar: "اللون", zh: "颜色" })}:
                                <b className="font-bold">{foundOrder.order.color}</b>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/*
                      The paperwork, folded.

                      Order number, date, waiting days, who entered it and how
                      far through this customer's orders we are: all true, all
                      occasionally wanted, and together 351px of reading
                      standing between the tracking box and the rest of the
                      job. Closed by default (owner, 2026-09-29: «تەنها لەکاتی
                      گونجاو زانیاری تر بێت، با زۆریش قەرباڵغ نەبێ»).

                      The one figure that changes what the counter does — how
                      many of this customer's parcels are still to come — is
                      on the fold itself, so it is read without opening
                      anything.
                    */}
                    <details className="group rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-white/60 dark:bg-card/30">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-indigo-800 dark:text-indigo-200">
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                        {pickLang(language, { ku: "وردەکاری داواکاری", en: "Order details", ar: "تفاصيل الطلب", zh: "订单详情" })}
                        {customerOrderProgress && customerOrderProgress.total > 0 && !customerOrderProgress.allRegistered && (
                          <span className="ms-auto flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-950/40 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            {pickLang(language, {
                              ku: `${customerOrderProgress.remaining} پاکێجی تر چاوەڕوانە`,
                              en: `${customerOrderProgress.remaining} more expected`,
                              ar: `${customerOrderProgress.remaining} طرد آخر متوقع`,
                              zh: `还有 ${customerOrderProgress.remaining} 件待到`,
                            })}
                          </span>
                        )}
                      </summary>

                      <div className="space-y-3 px-3 pb-3">
                    {/* Facts: order number, date, waiting days, entered-by */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      {foundOrder.order.orderNumber && (
                        <div className="rounded-lg bg-white/70 dark:bg-card/40 border border-indigo-100 dark:border-indigo-900/40 py-2 px-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground">{pickLang(language, { ku: "ئۆردەر نەمبەر", en: "Order #", ar: "رقم الطلب", zh: "订单号" })}</p>
                          <p className="flex items-center justify-center gap-1 min-w-0">
                            <span className="text-xs font-mono font-semibold truncate" dir="ltr" title={String(foundOrder.order.orderNumber)}>{foundOrder.order.orderNumber}</span>
                            <CopyButton value={String(foundOrder.order.orderNumber)} label={pickLang(language, { ku: "کۆپی ئۆردەر نەمبەر", en: "Copy order number", ar: "نسخ رقم الطلب", zh: "复制订单号" })} />
                          </p>
                        </div>
                      )}
                      {foundOrder.order.createdAt && (
                        <div className="rounded-lg bg-white/70 dark:bg-card/40 border border-indigo-100 dark:border-indigo-900/40 py-2 px-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground">{pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</p>
                          <p className="text-xs font-semibold truncate">{new Date(foundOrder.order.createdAt).toLocaleDateString("en-GB")}</p>
                        </div>
                      )}
                      {foundOrder.order.createdAt && (
                        <div className="rounded-lg bg-white/70 dark:bg-card/40 border border-indigo-100 dark:border-indigo-900/40 py-2 px-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground">{pickLang(language, { ku: "ماوەی گەیشتن", en: "Waiting", ar: "الانتظار", zh: "等待" })}</p>
                          <p className="text-xs font-mono font-semibold">{Math.max(0, Math.round((Date.now() - new Date(foundOrder.order.createdAt).getTime()) / 86400000))} {pickLang(language, { ku: "ڕۆژ", en: "d", ar: "ي", zh: "天" })}</p>
                        </div>
                      )}
                      {foundOrder.createdByName && (
                        <div className="rounded-lg bg-white/70 dark:bg-card/40 border border-indigo-100 dark:border-indigo-900/40 py-2 px-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground">{pickLang(language, { ku: "تۆمارکەر", en: "By", ar: "بواسطة", zh: "录入" })}</p>
                          <p className="text-xs font-semibold truncate" title={foundOrder.createdByName}>{foundOrder.createdByName}</p>
                        </div>
                      )}
                    </div>

                    {/*
                      What the person at the counter needs, in the order they
                      need it.

                      This said "13 of 38 registered" under the heading "this
                      customer's orders", which reads as though 13 of their
                      orders exist and 25 do not. Both numbers were true and
                      neither was the question. The question, with a box in
                      hand and a queue behind, is: how many more of this
                      customer's parcels am I still waiting for?

                      So the sentence leads with that, in words, and the
                      ratio stays underneath for anyone who wants it.
                      "Arrived" rather than "registered": the order was
                      registered the day it was placed.
                    */}
                    {customerOrderProgress && customerOrderProgress.total > 0 && (() => {
                      const { total, registered, remaining, allRegistered } = customerOrderProgress;
                      const pct = Math.min(100, Math.round((registered / total) * 100));
                      return (
                        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-white/70 dark:bg-card/40 p-3 space-y-2">
                          {/* Nothing here when everything has arrived: the
                              green banner underneath says so, and says what
                              to do next. */}
                          {!allRegistered && (
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                              <span className="text-sm font-semibold">
                                {pickLang(language, {
                                  ku: `${remaining} پاکێجی تری ئەم کڕیارە چاوەڕوانە`,
                                  en: `${remaining} more parcels expected for this customer`,
                                  ar: `${remaining} طرد آخر متوقع لهذا العميل`,
                                  zh: `该客户还有 ${remaining} 件包裹待到达`,
                                })}
                              </span>
                            </div>
                          )}
                          <div className="h-2 w-full rounded-full bg-red-200 dark:bg-red-950/50 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          {/* "13 of 38 arrived", not "13/38". In a
                              right-to-left line the slash and its two numbers
                              come apart — the 13 lands on one side and the
                              /38 on the other. Words do not reorder. */}
                          <span className="text-xs text-muted-foreground">
                            {pickLang(language, {
                              ku: `${registered} لە ${total} ئۆردەری ئەم کڕیارە گەیشتووە`,
                              en: `${registered} of this customer's ${total} orders have arrived`,
                              ar: `وصل ${registered} من أصل ${total} من طلبات هذا العميل`,
                              zh: `该客户 ${total} 张订单中已到 ${registered} 张`,
                            })}
                          </span>
                        </div>
                      );
                    })()}

                      </div>
                    </details>

                    {/* All of this customer's orders are in — delivery-ready.
                        Outside the fold: it is not a detail, it is the cue to
                        start the delivery box. */}
                    {customerOrderProgress?.allRegistered && customerOrderProgress.total > 0 && (
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-3 py-2.5">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                          {pickLang(language, { ku: "هەموو پاکێجەکانی ئەم کڕیارە گەیشتوون — ئامادەیە بۆ ئامادەکاری گەیاندن", en: "Every parcel for this customer has arrived — ready for delivery prep", ar: "وصلت كل طرود هذا العميل — جاهز لتحضير التسليم", zh: "该客户的包裹已全部到达 — 可准备配送" })}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

                {/* What was just registered, and what is still coming.
                    Owner, 2026-09-23: after Enter the customer's data stays
                    here — how many pieces are left — until the next tracking
                    is typed. The screen then belongs to that parcel again. */}
                {!foundOrder?.found && lastRegistered && customerId && !correcting && (
                  <Card className="md:col-span-5 border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/25 rounded-2xl shadow-sm">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">{t("quickRegister.packageRegistered")}</span>
                        <bdi dir="ltr" className="font-mono text-xs">{lastRegistered.packageCode}</bdi>
                        <bdi dir="ltr" className="font-mono text-xs text-muted-foreground">{lastRegistered.trackingNumber}</bdi>
                        <span className="ms-auto rounded-lg bg-white/70 dark:bg-black/30 px-2 py-0.5 text-xs font-medium">
                          {lastRegistered.customerName}
                        </span>
                      </div>

                      {customerOrderProgress && customerOrderProgress.total > 0 && (() => {
                        const { total, registered, remaining, allRegistered } = customerOrderProgress;
                        const pct = Math.min(100, Math.round((registered / total) * 100));
                        return (
                          <div className="space-y-1.5">
                            {!allRegistered && (
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                                <span className="text-sm font-semibold">
                                  {pickLang(language, {
                                    ku: `${remaining} پاکێجی تری ئەم کڕیارە چاوەڕوانە`,
                                    en: `${remaining} more parcels expected for this customer`,
                                    ar: `${remaining} طرد آخر متوقع لهذا العميل`,
                                    zh: `该客户还有 ${remaining} 件包裹待到达`,
                                  })}
                                </span>
                              </div>
                            )}
                            <div className="h-2 w-full overflow-hidden rounded-full bg-red-200 dark:bg-red-950/50">
                              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {pickLang(language, {
                                ku: `${registered} لە ${total} ئۆردەری ئەم کڕیارە گەیشتووە`,
                                en: `${registered} of this customer's ${total} orders have arrived`,
                                ar: `وصل ${registered} من أصل ${total} من طلبات هذا العميل`,
                                zh: `该客户 ${total} 张订单中已到 ${registered} 张`,
                              })}
                            </span>
                          </div>
                        );
                      })()}

                      <p className="text-[11px] text-muted-foreground">
                        {pickLang(language, {
                          ku: "تراکی دواتر داخڵ بکە — ئەم کارتە خۆی دەگۆڕدرێت",
                          en: "Type the next tracking — this card changes with it",
                          ar: "أدخل التتبع التالي — تتغير هذه البطاقة معه",
                          zh: "输入下一个运单号 — 此卡片会随之更新",
                        })}
                      </p>
                    </CardContent>
                  </Card>
                )}

              </div>

              {/* The weight, on a phone. On a desktop this is the first thing
                  on the bottom bar instead. */}
              {isMobile && (
                <Card className="border bg-card rounded-xl shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center">
                        <Scale className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{t("quickRegister.stepWeight")}</span>
                    </div>
                    <div className="relative" dir="ltr">
                      <Input
                        ref={weightRef}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className={cn(
                          "h-14 text-2xl font-mono font-bold text-center transition-shadow",
                          weightGlow && "ring-4 ring-emerald-400/70 border-emerald-500",
                        )}
                        data-testid="qr-bar-weight"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Row 2.5: Dimensions - Only for Air shipping */}
              {(shippingType === "air_regular" || shippingType === "air_irregular") && (
                <Card className="md:col-span-5 border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 flex items-center justify-center">
                        <Ruler className="h-5 w-5" />
                      </div>
                      <span className="text-base font-bold text-violet-700 dark:text-violet-400">{t("quickRegister.stepDimensions")}</span>
                      <span className="text-xs text-muted-foreground me-2">{t("quickRegister.forVolumetricWeight")}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-violet-700 dark:text-violet-400">{t("quickRegister.length")}</Label>
                        <div className="relative" dir="ltr">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            value={lengthCm}
                            onChange={(e) => setLengthCm(e.target.value)}
                            className="h-11 text-base font-mono font-bold text-center"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-violet-700 dark:text-violet-400">{t("quickRegister.width")}</Label>
                        <div className="relative" dir="ltr">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            value={widthCm}
                            onChange={(e) => setWidthCm(e.target.value)}
                            className="h-11 text-base font-mono font-bold text-center"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-violet-700 dark:text-violet-400">{t("quickRegister.height")}</Label>
                        <div className="relative" dir="ltr">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            value={heightCm}
                            onChange={(e) => setHeightCm(e.target.value)}
                            className="h-11 text-base font-mono font-bold text-center"
                          />
                        </div>
                      </div>
                    </div>

                    {/* The volume itself, for when it is already known.
                        Owner, 2026-09-23: "sometimes you do not need to
                        measure — the CBM is there", and it must set the
                        volumetric price, not merely be recorded. Given, it
                        stands for the three sides beside it
                        (@shared/chargeableWeight). It sits in the same row as
                        them, small: four boxes for one measurement, not a
                        section of its own. */}
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 items-start">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-sky-700 dark:text-sky-400">CBM (m³)</Label>
                        <div className="relative" dir="ltr">
                          <Input
                            type="number"
                            step="0.001"
                            placeholder="0.000"
                            value={directCbm}
                            onChange={(e) => setDirectCbm(e.target.value)}
                            className="h-11 text-base font-mono font-bold text-center border-sky-300 dark:border-sky-800"
                            data-testid="quick-register-direct-cbm"
                          />
                        </div>
                      </div>
                      <p className="sm:col-span-3 self-center text-[11px] leading-relaxed text-muted-foreground">
                        {pickLang(language, {
                          ku: "ئەگەر CBM پڕ بکرێتەوە، پێویست ناکات درێژی/پانی/بەرزی بنووسیت.",
                          en: "Fill the CBM and the three sides are not needed.",
                          ar: "إذا مُلئ الـ CBM فلا حاجة للطول/العرض/الارتفاع.",
                          zh: "填写 CBM 即无需长/宽/高。",
                        })}
                      </p>
                    </div>

                    {/* The weight this parcel is charged on.
                        One figure with its own name, rather than two figures
                        and a third called "chargeable" — the larger of the two
                        IS the chargeable one, and saying so separately was
                        what made three numbers out of one answer.
                        The sum is shown only when volume wins, because that is
                        the only case anybody questions, and it lets staff
                        catch a mistyped dimension at a glance. */}
                    {(volumetricWeight > 0 || parseFloat(weightKg) > 0) && (() => {
                      const actual = parseFloat(weightKg) || 0;
                      const byVolume = volumetricWeight > actual;
                      return (
                        <div className={cn(
                          "mt-4 p-4 rounded-xl border",
                          byVolume
                            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/60"
                            : "bg-card border-border",
                        )}>
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="min-w-0">
                              <p className={cn(
                                "text-sm font-bold",
                                byVolume ? "text-amber-700 dark:text-amber-300" : "text-foreground",
                              )}>
                                {byVolume ? t("packages.volumetricWeight") : t("packages.actualWeight")}
                              </p>
                              {byVolume && actual > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {t("packages.actualWeight")}: {actual.toFixed(2)} kg
                                </p>
                              )}
                            </div>
                            <span className={cn(
                              "text-3xl font-black tabular-nums shrink-0",
                              byVolume ? "text-amber-700 dark:text-amber-300" : "text-foreground",
                            )} dir="ltr">
                              {chargeableWeight.toFixed(2)} kg
                            </span>
                          </div>

                          {byVolume && (
                            <p className="mt-2 font-mono text-xs text-amber-700 dark:text-amber-400" dir="ltr">
                              {parseFloat(directCbm) > 0
                                ? `${directCbm} m³ × 1,000,000 ÷ ${volumetricDivisor} = ${volumetricWeight.toFixed(2)} kg`
                                : `${lengthCm || 0} × ${widthCm || 0} × ${heightCm || 0} ÷ ${volumetricDivisor} = ${volumetricWeight.toFixed(2)} kg`}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Sea shipping - CBM input */}
              {shippingType === "sea" && (
                <Card className="md:col-span-5 border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 flex items-center justify-center">
                        <Ship className="h-5 w-5" />
                      </div>
                      <span className="text-base font-bold text-cyan-700 dark:text-cyan-400">{t("quickRegister.stepDimensionsSea")}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">{t("quickRegister.length")}</Label>
                        <div className="relative" dir="ltr">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            value={lengthCm}
                            onChange={(e) => setLengthCm(e.target.value)}
                            className="h-11 text-base font-mono font-bold text-center"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">{t("quickRegister.width")}</Label>
                        <div className="relative" dir="ltr">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            value={widthCm}
                            onChange={(e) => setWidthCm(e.target.value)}
                            className="h-11 text-base font-mono font-bold text-center"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">{t("quickRegister.height")}</Label>
                        <div className="relative" dir="ltr">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            value={heightCm}
                            onChange={(e) => setHeightCm(e.target.value)}
                            className="h-11 text-base font-mono font-bold text-center"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-cyan-700 dark:text-cyan-400">{t("quickRegister.orCbm")}</Label>
                        <div className="relative" dir="ltr">
                          <Input
                            type="number"
                            step="0.0001"
                            placeholder="0.0000"
                            value={directCbm}
                            onChange={(e) => setDirectCbm(e.target.value)}
                            className="h-11 text-base font-mono font-bold text-center"
                          />
                        </div>
                      </div>
                    </div>
                    {/* CBM Result */}
                    <div className="mt-4 p-4 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl border border-cyan-200 dark:border-cyan-900/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Ship className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                          <span className="text-sm text-cyan-700 dark:text-cyan-300">{t("quickRegister.fromDimensions")}: <strong>{calculatedCbm.toFixed(4)} m³</strong></span>
                        </div>
                        <div className="p-3 bg-card rounded-lg shadow-sm border">
                          <span className="font-bold text-xl text-cyan-800 dark:text-cyan-300">{cbm.toFixed(4)} m³</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Portal pre-declaration match — the scanned tracking was
                  declared in advance by a customer, so we surface who owns it
                  (auto-filled above) with the photo/platform they provided. */}
              {declaredMatch?.customer && (
                <Card className="border-2 border-emerald-300 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-card rounded-2xl shadow-sm overflow-hidden">
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* The customer often sends several shots of what they
                        ordered; matching a parcel to it is easier with all of
                        them than with whichever happened to be first. */}
                    <PhotoStack
                      photos={declaredMatch.productImages ?? []}
                      className="w-16 h-16 rounded-xl border-2 border-emerald-200 dark:border-emerald-800"
                      fallback={
                        <div className="w-16 h-16 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                          <Package className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
                        </div>
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white">
                          {pickLang(language, { ku: "پێشوەخت داواکراوە", en: "Pre-declared", ar: "مُسجَّل مسبقاً", zh: "已预登记" })}
                        </span>
                        <span className="text-sm font-mono font-bold text-emerald-900 dark:text-emerald-200" dir="ltr">
                          {declaredMatch.customer.customerCode || declaredMatch.customer.fullName}
                        </span>
                      </div>
                      {declaredMatch.customer.fullName && declaredMatch.customer.customerCode && (
                        <p className="text-sm font-semibold text-foreground truncate mt-0.5">{declaredMatch.customer.fullName}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {declaredMatch.platform ? `${declaredMatch.platform}` : ""}
                        {declaredMatch.productName ? `${declaredMatch.platform ? " · " : ""}${declaredMatch.productName}` : ""}
                        {declaredMatch.notes ? `${(declaredMatch.platform || declaredMatch.productName) ? " · " : ""}${declaredMatch.notes}` : ""}
                      </p>
                    </div>
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  </CardContent>
                </Card>
              )}

              {/* Order info card — the prominent readout shown once a scanned
                  tracking matches a commission / full-package order. Two
                  progress meters: THIS order's cartons, and the customer's
                  overall commission+FP orders (green = registered/arrived,
                  red = still expected). Display-only — no business logic. */}

              {/* Photos — a card of its own, always open.
                  These used to live inside the collapsed "additional info"
                  accordion, so the person registering had to know to expand a
                  section marked optional before they could attach anything.
                  The warehouse photo is the only record of how a parcel looked
                  on arrival, and it is the first thing anyone asks for when a
                  customer disputes what they received. It belongs in plain
                  sight. */}

              {/* Row 3: Optional Fields — compact, rarely used, sits low */}
              <Card className="border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <button
                    type="button"
                    onClick={() => setShowOptional(!showOptional)}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-muted text-muted-foreground flex items-center justify-center">
                        <Tags className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">{t("quickRegister.additionalInfo")}</span>
                      <span className="text-[10px] text-muted-foreground">{t("quickRegister.optional")}</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showOptional && "rotate-180")} />
                  </button>
                  
                  {showOptional && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">{t("quickRegister.productCategory")}</Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                          <SelectTrigger className="h-11 min-w-0 [&>span]:truncate [&>span]:block [&>span]:text-start">
                            <SelectValue placeholder={t("quickRegister.selectCategory")} />
                          </SelectTrigger>
                          <SelectContent>
                            {categories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id.toString()}>
                                {cat.nameKu || cat.nameEn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label className="text-sm font-semibold">{t("quickRegister.note")}</Label>
                        <Input
                          placeholder={t("quickRegister.notePlaceholder")}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="h-11"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* The summary, last: it repeats what the fields above
                  already say, and the owner wants the room (2026-09-23). */}
              <Card className="border bg-card rounded-2xl shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Clipboard className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-lg">{t("quickRegister.summary")}</span>
                  </div>

                  {/* Whatever somebody wrote on this order when they took it.
                      Above the tiles, because it is an instruction and the
                      tiles are only facts. */}
                  <OrderNote note={(foundOrder as any)?.order?.notes} className="mb-2.5" />

                  {/* Info tiles stack in the narrow sidebar (2-up on mid widths) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 text-sm">
                    {trackingNumber.trim() && (
                      <div className="flex flex-col gap-1 py-2.5 px-3 bg-muted/50 rounded-xl min-w-0">
                        <span className="text-xs text-muted-foreground">{pickLang(language, { ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "追踪号" })}</span>
                        <span className="font-mono font-medium truncate" title={trackingNumber}>{trackingNumber}</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-1 py-2.5 px-3 bg-muted/50 rounded-xl min-w-0">
                      <span className="text-xs text-muted-foreground">{t("quickRegister.summaryCustomer")}</span>
                      <span className="font-bold text-primary truncate">
                        {isUnclaimed ? t("quickRegister.unclaimed") : (customerId ? customers?.find(c => c.id === customerId)?.customerCode : "-")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 py-2.5 px-3 bg-muted/50 rounded-xl min-w-0">
                      <span className="text-xs text-muted-foreground">{t("quickRegister.summaryWarehouse")}</span>
                      <span className="font-medium truncate">
                        {selectedWarehouse ? (selectedWarehouse.nameEn ?? selectedWarehouse.nameKu ?? t("quickRegister.warehouseN", { id: selectedWarehouse.id })) : "-"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 py-2.5 px-3 bg-muted/50 rounded-xl min-w-0">
                      <span className="text-xs text-muted-foreground">{t("quickRegister.summaryShipping")}</span>
                      <span className="font-medium truncate">
                        {shippingType === "air_regular" ? t("quickRegister.summaryAir") : shippingType === "air_irregular" ? t("quickRegister.summaryIrregular") : t("quickRegister.summarySea")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50 min-w-0">
                      <span className="text-xs text-emerald-700 dark:text-emerald-400">{t("quickRegister.summaryWeight")}</span>
                      <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">{parseFloat(weightKg || "0").toFixed(2)} kg</span>
                    </div>

                    {(shippingType === "air_regular" || shippingType === "air_irregular") && chargeableWeight > 0 && (
                      <div className="flex flex-col gap-1 py-2.5 px-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 min-w-0">
                        <span className="text-xs text-amber-700 dark:text-amber-400">{t("quickRegister.chargeableWeight")}</span>
                        <span className="font-mono font-bold text-amber-900 dark:text-amber-300">{chargeableWeight.toFixed(2)} kg</span>
                      </div>
                    )}

                    {shippingType === "sea" && cbm > 0 && (
                      <div className="flex flex-col gap-1 py-2.5 px-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl border border-cyan-200 dark:border-cyan-900/50 min-w-0">
                        <span className="text-xs text-cyan-700 dark:text-cyan-400">CBM</span>
                        <span className="font-mono font-bold text-cyan-900 dark:text-cyan-300">{cbm.toFixed(4)} m³</span>
                      </div>
                    )}

                    {(lengthCm || widthCm || heightCm) && (
                      <div className="flex flex-col gap-1 py-2.5 px-3 bg-muted/50 rounded-xl min-w-0">
                        <span className="text-xs text-muted-foreground">{pickLang(language, { ku: "قەبارە", en: "Dimensions", ar: "الأبعاد", zh: "尺寸" })}</span>
                        <span className="font-mono text-xs truncate">{lengthCm || 0}×{widthCm || 0}×{heightCm || 0} cm</span>
                      </div>
                    )}

                    {batchId && batchId !== "none" && (
                      <div className="flex flex-col gap-1 py-2.5 px-3 bg-muted/50 rounded-xl min-w-0">
                        <span className="text-xs text-muted-foreground">{t("quickRegister.summaryBatch")}</span>
                        <span className="font-medium truncate">{batches?.find((b: any) => b.id === parseInt(batchId))?.batchCode}</span>
                      </div>
                    )}

                    {estimatedPrice > 0 && (
                      <div className="sm:col-span-2 lg:col-span-1 flex flex-col gap-1 p-4 bg-primary/5 rounded-xl border border-primary/20 min-w-0">
                        <span className="text-xs text-muted-foreground">{t("quickRegister.estimatedPrice")}</span>
                        <span className="text-3xl font-bold text-primary">${estimatedPrice.toFixed(2)}</span>
                        {estimate && estimate.rate > 0 && (
                          <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                            ${estimate.rate.toFixed(2)}/{estimate.unit}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                </CardContent>
              </Card>
            </div>

            {/* Side panel: compact Warehouse + Shipping + Batch selectors
                (moved out of the center) followed by the sticky Summary */}
            <div className="lg:col-span-1 min-w-0 space-y-3">
              <Card className="border bg-card rounded-2xl shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Warehouse */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <Warehouse className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{pickLang(language, { ku: "کۆگا", en: "Warehouse", ar: "المستودع", zh: "仓库" })}</span>
                        {selectedWarehouse && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 ms-auto shrink-0" />}
                      </div>
                      <Select
                        value={originWarehouseId != null ? String(originWarehouseId) : ""}
                        onValueChange={(v) => setOriginWarehouseId(v ? parseInt(v, 10) : null)}
                        disabled={!warehouses?.length || !!correcting}
                      >
                        <SelectTrigger className="h-9 text-xs min-w-0 [&>span]:truncate [&>span]:block [&>span]:text-start">
                          <SelectValue placeholder={t("quickRegister.warehousePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses?.map((w) => (
                            <SelectItem key={w.id} value={String(w.id)}>
                              <span className="font-medium">{w.nameEn ?? w.nameKu ?? t("quickRegister.warehouseN", { id: w.id })}</span>
                              {w.codePrefix && (
                                <span className="text-muted-foreground me-2">({w.codePrefix})</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Shipping */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        <Package className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{pickLang(language, { ku: "گواستنەوە", en: "Shipping", ar: "الشحن", zh: "运输" })}</span>
                      </div>
                      <Select value={shippingType} onValueChange={(v) => { setShippingType(v as any); setBatchId(""); }} disabled={!!correcting}>
                        <SelectTrigger className="h-9 text-xs min-w-0 [&>span]:truncate [&>span]:block [&>span]:text-start">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="air_regular">
                            <div className="flex items-center gap-2">
                              <Plane className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                              <span>{t("quickRegister.airRegular")}</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="air_irregular">
                            <div className="flex items-center gap-2">
                              <Plane className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                              <span>{t("quickRegister.airIrregular")}</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="sea">
                            <div className="flex items-center gap-2">
                              <Ship className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                              <span>{t("quickRegister.sea")}</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Goods category, as one-tap chips.
                      It was only in the collapsed "additional info (optional)"
                      panel, so in practice it was never filled — and for a
                      parcel the customer never declared, the person holding
                      the box is the only one who will ever know what is in it.
                      The most-used categories sit here; the full list stays in
                      the panel below. */}
                  {categories && categories.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400">
                        <Tags className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{t("quickRegister.productCategory")}</span>
                        {declaredMatch?.categoryId && String(declaredMatch.categoryId) === categoryId && (
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {pickLang(language, {
                              ku: "لە کڕیارەوە", en: "from the customer",
                              ar: "من العميل", zh: "来自客户",
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {categories.slice(0, 8).map((cat) => {
                          const value = String(cat.id);
                          const isActive = categoryId === value;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              // Tapping the active one clears it, so a wrong
                              // tap costs one more tap rather than a reset.
                              onClick={() => setCategoryId(isActive ? "" : value)}
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition active:scale-95",
                                isActive
                                  ? "border-teal-500 bg-teal-500 text-white"
                                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                              )}
                            >
                              {cat.icon ? `${cat.icon} ` : ""}{cat.nameKu || cat.nameEn}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Batch */}
                  <Select
                    value={batchId}
                    disabled={!!correcting}
                    onValueChange={(v) => {
                      setBatchId(v);
                      // Picking a real batch clears any pending "no batch"
                      // warning, so removing it again later warns afresh.
                      if (v && v !== "none") confirmNoBatchRef.current = false;
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs min-w-0 [&>span]:truncate [&>span]:block [&>span]:text-start">
                      <SelectValue placeholder={t("quickRegister.batchPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("quickRegister.noBatch")}</SelectItem>
                      {filteredBatches.map((batch: any) => (
                        <SelectItem key={batch.id} value={batch.id.toString()}>
                          <span className="truncate">{batch.batchCode} {batch.pricePerKg ? `- $${batch.pricePerKg}/kg` : batch.pricePerCbm ? `- $${batch.pricePerCbm}/cbm` : ""}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Every photograph in one card, on the side.
                  The owner, 2026-09-23: this is the place for it — the empty
                  panel under the shipping selectors. And 2026-09-29: «دوو
                  شوێنێ وێنە هەیە... ببە لای چەپ، بە یەک کارت» — the picture
                  that arrives with the scan was in the order card on the
                  other side of the screen, so the same card now holds both:
                  what was ordered above, what turned up below — the
                  order the portal shows them in too (@shared/parcelPhotos). */}
              <Card className="border-2 border-sky-200 dark:border-sky-900/60 bg-gradient-to-br from-sky-50/60 to-card dark:from-sky-950/20 rounded-xl shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-sky-500 text-white flex items-center justify-center">
                      <Camera className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-semibold">{t("quickRegister.photos")}</span>
                    {photos.length > 0 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                        {photos.length}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground ms-auto">
                      {t("quickRegister.photosHint")}
                    </span>
                  </div>
                  {/* What was ordered — only once a scan has found it. */}
                  {foundOrder?.found && foundOrder.order && (
                    <div className="mb-3">
                      <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">
                        {pickLang(language, { ku: "وێنەی داواکاری", en: "Order photo", ar: "صورة الطلب", zh: "订单图片" })}
                      </p>
                      {/* All of the photograph, not a slice of it. This box
                          was wide and short and the picture was made to fill
                          it, so a tall product photo showed as one blurred
                          stripe (owner, 2026-10-05). It is shown whole now,
                          on a quiet ground, and a click still opens it full
                          size. */}
                      <PhotoStack
                        photos={[foundOrder.order.productImage, ...(foundOrder.order.productImages ?? [])]}
                        fit="contain"
                        className="h-44 w-full rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-muted/40 shadow-sm"
                        fallback={
                          <div className="flex h-24 w-full items-center justify-center rounded-lg border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/20">
                            <Package className="h-7 w-7 text-indigo-300 dark:text-indigo-700" />
                          </div>
                        }
                      />
                    </div>
                  )}

                  {foundOrder?.found && (
                    <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">
                      {pickLang(language, { ku: "وێنەی گەیشتن", en: "Arrival photo", ar: "صورة الوصول", zh: "到货照片" })}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img src={photo} alt="" className="w-20 h-20 object-cover rounded-lg border shadow-sm" />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-2 -end-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <label className="w-20 h-20 border-2 border-dashed border-sky-300 dark:border-sky-800 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                      {isUploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-sky-500 dark:text-sky-400" />
                      ) : (
                        <>
                          <ImagePlus className="h-6 w-6 text-sky-500 dark:text-sky-400" />
                          <span className="text-[9.5px] text-sky-600 dark:text-sky-400">{t("quickRegister.addPhoto")}</span>
                        </>
                      )}
                    </label>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>

          {/* The bar the buy-at-cost form uses, which the owner asked for
              here too (2026-09-23): the two things you do with a form, at
              the foot of the window, always in reach. The price rides on
              it so the figure and the button that commits it are together. */}
          <StickyFormBar>
            {/*
              The weight lives here now, beside the button that commits it.
              (Owner, 2026-09-29: «لەو لاکێشەی سپیەی خوارەوە لەلای ئینتەر، کێش
              و نرخی کێش لەوێ نیشان بدات».)

              It used to sit in the middle of the page, and a successful scan
              filled the page with the order's details and pushed it 445px
              down — off a 694px screen, at the exact moment it was wanted.
              Either the page jumped to it and hid what had just been scanned,
              or it did not jump and the field was simply gone. On a bar that
              never leaves the screen, nothing has to move at all.
            */}
            <span className="me-auto flex flex-wrap items-center gap-x-4 gap-y-2">
              {!isMobile && (
                <span className="flex items-center gap-2">
                  {/* The step's number, without its unit. The heading in the
                      locales is "3. کێش (kg)", and beside a box that already
                      prints kg that says it twice — but dropping the number
                      with it left the screen counting 1, 2, 4. */}
                  <span className="text-xs text-muted-foreground">
                    {pickLang(language, { ku: "3. کێش", en: "3. Weight", ar: "3. الوزن", zh: "3. 重量" })}
                  </span>
                  {/*
                    No stepper pill on the bar. It reserves 56px of padding on
                    the right of a 96px box, which left the number 40px to sit
                    in and clipped "0.00" to "0.0" — the owner, 2026-09-30:
                    «زۆر ڕێک نیە، نازانم بۆ». Nudging a weight by 0.1 is not
                    how a parcel is weighed either: the figure is read off the
                    scales and typed. The phone's card keeps its stepper,
                    where there is room for it.
                  */}
                  <Input
                    ref={weightRef}
                    type="number"
                    step="0.01"
                    stepper={false}
                    placeholder="0.00"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className={cn(
                      // `md:text-lg` as well as `text-lg`: the input primitive
                      // ends its own classes with `md:text-sm`, which a plain
                      // `text-lg` does not override on a desktop — the box was
                      // rendering at 14px in a bar sized for 18.
                      "h-10 w-28 text-lg md:text-lg font-mono font-bold text-center transition-shadow",
                      weightGlow && "ring-4 ring-emerald-400/70 border-emerald-500",
                    )}
                    dir="ltr"
                    data-testid="qr-bar-weight"
                  />
                  <span className="text-xs text-muted-foreground">kg</span>
                </span>
              )}

              {/* The chargeable weight is NOT repeated here. It has its own
                  amber panel under the three sides, beside the very boxes
                  that produce it, naming the actual weight underneath — and
                  the owner, seeing it twice: «پسوولە و کۆد زیادەیە، چ سوودێکی
                  هەیە؟». A bar that repeats the screen is a bar nobody
                  reads. */}

              {/* Sea is billed by volume outright, so the cubic metres are the
                  figure — never the kilograms beside them. */}
              {shippingType === "sea" && cbm > 0 && (
                <span className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2 py-1" data-testid="qr-bar-cbm">
                  <span className="text-[11px] text-muted-foreground">
                    {pickLang(language, { ku: "قەبارە", en: "Volume", ar: "الحجم", zh: "体积" })}
                  </span>
                  <span className="font-mono text-sm font-bold" dir="ltr">{cbm.toFixed(3)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {pickLang(language, { ku: "م³", en: "m³", ar: "م³", zh: "m³" })}
                  </span>
                </span>
              )}

              {/* Only the wrong state is worth a place here. The customer
                  code is two lines up, in step 2, locked by the scan — a
                  second copy told nobody anything. Having NO owner is
                  different: it is the one thing somebody must come back and
                  fix, and it is easy to commit without noticing. */}
              {isUnclaimed && (
                <span className="flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-2 py-1 text-[11px] font-bold text-red-700 dark:text-red-300" data-testid="qr-bar-owner">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {pickLang(language, { ku: "بێ خاوەن", en: "No owner", ar: "بلا مالك", zh: "无主" })}
                </span>
              )}

              {/* The price, with its arithmetic — an agreed per-customer rate
                  is otherwise a figure that changed for no visible reason. */}
              {estimatedPrice > 0 ? (
                /* No "estimated price" label: the dollar sign says what the
                   figure is, and the words were a third of the bar. */
                <span
                  className="flex items-baseline gap-1.5"
                  data-testid="qr-bar-price"
                  title={t("quickRegister.estimatedPrice")}
                >
                  <span className="text-xl font-bold text-primary" dir="ltr">${estimatedPrice.toFixed(2)}</span>
                  {priceWorking && (
                    <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">{priceWorking}</span>
                  )}
                </span>
              ) : hasMeasure ? (
                /* Measured, and still no price: the batch has no rate yet.
                   Saying so beats a blank space where a figure belongs. */
                <span className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300" data-testid="qr-bar-norate">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {pickLang(language, {
                    ku: "باچ نرخی نییە — دواتر نرخ دادەنرێت",
                    en: "The batch has no rate yet — it is priced later",
                    ar: "لا سعر للدفعة بعد — يُسعَّر لاحقًا",
                    zh: "该批次尚无费率 — 稍后定价",
                  })}
                </span>
              ) : null}
            </span>

            <Button type="button" variant="outline" onClick={clearAllForm}>
              <RotateCcw className="h-4 w-4 ms-2" />
              {t("quickRegister.clear")}
            </Button>
                  <Button
                    type="submit"
                    size="lg"
                    className={cn(
                      "h-10 px-6 text-sm font-bold shadow-sm transition-all",
                      !trackingNumber.trim() || foundOrder?.source === "package" || expandedLookup?.flags?.customerMismatch
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                    disabled={registerMutation.isPending || correctMutation.isPending || !trackingNumber.trim() || foundOrder?.source === "package" || expandedLookup?.flags?.customerMismatch === true}
                    data-testid="qr-submit"
                  >
                    {registerMutation.isPending || correctMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin ms-1.5" />
                    ) : foundOrder?.source === "package" ? (
                      <AlertTriangle className="h-6 w-6 ms-2 text-yellow-600 dark:text-yellow-300" />
                    ) : expandedLookup?.flags?.customerMismatch ? (
                      <AlertTriangle className="h-6 w-6 ms-2 text-rose-600 dark:text-rose-300" />
                    ) : correcting ? (
                      <PencilLine className="h-5 w-5 ms-1.5" />
                    ) : (
                      <Plus className="h-5 w-5 ms-1.5" />
                    )}
                    {correcting
                      ? pickLang(language, { ku: "پاشەکەوتی چاککردنەوە", en: "Save the correction", ar: "حفظ التصحيح", zh: "保存更正" })
                      : foundOrder?.source === "package"
                      ? t("quickRegister.btnDuplicate")
                      : expandedLookup?.flags?.customerMismatch
                        ? t("quickRegister.btnCustomerIssue")
                        : !trackingNumber.trim()
                          ? t("quickRegister.btnEnterTracking")
                          : t("quickRegister.btnRegister")}
                  </Button>
          </StickyFormBar>
        </form>
      </div>
    </DashboardLayout>
  );
}
