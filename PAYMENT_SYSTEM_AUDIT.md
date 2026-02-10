# Payment/Balance System Audit Report

## Executive Summary

After comprehensive analysis of the Wazn Express payment and balance system, several critical issues have been identified that need immediate attention. The system has **multiple overlapping systems** for tracking customer balances, which creates confusion and potential data inconsistencies.

---

## Current System Architecture

### Database Tables (Payment/Balance Related)

| Table | Purpose | Status |
|-------|---------|--------|
| `customerAccounts` | New unified customer account system | ✅ Schema exists, ❌ Empty |
| `ledgerTransactions` | New detailed transaction ledger | ✅ Schema exists, ❌ Empty |
| `ledgerEntries` | Old/legacy ledger system | ✅ Schema exists, ❌ Empty |
| `payments` | Old payment records | ✅ Schema exists, ❌ Empty |
| `paymentRecords` | New detailed payment records | ✅ Schema exists, ❌ Empty |
| `creditAdjustments` | Manual balance adjustments | ✅ Schema exists |
| `paymentReminders` | Payment reminder scheduling | ✅ Schema exists |

### Critical Issues Found

#### Issue 1: Dual Ledger Systems (HIGH PRIORITY)
**Problem:** Two separate ledger systems exist:
- `ledgerEntries` (old system) - used by `accounting.*` procedures
- `ledgerTransactions` (new system) - used by `ledger.*` procedures

**Impact:** Code inconsistently uses both systems, causing:
- Balance calculations may be incorrect
- Some transactions recorded in one system, some in another
- Customer portal may show wrong balance

**Evidence:**
```typescript
// Old system (accounting.recordPayment - DEPRECATED)
await db.createLedgerEntry({...});

// New system (ledger.recordPayment)
await db.recordPaymentReceived({...});
```

#### Issue 2: Balance Calculation Inconsistency (HIGH PRIORITY)
**Problem:** `getCustomerBalance()` function has fallback logic that tries multiple sources:
1. First checks `customerAccounts.currentBalanceUsd`
2. If not found, calculates from uncharged delivered packages

**Impact:** If `customerAccounts` record doesn't exist, balance is calculated differently.

#### Issue 3: Customer Accounts Not Auto-Created (MEDIUM)
**Problem:** `customerAccounts` records are not automatically created when a customer is created.

**Impact:** New customers have no account record, causing balance functions to use fallback calculations.

#### Issue 4: UI Shows Irrelevant Data (MEDIUM)
**Problem:** Customer portal financial page shows "چاوەڕوان" (pending), "پارەدراو" (paid), "کۆی وەسڵ" (total invoices) - these are invoice-based concepts that don't apply to a wallet-based system.

**Impact:** Confusing UI that doesn't reflect actual wallet operations.

#### Issue 5: Multiple Payment Recording Paths (MEDIUM)
**Problem:** Payments can be recorded through:
- `accounting.recordPayment` (deprecated but still exists)
- `payments.create`
- `ledger.recordPayment`

**Impact:** Different code paths may use different methods, causing inconsistent data.

---

## Wallet System Requirements (Based on User Feedback)

The system should work as follows:

1. **Customer Wallet (Balance)**
   - Customer deposits money → Balance increases (positive)
   - Shipment delivered → Cost deducted from balance
   - If balance < cost → Balance becomes negative (debt/قەرز)

2. **Balance Display**
   - Positive balance = Customer has credit (پارەی ماوە)
   - Negative balance = Customer owes money (قەرزدار)
   - Zero balance = No debt, no credit

3. **Transaction Types**
   - CREDIT: Deposits, refunds, discounts
   - DEBIT: Package charges, service fees, full package charges

---

## Recommended Fixes

### Phase 1: Unify the System

1. **Deprecate `ledgerEntries`** - Mark as legacy, migrate to `ledgerTransactions`
2. **Auto-create `customerAccounts`** - When customer is created, create account record
3. **Single balance source** - Always use `customerAccounts.currentBalanceUsd`

### Phase 2: Fix Balance Calculation

1. **Remove fallback logic** - `getCustomerBalance()` should only read from `customerAccounts`
2. **Add migration script** - Calculate current balance from all sources and populate `customerAccounts`

### Phase 3: Fix UI

1. **Remove invoice-based stats** - Remove "چاوەڕوان", "پارەدراو", "کۆی وەسڵ"
2. **Add wallet-based stats**:
   - کۆی پارەدان (Total deposits)
   - کۆی خەرجی (Total charges)
   - باڵانسی ئێستا (Current balance)

### Phase 4: Consolidate Payment Recording

1. **Remove deprecated procedures** - Delete `accounting.recordPayment`
2. **Single payment path** - All payments go through `ledger.recordPayment`
3. **Update all callers** - Ensure all code uses the new unified path

---

## Implementation Plan

### Step 1: Auto-create Customer Accounts
- Modify `createCustomer()` to also create `customerAccounts` record
- Create migration to add accounts for existing customers

### Step 2: Unify Balance Functions
- Update `getCustomerBalance()` to only use `customerAccounts`
- Add `ensureCustomerAccount()` helper function

### Step 3: Fix Transaction Recording
- All charges (packages, services, etc.) → Create `ledgerTransactions` entry
- All payments → Create `ledgerTransactions` entry + `paymentRecords` entry
- Update `customerAccounts.currentBalanceUsd` after each transaction

### Step 4: Update Customer Portal UI
- Remove invoice-based stats
- Show wallet balance prominently
- Show transaction history with clear credit/debit indicators

---

## Files to Modify

1. `server/db.ts` - Balance calculation functions
2. `server/routers.ts` - Payment/accounting procedures
3. `client/src/pages/portal/PortalFinancial.tsx` - Customer portal UI
4. `client/src/pages/portal/modern/ModernPortalFinancial.tsx` - Modern theme UI
5. `drizzle/schema.ts` - No changes needed (schema is good)

---

## Testing Checklist

- [ ] Customer creation → Account auto-created
- [ ] Payment recorded → Balance updated correctly
- [ ] Package delivered → Balance charged correctly
- [ ] Customer portal shows correct balance
- [ ] Transaction history shows all transactions
- [ ] Negative balance displayed as debt
- [ ] Positive balance displayed as credit

---

## Conclusion

The payment system has good database schema but poor implementation consistency. The main issues are:
1. Dual systems that should be unified
2. Missing auto-creation of customer accounts
3. UI that doesn't match wallet-based operations

Estimated fix time: 2-3 hours for core fixes, additional time for testing.
