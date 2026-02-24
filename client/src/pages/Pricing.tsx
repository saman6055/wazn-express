import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Plus, DollarSign } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Pricing() {
    const { t } = useTranslation();
const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: pricingRules, refetch } = trpc.pricing.list.useQuery();
  const { data: countries } = trpc.countries.list.useQuery({ activeOnly: true });
  
  const createMutation = trpc.pricing.create.useMutation({
    onSuccess: () => {
      toast.success("یاسای نرخ بە سەرکەوتوویی دروستکرا");
      setIsCreateOpen(false);
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const updateMutation = trpc.pricing.update.useMutation({
    onSuccess: () => {
      toast.success("یاسای نرخ نوێکرایەوە");
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const shippingType = formData.get("shippingType") as string;
    createMutation.mutate({
      originCountryId: parseInt(formData.get("originCountryId") as string),
      destinationCountryId: parseInt(formData.get("destinationCountryId") as string),
      shippingType: shippingType as "air_regular" | "air_irregular" | "sea",
      pricePerUnit: formData.get("pricePerUnit") as string,
      unit: shippingType === "sea" ? "cbm" : "kg",
      effectiveFrom: new Date(formData.get("effectiveFrom") as string),
      effectiveTo: formData.get("effectiveTo") ? new Date(formData.get("effectiveTo") as string) : undefined,
      notes: formData.get("notes") as string || undefined,
    });
  };

  const getCountryName = (id: number) => countries?.find(c => c.id === id)?.nameEn || "Unknown";

  const toggleActive = (id: number, currentStatus: boolean) => {
    updateMutation.mutate({ id, isActive: !currentStatus });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pricing Rules</h1>
            <p className="text-muted-foreground">Configure shipping rates by route and type</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 me-2" />Add Pricing Rule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Pricing Rule</DialogTitle>
                <DialogDescription>Set up a new pricing rule for a shipping route.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="originCountryId">Origin Country *</Label>
                      <Select name="originCountryId" required>
                        <SelectTrigger><SelectValue placeholder="Select origin" /></SelectTrigger>
                        <SelectContent>
                          {countries?.filter(c => c.isOrigin).map(country => (
                            <SelectItem key={country.id} value={country.id.toString()}>
                              {country.nameEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="destinationCountryId">Destination Country *</Label>
                      <Select name="destinationCountryId" required>
                        <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                        <SelectContent>
                          {countries?.filter(c => c.isDestination).map(country => (
                            <SelectItem key={country.id} value={country.id.toString()}>
                              {country.nameEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="shippingType">Shipping Type *</Label>
                      <Select name="shippingType" required>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="air_regular">Air Regular (per KG)</SelectItem>
                          <SelectItem value="air_irregular">Air Irregular (per KG)</SelectItem>
                          <SelectItem value="sea">Sea (per CBM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pricePerUnit">Price (USD) *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="pricePerUnit" name="pricePerUnit" type="number" step="0.01" min="0" required className="pl-9" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="effectiveFrom">Effective From *</Label>
                      <Input id="effectiveFrom" name="effectiveFrom" type="date" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="effectiveTo">Effective To (Optional)</Label>
                      <Input id="effectiveTo" name="effectiveTo" type="date" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input id="notes" name="notes" placeholder="Optional notes about this pricing rule" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Rule"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Air Regular</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {pricingRules?.filter(r => r.shippingType === "air_regular" && r.isActive).length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Active rules</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Air Irregular</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {pricingRules?.filter(r => r.shippingType === "air_irregular" && r.isActive).length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Active rules</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sea Freight</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {pricingRules?.filter(r => r.shippingType === "sea" && r.isActive).length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Active rules</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Effective Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricingRules?.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="font-medium">
                        {getCountryName(rule.originCountryId)} → {getCountryName(rule.destinationCountryId)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {rule.shippingType.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      ${rule.pricePerUnit} / {rule.unit.toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{new Date(rule.effectiveFrom).toLocaleDateString()}</p>
                        {rule.effectiveTo && (
                          <p className="text-muted-foreground">to {new Date(rule.effectiveTo).toLocaleDateString()}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.isActive ? "default" : "secondary"}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(rule.id, rule.isActive)}
                      >
                        {rule.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!pricingRules || pricingRules.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No pricing rules configured
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
