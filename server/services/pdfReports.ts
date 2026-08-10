import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db';
import { packages, users, customers, ledgerTransactions, customerAccounts, paymentRecords, batches } from '../../drizzle/schema';
import { sql, count, eq, desc, asc, gte, lte, and, sum, inArray } from 'drizzle-orm';

// Ledger transaction-type buckets for the statement's "type" filter.
// These were written out here, correctly, while the classic money page split
// the same enum by hand and lost ADJUSTMENT_DEBIT. Both now read the one list
// so the statement and the screen cannot print different totals.
import { CHARGE_TX_TYPES, PAYMENT_TX_TYPES } from "@shared/ledgerTypes";

export type StatementTxFilter = 'all' | 'charges' | 'payments';

// ============ CUSTOMER PDF REPORT ============

interface CustomerReportData {
  customer: {
    id: number;
    fullName: string;
    customerCode: string;
    mobileNumber: string;
    email: string | null;
    createdAt: Date;
  };
  accountSummary: {
    totalCharges: number;
    totalPayments: number;
    currentBalance: number;
    creditLimit: number;
  };
  packages: Array<{
    trackingNumber: string;
    status: string;
    weightKg: number;
    costUsd: number;
    createdAt: Date;
    batchCode: string | null;
  }>;
  payments: Array<{
    amount: number;
    method: string;
    reference: string | null;
    createdAt: Date;
  }>;
  transactions: Array<{
    type: string;
    amount: number;
    description: string;
    createdAt: Date;
    /** Account balance after this transaction (USD) — the statement's running column. */
    balanceAfter: number;
  }>;
  generatedAt: Date;
  dateRange?: { start: Date; end: Date };
}

export async function getCustomerReportData(
  customerId: number,
  startDate?: Date,
  endDate?: Date,
  options?: { txType?: StatementTxFilter },
): Promise<CustomerReportData | null> {
  const db = await getDb();
  if (!db) return null;

  // Get customer info (from customers table)
  const [customer] = await db.select({
    id: customers.id,
    fullName: customers.fullName,
    customerCode: customers.customerCode,
    mobileNumber: customers.mobileNumber,
    email: customers.email,
    createdAt: customers.createdAt
  }).from(customers).where(eq(customers.id, customerId));

  if (!customer) return null;

  // Get account summary. Ledger/payment rows key on the ACCOUNT id, not the
  // customer id, so resolve it here and filter with it below.
  const [account] = await db.select({
    id: customerAccounts.id,
    currentBalance: customerAccounts.currentBalanceUsd,
    creditLimit: customerAccounts.creditLimitUsd
  }).from(customerAccounts).where(eq(customerAccounts.customerId, customerId));
  const accountId = account?.id ?? -1;

  // Get total charges
  const [chargesResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerTransactions.transactionType} LIKE 'DEBIT_%' THEN CAST(${ledgerTransactions.amountUsd} AS DECIMAL(12,2)) ELSE 0 END), 0)`
  }).from(ledgerTransactions).where(eq(ledgerTransactions.accountId, accountId));

  // Get total payments
  const [paymentsTotal] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2)) - CAST(${paymentRecords.reversedAmountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords).where(eq(paymentRecords.accountId, accountId));

  // Get packages with optional date filter
  let packagesQuery = db.select({
    trackingNumber: packages.trackingNumber,
    status: packages.status,
    weightKg: packages.weightKg,
    costUsd: packages.calculatedCostUsd,
    createdAt: packages.createdAt,
    batchId: packages.batchId
  }).from(packages).where(eq(packages.customerId, customerId));

  if (startDate && endDate) {
    packagesQuery = db.select({
      trackingNumber: packages.trackingNumber,
      status: packages.status,
      weightKg: packages.weightKg,
      costUsd: packages.calculatedCostUsd,
      createdAt: packages.createdAt,
      batchId: packages.batchId
    }).from(packages).where(and(
      eq(packages.customerId, customerId),
      gte(packages.createdAt, startDate),
      lte(packages.createdAt, endDate)
    ));
  }

  // High cap only as a runaway guard — the statement must be COMPLETE, the
  // old limit(50) silently dropped packages and customers noticed.
  const customerPackages = await packagesQuery.orderBy(desc(packages.createdAt)).limit(1000);

  // Get batch codes for packages
  const packagesWithBatch = await Promise.all(customerPackages.map(async (pkg) => {
    let batchCode = null;
    if (pkg.batchId) {
      const [batch] = await db.select({ batchCode: batches.batchCode }).from(batches).where(eq(batches.id, pkg.batchId));
      batchCode = batch?.batchCode || null;
    }
    return {
      trackingNumber: pkg.trackingNumber || '',
      status: pkg.status,
      weightKg: Number(pkg.weightKg) || 0,
      costUsd: Number(pkg.costUsd) || 0,
      createdAt: pkg.createdAt,
      batchCode
    };
  }));

  // Get payments with optional date filter
  let paymentsQuery = db.select({
    amount: paymentRecords.amountUsd,
    method: paymentRecords.paymentMethod,
    reference: paymentRecords.bankReference,
    createdAt: paymentRecords.createdAt
  }).from(paymentRecords).where(eq(paymentRecords.accountId, accountId));

  if (startDate && endDate) {
    paymentsQuery = db.select({
      amount: paymentRecords.amountUsd,
      method: paymentRecords.paymentMethod,
      reference: paymentRecords.bankReference,
      createdAt: paymentRecords.createdAt
    }).from(paymentRecords).where(and(
      eq(paymentRecords.accountId, accountId),
      gte(paymentRecords.createdAt, startDate),
      lte(paymentRecords.createdAt, endDate)
    ));
  }

  const payments = await paymentsQuery.orderBy(desc(paymentRecords.createdAt)).limit(1000);

  // Ledger transactions — the heart of the statement. Chronological (oldest
  // first) so the running-balance column reads like a real bank statement.
  const txConditions = [eq(ledgerTransactions.accountId, accountId)];
  if (startDate && endDate) {
    txConditions.push(gte(ledgerTransactions.createdAt, startDate));
    txConditions.push(lte(ledgerTransactions.createdAt, endDate));
  }
  if (options?.txType === 'charges') {
    txConditions.push(inArray(ledgerTransactions.transactionType, [...CHARGE_TX_TYPES]));
  } else if (options?.txType === 'payments') {
    txConditions.push(inArray(ledgerTransactions.transactionType, [...PAYMENT_TX_TYPES]));
  }

  const transactions = await db.select({
    type: ledgerTransactions.transactionType,
    amount: ledgerTransactions.amountUsd,
    description: ledgerTransactions.description,
    createdAt: ledgerTransactions.createdAt,
    balanceAfter: ledgerTransactions.balanceAfterUsd,
  }).from(ledgerTransactions)
    .where(and(...txConditions))
    .orderBy(asc(ledgerTransactions.createdAt))
    .limit(1000);

  return {
    customer: {
      id: customer.id,
      fullName: customer.fullName || 'Unknown',
      customerCode: customer.customerCode || '',
      mobileNumber: customer.mobileNumber || '',
      email: customer.email,
      createdAt: customer.createdAt
    },
    accountSummary: {
      totalCharges: parseFloat(chargesResult?.total || '0'),
      totalPayments: parseFloat(paymentsTotal?.total || '0'),
      currentBalance: parseFloat(account?.currentBalance || '0'),
      creditLimit: parseFloat(account?.creditLimit || '0')
    },
    packages: packagesWithBatch,
    payments: payments.map(p => ({
      amount: Number(p.amount) || 0,
      method: p.method,
      reference: p.reference,
      createdAt: p.createdAt
    })),
    transactions: transactions.map(t => ({
      type: t.type,
      amount: Number(t.amount) || 0,
      description: t.description || '',
      createdAt: t.createdAt,
      balanceAfter: Number(t.balanceAfter) || 0,
    })),
    generatedAt: new Date(),
    dateRange: startDate && endDate ? { start: startDate, end: endDate } : undefined
  };
}

// ---- Localized customer statement -----------------------------------------
// Labels for the customer statement in the three fonts we can actually render:
// English (Helvetica) and Kurdish/Arabic (embedded Vazirmatn, shaped by
// fontkit). Chinese falls back to English — no CJK font is bundled. Numbers,
// codes and dates stay Latin everywhere by design.
export type StatementLang = 'ku' | 'en' | 'ar' | 'zh';

const STMT: Record<string, { en: string; ku: string; ar: string }> = {
  title: { en: 'Account Statement', ku: 'کەشفی حساب', ar: 'كشف الحساب' },
  period: { en: 'Period', ku: 'ماوە', ar: 'الفترة' },
  generated: { en: 'Generated', ku: 'بەرواری دەرچوون', ar: 'تاريخ الإصدار' },
  customerCode: { en: 'Customer Code', ku: 'کۆدی کڕیار', ar: 'رمز العميل' },
  mobile: { en: 'Mobile', ku: 'مۆبایل', ar: 'الموبايل' },
  accountSummary: { en: 'Account Summary', ku: 'پوختەی حساب', ar: 'ملخص الحساب' },
  totalCharges: { en: 'Total Charges', ku: 'کۆی قەرزەکان', ar: 'إجمالي المصاريف' },
  totalPayments: { en: 'Total Payments', ku: 'کۆی پارەدانەکان', ar: 'إجمالي المدفوعات' },
  currentBalance: { en: 'Current Balance', ku: 'باڵانسی ئێستا', ar: 'الرصيد الحالي' },
  totalPackages: { en: 'Total Packages', ku: 'کۆی پاکێجەکان', ar: 'إجمالي الطرود' },
  balanceDue: { en: 'Balance Due', ku: 'قەرزی ماوە', ar: 'الرصيد المستحق' },
  ledgerTitle: { en: 'Statement of Transactions', ku: 'کەشفی مامەڵەکان', ar: 'كشف المعاملات' },
  colDate: { en: 'Date', ku: 'بەروار', ar: 'التاريخ' },
  colDescription: { en: 'Description', ku: 'وەسف', ar: 'الوصف' },
  colDebit: { en: 'Charge', ku: 'قەرز', ar: 'مصروف' },
  colCredit: { en: 'Payment', ku: 'پارەدان', ar: 'دفعة' },
  colBalance: { en: 'Balance', ku: 'باڵانس', ar: 'الرصيد' },
  periodTotals: { en: 'Totals for shown rows', ku: 'کۆی ئەم ماوەیە', ar: 'مجموع هذه الفترة' },
  packagesTitle: { en: 'Package History', ku: 'مێژووی پاکێجەکان', ar: 'سجل الطرود' },
  colTracking: { en: 'Tracking #', ku: 'تراکینگ', ar: 'رقم التتبع' },
  colStatus: { en: 'Status', ku: 'دۆخ', ar: 'الحالة' },
  colWeight: { en: 'Weight', ku: 'کێش', ar: 'الوزن' },
  colCost: { en: 'Cost', ku: 'نرخ', ar: 'الكلفة' },
  colBatch: { en: 'Batch', ku: 'بار', ar: 'الشحنة' },
  paymentsTitle: { en: 'Payment History', ku: 'مێژووی پارەدانەکان', ar: 'سجل المدفوعات' },
  colAmount: { en: 'Amount', ku: 'بڕ', ar: 'المبلغ' },
  colMethod: { en: 'Method', ku: 'شێواز', ar: 'الطريقة' },
  colReference: { en: 'Reference', ku: 'ژمارەی حەواڵە', ar: 'المرجع' },
  noRecords: { en: 'No records in this period', ku: 'هیچ تۆمارێک نییە لەم ماوەیەدا', ar: 'لا توجد سجلات في هذه الفترة' },
};

// Package statuses shown in the packages table, localized for ku/ar.
const STMT_STATUS: Record<string, { ku: string; ar: string }> = {
  registered: { ku: 'تۆمارکراوە', ar: 'مسجل' },
  in_batch: { ku: 'لە باردا', ar: 'في الشحنة' },
  in_transit: { ku: 'لە ڕێگادا', ar: 'في الطريق' },
  customs_processing: { ku: 'گومرگ', ar: 'الجمارك' },
  ready_for_delivery: { ku: 'ئامادەیە', ar: 'جاهز' },
  out_for_delivery: { ku: 'لە گەیاندندا', ar: 'قيد التسليم' },
  delivered: { ku: 'گەیەندراوە', ar: 'تم التسليم' },
  returned: { ku: 'گەڕێنراوەتەوە', ar: 'مرتجع' },
  cancelled: { ku: 'هەڵوەشاوە', ar: 'ملغى' },
};

export async function generateCustomerPDF(data: CustomerReportData, lang: StatementLang = 'en'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        // Keep every page in the buffer so the footer loop can switchToPage
        // over all of them — without this, multi-page reports crash with
        // "switchToPage(0) out of bounds".
        bufferPages: true,
        info: {
          Title: `Wazn Express - Account Statement: ${data.customer.fullName}`,
          Author: 'Wazn Express System',
          Subject: 'Account Statement',
          CreationDate: new Date()
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Embedded Arabic-script font (fontkit shapes the letters). If the file
      // is ever missing we silently fall back to English/Helvetica — a plain
      // statement must always beat a crashed one.
      const fontsDir = path.join(process.cwd(), 'server', 'assets', 'fonts');
      const vazirReg = path.join(fontsDir, 'Vazirmatn-Regular.ttf');
      const vazirBold = path.join(fontsDir, 'Vazirmatn-Bold.ttf');
      const hasVazir = fs.existsSync(vazirReg) && fs.existsSync(vazirBold);
      const uiLang: 'en' | 'ku' | 'ar' = (lang === 'ku' || lang === 'ar') && hasVazir ? lang : 'en';
      const rtl = uiLang !== 'en';
      if (hasVazir) {
        doc.registerFont('Vazir', vazirReg);
        doc.registerFont('Vazir-Bold', vazirBold);
      }
      const FR = rtl ? 'Vazir' : 'Helvetica';
      const FB = rtl ? 'Vazir-Bold' : 'Helvetica-Bold';
      const L = (key: keyof typeof STMT) => STMT[key][uiLang];
      const statusText = (s: string) =>
        rtl ? (STMT_STATUS[s]?.[uiLang as 'ku' | 'ar'] ?? formatStatus(s)) : formatStatus(s);

      // Mirror an LTR-designed box for RTL layouts (A4 width 595, margins 40).
      const mx = (x: number, w: number) => (rtl ? 595 - x - w : x);
      const alignStart = rtl ? 'right' : 'left';
      const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-GB');

      let y = 120;
      const ensure = (needed: number, redraw?: () => void) => {
        if (y + needed > 760) {
          doc.addPage();
          y = 50;
          redraw?.();
        }
      };

      // ---- Header ----------------------------------------------------------
      doc.rect(0, 0, 595, 100).fill('#1a365d');
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff')
         .text('WAZN EXPRESS', mx(40, 250), 26, { width: 250, align: alignStart });
      doc.fontSize(13).font(FB).fillColor('#cbd5e0')
         .text(L('title'), mx(40, 250), 54, { width: 250, align: alignStart });

      doc.fontSize(9).font(FR).fillColor('#a0aec0');
      if (data.dateRange) {
        doc.text(L('period'), mx(415, 140), 30, { width: 140, align: rtl ? 'left' : 'right' });
        doc.font('Helvetica').text(
          `${fmtDate(data.dateRange.start)} - ${fmtDate(data.dateRange.end)}`,
          mx(395, 160), 43, { width: 160, align: rtl ? 'left' : 'right' },
        );
      }
      doc.font(FR).text(L('generated'), mx(415, 140), 60, { width: 140, align: rtl ? 'left' : 'right' });
      doc.font('Helvetica').text(fmtDate(data.generatedAt), mx(395, 160), 73, { width: 160, align: rtl ? 'left' : 'right' });

      // ---- Customer card ---------------------------------------------------
      doc.roundedRect(40, y, 515, 84, 8).fillColor('#f7fafc').fill();
      doc.roundedRect(40, y, 515, 84, 8).strokeColor('#e2e8f0').stroke();

      doc.fontSize(14).font(rtl && /[؀-ۿ]/.test(data.customer.fullName) ? FB : 'Helvetica-Bold')
         .fillColor('#1a365d')
         .text(data.customer.fullName, mx(55, 270), y + 14, { width: 270, align: alignStart });
      doc.fontSize(9).font(FR).fillColor('#4a5568')
         .text(L('customerCode'), mx(55, 130), y + 38, { width: 130, align: alignStart });
      doc.font('Helvetica-Bold').text(data.customer.customerCode, mx(55, 270), y + 51, { width: 270, align: alignStart });
      doc.font(FR).text(L('mobile'), mx(55, 130), y + 66, { width: 130, align: alignStart, continued: false });
      doc.font('Helvetica').text(data.customer.mobileNumber, mx(130, 195), y + 66, { width: 195, align: alignStart });

      // Account summary — right half of the card (left half in RTL)
      doc.fontSize(9.5).font(FB).fillColor('#2d3748')
         .text(L('accountSummary'), mx(350, 190), y + 12, { width: 190, align: alignStart });
      const sumLine = (label: string, value: string, yy: number, color = '#4a5568', boldVal = false) => {
        doc.fontSize(8.5).font(FR).fillColor(color)
           .text(label, mx(350, 120), yy, { width: 120, align: alignStart });
        doc.font(boldVal ? 'Helvetica-Bold' : 'Helvetica')
           .text(value, mx(455, 90), yy, { width: 90, align: rtl ? 'left' : 'right' });
      };
      sumLine(L('totalCharges'), `$${data.accountSummary.totalCharges.toFixed(2)}`, y + 28);
      sumLine(L('totalPayments'), `$${data.accountSummary.totalPayments.toFixed(2)}`, y + 44);
      sumLine(
        L('currentBalance'),
        `$${data.accountSummary.currentBalance.toFixed(2)}`,
        y + 60,
        data.accountSummary.currentBalance > 0 ? '#e53e3e' : '#38a169',
        true,
      );

      y += 104;

      // ---- Summary cards ---------------------------------------------------
      const cardWidth = 160;
      const cardGap = 17;
      const card = (slot: number, label: string, value: string, color: string) => {
        const cx = mx(40 + slot * (cardWidth + cardGap), cardWidth);
        doc.roundedRect(cx, y, cardWidth, 58, 8).fillColor('#ffffff').fill();
        doc.roundedRect(cx, y, cardWidth, 58, 8).strokeColor('#e2e8f0').stroke();
        doc.rect(cx, y, 4, 58).fill(color);
        doc.fontSize(8.5).font(FR).fillColor('#718096')
           .text(label, cx + 10, y + 10, { width: cardWidth - 20, align: alignStart });
        doc.fontSize(16).font('Helvetica-Bold').fillColor(color)
           .text(value, cx + 10, y + 28, { width: cardWidth - 20, align: alignStart });
      };
      card(0, L('totalPackages'), String(data.packages.length), '#3182ce');
      card(1, L('totalPayments'), `$${data.accountSummary.totalPayments.toFixed(0)}`, '#38a169');
      card(2, L('balanceDue'), `$${data.accountSummary.currentBalance.toFixed(0)}`,
        data.accountSummary.currentBalance > 0 ? '#e53e3e' : '#38a169');

      y += 80;

      const sectionTitle = (label: string) => {
        ensure(34);
        doc.fontSize(12).font(FB).fillColor('#1a365d')
           .text(label, 40, y, { width: 515, align: alignStart });
        y += 20;
      };

      const emptyNote = () => {
        doc.fontSize(9).font(FR).fillColor('#718096')
           .text(L('noRecords'), 40, y + 4, { width: 515, align: alignStart });
        y += 24;
      };

      // ---- 1) Full ledger (the actual statement) ---------------------------
      // Columns (LTR design, auto-mirrored): Date | Description | Charge |
      // Payment | Balance. All rows, chronological, with running balance.
      const led = {
        date: { x: 44, w: 60 },
        desc: { x: 108, w: 220 },
        debit: { x: 334, w: 68 },
        credit: { x: 406, w: 68 },
        balance: { x: 478, w: 73 },
      };
      const ledgerHeader = () => {
        doc.rect(40, y, 515, 20).fill('#edf2f7');
        doc.fontSize(8.5).font(FB).fillColor('#4a5568');
        doc.text(L('colDate'), mx(led.date.x, led.date.w), y + 6, { width: led.date.w, align: alignStart });
        doc.text(L('colDescription'), mx(led.desc.x, led.desc.w), y + 6, { width: led.desc.w, align: alignStart });
        doc.text(L('colDebit'), mx(led.debit.x, led.debit.w), y + 6, { width: led.debit.w, align: 'center' });
        doc.text(L('colCredit'), mx(led.credit.x, led.credit.w), y + 6, { width: led.credit.w, align: 'center' });
        doc.text(L('colBalance'), mx(led.balance.x, led.balance.w), y + 6, { width: led.balance.w, align: 'center' });
        y += 20;
      };

      sectionTitle(L('ledgerTitle'));
      ledgerHeader();

      if (data.transactions.length === 0) {
        emptyNote();
      } else {
        let totalDebit = 0;
        let totalCredit = 0;
        let rowIndex = 0;
        for (const tx of data.transactions) {
          const isCharge = tx.type.startsWith('DEBIT') || tx.type === 'ADJUSTMENT_DEBIT';
          if (isCharge) totalDebit += tx.amount; else totalCredit += tx.amount;

          const desc = (tx.description || formatStatus(tx.type)).replace(/\s+/g, ' ').trim();
          doc.font(rtl && /[؀-ۿ]/.test(desc) ? FR : 'Helvetica').fontSize(7.5);
          const descH = Math.min(doc.heightOfString(desc, { width: led.desc.w }), 28);
          const rowH = Math.max(16, descH + 6);
          ensure(rowH + 2, ledgerHeader);

          if (rowIndex % 2 === 1) doc.rect(40, y, 515, rowH).fill('#f7fafc');
          doc.fontSize(7.5).font('Helvetica').fillColor('#2d3748')
             .text(fmtDate(tx.createdAt), mx(led.date.x, led.date.w), y + 4, { width: led.date.w, align: alignStart });
          doc.font(rtl && /[؀-ۿ]/.test(desc) ? FR : 'Helvetica')
             .text(desc, mx(led.desc.x, led.desc.w), y + 4, { width: led.desc.w, height: 28, ellipsis: true, align: alignStart });
          doc.font('Helvetica');
          if (isCharge) {
            doc.fillColor('#e53e3e').text(`$${tx.amount.toFixed(2)}`, mx(led.debit.x, led.debit.w), y + 4, { width: led.debit.w, align: 'center' });
          } else {
            doc.fillColor('#38a169').text(`$${tx.amount.toFixed(2)}`, mx(led.credit.x, led.credit.w), y + 4, { width: led.credit.w, align: 'center' });
          }
          doc.fillColor(tx.balanceAfter > 0 ? '#e53e3e' : '#38a169').font('Helvetica-Bold')
             .text(`$${tx.balanceAfter.toFixed(2)}`, mx(led.balance.x, led.balance.w), y + 4, { width: led.balance.w, align: 'center' });
          y += rowH;
          rowIndex++;
        }

        // Totals band for the shown rows
        ensure(24);
        doc.rect(40, y, 515, 20).fill('#e2e8f0');
        doc.fontSize(8).font(FB).fillColor('#2d3748')
           .text(L('periodTotals'), mx(led.date.x, led.date.w + led.desc.w), y + 6, { width: led.date.w + led.desc.w, align: alignStart });
        doc.font('Helvetica-Bold').fillColor('#e53e3e')
           .text(`$${totalDebit.toFixed(2)}`, mx(led.debit.x, led.debit.w), y + 6, { width: led.debit.w, align: 'center' });
        doc.fillColor('#38a169')
           .text(`$${totalCredit.toFixed(2)}`, mx(led.credit.x, led.credit.w), y + 6, { width: led.credit.w, align: 'center' });
        y += 28;
      }

      y += 10;

      // ---- 2) Packages (complete, no cap) ----------------------------------
      const pk = {
        tracking: { x: 44, w: 128 },
        status: { x: 176, w: 74 },
        weight: { x: 254, w: 50 },
        cost: { x: 308, w: 58 },
        batch: { x: 370, w: 112 },
        date: { x: 486, w: 65 },
      };
      const pkgHeader = () => {
        doc.rect(40, y, 515, 20).fill('#edf2f7');
        doc.fontSize(8.5).font(FB).fillColor('#4a5568');
        doc.text(L('colTracking'), mx(pk.tracking.x, pk.tracking.w), y + 6, { width: pk.tracking.w, align: alignStart });
        doc.text(L('colStatus'), mx(pk.status.x, pk.status.w), y + 6, { width: pk.status.w, align: alignStart });
        doc.text(L('colWeight'), mx(pk.weight.x, pk.weight.w), y + 6, { width: pk.weight.w, align: 'center' });
        doc.text(L('colCost'), mx(pk.cost.x, pk.cost.w), y + 6, { width: pk.cost.w, align: 'center' });
        doc.text(L('colBatch'), mx(pk.batch.x, pk.batch.w), y + 6, { width: pk.batch.w, align: alignStart });
        doc.text(L('colDate'), mx(pk.date.x, pk.date.w), y + 6, { width: pk.date.w, align: alignStart });
        y += 20;
      };

      sectionTitle(L('packagesTitle'));
      pkgHeader();
      if (data.packages.length === 0) {
        emptyNote();
      } else {
        data.packages.forEach((pkg, i) => {
          ensure(18, pkgHeader);
          if (i % 2 === 1) doc.rect(40, y, 515, 16).fill('#f7fafc');
          doc.fontSize(7.5).font('Helvetica').fillColor('#2d3748')
             .text(pkg.trackingNumber.substring(0, 24), mx(pk.tracking.x, pk.tracking.w), y + 4, { width: pk.tracking.w, align: alignStart });
          doc.font(rtl ? FR : 'Helvetica').fillColor(getStatusColor(pkg.status))
             .text(statusText(pkg.status), mx(pk.status.x, pk.status.w), y + 4, { width: pk.status.w, align: alignStart });
          doc.font('Helvetica').fillColor('#2d3748');
          doc.text(`${pkg.weightKg.toFixed(1)} kg`, mx(pk.weight.x, pk.weight.w), y + 4, { width: pk.weight.w, align: 'center' });
          doc.text(`$${pkg.costUsd.toFixed(2)}`, mx(pk.cost.x, pk.cost.w), y + 4, { width: pk.cost.w, align: 'center' });
          doc.text(pkg.batchCode || '-', mx(pk.batch.x, pk.batch.w), y + 4, { width: pk.batch.w, align: alignStart });
          doc.text(fmtDate(pkg.createdAt), mx(pk.date.x, pk.date.w), y + 4, { width: pk.date.w, align: alignStart });
          y += 16;
        });
        y += 8;
      }

      y += 10;

      // ---- 3) Payments (complete, no cap) ----------------------------------
      const pay = {
        date: { x: 44, w: 80 },
        amount: { x: 128, w: 80 },
        method: { x: 212, w: 120 },
        reference: { x: 336, w: 215 },
      };
      const payHeader = () => {
        doc.rect(40, y, 515, 20).fill('#edf2f7');
        doc.fontSize(8.5).font(FB).fillColor('#4a5568');
        doc.text(L('colDate'), mx(pay.date.x, pay.date.w), y + 6, { width: pay.date.w, align: alignStart });
        doc.text(L('colAmount'), mx(pay.amount.x, pay.amount.w), y + 6, { width: pay.amount.w, align: 'center' });
        doc.text(L('colMethod'), mx(pay.method.x, pay.method.w), y + 6, { width: pay.method.w, align: alignStart });
        doc.text(L('colReference'), mx(pay.reference.x, pay.reference.w), y + 6, { width: pay.reference.w, align: alignStart });
        y += 20;
      };

      sectionTitle(L('paymentsTitle'));
      payHeader();
      if (data.payments.length === 0) {
        emptyNote();
      } else {
        data.payments.forEach((payment, i) => {
          ensure(18, payHeader);
          if (i % 2 === 1) doc.rect(40, y, 515, 16).fill('#f7fafc');
          doc.fontSize(7.5).font('Helvetica').fillColor('#2d3748')
             .text(fmtDate(payment.createdAt), mx(pay.date.x, pay.date.w), y + 4, { width: pay.date.w, align: alignStart });
          doc.fillColor('#38a169').text(`$${payment.amount.toFixed(2)}`, mx(pay.amount.x, pay.amount.w), y + 4, { width: pay.amount.w, align: 'center' });
          doc.fillColor('#2d3748');
          doc.text(formatPaymentMethod(payment.method), mx(pay.method.x, pay.method.w), y + 4, { width: pay.method.w, align: alignStart });
          doc.text(payment.reference || '-', mx(pay.reference.x, pay.reference.w), y + 4, { width: pay.reference.w, align: alignStart });
          y += 16;
        });
      }

      // ---- Footer (Latin on purpose — tiny print, avoids bidi mixing) ------
      const range = doc.bufferedPageRange();
      const pageCount = range.start + range.count;
      for (let i = range.start; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).font('Helvetica').fillColor('#a0aec0')
           .text(
             `Page ${i + 1} of ${pageCount} | Wazn Express Account Statement | ${data.customer.customerCode}`,
             40, 780, { align: 'center', width: 515 }
           );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ============ BATCH PDF REPORT ============

interface BatchReportData {
  batch: {
    id: number;
    batchCode: string;
    shippingType: string;
    status: string;
    departureDate: Date | null;
    arrivalDate: Date | null;
    totalWeight: number;
    carrierInfo: string | null;
  };
  summary: {
    totalPackages: number;
    totalWeight: number;
    totalCost: number;
    customerCount: number;
  };
  packages: Array<{
    trackingNumber: string;
    customerName: string;
    customerCode: string;
    weightKg: number;
    costUsd: number;
    status: string;
  }>;
  customerBreakdown: Array<{
    customerName: string;
    customerCode: string;
    packageCount: number;
    totalWeight: number;
    totalCost: number;
  }>;
  generatedAt: Date;
}

export async function getBatchReportData(batchId: number): Promise<BatchReportData | null> {
  const db = await getDb();
  if (!db) return null;

  // Get batch info
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId));
  if (!batch) return null;

  // Get packages in batch
  const batchPackages = await db.select({
    trackingNumber: packages.trackingNumber,
    customerId: packages.customerId,
    weightKg: packages.weightKg,
    costUsd: packages.calculatedCostUsd,
    status: packages.status
  }).from(packages).where(eq(packages.batchId, batchId));

  // Get customer info for each package (from customers table)
  const packagesWithCustomer = await Promise.all(batchPackages.map(async (pkg) => {
    const [customer] = await db.select({
      fullName: customers.fullName,
      customerCode: customers.customerCode
    }).from(customers).where(eq(customers.id, pkg.customerId || 0));
    
    return {
      trackingNumber: pkg.trackingNumber || '',
      customerName: customer?.fullName || 'Unknown',
      customerCode: customer?.customerCode || '',
      weightKg: Number(pkg.weightKg) || 0,
      costUsd: Number(pkg.costUsd) || 0,
      status: pkg.status
    };
  }));

  // Calculate customer breakdown
  const customerMap = new Map<number, { name: string; code: string; packages: number; weight: number; cost: number }>();
  
  for (const pkg of batchPackages) {
    const customerId = pkg.customerId || 0;
    const existing = customerMap.get(customerId);
    if (existing) {
      existing.packages++;
      existing.weight += Number(pkg.weightKg) || 0;
      existing.cost += Number(pkg.costUsd) || 0;
    } else {
      const [customer] = await db.select({
        fullName: customers.fullName,
        customerCode: customers.customerCode
      }).from(customers).where(eq(customers.id, customerId));
      
      customerMap.set(customerId, {
        name: customer?.fullName || 'Unknown',
        code: customer?.customerCode || '',
        packages: 1,
        weight: Number(pkg.weightKg) || 0,
        cost: Number(pkg.costUsd) || 0
      });
    }
  }

  const customerBreakdown = Array.from(customerMap.values()).map(c => ({
    customerName: c.name,
    customerCode: c.code,
    packageCount: c.packages,
    totalWeight: c.weight,
    totalCost: c.cost
  })).sort((a, b) => b.packageCount - a.packageCount);

  const totalWeight = packagesWithCustomer.reduce((sum, p) => sum + p.weightKg, 0);
  const totalCost = packagesWithCustomer.reduce((sum, p) => sum + p.costUsd, 0);

  return {
    batch: {
      id: batch.id,
      batchCode: batch.batchCode,
      shippingType: batch.shippingType,
      status: batch.status,
      departureDate: batch.departureDate,
      arrivalDate: batch.actualArrival,
      totalWeight: Number(batch.totalWeight) || 0,
      carrierInfo: batch.carrierInfo
    },
    summary: {
      totalPackages: packagesWithCustomer.length,
      totalWeight,
      totalCost,
      customerCount: customerMap.size
    },
    packages: packagesWithCustomer,
    customerBreakdown,
    generatedAt: new Date()
  };
}

export async function generateBatchPDF(data: BatchReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `Wazn Express - Batch Report: ${data.batch.batchCode}`,
          Author: 'Wazn Express System',
          Subject: 'Batch Report',
          CreationDate: new Date()
        }
      });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      const headerColor = data.batch.shippingType === 'sea' ? '#0d9488' : '#3b82f6';
      doc.rect(0, 0, 595, 110).fill(headerColor);
      
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff')
         .text('WAZN EXPRESS', 40, 25);
      doc.fontSize(14).font('Helvetica').fillColor('#e0e7ff')
         .text('Batch Shipment Report', 40, 50);
      
      // Batch code badge
      doc.roundedRect(40, 70, 150, 28, 4).fill('#ffffff');
      doc.fontSize(14).font('Helvetica-Bold').fillColor(headerColor)
         .text(data.batch.batchCode, 50, 78);
      
      // Shipping type badge
      const typeLabel = data.batch.shippingType === 'sea' ? '🚢 Sea Freight' : '✈️ Air Freight';
      doc.fontSize(10).fillColor('#ffffff')
         .text(typeLabel, 400, 78);
      
      // Generated date
      doc.fontSize(9).fillColor('#e0e7ff')
         .text(`Generated: ${data.generatedAt.toLocaleString()}`, 400, 92);

      let y = 130;

      // Batch Info Card
      doc.roundedRect(40, y, 515, 70, 8).fillColor('#f0f9ff').fill();
      doc.roundedRect(40, y, 515, 70, 8).strokeColor('#bae6fd').stroke();
      
      doc.fontSize(10).font('Helvetica').fillColor('#4a5568');
      doc.text(`Status: ${formatStatus(data.batch.status)}`, 55, y + 15);
      doc.text(`Carrier: ${data.batch.carrierInfo || 'Not specified'}`, 55, y + 32);
      
      if (data.batch.departureDate) {
        doc.text(`Departure: ${data.batch.departureDate.toLocaleDateString()}`, 250, y + 15);
      }
      if (data.batch.arrivalDate) {
        doc.text(`Arrival: ${data.batch.arrivalDate.toLocaleDateString()}`, 250, y + 32);
      }
      
      doc.text(`Total Weight: ${data.batch.totalWeight.toFixed(1)} kg`, 420, y + 15);
      doc.text(`Packages: ${data.summary.totalPackages}`, 420, y + 32);

      y += 90;

      // Summary Cards
      const cardWidth = 120;
      const cardGap = 12;
      
      drawSummaryCard(doc, 40, y, cardWidth, 'Packages', String(data.summary.totalPackages), '#3182ce');
      drawSummaryCard(doc, 40 + cardWidth + cardGap, y, cardWidth, 'Customers', String(data.summary.customerCount), '#805ad5');
      drawSummaryCard(doc, 40 + (cardWidth + cardGap) * 2, y, cardWidth, 'Weight', `${data.summary.totalWeight.toFixed(1)} kg`, '#dd6b20');
      drawSummaryCard(doc, 40 + (cardWidth + cardGap) * 3, y, cardWidth, 'Total Cost', `$${data.summary.totalCost.toFixed(0)}`, '#38a169');

      y += 85;

      // Customer Breakdown Table
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
         .text('Customer Breakdown', 40, y);
      y += 20;

      // Table header
      doc.rect(40, y, 515, 22).fill('#edf2f7');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('Customer', 45, y + 6);
      doc.text('Code', 200, y + 6);
      doc.text('Packages', 280, y + 6);
      doc.text('Weight', 360, y + 6);
      doc.text('Cost', 450, y + 6);
      y += 22;

      // Table rows
      doc.font('Helvetica').fontSize(8);
      for (const customer of data.customerBreakdown.slice(0, 12)) {
        const rowColor = data.customerBreakdown.indexOf(customer) % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(40, y, 515, 18).fill(rowColor);
        
        doc.fillColor('#2d3748');
        doc.text(customer.customerName.substring(0, 25), 45, y + 5);
        doc.text(customer.customerCode, 200, y + 5);
        doc.text(String(customer.packageCount), 280, y + 5);
        doc.text(`${customer.totalWeight.toFixed(1)} kg`, 360, y + 5);
        doc.fillColor('#38a169').text(`$${customer.totalCost.toFixed(2)}`, 450, y + 5);
        y += 18;
      }

      y += 25;

      // Package List Table
      if (y > 550) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
         .text('Package List', 40, y);
      y += 20;

      // Table header
      doc.rect(40, y, 515, 22).fill('#edf2f7');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('Tracking #', 45, y + 6);
      doc.text('Customer', 180, y + 6);
      doc.text('Weight', 320, y + 6);
      doc.text('Cost', 390, y + 6);
      doc.text('Status', 470, y + 6);
      y += 22;

      // Table rows
      doc.font('Helvetica').fontSize(8);
      for (const pkg of data.packages.slice(0, 20)) {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        
        const rowColor = data.packages.indexOf(pkg) % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(40, y, 515, 18).fill(rowColor);
        
        doc.fillColor('#2d3748');
        doc.text(pkg.trackingNumber.substring(0, 18), 45, y + 5);
        doc.text(pkg.customerName.substring(0, 20), 180, y + 5);
        doc.text(`${pkg.weightKg.toFixed(1)} kg`, 320, y + 5);
        doc.text(`$${pkg.costUsd.toFixed(2)}`, 390, y + 5);
        doc.fillColor(getStatusColor(pkg.status)).text(formatStatus(pkg.status), 470, y + 5);
        y += 18;
      }

      if (data.packages.length > 20) {
        doc.fontSize(8).fillColor('#718096').text(`... and ${data.packages.length - 20} more packages`, 45, y + 5);
      }

      // Footer — iterate the actual buffered range (start may be non-zero)
      const range = doc.bufferedPageRange();
      const pageCount = range.start + range.count;
      for (let i = range.start; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#a0aec0')
           .text(
             `Page ${i + 1} of ${pageCount} | Wazn Express Batch Report | ${data.batch.batchCode}`,
             40, 780, { align: 'center', width: 515 }
           );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ============ DATE-FILTERED DASHBOARD REPORT ============

interface DateFilteredDashboardData {
  dateRange: { start: Date; end: Date };
  periodLabel: string;
  financialStats: {
    totalRevenue: number;
    totalPayments: number;
    newCustomers: number;
    packagesProcessed: number;
  };
  dailyRevenue: Array<{ date: string; revenue: number; packages: number }>;
  topCustomers: Array<{ name: string; code: string; revenue: number; packages: number }>;
  packagesByStatus: Array<{ status: string; count: number }>;
  generatedAt: Date;
}

export async function getDateFilteredDashboardData(
  period: 'week' | 'month' | 'year' | 'custom',
  customStart?: Date,
  customEnd?: Date
): Promise<DateFilteredDashboardData> {
  const db = await getDb();
  
  const now = new Date();
  let startDate: Date;
  let endDate = new Date(now);
  let periodLabel: string;

  switch (period) {
    case 'week':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      periodLabel = 'Last 7 Days';
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      periodLabel = 'Last 30 Days';
      break;
    case 'year':
      startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
      periodLabel = 'Last 12 Months';
      break;
    case 'custom':
      startDate = customStart || new Date(now.setDate(now.getDate() - 30));
      endDate = customEnd || new Date();
      periodLabel = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
      break;
    default:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      periodLabel = 'Last 30 Days';
  }

  if (!db) {
    return {
      dateRange: { start: startDate, end: endDate },
      periodLabel,
      financialStats: { totalRevenue: 0, totalPayments: 0, newCustomers: 0, packagesProcessed: 0 },
      dailyRevenue: [],
      topCustomers: [],
      packagesByStatus: [],
      generatedAt: new Date()
    };
  }

  // Get total revenue in period
  const [revenueResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2)) - CAST(${paymentRecords.reversedAmountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords)
    .where(and(
      gte(paymentRecords.createdAt, startDate),
      lte(paymentRecords.createdAt, endDate)
    ));

  // Get packages processed in period
  const [packagesResult] = await db.select({
    count: count()
  }).from(packages)
    .where(and(
      gte(packages.createdAt, startDate),
      lte(packages.createdAt, endDate)
    ));

  // Get new customers in period (from customers table)
  const [customersResult] = await db.select({
    count: count()
  }).from(customers)
    .where(and(
      gte(customers.createdAt, startDate),
      lte(customers.createdAt, endDate)
    ));

  // Get packages by status in period
  const packagesByStatus = await db.select({
    status: packages.status,
    count: count()
  }).from(packages)
    .where(and(
      gte(packages.createdAt, startDate),
      lte(packages.createdAt, endDate)
    ))
    .groupBy(packages.status);

  // Get top customers in period
  const topCustomersRaw = await db.select({
    customerId: paymentRecords.accountId,
    totalRevenue: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2)) - CAST(${paymentRecords.reversedAmountUsd} AS DECIMAL(12,2))), 0)`,
    packageCount: count()
  }).from(paymentRecords)
    .where(and(
      gte(paymentRecords.createdAt, startDate),
      lte(paymentRecords.createdAt, endDate)
    ))
    .groupBy(paymentRecords.accountId)
    .orderBy(desc(sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2)) - CAST(${paymentRecords.reversedAmountUsd} AS DECIMAL(12,2))), 0)`))
    .limit(10);

  const topCustomers = await Promise.all(topCustomersRaw.map(async (c) => {
    const [customer] = await db.select({
      fullName: customers.fullName,
      customerCode: customers.customerCode
    }).from(customers).where(eq(customers.id, c.customerId));
    
    return {
      name: customer?.fullName || 'Unknown',
      code: customer?.customerCode || '',
      revenue: parseFloat(c.totalRevenue),
      packages: c.packageCount
    };
  }));

  return {
    dateRange: { start: startDate, end: endDate },
    periodLabel,
    financialStats: {
      totalRevenue: parseFloat(revenueResult?.total || '0'),
      totalPayments: parseFloat(revenueResult?.total || '0'),
      newCustomers: customersResult?.count || 0,
      packagesProcessed: packagesResult?.count || 0
    },
    dailyRevenue: [],
    topCustomers,
    packagesByStatus: packagesByStatus.map(s => ({ status: s.status, count: Number(s.count) })),
    generatedAt: new Date()
  };
}

export async function generateDateFilteredDashboardPDF(data: DateFilteredDashboardData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `Wazn Express - Dashboard Report (${data.periodLabel})`,
          Author: 'Wazn Express System',
          Subject: 'Dashboard Report',
          CreationDate: new Date()
        }
      });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.rect(0, 0, 595, 100).fill('#1a365d');
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff')
         .text('WAZN EXPRESS', 40, 25);
      doc.fontSize(14).font('Helvetica').fillColor('#a0aec0')
         .text('Dashboard Report', 40, 50);
      
      // Period badge
      doc.roundedRect(40, 68, 200, 24, 4).fill('#3182ce');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
         .text(data.periodLabel, 50, 74);
      
      doc.fontSize(9).fillColor('#a0aec0')
         .text(`Generated: ${data.generatedAt.toLocaleString()}`, 400, 78, { align: 'right' });

      let y = 120;

      // Summary Cards
      const cardWidth = 120;
      const cardGap = 12;
      
      drawSummaryCard(doc, 40, y, cardWidth, 'Total Revenue', `$${data.financialStats.totalRevenue.toFixed(0)}`, '#38a169');
      drawSummaryCard(doc, 40 + cardWidth + cardGap, y, cardWidth, 'Packages', String(data.financialStats.packagesProcessed), '#3182ce');
      drawSummaryCard(doc, 40 + (cardWidth + cardGap) * 2, y, cardWidth, 'New Customers', String(data.financialStats.newCustomers), '#805ad5');
      drawSummaryCard(doc, 40 + (cardWidth + cardGap) * 3, y, cardWidth, 'Payments', `$${data.financialStats.totalPayments.toFixed(0)}`, '#dd6b20');

      y += 90;

      // Package Status Breakdown
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
         .text('Package Status Distribution', 40, y);
      y += 20;

      doc.rect(40, y, 515, 22).fill('#edf2f7');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('Status', 45, y + 6);
      doc.text('Count', 250, y + 6);
      doc.text('Percentage', 400, y + 6);
      y += 22;

      const totalPkgs = data.packagesByStatus.reduce((sum, s) => sum + s.count, 0);
      doc.font('Helvetica').fontSize(9);
      
      for (const stat of data.packagesByStatus) {
        const percentage = totalPkgs > 0 ? ((stat.count / totalPkgs) * 100).toFixed(1) : '0';
        const rowColor = data.packagesByStatus.indexOf(stat) % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(40, y, 515, 20).fill(rowColor);
        
        doc.fillColor(getStatusColor(stat.status)).text(formatStatus(stat.status), 45, y + 6);
        doc.fillColor('#2d3748').text(String(stat.count), 250, y + 6);
        doc.text(`${percentage}%`, 400, y + 6);
        y += 20;
      }

      y += 30;

      // Top Customers
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
         .text('Top Customers by Revenue', 40, y);
      y += 20;

      doc.rect(40, y, 515, 22).fill('#edf2f7');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('#', 45, y + 6);
      doc.text('Customer', 70, y + 6);
      doc.text('Code', 230, y + 6);
      doc.text('Packages', 330, y + 6);
      doc.text('Revenue', 430, y + 6);
      y += 22;

      doc.font('Helvetica').fontSize(9);
      data.topCustomers.forEach((customer, index) => {
        const rowColor = index % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(40, y, 515, 20).fill(rowColor);
        
        doc.fillColor('#2d3748');
        doc.text(String(index + 1), 45, y + 6);
        doc.text(customer.name.substring(0, 25), 70, y + 6);
        doc.text(customer.code, 230, y + 6);
        doc.text(String(customer.packages), 330, y + 6);
        doc.fillColor('#38a169').text(`$${customer.revenue.toFixed(2)}`, 430, y + 6);
        y += 20;
      });

      // Footer — iterate the actual buffered range (start may be non-zero)
      const range = doc.bufferedPageRange();
      const pageCount = range.start + range.count;
      for (let i = range.start; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#a0aec0')
           .text(
             `Page ${i + 1} of ${pageCount} | Wazn Express Dashboard Report | ${data.periodLabel}`,
             40, 780, { align: 'center', width: 515 }
           );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ============ HELPER FUNCTIONS ============

function drawSummaryCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, value: string, color: string) {
  doc.roundedRect(x, y, width, 65, 6).fillColor('#ffffff').fill();
  doc.roundedRect(x, y, width, 65, 6).strokeColor('#e2e8f0').stroke();
  
  // Color accent bar
  doc.rect(x, y, 4, 65).fill(color);
  
  doc.fontSize(9).font('Helvetica').fillColor('#718096')
     .text(label, x + 12, y + 12, { width: width - 20 });
  
  doc.fontSize(18).font('Helvetica-Bold').fillColor(color)
     .text(value, x + 12, y + 32, { width: width - 20 });
}

function formatStatus(status: string): string {
  return status.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'registered': '#3182ce',
    'in_transit': '#dd6b20',
    'arrived': '#805ad5',
    'customs': '#d69e2e',
    'ready_for_delivery': '#38a169',
    'delivered': '#38a169',
    'returned': '#e53e3e'
  };
  return colors[status] || '#4a5568';
}

function formatPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    'cash': 'Cash',
    'bank_transfer': 'Bank Transfer',
    'mobile_payment': 'Mobile Payment',
    'card': 'Card',
    'fastpay': 'FastPay',
    'other': 'Other'
  };
  return methods[method] || method;
}