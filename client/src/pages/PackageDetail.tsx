import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Package, QrCode, MapPin, Clock, Camera, ArrowLeft, Truck, CheckCircle2, AlertCircle, FileText, DollarSign } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

const statusColors: Record<string, string> = {
  registered: "bg-blue-100 text-blue-800 border-blue-200",
  in_batch: "bg-purple-100 text-purple-800 border-purple-200",
  in_transit: "bg-amber-100 text-amber-800 border-amber-200",
  customs_processing: "bg-orange-100 text-orange-800 border-orange-200",
  ready_for_delivery: "bg-cyan-100 text-cyan-800 border-cyan-200",
  out_for_delivery: "bg-indigo-100 text-indigo-800 border-indigo-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  returned: "bg-gray-100 text-gray-800 border-gray-200",
};

const statusSteps = [
  { key: "registered", label: "Registered", icon: Package },
  { key: "in_batch", label: "In Batch", icon: Package },
  { key: "in_transit", label: "In Transit", icon: Truck },
  { key: "customs_processing", label: "Customs", icon: FileText },
  { key: "ready_for_delivery", label: "Ready", icon: MapPin },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

function GenerateInvoiceButton({ pkg }: { pkg: any }) {
  const generateInvoiceMutation = trpc.ledger.generatePackageInvoice.useMutation({
    onSuccess: (data) => {
      toast.success("Invoice generated successfully");
      // Trigger download
      if (data.pdfUrl) {
        const link = document.createElement('a');
        link.href = data.pdfUrl;
        link.download = `invoice-${data.invoice.invoiceNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate invoice");
    },
  });

  // Show button for all delivered packages with customer
  if (!pkg.customerId || pkg.status !== 'delivered') return null;

  return (
    <Button 
      variant="outline"
      onClick={() => {
        generateInvoiceMutation.mutate({
          packageId: pkg.id,
          customerId: pkg.customerId!,
        });
      }}
      disabled={generateInvoiceMutation.isPending}
    >
      <FileText className="h-4 w-4 me-2" />
      {generateInvoiceMutation.isPending ? "Generating..." : "Generate Invoice"}
    </Button>
  );
}

export default function PackageDetail() {
    const { t } = useTranslation();
const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: pkg, refetch } = trpc.packages.getById.useQuery({ id: Number(id) });
  const { data: customer } = trpc.customers.getById.useQuery(
    { id: pkg?.customerId || 0 },
    { enabled: !!pkg?.customerId }
  );
  const { data: batch } = trpc.batches.getById.useQuery(
    { id: pkg?.batchId || 0 },
    { enabled: !!pkg?.batchId }
  );

  const updateStatusMutation = trpc.packages.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Package status updated");
      setShowStatusDialog(false);
      setStatusNote("");
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  // Photo upload will use updateStatus with deliveryPhoto

  const handleStatusUpdate = () => {
    if (!newStatus) return;
    updateStatusMutation.mutate({
      id: Number(id),
      status: newStatus as any,
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.info("Photo upload feature coming soon");
    setShowPhotoDialog(false);
  };

  const getCurrentStatusIndex = () => {
    return statusSteps.findIndex(s => s.key === pkg?.status) || 0;
  };

  // Generate QR code URL (using a simple QR code API)
  const qrCodeUrl = pkg ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pkg.packageCode)}` : "";

  if (!pkg) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Loading package details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/packages")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              <span className="font-mono">{pkg.packageCode}</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[pkg.status]}`}>
                {pkg.status.replace(/_/g, " ")}
              </span>
            </h1>
            <p className="text-muted-foreground">
              {pkg.trackingNumber ? `Tracking: ${pkg.trackingNumber}` : "No tracking number"}
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
              <DialogTrigger asChild>
                <Button>Update Status</Button>
              </DialogTrigger>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Package Status</DialogTitle>
                <DialogDescription>Change the status of package {pkg.packageCode}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Status</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="registered">Registered</SelectItem>
                      <SelectItem value="in_batch">In Batch</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="customs_processing">Customs Processing</SelectItem>
                      <SelectItem value="ready_for_delivery">Ready for Delivery</SelectItem>
                      <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <Textarea
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Add notes about this status change..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Cancel</Button>
                <Button onClick={handleStatusUpdate} disabled={!newStatus || updateStatusMutation.isPending}>
                  Update Status
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            <GenerateInvoiceButton pkg={pkg} />
          </div>
        </div>

        {/* Status Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tracking Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {statusSteps.map((step, index) => {
                const currentIndex = getCurrentStatusIndex();
                const isCompleted = index <= currentIndex;
                const isCurrent = index === currentIndex;
                const Icon = step.icon;

                return (
                  <div key={step.key} className="flex flex-col items-center flex-1">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                      ${isCompleted ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-muted-foreground/30 text-muted-foreground"}
                      ${isCurrent ? "ring-4 ring-primary/20" : ""}
                    `}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`text-xs mt-2 text-center ${isCompleted ? "font-medium" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                    {index < statusSteps.length - 1 && (
                      <div className={`absolute h-0.5 w-full top-5 left-1/2 -z-10 ${isCompleted ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Package Details */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Package Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{pkg.description || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Shipping Type</p>
                  <Badge variant="outline" className="capitalize">{pkg.shippingType.replace(/_/g, " ")}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Weight</p>
                  <p className="font-medium">{pkg.weightKg ? `${pkg.weightKg} kg` : "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dimensions</p>
                  <p className="font-medium">
                    {pkg.lengthCm && pkg.widthCm && pkg.heightCm ? `${pkg.lengthCm}×${pkg.widthCm}×${pkg.heightCm} cm` : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Volume</p>
                  <p className="font-medium">{pkg.volumeCbm ? `${pkg.volumeCbm} CBM` : "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Calculated Cost</p>
                  <p className="font-medium text-primary">${pkg.calculatedCostUsd || "0.00"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(pkg.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{new Date(pkg.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Customer Info */}
              {customer && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-3">Customer</h4>
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{customer.fullName}</p>
                      <p className="text-sm text-muted-foreground font-mono">{customer.customerCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{customer.mobileNumber}</p>
                      <p className="text-sm text-muted-foreground">{customer.city}, {customer.country}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Batch Info */}
              {batch && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-3">Batch Assignment</h4>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono font-medium">{batch.batchCode}</p>
                        <p className="text-sm text-muted-foreground">{batch.shippingType.replace(/_/g, " ")}</p>
                      </div>
                      <Badge variant={batch.status === "delivered" ? "default" : "secondary"}>
                        {batch.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Package Photos */}
              {pkg.photos && Array.isArray(pkg.photos) && pkg.photos.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    وێنەکانی پاکەت ({pkg.photos.length})
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {pkg.photos.map((photo: string, index: number) => (
                      <a
                        key={index}
                        href={photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative group overflow-hidden rounded-lg border hover:border-primary transition-colors"
                      >
                        <img
                          src={photo}
                          alt={`Package photo ${index + 1}`}
                          className="w-full h-32 object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">
                            بینینی گەورە
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {pkg.notes && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-3">Notes</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pkg.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QR Code & Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  QR Code
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <img src={qrCodeUrl} alt="Package QR Code" className="w-48 h-48 border rounded-lg" />
                <p className="text-sm text-muted-foreground mt-2 font-mono">{pkg.packageCode}</p>
                <Button variant="outline" className="mt-4 w-full" onClick={() => window.print()}>
                  Print Label
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Camera className="h-4 w-4" />
                      Upload Delivery Photo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Photo</DialogTitle>
                      <DialogDescription>Upload a delivery or proof photo for this package</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        className="w-full h-32 border-dashed"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="text-center">
                          <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to select photo</p>
                        </div>
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => toast.info("Feature coming soon")}>
                  <FileText className="h-4 w-4" />
                  Generate Invoice
                </Button>

                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => toast.info("Feature coming soon")}>
                  <DollarSign className="h-4 w-4" />
                  Record Payment
                </Button>
              </CardContent>
            </Card>

            {/* Delivery Photos */}
            {pkg.deliveryPhoto && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Delivery Photo</CardTitle>
                </CardHeader>
                <CardContent>
                  <img 
                    src={pkg.deliveryPhoto} 
                    alt="Delivery proof" 
                    className="w-full rounded-lg border"
                  />
                  {pkg.deliveredAt && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Delivered: {new Date(pkg.deliveredAt).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
