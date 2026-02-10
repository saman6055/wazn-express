import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";

export interface PackageFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  shippingType?: string;
  batchId?: number;
  customerId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export function usePackages(initialFilters?: PackageFilters) {
  const [page, setPage] = useState(initialFilters?.page ?? 1);
  const [pageSize, setPageSize] = useState(initialFilters?.pageSize ?? 50);
  const [search, setSearch] = useState(initialFilters?.search ?? "");
  const [status, setStatus] = useState(initialFilters?.status ?? "all");
  const [shippingType, setShippingType] = useState(initialFilters?.shippingType ?? "all");
  const [batchId, setBatchId] = useState<number | undefined>(initialFilters?.batchId);
  const [dateFrom, setDateFrom] = useState<string | undefined>(initialFilters?.dateFrom);
  const [dateTo, setDateTo] = useState<string | undefined>(initialFilters?.dateTo);

  const listQuery = trpc.packages.list.useQuery(
    {
      page,
      pageSize,
      search: search || undefined,
      status: status !== "all" ? status : undefined,
      shippingType: shippingType !== "all" ? shippingType : undefined,
      batchId,
      dateFrom,
      dateTo,
    },
    { staleTime: 30 * 1000, refetchOnWindowFocus: false }
  );

  const updateStatusMutation = trpc.packages.updateStatus.useMutation();
  const updateMutation = trpc.packages.update.useMutation();
  const deleteMutation = trpc.packages.delete.useMutation();

  const packages = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 0;

  const setFilters = useCallback((f: Partial<PackageFilters>) => {
    if (f.page !== undefined) setPage(f.page);
    if (f.pageSize !== undefined) setPageSize(f.pageSize);
    if (f.search !== undefined) setSearch(f.search);
    if (f.status !== undefined) setStatus(f.status);
    if (f.shippingType !== undefined) setShippingType(f.shippingType);
    if (f.batchId !== undefined) setBatchId(f.batchId);
    if (f.dateFrom !== undefined) setDateFrom(f.dateFrom);
    if (f.dateTo !== undefined) setDateTo(f.dateTo);
  }, []);

  const goToPage = useCallback((p: number) => setPage(Math.max(1, p)), []);

  return {
    packages,
    total,
    totalPages,
    page,
    pageSize,
    setPage,
    setPageSize,
    goToPage,
    search,
    setSearch,
    status,
    setStatus,
    shippingType,
    setShippingType,
    batchId,
    setBatchId,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    setFilters,
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    refetch: listQuery.refetch,
    updateStatus: updateStatusMutation.mutateAsync,
    updateStatusMutation,
    updatePackage: updateMutation.mutateAsync,
    updatePackageMutation: updateMutation,
    deletePackage: deleteMutation.mutateAsync,
    deletePackageMutation: deleteMutation,
    isUpdatingStatus: updateStatusMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
