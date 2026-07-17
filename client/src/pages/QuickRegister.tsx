import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Package, Plane, Ship, Search, User, Loader2, CheckCircle2, Plus, Calculator, Zap, AlertTriangle, Tags, ChevronDown, ImagePlus, X, Camera, PackageSearch, Clipboard, Scale, Ruler, Info, RotateCcw, Calendar, TrendingUp, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { pickLang } from "@/lib/lang";

import { soundManager } from "@/lib/soundManager";

export default function QuickRegister() {
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
      order: { id: number; orderCode: string; orderType: string; productName: string; quantity: number; status: string; customerId: number | null; batchId: number | null; trackingNumber: string | null };
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

  // Queries — handle errors so one failed API doesn't block the form
  const { data: customers, isError: customersError, refetch: refetchCustomers } = trpc.customers.list.useQuery();
  const { data: batchesRaw, isError: batchesError, refetch: refetchBatches } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesRaw) ? batchesRaw : batchesRaw?.data;
  const { data: warehouses, isError: warehousesError, refetch: refetchWarehouses } = trpc.warehouses.list.useQuery();
  const { data: categories, isError: categoriesError, refetch: refetchCategories } = trpc.productCategories.list.useQuery();
  const { data: packageStats, isError: statsError, refetch: refetchStats } = trpc.packages.stats.useQuery();

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
  
  // Handle search - use ref to get latest tracking number
  const handleTrackingSearch = async () => {
    const currentTracking = trackingRef.current?.value || trackingNumber;
    if (currentTracking.trim().length < 1) return;

    const thisSearchVersion = ++searchVersionRef.current;

    setIsSearching(true);
    try {
      const result = await trpcUtils.scanning.searchTrackingAllTypes.fetch({
        trackingNumber: currentTracking.trim()
      });

      if (searchVersionRef.current !== thisSearchVersion) {
        console.log(`[QuickRegister] Stale search ignored: "${currentTracking}"`);
        return;
      }

      if (result) {
        setFoundOrder(result);
        // Fan out to the expanded procedure so we know if this tracking is
        // shared, multi-tracking, or has any conflict flags. Failures here
        // never block the existing flow — we just leave expandedLookup null.
        try {
          if (result.found && (result.source === 'full_package' || result.source === 'commission')) {
            const exp = await trpcUtils.packages.lookupTrackingExpanded.fetch({
              trackingNumber: currentTracking.trim(),
            });
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
            soundManager.playDuplicate();
            toast.warning(
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="font-medium">{t("quickRegister.trackingAlreadyRegistered")}</div>
                  <div className="text-sm text-muted-foreground">
                    {t("quickRegister.customerLabel")}: {result.customer?.customerCode || t("quickRegister.unknown")}
                  </div>
                </div>
              </div>
            );
          } else {
            soundManager.playFound();
            toast.success(
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
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
            weightRef.current?.focus();
            weightRef.current?.select();
          }, 100);
        } else {
          soundManager.playNotFound();
          toast.info(t("quickRegister.trackingNotFound"));
          setTimeout(() => {
            weightRef.current?.focus();
            weightRef.current?.select();
          }, 100);
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
  
  const cbm = useMemo(() => {
    if (shippingType === "sea" && directCbm) {
      return parseFloat(directCbm) || 0;
    }
    return calculatedCbm;
  }, [calculatedCbm, directCbm, shippingType]);
  
  const volumetricWeight = useMemo(() => {
    if (lengthCm && widthCm && heightCm) {
      const divisor = parseFloat(volumetricDivisor) || 6000;
      return (parseFloat(lengthCm) * parseFloat(widthCm) * parseFloat(heightCm)) / divisor;
    }
    return 0;
  }, [lengthCm, widthCm, heightCm, volumetricDivisor]);
  
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

        await uploadMutation.mutateAsync({
          fileName: file.name.replace(/\.[^.]+$/, '.jpg'),
          contentType: type,
          base64Data: base64,
        });

        toast.success(t("quickRegister.uploadSuccess", { name: file.name }));
      } catch (error) {
        toast.error(t("quickRegister.uploadError", { name: file.name }));
      }
    }
    
    setIsUploading(false);
    e.target.value = '';
  };
  
  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };
  
  const estimatedPrice = useMemo(() => {
    const selectedBatch = batches?.find((b: any) => b.id === parseInt(batchId));
    if (!selectedBatch) return 0;
    
    if ((shippingType === "air_regular" || shippingType === "air_irregular") && selectedBatch.pricePerKg && chargeableWeight > 0) {
      return parseFloat(selectedBatch.pricePerKg) * chargeableWeight;
    } else if (shippingType === "sea" && selectedBatch.pricePerCbm && cbm > 0) {
      return parseFloat(selectedBatch.pricePerCbm) * cbm;
    }
    return 0;
  }, [batches, batchId, shippingType, chargeableWeight, cbm]);
  
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
    setTrackingNumber(value);
    setFoundOrder(null);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      setSearchTimeout(null);
    }
  };
  
  const selectCustomer = (customer: any) => {
    setCustomerId(customer.id);
    setCustomerSearch(customer.customerCode || customer.fullName || "");
    setShowCustomerDropdown(false);
    setIsUnclaimed(false);
    setHighlightedCustomerIndex(-1);
  };
  
  const toggleUnclaimed = () => {
    setIsUnclaimed(!isUnclaimed);
    if (!isUnclaimed) {
      setCustomerId(null);
      setCustomerSearch("");
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
  const [lastRegistered, setLastRegistered] = useState<{ packageCode: string; trackingNumber: string; customerName: string; time: Date; enteredBy?: string; orderDate?: Date | null } | null>(null);
  
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
      });

      toast.success(
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <div className="font-bold text-lg">{t("quickRegister.packageRegistered")}</div>
            <div className="text-base font-mono text-muted-foreground">{data.packageCode}</div>
          </div>
        </div>
      );
      
      resetForm();
      
      // Invalidate stats to update today's count
      trpcUtils.packages.stats.invalidate();
      
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
          <AlertTriangle className="h-5 w-5 text-red-500" />
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
      volumeCbm: shippingType === "sea" && directCbm ? directCbm : undefined,
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
        return { label: t("quickRegister.unknown"), color: "bg-gray-100 text-gray-800", icon: "❓" };
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
          {/* Top Bar with Title and Stats */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-5 shadow-xl ring-1 ring-white/10 text-white">
            <div className="pointer-events-none absolute -end-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/10 to-transparent" />
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              {/* Title Section */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/25 text-white shadow-lg flex items-center justify-center">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">{t("quickRegister.title")}</h1>
                  <p className="text-white/85 text-sm">{t("quickRegister.shortcutsHint")}</p>
                </div>
              </div>

              {/* Today's Counter */}
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/25 px-4 py-2 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-white/80">{t("quickRegister.todayRegistered")}</div>
                    <div className="text-2xl font-bold text-white">{packageStats?.todayCount || 0}</div>
                  </div>
                </div>

                {/* Clear All Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearAllForm}
                  className="h-12 px-4 bg-white/15 text-white border-white/25 hover:bg-white/25 hover:text-white backdrop-blur"
                >
                  <RotateCcw className="h-5 w-5 ms-2" />
                  {t("quickRegister.clear")}
                </Button>
              </div>
            </div>

            {/* Last Registered Package — richer, wraps cleanly, never overflows */}
            {lastRegistered && (
              <div className="mt-3 rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> {t("quickRegister.lastRegistered")}
                  </span>
                  <span className="font-mono font-bold text-foreground">{lastRegistered.packageCode}</span>
                  {lastRegistered.trackingNumber && (
                    <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                      <PackageSearch className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-mono truncate max-w-[14rem]" title={lastRegistered.trackingNumber}>{lastRegistered.trackingNumber}</span>
                    </span>
                  )}
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
                    {lastRegistered.time.toLocaleString()}
                  </span>
                  {lastRegistered.orderDate && (
                    <>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {pickLang(language, { ku: "بەرواری ئۆردەر", en: "Order date", ar: "تاريخ الطلب", zh: "订单日期" })}: {lastRegistered.orderDate.toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                        {pickLang(language, { ku: "ماوەی گەیشتن", en: "Transit", ar: "مدة الوصول", zh: "运达" })}: {Math.max(0, Math.round((lastRegistered.time.getTime() - lastRegistered.orderDate.getTime()) / 86400000))} {pickLang(language, { ku: "ڕۆژ", en: "days", ar: "يوم", zh: "天" })}
                      </span>
                    </>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
            {/* Fields column */}
            <div className="lg:col-span-2 space-y-3">

              {/* Tracking + Customer + Warehouse + Shipping + Weight —
                  two per row so each field is a comfortable, wide rectangle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch [&>*]:h-full">
                {/* Tracking Number — spans the full row so the field is a
                    wide, comfortable rectangle (it's the primary input) */}
                <Card className="md:col-span-2 border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center">
                        <PackageSearch className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{t("quickRegister.stepTracking")}</span>
                      {isSearching && <Loader2 className="h-4 w-4 animate-spin text-amber-500" />}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        ref={trackingRef}
                        placeholder={t("quickRegister.trackingPlaceholder")}
                        value={trackingNumber}
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
                            if (searchTimeout) {
                              clearTimeout(searchTimeout);
                              setSearchTimeout(null);
                            }
                            handleTrackingSearch();
                          }
                        }}
                        className="font-mono text-base h-12 flex-1"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="lg"
                        onClick={handleTrackingSearch}
                        disabled={trackingNumber.trim().length < 1 || isSearching}
                        className="h-12 px-4 bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                      </Button>
                    </div>
                    {/* Tracking Info Display */}
                    {foundOrder?.found && (
                      <div className={cn(
                        "mt-3 p-3 rounded-lg text-sm",
                        foundOrder.source === "package"
                          ? "bg-yellow-50 border border-yellow-200"
                          : "bg-green-50 border border-green-200"
                      )}>
                        <div className="flex items-center gap-2">
                          {foundOrder.source === "package" ? (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          <span className={cn(
                            "font-bold",
                            foundOrder.source === "package" ? "text-yellow-700" : "text-green-700"
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
                      <div className="mt-3 p-3 rounded-lg border-2 border-rose-300 bg-rose-50 dark:bg-rose-950/30">
                        <div className="flex items-start gap-2 text-rose-900 dark:text-rose-200">
                          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold">{t("quickRegister.sharedTrackingDifferentCustomer")}</div>
                            <div className="text-xs opacity-90">{t("quickRegister.submitDisabledFixInAlerts")}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {expandedLookup?.case === 'shared' && !expandedLookup.flags?.customerMismatch && (
                      <div className="mt-3 p-3 rounded-lg border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/30">
                        <div className="flex items-center gap-2 text-orange-900 dark:text-orange-200 mb-2">
                          <span>🔗</span>
                          <span className="font-bold">{t("quickRegister.sharedTrackingOrders", { count: expandedLookup.orders.length })}</span>
                        </div>
                        <div className="space-y-1 mb-2">
                          {expandedLookup.orders.map((od) => (
                            <div key={od.order.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-white/70 dark:bg-black/30 border border-orange-200/60 dark:border-orange-800/40">
                              <span className="font-mono font-medium">{od.order.orderCode}</span>
                              <span className="truncate">{od.order.productName}</span>
                              {od.order.quantity > 1 && <span className="text-muted-foreground">×{od.order.quantity}</span>}
                              <span className="text-primary ms-auto font-medium">{od.customer?.customerCode ?? '?'}</span>
                              {od.batch && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">
                                  {od.batch.batchCode}
                                </span>
                              )}
                            </div>
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
                      <div className="mt-3 p-3 rounded-lg border-2 border-blue-300 bg-blue-50 dark:bg-blue-950/30">
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
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">{t("quickRegister.cartonNow")}</span>
                                  ) : reg ? (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">✅ {reg.packageCode}</span>
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

                {/* Customer Selection */}
                <Card className="border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
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
                          disabled={isUnclaimed || (foundOrder?.customer != null)}
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
                      <Button
                        type="button"
                        size="lg"
                        variant={isUnclaimed ? "default" : "outline"}
                        onClick={toggleUnclaimed}
                        disabled={foundOrder?.customer != null}
                        className={cn("h-12 px-3", isUnclaimed && "bg-amber-500 hover:bg-amber-600 text-white border-amber-500")}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    </div>
                    {(customerId || isUnclaimed) && (() => {
                      const lockedByOrder = foundOrder?.customer != null
                        && (foundOrder.source === 'full_package' || foundOrder.source === 'commission');
                      return (
                        <div className={cn("mt-3 p-2 rounded-lg text-sm flex items-center gap-2",
                          isUnclaimed ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-green-50 text-green-700 border border-green-200"
                        )}>
                          {isUnclaimed ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          <span className="font-bold">{isUnclaimed ? t("quickRegister.unclaimed") : customers?.find(c => c.id === customerId)?.customerCode}</span>
                          {lockedByOrder && (
                            <span className="ms-auto text-[11px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">
                              🔒 {t("quickRegister.locked")}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Weight — the primary numeric field. Warehouse & Shipping
                    moved out of the center to the compact side panel. */}
                <Card className="border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center">
                        <Scale className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{t("quickRegister.stepWeight")}</span>
                    </div>
                    <Input
                      ref={weightRef}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="h-14 text-2xl font-mono font-bold text-center"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Row 2.5: Dimensions - Only for Air shipping */}
              {(shippingType === "air_regular" || shippingType === "air_irregular") && (
                <Card className="border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 flex items-center justify-center">
                        <Ruler className="h-5 w-5" />
                      </div>
                      <span className="text-base font-bold text-violet-700 dark:text-violet-400">{t("quickRegister.stepDimensions")}</span>
                      <span className="text-xs text-muted-foreground me-2">{t("quickRegister.forVolumetricWeight")}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-violet-700 dark:text-violet-400">{t("quickRegister.length")}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={lengthCm}
                          onChange={(e) => setLengthCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-violet-700 dark:text-violet-400">{t("quickRegister.width")}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={widthCm}
                          onChange={(e) => setWidthCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-violet-700 dark:text-violet-400">{t("quickRegister.height")}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={heightCm}
                          onChange={(e) => setHeightCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center"
                        />
                      </div>
                    </div>
                    {/* Volumetric Weight Result */}
                    {volumetricWeight > 0 && (
                      <div className="mt-4 p-4 bg-violet-50 dark:bg-violet-950/30 rounded-xl border border-violet-200 dark:border-violet-900/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Calculator className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            <div>
                              <span className="text-sm text-violet-700 dark:text-violet-300">{t("quickRegister.volumetricWeight")}: </span>
                              <span className="font-bold text-violet-900 dark:text-violet-200">{volumetricWeight.toFixed(2)} kg</span>
                              <span className="text-xs text-muted-foreground me-2">(÷ {volumetricDivisor})</span>
                            </div>
                          </div>
                          <div className="p-3 bg-card rounded-lg shadow-sm border">
                            <span className="font-bold text-xl text-violet-800 dark:text-violet-300">{chargeableWeight.toFixed(2)} kg</span>
                            <span className="text-xs text-muted-foreground block">{t("quickRegister.chargeableWeight")}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Sea shipping - CBM input */}
              {shippingType === "sea" && (
                <Card className="border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 flex items-center justify-center">
                        <Ship className="h-5 w-5" />
                      </div>
                      <span className="text-base font-bold text-cyan-700 dark:text-cyan-400">{t("quickRegister.stepDimensionsSea")}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">{t("quickRegister.length")}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={lengthCm}
                          onChange={(e) => setLengthCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">{t("quickRegister.width")}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={widthCm}
                          onChange={(e) => setWidthCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">{t("quickRegister.height")}</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={heightCm}
                          onChange={(e) => setHeightCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">{t("quickRegister.orCbm")}</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="0.0000"
                          value={directCbm}
                          onChange={(e) => setDirectCbm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center"
                        />
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

              {/* Row 3: Optional Fields */}
              <Card className="border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <button
                    type="button"
                    onClick={() => setShowOptional(!showOptional)}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                        <Tags className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold">{t("quickRegister.additionalInfo")}</span>
                      <span className="text-xs text-muted-foreground">{t("quickRegister.optional")}</span>
                    </div>
                    <ChevronDown className={cn("h-5 w-5 transition-transform", showOptional && "rotate-180")} />
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
                      <div className="md:col-span-3 space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          {t("quickRegister.photos")}
                        </Label>
                        <div className="flex flex-wrap gap-3">
                          {photos.map((photo, index) => (
                            <div key={index} className="relative group">
                              <img src={photo} alt="" className="w-16 h-16 object-cover rounded-lg border shadow-sm" />
                              <button
                                type="button"
                                onClick={() => removePhoto(index)}
                                className="absolute -top-2 -end-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <label className="w-16 h-16 border border-dashed border-muted-foreground/40 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleImageUpload}
                              className="hidden"
                              disabled={isUploading}
                            />
                            {isUploading ? (
                              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            ) : (
                              <ImagePlus className="h-6 w-6 text-gray-400" />
                            )}
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Side panel: compact Warehouse + Shipping + Batch selectors
                (moved out of the center) followed by the sticky Summary */}
            <div className="lg:col-span-1 space-y-3">
              <Card className="border bg-card rounded-2xl shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Warehouse */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <Warehouse className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{pickLang(language, { ku: "کۆگا", en: "Warehouse", ar: "المستودع", zh: "仓库" })}</span>
                        {selectedWarehouse && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ms-auto shrink-0" />}
                      </div>
                      <Select
                        value={originWarehouseId != null ? String(originWarehouseId) : ""}
                        onValueChange={(v) => setOriginWarehouseId(v ? parseInt(v, 10) : null)}
                        disabled={!warehouses?.length}
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
                      <Select value={shippingType} onValueChange={(v) => { setShippingType(v as any); setBatchId(""); }}>
                        <SelectTrigger className="h-9 text-xs min-w-0 [&>span]:truncate [&>span]:block [&>span]:text-start">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="air_regular">
                            <div className="flex items-center gap-2">
                              <Plane className="h-4 w-4 text-blue-500" />
                              <span>{t("quickRegister.airRegular")}</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="air_irregular">
                            <div className="flex items-center gap-2">
                              <Plane className="h-4 w-4 text-purple-500" />
                              <span>{t("quickRegister.airIrregular")}</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="sea">
                            <div className="flex items-center gap-2">
                              <Ship className="h-4 w-4 text-cyan-500" />
                              <span>{t("quickRegister.sea")}</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Batch */}
                  <Select
                    value={batchId}
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

              <Card className="lg:sticky lg:top-4 border bg-card rounded-2xl shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Clipboard className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-lg">{t("quickRegister.summary")}</span>
                  </div>

                  {/* Info tiles stack in the narrow sidebar (2-up on mid widths) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 text-sm">
                    {trackingNumber.trim() && (
                      <div className="flex flex-col gap-1 py-2.5 px-3 bg-muted/50 rounded-xl min-w-0">
                        <span className="text-xs text-muted-foreground">{pickLang(language, { ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "追踪号" })}</span>
                        <span className="font-mono font-medium truncate" title={trackingNumber}>{trackingNumber}</span>
                      </div>
                    )}

                    {/* Consolidated order card — one compact block (image +
                        identity + timing + who entered it + carton progress) so
                        all order info fits on-screen with minimal scrolling.
                        Shown only once a linked full-package / commission order
                        is found. Display-only. */}
                    {foundOrder?.found && foundOrder.order && (
                      <div className="col-span-full flex flex-col gap-2 py-3 px-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900/50 min-w-0">
                        {/* Top: thumbnail + type badge + order code + product */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {(foundOrder.order.productImage || foundOrder.order.productImages?.[0]) && (
                            <img
                              src={foundOrder.order.productImage || foundOrder.order.productImages[0]}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover border border-indigo-200 dark:border-indigo-800 shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                                {foundOrder.order.orderType === "commission"
                                  ? pickLang(language, { ku: "کڕین بە تێچوو", en: "Commission", ar: "شراء بعمولة", zh: "代购" })
                                  : foundOrder.order.orderType === "purchase_request"
                                  ? pickLang(language, { ku: "داواکاری کڕین", en: "Purchase request", ar: "طلب شراء", zh: "采购请求" })
                                  : pickLang(language, { ku: "فوول پاکەج", en: "Full package", ar: "طرد كامل", zh: "整包" })}
                              </span>
                              {foundOrder.order.orderCode && (
                                <span className="text-xs font-mono font-semibold text-indigo-900 dark:text-indigo-300 truncate" dir="ltr">{foundOrder.order.orderCode}</span>
                              )}
                            </div>
                            {foundOrder.order.productName && (
                              <p className="text-xs text-indigo-800 dark:text-indigo-300 truncate mt-0.5" title={String(foundOrder.order.productName)}>{foundOrder.order.productName}</p>
                            )}
                          </div>
                        </div>

                        {/* Middle: compact 2-column facts */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                          {foundOrder.order.orderNumber && (
                            <div className="flex justify-between gap-1 min-w-0">
                              <span className="text-indigo-500 dark:text-indigo-400 shrink-0">{pickLang(language, { ku: "ئۆردەر نەمبەر", en: "Order #", ar: "رقم الطلب", zh: "订单号" })}</span>
                              <span className="font-mono font-medium text-indigo-900 dark:text-indigo-300 truncate" dir="ltr" title={String(foundOrder.order.orderNumber)}>{foundOrder.order.orderNumber}</span>
                            </div>
                          )}
                          {foundOrder.order.createdAt && (
                            <div className="flex justify-between gap-1 min-w-0">
                              <span className="text-indigo-500 dark:text-indigo-400 shrink-0">{pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</span>
                              <span className="font-medium text-indigo-900 dark:text-indigo-300 truncate">{new Date(foundOrder.order.createdAt).toLocaleDateString("en-GB")}</span>
                            </div>
                          )}
                          {foundOrder.order.createdAt && (
                            <div className="flex justify-between gap-1 min-w-0">
                              <span className="text-indigo-500 dark:text-indigo-400 shrink-0">{pickLang(language, { ku: "ماوەی گەیشتن", en: "Waiting", ar: "مدة الانتظار", zh: "等待" })}</span>
                              <span className="font-mono font-semibold text-indigo-900 dark:text-indigo-300">{Math.max(0, Math.round((Date.now() - new Date(foundOrder.order.createdAt).getTime()) / 86400000))} {pickLang(language, { ku: "ڕۆژ", en: "d", ar: "ي", zh: "天" })}</span>
                            </div>
                          )}
                          {foundOrder.createdByName && (
                            <div className="flex justify-between gap-1 min-w-0">
                              <span className="text-indigo-500 dark:text-indigo-400 shrink-0">{pickLang(language, { ku: "تۆمارکەر", en: "By", ar: "بواسطة", zh: "录入" })}</span>
                              <span className="font-medium text-indigo-900 dark:text-indigo-300 truncate" title={foundOrder.createdByName}>{foundOrder.createdByName}</span>
                            </div>
                          )}
                        </div>

                        {/* Bottom: carton registration progress — how many of
                            this order's cartons are registered vs. remaining. */}
                        {expandedLookup?.flags?.cartonsTotal != null && expandedLookup.flags.cartonsTotal > 0 && (() => {
                          const total = expandedLookup.flags.cartonsTotal;
                          const done = expandedLookup.flags.cartonsRegistered ?? 0;
                          const remaining = Math.max(0, total - done);
                          const pct = Math.min(100, Math.round((done / total) * 100));
                          return (
                            <div className="flex flex-col gap-1 pt-1.5 border-t border-indigo-200 dark:border-indigo-900/50">
                              <div className="flex items-baseline justify-between gap-1.5 text-[11px]">
                                <span className="text-indigo-600 dark:text-indigo-400">{pickLang(language, { ku: "پاکەتە تۆمارکراوەکان", en: "Registered cartons", ar: "الطرود المسجلة", zh: "已登记箱数" })}</span>
                                <span>
                                  <span className="font-mono font-bold text-sm text-indigo-800 dark:text-indigo-300">{done}</span>
                                  <span className="font-mono text-indigo-500">/{total}</span>
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-indigo-200 dark:bg-indigo-900/60 overflow-hidden">
                                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                {pickLang(language, { ku: "ماوە بۆ تۆمارکردن", en: "Remaining to register", ar: "المتبقي للتسجيل", zh: "待登记" })}: {remaining}
                              </span>
                            </div>
                          );
                        })()}
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
                      </div>
                    )}
                  </div>

                  {/* Submit Button - Below Summary */}
                  <Button
                    type="submit"
                    size="lg"
                    className={cn(
                      "w-full h-14 text-lg font-bold shadow-sm mt-5 transition-all",
                      !trackingNumber.trim() || foundOrder?.source === "package" || expandedLookup?.flags?.customerMismatch
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                    disabled={registerMutation.isPending || !trackingNumber.trim() || foundOrder?.source === "package" || expandedLookup?.flags?.customerMismatch === true}
                  >
                    {registerMutation.isPending ? (
                      <Loader2 className="h-6 w-6 animate-spin ms-2" />
                    ) : foundOrder?.source === "package" ? (
                      <AlertTriangle className="h-6 w-6 ms-2 text-yellow-600" />
                    ) : expandedLookup?.flags?.customerMismatch ? (
                      <AlertTriangle className="h-6 w-6 ms-2 text-rose-600" />
                    ) : (
                      <Plus className="h-6 w-6 ms-2" />
                    )}
                    {foundOrder?.source === "package"
                      ? t("quickRegister.btnDuplicate")
                      : expandedLookup?.flags?.customerMismatch
                        ? t("quickRegister.btnCustomerIssue")
                        : !trackingNumber.trim()
                          ? t("quickRegister.btnEnterTracking")
                          : t("quickRegister.btnRegister")}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground mt-3">
                    {t("quickRegister.footerHint")}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
