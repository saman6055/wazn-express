import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { IRAQI_GOVERNORATES, IRAQI_CITIES } from "../../../shared/iraqi-cities";

const defaultEditForm = {
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
};

const defaultNewService = {
  serviceTypeId: 0,
  description: "",
  costAmount: "",
  priceAmount: "",
  currency: "USD" as "USD" | "IQD" | "CNY",
  notes: "",
  addToBalance: true,
};

export function useCustomerDetail(customerId: number) {
  const { t } = useTranslation();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedGovernorate, setSelectedGovernorate] = useState("");
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<unknown>(null);
  const [isInvoiceViewOpen, setIsInvoiceViewOpen] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(defaultEditForm);
  const [newService, setNewService] = useState(defaultNewService);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);

  const passportInputRef = useRef<HTMLInputElement>(null);
  const nationalIdInputRef = useRef<HTMLInputElement>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);

  const { data: customer, refetch } = trpc.customers.getById.useQuery({ id: customerId });
  const { data: balance } = trpc.customers.getBalance.useQuery({ customerId });
  const { data: ledger } = trpc.customers.getLedger.useQuery({ customerId });
  const { data: packages } = trpc.packages.getByCustomer.useQuery({ customerId });
  const { data: invoices } = trpc.invoices.getByCustomer.useQuery({ customerId });
  const { data: vipCustomers } = trpc.vip.list.useQuery();
  const { data: activityLogs } = trpc.auditLogs.getByCustomer.useQuery({ customerId });
  const { data: fullPackageOrders } = trpc.fullPackage.list.useQuery({ customerId });
  const { data: extraServices, refetch: refetchServices } = trpc.extraServices.getByCustomer.useQuery({ customerId });
  const { data: serviceTypes } = trpc.extraServices.getActiveServiceTypes.useQuery();

  const exportCustomerPDF = trpc.dashboard.exportCustomerPDF.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t("messages.customerReportDownloaded"));
      setIsExportingPDF(false);
    },
    onError: (error) => {
      toast.error(t("common.error") + ": " + error.message);
      setIsExportingPDF(false);
    },
  });

  const uploadDocumentMutation = trpc.customers.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success(t("messages.documentUploaded"));
      setUploadingDoc(null);
      refetch();
    },
    onError: (error) => {
      toast.error(t("common.error") + ": " + error.message);
      setUploadingDoc(null);
    },
  });

  const deleteDocumentMutation = trpc.customers.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success(t("messages.documentDeleted"));
      refetch();
    },
    onError: (error) => {
      toast.error(t("common.error") + ": " + error.message);
    },
  });

  const resetPasswordMutation = trpc.customers.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset successfully");
      setIsResetPasswordOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const downloadInvoicePDF = trpc.invoices.generatePDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      toast.success(t("messages.invoiceDownloaded") ?? "Invoice downloaded successfully");
      setDownloadingInvoiceId(null);
    },
    onError: (error) => {
      toast.error(t("common.error") + ": " + error.message);
      setDownloadingInvoiceId(null);
    },
  });

  const updateCustomerMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success(t("messages.customerInfoUpdated"));
      setIsEditOpen(false);
      refetch();
    },
    onError: (error) => toast.error(t("common.error") + ": " + error.message),
  });

  const createServiceMutation = trpc.extraServices.create.useMutation({
    onSuccess: () => {
      toast.success("Service added successfully");
      setIsAddServiceOpen(false);
      setNewService(defaultNewService);
      refetchServices();
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const markAsPaidMutation = trpc.extraServices.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Service marked as paid");
      refetchServices();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleExportCustomerPDF = () => {
    setIsExportingPDF(true);
    exportCustomerPDF.mutate({ customerId });
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: "passport" | "nationalId" | "contract") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("common.fileTooLarge"));
      return;
    }
    setUploadingDoc(docType);
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
    e.target.value = "";
  };

  const handleDocumentDelete = (docType: "passport" | "nationalId" | "contract") => {
    if (window.confirm(t("customers.confirmDeleteDocument"))) {
      deleteDocumentMutation.mutate({ customerId, documentType: docType });
    }
  };

  const handleDownloadInvoice = (invoiceId: number) => {
    setDownloadingInvoiceId(invoiceId);
    downloadInvoicePDF.mutate({ id: invoiceId });
  };

  const handleViewInvoice = (invoice: unknown) => {
    setSelectedInvoice(invoice);
    setIsInvoiceViewOpen(true);
  };

  const handleOpenEdit = () => {
    if (customer) {
      setEditForm({
        customerCode: customer.customerCode ?? "",
        fullName: customer.fullName ?? "",
        fullNameArabic: (customer as { fullNameArabic?: string }).fullNameArabic ?? "",
        fullNameKurdish: (customer as { fullNameKurdish?: string }).fullNameKurdish ?? "",
        gender: ((customer as { gender?: string }).gender ?? "") as "" | "male" | "female",
        nationality: (customer as { nationality?: string }).nationality ?? "",
        businessType: (customer as { businessType?: string }).businessType ?? "",
        mobileNumber: customer.mobileNumber ?? "",
        secondaryMobile: (customer as { secondaryMobile?: string }).secondaryMobile ?? "",
        email: customer.email ?? "",
        country: customer.country ?? "",
        city: customer.city ?? "",
        district: (customer as { district?: string }).district ?? "",
        address: customer.address ?? "",
        notes: customer.notes ?? "",
        isActive: customer.isActive ?? true,
      });
      const gov = IRAQI_GOVERNORATES.find((g) => g.nameEn === customer.country || g.nameAr === customer.country);
      if (gov) setSelectedGovernorate(gov.id);
    }
    setIsEditOpen(true);
  };

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

  const handleResetPassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    resetPasswordMutation.mutate({
      id: customerId,
      newPassword: formData.get("newPassword") as string,
    });
  };

  const isVip = vipCustomers?.some((v) => v.customerId === customerId);
  const vipInfo = vipCustomers?.find((v) => v.customerId === customerId);

  const totalPackages = packages?.length ?? 0;
  const deliveredPackages = packages?.filter((p) => p.status === "delivered").length ?? 0;
  const pendingPackages = packages?.filter((p) => !["delivered", "cancelled"].includes(p.status)).length ?? 0;
  const totalSpent = packages?.reduce((sum, p) => sum + parseFloat(p.calculatedCostUsd ?? "0"), 0) ?? 0;
  const totalWeight = packages?.reduce((sum, p) => sum + parseFloat(p.weightKg ?? "0"), 0) ?? 0;
  const averageWeight = totalPackages > 0 ? totalWeight / totalPackages : 0;
  const shippingTypeCounts =
    packages?.reduce((acc, p) => {
      acc[p.shippingType] = (acc[p.shippingType] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>) ?? {};
  const preferredShippingType =
    Object.entries(shippingTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
  const preferredShippingCount = Object.entries(shippingTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[1] ?? 0;

  const filteredCities = selectedGovernorate
    ? IRAQI_CITIES.filter((c) => c.governorateId === selectedGovernorate)
    : IRAQI_CITIES;

  return {
    t,
    customer,
    balance,
    ledger,
    packages,
    invoices,
    vipCustomers,
    activityLogs,
    fullPackageOrders,
    extraServices,
    serviceTypes,
    refetch,
    refetchServices,
    isEditOpen,
    setIsEditOpen,
    isResetPasswordOpen,
    setIsResetPasswordOpen,
    selectedGovernorate,
    setSelectedGovernorate,
    isExportingPDF,
    uploadingDoc,
    selectedInvoice,
    isInvoiceViewOpen,
    setIsInvoiceViewOpen,
    downloadingInvoiceId,
    editForm,
    setEditForm,
    newService,
    setNewService,
    isAddServiceOpen,
    setIsAddServiceOpen,
    passportInputRef,
    nationalIdInputRef,
    contractInputRef,
    exportCustomerPDF,
    uploadDocumentMutation,
    deleteDocumentMutation,
    resetPasswordMutation,
    downloadInvoicePDF,
    updateCustomerMutation,
    createServiceMutation,
    markAsPaidMutation,
    handleExportCustomerPDF,
    handleDocumentUpload,
    handleDocumentDelete,
    handleOpenEdit,
    handleEditSubmit,
    handleResetPassword,
    handleDownloadInvoice,
    handleViewInvoice,
    isVip,
    vipInfo,
    totalPackages,
    deliveredPackages,
    pendingPackages,
    totalSpent,
    totalWeight,
    averageWeight,
    preferredShippingType,
    preferredShippingCount,
    filteredCities,
    IRAQI_GOVERNORATES,
  };
}
