import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Crown, Plus, Edit, Trash2, Users, Percent, DollarSign, CreditCard, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function VipCustomers() {
    const { t } = useTranslation();
const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedVip, setSelectedVip] = useState<any>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  
  const { data: vipCustomers, refetch } = trpc.vip.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  
  const createMutation = trpc.vip.create.useMutation({
    onSuccess: () => {
      toast.success("VIP customer created successfully");
      setIsCreateOpen(false);
      setSelectedCustomerId("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const updateMutation = trpc.vip.update.useMutation({
    onSuccess: () => {
      toast.success("VIP customer updated successfully");
      setIsEditOpen(false);
      setSelectedVip(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const deleteMutation = trpc.vip.delete.useMutation({
    onSuccess: () => {
      toast.success("VIP status removed");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  // Get customers who are not already VIP
  const availableCustomers = customers?.filter(c => 
    !vipCustomers?.some(v => v.customerId === c.id)
  );

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      customerId: parseInt(selectedCustomerId),
      tier: formData.get("tier") as "silver" | "gold" | "platinum",
      discountPercent: formData.get("discountPercent") as string || undefined,
      fixedPricePerKgAir: formData.get("fixedPricePerKgAir") as string || undefined,
      fixedPricePerKgSea: formData.get("fixedPricePerKgSea") as string || undefined,
      creditLimitUsd: formData.get("creditLimitUsd") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedVip) return;
    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: selectedVip.id,
      tier: formData.get("tier") as "silver" | "gold" | "platinum",
      discountPercent: formData.get("discountPercent") as string || undefined,
      fixedPricePerKgAir: formData.get("fixedPricePerKgAir") as string || undefined,
      fixedPricePerKgSea: formData.get("fixedPricePerKgSea") as string || undefined,
      creditLimitUsd: formData.get("creditLimitUsd") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'from-slate-600 to-slate-800';
      case 'gold': return 'from-amber-400 to-orange-500';
      default: return 'from-slate-300 to-slate-400';
    }
  };

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'bg-gradient-to-r from-slate-600 to-slate-800 text-white';
      case 'gold': return 'bg-gradient-to-r from-amber-400 to-orange-500 text-white';
      default: return 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-700';
    }
  };

  const silverCount = vipCustomers?.filter(v => v.tier === 'silver').length || 0;
  const goldCount = vipCustomers?.filter(v => v.tier === 'gold').length || 0;
  const platinumCount = vipCustomers?.filter(v => v.tier === 'platinum').length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-6 w-6" />
                <span className="text-sm font-medium opacity-90">Premium Members</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">VIP Customers</h1>
              <p className="text-white/80 max-w-lg">
                Manage premium customers with special pricing and benefits
              </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-amber-600 hover:bg-white/90 shadow-lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Add VIP
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    Add VIP Customer
                  </DialogTitle>
                  <DialogDescription>
                    Grant VIP status to a customer with special pricing
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Select Customer *</Label>
                      <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Choose a customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCustomers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id.toString()}>
                              {customer.fullName} ({customer.customerCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="tier">VIP Tier *</Label>
                      <Select name="tier" defaultValue="silver">
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="silver">🥈 Silver</SelectItem>
                          <SelectItem value="gold">🥇 Gold</SelectItem>
                          <SelectItem value="platinum">💎 Platinum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="discountPercent">Discount %</Label>
                        <Input id="discountPercent" name="discountPercent" type="number" step="0.01" min="0" max="100" className="h-11" placeholder="e.g. 10" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="creditLimitUsd">Credit Limit ($)</Label>
                        <Input id="creditLimitUsd" name="creditLimitUsd" type="number" step="0.01" min="0" className="h-11" placeholder="e.g. 1000" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="fixedPricePerKgAir">Fixed Price/KG (Air)</Label>
                        <Input id="fixedPricePerKgAir" name="fixedPricePerKgAir" type="number" step="0.01" min="0" className="h-11" placeholder="e.g. 5.00" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="fixedPricePerKgSea">Fixed Price/KG (Sea)</Label>
                        <Input id="fixedPricePerKgSea" name="fixedPricePerKgSea" type="number" step="0.01" min="0" className="h-11" placeholder="e.g. 2.00" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Input id="notes" name="notes" className="h-11" placeholder="Any special notes..." />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || !selectedCustomerId} className="bg-amber-500 hover:bg-amber-600">
                      {createMutation.isPending ? "Creating..." : "Add VIP"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total VIP</p>
                  <p className="text-3xl font-bold">{vipCustomers?.length || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
                  <Crown className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Silver</p>
                  <p className="text-3xl font-bold text-slate-500">{silverCount}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-slate-700 shadow-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Gold</p>
                  <p className="text-3xl font-bold text-amber-500">{goldCount}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Platinum</p>
                  <p className="text-3xl font-bold text-slate-600">{platinumCount}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white shadow-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* VIP List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vipCustomers?.map((vip) => {
            const customer = customers?.find(c => c.id === vip.customerId);
            return (
              <Card key={vip.id} className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-all group">
                <div className={`h-2 bg-gradient-to-r ${getTierColor(vip.tier)}`} />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${getTierColor(vip.tier)} flex items-center justify-center text-white shadow-lg`}>
                        <Crown className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold">{customer?.fullName || `Customer #${vip.customerId}`}</p>
                        <Badge className={`text-xs border-0 ${getTierBadgeClass(vip.tier)}`}>
                          {vip.tier.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedVip(vip);
                          setIsEditOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("Remove VIP status from this customer?")) {
                            deleteMutation.mutate({ id: vip.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                        <Percent className="h-4 w-4" />
                        <span className="text-xs font-medium">Discount</span>
                      </div>
                      <p className="font-bold text-lg">{vip.discountPercent || 0}%</p>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                        <CreditCard className="h-4 w-4" />
                        <span className="text-xs font-medium">Credit Limit</span>
                      </div>
                      <p className="font-bold text-lg">${vip.creditLimitUsd || 0}</p>
                    </div>
                    {vip.fixedPricePerKgAir && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-xs font-medium">Air/KG</span>
                        </div>
                        <p className="font-bold text-lg">${vip.fixedPricePerKgAir}</p>
                      </div>
                    )}
                    {vip.fixedPricePerKgSea && (
                      <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30">
                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-xs font-medium">Sea/KG</span>
                        </div>
                        <p className="font-bold text-lg">${vip.fixedPricePerKgSea}</p>
                      </div>
                    )}
                  </div>
                  
                  {vip.notes && (
                    <p className="text-sm text-muted-foreground mt-4 p-3 rounded-lg bg-muted/50">
                      {vip.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          
          {(!vipCustomers || vipCustomers.length === 0) && (
            <Card className="col-span-full border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <Crown className="h-16 w-16 mx-auto mb-4 text-amber-300" />
                <h3 className="text-lg font-semibold mb-2">No VIP Customers Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first VIP customer to grant them special pricing and benefits
                </p>
                <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-500 hover:bg-amber-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First VIP
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                Edit VIP Customer
              </DialogTitle>
              <DialogDescription>
                Update VIP pricing and benefits
              </DialogDescription>
            </DialogHeader>
            {selectedVip && (
              <form onSubmit={handleUpdate}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-tier">VIP Tier *</Label>
                    <Select name="tier" defaultValue={selectedVip.tier}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="silver">🥈 Silver</SelectItem>
                        <SelectItem value="gold">🥇 Gold</SelectItem>
                        <SelectItem value="platinum">💎 Platinum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-discountPercent">Discount %</Label>
                      <Input id="edit-discountPercent" name="discountPercent" type="number" step="0.01" min="0" max="100" defaultValue={selectedVip.discountPercent || ""} className="h-11" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-creditLimitUsd">Credit Limit ($)</Label>
                      <Input id="edit-creditLimitUsd" name="creditLimitUsd" type="number" step="0.01" min="0" defaultValue={selectedVip.creditLimitUsd || ""} className="h-11" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-fixedPricePerKgAir">Fixed Price/KG (Air)</Label>
                      <Input id="edit-fixedPricePerKgAir" name="fixedPricePerKgAir" type="number" step="0.01" min="0" defaultValue={selectedVip.fixedPricePerKgAir || ""} className="h-11" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-fixedPricePerKgSea">Fixed Price/KG (Sea)</Label>
                      <Input id="edit-fixedPricePerKgSea" name="fixedPricePerKgSea" type="number" step="0.01" min="0" defaultValue={selectedVip.fixedPricePerKgSea || ""} className="h-11" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-notes">Notes</Label>
                    <Input id="edit-notes" name="notes" defaultValue={selectedVip.notes || ""} className="h-11" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
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
