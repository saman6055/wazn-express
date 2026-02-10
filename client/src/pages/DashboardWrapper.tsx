import { useAuth } from "@/_core/hooks/useAuth";
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

  if (loading || !user) {
    return null; // DashboardLayout parent will show skeleton or login
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
