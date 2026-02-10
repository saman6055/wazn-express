import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Plane, Ship, Search, DollarSign, Package } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

export default function CustomerPricingReport() {
    const { t } = useTranslation();
const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedShippingType, setSelectedShippingType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: batches } = trpc.batches.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: allCustomerPricing } = trpc.batches.listAllCustomerPricing.useQuery();

  // Filter pricing data
  const filteredPricing = allCustomerPricing?.filter((cp: any) => {
    if (selectedBatch !== "all" && cp.batchId !== parseInt(selectedBatch)) return false;
    if (selectedCustomer !== "all" && cp.customerId !== parseInt(selectedCustomer)) return false;
    
    const batch = batches?.find(b => b.id === cp.batchId);
    if (selectedShippingType !== "all" && batch?.shippingType !== selectedShippingType) return false;
    
    if (searchQuery) {
      const customer = customers?.find(c => c.id === cp.customerId);
      const searchLower = searchQuery.toLowerCase();
      const matchesCustomer = customer?.fullName?.toLowerCase().includes(searchLower) ||
                              customer?.customerCode?.toLowerCase().includes(searchLower);
      const matchesBatch = batch?.batchCode?.toLowerCase().includes(searchLower);
      if (!matchesCustomer && !matchesBatch) return false;
    }
    
    return true;
  }) || [];

  // Get batch info helper
  const getBatchInfo = (batchId: number) => {
    const batch = batches?.find(b => b.id === batchId);
    return batch || null;
  };

  // Get customer info helper
  const getCustomerInfo = (customerId: number) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer || null;
  };

  // Calculate statistics
  const stats = {
    totalCustomerPricing: filteredPricing.length,
    uniqueCustomers: new Set(filteredPricing.map((cp: any) => cp.customerId)).size,
    uniqueBatches: new Set(filteredPricing.map((cp: any) => cp.batchId)).size,
    avgDiscount: 0, // Could calculate if we had default prices
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600" />
            ڕ{t("auto.text_4d8c25")}
          </h1>
          <p className="text-muted-foreground">{t("auto.text_90dc76")} </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("auto.text_f6924e")} </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">{stats.totalCustomerPricing}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("auto.text_959b1f")} </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.uniqueCustomers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("auto.text_15b23a")} </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.uniqueBatches}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("packages.shippingType")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-amber-600">
                  <Plane className="h-3 w-3 mr-1" />
                  {filteredPricing.filter((cp: any) => {
                    const batch = getBatchInfo(cp.batchId);
                    return batch?.shippingType !== 'sea';
                  }).length}
                </Badge>
                <Badge variant="outline" className="text-blue-600">
                  <Ship className="h-3 w-3 mr-1" />
                  {filteredPricing.filter((cp: any) => {
                    const batch = getBatchInfo(cp.batchId);
                    return batch?.shippingType === 'sea';
                  }).length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t("common.filters")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("auto.text_a88bd1")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger>
                  <SelectValue placeholder={t("batches.allBatches")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("batches.allBatches")}</SelectItem>
                  {batches?.filter(b => b.hasCustomerPricing).map(batch => (
                    <SelectItem key={batch.id} value={batch.id.toString()}>
                      {batch.batchCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder={t("auto.text_177870")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("auto.text_177870")} </SelectItem>
                  {customers?.filter(c => 
                    allCustomerPricing?.some((cp: any) => cp.customerId === c.id)
                  ).map(customer => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.customerCode} - {customer.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedShippingType} onValueChange={setSelectedShippingType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("packages.shippingType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("packages.allTypes")}</SelectItem>
                  <SelectItem value="air_regular">Air Regular</SelectItem>
                  <SelectItem value="air_irregular">Air Irregular</SelectItem>
                  <SelectItem value="sea">Sea Freight</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("auto.text_452470")} </CardTitle>
            <CardDescription>
              {filteredPricing.length} {t("auto.text_50b72e")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("customers.title")}</TableHead>
                  <TableHead>{t("batches.title")}</TableHead>
                  <TableHead>{t("packages.shippingType")}</TableHead>
                  <TableHead>{t("auto.text_069eed")} </TableHead>
                  <TableHead>{t("pricing.customPricing")}</TableHead>
                  <TableHead>{t("auto.text_59f4d0")} </TableHead>
                  <TableHead>{t("common.notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPricing.map((cp: any) => {
                  const batch = getBatchInfo(cp.batchId);
                  const customer = getCustomerInfo(cp.customerId);
                  const isSea = batch?.shippingType === 'sea';
                  const unit = isSea ? 'CBM' : 'KG';
                  const defaultPrice = isSea ? Number(batch?.pricePerCbm) : Number(batch?.pricePerKg);
                  const customPrice = isSea ? Number(cp.pricePerCbm) : Number(cp.pricePerKg);
                  const difference = defaultPrice - customPrice;
                  const percentDiff = defaultPrice > 0 ? ((difference / defaultPrice) * 100).toFixed(1) : 0;

                  return (
                    <TableRow key={`${cp.batchId}-${cp.customerId}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer?.fullName || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">{customer?.customerCode}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isSea ? (
                            <Ship className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Plane className="h-4 w-4 text-amber-600" />
                          )}
                          <span className="font-mono">{batch?.batchCode || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {batch?.shippingType?.replace(/_/g, ' ') || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">
                          ${defaultPrice?.toFixed(2) || '0.00'}/{unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-purple-600">
                          ${customPrice?.toFixed(2) || '0.00'}/{unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        {difference !== 0 && (
                          <Badge variant={difference > 0 ? "default" : "destructive"} className={difference > 0 ? "bg-green-100 text-green-800" : ""}>
                            {difference > 0 ? '-' : '+'}${Math.abs(difference).toFixed(2)} ({percentDiff}%)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {cp.notes || '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredPricing.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t("auto.text_cbc636")}
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
