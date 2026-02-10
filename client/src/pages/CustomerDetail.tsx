import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, Package, FileText, DollarSign, User, Phone, Mail, MapPin, 
  Calendar, Crown, Edit, Wallet, TrendingUp, TrendingDown, Clock,
  FileCheck, CreditCard, Upload, Download, Eye, Trash2, RotateCcw,
  Building, Globe, Hash, MessageSquare, Shield, Briefcase, Plus, Check, X,
  FileDown, Loader2
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { IRAQI_GOVERNORATES, IRAQI_CITIES } from "../../../shared/iraqi-cities";
import { useTranslation } from "@/contexts/LanguageContext";

export default function CustomerDetail() {
    const { t } = useTranslation();
const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const customerId = parseInt(params.id || "0");
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("");
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isInvoiceViewOpen, setIsInvoiceViewOpen] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    customerCode: "",
    fullName: "",
    fullNameArabic: "",
    fullNameKurdish: "",
    gender: "" as "male" | "female" | "",
    nationality: "",
    businessType: "",
    mobileNumber: "",
    secondaryMobile: "",
    email: "",
    country: "",
    city: "",
    district: "",
    address: "",
    notes: "",
    isActive: true,
  });
  
  // File input refs for document uploads
  const passportInputRef = useRef<HTMLInputElement>(null);
  const nationalIdInputRef = useRef<HTMLInputElement>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);

  // PDF Export mutation
  const exportCustomerPDF = trpc.dashboard.exportCustomerPDF.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(t('messages.customerReportDownloaded'));
      setIsExportingPDF(false);
    },
    onError: (error) => {
      toast.error(t("common.error") + ': ' + error.message);
      setIsExportingPDF(false);
    }
  });

  const handleExportCustomerPDF = () => {
    setIsExportingPDF(true);
    exportCustomerPDF.mutate({ customerId });
  };

  const { data: customer, refetch } = trpc.customers.getById.useQuery({ id: customerId });
  const { data: balance } = trpc.customers.getBalance.useQuery({ customerId });
  const { data: ledger } = trpc.customers.getLedger.useQuery({ customerId });
  const { data: packages } = trpc.packages.getByCustomer.useQuery({ customerId });
  const { data: invoices } = trpc.invoices.getByCustomer.useQuery({ customerId });
  const { data: vipCustomers } = trpc.vip.list.useQuery();
  const { data: activityLogs } = trpc.auditLogs.getByCustomer.useQuery({ customerId });
  
  // Full Package Orders (Purchase Requests removed)
  const { data: fullPackageOrders } = trpc.fullPackage.list.useQuery({ customerId });
  
  // Extra Services
  const { data: extraServices, refetch: refetchServices } = trpc.extraServices.getByCustomer.useQuery({ customerId });
  const { data: serviceTypes } = trpc.extraServices.getActiveServiceTypes.useQuery();
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [newService, setNewService] = useState({
    serviceTypeId: 0,
    description: "",
    costAmount: "",
    priceAmount: "",
    currency: "USD" as "USD" | "IQD" | "CNY",
    notes: "",
    addToBalance: true,
  });
  
  const createServiceMutation = trpc.extraServices.create.useMutation({
    onSuccess: () => {
      toast.success("Service added successfully");
      setIsAddServiceOpen(false);
      setNewService({
        serviceTypeId: 0,
        description: "",
        costAmount: "",
        priceAmount: "",
        currency: "USD",
        notes: "",
        addToBalance: true,
      });
      refetchServices();
      refetch(); // Refresh customer balance
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const markAsPaidMutation = trpc.extraServices.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Service marked as paid");
      refetchServices();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  // Document upload/delete mutations
  const uploadDocumentMutation = trpc.customers.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success(t("messages.documentUploaded"));
      setUploadingDoc(null);
      refetch();
    },
    onError: (error) => {
      toast.error(t("common.error") + ": " + error.message);
      setUploadingDoc(null);
    }
  });
  
  const deleteDocumentMutation = trpc.customers.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success(t("messages.documentDeleted"));
      refetch();
    },
    onError: (error) => {
      toast.error(t("common.error") + ": " + error.message);
    }
  });
  
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: "passport" | "nationalId" | "contract") => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("common.fileTooLarge"));
      return;
    }
    
    setUploadingDoc(docType);
    
    // Convert file to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadDocumentMutation.mutate({
        customerId,
        documentType: docType,
        fileData: base64,
        fileName: file.name,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = "";
  };
  
  const handleDocumentDelete = (docType: "passport" | "nationalId" | "contract") => {
    if (confirm(t("customers.confirmDeleteDocument"))) {
      deleteDocumentMutation.mutate({ customerId, documentType: docType });
    }
  };
  
  const resetPasswordMutation = trpc.customers.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset successfully");
      setIsResetPasswordOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  // Invoice PDF download mutation
  const downloadInvoicePDF = trpc.invoices.generatePDF.useMutation({
    onSuccess: (data) => {
      // Open the PDF URL in a new tab
      window.open(data.url, '_blank');
      toast.success(t('messages.invoiceDownloaded') || 'Invoice downloaded successfully');
      setDownloadingInvoiceId(null);
    },
    onError: (error) => {
      toast.error(t("common.error") + ': ' + error.message);
      setDownloadingInvoiceId(null);
    }
  });
  
  const handleDownloadInvoice = (invoiceId: number) => {
    setDownloadingInvoiceId(invoiceId);
    downloadInvoicePDF.mutate({ id: invoiceId });
  };
  
  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsInvoiceViewOpen(true);
  };
  
  // Update customer mutation
  const updateCustomerMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success(t("messages.customerInfoUpdated"));
      setIsEditOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(t("common.error") + ": " + error.message);
    }
  });
  
  // Open edit dialog and populate form
  const handleOpenEdit = () => {
    if (customer) {
      setEditForm({
        customerCode: customer.customerCode || "",
        fullName: customer.fullName || "",
        fullNameArabic: (customer as any).fullNameArabic || "",
        fullNameKurdish: (customer as any).fullNameKurdish || "",
        gender: (customer as any).gender || "",
        nationality: (customer as any).nationality || "",
        businessType: (customer as any).businessType || "",
        mobileNumber: customer.mobileNumber || "",
        secondaryMobile: (customer as any).secondaryMobile || "",
        email: customer.email || "",
        country: customer.country || "",
        city: customer.city || "",
        district: (customer as any).district || "",
        address: customer.address || "",
        notes: customer.notes || "",
        isActive: customer.isActive ?? true,
      });
      // Set selected governorate for city filtering
      const gov = IRAQI_GOVERNORATES.find(g => g.nameEn === customer.country || g.nameAr === customer.country);
      if (gov) setSelectedGovernorate(gov.id);
    }
    setIsEditOpen(true);
  };
  
  // Handle edit form submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomerMutation.mutate({
      id: customerId,
      customerCode: editForm.customerCode || undefined,
      fullName: editForm.fullName,
      fullNameArabic: editForm.fullNameArabic || undefined,
      fullNameKurdish: editForm.fullNameKurdish || undefined,
      gender: editForm.gender || undefined,
      nationality: editForm.nationality || undefined,
      businessType: editForm.businessType || undefined,
      secondaryMobile: editForm.secondaryMobile || undefined,
      email: editForm.email || undefined,
      country: editForm.country || undefined,
      city: editForm.city || undefined,
      district: editForm.district || undefined,
      address: editForm.address || undefined,
      notes: editForm.notes || undefined,
      isActive: editForm.isActive,
    });
  };

  const isVip = vipCustomers?.some(v => v.customerId === customerId);
  const vipInfo = vipCustomers?.find(v => v.customerId === customerId);

  // Calculate statistics
  const totalPackages = packages?.length || 0;
  const deliveredPackages = packages?.filter(p => p.status === "delivered").length || 0;
  const pendingPackages = packages?.filter(p => !["delivered", "cancelled"].includes(p.status)).length || 0;
  const totalSpent = packages?.reduce((sum, p) => sum + parseFloat(p.calculatedCostUsd || "0"), 0) || 0;
  
  // Additional statistics
  const totalWeight = packages?.reduce((sum, p) => sum + parseFloat(p.weightKg || "0"), 0) || 0;
  const averageWeight = totalPackages > 0 ? totalWeight / totalPackages : 0;
  
  // Calculate preferred shipping type
  const shippingTypeCounts = packages?.reduce((acc, p) => {
    acc[p.shippingType] = (acc[p.shippingType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  const preferredShippingType = Object.entries(shippingTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  const preferredShippingCount = Object.entries(shippingTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[1] || 0;

  // Get cities for selected governorate
  const filteredCities = selectedGovernorate 
    ? IRAQI_CITIES.filter(city => city.governorateId === selectedGovernorate)
    : IRAQI_CITIES;

  const handleResetPassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    resetPasswordMutation.mutate({
      id: customerId,
      newPassword: formData.get("newPassword") as string,
    });
  };

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading customer...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/customers")} className="mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">{customer.fullName}</h1>
              {isVip && (
                <Badge className={`text-xs border-0 ${
                  vipInfo?.tier === 'platinum' ? 'bg-gradient-to-r from-slate-600 to-slate-800 text-white' :
                  vipInfo?.tier === 'gold' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' :
                  'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-700'
                }`}>
                  <Crown className="h-3 w-3 mr-1" />
                  {vipInfo?.tier?.toUpperCase()} VIP
                </Badge>
              )}
              <Badge variant={customer.isActive ? "default" : "secondary"} className="text-xs">
                {customer.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-muted-foreground font-mono text-sm">{customer.customerCode}</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Password
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-500" />
                    Reset Customer Password
                  </DialogTitle>
                  <DialogDescription>
                    Set a new password for {customer.fullName}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleResetPassword}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input id="newPassword" name="newPassword" type="password" required minLength={6} className="h-11" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsResetPasswordOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={resetPasswordMutation.isPending} className="bg-amber-500 hover:bg-amber-600">
                      {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportCustomerPDF}
              disabled={isExportingPDF}
            >
              {isExportingPDF ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Exporting...</>
              ) : (
                <><FileDown className="h-4 w-4 mr-2" /> Export PDF</>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Customer Profile Card */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Customer Info */}
          <Card className="lg:col-span-1 border-0 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-4 ring-primary/10">
                  <span className="text-2xl font-bold text-primary">
                    {customer.fullName?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </div>
                <div>
                  <CardTitle className="text-lg">{customer.fullName}</CardTitle>
                  <CardDescription className="font-mono">{customer.customerCode}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Names */}
              {(customer.fullNameArabic || customer.fullNameKurdish) && (
                <div className="space-y-2">
                  {customer.fullNameArabic && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Arabic:</span>
                      <span dir="rtl">{customer.fullNameArabic}</span>
                    </div>
                  )}
                  {customer.fullNameKurdish && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Kurdish:</span>
                      <span dir="rtl">{customer.fullNameKurdish}</span>
                    </div>
                  )}
                </div>
              )}
              
              <Separator />
              
              {/* Contact Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("customers.contact")}</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{customer.mobileNumber}</p>
                      <p className="text-xs text-muted-foreground">{t("customers.primaryMobile")}</p>
                    </div>
                  </div>
                  {(customer as any).secondaryMobile && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{(customer as any).secondaryMobile}</p>
                        <p className="text-xs text-muted-foreground">{t("customers.secondaryMobile")}</p>
                      </div>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{customer.email}</p>
                        <p className="text-xs text-muted-foreground">{t("customers.email")}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Personal Info */}
              {((customer as any).gender || (customer as any).nationality || (customer as any).businessType) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("customers.personalInfo")}</h4>
                    <div className="space-y-2">
                      {(customer as any).gender && (
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                            <User className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {(customer as any).gender === 'male' ? t("customers.male") : t("customers.female")}
                            </p>
                            <p className="text-xs text-muted-foreground">{t("customers.gender")}</p>
                          </div>
                        </div>
                      )}
                      {(customer as any).nationality && (
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{(customer as any).nationality}</p>
                            <p className="text-xs text-muted-foreground">{t("customers.nationality")}</p>
                          </div>
                        </div>
                      )}
                      {(customer as any).businessType && (
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <Briefcase className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{(customer as any).businessType}</p>
                            <p className="text-xs text-muted-foreground">{t("customers.businessType")}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              <Separator />
              
              {/* Location */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("customers.location")}</h4>
                <div className="space-y-2">
                  {(customer.city || customer.country) && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {customer.city && customer.country 
                            ? `${customer.city}, ${customer.country}`
                            : customer.city || customer.country
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">{t("customers.city")}</p>
                      </div>
                    </div>
                  )}
                  {(customer as any).district && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                        <Building className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{(customer as any).district}</p>
                        <p className="text-xs text-muted-foreground">{t("customers.district")}</p>
                      </div>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Building className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{customer.address}</p>
                        <p className="text-xs text-muted-foreground">{t("customers.address")}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <Separator />
              
              {/* Account Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Account</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{new Date(customer.createdAt).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">Member Since</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Hash className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium font-mono">#{customer.sequenceNumber}</p>
                      <p className="text-xs text-muted-foreground">Sequence Number</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Notes */}
              {customer.notes && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes</h4>
                    <div className="flex items-start gap-3">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm">{customer.notes}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Right Column - Stats and Tabs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Cards - Row 1 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.balance")}</p>
                      <p className={`text-2xl font-bold ${(balance || 0) > 0 ? "text-red-600" : (balance || 0) < 0 ? "text-green-600" : ""}`}>
                        ${Math.abs(balance || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(balance || 0) > 0 ? t("customers.inDebt") : (balance || 0) < 0 ? t("customers.hasCredit") : t("customers.settled")}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      (balance || 0) > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"
                    }`}>
                      <Wallet className={`h-5 w-5 ${(balance || 0) > 0 ? "text-red-600" : "text-green-600"}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.totalPackages")}</p>
                      <p className="text-2xl font-bold">{totalPackages}</p>
                      <p className="text-xs text-muted-foreground">{deliveredPackages} {t("packages.delivered")}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("packages.inProgress")}</p>
                      <p className="text-2xl font-bold text-amber-600">{pendingPackages}</p>
                      <p className="text-xs text-muted-foreground">{t("common.active")}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.totalSpent")}</p>
                      <p className="text-2xl font-bold">${totalSpent.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{t("common.allTime")}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Stats Cards - Row 2 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.totalWeight")}</p>
                      <p className="text-2xl font-bold">{totalWeight.toFixed(2)} kg</p>
                      <p className="text-xs text-muted-foreground">{t("packages.allPackages")}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Package className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.avgWeight")}</p>
                      <p className="text-2xl font-bold">{averageWeight.toFixed(2)} kg</p>
                      <p className="text-xs text-muted-foreground">{t("customers.perPackage")}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-indigo-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.preferredShipping")}</p>
                      <p className="text-lg font-bold capitalize">{preferredShippingType.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">{preferredShippingCount} {t("packages.package")}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.deliveryRate")}</p>
                      <p className="text-2xl font-bold text-green-600">
                        {totalPackages > 0 ? Math.round((deliveredPackages / totalPackages) * 100) : 0}%
                      </p>
                      <p className="text-xs text-muted-foreground">Delivery Rate</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Check className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="packages" className="w-full">
              <TabsList className="grid w-full grid-cols-8">
                <TabsTrigger value="packages" className="gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Packages</span>
                </TabsTrigger>
                <TabsTrigger value="services" className="gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Services</span>
                </TabsTrigger>
                <TabsTrigger value="ledger" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Ledger</span>
                </TabsTrigger>
                <TabsTrigger value="invoices" className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Invoices</span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-2">
                  <FileCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Documents</span>
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Activity</span>
                </TabsTrigger>
                <TabsTrigger value="fullPackage" className="gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('nav.fullPackage')}</span>
                </TabsTrigger>

              </TabsList>

              <TabsContent value="packages" className="mt-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Packages</CardTitle>
                        <CardDescription>All packages for this customer</CardDescription>
                      </div>
                      <Badge variant="secondary">{packages?.length || 0} total</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Package Code</TableHead>
                          <TableHead>Tracking</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Cost</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {packages?.slice(0, 10).map((pkg) => (
                          <TableRow key={pkg.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-sm">{pkg.packageCode}</TableCell>
                            <TableCell className="text-sm">{pkg.trackingNumber || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-xs">
                                {pkg.shippingType.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{pkg.weightKg ? `${pkg.weightKg} kg` : "-"}</TableCell>
                            <TableCell className="font-mono text-sm">${pkg.calculatedCostUsd || "0.00"}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={`capitalize text-xs ${
                                  pkg.status === "delivered" ? "bg-green-50 text-green-700 border-green-200" :
                                  pkg.status === "cancelled" ? "bg-red-50 text-red-700 border-red-200" :
                                  "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {pkg.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(pkg.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!packages || packages.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-12">
                              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                              <p className="text-muted-foreground">No packages found</p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    {packages && packages.length > 10 && (
                      <div className="p-4 text-center border-t">
                        <Button variant="outline" size="sm">
                          View all {packages.length} packages
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Extra Services Tab */}
              <TabsContent value="services" className="mt-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Extra Services</CardTitle>
                        <CardDescription>{t("customers.additionalServices")}</CardDescription>
                      </div>
                      <Dialog open={isAddServiceOpen} onOpenChange={setIsAddServiceOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Service
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Add Extra Service</DialogTitle>
                            <DialogDescription>{t("customers.addServiceDescription")}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>{t("customers.serviceType")}</Label>
                              <Select
                                value={newService.serviceTypeId.toString()}
                                onValueChange={(v) => {
                                  const typeId = parseInt(v);
                                  const selectedType = serviceTypes?.find(t => t.id === typeId);
                                  setNewService({
                                    ...newService,
                                    serviceTypeId: typeId,
                                    costAmount: selectedType?.defaultCost || "",
                                    priceAmount: selectedType?.defaultPrice || "",
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select service type..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {serviceTypes?.map((type) => (
                                    <SelectItem key={type.id} value={type.id.toString()}>
                                      {type.nameKu || type.nameEn}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>{t("common.description")}</Label>
                              <Textarea
                                placeholder="Enter service description..."
                                value={newService.description}
                                onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>{t("common.cost")}</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="pl-7"
                                    placeholder="0.00"
                                    value={newService.costAmount}
                                    onChange={(e) => setNewService({ ...newService, costAmount: e.target.value })}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">Your cost for this service</p>
                              </div>
                              <div className="space-y-2">
                                <Label>{t("common.price")}</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="pl-7"
                                    placeholder="0.00"
                                    value={newService.priceAmount}
                                    onChange={(e) => setNewService({ ...newService, priceAmount: e.target.value })}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">Price charged to customer</p>
                              </div>
                            </div>
                            
                            {/* Profit Display */}
                            {newService.costAmount && newService.priceAmount && (
                              <div className="p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">{t("finance.profit")}:</span>
                                  <span className={`font-bold ${
                                    Number(newService.priceAmount) - Number(newService.costAmount) >= 0 
                                      ? "text-green-600" 
                                      : "text-red-600"
                                  }`}>
                                    ${(Number(newService.priceAmount) - Number(newService.costAmount)).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )}
                            
                            <div className="space-y-2">
                              <Label>{t("common.notes")}</Label>
                              <Textarea
                                placeholder="Optional notes..."
                                value={newService.notes}
                                onChange={(e) => setNewService({ ...newService, notes: e.target.value })}
                              />
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="addToBalance"
                                checked={newService.addToBalance}
                                onChange={(e) => setNewService({ ...newService, addToBalance: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="addToBalance" className="text-sm cursor-pointer">
                                {t("customers.addToBalance")}
                              </Label>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddServiceOpen(false)}>
                              Cancel
                            </Button>
                            <Button
                              onClick={() => {
                                if (!newService.serviceTypeId || !newService.description || !newService.priceAmount) {
                                  toast.error("Please fill in all required fields");
                                  return;
                                }
                                createServiceMutation.mutate({
                                  ...newService,
                                  customerId,
                                  costAmount: newService.costAmount || "0",
                                });
                              }}
                              disabled={createServiceMutation.isPending}
                            >
                              {createServiceMutation.isPending ? "Adding..." : "Add Service"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Summary Cards */}
                    {extraServices && extraServices.length > 0 && (
                      <div className="grid grid-cols-3 gap-4 p-4 border-b">
                        <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                          <p className="text-xs text-muted-foreground">Total Services</p>
                          <p className="text-xl font-bold text-blue-600">{extraServices.length}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                          <p className="text-xs text-muted-foreground">Total Revenue</p>
                          <p className="text-xl font-bold text-green-600">
                            ${extraServices.reduce((sum, s) => sum + Number(s.priceAmount || 0), 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                          <p className="text-xs text-muted-foreground">Total Profit</p>
                          <p className="text-xl font-bold text-amber-600">
                            ${extraServices.reduce((sum, s) => sum + (Number(s.priceAmount || 0) - Number(s.costAmount || 0)), 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Date</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extraServices?.map((service) => {
                          const profit = Number(service.priceAmount || 0) - Number(service.costAmount || 0);
                          return (
                            <TableRow key={service.id}>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(service.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {service.serviceType?.nameKu || service.serviceType?.nameEn || "Service"}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {service.description}
                              </TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                ${Number(service.costAmount || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ${Number(service.priceAmount || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className={`text-right font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                ${profit.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {service.isPaid ? (
                                  <Badge className="bg-green-100 text-green-700 border-0">
                                    <Check className="h-3 w-3 mr-1" />
                                    Paid
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      markAsPaidMutation.mutate({
                                        id: service.id,
                                        paymentMethod: "cash",
                                        paidAmount: service.priceAmount || "0",
                                      });
                                    }}
                                  >
                                    Mark Paid
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {(!extraServices || extraServices.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-12">
                              <Briefcase className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                              <p className="text-muted-foreground">No extra services yet</p>
                              <p className="text-sm text-muted-foreground mt-1">{t("customers.noExtraServices")}</p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ledger" className="mt-4">
                {/* Balance History Graph */}
                {ledger && ledger.length > 0 && (
                  <Card className="border-0 shadow-lg mb-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{t("customers.balanceHistory")}</CardTitle>
                      <CardDescription>{t("customers.balanceChangesOverTime")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48 flex items-end gap-1">
                        {(() => {
                          // Get last 30 entries reversed (oldest first)
                          const entries = [...ledger].reverse().slice(-30);
                          const maxBalance = Math.max(...entries.map(e => Math.abs(parseFloat(e.balanceAfterUsd))));
                          const minBalance = Math.min(...entries.map(e => parseFloat(e.balanceAfterUsd)));
                          const range = maxBalance - minBalance || 1;
                          
                          return entries.map((entry, i) => {
                            const balance = parseFloat(entry.balanceAfterUsd);
                            const height = Math.max(10, ((Math.abs(balance) - Math.abs(minBalance)) / range) * 100 + 10);
                            const isPositive = balance > 0;
                            
                            return (
                              <div
                                key={entry.id}
                                className="flex-1 group relative"
                                style={{ minWidth: '8px' }}
                              >
                                <div
                                  className={`w-full rounded-t transition-all ${
                                    isPositive 
                                      ? 'bg-red-400 hover:bg-red-500' 
                                      : balance < 0 
                                        ? 'bg-green-400 hover:bg-green-500'
                                        : 'bg-slate-300 hover:bg-slate-400'
                                  }`}
                                  style={{ height: `${height}%` }}
                                />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                  <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap border">
                                    <div className="font-medium">${balance}</div>
                                    <div className="text-muted-foreground">
                                      {new Date(entry.createdAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        <span>{ledger.length > 0 ? new Date(ledger[ledger.length - 1].createdAt).toLocaleDateString() : ''}</span>
                        <span>{t("time.justNow")}</span>
                      </div>
                      <div className="flex gap-4 mt-3 justify-center text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-red-400"></div>
                          <span>{t("customers.owes")}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-green-400"></div>
                          <span>{t("customers.credit")}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded bg-slate-300"></div>
                          <span>{t("customers.settled")}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{t("customers.ledgerEntries")}</CardTitle>
                        <CardDescription>{t("customers.financialTransactionHistory")}</CardDescription>
                      </div>
                      <Badge variant="secondary">{ledger?.length || 0} {t("common.records")}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger?.slice(0, 10).map((entry: any) => {
                          const isCredit = entry.transactionType?.startsWith('CREDIT_');
                          return (
                          <TableRow key={entry.id} className="hover:bg-muted/50">
                            <TableCell className="text-sm">
                              {new Date(entry.createdAt!).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline"
                                className={`capitalize text-xs ${
                                  isCredit ? "bg-green-50 text-green-700 border-green-200" : 
                                  "bg-red-50 text-red-700 border-red-200"
                                }`}
                              >
                                {entry.transactionType?.replace('DEBIT_', '').replace('CREDIT_', '').toLowerCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{entry.description || "-"}</TableCell>
                            <TableCell className={`text-right font-mono text-sm ${
                              isCredit ? "text-green-600" : "text-red-600"
                            }`}>
                              {isCredit ? "-" : "+"}${entry.amountUsd}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              ${entry.balanceAfterUsd}
                            </TableCell>
                          </TableRow>
                        )})}
                        {(!ledger || ledger.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12">
                              <DollarSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                              <p className="text-muted-foreground">No ledger entries found</p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="invoices" className="mt-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Invoices</CardTitle>
                        <CardDescription>Invoice history</CardDescription>
                      </div>
                      <Badge variant="secondary">{invoices?.length || 0} invoices</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Total (USD)</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices?.map((invoice) => (
                          <TableRow key={invoice.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-sm">{invoice.invoiceNumber}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(invoice.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-mono text-sm">${invoice.totalUsd}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline"
                                className={`capitalize text-xs ${
                                  invoice.status === "paid" ? "bg-green-50 text-green-700 border-green-200" : 
                                  "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleViewInvoice(invoice)}
                                title={t('common.view') || 'View'}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleDownloadInvoice(invoice.id)}
                                disabled={downloadingInvoiceId === invoice.id}
                                title={t('common.download') || 'Download'}
                              >
                                {downloadingInvoiceId === invoice.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!invoices || invoices.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12">
                              <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                              <p className="text-muted-foreground">No invoices found</p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{t("customers.documents")}</CardTitle>
                        <CardDescription>{t("customers.verificationDocuments")}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Hidden file inputs */}
                    <input
                      type="file"
                      ref={passportInputRef}
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => handleDocumentUpload(e, "passport")}
                    />
                    <input
                      type="file"
                      ref={nationalIdInputRef}
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => handleDocumentUpload(e, "nationalId")}
                    />
                    <input
                      type="file"
                      ref={contractInputRef}
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => handleDocumentUpload(e, "contract")}
                    />
                    
                    <div className="grid gap-4 sm:grid-cols-3">
                      {/* Passport */}
                      <div className={`border-2 rounded-lg p-6 text-center transition-colors ${
                        (customer as any).passportUrl 
                          ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20" 
                          : "border-dashed hover:border-primary/50"
                      }`}>
                        <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                          <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h4 className="font-medium mb-1">Passport</h4>
                        <p className="text-xs text-muted-foreground mb-3">{t("customers.form.passport")}</p>
                        {(customer as any).passportUrl ? (
                          <div className="space-y-2">
                            <Badge variant="default" className="text-xs bg-blue-600">
                              <Check className="h-3 w-3 mr-1" />
                              {t("common.uploaded")}
                            </Badge>
                            <div className="flex gap-2 justify-center mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open((customer as any).passportUrl, "_blank")}
                              >
                                <Eye className="h-3 w-3 mr-1" />{t("blog.views")}</Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDocumentDelete("passport")}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => passportInputRef.current?.click()}
                            disabled={uploadingDoc === "passport"}
                          >
                            {uploadingDoc === "passport" ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {t("common.upload")}
                          </Button>
                        )}
                      </div>
                      
                      {/* National ID */}
                      <div className={`border-2 rounded-lg p-6 text-center transition-colors ${
                        (customer as any).nationalIdUrl 
                          ? "border-green-300 bg-green-50 dark:bg-green-900/20" 
                          : "border-dashed hover:border-primary/50"
                      }`}>
                        <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                          <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <h4 className="font-medium mb-1">National ID</h4>
                        <p className="text-xs text-muted-foreground mb-3">{t("customers.nationalId")}</p>
                        {(customer as any).nationalIdUrl ? (
                          <div className="space-y-2">
                            <Badge variant="default" className="text-xs bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              {t("common.uploaded")}
                            </Badge>
                            <div className="flex gap-2 justify-center mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open((customer as any).nationalIdUrl, "_blank")}
                              >
                                <Eye className="h-3 w-3 mr-1" />{t("blog.views")}</Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDocumentDelete("nationalId")}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => nationalIdInputRef.current?.click()}
                            disabled={uploadingDoc === "nationalId"}
                          >
                            {uploadingDoc === "nationalId" ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {t("common.upload")}
                          </Button>
                        )}
                      </div>
                      
                      {/* Contract */}
                      <div className={`border-2 rounded-lg p-6 text-center transition-colors ${
                        (customer as any).contractUrl 
                          ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20" 
                          : "border-dashed hover:border-primary/50"
                      }`}>
                        <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
                          <FileCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h4 className="font-medium mb-1">Contract</h4>
                        <p className="text-xs text-muted-foreground mb-3">{t("customers.form.contract")}</p>
                        {(customer as any).contractUrl ? (
                          <div className="space-y-2">
                            <Badge variant="default" className="text-xs bg-amber-600">
                              <Check className="h-3 w-3 mr-1" />
                              {t("common.uploaded")}
                            </Badge>
                            <div className="flex gap-2 justify-center mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open((customer as any).contractUrl, "_blank")}
                              >
                                <Eye className="h-3 w-3 mr-1" />{t("blog.views")}</Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDocumentDelete("contract")}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => contractInputRef.current?.click()}
                            disabled={uploadingDoc === "contract"}
                          >
                            {uploadingDoc === "contract" ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {t("common.upload")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="mt-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{t("customers.activityHistory")}</CardTitle>
                        <CardDescription>{t("customers.allChangesForCustomer")}</CardDescription>
                      </div>
                      <Badge variant="secondary">{activityLogs?.length || 0} {t("common.activities")}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {activityLogs && activityLogs.length > 0 ? (
                      <div className="space-y-4">
                        {activityLogs.slice(0, 20).map((log: any) => (
                          <div key={log.id} className="flex gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                              log.action.includes('create') ? 'bg-green-100 text-green-600' :
                              log.action.includes('update') || log.action.includes('edit') ? 'bg-blue-100 text-blue-600' :
                              log.action.includes('delete') || log.action.includes('remove') ? 'bg-red-100 text-red-600' :
                              log.action.includes('payment') ? 'bg-emerald-100 text-emerald-600' :
                              log.action.includes('reset') ? 'bg-amber-100 text-amber-600' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {log.action.includes('create') ? <Plus className="h-5 w-5" /> :
                               log.action.includes('update') || log.action.includes('edit') ? <Edit className="h-5 w-5" /> :
                               log.action.includes('delete') || log.action.includes('remove') ? <Trash2 className="h-5 w-5" /> :
                               log.action.includes('payment') ? <DollarSign className="h-5 w-5" /> :
                               log.action.includes('reset') ? <RotateCcw className="h-5 w-5" /> :
                               <Clock className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm capitalize">
                                  {log.action.replace(/_/g, ' ')}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {log.userRole || 'system'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(log.createdAt).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              {log.newValues && (
                                <div className="mt-2 text-xs bg-background p-2 rounded border">
                                  <pre className="whitespace-pre-wrap break-all text-muted-foreground">
                                    {typeof log.newValues === 'string' 
                                      ? log.newValues 
                                      : JSON.stringify(log.newValues, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-muted-foreground">{t("customers.noActivityFound")}</p>
                        <p className="text-xs text-muted-foreground mt-1">No activity logs found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Full Package Tab */}
              <TabsContent value="fullPackage" className="mt-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{t('nav.fullPackage')}</CardTitle>
                        <CardDescription>{t('fullPackage.allOrders')}</CardDescription>
                      </div>
                      <Badge variant="secondary">{fullPackageOrders?.length || 0} {t('common.total')}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {fullPackageOrders && fullPackageOrders.length > 0 ? (
                      <div className="space-y-3">
                        {fullPackageOrders.map((order: any) => (
                          <div key={order.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => setLocation(`/full-package/${order.id}`)}>
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Package className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{order.orderCode}</p>
                                <p className="text-sm text-muted-foreground">{order.productName || t('common.noName')}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={order.status === 'delivered' ? 'default' : order.status === 'pending' ? 'secondary' : 'outline'}>
                                {order.status}
                              </Badge>
                              <p className="text-sm font-medium mt-1">${Number(order.totalPrice || 0).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-muted-foreground">{t('fullPackage.noOrders')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </div>
        </div>
      </div>
      
      {/* Edit Customer Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              {t("customers.editCustomer")}
            </DialogTitle>
            <DialogDescription>
              {t("customers.editCustomerDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">{t("customers.basicInfo")}</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-customerCode">{t("customers.form.customerCode") || "Customer Code"}</Label>
                    <Input
                      id="edit-customerCode"
                      value={editForm.customerCode}
                      onChange={(e) => setEditForm({...editForm, customerCode: e.target.value})}
                      placeholder="AZ0001(Name)"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("customers.form.customerCodeEditHint") || "Leave empty to keep current code"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-fullName">{t("customers.fullNameEnglish")}</Label>
                    <Input
                      id="edit-fullName"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({...editForm, fullName: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-fullNameArabic">{t("customers.form.nameArabic")}</Label>
                    <Input
                      id="edit-fullNameArabic"
                      value={editForm.fullNameArabic}
                      onChange={(e) => setEditForm({...editForm, fullNameArabic: e.target.value})}
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-fullNameKurdish">{t("customers.form.nameKurdish")}</Label>
                    <Input
                      id="edit-fullNameKurdish"
                      value={editForm.fullNameKurdish}
                      onChange={(e) => setEditForm({...editForm, fullNameKurdish: e.target.value})}
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-gender">{t("customers.form.gender")}</Label>
                    <Select
                      value={editForm.gender}
                      onValueChange={(v) => setEditForm({...editForm, gender: v as "male" | "female"})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("customers.selectGender")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">{t("customers.male")}</SelectItem>
                        <SelectItem value="female">{t("customers.female")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Contact Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">{t("customers.contact")}</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-mobileNumber">{t("customers.mobileNotEditable")}</Label>
                    <Input
                      id="edit-mobileNumber"
                      value={editForm.mobileNumber}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-secondaryMobile">{t("customers.secondaryPhone")}</Label>
                    <Input
                      id="edit-secondaryMobile"
                      value={editForm.secondaryMobile}
                      onChange={(e) => setEditForm({...editForm, secondaryMobile: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-email">{t("customers.email")}</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Business Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">{t("customers.businessInfo")}</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-nationality">{t("customers.form.nationality")}</Label>
                    <Input
                      id="edit-nationality"
                      value={editForm.nationality}
                      onChange={(e) => setEditForm({...editForm, nationality: e.target.value})}
                      placeholder={t("customers.nationalityPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-businessType">{t("customers.businessType")}</Label>
                    <Select
                      value={editForm.businessType}
                      onValueChange={(v) => setEditForm({...editForm, businessType: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("customers.selectBusinessType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">{t("customers.personal")}</SelectItem>
                        <SelectItem value="trader">{t("customers.trader")}</SelectItem>
                        <SelectItem value="company">{t("customers.company")}</SelectItem>
                        <SelectItem value="other">{t("customers.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Location */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">{t("customers.location")}</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-country">{t("customers.governorate")}</Label>
                    <Select
                      value={selectedGovernorate}
                      onValueChange={(v) => {
                        setSelectedGovernorate(v);
                        const gov = IRAQI_GOVERNORATES.find(g => g.id === v);
                        setEditForm({...editForm, country: gov?.nameEn || "", city: ""});
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("customers.selectGovernorate")} />
                      </SelectTrigger>
                      <SelectContent>
                        {IRAQI_GOVERNORATES.map(gov => (
                          <SelectItem key={gov.id} value={gov.id}>
                            {gov.nameKu} - {gov.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-city">{t("customers.city")}</Label>
                    <Select
                      value={editForm.city}
                      onValueChange={(v) => setEditForm({...editForm, city: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("customers.selectCity")} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCities.map((city, idx) => (
                          <SelectItem key={`${city.governorateId}-${city.nameEn}-${idx}`} value={city.nameEn}>
                            {city.nameKu} - {city.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-district">{t("customers.district")}</Label>
                    <Input
                      id="edit-district"
                      value={editForm.district}
                      onChange={(e) => setEditForm({...editForm, district: e.target.value})}
                      placeholder={t("customers.districtPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-address">{t("customers.fullAddress")}</Label>
                    <Input
                      id="edit-address"
                      value={editForm.address}
                      onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Notes & Status */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">{t("customers.notesAndStatus")}</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">{t("common.notes")}</Label>
                    <Textarea
                      id="edit-notes"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-isActive"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm({...editForm, isActive: e.target.checked})}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="edit-isActive" className="cursor-pointer">
                      {t("common.active")}
                    </Label>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>{t("forms.cancel")}</Button>
              <Button type="submit" disabled={updateCustomerMutation.isPending}>
                {updateCustomerMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("messages.saving")}</>
                ) : (
                  <><Check className="h-4 w-4 mr-2" />{t("forms.save")}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice View Dialog */}
      <Dialog open={isInvoiceViewOpen} onOpenChange={setIsInvoiceViewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('invoices.invoiceDetails') || 'Invoice Details'}
            </DialogTitle>
            <DialogDescription>
              {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{t('invoices.invoice') || 'Invoice'} #{selectedInvoice.invoiceNumber}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('common.date') || 'Date'}: {new Date(selectedInvoice.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge 
                  variant="outline"
                  className={`capitalize ${
                    selectedInvoice.status === "paid" ? "bg-green-50 text-green-700 border-green-200" : 
                    "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {selectedInvoice.status}
                </Badge>
              </div>

              {/* Customer Info */}
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-medium mb-2">{t('customers.customer') || 'Customer'}</h4>
                <p className="text-sm">{customer?.fullName}</p>
                <p className="text-sm text-muted-foreground">{customer?.customerCode}</p>
              </div>

              {/* Line Items */}
              <div>
                <h4 className="font-medium mb-3">{t('invoices.lineItems') || 'Items'}</h4>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>{t('common.description') || 'Description'}</TableHead>
                      <TableHead className="text-center">{t('common.quantity') || 'Qty'}</TableHead>
                      <TableHead className="text-right">{t('invoices.unitPrice') || 'Unit Price'}</TableHead>
                      <TableHead className="text-right">{t('common.total') || 'Total'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(typeof selectedInvoice.lineItems === 'string' 
                      ? JSON.parse(selectedInvoice.lineItems) 
                      : selectedInvoice.lineItems || []
                    ).map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">${Number(item.unitPrice).toFixed(2)}</TableCell>
                        <TableCell className="text-right">${Number(item.total).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('invoices.subtotal') || 'Subtotal'}:</span>
                      <span className="font-medium">${selectedInvoice.subtotalUsd}</span>
                    </div>
                    {selectedInvoice.taxUsd && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('invoices.tax') || 'Tax'}:</span>
                        <span className="font-medium">${selectedInvoice.taxUsd}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>{t('common.total') || 'Total'}:</span>
                      <span className="text-primary">${selectedInvoice.totalUsd}</span>
                    </div>
                    {selectedInvoice.totalIqd && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{t('invoices.inIQD') || 'In IQD'}:</span>
                        <span>{Number(selectedInvoice.totalIqd).toLocaleString()} IQD</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="font-medium mb-2">{t('common.notes') || 'Notes'}</h4>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsInvoiceViewOpen(false)}>
              {t('common.close') || 'Close'}
            </Button>
            <Button 
              onClick={() => selectedInvoice && handleDownloadInvoice(selectedInvoice.id)}
              disabled={downloadingInvoiceId === selectedInvoice?.id}
            >
              {downloadingInvoiceId === selectedInvoice?.id ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('common.downloading') || 'Downloading...'}</>
              ) : (
                <><Download className="h-4 w-4 mr-2" />{t('common.downloadPDF') || 'Download PDF'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
