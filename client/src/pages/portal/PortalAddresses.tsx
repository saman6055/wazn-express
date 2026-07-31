import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  MapPin, ArrowLeft, Plus, Home, Building2, Store, 
  Phone, User, Edit2, Trash2, Star, Check
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export default function PortalAddresses() {
  // Banner colour follows the mode the customer picked, like every other page.
  const { banner: portalBanner } = usePortalPalette();
const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [formData, setFormData] = useState({
    label: "",
    recipientName: "",
    phone: "",
    city: "",
    district: "",
    street: "",
    building: "",
    floor: "",
    apartment: "",
    landmark: "",
    notes: "",
    isDefault: false,
  });
  
  const { data: addresses, isLoading, refetch } = trpc.customerPortal.getMyAddresses.useQuery();
  
  const createMutation = trpc.customerPortal.createAddress.useMutation({
    onSuccess: () => {
      setIsDialogOpen(false);
      resetForm();
      refetch();
    },
  });
  
  const updateMutation = trpc.customerPortal.updateAddress.useMutation({
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingAddress(null);
      resetForm();
      refetch();
    },
  });
  
  const deleteMutation = trpc.customerPortal.deleteAddress.useMutation({
    onSuccess: () => refetch(),
  });
  
  const setDefaultMutation = trpc.customerPortal.setDefaultAddress.useMutation({
    onSuccess: () => refetch(),
  });
  
  const resetForm = () => {
    setFormData({
      label: "",
      recipientName: "",
      phone: "",
      city: "",
      district: "",
      street: "",
      building: "",
      floor: "",
      apartment: "",
      landmark: "",
      notes: "",
      isDefault: false,
    });
  };
  
  const openEditDialog = (address: any) => {
    setEditingAddress(address);
    setFormData({
      label: address.label || "",
      recipientName: address.recipientName || "",
      phone: address.phone || "",
      city: address.city || "",
      district: address.district || "",
      street: address.street || "",
      building: address.building || "",
      floor: address.floor || "",
      apartment: address.apartment || "",
      landmark: address.landmark || "",
      notes: address.notes || "",
      isDefault: address.isDefault || false,
    });
    setIsDialogOpen(true);
  };
  
  const openNewDialog = () => {
    setEditingAddress(null);
    resetForm();
    setIsDialogOpen(true);
  };
  
  const handleSubmit = () => {
    if (editingAddress) {
      updateMutation.mutate({
        addressId: editingAddress.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };
  
  const getLabelIcon = (label: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes("home") || lowerLabel.includes("house") || lowerLabel.includes("ماڵ")) {
      return <Home className="h-5 w-5" />;
    }
    if (lowerLabel.includes("office") || lowerLabel.includes("work") || lowerLabel.includes("ئۆفیس")) {
      return <Building2 className="h-5 w-5" />;
    }
    if (lowerLabel.includes("shop") || lowerLabel.includes("store") || lowerLabel.includes("دوکان")) {
      return <Store className="h-5 w-5" />;
    }
    return <MapPin className="h-5 w-5" />;
  };
  
  const getLabelColor = (label: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes("home") || lowerLabel.includes("house") || lowerLabel.includes("ماڵ")) {
      return "from-blue-400 to-blue-500";
    }
    if (lowerLabel.includes("office") || lowerLabel.includes("work") || lowerLabel.includes("ئۆفیس")) {
      return "from-purple-400 to-purple-500";
    }
    if (lowerLabel.includes("shop") || lowerLabel.includes("store") || lowerLabel.includes("دوکان")) {
      return "from-amber-400 to-amber-500";
    }
    return "from-teal-400 to-teal-500";
  };

  return (
    <CustomerPortalLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="text-white px-4 py-4" style={portalBanner}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal/profile">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold">My Addresses</h1>
                  <p className="text-xs text-gray-300">
                    {addresses?.length || 0} saved addresses
                  </p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={openNewDialog}
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white"
            >
              <Plus className="h-4 w-4 me-1" />
              Add
            </Button>
          </div>
        </div>
        
        {/* Addresses List */}
        <div className="px-4 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-200 rounded w-full" />
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : addresses?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center mb-4">
                <MapPin className="h-10 w-10 text-teal-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">No Addresses Yet</h3>
              <p className="text-sm text-gray-500 max-w-xs mb-4">
                Add your delivery addresses for faster checkout
              </p>
              <Button onClick={openNewDialog} className="bg-teal-500 hover:bg-teal-600">
                <Plus className="h-4 w-4 me-2" />
                Add Address
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses?.map((address) => (
                <div
                  key={address.id}
                  className={cn(
                    "bg-white rounded-xl p-4 shadow-sm transition-all duration-200",
                    address.isDefault && "border-2 border-teal-500"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0",
                      getLabelColor(address.label)
                    )}>
                      {getLabelIcon(address.label)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800">{address.label}</h3>
                        {address.isDefault && (
                          <span className="bg-teal-100 text-teal-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            Default
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <User className="h-4 w-4 text-gray-400" />
                        {address.recipientName}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Phone className="h-4 w-4 text-gray-400" />
                        {address.phone}
                      </div>
                      
                      <p className="text-sm text-gray-500">
                        {[address.city, address.district, address.street, address.building]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      
                      {address.landmark && (
                        <p className="text-xs text-gray-400 mt-1">
                          Near: {address.landmark}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                    {!address.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                        onClick={() => setDefaultMutation.mutate({ addressId: address.id })}
                        disabled={setDefaultMutation.isPending}
                      >
                        <Check className="h-4 w-4 me-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-600 hover:text-gray-700"
                      onClick={() => openEditDialog(address)}
                    >
                      <Edit2 className="h-4 w-4 me-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this address?")) {
                          deleteMutation.mutate({ addressId: address.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 me-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? "Edit Address" : "Add New Address"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Label */}
              <div className="space-y-2">
                <Label>Address Label *</Label>
                <div className="flex gap-2">
                  {["Home", "Office", "Shop"].map((label) => (
                    <Button
                      key={label}
                      type="button"
                      variant={formData.label === label ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFormData({ ...formData, label })}
                      className={cn(
                        formData.label === label && "bg-teal-500 hover:bg-teal-600"
                      )}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder="Or enter custom label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                />
              </div>
              
              {/* Recipient Name */}
              <div className="space-y-2">
                <Label>Recipient Name *</Label>
                <Input
                  placeholder="Full name of recipient"
                  value={formData.recipientName}
                  onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                />
              </div>
              
              {/* Phone */}
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input
                  placeholder="07XX XXX XXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              
              {/* City */}
              <div className="space-y-2">
                <Label>City *</Label>
                <Input
                  placeholder="e.g., Erbil, Sulaymaniyah, Baghdad"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              
              {/* District */}
              <div className="space-y-2">
                <Label>District / Neighborhood</Label>
                <Input
                  placeholder="e.g., Ankawa, Ainkawa"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                />
              </div>
              
              {/* Street */}
              <div className="space-y-2">
                <Label>Street</Label>
                <Input
                  placeholder="Street name or number"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                />
              </div>
              
              {/* Building Details */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Input
                    placeholder="No."
                    value={formData.building}
                    onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Floor</Label>
                  <Input
                    placeholder="Floor"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apt</Label>
                  <Input
                    placeholder="Apt"
                    value={formData.apartment}
                    onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                  />
                </div>
              </div>
              
              {/* Landmark */}
              <div className="space-y-2">
                <Label>Landmark</Label>
                <Input
                  placeholder="Near a famous place or building"
                  value={formData.landmark}
                  onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                />
              </div>
              
              {/* Notes */}
              <div className="space-y-2">
                <Label>Delivery Notes</Label>
                <Textarea
                  placeholder="Any special instructions for delivery"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
              
              {/* Default Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                />
                <Label htmlFor="isDefault" className="cursor-pointer">
                  Set as default address
                </Label>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-teal-500 hover:bg-teal-600"
                onClick={handleSubmit}
                disabled={
                  !formData.label || 
                  !formData.recipientName || 
                  !formData.phone || 
                  !formData.city ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
              >
                {editingAddress ? "Update" : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </CustomerPortalLayout>
  );
}
