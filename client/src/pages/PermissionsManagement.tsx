import React, { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield, Save, X, Check, ChevronDown, ChevronRight,
  LayoutDashboard, Package, Boxes, ScanLine, Wallet,
  Landmark, Wrench, BarChart3, Settings, Users, Database,
  Eye, Plus, Pencil, Trash2, Search, ToggleLeft, CheckCircle2,
  XCircle, AlertTriangle, Loader2
} from "lucide-react";
import { PERMISSION_GROUPS, SYSTEM_MODULES } from "../../../shared/permissions";
import type { PermissionGroup, ModulePermissions } from "../../../shared/permissions";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

// Map group icon strings to actual Lucide icons
const GROUP_ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, Package, Boxes, ScanLine, Wallet,
  Landmark, Wrench, BarChart3, Settings, Shield, Database,
};

// Color classes for groups
const GROUP_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", dot: "bg-emerald-500" },
  blue: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-400", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300", dot: "bg-blue-500" },
  violet: { bg: "bg-violet-50 dark:bg-violet-900/20", border: "border-violet-200 dark:border-violet-800", text: "text-violet-700 dark:text-violet-400", badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300", dot: "bg-violet-500" },
  cyan: { bg: "bg-cyan-50 dark:bg-cyan-900/20", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-400", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300", dot: "bg-cyan-500" },
  amber: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", dot: "bg-amber-500" },
  rose: { bg: "bg-rose-50 dark:bg-rose-900/20", border: "border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-400", badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300", dot: "bg-rose-500" },
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-900/20", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-400", badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300", dot: "bg-indigo-500" },
  slate: { bg: "bg-slate-50 dark:bg-slate-900/20", border: "border-slate-200 dark:border-slate-800", text: "text-slate-700 dark:text-slate-400", badge: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300", dot: "bg-slate-500" },
  orange: { bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-400", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300", dot: "bg-orange-500" },
  teal: { bg: "bg-teal-50 dark:bg-teal-900/20", border: "border-teal-200 dark:border-teal-800", text: "text-teal-700 dark:text-teal-400", badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300", dot: "bg-teal-500" },
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  view: Eye,
  create: Plus,
  edit: Pencil,
  delete: Trash2,
};

const ACTION_LABELS: Record<string, { ku: string; en: string; ar: string; zh: string }> = {
  view: { ku: "بینین", en: "View", ar: "عرض", zh: "查看" },
  create: { ku: "دروستکردن", en: "Create", ar: "إنشاء", zh: "创建" },
  edit: { ku: "دەستکاری", en: "Edit", ar: "تعديل", zh: "编辑" },
  delete: { ku: "سڕینەوە", en: "Delete", ar: "حذف", zh: "删除" },
};

interface PermState {
  permissions: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;
  subPermissions: Record<string, boolean>; // key: `${module}::${permKey}`
}

export default function PermissionsManagement() {
  const { language } = useTranslation();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [showAllGroups, setShowAllGroups] = useState(false);

  // Permission state
  const [permState, setPermState] = useState<PermState>({
    permissions: {},
    subPermissions: {},
  });

  // Get current user info
  const { data: currentUser, isLoading: isLoadingCurrentUser } = trpc.auth.me.useQuery();
  const currentUserRole = currentUser?.role;

  // Query all staff users
  const { data: users, isLoading: usersLoading } = trpc.users.list.useQuery();

  // Filter staff members based on role hierarchy
  const staffMembers = useMemo(() => {
    if (isLoadingCurrentUser || !users || !currentUserRole) return [];
    return users.filter(u => {
      if (currentUserRole === "super_admin") {
        return u.role === "admin" || u.role === "employee" || u.role === "accountant" || u.role === "super_admin";
      }
      if (currentUserRole === "admin") {
        return u.role === "employee" || u.role === "accountant";
      }
      return false;
    });
  }, [users, currentUserRole, isLoadingCurrentUser]);

  // Get permissions for selected user
  const { data: userPermissions, refetch: refetchPermissions, isLoading: permsLoading } = trpc.permissions.getUserPermissions.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );

  // Mutation for bulk update
  const bulkUpdateMutation = trpc.permissions.bulkUpdate.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "مۆڵەتەکان بە سەرکەوتوویی نوێ کرانەوە", en: "Permissions updated successfully", ar: "تم تحديث الصلاحيات بنجاح", zh: "权限更新成功" }));
      refetchPermissions();
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error(`${pickLang(language, { ku: "هەڵە", en: "Error", ar: "خطأ", zh: "错误" })}: ${error.message}`);
    },
  });

  // Load permissions when user is selected
  useEffect(() => {
    if (userPermissions) {
      const perms: PermState["permissions"] = {};
      const subPerms: PermState["subPermissions"] = {};

      for (const p of userPermissions.permissions || []) {
        perms[p.module] = {
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        };
      }
      for (const sp of userPermissions.subPermissions || []) {
        subPerms[`${sp.module}::${sp.permissionKey}`] = sp.isAllowed;
      }

      setPermState({ permissions: perms, subPermissions: subPerms });
      setHasChanges(false);
      setShowAllGroups(false);

      // Auto-expand groups that have at least one enabled permission
      const groupsWithPerms = new Set<string>();
      for (const group of PERMISSION_GROUPS) {
        const hasAny = group.modules.some(mod => {
          const p = perms[mod.module];
          if (!p) return false;
          return p.canView || p.canCreate || p.canEdit || p.canDelete;
        });
        if (hasAny) groupsWithPerms.add(group.id);
      }
      setExpandedGroups(groupsWithPerms);
    }
  }, [userPermissions]);

  // Permission helpers
  const getModulePerm = (module: string) => {
    return permState.permissions[module] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
  };

  const toggleModuleAction = (module: string, action: string, value: boolean) => {
    const current = getModulePerm(module);
    const actionKey = `can${action.charAt(0).toUpperCase() + action.slice(1)}` as keyof typeof current;
    setPermState(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [module]: { ...current, [actionKey]: value },
      },
    }));
    setHasChanges(true);
  };

  const toggleEntireModule = (module: string, actions: string[], enabled: boolean) => {
    const perm: any = { canView: false, canCreate: false, canEdit: false, canDelete: false };
    for (const a of actions) {
      const key = `can${a.charAt(0).toUpperCase() + a.slice(1)}`;
      perm[key] = enabled;
    }
    setPermState(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [module]: perm },
    }));
    setHasChanges(true);
  };

  const isModuleFullyEnabled = (module: string, actions: string[]) => {
    const perm = getModulePerm(module);
    return actions.every(a => {
      const key = `can${a.charAt(0).toUpperCase() + a.slice(1)}` as keyof typeof perm;
      return perm[key];
    });
  };

  const isModulePartiallyEnabled = (module: string, actions: string[]) => {
    const perm = getModulePerm(module);
    const enabled = actions.filter(a => {
      const key = `can${a.charAt(0).toUpperCase() + a.slice(1)}` as keyof typeof perm;
      return perm[key];
    });
    return enabled.length > 0 && enabled.length < actions.length;
  };

  const getSubPerm = (module: string, key: string) => {
    return permState.subPermissions[`${module}::${key}`] || false;
  };

  const toggleSubPerm = (module: string, key: string, value: boolean) => {
    setPermState(prev => ({
      ...prev,
      subPermissions: { ...prev.subPermissions, [`${module}::${key}`]: value },
    }));
    setHasChanges(true);
  };

  // Enable all permissions for a group
  const toggleEntireGroup = (group: PermissionGroup, enabled: boolean) => {
    const newPerms = { ...permState.permissions };
    const newSubPerms = { ...permState.subPermissions };
    for (const mod of group.modules) {
      const perm: any = { canView: false, canCreate: false, canEdit: false, canDelete: false };
      for (const a of mod.actions) {
        perm[`can${a.charAt(0).toUpperCase() + a.slice(1)}`] = enabled;
      }
      newPerms[mod.module] = perm;
      for (const sp of mod.subPermissions) {
        newSubPerms[`${mod.module}::${sp.key}`] = enabled;
      }
    }
    setPermState({ permissions: newPerms, subPermissions: newSubPerms });
    setHasChanges(true);
  };

  const isGroupFullyEnabled = (group: PermissionGroup) => {
    return group.modules.every(m => isModuleFullyEnabled(m.module, m.actions));
  };

  const isGroupPartiallyEnabled = (group: PermissionGroup) => {
    const allFull = group.modules.every(m => isModuleFullyEnabled(m.module, m.actions));
    const anyEnabled = group.modules.some(m => {
      const perm = getModulePerm(m.module);
      return m.actions.some(a => {
        const key = `can${a.charAt(0).toUpperCase() + a.slice(1)}` as keyof typeof perm;
        return perm[key];
      });
    });
    return anyEnabled && !allFull;
  };

  // Enable ALL permissions
  const enableAll = () => {
    const newPerms: PermState["permissions"] = {};
    const newSubPerms: PermState["subPermissions"] = {};
    for (const mod of SYSTEM_MODULES) {
      const perm: any = { canView: false, canCreate: false, canEdit: false, canDelete: false };
      for (const a of mod.actions) {
        perm[`can${a.charAt(0).toUpperCase() + a.slice(1)}`] = true;
      }
      newPerms[mod.module] = perm;
      for (const sp of mod.subPermissions) {
        newSubPerms[`${mod.module}::${sp.key}`] = true;
      }
    }
    setPermState({ permissions: newPerms, subPermissions: newSubPerms });
    setShowAllGroups(true);
    setExpandedGroups(new Set(PERMISSION_GROUPS.map(g => g.id)));
    setHasChanges(true);
  };

  // Disable ALL permissions
  const disableAll = () => {
    setPermState({ permissions: {}, subPermissions: {} });
    setHasChanges(true);
  };

  // Save permissions
  const savePermissions = () => {
    if (!selectedUserId) return;

    const permissions = Object.entries(permState.permissions).map(([module, perm]) => ({
      module,
      canView: perm.canView,
      canCreate: perm.canCreate,
      canEdit: perm.canEdit,
      canDelete: perm.canDelete,
    }));

    const subPermissions = Object.entries(permState.subPermissions).map(([key, isAllowed]) => {
      const [module, permissionKey] = key.split("::");
      return { module, permissionKey, isAllowed };
    });

    bulkUpdateMutation.mutate({ userId: selectedUserId, permissions, subPermissions });
  };

  // Count enabled permissions for a user summary
  const countEnabled = () => {
    let total = 0;
    let enabled = 0;
    for (const mod of SYSTEM_MODULES) {
      total += mod.actions.length;
      const perm = getModulePerm(mod.module);
      for (const a of mod.actions) {
        const key = `can${a.charAt(0).toUpperCase() + a.slice(1)}` as keyof typeof perm;
        if (perm[key]) enabled++;
      }
    }
    return { total, enabled };
  };

  // Role badge colors
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin": return "bg-purple-600 text-white";
      case "admin": return "bg-blue-600 text-white";
      case "employee": return "bg-green-600 text-white";
      case "accountant": return "bg-orange-600 text-white";
      default: return "bg-gray-600 text-white";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin": return pickLang(language, { ku: "سوپەر ئەدمین", en: "Super Admin", ar: "مدير عام", zh: "超级管理员" });
      case "admin": return pickLang(language, { ku: "ئەدمین", en: "Admin", ar: "مدير", zh: "管理员" });
      case "employee": return pickLang(language, { ku: "کارمەند", en: "Employee", ar: "موظف", zh: "员工" });
      case "accountant": return pickLang(language, { ku: "ژمێریار", en: "Accountant", ar: "محاسب", zh: "会计" });
      default: return role;
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Check if a group has at least one active permission for the selected user
  const groupHasActivePerms = (group: PermissionGroup) => {
    return group.modules.some(mod => {
      const p = permState.permissions[mod.module];
      if (!p) return false;
      return p.canView || p.canCreate || p.canEdit || p.canDelete;
    });
  };

  // Filter groups by search and active-only toggle
  const filteredGroups = useMemo(() => {
    let groups = PERMISSION_GROUPS;

    // If not showing all, only show groups with at least one active permission
    if (selectedUserId && !showAllGroups && !searchQuery.trim()) {
      groups = groups.filter(g => groupHasActivePerms(g));
    }

    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase().trim();

    // Searching only the module's own two labels meant typing the name of a
    // section ("ڕێکخستنەکان") or of a specific permission inside a module
    // ("بینینی زانیاری دارایی") found nothing at all. Both are what somebody
    // actually remembers when they come here looking for a switch.
    const matches = (...values: (string | undefined)[]) =>
      values.some((v) => v?.toLowerCase().includes(q));

    return groups
      .map((g) => {
        // A group whose own name matches keeps all of its modules — you asked
        // for the section, not for one row inside it.
        if (matches(g.label, g.labelKu, g.id)) return g;
        return {
          ...g,
          modules: g.modules.filter(
            (m) =>
              matches(m.label, m.labelKu, m.module) ||
              m.subPermissions.some((sp) => matches(sp.label, sp.labelKu, sp.key))
          ),
        };
      })
      .filter((g) => g.modules.length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, showAllGroups, selectedUserId, permState.permissions]);

  const selectedUser = staffMembers.find(u => u.id === selectedUserId);
  const { total, enabled } = selectedUserId ? countEnabled() : { total: 0, enabled: 0 };

  if (usersLoading || isLoadingCurrentUser) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Shield className="h-7 w-7 text-blue-600 dark:text-blue-300" />
              </div>
              {pickLang(language, { ku: "بەڕێوەبردنی مۆڵەتەکان", en: "Permissions Management", ar: "إدارة الصلاحيات", zh: "权限管理" })}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {pickLang(language, { ku: "دیاریکردنی دەستەڵاتی هەر کارمەندێک بۆ هەر بەشێکی سیستەم", en: "Define each staff member's authority for every section of the system", ar: "تحديد صلاحيات كل موظف لكل قسم من أقسام النظام", zh: "为每位员工设置系统各部分的权限" })}
            </p>
          </div>
          {selectedUserId && hasChanges && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { refetchPermissions(); setHasChanges(false); }}>
                <X className="h-4 w-4 me-1" />
                {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Discard", ar: "تراجع", zh: "撤销" })}
              </Button>
              <Button size="sm" onClick={savePermissions} disabled={bulkUpdateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {bulkUpdateMutation.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Save className="h-4 w-4 me-1" />}
                {pickLang(language, { ku: "پاشەکەوتکردن", en: "Save", ar: "حفظ", zh: "保存" })}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* ─── Staff List Sidebar ─── */}
          <div className="lg:col-span-3">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{pickLang(language, { ku: "کارمەندان", en: "Staff", ar: "الموظفون", zh: "员工" })}</CardTitle>
                <CardDescription className="text-xs">{pickLang(language, { ku: "کارمەندێک هەڵبژێرە بۆ ڕێکخستنی مۆڵەتەکانی", en: "Select a staff member to configure their permissions", ar: "اختر موظفًا لضبط صلاحياته", zh: "选择一名员工以配置其权限" })}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="p-3 space-y-1.5">
                    {staffMembers.map((user) => {
                      const isSelected = selectedUserId === user.id;
                      return (
                        <button
                          key={user.id}
                          onClick={() => { setSelectedUserId(user.id); setShowAllGroups(false); setSearchQuery(""); }}
                          className={`w-full text-right p-3 rounded-xl border transition-all duration-200 ${
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 shadow-sm"
                              : "hover:bg-accent/50 border-transparent hover:border-border"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                              isSelected ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                            }`}>
                              {(user.name || "?").charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate">{user.name || pickLang(language, { ku: "بێ ناو", en: "No name", ar: "بدون اسم", zh: "无姓名" })}</div>
                              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                              <Badge className={`mt-1 text-[10px] px-1.5 py-0 ${getRoleBadgeColor(user.role)}`}>
                                {getRoleLabel(user.role)}
                              </Badge>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-blue-600 dark:text-blue-300 shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* ─── Permissions Panel ─── */}
          <div className="lg:col-span-9">
            {!selectedUserId ? (
              <Card className="h-[60vh] flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="mx-auto w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Shield className="h-10 w-10 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">{pickLang(language, { ku: "تکایە کارمەندێک هەڵبژێرە", en: "Please select a staff member", ar: "الرجاء اختيار موظف", zh: "请选择一名员工" })}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{pickLang(language, { ku: "لە لیستی کارمەندان کارمەندێک هەڵبژێرە بۆ بەڕێوەبردنی مۆڵەتەکانی", en: "Select a staff member from the list to manage their permissions", ar: "اختر موظفًا من القائمة لإدارة صلاحياته", zh: "从列表中选择一名员工以管理其权限" })}</p>
                  </div>
                </div>
              </Card>
            ) : permsLoading ? (
              <Card className="h-[60vh] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </Card>
            ) : (
              <div className="space-y-4">
                {/* User Info Bar */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold">
                          {(selectedUser?.name || "?").charAt(0)}
                        </div>
                        <div>
                          <h2 className="text-lg font-bold">{selectedUser?.name}</h2>
                          <div className="flex items-center gap-2">
                            <Badge className={getRoleBadgeColor(selectedUser?.role || "")}>
                              {getRoleLabel(selectedUser?.role || "")}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{selectedUser?.email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Progress indicator */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                          <div className="text-xs text-muted-foreground">{pickLang(language, { ku: "مۆڵەتی چالاک:", en: "Active permissions:", ar: "الصلاحيات النشطة:", zh: "已启用权限：" })}</div>
                          <div className="text-sm font-bold text-blue-600 dark:text-blue-300">{enabled}</div>
                          <div className="text-xs text-muted-foreground">/ {total}</div>
                        </div>
                        <Button variant="outline" size="sm" onClick={enableAll} className="text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 me-1" />
                          {pickLang(language, { ku: "هەمووی چالاک", en: "Enable all", ar: "تفعيل الكل", zh: "全部启用" })}
                        </Button>
                        <Button variant="outline" size="sm" onClick={disableAll} className="text-xs">
                          <XCircle className="h-3.5 w-3.5 me-1" />
                          {pickLang(language, { ku: "هەمووی ناچالاک", en: "Disable all", ar: "تعطيل الكل", zh: "全部禁用" })}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Search + toggle */}
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={pickLang(language, { ku: "گەڕان بۆ مۆڵەت...", en: "Search for a permission...", ar: "البحث عن صلاحية...", zh: "搜索权限..." })}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <Button
                    variant={showAllGroups ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowAllGroups(v => !v)}
                    className={`shrink-0 text-xs gap-1.5 ${showAllGroups ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                  >
                    <ToggleLeft className="h-3.5 w-3.5" />
                    {showAllGroups ? pickLang(language, { ku: "تەنیا چالاکەکان", en: "Active only", ar: "النشطة فقط", zh: "仅显示已启用" }) : pickLang(language, { ku: "هەموو بەشەکان", en: "All sections", ar: "كل الأقسام", zh: "全部部分" })}
                  </Button>
                </div>

                {/* Permission Groups */}
                <div className="space-y-3">
                  {filteredGroups.length === 0 && !searchQuery.trim() && !showAllGroups && (
                    <Card className="py-12">
                      <div className="text-center space-y-3">
                        <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <Shield className="h-7 w-7 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-600 dark:text-gray-300">{pickLang(language, { ku: "هیچ مۆڵەتێک دیاری نەکراوە", en: "No permissions assigned", ar: "لم يتم تعيين أي صلاحية", zh: "未分配任何权限" })}</p>
                          <p className="text-xs text-muted-foreground mt-1">{pickLang(language, { ku: "بەستەرەکەی خوارەوە بکە بۆ زیادکردنی مۆڵەت", en: "Click the button below to add a permission", ar: "اضغط الزر أدناه لإضافة صلاحية", zh: "点击下方按钮添加权限" })}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setShowAllGroups(true)} className="text-xs gap-1.5">
                          <ToggleLeft className="h-3.5 w-3.5" />
                          {pickLang(language, { ku: "نیشاندانی هەموو بەشەکان", en: "Show all sections", ar: "عرض كل الأقسام", zh: "显示全部部分" })}
                        </Button>
                      </div>
                    </Card>
                  )}
                  {filteredGroups.map((group) => {
                    const colors = GROUP_COLORS[group.color] || GROUP_COLORS.slate;
                    const IconComp = GROUP_ICONS[group.icon] || Shield;
                    const isExpanded = expandedGroups.has(group.id);
                    const groupFull = isGroupFullyEnabled(group);
                    const groupPartial = isGroupPartiallyEnabled(group);

                    return (
                      <Card key={group.id} className={`overflow-hidden border ${groupFull ? colors.border : "border-border"}`}>
                        {/* Group Header */}
                        <div
                          className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                            groupFull ? colors.bg : "hover:bg-accent/30"
                          }`}
                          onClick={() => toggleGroup(group.id)}
                        >
                          <div className="flex items-center gap-3">
                            <button className="p-0.5">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </button>
                            <div className={`p-1.5 rounded-lg ${colors.bg}`}>
                              <IconComp className={`h-4 w-4 ${colors.text}`} />
                            </div>
                            <div>
                              <span className="font-semibold text-sm">{pickLang(language, { ku: group.labelKu, en: group.label, ar: group.label, zh: group.label })}</span>
                              <span className="text-xs text-muted-foreground ms-2">({group.modules.length} {pickLang(language, { ku: "بەش", en: "sections", ar: "أقسام", zh: "部分" })})</span>
                            </div>
                            {groupFull && (
                              <Badge className={`text-[10px] ${colors.badge}`}>{pickLang(language, { ku: "هەمووی چالاک", en: "All enabled", ar: "الكل مفعّل", zh: "全部启用" })}</Badge>
                            )}
                            {groupPartial && (
                              <Badge variant="outline" className="text-[10px]">{pickLang(language, { ku: "هەندێک چالاک", en: "Partially enabled", ar: "مفعّل جزئيًا", zh: "部分启用" })}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={groupFull}
                              onCheckedChange={(checked) => toggleEntireGroup(group, checked)}
                              className="data-[state=checked]:bg-blue-600"
                            />
                          </div>
                        </div>

                        {/* Group Content */}
                        {isExpanded && (
                          <div className="border-t border-border">
                            {group.modules.map((mod, idx) => {
                              const modFull = isModuleFullyEnabled(mod.module, mod.actions);
                              const modPartial = isModulePartiallyEnabled(mod.module, mod.actions);

                              return (
                                <div key={mod.module}>
                                  {idx > 0 && <Separator />}
                                  <div className="px-4 py-3">
                                    {/* Module Row */}
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${modFull ? colors.dot : modPartial ? "bg-yellow-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                                        <span className="font-medium text-sm">{pickLang(language, { ku: mod.labelKu, en: mod.label, ar: mod.label, zh: mod.label })}</span>
                                      </div>
                                      <Switch
                                        checked={modFull}
                                        onCheckedChange={(checked) => toggleEntireModule(mod.module, mod.actions, checked)}
                                        className="data-[state=checked]:bg-blue-600 scale-90"
                                      />
                                    </div>

                                    {/* Action Toggles */}
                                    <div className="flex flex-wrap gap-2 ms-4">
                                      {mod.actions.map((action) => {
                                        const ActionIcon = ACTION_ICONS[action] || Eye;
                                        const perm = getModulePerm(mod.module);
                                        const actionKey = `can${action.charAt(0).toUpperCase() + action.slice(1)}` as keyof typeof perm;
                                        const isOn = perm[actionKey];

                                        return (
                                          <button
                                            key={action}
                                            onClick={() => toggleModuleAction(mod.module, action, !isOn)}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 border ${
                                              isOn
                                                ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                                                : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                                            }`}
                                          >
                                            <ActionIcon className="h-3 w-3" />
                                            {pickLang(language, ACTION_LABELS[action])}
                                            {isOn ? (
                                              <Check className="h-3 w-3 text-blue-600 dark:text-blue-300" />
                                            ) : (
                                              <X className="h-3 w-3 text-gray-400" />
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {/* Sub-Permissions */}
                                    {mod.subPermissions.length > 0 && (
                                      <div className="mt-3 ms-4 space-y-1.5">
                                        <div className="text-[11px] text-muted-foreground font-medium mb-1">{pickLang(language, { ku: "مۆڵەتە تایبەتەکان:", en: "Special permissions:", ar: "صلاحيات خاصة:", zh: "特殊权限：" })}</div>
                                        {mod.subPermissions.map((sp) => {
                                          const isOn = getSubPerm(mod.module, sp.key);
                                          return (
                                            <div
                                              key={sp.key}
                                              className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/30"
                                            >
                                              <div>
                                                <span className="text-xs font-medium">{pickLang(language, { ku: sp.labelKu, en: sp.label, ar: sp.label, zh: sp.label })}</span>
                                                <span className="text-[10px] text-muted-foreground ms-2">{pickLang(language, { ku: sp.descriptionKu, en: sp.description, ar: sp.description, zh: sp.description })}</span>
                                              </div>
                                              <Switch
                                                checked={isOn}
                                                onCheckedChange={(checked) => toggleSubPerm(mod.module, sp.key, checked)}
                                                className="data-[state=checked]:bg-blue-600 scale-75"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>

                {/* Floating Save Bar */}
                {hasChanges && (
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                    <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-2xl">
                      <AlertTriangle className="h-4 w-4 text-yellow-400 dark:text-yellow-600" />
                      <span className="text-sm font-medium">{pickLang(language, { ku: "گۆڕانکارییەکان پاشەکەوت نەکراوە", en: "Unsaved changes", ar: "تغييرات غير محفوظة", zh: "未保存的更改" })}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { refetchPermissions(); setHasChanges(false); }}
                        className="bg-transparent border-gray-600 dark:border-gray-400 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 text-xs"
                      >
                        {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Discard", ar: "تراجع", zh: "撤销" })}
                      </Button>
                      <Button
                        size="sm"
                        onClick={savePermissions}
                        disabled={bulkUpdateMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                      >
                        {bulkUpdateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" /> : <Save className="h-3.5 w-3.5 me-1" />}
                        {pickLang(language, { ku: "پاشەکەوتکردن", en: "Save", ar: "حفظ", zh: "保存" })}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
