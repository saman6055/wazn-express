import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { 
  Plus, Search, Store, Phone, Mail, MessageCircle, Star, Package,
  Edit, Trash2, MoreHorizontal, ExternalLink, Building2, Globe,
  TrendingUp, DollarSign, ShoppingBag
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const platformConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  "1688": { color: "text-orange-700 dark:text-orange-300", bgColor: "bg-orange-100 dark:bg-orange-950/40", label: "1688" },
  "taobao": { color: "text-red-700 dark:text-red-300", bgColor: "bg-red-100 dark:bg-red-950/40", label: "Taobao" },
  "alibaba": { color: "text-amber-700 dark:text-amber-300", bgColor: "bg-amber-100 dark:bg-amber-950/40", label: "Alibaba" },
  "pinduoduo": { color: "text-rose-700 dark:text-rose-300", bgColor: "bg-rose-100 dark:bg-rose-950/40", label: "Pinduoduo" },
  "other": { color: "text-slate-700 dark:text-slate-300", bgColor: "bg-slate-100 dark:bg-slate-950/40", label: "Other" },
};

export default function Suppliers() {
    const { t } = useTranslation();
const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    nameArabic: "",
    nameChinese: "",
    platform: "",
    contactPerson: "",
    phone: "",
    wechatId: "",
    email: "",
    website: "",
    address: "",
    rating: "5",
    notes: "",
    isActive: true,
  });

  // Queries
  const { data: suppliers, refetch, isLoading } = trpc.suppliers.list.useQuery();
  // Calculate stats from suppliers list
  const supplierStats = useMemo(() => {
    if (!suppliers) return null;
    const active = suppliers.filter(s => s.isActive).length;
    const totalRating = suppliers.reduce((sum, s) => sum + Number(s.rating || 5), 0);
    return {
      total: suppliers.length,
      active,
      totalOrders: 0, // Would need to join with orders
      avgRating: suppliers.length > 0 ? totalRating / suppliers.length : 5,
    };
  }, [suppliers]);

  // Mutations
  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_ff1315"));
      refetch();
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.suppliers.update.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_9b2294"));
      refetch();
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.suppliers.delete.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_ef5d01"));
      refetch();
      setDeleteId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormData({
      name: "",
      nameArabic: "",
      nameChinese: "",
      platform: "",
      contactPerson: "",
      phone: "",
      wechatId: "",
      email: "",
      website: "",
      address: "",
      rating: "5",
      notes: "",
      isActive: true,
    });
    setEditingSupplier(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || "",
      nameArabic: supplier.nameArabic || "",
      nameChinese: supplier.nameChinese || "",
      platform: supplier.platform || "",
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone || "",
      wechatId: supplier.wechatId || "",
      email: supplier.email || "",
      website: supplier.website || "",
      address: supplier.address || "",
      rating: supplier.rating?.toString() || "5",
      notes: supplier.notes || "",
      isActive: supplier.isActive ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error(t("auto.text_3cc8a4"));
      return;
    }

    const data = {
      name: formData.name,
      nameArabic: formData.nameArabic || undefined,
      nameChinese: formData.nameChinese || undefined,
      platform: (formData.platform || undefined) as "1688" | "taobao" | "alibaba" | "pinduoduo" | "other" | undefined,
      contactPerson: formData.contactPerson || undefined,
      phone: formData.phone || undefined,
      wechatId: formData.wechatId || undefined,
      email: formData.email || undefined,
      website: formData.website || undefined,
      address: formData.address || undefined,
      rating: formData.rating || "5",
      notes: formData.notes || undefined,
      isActive: formData.isActive,
    };

    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Filter suppliers
  const filteredSuppliers = useMemo(() => {
    let result = suppliers || [];
    
    if (platformFilter !== "all") {
      result = result.filter(s => s.platform === platformFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.nameArabic?.toLowerCase().includes(query) ||
        s.nameChinese?.toLowerCase().includes(query) ||
        s.contactPerson?.toLowerCase().includes(query) ||
        s.wechatId?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [suppliers, platformFilter, searchQuery]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              {t("auto.text_23cda1")} - Suppliers
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("auto.text_77e98a")} (1688, Taobao, Alibaba)
            </p>
          </div>
          <Button 
            onClick={handleOpenCreate}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
          >
            <Plus className="h-4 w-4 me-2" />
            {t("auto.text_dd2856")}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 dark:border-orange-800/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-600 font-medium">{t("auto.text_623214")} </p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{supplierStats?.total || suppliers?.length || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-200 flex items-center justify-center">
                  <Store className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 dark:border-green-800/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium">{t("common.active")}</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{supplierStats?.active || suppliers?.filter(s => s.isActive).length || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 dark:border-blue-800/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">{t("auto.text_269691")} </p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{supplierStats?.totalOrders || 0}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 dark:border-amber-800/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">{t("auto.text_17eb70")} </p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                    {supplierStats?.avgRating?.toFixed(1) || "5.0"}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-200 flex items-center justify-center">
                  <Star className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("auto.text_eed4ab")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("auto.text_c3a2e9")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("auto.text_0b6d35")} </SelectItem>
                  <SelectItem value="1688">1688</SelectItem>
                  <SelectItem value="taobao">Taobao</SelectItem>
                  <SelectItem value="alibaba">Alibaba</SelectItem>
                  <SelectItem value="pinduoduo">Pinduoduo</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Suppliers Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                <p className="text-muted-foreground mt-2">{t("common.loading")}</p>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t("auto.text_5203e4")} </p>
                <Button className="mt-4" onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 me-2" />
                  {t("auto.text_5641c0")}
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead>{t("auto.text_c3a2e9")} </TableHead>
                    <TableHead>{t("auto.text_b7c6bf")} </TableHead>
                    <TableHead>WeChat</TableHead>
                    <TableHead>{t("auto.text_945320")} </TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead className="text-left">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{supplier.name}</p>
                          {supplier.nameArabic && (
                            <p className="text-sm text-muted-foreground">{supplier.nameArabic}</p>
                          )}
                          {supplier.nameChinese && (
                            <p className="text-sm text-muted-foreground" dir="ltr">{supplier.nameChinese}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {supplier.platform && platformConfig[supplier.platform] ? (
                          <Badge className={`${platformConfig[supplier.platform].bgColor} ${platformConfig[supplier.platform].color}`}>
                            {platformConfig[supplier.platform].label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {supplier.contactPerson && (
                            <p className="text-sm">{supplier.contactPerson}</p>
                          )}
                          {supplier.phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {supplier.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {supplier.wechatId ? (
                          <span className="text-sm font-mono bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                            {supplier.wechatId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < Number(supplier.rating || 5)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={supplier.isActive ? "default" : "secondary"}>
                          {supplier.isActive ? t("status.active") : t("status.inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(supplier)}>
                              <Edit className="h-4 w-4 me-2" />{t("common.edit")}</DropdownMenuItem>
                            {(supplier as any).website && (
                              <DropdownMenuItem onClick={() => window.open((supplier as any).website, "_blank")}>
                                <ExternalLink className="h-4 w-4 me-2" />
                                {t("auto.text_6f00ef")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => setDeleteId(supplier.id)}
                            >
                              <Trash2 className="h-4 w-4 me-2" />{t("common.delete")}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {editingSupplier ? t("auto.text_b37162") : t("common.add")}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier ? t("auto.text_19d86a") : t("common.addNew")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">{t("auto.text_5fd765")} </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("auto.text_644795")} </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Supplier name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nameArabic">{t("auto.text_8651b8")} </Label>
                  <Input
                    id="nameArabic"
                    value={formData.nameArabic}
                    onChange={(e) => setFormData(prev => ({ ...prev, nameArabic: e.target.value }))}
                    placeholder={t("auto.text_482021")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nameChinese">{t("auto.text_9f6278")} </Label>
                  <Input
                    id="nameChinese"
                    value={formData.nameChinese}
                    onChange={(e) => setFormData(prev => ({ ...prev, nameChinese: e.target.value }))}
                    placeholder="供应商名称"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="platform">{t("auto.text_c3a2e9")} </Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, platform: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("auto.text_5c0809")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1688">1688</SelectItem>
                      <SelectItem value="taobao">Taobao</SelectItem>
                      <SelectItem value="alibaba">Alibaba</SelectItem>
                      <SelectItem value="pinduoduo">Pinduoduo</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rating">{t("auto.text_945320")} </Label>
                  <Select
                    value={formData.rating}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, rating: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 4, 3, 2, 1].map(r => (
                        <SelectItem key={r} value={r.toString()}>
                          <div className="flex items-center gap-1">
                            {[...Array(r)].map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                            ))}
                            <span className="ms-2">{r} {t("auto.text_da39b2")}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium text-sm text-muted-foreground">{t("auto.text_bcb14e")} </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">{t("auto.text_9511a4")} </Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                    placeholder="Contact person name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("customers.phone")}</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+86..."
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wechatId" className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4 text-green-600" />
                    WeChat ID
                  </Label>
                  <Input
                    id="wechatId"
                    value={formData.wechatId}
                    onChange={(e) => setFormData(prev => ({ ...prev, wechatId: e.target.value }))}
                    placeholder="WeChat ID"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {t("auto.text_e6914e")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  {t("auto.text_5b567a")}
                </Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://..."
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />{t("customers.address")}</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder={t("auto.text_091aac")}
                />
              </div>
            </div>

            {/* Notes & Status */}
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="notes">{t("common.notes")}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={t("auto.text_3557db")}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("common.status")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("auto.text_02caca")}؟
                  </p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("auto.text_e4b28f") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("auto.text_9afda5")} </AlertDialogTitle>
            <AlertDialogDescription>
              {t("auto.text_69f2a5")}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
