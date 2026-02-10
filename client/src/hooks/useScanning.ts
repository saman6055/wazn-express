import { trpc } from "@/lib/trpc";

export function useScanningTodayStats() {
  const query = trpc.scanning.todayStats.useQuery();
  return {
    todayStats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useScanningRecentScans(limit = 50) {
  const query = trpc.scanning.myRecentScans.useQuery({ limit });
  return {
    recentScans: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useScanningMissingInfo() {
  const query = trpc.scanning.getMissingInfo.useQuery();
  return {
    missingInfo: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useScanningSearchByTracking(trackingNumber: string) {
  const query = trpc.scanning.searchByTracking.useQuery(
    { trackingNumber },
    { enabled: trackingNumber.length > 0 }
  );
  return {
    result: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useScanningRegisterScan() {
  const mutation = trpc.scanning.registerScan.useMutation();
  return {
    registerScan: mutation.mutateAsync,
    mutation,
    isPending: mutation.isPending,
  };
}

export function useScanReportsByDateRange(startDate: string, endDate: string, scanType?: string) {
  const query = trpc.scanReports.getByDateRange.useQuery(
    { startDate, endDate, scanType },
    { enabled: !!startDate && !!endDate }
  );
  return {
    scans: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
