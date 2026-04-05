import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "../_core/hooks/useAuth";
import { PATH_TO_MODULE } from "../../../shared/permissions";

/**
 * Hook to check if the current user has permission to view a specific module.
 * Only super_admin bypasses all permission checks.
 * Admins and other roles are restricted to their assigned permissions.
 */
export function usePermissions() {
  const { user } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;

  // Fetch permissions for all non-super_admin users (including admin role)
  const { data: userPermissions, isLoading } = trpc.permissions.getUserPermissions.useQuery(
    { userId: userId! },
    {
      enabled: !!userId && userRole !== "super_admin",
      staleTime: 30000, // Cache for 30 seconds
    }
  );

  const permMap = useMemo(() => {
    const map: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }> = {};
    if (userPermissions?.permissions) {
      for (const p of userPermissions.permissions) {
        map[p.module] = {
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        };
      }
    }
    return map;
  }, [userPermissions]);

  const subPermMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (userPermissions?.subPermissions) {
      for (const sp of userPermissions.subPermissions) {
        map[`${sp.module}::${sp.permissionKey}`] = sp.isAllowed;
      }
    }
    return map;
  }, [userPermissions]);

  /**
   * Check if user can view a specific module
   */
  const canViewModule = (moduleName: string): boolean => {
    // Only super_admin has unrestricted access
    if (userRole === "super_admin") return true;

    // While permissions are loading, don't block (show optimistic)
    if (isLoading) return true;

    // If no permission record exists for this module, default to no access
    const perm = permMap[moduleName];
    if (!perm) return false;

    return perm.canView;
  };

  /**
   * Check if a sidebar path should be visible
   */
  const canViewPath = (path: string): boolean => {
    if (userRole === "super_admin") return true;

    const moduleName = PATH_TO_MODULE[path];
    if (!moduleName) return true; // If no mapping, show by default

    return canViewModule(moduleName);
  };

  /**
   * Check specific action on a module
   */
  const hasPermission = (moduleName: string, action: "view" | "create" | "edit" | "delete"): boolean => {
    if (userRole === "super_admin") return true;
    if (isLoading) return true;

    const perm = permMap[moduleName];
    if (!perm) return false;

    const key = `can${action.charAt(0).toUpperCase() + action.slice(1)}` as keyof typeof perm;
    return perm[key];
  };

  /**
   * Check sub-permission
   */
  const hasSubPermission = (moduleName: string, permissionKey: string): boolean => {
    if (userRole === "super_admin") return true;
    if (isLoading) return true;

    return subPermMap[`${moduleName}::${permissionKey}`] || false;
  };

  return {
    canViewModule,
    canViewPath,
    hasPermission,
    hasSubPermission,
    isLoading,
    userRole,
  };
}
