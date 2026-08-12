import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

const EMPTY_ARRAY: never[] = [];

export function useBatches() {
  const listQuery = trpc.batches.list.useQuery();
  const raw = listQuery.data;
  const batches = Array.isArray(raw) ? raw : raw?.data ?? [];
  const createMutation = trpc.batches.create.useMutation();
  const updateMutation = trpc.batches.update.useMutation();
  const updateStatusMutation = trpc.batches.updateStatus.useMutation();
  const deleteMutation = trpc.batches.delete.useMutation();

  return {
    batches,
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    refetch: listQuery.refetch,
    createBatch: createMutation.mutateAsync,
    createMutation,
    updateBatch: updateMutation.mutateAsync,
    updateMutation,
    updateStatus: updateStatusMutation.mutateAsync,
    updateStatusMutation,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    deleteBatch: deleteMutation.mutateAsync,
    deleteMutation,
    isUpdatingStatus: updateStatusMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useBatchById(batchId: number | null) {
  const enabled = batchId != null;
  const batchQuery = trpc.batches.getById.useQuery({ id: batchId ?? 0 }, { enabled });
  return {
    batch: batchQuery.data,
    isLoading: batchQuery.isLoading,
    error: batchQuery.error,
    refetch: batchQuery.refetch,
  };
}

export function useBatchPackages(batchId: number | null) {
  const enabled = batchId != null;
  const query = trpc.batches.getPackages.useQuery({ batchId: batchId ?? 0 }, { enabled });
  const packages = useMemo(() => query.data ?? EMPTY_ARRAY, [query.data]);
  return { packages, isLoading: query.isLoading, refetch: query.refetch };
}

export function useBatchPricingTiers(batchId: number | null) {
  const enabled = batchId != null;
  const query = trpc.batches.getPricingTiers.useQuery({ batchId: batchId ?? 0 }, { enabled });
  const tiers = useMemo(() => query.data ?? EMPTY_ARRAY, [query.data]);
  return { tiers, isLoading: query.isLoading, refetch: query.refetch };
}

export function useBatchCustomerPricing(batchId: number | null) {
  const enabled = batchId != null;
  const query = trpc.batches.getCustomerPricing.useQuery({ batchId: batchId ?? 0 }, { enabled });
  const customerPricing = useMemo(() => query.data ?? EMPTY_ARRAY, [query.data]);
  return { customerPricing, isLoading: query.isLoading, refetch: query.refetch };
}

export function useBatchFinancialSummary(batchId: number | null) {
  const enabled = batchId != null;
  const query = trpc.batches.getFinancialSummary.useQuery({ batchId: batchId ?? 0 }, { enabled });
  return { financialSummary: query.data, isLoading: query.isLoading, refetch: query.refetch };
}
