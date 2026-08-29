import { getDb } from './connection';
import { eq, ne, desc, asc, and, gte, lte, lt, gt, sql, or, like, isNull, isNotNull, count, inArray, notInArray, SQL } from "drizzle-orm";
import { chargeableWeight, isAirShipping } from '@shared/chargeableWeight';
import { customerBatchStatus } from '@shared/customerBatchStage';
import { concealsSizeAndCarriage, concealParcelSize } from '@shared/fullPackagePrivacy';
import { CHARGE_TX_TYPES, PAYMENT_TX_TYPES } from '@shared/ledgerTypes';
import { getVolumetricDivisor } from './settings.db';
import { getCustomerAccountByCustomerId } from './finance.db';
import { selfOrderWhere } from './selfOrder.filter';
import { getBatchStatusTimestamps, getBatchRateForCustomer } from './batches.db';
import {
  InsertUser, users,
  customers, InsertCustomer, Customer,
  customerFeatures,
  customerCodePrefixes, InsertCustomerCodePrefix, CustomerCodePrefix,
  countries, InsertCountry, Country,
  warehouses, InsertWarehouse, Warehouse,
  pricingRules, InsertPricingRule, PricingRule,
  batches, InsertBatch, Batch,
  packages, InsertPackage, Package,
  invoices, InsertInvoice, Invoice,
  exchangeRates, InsertExchangeRate, ExchangeRate,
  auditLogs, InsertAuditLog,
  permissions, subPermissions,
  notificationLogs, InsertNotificationLog,
  systemSettings, InsertSystemSetting,
  currencies, taxRates, emailTemplates, ipWhitelist,
  fullPackageOrders, InsertFullPackageOrder, FullPackageOrder,
  suppliers, InsertSupplier, Supplier,
  fullPackageStatusHistory, InsertFullPackageStatusHistory, FullPackageStatusHistory,
  customerNotificationPrefs, InsertCustomerNotificationPref, CustomerNotificationPref,
  vipCustomers, InsertVipCustomer, VipCustomer,
  packageQrCodes, InsertPackageQrCode, PackageQrCode,
  scheduledTasksLog, InsertScheduledTaskLog, ScheduledTaskLog,
  packageScans, InsertPackageScan, PackageScan,
  packageStatusHistory, InsertPackageStatusHistory, PackageStatusHistory,
  scanDevices, InsertScanDevice, ScanDevice,
  customerAccounts, InsertCustomerAccount, CustomerAccount,
  ledgerTransactions, InsertLedgerTransaction, LedgerTransaction,
  paymentRecords, InsertPaymentRecord, PaymentRecord,
  creditAdjustments, InsertCreditAdjustment, CreditAdjustment,
  paymentReminders, InsertPaymentReminder, PaymentReminder,
  productCategories, InsertProductCategory, ProductCategory,
  batchPricingTiers, InsertBatchPricingTier, BatchPricingTier,
  batchCustomerPricing, InsertBatchCustomerPricing, BatchCustomerPricing,
  notificationSettings, InsertNotificationSetting, NotificationSetting,
  expenseCategories, InsertExpenseCategory, ExpenseCategory,
  expenses, InsertExpense, Expense,
  partners, InsertPartner, Partner,
  partnerTransactions, InsertPartnerTransaction, PartnerTransaction,
  companyDebts, InsertCompanyDebt, CompanyDebt,
  debtPayments, InsertDebtPayment, DebtPayment,
  cashAccounts, InsertCashAccount, CashAccount,
  cashTransactions, InsertCashTransaction, CashTransaction,
  financialPeriods, InsertFinancialPeriod, FinancialPeriod,
  scanHistory, InsertScanHistory, ScanHistory,
  serviceTypes, InsertServiceType, ServiceType,
  extraServices, InsertExtraService, ExtraService,
  packageClaimRequests, InsertPackageClaimRequest, PackageClaimRequest,
  stockCategories, InsertStockCategory, StockCategory,
  stockProducts, InsertStockProduct, StockProduct,
  stockPurchases, InsertStockPurchase, StockPurchase,
  stockPurchaseItems, InsertStockPurchaseItem, StockPurchaseItem,
  stockSales, InsertStockSale, StockSale,
  stockSaleItems, InsertStockSaleItem, StockSaleItem,
  stockMovements, InsertStockMovement, StockMovement,
  customerMessages, InsertCustomerMessage, CustomerMessage,
  customerAddresses, InsertCustomerAddress, CustomerAddress,
  notificationTemplates, InsertNotificationTemplate, NotificationTemplate,
  labelTemplates, InsertLabelTemplate, LabelTemplate,
  invoiceTemplates, InsertInvoiceTemplate, InvoiceTemplate,
  customerNotifications, InsertCustomerNotification, CustomerNotification,
  customerPushSubscriptions, InsertCustomerPushSubscription, CustomerPushSubscription,
  pushNotificationCampaigns, InsertPushNotificationCampaign, PushNotificationCampaign,
  revenueRecords, InsertRevenueRecord, RevenueRecord,
  dailyFinancialSummary, InsertDailyFinancialSummary, DailyFinancialSummary,
  blogPosts, InsertBlogPost, BlogPost,
  deletionLogs, InsertDeletionLog, DeletionLog,
  activityAlerts, InsertActivityAlert, ActivityAlert,
  supportChats, InsertSupportChat, SupportChat,
  chatMessages, InsertChatMessage, ChatMessage,
  backups, InsertBackup, Backup,
  expenseAlerts, InsertExpenseAlert, ExpenseAlert,
  expenseAlertLogs, InsertExpenseAlertLog, ExpenseAlertLog
} from "../../drizzle/schema";

// ============ NOTIFICATION PREFERENCES OPERATIONS ============

export async function getNotificationPrefs(customerId: number): Promise<CustomerNotificationPref | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customerNotificationPrefs)
    .where(eq(customerNotificationPrefs.customerId, customerId))
    .limit(1);
  return result[0];
}

export async function upsertNotificationPrefs(customerId: number, prefs: Partial<InsertCustomerNotificationPref>) {
  const db = await getDb();
  if (!db) return;
  
  const existing = await getNotificationPrefs(customerId);
  if (existing) {
    await db.update(customerNotificationPrefs).set(prefs).where(eq(customerNotificationPrefs.customerId, customerId));
  } else {
    await db.insert(customerNotificationPrefs).values({ customerId, ...prefs });
  }
}


// ============ CUSTOMER PORTAL FUNCTIONS ============

/**
 * Batches that carried something of this customer's.
 *
 * Bounded to the most recent 100. Five years of monthly shipments is sixty
 * cards nobody scrolls to, and the screen that calls this renders them all at
 * once; without a ceiling the payload only ever grew.
 */
export async function getCustomerBatches(customerId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];

  // Distinct batch IDs for this customer's packages — newest first, so the
  // ceiling drops the oldest shipments rather than an arbitrary hundred.
  const customerPackages = await db.select({
    batchId: packages.batchId,
    latest: sql<string>`MAX(${packages.createdAt})`,
  }).from(packages)
    .where(and(
      eq(packages.customerId, customerId),
      isNotNull(packages.batchId)
    ))
    .groupBy(packages.batchId)
    .orderBy(desc(sql`MAX(${packages.createdAt})`))
    .limit(limit);

  if (customerPackages.length === 0) return [];
  
  const batchIds = customerPackages.map(p => p.batchId).filter((id): id is number => id !== null);
  
  // Get batch details with customer's package count — batched into two
  // queries (was 2 per batch) so the portal dashboard doesn't fan out.
  const [batchRows, countRows] = await Promise.all([
    db.select().from(batches).where(inArray(batches.id, batchIds)),
    db.select({ batchId: packages.batchId, count: sql<number>`COUNT(*)` })
      .from(packages)
      .where(and(
        eq(packages.customerId, customerId),
        inArray(packages.batchId, batchIds)
      ))
      .groupBy(packages.batchId),
  ]);
  const countByBatch = new Map(countRows.map(r => [r.batchId, r.count]));

  /**
   * The customer's own size in each batch, in the unit they are billed by.
   *
   * The card used to print `batch.totalWeight` — the whole batch's weight,
   * everybody's goods together — beside the customer's own package count, so
   * it read "3 pkgs · 1,240 kg". And it said kg for sea batches, which are
   * billed by volume, so the number was both somebody else's and in the wrong
   * unit.
   */
  const divisor = await getVolumetricDivisor();
  const mine = await db.select({
    batchId: packages.batchId,
    weightKg: packages.weightKg,
    lengthCm: packages.lengthCm,
    widthCm: packages.widthCm,
    heightCm: packages.heightCm,
    volumeCbm: packages.volumeCbm,
    shippingType: packages.shippingType,
    status: packages.status,
    deliveredAt: packages.deliveredAt,
  }).from(packages)
    .where(and(
      eq(packages.customerId, customerId),
      inArray(packages.batchId, batchIds),
    ));

  const sizeByBatch = new Map<number, { kg: number; cbm: number }>();
  /** This customer's parcels in each batch, for the per-customer status. */
  const parcelsByBatch = new Map<number, { status: string | null; deliveredAt: Date | null }[]>();
  for (const p of mine) {
    if (p.batchId == null) continue;
    const seen = parcelsByBatch.get(p.batchId) ?? [];
    seen.push({ status: p.status, deliveredAt: p.deliveredAt });
    parcelsByBatch.set(p.batchId, seen);
    const acc = sizeByBatch.get(p.batchId) ?? { kg: 0, cbm: 0 };
    if (isAirShipping(String(p.shippingType))) {
      acc.kg += chargeableWeight(p, divisor).chargeableKg;
    } else {
      acc.cbm += Number(p.volumeCbm) || 0;
    }
    sizeByBatch.set(p.batchId, acc);
  }

  /**
   * When each batch reached each stage.
   *
   * A batch carries three timestamps of its own — created, departed, arrived
   * — so the customer's stepper could date the first three steps and never
   * customs, the Erbil depot or delivery. batchStatusHistory records the rest
   * from the day it started; older batches simply have none, and their
   * steppers fall back to the three columns exactly as before.
   *
   * One query for the whole page, not one per card.
   */
  const statusDatesByBatch = await getBatchStatusTimestamps(batchIds);

  return batchRows
    .map(batch => {
      const size = sizeByBatch.get(batch.id) ?? { kg: 0, cbm: 0 };
      const myParcels = parcelsByBatch.get(batch.id) ?? [];
      const customerStatus = customerBatchStatus(String(batch.status), myParcels);
      /**
       * The stepper dates its steps from batchStatusHistory, which records
       * the container. When this customer collected before the container was
       * closed, its delivered step has no date of its own — theirs does.
       */
      const myDeliveredAt = myParcels
        .map((p) => p.deliveredAt)
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const bySea = String(batch.shippingType) === "sea";
      // Internal: these trackings cover every customer in the batch, so one
      // could follow another's goods. Container/AWB are shown instead.
      // The cost columns are our side of the trade — what the carrier and
      // supplier charge US per kg/cbm — and next to the selling rate they
      // spell out the margin, so they never leave the building.
      const {
        costPerKg: _costPerKg,
        costPerCbm: _costPerCbm,
        shippingCost: _shippingCost,
        shipmentTrackings: _internalTrackings,
        /**
         * Free text written by staff about the whole container — a customer
         * who has not paid, a parcel held back, whatever needed saying that
         * day. It was travelling to every customer in the batch and being
         * rendered by none of them.
         */
        notes: _notes,
        /**
         * The rest of the container's own measurements, and who made it.
         * Everybody's goods added together, and an internal user id. The
         * customer's own share is `customerChargeable`, computed above.
         */
        totalWeight: _totalWeight,
        actualWeightKg: _actualWeightKg,
        actualCbm: _actualCbm,
        chargedWeightKg: _chargedWeightKg,
        chargedCbm: _chargedCbm,
        createdById: _createdById,
        ...customerVisible
      } = batch;
      return {
        ...customerVisible,
        /**
         * The container's own status is replaced by this customer's, so no
         * screen can print the shared one by accident. The original is kept
         * beside it for anything that genuinely means the whole batch.
         */
        status: customerStatus,
        batchStatus: batch.status,
        customerPackageCount: countByBatch.get(batch.id) || 0,
        /** This customer's own total, in the unit this batch is billed by. */
        customerChargeable: Number((bySea ? size.cbm : size.kg).toFixed(bySea ? 3 : 2)),
        customerUnit: (bySea ? "cbm" : "kg") as "cbm" | "kg",
        /** Keyed by batch status: preparing, in_transit, arrived, customs, … */
        statusDates: {
          ...(statusDatesByBatch.get(batch.id) ?? {}),
          ...(customerStatus === "delivered" && myDeliveredAt ? { delivered: myDeliveredAt } : {}),
        },
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Get customer's packages in a specific batch
export async function getCustomerPackagesInBatch(customerId: number, batchId: number) {
  const db = await getDb();
  if (!db) return [];

  const customerPackages = await db.select().from(packages)
    .where(and(
      eq(packages.customerId, customerId),
      eq(packages.batchId, batchId)
    ))
    .orderBy(desc(packages.createdAt));

  // Per-package price: for in-flight batches we recompute on the fly so the
  // modal/labels match what the customer will be billed at delivery. The
  // stored `calculatedCostUsd` is set at registration with raw actualKg and
  // can drift when dimensions/pricing change — which is why a 1.44 KG
  // volumetric package was showing $10.80 ($7.50/kg) instead of $17.28
  // ($12 × 1.44). For delivered/closed batches we keep the stored value
  // because that's the real amount that hit the customer's ledger.
  const batchRow = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  const batch = batchRow[0];
  let liveRate: number | null = null;

  if (batch && batch.status !== 'delivered' && batch.status !== 'closed') {
    const isSea = batch.shippingType === 'sea';
    const unit: 'kg' | 'cbm' = isSea ? 'cbm' : 'kg';

    // Compute this customer's total chargeable kg/cbm in the batch (needed
    // to pick the right tier and to mirror billing math exactly).
    let customerTotal = 0;
    // The same shared rule and the same admin-set divisor the invoice uses.
    // This was `/ 6000` written out by hand, so an admin who changed the
    // divisor moved the invoice and left this preview where it was.
    const divisor = await getVolumetricDivisor();
    for (const p of customerPackages) {
      if (unit === 'kg') {
        customerTotal += chargeableWeight(p, divisor).chargeableKg;
      } else {
        customerTotal += Number(p.volumeCbm) || 0;
      }
    }

    // The agreed rate, then the tier, then the shipment's own — decided in
    // one place, so what the customer is shown here and what they are
    // invoiced cannot come apart.
    const rate = await getBatchRateForCustomer(batchId, customerId, { unit, customerTotal });
    liveRate = rate.rate;
  }

  // Check if each package is linked to a Full Package order — one batched
  // query for the whole batch (was one query per package).
  const trackingNumbers = customerPackages
    .map(p => p.trackingNumber)
    .filter((tn): tn is string => !!tn);
  const fpOrderByTracking = new Map<string, typeof fullPackageOrders.$inferSelect>();
  if (trackingNumbers.length > 0) {
    const fpOrders = await db.select()
      .from(fullPackageOrders)
      .where(inArray(fullPackageOrders.trackingNumber, trackingNumbers))
      .orderBy(fullPackageOrders.id);
    for (const o of fpOrders) {
      if (o.trackingNumber && !fpOrderByTracking.has(o.trackingNumber)) {
        fpOrderByTracking.set(o.trackingNumber, o);
      }
    }
  }

  const result = [];
  for (const pkg of customerPackages) {
    let isFullPackage = false;
    let fullPackageOrderId = null;
    let fullPackageOrderType: 'full_package' | 'purchase_request' | 'commission' | null = null;

    const fpOrder = pkg.trackingNumber ? fpOrderByTracking.get(pkg.trackingNumber) : undefined;
    if (fpOrder) {
      isFullPackage = true;
      fullPackageOrderId = fpOrder.id;
      fullPackageOrderType = fpOrder.orderType as 'full_package' | 'purchase_request' | 'commission';
    }

    // Live-computed cost for in-flight batches; stored value otherwise.
    let calculatedCostUsd = Number(pkg.calculatedCostUsd) || 0;
    if (liveRate !== null && batch) {
      const isSea = batch.shippingType === 'sea';
      if (isSea) {
        calculatedCostUsd = liveRate * (Number(pkg.volumeCbm) || 0);
      } else {
        const actualKg = Number(pkg.weightKg) || 0;
        const lengthCm = Number(pkg.lengthCm) || 0;
        const widthCm = Number(pkg.widthCm) || 0;
        const heightCm = Number(pkg.heightCm) || 0;
        const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
        const chargeableKg = Math.max(actualKg, volumetricKg);
        calculatedCostUsd = liveRate * chargeableKg;
      }
    }

    const row = {
      ...pkg,
      weightKg: Number(pkg.weightKg) || 0,
      volumeCbm: Number(pkg.volumeCbm) || 0,
      lengthCm: Number(pkg.lengthCm) || 0,
      widthCm: Number(pkg.widthCm) || 0,
      heightCm: Number(pkg.heightCm) || 0,
      calculatedCostUsd,
      isFullPackage,
      fullPackageOrderId,
      fullPackageOrderType,
    };

    // A full-package parcel is sold at one agreed figure; its size and
    // carriage stay ours. See shared/fullPackagePrivacy.ts.
    result.push(concealsSizeAndCarriage(fullPackageOrderType) ? concealParcelSize(row) : row);
  }

  return result;
}

// Get customer's recent packages (not in batch yet)
/**
 * The parcel columns a customer is allowed to see. Shared by both list
 * queries so one of them cannot quietly start returning the signature and
 * delivery-photo data URIs again.
 */
const CUSTOMER_PACKAGE_FIELDS = {
  id: packages.id,
  packageCode: packages.packageCode,
  trackingNumber: packages.trackingNumber,
  description: packages.description,
  photos: packages.photos,
  status: packages.status,
  shippingType: packages.shippingType,
  weightKg: packages.weightKg,
  volumeCbm: packages.volumeCbm,
  lengthCm: packages.lengthCm,
  widthCm: packages.widthCm,
  heightCm: packages.heightCm,
  calculatedCostUsd: packages.calculatedCostUsd,
  isCharged: packages.isCharged,
  batchId: packages.batchId,
  fullPackageOrderId: packages.fullPackageOrderId,
  isUnclaimed: packages.isUnclaimed,
  customerId: packages.customerId,
  createdAt: packages.createdAt,
  updatedAt: packages.updatedAt,
  registeredAt: packages.registeredAt,
  deliveredAt: packages.deliveredAt,
  // Where it was registered. The journey a parcel shows depends on it: one
  // registered at the China depot is already in that warehouse, and one
  // registered in Erbil never goes there at all.
  registeredInCountryId: packages.registeredInCountryId,
} as const;

/**
 * Strip size and carriage off any row that belongs to a full-package order,
 * before it leaves for the portal.
 *
 * The allow-list above says which columns a customer may see at all; this says
 * which of those a FULL-PACKAGE customer may see — weight, volume, dimensions
 * and the shipping figure are the other half of our margin, so for parcels
 * sold at one agreed price they are nulled server-side. One batched lookup of
 * the linked orders' types; rows with no order pass through untouched.
 * The rule itself lives in shared/fullPackagePrivacy.ts.
 */
async function concealFullPackageParcels<T extends { fullPackageOrderId: number | null }>(
  rows: T[],
): Promise<Array<T | (T & { sizeConcealed: true })>> {
  const db = await getDb();
  const orderIds = Array.from(new Set(rows.map(r => r.fullPackageOrderId).filter((id): id is number => id != null)));
  if (!db || orderIds.length === 0) return rows;

  const orders = await db.select({ id: fullPackageOrders.id, orderType: fullPackageOrders.orderType })
    .from(fullPackageOrders)
    .where(inArray(fullPackageOrders.id, orderIds));
  const concealed = new Set(orders.filter(o => concealsSizeAndCarriage(o.orderType)).map(o => o.id));

  return rows.map(r =>
    r.fullPackageOrderId != null && concealed.has(r.fullPackageOrderId) ? concealParcelSize(r) : r,
  );
}

/**
 * Parcels not yet loaded into a shipment.
 *
 * Was `select()` with no ceiling — the same two faults as the list below it:
 * every column (including the delivery signature and photo data URIs, which
 * this screen never renders) and every row a long-standing account has ever
 * had. It now borrows the allow-list and takes a bound.
 */
export async function getCustomerUnbatchedPackages(customerId: number, limit = 200) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select(CUSTOMER_PACKAGE_FIELDS).from(packages)
    .where(and(
      eq(packages.customerId, customerId),
      isNull(packages.batchId)
    ))
    .orderBy(desc(packages.createdAt))
    .limit(limit);
  return concealFullPackageParcels(rows);
}

/**
 * The customer's parcels, as the portal is allowed to see them.
 *
 * `getPackagesByCustomer` returns `select()` — every column, every row. Two of
 * those columns are the real problem: `recipientSignature` and `deliveryPhoto`
 * are written from uncapped strings at delivery time and are almost certainly
 * canvas data URIs, and `qrCodeData`/`qrCodeSignature`/`notes` are ours rather
 * than the customer's. On a five-year account with two thousand parcels the
 * response was large enough to time out on a mobile connection, and it grew
 * every month.
 *
 * An allow-list, and a ceiling. Two hundred is far past what any portal screen
 * renders — the home tiles count, the billing card joins — and it is a bound
 * rather than a promise, so the number stops growing with the account.
 */
export async function getCustomerVisiblePackages(customerId: number, limit = 200) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select(CUSTOMER_PACKAGE_FIELDS)
    .from(packages)
    .where(eq(packages.customerId, customerId))
    .orderBy(desc(packages.createdAt))
    .limit(limit);
  return concealFullPackageParcels(rows);
}

/**
 * The customer's own purchases: parcels we ship but never bought for them.
 *
 * Filtered by `selfOrderConditions` — the same rule the self-order revenue
 * report runs on — so the tab a customer sees and the money the office counts
 * can never describe the same box differently.
 *
 * Nothing here is stored. When the admin finally enters the purchase order and
 * its tracking number, orderBacklink sets `fullPackageOrderId`, the parcel
 * stops matching this query on the customer's very next page load, and it
 * appears under its real order instead. That is the whole migration.
 */
export async function getSelfOrderPackagesByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: packages.id,
      packageCode: packages.packageCode,
      trackingNumber: packages.trackingNumber,
      description: packages.description,
      photos: packages.photos,
      status: packages.status,
      shippingType: packages.shippingType,
      weightKg: packages.weightKg,
      volumeCbm: packages.volumeCbm,
      calculatedCostUsd: packages.calculatedCostUsd,
      isCharged: packages.isCharged,
      batchId: packages.batchId,
      batchCode: batches.batchCode,
      batchStatus: batches.status,
      // The batch's own rate. Until it exists there is nothing honest to
      // quote: the figure stored at registration comes from the general
      // route rule, which is not what the customer ends up charged.
      batchPricePerKg: batches.pricePerKg,
      batchPricePerCbm: batches.pricePerCbm,
      createdAt: packages.createdAt,
      deliveredAt: packages.deliveredAt,
    })
    .from(packages)
    .leftJoin(batches, eq(packages.batchId, batches.id))
    .where(selfOrderWhere(eq(packages.customerId, customerId)))
    .orderBy(desc(packages.createdAt))
    .limit(200);
}

// Get customer financial summary
export async function getCustomerFinancialSummary(customerId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const account = await getCustomerAccountByCustomerId(customerId);
  if (!account) {
    return {
      balanceUsd: 0,
      balanceIqd: 0,
      creditLimitUsd: 0,
      totalPackages: 0,
      totalPaid: 0,
      status: 'active' as const
    };
  }
  
  // Get total paid
  const totalPaidData = await db.select({
    total: sql<number>`SUM(${paymentRecords.amountUsd} - ${paymentRecords.reversedAmountUsd})`
  }).from(paymentRecords)
    .where(eq(paymentRecords.accountId, account.id));
  
  // Get total packages delivered
  const packageCount = await db.select({
    count: sql<number>`COUNT(*)`
  }).from(packages)
    .where(and(
      eq(packages.customerId, customerId),
      eq(packages.status, 'delivered')
    ));
  
  return {
    balanceUsd: Number(account.currentBalanceUsd) || 0,
    balanceIqd: Number(account.currentBalanceIqd) || 0,
    creditLimitUsd: Number(account.creditLimitUsd) || 0,
    totalPackages: packageCount[0]?.count || 0,
    totalPaid: totalPaidData[0]?.total || 0,
    status: account.accountStatus
  };
}

/**
 * What the customer paid and was charged, month by month.
 *
 * The money page used to work this out in the browser from the fifty most
 * recent transactions — and then drew a six-month chart with them. Fifty is a
 * couple of busy months for a real customer, so the older columns were simply
 * short, the monthly total was wrong, and nothing on the page said so. The
 * balance beside it came from the account and was right, which left the page
 * quietly disagreeing with itself.
 *
 * Counted in SQL over the whole period instead, so the answer does not depend
 * on how much of the ledger somebody happened to download. Months are built
 * here rather than in the browser because the browser was walking backwards
 * with `setMonth(getMonth() - i)`, which on the 29th to the 31st skips a month
 * — 31 March minus one month is 3 March — so the chart repeated a month and
 * dropped another on those days.
 */
export async function getCustomerMonthlyMoney(customerId: number, months = 6) {
  const db = await getDb();
  if (!db) return [];

  const account = await getCustomerAccountByCustomerId(customerId);
  if (!account) return [];

  // Anchored to the first of the month so the arithmetic cannot overflow.
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const rows = await db.select({
    ym: sql<string>`DATE_FORMAT(${ledgerTransactions.createdAt}, '%Y-%m')`,
    payments: sql<number>`COALESCE(SUM(CASE WHEN ${inArray(ledgerTransactions.transactionType, [...PAYMENT_TX_TYPES])} THEN ${ledgerTransactions.amountUsd} ELSE 0 END), 0)`,
    charges: sql<number>`COALESCE(SUM(CASE WHEN ${inArray(ledgerTransactions.transactionType, [...CHARGE_TX_TYPES])} THEN ${ledgerTransactions.amountUsd} ELSE 0 END), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(ledgerTransactions)
    .where(and(
      eq(ledgerTransactions.accountId, account.id),
      gte(ledgerTransactions.createdAt, start),
    ))
    .groupBy(sql`DATE_FORMAT(${ledgerTransactions.createdAt}, '%Y-%m')`);

  const found = new Map(rows.map(r => [r.ym, r]));

  // Every month in the window, including the empty ones — a gap in the chart
  // must read as "nothing happened", not as a month that was never asked about.
  const out: { ym: string; payments: number; charges: number; count: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const hit = found.get(ym);
    out.push({
      ym,
      payments: Number(hit?.payments ?? 0),
      charges: Number(hit?.charges ?? 0),
      count: Number(hit?.count ?? 0),
    });
  }
  return out;
}

// Get customer's transaction history from unified ledger system
export async function getCustomerTransactionHistory(customerId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  // No ledger account yet means no transactions yet — a new customer, not an
  // error. This used to look the id up in `users` before returning the same
  // empty list either way: a customer id read against the staff table, left
  // over from when the two shared one table. It decided nothing, but the next
  // person to add a line inside that branch would have been reading the wrong
  // row entirely.
  const account = await getCustomerAccountByCustomerId(customerId);
  if (!account) return [];


  // Get transactions from unified ledgerTransactions table
  const transactions = await db.select({
    id: ledgerTransactions.id,
    transactionType: ledgerTransactions.transactionType,
    transactionNumber: ledgerTransactions.transactionNumber,
    amountUsd: ledgerTransactions.amountUsd,
    amountIqd: ledgerTransactions.amountIqd,
    balanceBeforeUsd: ledgerTransactions.balanceBeforeUsd,
    balanceAfterUsd: ledgerTransactions.balanceAfterUsd,
    description: ledgerTransactions.description,
    createdAt: ledgerTransactions.createdAt,
    referenceType: ledgerTransactions.referenceType,
    referenceId: ledgerTransactions.referenceId,
    invoiceId: ledgerTransactions.invoiceId,
  }).from(ledgerTransactions)
    .where(eq(ledgerTransactions.accountId, account.id))
    .orderBy(desc(ledgerTransactions.createdAt))
    .limit(limit);
  
  // Return transactions from unified ledgerTransactions table only
  // Legacy ledgerEntries fallback removed - system now uses unified ledger
  return transactions;
}

// Search package by tracking number for customer.
// The allow-list, not `select()`: a bare select hands the browser the QR
// signature, staff notes and delivery photo along with the row — the search
// box was the one door left off the list.
export async function searchCustomerPackage(customerId: number, trackingNumber: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select(CUSTOMER_PACKAGE_FIELDS).from(packages)
    .where(and(
      eq(packages.customerId, customerId),
      or(
        eq(packages.trackingNumber, trackingNumber),
        eq(packages.packageCode, trackingNumber)
      )
    ))
    .limit(1);

  if (!result[0]) return null;
  const [row] = await concealFullPackageParcels(result);
  return row;
}

// Search the customer's full-package/commission orders by order number
// (FP-...) or by the order's tracking number — same search box as packages.
export async function searchCustomerOrder(customerId: number, query: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(fullPackageOrders)
    .where(and(
      eq(fullPackageOrders.customerId, customerId),
      or(
        eq(fullPackageOrders.orderCode, query),
        eq(fullPackageOrders.trackingNumber, query)
      )
    ))
    .limit(1);

  return result[0] || null;
}

// Get customer notification count
/**
 * The number on the bell — the customer's unread notifications.
 *
 * It used to count rows in `packageStatusHistory` from the last seven days,
 * while the notifications page listed `customerNotifications`. Two unrelated
 * tables. So the bell could read 17 while the page showed three items, and
 * marking everything read could not move it: nothing the customer did touched
 * the table being counted. The number only ever decayed as status-history rows
 * aged past a week, and the bell kept ringing in the meantime.
 *
 * It counts the same rows the page lists now, so reading them clears it.
 */
export async function getCustomerNotificationCount(customerId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.select({
    count: sql<number>`COUNT(*)`
  }).from(customerNotifications)
    .where(and(
      eq(customerNotifications.customerId, customerId),
      eq(customerNotifications.isRead, false),
    ));

  return result[0]?.count || 0;
}



// ============ PACKAGE CLAIM REQUESTS ============

// Get next claim request number
export async function getNextClaimRequestNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const year = new Date().getFullYear();
  const prefix = `CLM-${year}-`;
  
  const result = await db.select({ requestNumber: packageClaimRequests.requestNumber })
    .from(packageClaimRequests)
    .where(like(packageClaimRequests.requestNumber, `${prefix}%`))
    .orderBy(desc(packageClaimRequests.id))
    .limit(1);
  
  let nextNum = 1;
  if (result.length > 0 && result[0].requestNumber) {
    const match = result[0].requestNumber.match(/CLM-\d+-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1]) + 1;
    }
  }
  
  return `${prefix}${nextNum.toString().padStart(4, '0')}`;
}

// Create a new claim request
export async function createClaimRequest(data: {
  packageId: number;
  trackingNumber: string;
  customerId: number;
  customerNote?: string;
  proofImages?: string[];
}): Promise<PackageClaimRequest> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const requestNumber = await getNextClaimRequestNumber();

  const [request] = await db.insert(packageClaimRequests).values({
    requestNumber,
    packageId: data.packageId,
    trackingNumber: data.trackingNumber,
    customerId: data.customerId,
    customerNote: data.customerNote,
    proofImages: data.proofImages,
    status: "pending",
  }).$returningId();
  
  const [created] = await db.select().from(packageClaimRequests).where(eq(packageClaimRequests.id, request.id));
  return created;
}

// Get all claim requests (for admin)
export async function getAllClaimRequests(options?: {
  status?: "pending" | "approved" | "rejected";
  limit?: number;
  offset?: number;
}): Promise<{ requests: PackageClaimRequest[]; total: number }> {
  const db = await getDb();
  if (!db) return { requests: [], total: 0 };
  
  const conditions = [];
  if (options?.status) {
    conditions.push(eq(packageClaimRequests.status, options.status));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [totalResult] = await db.select({ count: count() })
    .from(packageClaimRequests)
    .where(whereClause);
  
  const requests = await db.select()
    .from(packageClaimRequests)
    .where(whereClause)
    .orderBy(desc(packageClaimRequests.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
  
  return { requests, total: totalResult?.count || 0 };
}

// Get claim requests by customer
export async function getClaimRequestsByCustomer(customerId: number): Promise<PackageClaimRequest[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(packageClaimRequests)
    .where(eq(packageClaimRequests.customerId, customerId))
    .orderBy(desc(packageClaimRequests.createdAt));
}

// Get claim request by ID
export async function getClaimRequestById(id: number): Promise<PackageClaimRequest | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [request] = await db.select().from(packageClaimRequests).where(eq(packageClaimRequests.id, id));
  return request || null;
}

// Check if customer already has pending claim for this package
export async function hasExistingClaimRequest(packageId: number, customerId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const [existing] = await db.select({ count: count() })
    .from(packageClaimRequests)
    .where(and(
      eq(packageClaimRequests.packageId, packageId),
      eq(packageClaimRequests.customerId, customerId),
      eq(packageClaimRequests.status, "pending")
    ));
  
  return (existing?.count || 0) > 0;
}

// Approve claim request
export async function approveClaimRequest(
  requestId: number,
  reviewedById: number,
  adminNote?: string
): Promise<PackageClaimRequest | null> {
  const db = await getDb();
  if (!db) return null;
  
  const request = await getClaimRequestById(requestId);
  if (!request) return null;
  
  // Update request status
  await db.update(packageClaimRequests)
    .set({
      status: "approved",
      reviewedById,
      reviewedAt: new Date(),
      adminNote,
    })
    .where(eq(packageClaimRequests.id, requestId));
  
  // Assign package to customer
  await db.update(packages)
    .set({
      customerId: request.customerId,
      isUnclaimed: false,
      claimedAt: new Date(),
      claimedById: reviewedById,
    })
    .where(eq(packages.id, request.packageId));
  
  const [updated] = await db.select().from(packageClaimRequests).where(eq(packageClaimRequests.id, requestId));
  return updated;
}

// Reject claim request
export async function rejectClaimRequest(
  requestId: number,
  reviewedById: number,
  adminNote?: string
): Promise<PackageClaimRequest | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(packageClaimRequests)
    .set({
      status: "rejected",
      reviewedById,
      reviewedAt: new Date(),
      adminNote,
    })
    .where(eq(packageClaimRequests.id, requestId));
  
  const [updated] = await db.select().from(packageClaimRequests).where(eq(packageClaimRequests.id, requestId));
  return updated;
}

// Get pending claim requests count (for admin badge)
export async function getPendingClaimRequestsCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const [result] = await db.select({ count: count() })
    .from(packageClaimRequests)
    .where(eq(packageClaimRequests.status, "pending"));
  
  return result?.count || 0;
}

// Search unclaimed packages by tracking number
export async function searchUnclaimedPackages(searchTerm: string): Promise<Package[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(packages)
    .where(and(
      eq(packages.isUnclaimed, true),
      or(
        like(packages.trackingNumber, `%${searchTerm}%`),
        like(packages.packageCode, `%${searchTerm}%`)
      )
    ))
    .orderBy(desc(packages.createdAt))
    .limit(50);
}

// Get unclaimed packages with pagination and search
export async function getUnclaimedPackagesWithSearch(options?: {
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { packages: [], total: 0 };
  
  const conditions = [eq(packages.isUnclaimed, true)];
  
  if (options?.search) {
    conditions.push(
      or(
        like(packages.trackingNumber, `%${options.search}%`),
        like(packages.packageCode, `%${options.search}%`)
      )!
    );
  }
  
  const whereClause = and(...conditions);
  
  const [totalResult] = await db.select({ count: count() })
    .from(packages)
    .where(whereClause);
  
  // The unclaimed pool is browsable by any customer — that is the point of
  // claiming — but the whole row is not. select() was handing out the staff
  // notes, the delivery signature and photo, and the signed qrCodeData and
  // qrCodeSignature to anyone who opened the page.
  const result = await db.select({
    id: packages.id,
    packageCode: packages.packageCode,
    trackingNumber: packages.trackingNumber,
    description: packages.description,
    photos: packages.photos,
    status: packages.status,
    shippingType: packages.shippingType,
    weightKg: packages.weightKg,
    volumeCbm: packages.volumeCbm,
    isUnclaimed: packages.isUnclaimed,
    createdAt: packages.createdAt,
    registeredAt: packages.registeredAt,
    registeredInCountryId: packages.registeredInCountryId,
  })
    .from(packages)
    .where(whereClause)
    .orderBy(desc(packages.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);

  return { packages: result, total: totalResult?.count || 0 };
}



// ============ CUSTOMER MESSAGES ============

export async function getCustomerMessages(customerId: number, limit = 50): Promise<CustomerMessage[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(customerMessages)
    .where(eq(customerMessages.customerId, customerId))
    .orderBy(desc(customerMessages.createdAt))
    .limit(limit);
}

/**
 * The most recent messages in a conversation, oldest first for display.
 *
 * The ordering used to be ascending with the limit applied to it, so past a
 * hundred messages the customer's thread froze on the first hundred and they
 * never saw another reply — the conversation looked abandoned by us. Take the
 * newest and reverse them, so the limit trims history rather than the present.
 */
export async function getConversationMessages(conversationId: string, limit = 100): Promise<CustomerMessage[]> {
  const db = await getDb();
  if (!db) return [];

  const newestFirst = await db.select()
    .from(customerMessages)
    .where(eq(customerMessages.conversationId, conversationId))
    .orderBy(desc(customerMessages.createdAt))
    .limit(limit);

  return newestFirst.reverse();
}

export async function createCustomerMessage(data: InsertCustomerMessage): Promise<CustomerMessage | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(customerMessages).values(data);
  const [message] = await db.select().from(customerMessages).where(eq(customerMessages.id, result.insertId));
  return message || null;
}

export async function markCustomerMessagesAsRead(customerId: number, senderType: 'customer' | 'admin'): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Mark messages from the other party as read
  const readSenderType = senderType === 'customer' ? 'admin' : 'customer';
  
  await db.update(customerMessages)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(customerMessages.customerId, customerId),
      eq(customerMessages.senderType, readSenderType),
      eq(customerMessages.isRead, false)
    ));
}

export async function getUnreadMessageCount(customerId: number, forSenderType: 'customer' | 'admin'): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  // Count unread messages from the other party
  const fromSenderType = forSenderType === 'customer' ? 'admin' : 'customer';
  
  const [result] = await db.select({ count: count() })
    .from(customerMessages)
    .where(and(
      eq(customerMessages.customerId, customerId),
      eq(customerMessages.senderType, fromSenderType),
      eq(customerMessages.isRead, false)
    ));
  
  return result?.count || 0;
}

export async function getAllConversations(): Promise<{ customerId: number; customerName: string; customerCode: string; mobileNumber: string; unreadCount: number; lastMessage: string; lastMessageAt: Date }[]> {
  const db = await getDb();
  if (!db) return [];

  // Get all unique conversations with customer info and unread count (from customers table)
  const conversations = await db.select({
    customerId: customerMessages.customerId,
    customerName: customers.fullName,
    customerCode: customers.customerCode,
    mobileNumber: customers.mobileNumber,
  })
    .from(customerMessages)
    .innerJoin(customers, eq(customers.id, customerMessages.customerId))
    .groupBy(customerMessages.customerId, customers.fullName, customers.customerCode, customers.mobileNumber);
  
  // Unread counts and last messages for ALL conversations in two grouped
  // queries (was 2 queries per conversation).
  const customerIds = conversations.map(c => c.customerId);
  if (customerIds.length === 0) return [];

  const [unreadRows, lastMsgRows] = await Promise.all([
    db.select({ customerId: customerMessages.customerId, count: count() })
      .from(customerMessages)
      .where(and(
        inArray(customerMessages.customerId, customerIds),
        eq(customerMessages.senderType, 'customer'),
        eq(customerMessages.isRead, false)
      ))
      .groupBy(customerMessages.customerId),
    // Latest message id per conversation (ids are monotonic with createdAt),
    // then fetch just those rows — same result as the per-customer LIMIT 1.
    db.select({ customerId: customerMessages.customerId, maxId: sql<number>`MAX(${customerMessages.id})` })
      .from(customerMessages)
      .where(inArray(customerMessages.customerId, customerIds))
      .groupBy(customerMessages.customerId),
  ]);
  const unreadByCustomer = new Map(unreadRows.map(r => [r.customerId, r.count]));

  const lastIds = lastMsgRows.map(r => r.maxId);
  const lastMsgs = lastIds.length > 0
    ? await db.select().from(customerMessages).where(inArray(customerMessages.id, lastIds))
    : [];
  const lastMsgByCustomer = new Map(lastMsgs.map(m => [m.customerId, m]));

  const result = conversations.map((conv) => {
    const lastMsg = lastMsgByCustomer.get(conv.customerId);
    return {
      customerId: conv.customerId,
      customerName: conv.customerName || '',
      customerCode: conv.customerCode || '',
      mobileNumber: conv.mobileNumber || '',
      unreadCount: unreadByCustomer.get(conv.customerId) || 0,
      lastMessage: lastMsg?.message || '',
      lastMessageAt: lastMsg?.createdAt || new Date(),
    };
  });

  return result.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
}


// ============ CUSTOMER NOTIFICATIONS ============

export async function getCustomerNotifications(customerId: number, options?: { limit?: number; unreadOnly?: boolean }): Promise<CustomerNotification[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(customerNotifications.customerId, customerId)];
  
  if (options?.unreadOnly) {
    conditions.push(eq(customerNotifications.isRead, false));
  }
  
  return db.select()
    .from(customerNotifications)
    .where(and(...conditions))
    .orderBy(desc(customerNotifications.createdAt))
    .limit(options?.limit || 50);
}

export async function createCustomerNotification(
  data: InsertCustomerNotification,
  opts?: { push?: boolean },
): Promise<CustomerNotification | null> {
  const db = await getDb();
  if (!db) return null;

  const [result] = await db.insert(customerNotifications).values(data);
  const [notification] = await db.select().from(customerNotifications).where(eq(customerNotifications.id, result.insertId));

  // Fire-and-forget SSE push so any portal tab open for this customer
  // gets a live toast. Lazy-imported so this module doesn't pull in
  // the event broker on bootstrap if it isn't needed yet, and wrapped
  // in try/catch so a broker failure can't block notification storage.
  if (notification && data.customerId) {
    try {
      const { publishPortalEvent } = await import("../services/portalEvents.service");
      publishPortalEvent(data.customerId, {
        type: "notification",
        notificationId: notification.id,
        title: notification.title || "",
        // Schema column is `message`, not `body` — the SSE event uses
        // `body` to match the public PortalSSEEvent contract on the
        // client (which mirrors browser Notification semantics).
        body: notification.message || "",
      });
    } catch {
      // Never block notification creation on the live-push side channel.
    }

    // Also fire-and-forget a web push (default on) so the customer's phone
    // rings/vibrates for every notification, not just the ones whose caller
    // remembered to push. Callers can opt out with { push: false }.
    if (opts?.push !== false) {
      try {
        const { sendPushToCustomer } = await import("../services/push.service");
        // The row already holds this text in four languages. Hand all of them
        // over so each device is woken in the language its owner reads,
        // rather than everyone getting the English.
        const tr = (t: string | null | undefined, m: string | null | undefined) =>
          t || m ? { title: t || notification.title || "Wazn Express", body: m || notification.message || "" } : undefined;
        void sendPushToCustomer(data.customerId, {
          title: notification.title || "Wazn Express",
          body: notification.message || "",
          url: notification.actionUrl || "/portal",
          i18n: {
            ku: tr(notification.titleKu, notification.messageKu),
            ar: tr(notification.titleAr, notification.messageAr),
            zh: tr(notification.titleZh, notification.messageZh),
          },
        }).catch(() => { /* best-effort */ });
      } catch {
        // Push must never block notification storage either.
      }
    }
  }

  return notification || null;
}

/**
 * Mark one notification read — the caller's own.
 *
 * The customerId used to be absent, so any signed-in customer could silently
 * mark every other customer's notifications read by walking the id range,
 * including "your password was changed by support".
 */
export async function markNotificationAsRead(notificationId: number, customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(customerNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(customerNotifications.id, notificationId),
      eq(customerNotifications.customerId, customerId),
    ));
}

export async function markAllNotificationsAsRead(customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(customerNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(customerNotifications.customerId, customerId),
      eq(customerNotifications.isRead, false)
    ));
}

// getUnreadNotificationCount lived here and counted the same rows as
// getCustomerNotificationCount above — same customer, same `isRead = false`.
// Use that one. Two functions answering one question is how the bell and the
// notifications page came to show different numbers once already.


// ============ CUSTOMER PUSH SUBSCRIPTIONS ============

export async function upsertPushSubscription(data: InsertCustomerPushSubscription): Promise<CustomerPushSubscription | null> {
  const db = await getDb();
  if (!db) return null;

  const [existing] = await db.select()
    .from(customerPushSubscriptions)
    .where(eq(customerPushSubscriptions.endpoint, data.endpoint))
    .limit(1);

  if (existing) {
    await db.update(customerPushSubscriptions)
      .set({
        customerId: data.customerId,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent,
        platform: data.platform,
        language: data.language,
        isActive: true,
        failureCount: 0,
        lastUsedAt: new Date(),
      })
      .where(eq(customerPushSubscriptions.id, existing.id));
    const [updated] = await db.select()
      .from(customerPushSubscriptions)
      .where(eq(customerPushSubscriptions.id, existing.id));
    return updated || null;
  }

  const [result] = await db.insert(customerPushSubscriptions).values({
    ...data,
    isActive: true,
    failureCount: 0,
    lastUsedAt: new Date(),
  });
  const [created] = await db.select()
    .from(customerPushSubscriptions)
    .where(eq(customerPushSubscriptions.id, result.insertId));
  return created || null;
}

export async function getActivePushSubscriptionsForCustomer(customerId: number): Promise<CustomerPushSubscription[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(customerPushSubscriptions)
    .where(and(
      eq(customerPushSubscriptions.customerId, customerId),
      eq(customerPushSubscriptions.isActive, true)
    ));
}

/** Drop a push subscription — the caller's own. Scoping costs one clause and
 *  removes the only way one customer could unsubscribe another's device. */
export async function deletePushSubscriptionByEndpoint(endpoint: string, customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(customerPushSubscriptions)
    .where(and(
      eq(customerPushSubscriptions.endpoint, endpoint),
      eq(customerPushSubscriptions.customerId, customerId),
    ));
}

export async function markPushSubscriptionUsed(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(customerPushSubscriptions)
    .set({ lastUsedAt: new Date(), failureCount: 0 })
    .where(eq(customerPushSubscriptions.id, id));
}

export async function incrementPushSubscriptionFailure(id: number, deactivate: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;

  if (deactivate) {
    await db.update(customerPushSubscriptions)
      .set({ isActive: false, lastFailedAt: new Date(), failureCount: sql`${customerPushSubscriptions.failureCount} + 1` })
      .where(eq(customerPushSubscriptions.id, id));
  } else {
    await db.update(customerPushSubscriptions)
      .set({ lastFailedAt: new Date(), failureCount: sql`${customerPushSubscriptions.failureCount} + 1` })
      .where(eq(customerPushSubscriptions.id, id));
  }
}

// ============ PUSH NOTIFICATION CAMPAIGNS ============

export type PushTargetSegment = "active_customers" | "with_pending_packages" | "with_unpaid_invoices" | "vip_customers" | "inactive_30d";

export async function createPushCampaign(data: InsertPushNotificationCampaign): Promise<PushNotificationCampaign | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(pushNotificationCampaigns).values(data);
  const [created] = await db.select().from(pushNotificationCampaigns).where(eq(pushNotificationCampaigns.id, result.insertId));
  return created || null;
}

export async function updatePushCampaign(id: number, patch: Partial<InsertPushNotificationCampaign>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(pushNotificationCampaigns).set(patch).where(eq(pushNotificationCampaigns.id, id));
}

export async function getPushCampaignById(id: number): Promise<PushNotificationCampaign | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(pushNotificationCampaigns).where(eq(pushNotificationCampaigns.id, id));
  return row || null;
}

export async function listPushCampaigns(options?: { limit?: number; offset?: number; status?: string }): Promise<{ data: PushNotificationCampaign[]; total: number }> {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const where = options?.status ? eq(pushNotificationCampaigns.status, options.status as PushNotificationCampaign["status"]) : undefined;

  const [rows, totalRow] = await Promise.all([
    where
      ? db.select().from(pushNotificationCampaigns).where(where).orderBy(desc(pushNotificationCampaigns.createdAt)).limit(limit).offset(offset)
      : db.select().from(pushNotificationCampaigns).orderBy(desc(pushNotificationCampaigns.createdAt)).limit(limit).offset(offset),
    where
      ? db.select({ count: count() }).from(pushNotificationCampaigns).where(where)
      : db.select({ count: count() }).from(pushNotificationCampaigns),
  ]);
  return { data: rows, total: totalRow[0]?.count || 0 };
}

export async function getDuePushCampaigns(now: Date): Promise<PushNotificationCampaign[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pushNotificationCampaigns).where(and(
    eq(pushNotificationCampaigns.status, "scheduled"),
    lte(pushNotificationCampaigns.scheduledAt, now),
  ));
}

export async function getPushCampaignStats(): Promise<{
  totalSubscriptions: number;
  activeSubscriptions: number;
  uniqueCustomers: number;
  byPlatform: { platform: string; count: number }[];
  campaignsLast30Days: number;
  totalPushesSent: number;
}> {
  const db = await getDb();
  if (!db) {
    return { totalSubscriptions: 0, activeSubscriptions: 0, uniqueCustomers: 0, byPlatform: [], campaignsLast30Days: 0, totalPushesSent: 0 };
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalSubs, activeSubs, uniqueCustRow, platformRows, recentCampaignsRow, sentRow] = await Promise.all([
    db.select({ count: count() }).from(customerPushSubscriptions),
    db.select({ count: count() }).from(customerPushSubscriptions).where(eq(customerPushSubscriptions.isActive, true)),
    db.select({ count: sql<number>`COUNT(DISTINCT ${customerPushSubscriptions.customerId})` }).from(customerPushSubscriptions).where(eq(customerPushSubscriptions.isActive, true)),
    db.select({
      platform: customerPushSubscriptions.platform,
      count: count(),
    }).from(customerPushSubscriptions).where(eq(customerPushSubscriptions.isActive, true)).groupBy(customerPushSubscriptions.platform),
    db.select({ count: count() }).from(pushNotificationCampaigns).where(gte(pushNotificationCampaigns.createdAt, thirtyDaysAgo)),
    db.select({ total: sql<number>`COALESCE(SUM(${pushNotificationCampaigns.sentCount}), 0)` }).from(pushNotificationCampaigns),
  ]);

  return {
    totalSubscriptions: totalSubs[0]?.count || 0,
    activeSubscriptions: activeSubs[0]?.count || 0,
    uniqueCustomers: Number(uniqueCustRow[0]?.count || 0),
    byPlatform: platformRows.map(r => ({ platform: r.platform || "unknown", count: r.count })),
    campaignsLast30Days: recentCampaignsRow[0]?.count || 0,
    totalPushesSent: Number(sentRow[0]?.total || 0),
  };
}

/**
 * Resolve target customer IDs for a campaign. Returns DISTINCT customer IDs that
 * (a) exist in `customers` and (b) have at least one ACTIVE push subscription.
 * For "all" we return only customers with subs (no point sending where nobody can receive).
 */
export async function resolvePushTargetCustomerIds(opts: {
  targetType: "all" | "customer" | "batch" | "segment";
  targetCustomerId?: number | null;
  targetBatchId?: number | null;
  targetSegment?: PushTargetSegment | null;
}): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  // Anchor: only customers with at least one active push subscription
  const subscribedCustomerIds = await db
    .selectDistinct({ id: customerPushSubscriptions.customerId })
    .from(customerPushSubscriptions)
    .where(eq(customerPushSubscriptions.isActive, true));
  const subscribedSet = new Set(subscribedCustomerIds.map(r => r.id));
  if (subscribedSet.size === 0) return [];

  if (opts.targetType === "customer") {
    if (!opts.targetCustomerId) return [];
    return subscribedSet.has(opts.targetCustomerId) ? [opts.targetCustomerId] : [];
  }

  if (opts.targetType === "batch") {
    if (!opts.targetBatchId) return [];
    const rows = await db
      .selectDistinct({ id: packages.customerId })
      .from(packages)
      .where(and(eq(packages.batchId, opts.targetBatchId), isNotNull(packages.customerId)));
    return rows.map(r => r.id!).filter(id => subscribedSet.has(id));
  }

  if (opts.targetType === "segment") {
    const seg = opts.targetSegment;
    if (!seg) return [];

    if (seg === "active_customers") {
      const rows = await db.select({ id: customers.id }).from(customers).where(eq(customers.isActive, true));
      return rows.map(r => r.id).filter(id => subscribedSet.has(id));
    }

    if (seg === "with_pending_packages") {
      const rows = await db
        .selectDistinct({ id: packages.customerId })
        .from(packages)
        .where(and(
          isNotNull(packages.customerId),
          notInArray(packages.status, ["delivered", "cancelled"] as Package["status"][]),
        ));
      return rows.map(r => r.id!).filter(id => subscribedSet.has(id));
    }

    if (seg === "with_unpaid_invoices") {
      const rows = await db
        .selectDistinct({ id: invoices.customerId })
        .from(invoices)
        .where(and(
          isNotNull(invoices.customerId),
          notInArray(invoices.status, ["paid", "cancelled"] as Invoice["status"][]),
        ));
      return rows.map(r => r.id!).filter(id => subscribedSet.has(id));
    }

    if (seg === "vip_customers") {
      const rows = await db.select({ id: vipCustomers.customerId }).from(vipCustomers);
      return rows.map(r => r.id).filter(id => subscribedSet.has(id));
    }

    if (seg === "inactive_30d") {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      // Customers whose last push was >30d ago (or never) — based on subs.
      const rows = await db
        .selectDistinct({ id: customerPushSubscriptions.customerId })
        .from(customerPushSubscriptions)
        .where(and(
          eq(customerPushSubscriptions.isActive, true),
          or(isNull(customerPushSubscriptions.lastUsedAt), lte(customerPushSubscriptions.lastUsedAt, cutoff)),
        ));
      return rows.map(r => r.id);
    }
    return [];
  }

  // "all"
  return Array.from(subscribedSet);
}

// ============ CUSTOMER ADDRESSES ============

export async function getCustomerAddresses(customerId: number): Promise<CustomerAddress[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(customerAddresses)
    .where(and(
      eq(customerAddresses.customerId, customerId),
      eq(customerAddresses.isActive, true)
    ))
    .orderBy(desc(customerAddresses.isDefault), customerAddresses.label);
}

export async function getCustomerAddressById(addressId: number): Promise<CustomerAddress | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [address] = await db.select()
    .from(customerAddresses)
    .where(eq(customerAddresses.id, addressId));
  
  return address || null;
}

export async function createCustomerAddress(data: InsertCustomerAddress): Promise<CustomerAddress | null> {
  const db = await getDb();
  if (!db) return null;
  
  // If this is the first address or marked as default, unset other defaults
  if (data.isDefault) {
    await db.update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, data.customerId));
  }
  
  const [result] = await db.insert(customerAddresses).values(data);
  const [address] = await db.select().from(customerAddresses).where(eq(customerAddresses.id, result.insertId));
  return address || null;
}

export async function updateCustomerAddress(addressId: number, data: Partial<InsertCustomerAddress>): Promise<CustomerAddress | null> {
  const db = await getDb();
  if (!db) return null;
  
  // If setting as default, unset other defaults first
  if (data.isDefault) {
    const [existing] = await db.select().from(customerAddresses).where(eq(customerAddresses.id, addressId));
    if (existing) {
      await db.update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.customerId, existing.customerId));
    }
  }
  
  await db.update(customerAddresses)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(customerAddresses.id, addressId));
  
  const [address] = await db.select().from(customerAddresses).where(eq(customerAddresses.id, addressId));
  return address || null;
}

export async function deleteCustomerAddress(addressId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Soft delete by setting isActive to false
  await db.update(customerAddresses)
    .set({ isActive: false })
    .where(eq(customerAddresses.id, addressId));
}

export async function setDefaultAddress(addressId: number, customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Unset all defaults for this customer
  await db.update(customerAddresses)
    .set({ isDefault: false })
    .where(eq(customerAddresses.customerId, customerId));
  
  // Set the new default
  await db.update(customerAddresses)
    .set({ isDefault: true })
    .where(eq(customerAddresses.id, addressId));
}


/**
 * One of the customer's own parcels, in detail.
 *
 * `getPackageById` returns `select()`, and the portal's detail endpoint
 * returned it whole. Alongside the office's `notes` and the staff user ids on
 * every timestamp, that included `qrCodeData` and `qrCodeSignature` — the
 * signed payload a scanner verifies. Handing that to the browser gives away
 * the shape of a valid label for anyone who thinks to look.
 *
 * The allow-list the two list queries share, plus the fields a detail view
 * genuinely adds: the delivery proof, which is the customer's own, and the
 * recipient name it was handed to.
 */
export async function getCustomerPackageDetail(packageId: number, customerId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.select({
    ...CUSTOMER_PACKAGE_FIELDS,
    deliveryType: packages.deliveryType,
    packageOwnership: packages.packageOwnership,
    categoryId: packages.categoryId,
    claimedAt: packages.claimedAt,
    recipientName: packages.recipientName,
    recipientSignature: packages.recipientSignature,
    deliveryPhoto: packages.deliveryPhoto,
    volumetricNotifiedAt: packages.volumetricNotifiedAt,
    volumetricAckAt: packages.volumetricAckAt,
  }).from(packages)
    .where(and(
      eq(packages.id, packageId),
      // Scoped in the query, not checked after it.
      eq(packages.customerId, customerId),
    ))
    .limit(1);

  if (!rows[0]) return null;
  const [row] = await concealFullPackageParcels(rows);
  return row;
}

// ============ CUSTOMER FEATURES ============

/**
 * The feature ids one customer holds.
 *
 * Returns bare strings rather than rows: every caller asks the same question —
 * "does this customer have X" — and handing them the row would invite each
 * screen to answer it differently.
 */
export async function getCustomerFeatures(customerId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select({ feature: customerFeatures.feature })
    .from(customerFeatures)
    .where(eq(customerFeatures.customerId, customerId));

  return rows.map((r) => r.feature);
}

/** Everyone who holds a given feature, with enough of the customer to name them. */
export async function getCustomersWithFeature(feature: string) {
  const db = await getDb();
  if (!db) return [];

  return db.select({
    id: customerFeatures.id,
    customerId: customers.id,
    customerCode: customers.customerCode,
    fullName: customers.fullName,
    note: customerFeatures.note,
    grantedById: customerFeatures.grantedById,
    createdAt: customerFeatures.createdAt,
  })
    .from(customerFeatures)
    .innerJoin(customers, eq(customers.id, customerFeatures.customerId))
    .where(eq(customerFeatures.feature, feature))
    .orderBy(desc(customerFeatures.createdAt));
}

/**
 * Give a customer a feature.
 *
 * Idempotent: granting twice is not an error, it is somebody making sure. The
 * unique key on (customerId, feature) makes the second attempt a no-op rather
 * than a duplicate row that would later need deduplicating.
 */
export async function grantCustomerFeature(
  customerId: number,
  feature: string,
  grantedById: number,
  note?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select({ id: customerFeatures.id })
    .from(customerFeatures)
    .where(and(eq(customerFeatures.customerId, customerId), eq(customerFeatures.feature, feature)))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(customerFeatures).values({ customerId, feature, grantedById, note });
}

export async function revokeCustomerFeature(customerId: number, feature: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(customerFeatures)
    .where(and(eq(customerFeatures.customerId, customerId), eq(customerFeatures.feature, feature)));
}

/**
 * What this customer has agreed to be contacted about.
 *
 * Returns null when there is no row, and the caller must treat that as
 * consent withheld rather than as a default. Somebody who has never opened
 * the settings has never opted in — and WhatsApp in particular costs money
 * and lands on a personal phone.
 */
export async function getCustomerNotificationPrefs(customerId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(customerNotificationPrefs)
    .where(eq(customerNotificationPrefs.customerId, customerId))
    .limit(1);
  return row ?? null;
}
