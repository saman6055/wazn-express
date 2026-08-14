import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";

export type CustomerStatusFilter = "all" | "active" | "inactive";

export function useCustomers() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>("all");

  const listQuery = trpc.customers.list.useQuery();
  const customers = listQuery.data ?? [];

  const createMutation = trpc.customers.create.useMutation();
  const updateMutation = trpc.customers.update.useMutation();
  const resetPasswordMutation = trpc.customers.resetPassword.useMutation();
  const uploadDocumentMutation = trpc.customers.uploadDocument.useMutation();
  const deleteDocumentMutation = trpc.customers.deleteDocument.useMutation();

  const setFilters = useCallback((f: { search?: string; status?: CustomerStatusFilter }) => {
    if (f.search !== undefined) setSearch(f.search);
    if (f.status !== undefined) setStatusFilter(f.status);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
  }, []);

  return {
    customers,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    setFilters,
    clearFilters,

    isLoading: listQuery.isLoading,
    error: listQuery.error,
    refetch: listQuery.refetch,

    createCustomer: createMutation.mutateAsync,
    createMutation,
    updateCustomer: updateMutation.mutateAsync,
    updateMutation,
    resetPassword: resetPasswordMutation.mutateAsync,
    resetPasswordMutation,
    uploadDocument: uploadDocumentMutation.mutateAsync,
    uploadDocumentMutation,
    deleteDocument: deleteDocumentMutation.mutateAsync,
    deleteDocumentMutation,

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isResettingPassword: resetPasswordMutation.isPending,
  };
}

export function useCustomerById(customerId: number | null) {
  const query = trpc.customers.getById.useQuery(
    { id: customerId! },
    { enabled: customerId != null }
  );
  return {
    customer: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useFilteredCustomers(
  customers: Array<{ id: number; fullName?: string; customerCode?: string; mobileNumber?: string; isActive?: boolean; city?: string; serviceTypes?: string[] | null; createdAt?: string | Date | null }>,
  vipCustomerIds: number[] | undefined,
  options: {
    search: string;
    statusFilter: CustomerStatusFilter;
    cityFilter?: string;
    governorateFilter?: string;
    balanceFilter?: string;
    vipFilter?: string;
    serviceTypeFilter?: string;
    /**
     * Registered within this many days — what the dashboard's "new customers"
     * figure counts, so opening it lands on exactly those rows.
     */
    createdWithinDays?: number;
  }
) {
  return useMemo(() => {
    const searchLower = options.search.toLowerCase();
    return customers.filter((c) => {
      const matchesSearch =
        !options.search ||
        c.fullName?.toLowerCase().includes(searchLower) ||
        c.customerCode?.toLowerCase().includes(searchLower) ||
        c.mobileNumber?.includes(options.search);
      const matchesStatus =
        options.statusFilter === "all" ||
        (options.statusFilter === "active" && c.isActive) ||
        (options.statusFilter === "inactive" && !c.isActive);
      const matchesCity = !options.cityFilter || c.city === options.cityFilter;
      const isVip = vipCustomerIds?.includes(c.id);
      const matchesVip =
        options.vipFilter === "all" ||
        (options.vipFilter === "vip" && isVip) ||
        (options.vipFilter === "regular" && !isVip);
      const matchesServiceType =
        !options.serviceTypeFilter ||
        options.serviceTypeFilter === "all" ||
        (Array.isArray(c.serviceTypes) && c.serviceTypes.includes(options.serviceTypeFilter));
      // A row whose date cannot be read is kept rather than hidden: the
      // filter is here to narrow a list, not to lose people.
      let matchesCreated = true;
      if (options.createdWithinDays && options.createdWithinDays > 0) {
        const created = c.createdAt ? new Date(c.createdAt).getTime() : NaN;
        if (Number.isFinite(created)) {
          matchesCreated = created >= Date.now() - options.createdWithinDays * 86_400_000;
        }
      }
      return matchesSearch && matchesStatus && matchesCity && matchesVip && matchesServiceType && matchesCreated;
    });
  }, [customers, vipCustomerIds, options.search, options.statusFilter, options.cityFilter, options.vipFilter, options.serviceTypeFilter, options.createdWithinDays]);
}
