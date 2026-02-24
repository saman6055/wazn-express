import { trpc } from "@/lib/trpc";

export function useCustomerBalance(customerId: number | null) {
  const query = trpc.customers.getBalance.useQuery(
    { customerId: customerId! },
    { enabled: customerId != null }
  );
  return {
    balance: query.data ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCustomerLedger(customerId: number | null) {
  const query = trpc.customers.getLedger.useQuery(
    { customerId: customerId! },
    { enabled: customerId != null }
  );
  return {
    ledger: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useFinanceDashboardStats(period?: string) {
  const query = trpc.financeIntegration.dashboardStats.useQuery(
    period != null ? { period } as any : undefined
  );
  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
