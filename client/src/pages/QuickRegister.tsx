import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Package, Plane, Ship, Search, User, Loader2, CheckCircle2, Plus, Calculator, Zap, AlertTriangle, Tags, ChevronDown, ImagePlus, X, Camera, PackageSearch, Clipboard, Scale, Ruler, Info, RotateCcw, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";

// Sound functions for different states
const playSound = (frequency: number, duration: number = 0.2, type: OscillatorType = 'sine') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (e) {
    console.log('Audio not supported');
  }
};

// Success beep - high pitched pleasant sound
const playSuccessBeep = () => playSound(880, 0.15, 'sine');

// Found tracking beep - double beep
const playFoundBeep = () => {
  playSound(660, 0.1, 'sine');
  setTimeout(() => playSound(880, 0.15, 'sine'), 120);
};

// Not found beep - lower tone
const playNotFoundBeep = () => playSound(330, 0.25, 'triangle');

// Error beep - warning sound
const playErrorBeep = () => playSound(220, 0.3, 'sawtooth');

// Duplicate warning beep - triple short beeps
const playDuplicateBeep = () => {
  playSound(440, 0.08, 'square');
  setTimeout(() => playSound(440, 0.08, 'square'), 100);
  setTimeout(() => playSound(440, 0.08, 'square'), 200);
};

export default function QuickRegister() {
  const { t } = useTranslation();
  
  // Tracking search state
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundOrder, setFoundOrder] = useState<{
    found: boolean;
    source: "full_package" | "commission" | "purchase_request" | "package" | null;
    order: any;
    customer: any;
    package: any;
  } | null>(null);
  
  // Form state
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [shippingType, setShippingType] = useState<"air_regular" | "air_irregular" | "sea">("air_regular");
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [batchId, setBatchId] = useState<string>("");
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
  
  // Queries
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: batches } = trpc.batches.list.useQuery();
  const { data: warehouses } = trpc.warehouses.list.useQuery();
  const { data: categories } = trpc.productCategories.list.useQuery();
  const { data: packageStats } = trpc.packages.stats.useQuery();
  
  // Search tracking - use trpc client directly for manual search
  const trpcUtils = trpc.useUtils();
  
  // Handle search - use ref to get latest tracking number
  const handleTrackingSearch = async () => {
    const currentTracking = trackingRef.current?.value || trackingNumber;
    if (currentTracking.trim().length < 1) return;
    
    setIsSearching(true);
    try {
      const result = await trpcUtils.scanning.searchTrackingAllTypes.fetch({ 
        trackingNumber: currentTracking.trim() 
      });
      if (result) {
        setFoundOrder(result);
        if (result.found) {
          // Only update customer info - preserve weight, dimensions, etc.
          if (result.customer) {
            setCustomerId(result.customer.id);
            setCustomerSearch(result.customer.customerCode || result.customer.fullName || "");
            setIsUnclaimed(false);
          }
          const sourceLabels: Record<string, string> = {
            full_package: "فول پاکێج",

            commission: "کڕین بە عموڵە",
            package: "پاکەت (پێشتر تۆمار کراوە)"
          };
          
          // Show warning for already registered packages - play duplicate sound
          if (result.source === "package") {
            playDuplicateBeep();
            toast.warning(
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="font-medium">ئەم تراکینگە پێشتر تۆمار کراوە!</div>
                  <div className="text-sm text-muted-foreground">
                    کڕیار: {result.customer?.customerCode || "نەناسراو"}
                  </div>
                </div>
              </div>
            );
          } else {
            // Found in order - play success sound
            playFoundBeep();
            toast.success(
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <div className="font-medium">تراکینگ دۆزرایەوە!</div>
                  <div className="text-sm text-muted-foreground">
                    {sourceLabels[result.source || ""] || "نەناسراو"}
                  </div>
                </div>
              </div>
            );
          }
          // Auto-focus weight input after tracking is found
          setTimeout(() => {
            weightRef.current?.focus();
            weightRef.current?.select();
          }, 100);
        } else {
          // Not found - play not found sound
          playNotFoundBeep();
          toast.info("تراکینگ نەدۆزرایەوە - دەتوانیت بەردەوام بیت");
          // Auto-focus weight even if not found - user can still register
          setTimeout(() => {
            weightRef.current?.focus();
            weightRef.current?.select();
          }, 100);
        }
      }
    } catch (error: any) {
      console.error("Search error:", error);
      playErrorBeep();
      if (error?.message?.includes("UNAUTHORIZED")) {
        toast.error("تکایە چوونەژوورەوە بکەرەوە");
      } else {
        toast.error("هەڵە لە گەڕاندا");
      }
    } finally {
      setIsSearching(false);
    }
  };
  
  const defaultWarehouse = warehouses?.[0];
  
  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    return batches.filter(b => {
      const batchType = b.shippingType as string;
      if (shippingType === "air_regular" || shippingType === "air_irregular") {
        return batchType === "air" || batchType.startsWith("air");
      }
      return batchType === "sea";
    }).filter(b => b.status === "preparing" || b.status === "in_transit");
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
          toast.error(`فایلی ${file.name} زۆر گەورەیە (max 10MB)`);
          continue;
        }
        
        toast.info(`کۆمپرێسی ${file.name}...`);
        const { base64, type } = await compressImage(file);
        
        await uploadMutation.mutateAsync({
          fileName: file.name.replace(/\.[^.]+$/, '.jpg'),
          contentType: type,
          base64Data: base64,
        });
        
        toast.success(`${file.name} بۆ سەرکەوتی ئەپڵۆدکرا`);
      } catch (error) {
        toast.error(`هەڵە لە ئەپڵۆدکردنی ${file.name}`);
      }
    }
    
    setIsUploading(false);
    e.target.value = '';
  };
  
  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };
  
  const estimatedPrice = useMemo(() => {
    const selectedBatch = batches?.find(b => b.id === parseInt(batchId));
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
  
  // Auto-search when tracking number changes
  const handleTrackingChange = (value: string) => {
    setTrackingNumber(value);
    setFoundOrder(null);
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Debounce search to allow user time to type (300ms delay)
    if (value.trim().length >= 1) {
      // Use 300ms timeout to give user time to finish typing
      const timeout = setTimeout(() => {
        handleTrackingSearch();
      }, 300);
      setSearchTimeout(timeout);
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
  const [lastRegistered, setLastRegistered] = useState<{ packageCode: string; trackingNumber: string; customerName: string; time: Date } | null>(null);
  
  const registerMutation = trpc.packages.register.useMutation({
    onSuccess: (data) => {
      // Play success beep sound
      playSuccessBeep();
      
      // Save last registered package info
      setLastRegistered({
        packageCode: data.packageCode,
        trackingNumber: trackingNumber,
        customerName: customerSearch || 'بێ خاوەن',
        time: new Date()
      });
      
      toast.success(
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <div className="font-bold text-lg">پاکەت تۆمارکرا!</div>
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
      toast.error(`هەڵە: ${error.message}`);
    },
  });
  
  const resetForm = () => {
    // Clear only tracking, weight, dimensions - keep customer, batch, shipping type sticky
    setTrackingNumber("");
    setFoundOrder(null);
    // Keep customerId, customerSearch, isUnclaimed sticky
    setWeightKg("");
    setLengthCm("");
    setWidthCm("");
    setHeightCm("");
    // Keep batchId sticky
    // Keep shippingType sticky
    setCategoryId("");
    setDescription("");
    setDirectCbm("");
    setPhotos([]);
    trackingRef.current?.focus();
  };
  
  // Clear ALL form fields including sticky ones
  const clearAllForm = () => {
    setTrackingNumber("");
    setFoundOrder(null);
    setCustomerId(null);
    setCustomerSearch("");
    setIsUnclaimed(false);
    setWeightKg("");
    setLengthCm("");
    setWidthCm("");
    setHeightCm("");
    setBatchId("");
    setShippingType("air_regular");
    setCategoryId("");
    setDescription("");
    setDirectCbm("");
    setPhotos([]);
    setHighlightedCustomerIndex(-1);
    trackingRef.current?.focus();
    toast.info("فۆرم پاککرایەوە");
  };
  
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Require tracking number - cannot register without it
    if (!trackingNumber.trim()) {
      playErrorBeep();
      toast.error("تکایە تراکینگ نەمبەر داخل بکە");
      trackingRef.current?.focus();
      return;
    }
    
    // Prevent duplicate registration - if tracking already exists as package
    if (foundOrder?.source === "package") {
      playDuplicateBeep();
      toast.error(
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <div>
            <div className="font-medium">ئەم تراکینگە پێشتر تۆمار کراوە!</div>
            <div className="text-sm">ناتوانرێت دووبارە تۆماری بکەیت</div>
          </div>
        </div>
      );
      return;
    }
    
    if (!customerId && !isUnclaimed) {
      playErrorBeep();
      toast.error("تکایە کڕیارێک هەڵبژێرە یان بێ خاوەن دیاری بکە");
      return;
    }
    
    if (!defaultWarehouse) {
      playErrorBeep();
      toast.error("هیچ کۆگایەک نەدۆزرایەوە");
      return;
    }
    
    const packageData: any = {
      customerId: isUnclaimed ? undefined : customerId!,
      isUnclaimed: isUnclaimed,
      originWarehouseId: defaultWarehouse.id,
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
    
    if (foundOrder?.found && foundOrder.order) {
      if (foundOrder.source === "full_package") {
        packageData.fullPackageOrderId = foundOrder.order.id;
      }
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
        return { label: "فول پاکێج", color: "bg-gradient-to-r from-purple-500 to-purple-600 text-white", icon: "📦" };

      case "commission":
        return { label: "کڕین بە عمولە", color: "bg-gradient-to-r from-green-500 to-green-600 text-white", icon: "💰" };
      case "package":
        return { label: "پاکەت", color: "bg-gradient-to-r from-gray-500 to-gray-600 text-white", icon: "📦" };
      default:
        return { label: "نەناسراو", color: "bg-gray-100 text-gray-800", icon: "❓" };
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-2" onKeyDown={handleKeyDown}>
        {/* Professional Header with Stats */}
        <div className="mb-6">
          {/* Top Bar with Title and Stats */}
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-4">
              {/* Title Section */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">تۆماری خێرا</h1>
                  <p className="text-white/80 text-sm">Enter بۆ تۆمار | Tab بۆ گواستنەوە | Esc بۆ پاککردنەوە | ↑↓ بۆ لیست</p>
                </div>
              </div>
              
              {/* Today's Counter */}
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur rounded-xl px-5 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-white">
                    <div className="text-xs opacity-80">ئەمڕۆ تۆمارکراو</div>
                    <div className="text-3xl font-bold">{packageStats?.todayCount || 0}</div>
                  </div>
                </div>
                
                {/* Clear All Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearAllForm}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-14 px-4"
                >
                  <RotateCcw className="h-5 w-5 ml-2" />
                  پاککردنەوە
                </Button>
              </div>
            </div>
            
            {/* Last Registered Package */}
            {lastRegistered && (
              <div className="mt-4 bg-white/20 backdrop-blur rounded-xl px-4 py-3 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-white" />
                <div className="text-white">
                  <span className="font-bold">دوایین تۆمار: </span>
                  <span className="font-mono">{lastRegistered.packageCode}</span>
                  <span className="mx-2">•</span>
                  <span className="opacity-80">{lastRegistered.trackingNumber}</span>
                  <span className="mx-2">•</span>
                  <span className="opacity-80">{lastRegistered.customerName}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Main Form - 3 columns */}
            <div className="lg:col-span-3 space-y-4">
              
              {/* Row 1: Tracking + Customer + Shipping Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tracking Number */}
                <Card className="border-2 border-amber-200 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-amber-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <PackageSearch className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-amber-800">١. تراکینگ</span>
                      {isSearching && <Loader2 className="h-4 w-4 animate-spin text-amber-500" />}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        ref={trackingRef}
                        placeholder="تراکینگ نەمبەر..."
                        value={trackingNumber}
                        onChange={(e) => handleTrackingChange(e.target.value)}
                        className="font-mono text-base h-12 flex-1 border-2 border-amber-200 focus:border-amber-400"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="lg"
                        onClick={handleTrackingSearch}
                        disabled={trackingNumber.trim().length < 1 || isSearching}
                        className="h-12 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
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
                            کڕیار: <span className="font-bold text-primary">{foundOrder.customer.customerCode}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Customer Selection */}
                <Card className="border-2 border-blue-200 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-blue-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-blue-800">٢. کڕیار</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          ref={customerInputRef}
                          placeholder="گەڕان بە کۆد یان ناو..."
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value);
                            setShowCustomerDropdown(true);
                            if (e.target.value === "") setCustomerId(null);
                          }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          onKeyDown={handleCustomerKeyDown}
                          disabled={isUnclaimed || (foundOrder?.customer != null)}
                          className="text-base h-12 border-2 border-blue-200 focus:border-blue-400"
                        />
                        {showCustomerDropdown && filteredCustomers.length > 0 && !isUnclaimed && !foundOrder?.customer && (
                          <div className="absolute z-50 w-full mt-1 bg-popover border-2 border-blue-200 rounded-xl shadow-2xl max-h-48 overflow-auto">
                            {filteredCustomers.map((customer, index) => (
                              <button
                                key={customer.id}
                                type="button"
                                className={cn(
                                  "w-full px-4 py-3 text-sm text-left transition-colors",
                                  index === highlightedCustomerIndex 
                                    ? "bg-blue-100 text-blue-900" 
                                    : "hover:bg-blue-50"
                                )}
                                onClick={() => selectCustomer(customer)}
                                onMouseEnter={() => setHighlightedCustomerIndex(index)}
                              >
                                <span className="font-bold text-blue-600">{customer.customerCode}</span>
                                <span className="text-muted-foreground mr-2">- {customer.fullName}</span>
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
                        className={cn("h-12 px-3 border-2", isUnclaimed && "bg-amber-500 hover:bg-amber-600 border-amber-500")}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    </div>
                    {(customerId || isUnclaimed) && (
                      <div className={cn("mt-3 p-2 rounded-lg text-sm flex items-center gap-2", 
                        isUnclaimed ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-green-50 text-green-700 border border-green-200"
                      )}>
                        {isUnclaimed ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        <span className="font-bold">{isUnclaimed ? "بێ خاوەن" : customers?.find(c => c.id === customerId)?.customerCode}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Shipping Type - Dropdown */}
                <Card className="border-2 border-indigo-200 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-indigo-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                        <Package className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-indigo-800">٣. گواستنەوە</span>
                    </div>
                    <Select value={shippingType} onValueChange={(v) => { setShippingType(v as any); setBatchId(""); }}>
                      <SelectTrigger className="h-12 text-base border-2 border-indigo-200 focus:border-indigo-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="air_regular">
                          <div className="flex items-center gap-2">
                            <Plane className="h-4 w-4 text-blue-500" />
                            <span>ئاسمانی یاسایی</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="air_irregular">
                          <div className="flex items-center gap-2">
                            <Plane className="h-4 w-4 text-purple-500" />
                            <span>ئاسمانی نایاسایی</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="sea">
                          <div className="flex items-center gap-2">
                            <Ship className="h-4 w-4 text-cyan-500" />
                            <span>دەریایی</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {/* Batch Selection */}
                    <div className="mt-3">
                      <Select value={batchId} onValueChange={setBatchId}>
                        <SelectTrigger className="h-10 text-sm border-2 border-indigo-200 focus:border-indigo-400">
                          <SelectValue placeholder="باچ هەڵبژێرە" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">بێ باچ</SelectItem>
                          {filteredBatches.map((batch) => (
                            <SelectItem key={batch.id} value={batch.id.toString()}>
                              {batch.batchCode} {batch.pricePerKg ? `- $${batch.pricePerKg}/kg` : batch.pricePerCbm ? `- $${batch.pricePerCbm}/cbm` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Row 2: Weight - Always visible */}
              <Card className="border-2 border-emerald-300 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-emerald-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-md">
                      <Scale className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-base font-bold text-emerald-800">٤. کێش (KG)</span>
                  </div>
                  <Input
                    ref={weightRef}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="h-16 text-3xl font-mono font-bold text-center border-3 border-emerald-300 focus:border-emerald-500 bg-white"
                  />
                </CardContent>
              </Card>

              {/* Row 2.5: Dimensions - Only for Air shipping */}
              {(shippingType === "air_regular" || shippingType === "air_irregular") && (
                <Card className="border-2 border-violet-200 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-violet-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-md">
                        <Ruler className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-base font-bold text-violet-800">٥. قەبارە (CM)</span>
                      <span className="text-xs text-violet-500 mr-2">بۆ کێشی قەبارەیی</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-violet-700">درێژی (cm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={lengthCm}
                          onChange={(e) => setLengthCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center border-2 border-violet-300 focus:border-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-violet-700">پانی (cm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={widthCm}
                          onChange={(e) => setWidthCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center border-2 border-violet-300 focus:border-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-violet-700">بەرزی (cm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={heightCm}
                          onChange={(e) => setHeightCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center border-2 border-violet-300 focus:border-violet-500"
                        />
                      </div>
                    </div>
                    {/* Volumetric Weight Result */}
                    {volumetricWeight > 0 && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-violet-100 to-purple-100 rounded-xl border border-violet-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Calculator className="h-5 w-5 text-violet-600" />
                            <div>
                              <span className="text-sm text-violet-700">کێشی قەبارەیی: </span>
                              <span className="font-bold text-violet-900">{volumetricWeight.toFixed(2)} kg</span>
                              <span className="text-xs text-violet-500 mr-2">(÷ {volumetricDivisor})</span>
                            </div>
                          </div>
                          <div className="p-3 bg-white rounded-lg shadow">
                            <span className="font-bold text-xl text-violet-800">{chargeableWeight.toFixed(2)} kg</span>
                            <span className="text-xs text-violet-500 block">کێشی کڕێیی</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Sea shipping - CBM input */}
              {shippingType === "sea" && (
                <Card className="border-2 border-cyan-200 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-white to-cyan-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-md">
                        <Ship className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-base font-bold text-cyan-800">٥. قەبارە (دەریایی)</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-cyan-700">درێژی (cm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={lengthCm}
                          onChange={(e) => setLengthCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center border-2 border-cyan-300 focus:border-cyan-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-cyan-700">پانی (cm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={widthCm}
                          onChange={(e) => setWidthCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center border-2 border-cyan-300 focus:border-cyan-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-cyan-700">بەرزی (cm)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={heightCm}
                          onChange={(e) => setHeightCm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center border-2 border-cyan-300 focus:border-cyan-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-cyan-700">یان CBM</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="0.0000"
                          value={directCbm}
                          onChange={(e) => setDirectCbm(e.target.value)}
                          className="h-14 text-xl font-mono font-bold text-center border-2 border-cyan-300 focus:border-cyan-500"
                        />
                      </div>
                    </div>
                    {/* CBM Result */}
                    <div className="mt-4 p-4 bg-gradient-to-r from-cyan-100 to-teal-100 rounded-xl border border-cyan-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Ship className="h-5 w-5 text-cyan-600" />
                          <span className="text-sm text-cyan-700">لە قەبارە: <strong>{calculatedCbm.toFixed(4)} m³</strong></span>
                        </div>
                        <div className="p-3 bg-white rounded-lg shadow">
                          <span className="font-bold text-xl text-cyan-800">{cbm.toFixed(4)} m³</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Row 3: Optional Fields */}
              <Card className="border shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-4">
                  <button
                    type="button"
                    onClick={() => setShowOptional(!showOptional)}
                    className="flex items-center justify-between w-full"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
                        <Tags className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-bold">زانیاری زیادە</span>
                      <span className="text-xs text-muted-foreground">(ئیختیاری)</span>
                    </div>
                    <ChevronDown className={cn("h-5 w-5 transition-transform", showOptional && "rotate-180")} />
                  </button>
                  
                  {showOptional && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">جۆری بەرهەم</Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="جۆر هەڵبژێرە" />
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
                        <Label className="text-sm font-semibold">تێبینی</Label>
                        <Input
                          placeholder="تێبینی..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="h-11"
                        />
                      </div>
                      <div className="md:col-span-3 space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          وێنە
                        </Label>
                        <div className="flex flex-wrap gap-3">
                          {photos.map((photo, index) => (
                            <div key={index} className="relative group">
                              <img src={photo} alt="" className="w-16 h-16 object-cover rounded-lg border-2 shadow" />
                              <button
                                type="button"
                                onClick={() => removePhoto(index)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
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

            {/* Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4 border-2 shadow-xl bg-gradient-to-br from-white to-gray-50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow">
                      <Clipboard className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-lg">کورتە</span>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                      <span className="text-muted-foreground">کڕیار</span>
                      <span className="font-bold text-primary">
                        {isUnclaimed ? "بێ خاوەن" : (customerId ? customers?.find(c => c.id === customerId)?.customerCode : "-")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                      <span className="text-muted-foreground">گواستنەوە</span>
                      <span className="font-medium">
                        {shippingType === "air_regular" ? "ئاسمانی" : shippingType === "air_irregular" ? "نایاسایی" : "دەریایی"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <span className="text-emerald-700">کێش</span>
                      <span className="font-mono font-bold text-emerald-800">{parseFloat(weightKg || "0").toFixed(2)} kg</span>
                    </div>
                    
                    {(shippingType === "air_regular" || shippingType === "air_irregular") && chargeableWeight > 0 && (
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-amber-700">کێشی کڕێیی</span>
                          <span className="font-mono font-bold text-amber-900">{chargeableWeight.toFixed(2)} kg</span>
                        </div>
                      </div>
                    )}
                    
                    {shippingType === "sea" && cbm > 0 && (
                      <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-cyan-700">CBM</span>
                          <span className="font-mono font-bold text-cyan-900">{cbm.toFixed(4)} m³</span>
                        </div>
                      </div>
                    )}
                    
                    {batchId && batchId !== "none" && (
                      <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-muted-foreground">باچ</span>
                        <span className="font-medium">{batches?.find(b => b.id === parseInt(batchId))?.batchCode}</span>
                      </div>
                    )}
                    
                    {estimatedPrice > 0 && (
                      <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl mt-3 border border-primary/20">
                        <div className="text-xs text-muted-foreground mb-1">نرخی تەخمینی</div>
                        <div className="text-3xl font-bold text-primary">${estimatedPrice.toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Submit Button - Below Summary */}
                  <Button
                    type="submit"
                    size="lg"
                    className={cn(
                      "w-full h-14 text-lg font-bold shadow-xl mt-5 transition-all",
                      !trackingNumber.trim() || foundOrder?.source === "package"
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-primary via-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    )}
                    disabled={registerMutation.isPending || !trackingNumber.trim() || foundOrder?.source === "package"}
                  >
                    {registerMutation.isPending ? (
                      <Loader2 className="h-6 w-6 animate-spin ml-2" />
                    ) : foundOrder?.source === "package" ? (
                      <AlertTriangle className="h-6 w-6 ml-2 text-yellow-600" />
                    ) : (
                      <Plus className="h-6 w-6 ml-2" />
                    )}
                    {foundOrder?.source === "package" ? "دووبارە!" : !trackingNumber.trim() ? "تراکینگ داخل بکە" : "تۆمار (Enter)"}                  
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    Enter بۆ تۆمارکردن • Esc بۆ پاککردنەوە
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
