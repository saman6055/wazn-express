import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Percent, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function TaxRatesManagement() {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTaxRate, setSelectedTaxRate] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    rate: "",
    description: "",
    isDefault: false,
    isActive: true,
  });

  // Queries
  const { data: taxRates, refetch } = trpc.advancedSettings.getAllTaxRates.useQuery();

  // Mutations
  const createMutation = trpc.advancedSettings.createTaxRate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.taxRateAdded"));
      refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.advancedSettings.updateTaxRate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.taxRateUpdated"));
      refetch();
      setIsEditDialogOpen(false);
      setSelectedTaxRate(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.advancedSettings.deleteTaxRate.useMutation({
    onSuccess: () => {
      toast.success(t("toast.taxRateDeleted"));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      rate: "",
      description: "",
      isDefault: false,
      isActive: true,
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleEdit = (taxRate: any) => {
    setSelectedTaxRate(taxRate);
    setFormData({
      name: taxRate.name,
      rate: taxRate.rate,
      description: taxRate.description || "",
      isDefault: taxRate.isDefault,
      isActive: taxRate.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTaxRate) return;
    updateMutation.mutate({
      id: selectedTaxRate.id,
      name: formData.name,
      rate: formData.rate,
      description: formData.description,
      isDefault: formData.isDefault,
      isActive: formData.isActive,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("ئایا دڵنیایت لە سڕینەوەی ئەم نرخی باجە؟")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Percent className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">بەڕێوەبردنی نرخی باج</CardTitle>
                <CardDescription>
                  بەڕێوەبردنی نرخەکانی باج و VAT
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 ms-2" />
              نرخی نوێ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ناو</TableHead>
                <TableHead>نرخ (%)</TableHead>
                <TableHead>وەسف</TableHead>
                <TableHead>دۆخ</TableHead>
                <TableHead>کردارەکان</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxRates?.map((taxRate) => (
                <TableRow key={taxRate.id}>
                  <TableCell className="font-semibold">
                    {taxRate.name}
                    {taxRate.isDefault && (
                      <Star className="inline h-4 w-4 me-1 text-yellow-500 fill-yellow-500" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-lg">{taxRate.rate}%</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {taxRate.description || "-"}
                  </TableCell>
                  <TableCell>
                    {taxRate.isActive ? (
                      <Badge variant="default">چالاک</Badge>
                    ) : (
                      <Badge variant="secondary">ناچالاک</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(taxRate)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(taxRate.id)}
                        disabled={taxRate.isDefault}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!taxRates || taxRates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              هیچ نرخی باجێک نییە
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>نرخی باجی نوێ زیاد بکە</DialogTitle>
            <DialogDescription>
              زانیاریەکانی نرخی باجە نوێیەکە پڕ بکەرەوە
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">ناوی نرخی باج</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="VAT, Sales Tax, etc."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate">نرخ (%)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                placeholder="15.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">وەسف (ئیختیاری)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="وەسفی نرخی باجەکە..."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isDefault">نرخی بنەڕەت</Label>
              <Switch
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isDefault: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">چالاک</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              پاشگەزبوونەوە
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "چاوەڕێ بە..." : "زیادکردن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>دەستکاری نرخی باج</DialogTitle>
            <DialogDescription>
              زانیاریەکانی نرخی باجەکە نوێ بکەرەوە
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">ناوی نرخی باج</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-rate">نرخ (%)</Label>
              <Input
                id="edit-rate"
                type="number"
                step="0.01"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">وەسف (ئیختیاری)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isDefault">نرخی بنەڕەت</Label>
              <Switch
                id="edit-isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isDefault: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isActive">چالاک</Label>
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              پاشگەزبوونەوە
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "چاوەڕێ بە..." : "نوێکردنەوە"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
