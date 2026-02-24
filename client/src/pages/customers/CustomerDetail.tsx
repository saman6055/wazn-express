import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Crown,
  Edit,
  RotateCcw,
  FileDown,
  Loader2,
  Shield,
  Package,
  Wallet,
  Clock,
  TrendingUp,
  Globe,
  Check,
  Briefcase,
  DollarSign,
  FileText,
  FileCheck,
  Clock as ClockIcon,
  Download,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCustomerDetail } from "@/hooks/useCustomerDetail";
import { CustomerInfoCard } from "@/components/customers/CustomerInfoCard";
import { CustomerPackagesTab } from "@/components/customers/CustomerPackagesTab";
import { CustomerFinanceTab } from "@/components/customers/CustomerFinanceTab";
import { CustomerDocumentsTab } from "@/components/customers/CustomerDocumentsTab";
import { CustomerActivityTab } from "@/components/customers/CustomerActivityTab";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function CustomerDetail() {
  const { t: tToast } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const customerId = parseInt(params.id ?? "0", 10);
  const cd = useCustomerDetail(customerId);
  const {
    customer,
    t,
    balance,
    totalPackages,
    deliveredPackages,
    pendingPackages,
    totalSpent,
    totalWeight,
    averageWeight,
    preferredShippingType,
    preferredShippingCount,
    isVip,
    vipInfo,
    packages,
    ledger,
    invoices,
    activityLogs,
    fullPackageOrders,
    extraServices,
    serviceTypes,
    newService,
    setNewService,
    isAddServiceOpen,
    setIsAddServiceOpen,
    createServiceMutation,
    markAsPaidMutation,
  } = cd;

  const deliveryRatePct = totalPackages > 0 ? Math.round((deliveredPackages / totalPackages) * 100) : 0;

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
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/customers")} className="mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">{customer.fullName}</h1>
              {isVip && (
                <Badge
                  className={`text-xs border-0 ${
                    vipInfo?.tier === "platinum"
                      ? "bg-gradient-to-r from-slate-600 to-slate-800 text-white"
                      : vipInfo?.tier === "gold"
                        ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                        : "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-700"
                  }`}
                >
                  <Crown className="h-3 w-3 me-1" />
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
            <Dialog open={cd.isResetPasswordOpen} onOpenChange={cd.setIsResetPasswordOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 me-2" />
                  Reset Password
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-500" />
                    Reset Customer Password
                  </DialogTitle>
                  <DialogDescription>Set a new password for {customer.fullName}</DialogDescription>
                </DialogHeader>
                <form onSubmit={cd.handleResetPassword}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input id="newPassword" name="newPassword" type="password" required minLength={6} className="h-11" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => cd.setIsResetPasswordOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={cd.resetPasswordMutation.isPending} className="bg-amber-500 hover:bg-amber-600">
                      {cd.resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={cd.handleExportCustomerPDF} disabled={cd.isExportingPDF}>
              {cd.isExportingPDF ? (
                <><Loader2 className="h-4 w-4 me-2 animate-spin" /> Exporting...</>
              ) : (
                <><FileDown className="h-4 w-4 me-2" /> Export PDF</>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={cd.handleOpenEdit}>
              <Edit className="h-4 w-4 me-2" />
              Edit
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <CustomerInfoCard customer={customer as any} t={t} />

          <div className="lg:col-span-2 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.balance")}</p>
                      <p className={`text-2xl font-bold ${(balance ?? 0) > 0 ? "text-red-600" : (balance ?? 0) < 0 ? "text-green-600" : ""}`}>
                        ${Math.abs(balance ?? 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(balance ?? 0) > 0 ? t("customers.inDebt") : (balance ?? 0) < 0 ? t("customers.hasCredit") : t("customers.settled")}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${(balance ?? 0) > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}`}>
                      <Wallet className={`h-5 w-5 ${(balance ?? 0) > 0 ? "text-red-600" : "text-green-600"}`} />
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.totalWeight")}</p>
                      <p className="text-2xl font-bold">{totalWeight.toFixed(2)} kg</p>
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
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.preferredShipping")}</p>
                      <p className="text-2xl font-bold">{preferredShippingType}</p>
                      <p className="text-xs text-muted-foreground">{preferredShippingCount} {t("common.packages")}</p>
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
                      <p className="text-2xl font-bold text-green-600">{deliveryRatePct}%</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Check className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="packages" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="packages" className="gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Packages</span>
                </TabsTrigger>
                <TabsTrigger value="services" className="gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Services</span>
                </TabsTrigger>
                <TabsTrigger value="finance" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Finance</span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-2">
                  <FileCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Documents</span>
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-2">
                  <ClockIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Activity</span>
                </TabsTrigger>
                <TabsTrigger value="fullPackage" className="gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("nav.fullPackage")}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="packages" className="mt-4">
                <CustomerPackagesTab packages={packages as any} customerId={customerId} t={t} />
              </TabsContent>

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
                                  const typeId = parseInt(v, 10);
                                  const selectedType = serviceTypes?.find((st) => st.id === typeId);
                                  setNewService({
                                    ...newService,
                                    serviceTypeId: typeId,
                                    costAmount: selectedType?.defaultCost ?? "",
                                    priceAmount: selectedType?.defaultPrice ?? "",
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
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newService.costAmount}
                                  onChange={(e) => setNewService({ ...newService, costAmount: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>{t("common.price")}</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newService.priceAmount}
                                  onChange={(e) => setNewService({ ...newService, priceAmount: e.target.value })}
                                />
                              </div>
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
                                  toast.error(tToast("toast.fillRequiredFields"));
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
                          const profit = Number(service.priceAmount ?? 0) - Number(service.costAmount ?? 0);
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
                              <TableCell className="max-w-[200px] truncate">{service.description}</TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                ${Number(service.costAmount ?? 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                ${Number(service.priceAmount ?? 0).toFixed(2)}
                              </TableCell>
                              <TableCell className={`text-right font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                ${profit.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {service.isPaid ? (
                                  <Badge className="bg-green-100 text-green-700 border-0 text-xs">Paid</Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() =>
                                      markAsPaidMutation.mutate({
                                        id: service.id,
                                        paymentMethod: "cash",
                                        paidAmount: service.priceAmount ?? "0",
                                      })
                                    }
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
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="finance" className="mt-4">
                <CustomerFinanceTab
                  ledger={ledger as any}
                  invoices={invoices as any}
                  downloadingInvoiceId={cd.downloadingInvoiceId}
                  onViewInvoice={cd.handleViewInvoice}
                  onDownloadInvoice={cd.handleDownloadInvoice}
                  t={t}
                />
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <CustomerDocumentsTab
                  customer={customer as { passportUrl?: string; nationalIdUrl?: string; contractUrl?: string }}
                  uploadingDoc={cd.uploadingDoc}
                  passportInputRef={cd.passportInputRef}
                  nationalIdInputRef={cd.nationalIdInputRef}
                  contractInputRef={cd.contractInputRef}
                  onDocumentUpload={cd.handleDocumentUpload}
                  onDocumentDelete={cd.handleDocumentDelete}
                  t={t}
                />
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <CustomerActivityTab activityLogs={activityLogs as any} t={t} />
              </TabsContent>

              <TabsContent value="fullPackage" className="mt-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{t("nav.fullPackage")}</CardTitle>
                        <CardDescription>{t("fullPackage.allOrders")}</CardDescription>
                      </div>
                      <Badge variant="secondary">{fullPackageOrders?.length ?? 0} {t("common.total")}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {fullPackageOrders && fullPackageOrders.length > 0 ? (
                      <div className="space-y-3">
                        {fullPackageOrders.map((order: any) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => setLocation(`/full-package/${order.id}`)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Package className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{order.orderCode}</p>
                                <p className="text-sm text-muted-foreground">{order.productName ?? t("common.noName")}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={order.status === "delivered" ? "default" : order.status === "pending" ? "secondary" : "outline"}>
                                {order.status}
                              </Badge>
                              <p className="text-sm font-medium mt-1">${Number(order.totalPrice ?? 0).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-muted-foreground">{t("fullPackage.noOrders")}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Edit Customer Dialog - simplified; full form can be in CustomerEditDialog component if needed */}
      <Dialog open={cd.isEditOpen} onOpenChange={cd.setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              {t("customers.editCustomer")}
            </DialogTitle>
            <DialogDescription>{t("customers.editCustomerDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={cd.handleEditSubmit}>
            <div className="grid gap-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-fullName">{t("customers.fullNameEnglish")}</Label>
                  <Input
                    id="edit-fullName"
                    value={cd.editForm.fullName}
                    onChange={(e) => cd.setEditForm({ ...cd.editForm, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-mobileNumber">{t("customers.mobileNotEditable")}</Label>
                  <Input id="edit-mobileNumber" value={cd.editForm.mobileNumber} disabled className="bg-muted" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-email">{t("customers.email")}</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={cd.editForm.email}
                    onChange={(e) => cd.setEditForm({ ...cd.editForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-notes">{t("common.notes")}</Label>
                  <Textarea
                    id="edit-notes"
                    value={cd.editForm.notes}
                    onChange={(e) => cd.setEditForm({ ...cd.editForm, notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-isActive"
                    checked={cd.editForm.isActive}
                    onChange={(e) => cd.setEditForm({ ...cd.editForm, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="edit-isActive" className="cursor-pointer">
                    {t("common.active")}
                  </Label>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => cd.setIsEditOpen(false)}>
                {t("forms.cancel")}
              </Button>
              <Button type="submit" disabled={cd.updateCustomerMutation.isPending}>
                {cd.updateCustomerMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t("messages.saving")}</>
                ) : (
                  <><Check className="h-4 w-4 me-2" />{t("forms.save")}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice View Dialog */}
      <Dialog open={cd.isInvoiceViewOpen} onOpenChange={cd.setIsInvoiceViewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("invoices.invoiceDetails") ?? "Invoice Details"}
            </DialogTitle>
            <DialogDescription>
              {(cd.selectedInvoice as { invoiceNumber?: string })?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          {!!cd.selectedInvoice && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">
                    {t("invoices.invoice") ?? "Invoice"} #{(cd.selectedInvoice as { invoiceNumber?: string }).invoiceNumber}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("common.date")}: {new Date((cd.selectedInvoice as { createdAt?: string }).createdAt ?? "").toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {(cd.selectedInvoice as { status?: string }).status}
                </Badge>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-medium mb-2">{t("customers.customer") ?? "Customer"}</h4>
                <p className="text-sm">{customer.fullName}</p>
                <p className="text-sm text-muted-foreground">{customer.customerCode}</p>
              </div>
              <Separator />
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t("common.total")}:</span>
                    <span className="text-primary">${(cd.selectedInvoice as { totalUsd?: string }).totalUsd}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => cd.setIsInvoiceViewOpen(false)}>
              {t("common.close") ?? "Close"}
            </Button>
            <Button
              onClick={() => cd.selectedInvoice && cd.handleDownloadInvoice((cd.selectedInvoice as { id: number }).id)}
              disabled={cd.downloadingInvoiceId === (cd.selectedInvoice as { id?: number })?.id}
            >
              {cd.downloadingInvoiceId === (cd.selectedInvoice as { id?: number })?.id ? (
                <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t("common.downloading") ?? "Downloading..."}</>
              ) : (
                <><Download className="h-4 w-4 me-2" />{t("common.downloadPDF") ?? "Download PDF"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
