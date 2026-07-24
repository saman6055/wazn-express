import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";

// Lazy: only one dashboard renders per role, so keep the others out of this chunk.
const Dashboard = lazy(() => import("./Dashboard"));
const StaffDashboard = lazy(() => import("./StaffDashboard"));
const AccountantDashboard = lazy(() => import("./AccountantDashboard"));

/**
 * Renders the appropriate dashboard based on current user role:
 * - admin / super_admin (owner) → Dashboard (admin dashboard)
 * - employee (staff) → StaffDashboard
 * - accountant → AccountantDashboard
 */
export default function DashboardWrapper() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/staff-login";
    }
  }, [loading, user]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }
  if (!user) {
    return <DashboardLayoutSkeleton />;
  }

  const role = (user as { role?: string }).role ?? "user";

  // admin, super_admin, or any other → Admin/Owner dashboard
  let RoleDashboard = Dashboard;
  if (role === "employee") {
    RoleDashboard = StaffDashboard;
  } else if (role === "accountant") {
    RoleDashboard = AccountantDashboard;
  }

  return (
    <Suspense fallback={<DashboardLayoutSkeleton />}>
      <RoleDashboard />
    </Suspense>
  );
}
