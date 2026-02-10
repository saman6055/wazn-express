import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { Plus, Edit, Trash2, Sparkles, Settings2, DollarSign } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

// Service type emoji icons
const EMOJI_OPTIONS = [
  "💱", "💵", "🛒", "📦", "🛡️", "🏭", "📋", "🚚", "⚙️", "💳",
  "🏦", "💰", "🔄", "📊", "🎁", "✈️", "🚢", "📱", "🛍️", "🧾",
  "💎", "🔧", "📞", "🏪"
];

// Color palette for service types
const COLOR_OPTIONS = [
  "#EF4444", "#22C55E", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899",
  "#6366F1", "#14B8A6", "#F97316", "#64748B", "#84CC16", "#06B6D4",
  "#D946EF", "#10B981", "#F472B6", "#94A3B8"
];

export default function ServiceTypes() {
    const { t } = useTranslation();
const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [selectedIcon, setSelectedIcon] = useState("⚙️");
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  
  const { data: serviceTypes, refetch } = trpc.extraServices.getServiceTypes.useQuery();
  
  const createMutation = trpc.extraServices.createServiceType.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_0304b6"));
      setIsCreateOpen(false);
      setSelectedIcon("⚙️");
      setSelectedColor("#3B82F6");
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const updateMutation = trpc.extraServices.updateServiceType.useMutation({
    onSuccess: () => {
      toast.success(t("messages.serviceTypeUpdated"));
      setIsEditOpen(false);
      setEditingType(null);
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const deleteMutation = trpc.extraServices.deleteServiceType.useMutation({
    onSuccess: () => {
      toast.success(t("messages.serviceTypeDeleted"));
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    createMutation.mutate({
      nameEn: formData.get("nameEn") as string,
      nameKu: formData.get("nameKu") as string || undefined,
      nameAr: formData.get("nameAr") as string || undefined,
      icon: selectedIcon,
      color: selectedColor,
      defaultCost: formData.get("defaultCost") as string || undefined,
      defaultPrice: formData.get("defaultPrice") as string || undefined,
      requiresCustomer: (formData.get("requiresCustomer") as string) === "on",
      addToCustomerBalance: (formData.get("addToCustomerBalance") as string) === "on",
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    });
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingType) return;
    
    const formData = new FormData(e.currentTarget);
    
    updateMutation.mutate({
      id: editingType.id,
      nameEn: formData.get("nameEn") as string || undefined,
      nameKu: formData.get("nameKu") as string || undefined,
      nameAr: formData.get("nameAr") as string || undefined,
      icon: selectedIcon,
      color: selectedColor,
      defaultCost: formData.get("defaultCost") as string || undefined,
      defaultPrice: formData.get("defaultPrice") as string || undefined,
      requiresCustomer: (formData.get("requiresCustomer") as string) === "on",
      addToCustomerBalance: (formData.get("addToCustomerBalance") as string) === "on",
      sortOrder: parseInt(formData.get("sortOrder") as string) || undefined,
    });
  };

  const openEditDialog = (type: any) => {
    setEditingType(type);
    setSelectedIcon(type.icon || "⚙️");
    setSelectedColor(type.color || "#3B82F6");
    setIsEditOpen(true);
  };

  const toggleActive = (type: any) => {
    updateMutation.mutate({
      id: type.id,
      isActive: !type.isActive,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm(t("auto.text_3b03c1") + "؟")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("auto.text_2363fb")} </h1>
            <p className="text-muted-foreground">{t("auto.text_1427de")} </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />{t("auto.text_1092e1")} </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("auto.text_e7492f")} </DialogTitle>
                  <DialogDescription>{t("auto.text_b53bf0")} </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate}>
                  <div className="grid gap-4 py-4">
                    {/* Icon Selection */}
                    <div className="grid gap-2">
                      <Label>{t("auto.text_5617e3")} </Label>
                      <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setSelectedIcon(emoji)}
                            className={`w-10 h-10 text-xl rounded-lg flex items-center justify-center transition-all ${
                              selectedIcon === emoji 
                                ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" 
                                : "bg-background hover:bg-muted"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color Selection */}
                    <div className="grid gap-2">
                      <Label>{t("fullPackage.color")}</Label>
                      <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setSelectedColor(color)}
                            className={`w-8 h-8 rounded-full transition-all ${
                              selectedColor === color 
                                ? "ring-2 ring-primary ring-offset-2 scale-110" 
                                : "hover:scale-105"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${selectedColor}20`, color: selectedColor }}
                      >
                        {selectedIcon}
                      </div>
                      <div>
                        <p className="font-medium">{t("auto.text_534d72")} </p>
                        <p className="text-sm text-muted-foreground">{t("auto.text_975c36")} </p>
                      </div>
                    </div>

                    {/* Names */}
                    <div className="grid gap-2">
                      <Label htmlFor="nameEn">{t("auto.text_d183f3")} </Label>
                      <Input id="nameEn" name="nameEn" required placeholder="e.g., RMB Transfer" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="nameKu">{t("auto.text_fc34e4")} </Label>
                        <Input id="nameKu" name="nameKu" placeholder={t("auto.text_5761b8")} dir="rtl" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="nameAr">{t("auto.text_038bb2")} </Label>
                        <Input id="nameAr" name="nameAr" placeholder={t("auto.text_05b7a8")} dir="rtl" />
                      </div>
                    </div>

                    {/* Default Pricing */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="defaultCost">{t("auto.text_ded323")} </Label>
                        <Input 
                          id="defaultCost" 
                          name="defaultCost" 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="defaultPrice">{t("auto.text_179e8b")} </Label>
                        <Input 
                          id="defaultPrice" 
                          name="defaultPrice" 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                        />
                      </div>
                    </div>

                    {/* Settings */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox id="requiresCustomer" name="requiresCustomer" defaultChecked />
                        <Label htmlFor="requiresCustomer" className="text-sm">{t("auto.text_4e52ff")} </Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox id="addToCustomerBalance" name="addToCustomerBalance" defaultChecked />
                        <Label htmlFor="addToCustomerBalance" className="text-sm">{t("auto.text_f55ce4")} </Label>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="sortOrder">{t("auto.text_6ac1b0")} </Label>
                      <Input id="sortOrder" name="sortOrder" type="number" defaultValue="0" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>{t("common.cancel")}</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? t("auto.text_d46bdf") : t("common.create")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Service Type Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {serviceTypes?.map((type) => (
            <Card key={type.id} className={`relative ${!type.isActive ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                    style={{ 
                      backgroundColor: `${type.color || "#3B82F6"}20`, 
                      color: type.color || "#3B82F6" 
                    }}
                  >
                    {type.icon || "⚙️"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={type.isActive}
                      onCheckedChange={() => toggleActive(type)}
                    />
                  </div>
                </div>
                <CardTitle className="text-lg mt-3">{type.nameEn}</CardTitle>
                <CardDescription className="flex flex-col gap-1">
                  {type.nameKu && <span dir="rtl">{type.nameKu}</span>}
                  {type.nameAr && <span dir="rtl">{type.nameAr}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Default Pricing */}
                  {(type.defaultCost || type.defaultPrice) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span>
                        {t("auto.text_080d04")}: ${Number(type.defaultCost || 0).toFixed(2)} | 
                        {t("auto.text_e07975")}: ${Number(type.defaultPrice || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  {/* Settings badges */}
                  <div className="flex flex-wrap gap-1">
                    {type.requiresCustomer && (
                      <Badge variant="secondary" className="text-xs">{t("auto.text_4b3bba")} </Badge>
                    )}
                    {type.addToCustomerBalance && (
                      <Badge variant="secondary" className="text-xs">{t("auto.text_090031")} </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Badge variant="outline">ڕ{t("auto.text_97a05e")}: {type.sortOrder}</Badge>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(type)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(type.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!serviceTypes || serviceTypes.length === 0) && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">{t("auto.text_8bb5ca")} </p>
                <p className="text-muted-foreground mb-4">{t("auto.text_1a5aad")} </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingType(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("auto.text_dc4fdf")} </DialogTitle>
              <DialogDescription>{t("auto.text_365435")} </DialogDescription>
            </DialogHeader>
            {editingType && (
              <form onSubmit={handleEdit}>
                <div className="grid gap-4 py-4">
                  {/* Icon Selection */}
                  <div className="grid gap-2">
                    <Label>{t("auto.text_5617e3")} </Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setSelectedIcon(emoji)}
                          className={`w-10 h-10 text-xl rounded-lg flex items-center justify-center transition-all ${
                            selectedIcon === emoji 
                              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" 
                              : "bg-background hover:bg-muted"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Selection */}
                  <div className="grid gap-2">
                    <Label>{t("fullPackage.color")}</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`w-8 h-8 rounded-full transition-all ${
                            selectedColor === color 
                              ? "ring-2 ring-primary ring-offset-2 scale-110" 
                              : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${selectedColor}20`, color: selectedColor }}
                    >
                      {selectedIcon}
                    </div>
                    <div>
                      <p className="font-medium">{t("auto.text_534d72")} </p>
                      <p className="text-sm text-muted-foreground">{t("auto.text_975c36")} </p>
                    </div>
                  </div>

                  {/* Names */}
                  <div className="grid gap-2">
                    <Label htmlFor="edit-nameEn">{t("auto.text_d183f3")} </Label>
                    <Input 
                      id="edit-nameEn" 
                      name="nameEn" 
                      required 
                      defaultValue={editingType.nameEn}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-nameKu">{t("auto.text_fc34e4")} </Label>
                      <Input 
                        id="edit-nameKu" 
                        name="nameKu" 
                        defaultValue={editingType.nameKu || ""}
                        dir="rtl" 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-nameAr">{t("auto.text_038bb2")} </Label>
                      <Input 
                        id="edit-nameAr" 
                        name="nameAr" 
                        defaultValue={editingType.nameAr || ""}
                        dir="rtl" 
                      />
                    </div>
                  </div>

                  {/* Default Pricing */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-defaultCost">{t("auto.text_ded323")} </Label>
                      <Input 
                        id="edit-defaultCost" 
                        name="defaultCost" 
                        type="number" 
                        step="0.01"
                        defaultValue={editingType.defaultCost || ""}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-defaultPrice">{t("auto.text_179e8b")} </Label>
                      <Input 
                        id="edit-defaultPrice" 
                        name="defaultPrice" 
                        type="number" 
                        step="0.01"
                        defaultValue={editingType.defaultPrice || ""}
                      />
                    </div>
                  </div>

                  {/* Settings */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox 
                        id="edit-requiresCustomer" 
                        name="requiresCustomer" 
                        defaultChecked={editingType.requiresCustomer} 
                      />
                      <Label htmlFor="edit-requiresCustomer" className="text-sm">{t("auto.text_4e52ff")} </Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox 
                        id="edit-addToCustomerBalance" 
                        name="addToCustomerBalance" 
                        defaultChecked={editingType.addToCustomerBalance} 
                      />
                      <Label htmlFor="edit-addToCustomerBalance" className="text-sm">{t("auto.text_f55ce4")} </Label>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-sortOrder">{t("auto.text_6ac1b0")} </Label>
                    <Input 
                      id="edit-sortOrder" 
                      name="sortOrder" 
                      type="number" 
                      defaultValue={editingType.sortOrder}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>{t("common.cancel")}</Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? t("auto.text_bd4492") : t("common.save")}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
