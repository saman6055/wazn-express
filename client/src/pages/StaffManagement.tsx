import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Users, UserPlus, Key, Shield, Eye, EyeOff, Loader2, 
  CheckCircle, XCircle, MoreVertical, RefreshCw, Trash2, AlertTriangle
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";

export default function StaffManagement() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  
  // State for dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  
  // Form state for adding staff
  const [newStaff, setNewStaff] = useState({
    name: "",
    email: "",
    mobileNumber: "",
    password: "",
    role: "employee" as "admin" | "employee" | "accountant",
  });
  const [showPassword, setShowPassword] = useState(false);
  
  // Form state for reset password
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Fetch staff list
  const { data: staffList, isLoading } = trpc.auth.getStaffList.useQuery();

  // Mutations
  const registerMutation = trpc.auth.registerStaff.useMutation({
    onSuccess: () => {
      toast.success(t('staff.staffAdded'));
      setAddDialogOpen(false);
      setNewStaff({ name: "", email: "", mobileNumber: "", password: "", role: "employee" });
      utils.auth.getStaffList.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resetPasswordMutation = trpc.auth.resetStaffPassword.useMutation({
    onSuccess: () => {
      toast.success(t('staff.passwordChanged'));
      setResetDialogOpen(false);
      setNewPassword("");
      setSelectedStaff(null);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const toggleStatusMutation = trpc.auth.toggleStaffStatus.useMutation({
    onSuccess: () => {
      toast.success(t('staff.statusChanged'));
      utils.auth.getStaffList.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteStaffMutation = trpc.auth.deleteStaff.useMutation({
    onSuccess: (data) => {
      toast.success(t('staff.staffDeleted') || `${data.deletedUser} سڕایەوە`);
      setDeleteDialogOpen(false);
      setSelectedStaff(null);
      utils.auth.getStaffList.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Check if current user can delete a specific staff member
  const canDeleteStaff = (staff: any) => {
    if (!currentUser) return false;
    // Cannot delete yourself
    if (staff.id === currentUser.id) return false;
    // Super admin can delete anyone
    if (currentUser.role === 'super_admin') return true;
    // Admin can delete employees and accountants only
    if (currentUser.role === 'admin') {
      return staff.role === 'employee' || staff.role === 'accountant';
    }
    return false;
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.password) {
      toast.error(t('common.fillAllFields'));
      return;
    }
    if (!newStaff.email && !newStaff.mobileNumber) {
      toast.error(t('staff.emailOrMobileRequired') || 'ئیمەیڵ یان ژمارەی مۆبایل پێویستە');
      return;
    }
    registerMutation.mutate({
      name: newStaff.name,
      email: newStaff.email || undefined,
      mobileNumber: newStaff.mobileNumber || undefined,
      password: newStaff.password,
      role: newStaff.role,
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error(t('staff.passwordMinLength'));
      return;
    }
    resetPasswordMutation.mutate({
      userId: selectedStaff.id,
      newPassword,
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-100 text-red-700">{t('roles.admin')}</Badge>;
      case "employee":
        return <Badge className="bg-blue-100 text-blue-700">{t('roles.employee')}</Badge>;
      case "accountant":
        return <Badge className="bg-purple-100 text-purple-700">{t('roles.accountant')}</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-600" />
              {t('staff.management')}
            </h1>
            <p className="text-gray-500 mt-1">{t('staff.managementDesc')}</p>
          </div>
          
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <UserPlus className="w-4 h-4 me-2" />
                {t('staff.addStaff')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('staff.addNewStaff')}</DialogTitle>
                <DialogDescription>
                  {t('staff.enterNewStaffInfo')}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddStaff} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('common.name')}</Label>
                  <Input
                    placeholder={t('staff.fullNamePlaceholder')}
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('common.email')}</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('common.mobileNumber') || 'ژمارەی مۆبایل'}</Label>
                  <Input
                    type="tel"
                    placeholder="07501234567"
                    value={newStaff.mobileNumber}
                    onChange={(e) => setNewStaff({ ...newStaff, mobileNumber: e.target.value })}
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-500">{t('staff.emailOrMobileHint') || 'ئیمەیڵ یان ژمارەی مۆبایل پێویستە (یەکێکیان یان هەردووکیان)'}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('common.password')}</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t('staff.minChars')}
                      value={newStaff.password}
                      onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('common.role')}</Label>
                  <Select
                    value={newStaff.role}
                    onValueChange={(value: "admin" | "employee" | "accountant") => 
                      setNewStaff({ ...newStaff, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">{t('roles.employee')}</SelectItem>
                      <SelectItem value="accountant">{t('roles.accountant')}</SelectItem>
                      <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={registerMutation.isPending}>
                    {registerMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                    {t('common.add')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Staff List */}
        <Card>
          <CardHeader>
            <CardTitle>{t('staff.staffList')}</CardTitle>
            <CardDescription>{t('staff.allSystemStaff')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : !staffList?.length ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('staff.noStaff')}</p>
              </div>
            ) : (
              <div className="divide-y">
                {staffList.map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <Shield className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <p className="text-sm text-gray-500">{staff.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getRoleBadge(staff.role)}
                      {staff.isActive ? (
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          <CheckCircle className="w-3 h-3 me-1" />
                          {t('status.active')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-200">
                          <XCircle className="w-3 h-3 me-1" />
                          {t('status.inactive')}
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedStaff(staff);
                              setResetDialogOpen(true);
                            }}
                          >
                            <Key className="w-4 h-4 me-2" />
                            {t('staff.resetPassword')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              toggleStatusMutation.mutate({
                                userId: staff.id,
                                isActive: !staff.isActive,
                              });
                            }}
                          >
                            <RefreshCw className="w-4 h-4 me-2" />
                            {staff.isActive ? t('staff.deactivate') : t('staff.activate')}
                          </DropdownMenuItem>
                          {canDeleteStaff(staff) && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              onClick={() => {
                                setSelectedStaff(staff);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 me-2" />
                              {t('staff.deleteStaff') || 'سڕینەوە'}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reset Password Dialog */}
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('staff.resetPassword')}</DialogTitle>
              <DialogDescription>
                {t('staff.setNewPasswordFor', { name: selectedStaff?.name })}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('staff.newPassword')}</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder={t('staff.minChars')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResetDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={resetPasswordMutation.isPending}>
                  {resetPasswordMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                  {t('common.change')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Staff Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                {t('staff.confirmDelete') || 'دڵنیایت لە سڕینەوە؟'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-right">
                {t('staff.deleteWarning', { name: selectedStaff?.name }) || 
                  `ئایا دڵنیایت لە سڕینەوەی "${selectedStaff?.name}"؟ ئەم کردارە ناگەڕێتەوە و هەموو داتاکانی ئەم بەکارهێنەرە دەسڕدرێتەوە.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex gap-2">
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (selectedStaff) {
                    deleteStaffMutation.mutate({ userId: selectedStaff.id });
                  }
                }}
                disabled={deleteStaffMutation.isPending}
              >
                {deleteStaffMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                {t('staff.confirmDeleteBtn') || 'بەڵێ، بسڕەوە'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
