# Ledger System Migration Plan

## Current State Analysis

### Two Ledger Systems Exist:
1. **ledgerEntries** (OLD - to be removed)
   - Simple structure: customerId, entryType, amountUsd, description
   - No account linking
   - No balance tracking per transaction
   - Used in legacy code

2. **ledgerTransactions** (NEW - to keep)
   - Professional structure with accountId linking
   - Balance before/after tracking
   - Transaction types: CREDIT_PAYMENT, DEBIT_PACKAGE, etc.
   - Reference type and ID for linking to packages/orders
   - Dual currency support (USD/IQD)

## Files Requiring Changes

### 1. drizzle/schema.ts
- [ ] Remove `ledgerEntries` table definition (lines 254-276)
- [ ] Keep `ledgerTransactions` table

### 2. server/db.ts - Functions to Update

| Function | Current Usage | Action |
|----------|--------------|--------|
| `createLedgerEntry` | Uses ledgerEntries | REMOVE - use createLedgerTransaction |
| `getLedgerEntriesByCustomer` | Uses ledgerEntries | REMOVE - use getAccountLedgerTransactions |
| `getRecentLedgerEntries` | Uses ledgerEntries | REMOVE - use getRecentTransactions |
| `getDailyRevenue` | Uses ledgerEntries | UPDATE to use ledgerTransactions |
| `getTopCustomers` | Uses ledgerEntries | UPDATE to use ledgerTransactions |
| `getCustomersWithDebt` | Uses ledgerEntries | UPDATE to use customerAccounts |
| `getDebtors` | Uses ledgerEntries | UPDATE to use customerAccounts |
| `getCustomerTransactionHistory` | Fallback to ledgerEntries | REMOVE fallback |
| `getRevenueBySource` | Uses ledgerEntries | UPDATE to use ledgerTransactions |
| `resetAllData` | Deletes ledgerEntries | REMOVE ledgerEntries delete |
| `deleteAllLedgerEntries` | Deletes ledgerEntries | REMOVE entire function |
| `deleteOldData` | Deletes ledgerEntries | REMOVE ledgerEntries case |
| `getDataCounts` | Counts ledgerEntries | UPDATE to use ledgerTransactions |
| `getDetailedDataCounts` | Counts ledgerEntries | UPDATE to use ledgerTransactions |

### 3. server/routers.ts
- [ ] Remove deprecated accounting.recordPayment procedure (line 2542-2545)
- [ ] Update any procedures that reference ledgerEntries

### 4. server/data-management.test.ts
- [ ] Update tests to reference ledgerTransactions instead of ledgerEntries

## Migration Steps

### Phase 1: Update Functions (No Breaking Changes)
1. Update `getDailyRevenue` to use ledgerTransactions
2. Update `getTopCustomers` to use customerAccounts + ledgerTransactions
3. Update `getCustomersWithDebt` to use customerAccounts
4. Update `getDebtors` to use customerAccounts
5. Update `getRevenueBySource` to use ledgerTransactions
6. Update `getDataCounts` to use ledgerTransactions
7. Update `getDetailedDataCounts` to use ledgerTransactions

### Phase 2: Remove Legacy Functions
1. Remove `createLedgerEntry`
2. Remove `getLedgerEntriesByCustomer`
3. Remove `getRecentLedgerEntries`
4. Remove `deleteAllLedgerEntries`
5. Remove ledgerEntries fallback from `getCustomerTransactionHistory`

### Phase 3: Clean Up
1. Remove ledgerEntries from schema.ts
2. Remove ledgerEntries import from db.ts
3. Update tests
4. Remove deprecated router procedures

### Phase 4: Database Cleanup
1. Drop ledgerEntries table from database (optional, can keep for historical data)

## New Unified System Architecture

```
customerAccounts (1 per customer)
    ├── accountNumber
    ├── currentBalanceUsd
    ├── currentBalanceIqd
    ├── creditLimitUsd
    └── accountStatus

ledgerTransactions (many per account)
    ├── accountId → customerAccounts.id
    ├── transactionNumber (unique)
    ├── transactionType (CREDIT_PAYMENT, DEBIT_PACKAGE, etc.)
    ├── amountUsd / amountIqd
    ├── balanceBeforeUsd / balanceAfterUsd
    ├── referenceType (package, payment, etc.)
    ├── referenceId
    └── description

paymentRecords (payment details)
    ├── accountId → customerAccounts.id
    ├── amountUsd / amountIqd
    ├── paymentMethod
    ├── receiptNumber
    └── receiptUrl
```

## Testing Checklist

- [ ] Customer balance calculation is accurate
- [ ] Payment recording creates correct ledgerTransaction
- [ ] Package charge creates correct ledgerTransaction
- [ ] Balance updates correctly after each transaction
- [ ] Transaction history shows all transactions
- [ ] Debtors report shows correct balances
- [ ] Revenue reports calculate correctly
- [ ] Top customers report works correctly
