-- ============================================================================
-- Plan v3, Phase 1: Safe edit/delete infrastructure for fullPackageOrders
-- ----------------------------------------------------------------------------
-- Adds three columns + supporting fields that make order editing and deletion
-- atomic, reversible, and free of customer-ledger drift.
--
--   chargeTransactionId → FK to ledgerTransactions.id (the original DEBIT).
--     Lets us adjust or reverse the exact charge instead of guessing.
--
--   version            → optimistic concurrency token. UI sends the loaded
--     version; server rejects edits that disagree. No lost updates.
--
--   deletedAt          → soft-delete marker. All queries filter IS NULL.
--     Orders are never hard-deleted, so audit trail survives.
--
--   deletedById, deletionReason → who/why (shown in audit history).
--
-- All columns are nullable / defaulted so the migration is backward-compatible
-- and does not require downtime. A separate backfill script
-- (scripts/backfill-charge-transaction-id.ts) populates chargeTransactionId
-- for historical orders.
-- ============================================================================

ALTER TABLE `fullPackageOrders`
  ADD COLUMN `chargeTransactionId` int NULL,
  ADD COLUMN `version` int NOT NULL DEFAULT 1,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD COLUMN `deletedById` int NULL,
  ADD COLUMN `deletionReason` text NULL;

-- Partial indexes to keep list queries fast once we start filtering by deletedAt.
CREATE INDEX `idx_fpo_deleted_at` ON `fullPackageOrders` (`deletedAt`);
CREATE INDEX `idx_fpo_charge_txn_id` ON `fullPackageOrders` (`chargeTransactionId`);
