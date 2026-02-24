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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

export default function CurrencyManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    symbol: "",
    exchangeRate: "",
    isBaseCurrency: false,
    isActive: true,
  });

  // Queries
  const { data: currencies, refetch } = trpc.advancedSettings.getAllCurrencies.useQuery();

  // Mutations
  const createMutation = trpc.advancedSettings.createCurrency.useMutation({
    onSuccess: () => {
      toast.success("دراوە زیادکرا");
      refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.advancedSettings.updateCurrency.useMutation({
    onSuccess: () => {
      toast.success("دراوە نوێکرایەوە");
      refetch();
      setIsEditDialogOpen(false);
      setSelectedCurrency(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.advancedSettings.deleteCurrency.useMutation({
    onSuccess: () => {
      toast.success("دراوە سڕایەوە");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      symbol: "",
      exchangeRate: "",
      isBaseCurrency: false,
      isActive: true,
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleEdit = (currency: any) => {
    setSelectedCurrency(currency);
    setFormData({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      exchangeRate: currency.exchangeRate,
      isBaseCurrency: currency.isBaseCurrency,
      isActive: currency.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedCurrency) return;
    updateMutation.mutate({
      id: selectedCurrency.id,
      name: formData.name,
      symbol: formData.symbol,
      exchangeRate: formData.exchangeRate,
      isBaseCurrency: formData.isBaseCurrency,
      isActive: formData.isActive,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("ئایا دڵنیایت لە سڕینەوەی ئەم دراوە؟")) {
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
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">بەڕێوەبردنی دراو</CardTitle>
                <CardDescription>
                  بەڕێوەبردنی دراوەکان و نرخی ئاڵووگۆڕ
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 ms-2" />
              دراوی نوێ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>کۆد</TableHead>
                <TableHead>ناو</TableHead>
                <TableHead>هێما</TableHead>
                <TableHead>نرخی ئاڵووگۆڕ</TableHead>
                <TableHead>دۆخ</TableHead>
                <TableHead>کردارەکان</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies?.map((currency) => (
                <TableRow key={currency.id}>
                  <TableCell className="font-mono font-semibold">
                    {currency.code}
                    {currency.isBaseCurrency && (
                      <Star className="inline h-4 w-4 me-1 text-yellow-500 fill-yellow-500" />
                    )}
                  </TableCell>
                  <TableCell>{currency.name}</TableCell>
                  <TableCell className="text-lg">{currency.symbol}</TableCell>
                  <TableCell className="font-mono">{currency.exchangeRate}</TableCell>
                  <TableCell>
                    {currency.isActive ? (
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
                        onClick={() => handleEdit(currency)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(currency.id)}
                        disabled={currency.isBaseCurrency}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!currencies || currencies.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              هیچ دراوێک نییە
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>دراوی نوێ زیاد بکە</DialogTitle>
            <DialogDescription>
              زانیاریەکانی دراوە نوێیەکە پڕ بکەرەوە
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">کۆدی دراو (USD, EUR, IQD)</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="USD"
                maxLength={10}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">ناوی دراو</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="US Dollar"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="symbol">هێما</Label>
              <Input
                id="symbol"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                placeholder="$"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exchangeRate">نرخی ئاڵووگۆڕ</Label>
              <Input
                id="exchangeRate"
                type="number"
                step="0.000001"
                value={formData.exchangeRate}
                onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
                placeholder="1.0"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isBaseCurrency">دراوی بنەڕەت</Label>
              <Switch
                id="isBaseCurrency"
                checked={formData.isBaseCurrency}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isBaseCurrency: checked })
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
            <DialogTitle>دەستکاری دراو</DialogTitle>
            <DialogDescription>
              زانیاریەکانی دراوەکە نوێ بکەرەوە
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>کۆدی دراو</Label>
              <Input value={formData.code} disabled className="bg-muted" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-name">ناوی دراو</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-symbol">هێما</Label>
              <Input
                id="edit-symbol"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-exchangeRate">نرخی ئاڵووگۆڕ</Label>
              <Input
                id="edit-exchangeRate"
                type="number"
                step="0.000001"
                value={formData.exchangeRate}
                onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isBaseCurrency">دراوی بنەڕەت</Label>
              <Switch
                id="edit-isBaseCurrency"
                checked={formData.isBaseCurrency}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isBaseCurrency: checked })
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
