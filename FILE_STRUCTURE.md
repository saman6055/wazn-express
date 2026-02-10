# Wazn Express - File Structure Guide

## Overview

This document explains the file organization of the Wazn Express project to help developers quickly find and modify code.

## Current Structure

```
wazn-express/
├── client/                    # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── pages/            # Page components (70 files)
│   │   ├── components/       # Reusable components
│   │   │   └── ui/          # shadcn/ui components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/           # Custom hooks
│   │   └── lib/             # Utilities
│   └── public/              # Static assets
├── server/                   # Backend (Express + tRPC)
│   ├── routers.ts           # All tRPC procedures (5,800+ lines)
│   ├── db.ts                # All database functions (7,400+ lines)
│   └── _core/               # Framework internals
├── drizzle/                  # Database schema
│   └── schema.ts            # All table definitions
└── shared/                   # Shared types and constants
```

## Recommended New Structure

### Server Side - Split by Feature

```
server/
├── routers/                  # tRPC routers by feature
│   ├── index.ts             # Main router (combines all)
│   ├── auth.router.ts       # Authentication procedures
│   ├── customers.router.ts  # Customer management
│   ├── packages.router.ts   # Package operations
│   ├── batches.router.ts    # Batch management
│   ├── finance.router.ts    # Financial operations
│   ├── invoices.router.ts   # Invoice management
│   ├── scanning.router.ts   # Warehouse scanning
│   ├── reports.router.ts    # Reporting
│   └── settings.router.ts   # System settings
├── db/                       # Database functions by feature
│   ├── index.ts             # Export all functions
│   ├── customers.db.ts      # Customer queries
│   ├── packages.db.ts       # Package queries
│   ├── batches.db.ts        # Batch queries
│   ├── finance.db.ts        # Financial queries
│   ├── invoices.db.ts       # Invoice queries
│   └── reports.db.ts        # Report queries
└── _core/                    # Framework (don't modify)
```

### Client Side - Split by Feature

```
client/src/
├── features/                 # Feature-based organization
│   ├── customers/           # Customer feature
│   │   ├── pages/
│   │   │   ├── CustomerList.tsx
│   │   │   ├── CustomerDetail.tsx
│   │   │   └── CustomerFinance.tsx
│   │   ├── components/
│   │   │   ├── CustomerCard.tsx
│   │   │   └── CustomerForm.tsx
│   │   └── hooks/
│   │       └── useCustomers.ts
│   ├── packages/            # Package feature
│   │   ├── pages/
│   │   ├── components/
│   │   └── hooks/
│   ├── batches/             # Batch feature
│   ├── finance/             # Finance feature
│   ├── scanning/            # Scanning feature
│   └── reports/             # Reports feature
├── components/              # Shared components
│   ├── ui/                  # shadcn/ui (don't modify)
│   ├── layout/              # Layout components
│   └── common/              # Common components
├── hooks/                   # Shared hooks
├── contexts/                # React contexts
└── lib/                     # Utilities
```

## Feature Categories

### 1. Customers (کڕیارەکان)
- **Pages**: Customers.tsx, CustomerDetail.tsx, CustomerFinance.tsx, VipCustomers.tsx
- **Router**: customers procedures
- **DB**: customer queries

### 2. Packages (پاکەتەکان)
- **Pages**: Packages.tsx, PackageDetail.tsx, PackagesDashboard.tsx, QuickRegister.tsx, BulkRegister.tsx
- **Router**: packages procedures
- **DB**: package queries

### 3. Batches (باچەکان)
- **Pages**: Batches.tsx, BatchFinancialReport.tsx
- **Router**: batches procedures
- **DB**: batch queries

### 4. Finance (دارایی)
- **Pages**: FinanceManagement.tsx, Invoices.tsx, RecordPayment.tsx, Expenses.tsx, Treasury.tsx
- **Router**: finance, invoices procedures
- **DB**: finance, invoice queries

### 5. Scanning (سکان)
- **Pages**: WarehouseOperations.tsx, Scanner.tsx, SmartScanner.tsx, ContinuousScan.tsx
- **Router**: scanning procedures
- **DB**: scan queries

### 6. Reports (ڕاپۆرتەکان)
- **Pages**: Reports.tsx, ProfitLossReport.tsx, DebtorsReport.tsx, ScanReports.tsx
- **Router**: reports procedures
- **DB**: report queries

### 7. Settings (ڕێکخستنەکان)
- **Pages**: Settings.tsx, Countries.tsx, Warehouses.tsx, PricingRules.tsx
- **Router**: settings procedures
- **DB**: settings queries

## Naming Conventions

### Files
- **Pages**: `FeatureName.tsx` (PascalCase)
- **Components**: `ComponentName.tsx` (PascalCase)
- **Hooks**: `useHookName.ts` (camelCase with 'use' prefix)
- **Routers**: `feature.router.ts` (lowercase with .router suffix)
- **DB Functions**: `feature.db.ts` (lowercase with .db suffix)

### Functions
- **tRPC Procedures**: `feature.action` (e.g., `customers.list`, `packages.create`)
- **DB Functions**: `actionFeature` (e.g., `getCustomers`, `createPackage`)

## How to Find Code

### Finding a Feature
1. Identify the feature category (customers, packages, etc.)
2. Look in the corresponding folder:
   - Frontend: `client/src/features/{feature}/`
   - Backend Router: `server/routers/{feature}.router.ts`
   - Backend DB: `server/db/{feature}.db.ts`

### Finding a Specific Function
1. Use VS Code search (Ctrl+Shift+F)
2. Search by function name or keyword
3. Use "Go to Definition" (F12)

### Finding Related Code
1. Start from the page component
2. Find the tRPC calls (`trpc.feature.action`)
3. Go to the router to see the procedure
4. Go to db.ts for database queries

## Migration Plan

### Phase 1: Server Reorganization
1. Create `server/routers/` folder
2. Split routers.ts into feature files
3. Update imports in index.ts

### Phase 2: Database Reorganization
1. Create `server/db/` folder
2. Split db.ts into feature files
3. Update imports

### Phase 3: Client Reorganization
1. Create `client/src/features/` folder
2. Move pages to feature folders
3. Extract shared components

## Best Practices

### Avoiding Duplication
1. Extract common code into shared utilities
2. Use custom hooks for repeated logic
3. Create reusable components

### Code Organization
1. Keep files under 500 lines
2. One component per file
3. Group related functions together

### Documentation
1. Add JSDoc comments to functions
2. Document complex logic
3. Keep this file updated
