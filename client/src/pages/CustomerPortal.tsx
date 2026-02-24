import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { 
  Package, Ship, Search, Wallet, User, Bell, MapPin, 
  FileText, Lock, ChevronRight, Calendar, Download,
  AlertTriangle, Home, ChevronLeft, MessageSquare, Globe,
  Handshake, LogOut
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

type TabType = "news" | "tran" | "search" | "financial" | "me";
type ShippingTab = "air" | "sea" | "dangerous";
type StatusFilter = "all" | "received" | "in_transit" | "arrived" | "customs";

// Batch card component matching the app design
function BatchCard({ 
  batchNo, 
  shippingType,
  status, 
  route, 
  ctnQuantity, 
  trackingNumbers, 
  date, 
  eta,
  onViewDetails 
}: {
  batchNo: string;
  shippingType: string;
  status: string;
  route: string;
  ctnQuantity: number;
  trackingNumbers: string[];
  date: string;
  eta?: number;
  onViewDetails: () => void;
}) {
  const statusColors: Record<string, string> = {
    in_transit: "bg-green-500",
    arrived: "bg-emerald-500",
    received: "bg-blue-500",
    customs: "bg-orange-500",
    delivered: "bg-teal-500",
  };

  const statusLabels: Record<string, string> = {
    in_transit: "لە ڕێگادایە",
    arrived: "گەیشتووە",
    received: "وەرگیراوە",
    customs: "گومرگ",
    delivered: "گەیەندراوە",
    preparing: "ئامادەکاری",
  };

  return (
    <Card className="bg-white rounded-2xl shadow-sm mb-4">
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="font-bold text-lg">Batch No.: {batchNo}</span>
          <Badge className={`${statusColors[status] || "bg-gray-500"} text-white text-xs px-3 py-1`}>
            {statusLabels[status] || status}
          </Badge>
          <Badge className="bg-coral-500 bg-[#FF6B6B] text-white text-xs px-3 py-1">
            {route}
          </Badge>
        </div>

        {/* CTN Quantity */}
        <p className="text-gray-500 text-sm mb-3">CTN Quantity: {ctnQuantity}</p>

        {/* Tracking numbers box */}
        <div className="bg-gray-100 rounded-lg p-3 mb-3">
          <p className="text-gray-600 text-sm break-all">
            {trackingNumbers.join(",")}
          </p>
        </div>

        {/* Date and View Details */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Calendar className="h-4 w-4" />
            <span>{date}</span>
          </div>
          <Button 
            className="bg-[#4A9EFF] hover:bg-[#3A8EEF] text-white rounded-full px-6"
            onClick={onViewDetails}
          >
            View Details
          </Button>
        </div>

        {/* ETA badge */}
        {eta && eta > 0 && (
          <div className="mt-3">
            <Badge variant="secondary" className="bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs px-3 py-1">
              <Calendar className="h-3 w-3 me-1 inline" />
              بەنزیکەیی دەگات: {eta} ڕۆژی تر
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Batch Detail Dialog for Air Transport
function AirBatchDetail({ 
  batch, 
  packages, 
  onClose 
}: { 
  batch: any; 
  packages: any[]; 
  onClose: () => void;
}) {
  const trackingNumbers = packages.map((p: any) => p.trackingNumber).filter(Boolean);
  const totalWeight = packages.reduce((sum: number, p: any) => sum + (parseFloat(p.weightKg) || 0), 0);
  const totalCtn = packages.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-800">
      {/* Header */}
      <div className="bg-slate-800 text-white p-4">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-medium flex-1 text-center">Air Tran.</h1>
          <div className="w-10" />
        </div>
        <h2 className="text-2xl font-bold mt-2">{batch?.batchCode || `${batch?.id}-Air`}</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {/* Arrival Card */}
        <Card className="bg-white rounded-2xl mb-4">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-orange-500" />
              </div>
              <div className="flex-1">
                {batch?.estimatedArrival && (
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-100 text-blue-700">
                      بەرواری گەیشتنی چاوەڕوانکراو
                    </Badge>
                    <span className="font-semibold text-blue-600">
                      {new Date(batch.estimatedArrival).toLocaleDateString('ku-IQ', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                )}
                {batch?.actualArrival ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-700">
                      گەیشتووە
                    </Badge>
                    <span className="font-semibold text-green-600">
                      {new Date(batch.actualArrival).toLocaleDateString('ku-IQ', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">هێشتا نەگەیشتووە</p>
                )}
                <p className="text-gray-400 text-xs mt-2">
                  دوایین نوێکردنەوە: {batch?.updatedAt ? new Date(batch.updatedAt).toLocaleString() : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="bg-white rounded-2xl mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-gray-400 text-sm">CTN Quantity</p>
                <p className="text-xl font-semibold">{totalCtn}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Weight</p>
                <p className="text-xl font-semibold">{totalWeight.toFixed(3)}KG</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Track Numbers Section */}
        <div className="bg-slate-700 rounded-2xl p-4 mb-4">
          <h3 className="text-white font-bold mb-2">Track No.</h3>
          <p className="text-gray-300 text-sm break-all">
            {trackingNumbers.join(",")}
          </p>

          <div className="mt-4 space-y-3">
            <Card className="bg-white rounded-xl">
              <CardContent className="p-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">City</span>
                  <span className="text-gray-800">Guangzhou</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-gray-400">Describe</span>
                  <span className="text-gray-800">---</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-xl">
              <CardContent className="p-3">
                <p className="text-gray-600 text-sm break-all">
                  {trackingNumbers.join(",")}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-xl">
              <CardContent className="p-3">
                <p className="text-gray-800 font-medium">Track No.:</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Goods Progress Button */}
        <Button className="w-full bg-[#4A9EFF] hover:bg-[#3A8EEF] text-white rounded-full py-6 text-lg">
          Goods Progress
        </Button>
      </div>
    </div>
  );
}

// Batch Detail Dialog for Sea Transport
function SeaBatchDetail({ 
  batch, 
  packages, 
  onClose 
}: { 
  batch: any; 
  packages: any[]; 
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Header with ship icon */}
      <div className="bg-slate-800 text-white p-4 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 z-10">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-medium flex-1 text-center z-10">Sea Tran.</h1>
          <div className="w-10" />
        </div>
        
        <div className="flex items-center gap-3 mt-4 z-10 relative">
          <div className="h-16 w-16 rounded-xl bg-slate-600 flex items-center justify-center">
            <Ship className="h-8 w-8 text-white" />
          </div>
          <div>
            <Badge className="bg-green-500 text-white mb-1">In transet</Badge>
            <p className="text-gray-300 text-sm">Shipment is en route to the destination after successful loading.</p>
          </div>
        </div>

        <div className="mt-4 z-10 relative">
          <p className="text-gray-400 text-sm">Batch No.</p>
          <p className="text-4xl font-bold">{batch?.id || "1354"}</p>
        </div>

        {/* Watermark ship */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-10">
          <Ship className="h-48 w-48 text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {/* ETA Card */}
        <Card className="bg-white rounded-2xl mb-4">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <ChevronRight className="h-5 w-5 text-orange-500 rotate-180" />
              </div>
              <div>
                <p className="text-gray-800">
                  ETA: {batch?.estimatedArrival ? new Date(batch.estimatedArrival).toLocaleString() : "2025-12-16 02:37:00"}
                </p>
                <p className="text-blue-500">
                  Arrival at: {batch?.actualArrival ? new Date(batch.actualArrival).toLocaleString() : "2025-12-28 02:37:00"}
                </p>
                <p className="text-gray-400 text-sm">
                  Update to {batch?.updatedAt ? new Date(batch.updatedAt).toLocaleString() : "2025-11-11 16:48:15"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CBM Summary Card */}
        <Card className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-100 text-sm">کۆی قەبارەی سیبی (CBM)</p>
                <p className="text-4xl font-bold">
                  {packages.reduce((sum: number, pkg: any) => sum + (parseFloat(pkg.volumeCbm) || 0), 0).toFixed(4)} m³
                </p>
              </div>
              <div className="text-right">
                <p className="text-cyan-100 text-sm">ژمارەی پاکەت</p>
                <p className="text-2xl font-bold">{packages.length}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-cyan-400/30 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-cyan-100">کۆی کێشی</p>
                <p className="font-bold">
                  {packages.reduce((sum: number, pkg: any) => sum + (parseFloat(pkg.weightKg) || 0), 0).toFixed(2)} kg
                </p>
              </div>
              <div>
                <p className="text-cyan-100">نرخی هەر CBM</p>
                <p className="font-bold">${batch?.pricePerCbm || "0"}/CBM</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Package Table */}
        <Card className="bg-white rounded-2xl mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-2 text-center border-b pb-2 mb-2">
              <span className="text-gray-400 text-sm">کۆد</span>
              <span className="text-gray-400 text-sm">کێشی</span>
              <span className="text-gray-400 text-sm">CBM</span>
              <span className="text-gray-400 text-sm">نرخ</span>
            </div>
            {packages.map((pkg: any, idx: number) => {
              const pkgCbm = parseFloat(pkg.volumeCbm) || 0;
              const pricePerCbm = parseFloat(batch?.pricePerCbm) || 0;
              const pkgCost = pkgCbm * pricePerCbm;
              return (
                <div key={idx} className="grid grid-cols-4 gap-2 text-center py-2 border-b border-gray-100 text-sm">
                  <span className="font-mono text-xs">{pkg.packageCode || idx + 1}</span>
                  <span>{pkg.weightKg ? `${pkg.weightKg}kg` : "-"}</span>
                  <span className="font-medium text-cyan-600">{pkgCbm.toFixed(4)}</span>
                  <span className="text-green-600">${pkgCost.toFixed(2)}</span>
                </div>
              );
            })}
            {/* Total Row */}
            <div className="grid grid-cols-4 gap-2 text-center py-3 bg-gray-50 rounded-lg mt-2 font-bold">
              <span>کۆی</span>
              <span>{packages.reduce((sum: number, pkg: any) => sum + (parseFloat(pkg.weightKg) || 0), 0).toFixed(2)}kg</span>
              <span className="text-cyan-600">
                {packages.reduce((sum: number, pkg: any) => sum + (parseFloat(pkg.volumeCbm) || 0), 0).toFixed(4)}
              </span>
              <span className="text-green-600">
                ${(packages.reduce((sum: number, pkg: any) => sum + (parseFloat(pkg.volumeCbm) || 0), 0) * (parseFloat(batch?.pricePerCbm) || 0)).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Goods Progress Button */}
        <Button className="w-full bg-[#4A9EFF] hover:bg-[#3A8EEF] text-white rounded-full py-6 text-lg">
          Goods Progress
        </Button>
      </div>
    </div>
  );
}

// Transaction Card Component
function TransactionCard({ 
  type, 
  number, 
  amount, 
  date, 
  description 
}: {
  type: "invoice" | "payment" | "charge";
  number?: string;
  amount: number;
  date: string;
  description: string;
}) {
  const getBadgeColor = () => {
    switch (type) {
      case 'invoice': return 'bg-blue-500 text-white';
      case 'payment': return 'bg-green-500 text-white';
      case 'charge': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };
  
  const getLabel = () => {
    switch (type) {
      case 'invoice': return 'Invoice';
      case 'payment': return 'Payment';
      case 'charge': return 'Charge';
      default: return type;
    }
  };
  
  return (
    <Card className="bg-white rounded-2xl mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Badge className={getBadgeColor()}>
            {getLabel()}
          </Badge>
          {number && <span className="font-bold text-lg">{number}</span>}
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-gray-500">Amount</span>
            <span className="text-red-500 font-semibold">${amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="text-gray-800">{date}</span>
          </div>
        </div>

        <p className="text-gray-500 text-sm mb-3">{description}</p>

        {type === "invoice" && (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-full">
              Attachement
            </Button>
            <Button className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-full">
              Download Invoice PDF
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Menu Item Component for Me tab
function MenuItem({ 
  icon, 
  label, 
  badge, 
  onClick 
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button 
      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 border-b border-gray-100"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-gray-800">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge !== undefined && badge > 0 && (
          <Badge className="bg-red-500 text-white text-xs min-w-[24px] justify-center">
            {badge}
          </Badge>
        )}
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
    </button>
  );
}

// Bottom Navigation Item
function NavItem({ 
  icon, 
  label, 
  active, 
  onClick 
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button 
      className={`flex flex-col items-center gap-1 px-4 py-2 ${active ? "text-slate-800" : "text-gray-400"}`}
      onClick={onClick}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}

export default function CustomerPortal() {
    const { t } = useTranslation();
const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("tran");
  const [shippingTab, setShippingTab] = useState<ShippingTab>("air");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Fetch customer data
  const { data: customerData } = trpc.customerPortal.getMyAccount.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: myPackages } = trpc.customerPortal.getMyPackages.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: myInvoices } = trpc.customerPortal.getMyInvoices.useQuery(undefined, {
    enabled: !!user,
  });
  
  const { data: myTransactions } = trpc.customerPortal.getMyTransactions.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: balance } = trpc.customerPortal.getMyBalance.useQuery(undefined, {
    enabled: !!user,
  });

  // Derive batches from packages
  const myBatches = myPackages ? Array.from(new Set(myPackages.map((p: any) => p.batchId).filter(Boolean))).map(batchId => {
    const batchPackages = myPackages.filter((p: any) => p.batchId === batchId);
    const firstPkg = batchPackages[0];
    return {
      id: batchId,
      batchCode: `${batchId}-${firstPkg?.shippingType === 'sea' ? 'Sea' : 'Air'}`,
      status: firstPkg?.status === 'delivered' ? 'arrived' : 'in_transit',
      shippingType: firstPkg?.shippingType || 'air_regular',
      route: "China to Iraq",
      ctnQuantity: batchPackages.length,
      trackingNumbers: batchPackages.map((p: any) => p.trackingNumber).filter(Boolean),
      departureDate: firstPkg?.createdAt,
      estimatedArrival: null,
      actualArrival: null,
      updatedAt: firstPkg?.updatedAt,
      packages: batchPackages,
    };
  }) : [];

  useEffect(() => {
    if (!loading && !user) {
      navigate("/customer-login");
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/customer-login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  // Filter batches
  const filteredBatches = myBatches.filter((batch: any) => {
    // Filter by shipping type
    if (shippingTab === "air" && batch.shippingType === "sea") return false;
    if (shippingTab === "sea" && batch.shippingType !== "sea") return false;
    if (shippingTab === "dangerous") return false; // No dangerous goods filter yet
    
    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "received" && batch.status !== "received") return false;
      if (statusFilter === "in_transit" && batch.status !== "in_transit") return false;
      if (statusFilter === "arrived" && batch.status !== "arrived") return false;
      if (statusFilter === "customs" && batch.status !== "customs") return false;
    }
    
    return true;
  });

  // Show batch detail if selected
  if (selectedBatch) {
    const isSea = selectedBatch.shippingType === "sea";
    if (isSea) {
      return (
        <SeaBatchDetail 
          batch={selectedBatch} 
          packages={selectedBatch.packages || []} 
          onClose={() => setSelectedBatch(null)} 
        />
      );
    }
    return (
      <AirBatchDetail 
        batch={selectedBatch} 
        packages={selectedBatch.packages || []} 
        onClose={() => setSelectedBatch(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-20">
      {/* Tran Tab */}
      {activeTab === "tran" && (
        <>
          {/* Header */}
          <div className="bg-slate-800 text-white p-4">
            <div className="flex items-center justify-between mb-4">
              <select className="bg-transparent text-white border-none outline-none">
                <option>Country ▼</option>
              </select>
              <h1 className="text-lg font-medium">Tran.</h1>
              <select className="bg-transparent text-white border-none outline-none">
                <option>Area ▼</option>
              </select>
            </div>

            {/* Shipping Type Tabs */}
            <div className="flex gap-2">
              <Button 
                className={`rounded-full px-6 ${shippingTab === "air" ? "bg-[#FF7F7F] hover:bg-[#FF6F6F]" : "bg-gray-600 hover:bg-gray-500"}`}
                onClick={() => setShippingTab("air")}
              >
                Air Tran.
              </Button>
              <Button 
                className={`rounded-full px-6 ${shippingTab === "sea" ? "bg-[#FF7F7F] hover:bg-[#FF6F6F]" : "bg-gray-600 hover:bg-gray-500"}`}
                onClick={() => setShippingTab("sea")}
              >
                Sea Tran.
              </Button>
              <Button 
                className={`rounded-full px-4 text-xs ${shippingTab === "dangerous" ? "bg-[#FF7F7F] hover:bg-[#FF6F6F]" : "bg-slate-700 hover:bg-slate-600"}`}
                onClick={() => setShippingTab("dangerous")}
              >
                Air Tran.<br/>Dangerous goods
              </Button>
            </div>
          </div>

          {/* Status Filter */}
          <div className="bg-gray-200 p-3 flex flex-wrap gap-2">
            {[
              { key: "all", label: "All" },
              { key: "received", label: "Received" },
              { key: "in_transit", label: "In transet" },
              { key: "arrived", label: "Arrived" },
              { key: "customs", label: "Customs Checking" },
            ].map((filter) => (
              <Button
                key={filter.key}
                variant={statusFilter === filter.key ? "default" : "outline"}
                className={`rounded-full px-4 py-1 h-auto text-sm ${
                  statusFilter === filter.key 
                    ? "bg-slate-800 text-white" 
                    : "bg-white text-gray-600 border-gray-300"
                }`}
                onClick={() => setStatusFilter(filter.key as StatusFilter)}
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {/* Batch List */}
          <div className="flex-1 p-4 overflow-auto">
            {filteredBatches.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No shipments found</p>
              </div>
            ) : (
              filteredBatches.map((batch: any) => (
                <BatchCard
                  key={batch.id}
                  batchNo={batch.batchCode}
                  shippingType={batch.shippingType}
                  status={batch.status}
                  route={batch.route}
                  ctnQuantity={batch.ctnQuantity}
                  trackingNumbers={batch.trackingNumbers}
                  date={batch.departureDate ? new Date(batch.departureDate).toLocaleString() : "-"}
                  eta={2}
                  onViewDetails={() => setSelectedBatch(batch)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Financial Tab */}
      {activeTab === "financial" && (
        <>
          <div className="bg-slate-800 text-white p-4 text-center">
            <h1 className="text-lg font-medium">Financial</h1>
          </div>

          <div className="flex-1 p-4 overflow-auto">
            {/* Balance Card */}
            <Card className="bg-white rounded-2xl mb-4">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-red-100 flex items-center justify-center">
                  <Wallet className="h-7 w-7 text-red-500" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Customer Balance</p>
                  <p className="text-3xl font-bold">${((balance as any) || 0).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Transaction List Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600 font-medium">Transaction List</span>
              <div className="flex gap-2">
                <Badge variant="secondary" className="bg-gray-700 text-white">2024-12-16</Badge>
                <span className="text-gray-400">—</span>
                <Badge variant="secondary" className="bg-gray-700 text-white">2025-12-16</Badge>
              </div>
            </div>

            {/* Transactions */}
            {((myTransactions || []).length === 0 && (myInvoices || []).length === 0) ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No transactions found</p>
              </div>
            ) : (
              <>
                {/* Show ledger entries first */}
                {(myTransactions || []).map((txn: any) => (
                  <TransactionCard
                    key={`txn-${txn.id}`}
                    type={txn.entryType === 'charge' ? 'charge' : 'payment'}
                    number={`TXN-${String(txn.id).padStart(6, '0')}`}
                    amount={parseFloat(txn.amountUsd) || 0}
                    date={new Date(txn.createdAt).toLocaleDateString()}
                    description={txn.description || (txn.entryType === 'charge' ? 'Package delivery charge' : 'Payment received')}
                  />
                ))}
                {/* Show invoices */}
                {(myInvoices || []).map((inv: any) => (
                  <TransactionCard
                    key={`inv-${inv.id}`}
                    type="invoice"
                    number={inv.invoiceNumber}
                    amount={parseFloat(inv.totalUsd) || 0}
                    date={new Date(inv.createdAt).toLocaleDateString()}
                    description={inv.notes || `Invoice for package delivery`}
                  />
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* Me Tab */}
      {activeTab === "me" && (
        <>
          <div className="bg-slate-800 text-white p-4 pb-8 text-center">
            <h1 className="text-lg font-medium mb-4">Me</h1>
            <div className="h-20 w-20 rounded-full bg-gray-200 mx-auto flex items-center justify-center mb-3">
              <User className="h-10 w-10 text-gray-500" />
            </div>
            <p className="text-xl font-medium">{user?.name || "Customer"}</p>
          </div>

          <div className="flex-1 p-4 -mt-4 overflow-auto">
            <Card className="bg-white rounded-2xl">
              <CardContent className="p-0">
                <MenuItem 
                  icon={<div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center"><MessageSquare className="h-5 w-5 text-yellow-600" /></div>}
                  label="Message center"
                  badge={2}
                  onClick={() => toast.info("Message center coming soon")}
                />
                <MenuItem 
                  icon={<div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Bell className="h-5 w-5 text-blue-600" /></div>}
                  label="Notification"
                  badge={7074}
                  onClick={() => toast.info("Notifications coming soon")}
                />
                <MenuItem 
                  icon={<div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center"><MapPin className="h-5 w-5 text-teal-600" /></div>}
                  label="Address"
                  onClick={() => toast.info("Address management coming soon")}
                />
                <MenuItem 
                  icon={<div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><FileText className="h-5 w-5 text-blue-600" /></div>}
                  label="Terms & Conditions"
                  onClick={() => toast.info("Terms & Conditions coming soon")}
                />
                <MenuItem 
                  icon={<div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center"><Handshake className="h-5 w-5 text-yellow-600" /></div>}
                  label="Our Services"
                  onClick={() => toast.info("Our Services coming soon")}
                />
                <MenuItem 
                  icon={<div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div>}
                  label="without shipping mark"
                  onClick={() => toast.info("Feature coming soon")}
                />
                <MenuItem 
                  icon={<div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center"><Globe className="h-5 w-5 text-teal-600" /></div>}
                  label="Online Order Details"
                  onClick={() => toast.info("Online Order Details coming soon")}
                />
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl mt-4">
              <CardContent className="p-0">
                <MenuItem 
                  icon={<div className="h-10 w-10 rounded-lg bg-pink-100 flex items-center justify-center"><Lock className="h-5 w-5 text-pink-600" /></div>}
                  label="Change Password"
                  onClick={() => setShowPasswordDialog(true)}
                />
              </CardContent>
            </Card>

            <Button 
              variant="outline" 
              className="w-full mt-4 text-red-500 border-red-200 hover:bg-red-50 rounded-full"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 me-2" />
              Logout
            </Button>
          </div>
        </>
      )}

      {/* Search Tab */}
      {activeTab === "search" && (
        <>
          <div className="bg-slate-800 text-white p-4 text-center">
            <h1 className="text-lg font-medium">Search</h1>
          </div>
          <div className="flex-1 p-4">
            <Input 
              placeholder="Enter tracking number..." 
              className="rounded-full"
            />
            <div className="text-center py-12 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Search for packages by tracking number</p>
            </div>
          </div>
        </>
      )}

      {/* News Tab */}
      {activeTab === "news" && (
        <>
          <div className="bg-slate-800 text-white p-4 text-center">
            <h1 className="text-lg font-medium">News</h1>
          </div>
          <div className="flex-1 p-4">
            <div className="text-center py-12 text-gray-500">
              <Home className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No news available</p>
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex items-center justify-around py-2 z-50">
        <NavItem 
          icon={<Home className="h-6 w-6" />} 
          label="News" 
          active={activeTab === "news"}
          onClick={() => setActiveTab("news")}
        />
        <NavItem 
          icon={<FileText className="h-6 w-6" />} 
          label="Tran." 
          active={activeTab === "tran"}
          onClick={() => setActiveTab("tran")}
        />
        <button 
          className="h-14 w-14 -mt-6 rounded-full bg-slate-800 flex items-center justify-center text-white shadow-lg"
          onClick={() => setActiveTab("search")}
        >
          <Search className="h-6 w-6" />
        </button>
        <NavItem 
          icon={<Wallet className="h-6 w-6" />} 
          label="Financial" 
          active={activeTab === "financial"}
          onClick={() => setActiveTab("financial")}
        />
        <NavItem 
          icon={<User className="h-6 w-6" />} 
          label="Me" 
          active={activeTab === "me"}
          onClick={() => setActiveTab("me")}
        />
      </nav>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input type="password" placeholder="Current Password" />
            <Input type="password" placeholder="New Password" />
            <Input type="password" placeholder="Confirm New Password" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
            <Button onClick={() => { toast.success("Password updated"); setShowPasswordDialog(false); }}>
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
