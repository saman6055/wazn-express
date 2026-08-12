import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, 
  ArrowRight, 
  Package, 
  QrCode, 
  Users, 
  Boxes, 
  Check,
  Plane,
  Ship,
  AlertTriangle,
  Search,
  Camera,
  Plus,
  X,
  Calculator,
  DollarSign,
  Weight,
  Ruler,
  Image as ImageIcon
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
// Photo upload will be handled via S3 in production

// Step indicator component
function StepIndicator({ currentStep, totalSteps, steps }: { currentStep: number; totalSteps: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all
            ${index + 1 < currentStep 
              ? "bg-green-500 text-white" 
              : index + 1 === currentStep 
                ? "bg-primary text-primary-foreground ring-4 ring-primary/20" 
                : "bg-muted text-muted-foreground"
            }
          `}>
            {index + 1 < currentStep ? <Check className="h-4 w-4" /> : index + 1}
          </div>
          {index < totalSteps - 1 && (
            <div className={`w-12 h-1 mx-2 rounded ${index + 1 < currentStep ? "bg-green-500" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function PackageRegister() {
    const { t } = useTranslation();
const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [createdPackage, setCreatedPackage] = useState<any>(null);
  
  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [isUnclaimed, setIsUnclaimed] = useState(false);
  const [shippingType, setShippingType] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  
  const steps = ["Customer", "Type & Category", "Photos & Tracking", "Dimensions", "Batch & Price"];
  
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: warehouses } = trpc.warehouses.list.useQuery();
  const { data: batchesRaw } = trpc.batches.list.useQuery();
  const batches = Array.isArray(batchesRaw) ? batchesRaw : batchesRaw?.data;
  const { data: categories } = trpc.productCategories.listActive.useQuery();
  
  const createMutation = trpc.packages.register.useMutation({
    onSuccess: (data) => {
      toast.success("Package registered successfully");
      setCreatedPackage(data);
    },
    onError: (error) => toast.error(error.message)
  });

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!customerSearch) return customers.filter(c => c.isActive).slice(0, 10);
    
    const search = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.isActive && (
        c.fullName?.toLowerCase().includes(search) ||
        c.customerCode?.toLowerCase().includes(search) ||
        c.mobileNumber?.includes(search)
      )
    ).slice(0, 20);
  }, [customers, customerSearch]);

  // Get batches filtered by shipping type
  const filteredBatches = useMemo(() => {
    if (!batches || !shippingType) return [];
    return batches.filter((b: any) =>
      b.shippingType === shippingType &&
      b.status === 'preparing'
    );
  }, [batches, shippingType]);

  // Calculate CBM from dimensions
  const calculatedCbm = useMemo(() => {
    if (!lengthCm || !widthCm || !heightCm) return null;
    const cbm = (parseFloat(lengthCm) * parseFloat(widthCm) * parseFloat(heightCm)) / 1000000;
    return cbm.toFixed(6);
  }, [lengthCm, widthCm, heightCm]);

  // Calculate estimated price from batch
  const estimatedPrice = useMemo(() => {
    if (!selectedBatchId || selectedBatchId === 'none') return null;
    const batch = batches?.find((b: any) => b.id === parseInt(selectedBatchId));
    if (!batch) return null;

    if (batch.shippingType === 'sea' && batch.pricePerCbm && calculatedCbm) {
      const price = parseFloat(batch.pricePerCbm) * parseFloat(calculatedCbm);
      return { price: price.toFixed(2), unit: 'CBM', rate: batch.pricePerCbm };
    } else if (batch.pricePerKg && weightKg) {
      const price = parseFloat(batch.pricePerKg) * parseFloat(weightKg);
      return { price: price.toFixed(2), unit: 'KG', rate: batch.pricePerKg };
    }
    return null;
  }, [selectedBatchId, batches, calculatedCbm, weightKg]);

  const selectedCustomer = customers?.find(c => c.id === parseInt(selectedCustomerId));
  const selectedCategory = categories?.find(c => c.id === parseInt(selectedCategoryId));
  const selectedBatch = batches?.find((b: any) => b.id === parseInt(selectedBatchId));

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (photos.length + files.length > 5) {
      toast.error("Maximum 5 photos allowed");
      return;
    }
    
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // For now, create a local URL - in production this would upload to S3
        const url = URL.createObjectURL(file);
        setPhotos(prev => [...prev, url]);
      }
      toast.success("Photos added");
    } catch (error) {
      toast.error("Failed to upload photos");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Get default warehouse
  const defaultWarehouse = warehouses?.find(w => w.isActive);

  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case 1: return isUnclaimed || !!selectedCustomerId;
      case 2: return !!shippingType;
      case 3: return true; // Photos and tracking are optional
      case 4: return true; // Dimensions are optional
      case 5: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (currentStep < 5 && canGoNext()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    if ((!isUnclaimed && !selectedCustomerId) || !shippingType || !defaultWarehouse) {
      toast.error("Please complete all required fields");
      return;
    }
    
    createMutation.mutate({
      customerId: isUnclaimed ? undefined : parseInt(selectedCustomerId),
      isUnclaimed,
      originWarehouseId: defaultWarehouse.id,
      shippingType: shippingType as "air_regular" | "air_irregular" | "sea",
      trackingNumber: trackingNumber || undefined,
      description: description || undefined,
      weightKg: weightKg || undefined,
      lengthCm: lengthCm || undefined,
      widthCm: widthCm || undefined,
      heightCm: heightCm || undefined,
      batchId: selectedBatchId && selectedBatchId !== 'none' ? parseInt(selectedBatchId) : undefined,
      categoryId: selectedCategoryId ? parseInt(selectedCategoryId) : undefined,
      photos: photos.length > 0 ? photos : undefined,
    });
  };

  const resetForm = () => {
    setCurrentStep(1);
    setSelectedCustomerId("");
    setCustomerSearch("");
    setIsUnclaimed(false);
    setShippingType("");
    setSelectedCategoryId("");
    setTrackingNumber("");
    setDescription("");
    setPhotos([]);
    setWeightKg("");
    setLengthCm("");
    setWidthCm("");
    setHeightCm("");
    setSelectedBatchId("");
    setCreatedPackage(null);
  };

  // Success screen
  if (createdPackage) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="border-green-200 dark:border-green-800/60 bg-green-50/50 dark:bg-green-950/40">
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-300" />
              </div>
              <CardTitle className="text-green-800 dark:text-green-200">Package Registered Successfully</CardTitle>
              <CardDescription>The package has been added to the system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white dark:bg-card p-4 rounded-lg border text-center">
                <p className="text-sm text-muted-foreground mb-1">Package Code</p>
                <p className="text-2xl font-mono font-bold">{createdPackage.packageCode}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedCustomer?.fullName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{selectedCustomer?.customerCode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Shipping Type</p>
                  <p className="font-medium capitalize">{shippingType.replace(/_/g, " ")}</p>
                </div>
                {selectedCategory && (
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">{selectedCategory.icon} {selectedCategory.nameEn}</p>
                  </div>
                )}
                {selectedBatch && (
                  <div>
                    <p className="text-muted-foreground">Batch</p>
                    <p className="font-medium">{selectedBatch.batchCode}</p>
                  </div>
                )}
                {estimatedPrice && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Estimated Cost</p>
                    <p className="font-medium text-green-600 dark:text-green-300">${estimatedPrice.price}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={resetForm}>
                  <Plus className="h-4 w-4 me-2" />
                  Register Another
                </Button>
                <Button className="flex-1" onClick={() => setLocation("/packages")}>
                  View All Packages
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/packages")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Register Package</h1>
            <p className="text-muted-foreground">Add a new package to the system</p>
          </div>
        </div>

        <StepIndicator currentStep={currentStep} totalSteps={5} steps={steps} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Area */}
          <div className="lg:col-span-2">
            {/* Step 1: Customer Selection */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Select Customer
                  </CardTitle>
                  <CardDescription>Search and select the customer for this package</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, code, or phone..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="pl-10"
                        disabled={isUnclaimed}
                      />
                    </div>
                    <Button
                      type="button"
                      variant={isUnclaimed ? "default" : "outline"}
                      onClick={() => {
                        setIsUnclaimed(!isUnclaimed);
                        if (!isUnclaimed) {
                          setSelectedCustomerId("");
                          setCustomerSearch("");
                        }
                      }}
                    >
                      <AlertTriangle className="h-4 w-4 me-2" />
                      {isUnclaimed ? "Unclaimed" : "No Owner"}
                    </Button>
                  </div>
                  
                  {isUnclaimed && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800/60">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">Unclaimed Package</p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">This package will be registered without an owner. You can assign a customer later.</p>
                      </div>
                    </div>
                  )}
                  
                  {!isUnclaimed && (
                  <div className="grid gap-2 max-h-[400px] overflow-y-auto">
                    {filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => setSelectedCustomerId(customer.id.toString())}
                        className={`
                          p-4 rounded-lg border cursor-pointer transition-all
                          ${selectedCustomerId === customer.id.toString() 
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                            : "hover:border-primary/50 hover:bg-muted/50"
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{customer.fullName}</p>
                            <p className="text-sm text-muted-foreground">
                              <span className="font-mono">{customer.customerCode}</span>
                              {customer.mobileNumber && ` • ${customer.mobileNumber}`}
                            </p>
                          </div>
                          {selectedCustomerId === customer.id.toString() && (
                            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-4 w-4 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <p className="text-center py-8 text-muted-foreground">
                        No customers found. Try a different search term.
                      </p>
                    )}
                  </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Shipping Type & Category */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Shipping Type & Category
                  </CardTitle>
                  <CardDescription>Select the shipping method and product category</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Shipping Type */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Shipping Type *</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: "air_regular", label: "Air Regular", icon: Plane, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40" },
                        { value: "air_irregular", label: "Air Irregular", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40" },
                        { value: "sea", label: "Sea Freight", icon: Ship, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/40" },
                      ].map(type => (
                        <div
                          key={type.value}
                          onClick={() => setShippingType(type.value)}
                          className={`
                            p-4 rounded-lg border cursor-pointer transition-all text-center
                            ${shippingType === type.value 
                              ? `border-primary ${type.bg} ring-2 ring-primary/20` 
                              : "hover:border-primary/50"
                            }
                          `}
                        >
                          <type.icon className={`h-8 w-8 mx-auto mb-2 ${type.color}`} />
                          <p className="font-medium text-sm">{type.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Product Category */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Product Category</Label>
                    <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
                      {categories?.map(category => (
                        <div
                          key={category.id}
                          onClick={() => setSelectedCategoryId(category.id.toString())}
                          className={`
                            p-3 rounded-lg border cursor-pointer transition-all text-center
                            ${selectedCategoryId === category.id.toString() 
                              ? "border-primary ring-2 ring-primary/20" 
                              : "hover:border-primary/50"
                            }
                          `}
                          style={{ 
                            backgroundColor: selectedCategoryId === category.id.toString() 
                              ? `${category.color}15` 
                              : undefined 
                          }}
                        >
                          <div 
                            className="text-2xl mb-1"
                            style={{ color: category.color || "#3B82F6" }}
                          >
                            {category.icon || "📦"}
                          </div>
                          <p className="text-xs font-medium truncate">{category.nameEn}</p>
                        </div>
                      ))}
                    </div>
                    {(!categories || categories.length === 0) && (
                      <p className="text-center py-4 text-muted-foreground">
                        No categories available. Add categories in Settings.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Photos & Tracking */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Photos & Tracking Number
                  </CardTitle>
                  <CardDescription>Add package photos and tracking information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Photo Upload */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Package Photos (up to 5)</Label>
                    <div className="grid grid-cols-5 gap-3">
                      {photos.map((photo, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                          <img src={photo} alt={`Package ${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      {photos.length < 5 && (
                        <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePhotoUpload}
                            className="hidden"
                            disabled={uploading}
                          />
                          {uploading ? (
                            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                          ) : (
                            <>
                              <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">Add Photo</span>
                            </>
                          )}
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Tracking Number */}
                  <div className="space-y-2">
                    <Label htmlFor="trackingNumber" className="text-base font-semibold">Tracking Number</Label>
                    <Input
                      id="trackingNumber"
                      placeholder="Enter tracking number from origin"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-base font-semibold">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the package contents..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Dimensions */}
            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ruler className="h-5 w-5" />
                    Package Dimensions
                  </CardTitle>
                  <CardDescription>Enter weight and dimensions for pricing calculation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Weight */}
                  <div className="space-y-2">
                    <Label htmlFor="weightKg" className="text-base font-semibold flex items-center gap-2">
                      <Weight className="h-4 w-4" />
                      Weight (KG)
                    </Label>
                    <div className="relative" dir="ltr">
                      <Input
                        id="weightKg"
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="e.g., 2.5"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Dimensions */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Dimensions (CM)</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lengthCm" className="text-sm text-muted-foreground">Length</Label>
                        <div className="relative" dir="ltr">
                          <Input
                            id="lengthCm"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="L"
                            value={lengthCm}
                            onChange={(e) => setLengthCm(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="widthCm" className="text-sm text-muted-foreground">Width</Label>
                        <div className="relative" dir="ltr">
                          <Input
                            id="widthCm"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="W"
                            value={widthCm}
                            onChange={(e) => setWidthCm(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="heightCm" className="text-sm text-muted-foreground">Height</Label>
                        <div className="relative" dir="ltr">
                          <Input
                            id="heightCm"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="H"
                            value={heightCm}
                            onChange={(e) => setHeightCm(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CBM Calculation */}
                  {calculatedCbm && (
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator className="h-4 w-4 text-primary" />
                        <Label className="font-semibold">Calculated Volume</Label>
                      </div>
                      <p className="text-2xl font-bold">{calculatedCbm} CBM</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lengthCm} × {widthCm} × {heightCm} cm = {calculatedCbm} m³
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 5: Batch Selection */}
            {currentStep === 5 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Boxes className="h-5 w-5" />
                    Batch Assignment
                  </CardTitle>
                  <CardDescription>
                    Select a batch for this package. Price will be calculated from batch pricing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {filteredBatches.length > 0 ? (
                    <div className="grid gap-3">
                      <div
                        onClick={() => setSelectedBatchId('none')}
                        className={`
                          p-4 rounded-lg border cursor-pointer transition-all
                          ${selectedBatchId === 'none' || !selectedBatchId
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                            : "hover:border-primary/50"
                          }
                        `}
                      >
                        <p className="font-medium">No Batch (Assign Later)</p>
                        <p className="text-sm text-muted-foreground">Package will be registered without batch assignment</p>
                      </div>
                      
                      {filteredBatches.map((batch: any) => (
                        <div
                          key={batch.id}
                          onClick={() => setSelectedBatchId(batch.id.toString())}
                          className={`
                            p-4 rounded-lg border cursor-pointer transition-all
                            ${selectedBatchId === batch.id.toString() 
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                              : "hover:border-primary/50"
                            }
                          `}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {batch.shippingType === 'sea' ? (
                                <Ship className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                              ) : (
                                <Plane className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                              )}
                              <span className="font-mono font-medium">{batch.batchCode}</span>
                            </div>
                            <Badge variant="outline">{batch.status}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-300">
                              <DollarSign className="h-4 w-4" />
                              {batch.shippingType === 'sea' && batch.pricePerCbm ? (
                                <span>${batch.pricePerCbm}/CBM</span>
                              ) : batch.pricePerKg ? (
                                <span>${batch.pricePerKg}/KG</span>
                              ) : (
                                <span className="text-muted-foreground">No price set</span>
                              )}
                            </div>
                            {batch.departureDate && (
                              <span className="text-muted-foreground">
                                Departs: {new Date(batch.departureDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Boxes className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="font-medium">No batches available</p>
                      <p className="text-sm text-muted-foreground">
                        No preparing batches found for {shippingType.replace(/_/g, " ")} shipping.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Package Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedCustomer ? (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Customer</p>
                    <p className="font-medium">{selectedCustomer.fullName}</p>
                    <p className="font-mono text-xs">{selectedCustomer.customerCode}</p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/30 text-muted-foreground text-sm">
                    No customer selected
                  </div>
                )}

                {shippingType && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Shipping Type</p>
                    <p className="font-medium capitalize">{shippingType.replace(/_/g, " ")}</p>
                  </div>
                )}

                {selectedCategory && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Category</p>
                    <p className="font-medium">{selectedCategory.icon} {selectedCategory.nameEn}</p>
                  </div>
                )}

                {(weightKg || calculatedCbm) && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Measurements</p>
                    {weightKg && <p className="font-medium">{weightKg} KG</p>}
                    {calculatedCbm && <p className="text-sm text-muted-foreground">{calculatedCbm} CBM</p>}
                  </div>
                )}

                {selectedBatch && selectedBatchId !== 'none' && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Batch</p>
                    <p className="font-mono font-medium">{selectedBatch.batchCode}</p>
                  </div>
                )}

                {estimatedPrice && (
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/60">
                    <p className="text-xs text-green-600 dark:text-green-300 mb-1">Estimated Cost</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">${estimatedPrice.price}</p>
                    <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                      ${estimatedPrice.rate}/{estimatedPrice.unit}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button variant="outline" onClick={goBack} className="flex-1">
                  <ArrowLeft className="h-4 w-4 me-2" />
                  Back
                </Button>
              )}
              {currentStep < 5 ? (
                <Button onClick={goNext} disabled={!canGoNext()} className="flex-1">
                  Next
                  <ArrowRight className="h-4 w-4 ms-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit} 
                  disabled={createMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {createMutation.isPending ? "Registering..." : "Register Package"}
                  <Check className="h-4 w-4 ms-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
