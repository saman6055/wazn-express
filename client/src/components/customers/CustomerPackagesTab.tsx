import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";

interface PackageRecord {
  id: number;
  packageCode: string;
  trackingNumber?: string;
  shippingType: string;
  weightKg?: string;
  calculatedCostUsd?: string;
  status: string;
  createdAt: string;
}

interface CustomerPackagesTabProps {
  packages: PackageRecord[] | undefined;
  customerId: number;
  t: (key: string) => string;
}

export function CustomerPackagesTab({ packages, t }: CustomerPackagesTabProps) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Packages</CardTitle>
            <CardDescription>All packages for this customer</CardDescription>
          </div>
          <Badge variant="secondary">{packages?.length ?? 0} total</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Package Code</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages?.slice(0, 10).map((pkg) => (
              <TableRow key={pkg.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-sm">{pkg.packageCode}</TableCell>
                <TableCell className="text-sm">{pkg.trackingNumber ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize text-xs">
                    {pkg.shippingType.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{pkg.weightKg ? `${pkg.weightKg} kg` : "-"}</TableCell>
                <TableCell className="font-mono text-sm">${pkg.calculatedCostUsd ?? "0.00"}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`capitalize text-xs ${
                      pkg.status === "delivered"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : pkg.status === "cancelled"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {pkg.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(pkg.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            {(!packages || packages.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No packages found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {packages && packages.length > 10 && (
          <div className="p-4 text-center border-t">
            <Button variant="outline" size="sm">
              View all {packages.length} packages
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
