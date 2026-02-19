import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus, Edit, Warehouse } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Warehouses() {
  const { t } = useTranslation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [createCountryId, setCreateCountryId] = useState<string>("");
  const [createWarehouseType, setCreateWarehouseType] = useState<"air" | "sea" | "custom">("air");
  const [createPricingModel, setCreatePricingModel] = useState<"per_kg" | "per_cbm">("per_kg");

  const { data: warehouses, refetch } = trpc.warehouses.list.useQuery();
  const { data: countries } = trpc.countries.list.useQuery({ activeOnly: true });
  
  const createMutation = trpc.warehouses.create.useMutation({
    onSuccess: () => {
      toast.success(t("toast.warehouseCreated"));
      setIsCreateOpen(false);
      setCreateCountryId("");
      setCreateWarehouseType("air");
      setCreatePricingModel("per_kg");
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });
  
  const updateMutation = trpc.warehouses.update.useMutation({
    onSuccess: () => {
      toast.success(t("toast.warehouseUpdated"));
      setEditingWarehouse(null);
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const countryId = parseInt(createCountryId, 10);
    if (!createCountryId || isNaN(countryId)) {
      toast.error("Please select a country");
      return;
    }
    createMutation.mutate({
      nameEn: formData.get("nameEn") as string,
      nameAr: (formData.get("nameAr") as string) || undefined,
      nameKu: (formData.get("nameKu") as string) || undefined,
      city: formData.get("city") as string,
      addressEn: (formData.get("addressEn") as string) || undefined,
      countryId,
      warehouseType: createWarehouseType,
      codePrefix: formData.get("codePrefix") as string,
      expectedDeliveryMin: parseInt(formData.get("expectedDeliveryMin") as string) || undefined,
      expectedDeliveryMax: parseInt(formData.get("expectedDeliveryMax") as string) || undefined,
      pricingModel: createPricingModel,
      contactInfo: (formData.get("contactInfo") as string) || undefined,
    });
  };

  const getCountryName = (countryId: number) => {
    return countries?.find(c => c.id === countryId)?.nameEn || "Unknown";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
            <p className="text-muted-foreground">Manage warehouse locations and configurations</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Warehouse</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Warehouse</DialogTitle>
                <DialogDescription>Configure a new warehouse location.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid gap-2">
                    <Label htmlFor="nameEn">Warehouse Name (English) *</Label>
                    <Input id="nameEn" name="nameEn" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="nameAr">Name (Arabic)</Label>
                      <Input id="nameAr" name="nameAr" dir="rtl" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="nameKu">Name (Kurdish)</Label>
                      <Input id="nameKu" name="nameKu" dir="rtl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="countryId">Country *</Label>
                      <Select value={createCountryId} onValueChange={setCreateCountryId}>
                        <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                        <SelectContent>
                          {(countries ?? []).filter(c => c.isOrigin || c.isDestination).map(country => (
                            <SelectItem key={country.id} value={country.id.toString()}>
                              {country.nameEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city">City *</Label>
                      <Input id="city" name="city" required />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="addressEn">Address</Label>
                    <Input id="addressEn" name="addressEn" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="warehouseType">Type *</Label>
                      <Select value={createWarehouseType} onValueChange={(v) => setCreateWarehouseType(v as "air" | "sea" | "custom")}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="air">Air</SelectItem>
                          <SelectItem value="sea">Sea</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="codePrefix">Code Prefix *</Label>
                      <Input id="codePrefix" name="codePrefix" required placeholder="e.g., REG, SEA, HK" maxLength={10} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="pricingModel">Pricing Model *</Label>
                      <Select value={createPricingModel} onValueChange={(v) => setCreatePricingModel(v as "per_kg" | "per_cbm")}>
                        <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_kg">Per KG (Air)</SelectItem>
                          <SelectItem value="per_cbm">Per CBM (Sea)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contactInfo">Contact Info</Label>
                      <Input id="contactInfo" name="contactInfo" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="expectedDeliveryMin">Min Delivery (days)</Label>
                      <Input id="expectedDeliveryMin" name="expectedDeliveryMin" type="number" min="1" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="expectedDeliveryMax">Max Delivery (days)</Label>
                      <Input id="expectedDeliveryMax" name="expectedDeliveryMax" type="number" min="1" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Warehouse"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses?.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-mono font-medium">{warehouse.codePrefix}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-muted-foreground" />
                        <span>{warehouse.nameEn}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{warehouse.city}</p>
                        <p className="text-xs text-muted-foreground">{getCountryName(warehouse.countryId)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{warehouse.warehouseType}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{warehouse.pricingModel.replace("_", " ")}</TableCell>
                    <TableCell>
                      {warehouse.expectedDeliveryMin && warehouse.expectedDeliveryMax
                        ? `${warehouse.expectedDeliveryMin}-${warehouse.expectedDeliveryMax} days`
                        : "-"
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={warehouse.isActive ? "default" : "secondary"}>
                        {warehouse.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditingWarehouse(warehouse)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!warehouses || warehouses.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No warehouses configured
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
