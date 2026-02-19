import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import Dashboard from "./Dashboard";
import StaffDashboard from "./StaffDashboard";
import AccountantDashboard from "./AccountantDashboard";

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

  if (role === "employee") {
    return <StaffDashboard />;
  }
  if (role === "accountant") {
    return <AccountantDashboard />;
  }
  // admin, super_admin, or any other → Admin/Owner dashboard
  return <Dashboard />;
}
