import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { getDb, getAccountStatementForCustomer } from '../db';
import { packages, users, customers, ledgerTransactions, customerAccounts, paymentRecords, batches, fullPackageOrders } from '../../drizzle/schema';
import { sql, count, eq, desc, asc, gte, lte, and, sum, inArray } from 'drizzle-orm';
import { concealsSizeAndCarriage } from '@shared/fullPackagePrivacy';
import { drawBrandLogo, brandLogoWidth } from '../lib/brandLogo';
import { getBatchFinancialSummary } from '../db/batches.db';
import { getBatchReportDetail } from '../db/batchReport.db';
import { customerCodeOnly } from '@shared/customerCode';

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
    totalDiscounts: number;
    otherAdjustments: number;
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
    /** Full-package parcels print a dash instead of size and carriage. */
    sizeConcealed?: boolean;
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

  // The summary strip reads the same statement as the office's profile and the
  // portal (shared/accountStatement.ts): charges net of their corrections,
  // money received net of reversals, and discounts and hand adjustments on
  // their own lines — so the strip adds up to the balance printed beside it.
  const { statement } = await getAccountStatementForCustomer(customerId);

  // Get packages with optional date filter
  let packagesQuery = db.select({
    trackingNumber: packages.trackingNumber,
    status: packages.status,
    weightKg: packages.weightKg,
    costUsd: packages.calculatedCostUsd,
    createdAt: packages.createdAt,
    batchId: packages.batchId,
    fullPackageOrderId: packages.fullPackageOrderId
  }).from(packages).where(eq(packages.customerId, customerId));

  if (startDate && endDate) {
    packagesQuery = db.select({
      trackingNumber: packages.trackingNumber,
      status: packages.status,
      weightKg: packages.weightKg,
      costUsd: packages.calculatedCostUsd,
      createdAt: packages.createdAt,
      batchId: packages.batchId,
      fullPackageOrderId: packages.fullPackageOrderId
    }).from(packages).where(and(
      eq(packages.customerId, customerId),
      gte(packages.createdAt, startDate),
      lte(packages.createdAt, endDate)
    ));
  }

  // High cap only as a runaway guard — the statement must be COMPLETE, the
  // old limit(50) silently dropped packages and customers noticed.
  const customerPackages = await packagesQuery.orderBy(desc(packages.createdAt)).limit(1000);

  // Full-package parcels print no size and no carriage on a customer
  // document — the agreed price is their whole story. One batched lookup.
  // See shared/fullPackagePrivacy.ts.
  const fpOrderIds = Array.from(new Set(customerPackages.map(p => p.fullPackageOrderId).filter((id): id is number => id != null)));
  const concealedOrderIds = new Set<number>();
  if (fpOrderIds.length > 0) {
    const fpOrders = await db.select({ id: fullPackageOrders.id, orderType: fullPackageOrders.orderType })
      .from(fullPackageOrders)
      .where(inArray(fullPackageOrders.id, fpOrderIds));
    for (const o of fpOrders) {
      if (concealsSizeAndCarriage(o.orderType)) concealedOrderIds.add(o.id);
    }
  }

  // Get batch codes for packages
  const packagesWithBatch = await Promise.all(customerPackages.map(async (pkg) => {
    let batchCode = null;
    if (pkg.batchId) {
      const [batch] = await db.select({ batchCode: batches.batchCode }).from(batches).where(eq(batches.id, pkg.batchId));
      batchCode = batch?.batchCode || null;
    }
    const sizeConcealed = pkg.fullPackageOrderId != null && concealedOrderIds.has(pkg.fullPackageOrderId);
    return {
      trackingNumber: pkg.trackingNumber || '',
      status: pkg.status,
      weightKg: sizeConcealed ? 0 : Number(pkg.weightKg) || 0,
      costUsd: sizeConcealed ? 0 : Number(pkg.costUsd) || 0,
      createdAt: pkg.createdAt,
      batchCode,
      sizeConcealed
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
      totalCharges: statement.charges.total,
      totalPayments: statement.paymentsUsd,
      totalDiscounts: statement.discountsUsd,
      otherAdjustments: statement.otherAdjustmentsUsd,
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
  discounts: { en: 'Discounts', ku: 'داشکاندن', ar: 'الخصومات' },
  adjustments: { en: 'Adjustments', ku: 'ڕێکخستن', ar: 'تسويات' },
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

      // pdfkit sets words left to right. A Kurdish or Arabic phrase came out
      // with its words in reverse - «کۆی قەرزەکان» printed as «قەرزەکانکۆی» -
      // and lost the space before its last word; a customer's name reversed
      // with it. Right-to-left text is set here word by word instead: right to
      // left, the gaps measured, wrapped by hand - in every statement, English
      // ones too, where a Kurdish description used to print as mojibake in a
      // font without the letters. Latin text goes through pdfkit as before.
      const ARABIC_SCRIPT = /[\u0600-\u06FF]/;
      const rtlLines = (text: string, width: number): string[][] => {
        const space = doc.widthOfString(' ');
        const lines: string[][] = [];
        let line: string[] = [];
        let lineW = 0;
        for (const word of text.replace(/\s+/g, ' ').trim().split(' ')) {
          const w = doc.widthOfString(word);
          if (line.length && lineW + space + w > width) {
            lines.push(line);
            line = [];
            lineW = 0;
          }
          lineW += (line.length ? space : 0) + w;
          line.push(word);
        }
        if (line.length) lines.push(line);
        return lines;
      };
      const rtlWidth = (words: string[]) =>
        words.reduce((sum, w) => sum + doc.widthOfString(w), 0) + doc.widthOfString(' ') * Math.max(0, words.length - 1);
      type TextOpts = PDFKit.Mixins.TextOptions & { maxLines?: number };
      const T = (text: string, x: number, yy: number, opts: TextOpts = {}) => {
        const { maxLines = 1, ...pdfOpts } = opts;
        if (!hasVazir || !ARABIC_SCRIPT.test(text)) {
          doc.text(text, x, yy, pdfOpts);
          return;
        }
        const width = opts.width ?? 515;
        const lines = rtlLines(text, width);
        const shown = lines.slice(0, maxLines);
        if (lines.length > maxLines) shown[shown.length - 1] = [...shown[shown.length - 1], '…'];
        const space = doc.widthOfString(' ');
        const lineH = doc.currentLineHeight(true);
        shown.forEach((words, li) => {
          const total = rtlWidth(words);
          let right = opts.align === 'left' ? x + total : opts.align === 'center' ? x + (width + total) / 2 : x + width;
          for (const word of words) {
            right -= doc.widthOfString(word);
            doc.text(word, right, yy + li * lineH, { lineBreak: false });
            right -= space;
          }
        });
      };
      const textHeight = (text: string, width: number, maxLines: number) =>
        hasVazir && ARABIC_SCRIPT.test(text)
          ? Math.min(rtlLines(text, width).length, maxLines) * doc.currentLineHeight(true)
          : doc.heightOfString(text, { width });
      /** "label: value" in reading order, flush to one edge of a box. */
      const pair = (label: string, value: string, boxX: number, yy: number, width: number, edge: 'start' | 'end') => {
        const gap = 4;
        const labelText = `${label}:`;
        doc.font(FR);
        const lw = rtl && ARABIC_SCRIPT.test(labelText) ? rtlWidth(labelText.split(' ')) : doc.widthOfString(labelText);
        // The label's own font in RTL: Vazirmatn sits lower than Helvetica,
        // and a date beside a Kurdish label floated half a line above it.
        doc.font(rtl ? FR : 'Helvetica');
        const vw = doc.widthOfString(value);
        const flushRight = rtl ? edge === 'start' : edge === 'end';
        let cx = flushRight ? boxX + width - (lw + gap + vw) : boxX;
        const drawLabel = () => {
          doc.font(FR);
          T(labelText, cx, yy, { width: lw + 1, align: 'left', lineBreak: false });
          cx += lw + gap;
        };
        const drawValue = () => {
          doc.font(rtl ? FR : 'Helvetica').text(value, cx, yy, { lineBreak: false });
          cx += vw + gap;
        };
        if (rtl) { drawValue(); drawLabel(); } else { drawLabel(); drawValue(); }
      };

      let y = 120;
      const ensure = (needed: number, redraw?: () => void) => {
        if (y + needed > 760) {
          doc.addPage();
          y = 50;
          redraw?.();
        }
      };

      // ---- Header ----------------------------------------------------------
      // One slim band on white: the mark, the title and the dates on one side,
      // whose statement it is on the other, then a single summary strip. It
      // was a navy block, a customer card and three cards that said payments
      // and the balance a second time - a third of the first sheet before the
      // first row, and a sheet of ink. The owner: save the paper, keep it neat.
      const top = 30;
      const markW = drawBrandLogo(doc, mx(40, brandLogoWidth(30)), top, { height: 30 });
      const titleX = markW ? 40 + markW + 12 : 40;
      doc.fontSize(15).font(FB).fillColor('#1a365d');
      T(L('title'), mx(titleX, 200), top - 1, { width: 200, align: alignStart, lineBreak: false });
      doc.fontSize(8).fillColor('#718096');
      pair(L('generated'), fmtDate(data.generatedAt), mx(titleX, 200), top + 20, 200, 'start');
      if (data.dateRange) {
        pair(L('period'), `${fmtDate(data.dateRange.start)} - ${fmtDate(data.dateRange.end)}`, mx(titleX, 200), top + 31, 200, 'start');
      }

      const whoX = mx(325, 230);
      const endAlign = rtl ? 'left' : 'right';
      doc.fontSize(12).font(hasVazir && ARABIC_SCRIPT.test(data.customer.fullName) ? 'Vazir-Bold' : 'Helvetica-Bold').fillColor('#1a365d');
      T(data.customer.fullName, whoX, top - 1, { width: 230, align: endAlign, lineBreak: false });
      doc.fontSize(8.5).fillColor('#4a5568');
      pair(L('customerCode'), data.customer.customerCode, whoX, top + 17, 230, 'end');
      pair(L('mobile'), data.customer.mobileNumber, whoX, top + 29, 230, 'end');

      doc.moveTo(40, top + 44).lineTo(555, top + 44).lineWidth(1).strokeColor('#1a365d').stroke();

      // ---- Summary strip: each figure once --------------------------------
      const stripY = top + 52;
      const stripH = 34;
      doc.roundedRect(40, stripY, 515, stripH, 6).fillColor('#f7fafc').fill();
      doc.roundedRect(40, stripY, 515, stripH, 6).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      const balance = data.accountSummary.currentBalance;
      const discounts = Number(data.accountSummary.totalDiscounts ?? 0);
      const adjustments = Number(data.accountSummary.otherAdjustments ?? 0);
      const cells: Array<[string, string, string]> = [
        [L('totalPackages'), String(data.packages.length), '#2d3748'],
        [L('totalCharges'), `$${data.accountSummary.totalCharges.toFixed(2)}`, '#2d3748'],
        [L('totalPayments'), `$${data.accountSummary.totalPayments.toFixed(2)}`, '#2f855a'],
        // Only when there are any — then the strip still adds up to the balance.
        ...(discounts !== 0
          ? [[L('discounts'), `$${discounts.toFixed(2)}`, '#2f855a'] as [string, string, string]]
          : []),
        ...(adjustments !== 0
          ? [[L('adjustments'), `${adjustments < 0 ? '-' : '+'}$${Math.abs(adjustments).toFixed(2)}`, '#2d3748'] as [string, string, string]]
          : []),
        [L('currentBalance'), `$${balance.toFixed(2)}`, balance > 0 ? '#c53030' : '#2f855a'],
      ];
      const cellW = 515 / cells.length;
      cells.forEach(([label, value, color], i) => {
        const cx = mx(40 + i * cellW, cellW);
        if (i > 0) {
          doc.moveTo(40 + i * cellW, stripY + 7).lineTo(40 + i * cellW, stripY + stripH - 7)
             .lineWidth(0.5).strokeColor('#e2e8f0').stroke();
        }
        doc.fontSize(7.5).font(FR).fillColor('#718096');
        T(label, cx, stripY + 5, { width: cellW, align: 'center', lineBreak: false });
        doc.fontSize(12).font('Helvetica-Bold').fillColor(color)
           .text(value, cx, stripY + 16, { width: cellW, align: 'center', lineBreak: false });
      });
      doc.lineWidth(1);

      y = stripY + stripH + 16;

      const sectionTitle = (label: string) => {
        ensure(34);
        doc.fontSize(12).font(FB).fillColor('#1a365d');
        T(label, 40, y, { width: 515, align: alignStart });
        y += 20;
      };

      const emptyNote = () => {
        doc.fontSize(9).font(FR).fillColor('#718096');
        T(L('noRecords'), 40, y + 4, { width: 515, align: alignStart });
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
        T(L('colDate'), mx(led.date.x, led.date.w), y + 6, { width: led.date.w, align: alignStart });
        T(L('colDescription'), mx(led.desc.x, led.desc.w), y + 6, { width: led.desc.w, align: alignStart });
        T(L('colDebit'), mx(led.debit.x, led.debit.w), y + 6, { width: led.debit.w, align: 'center' });
        T(L('colCredit'), mx(led.credit.x, led.credit.w), y + 6, { width: led.credit.w, align: 'center' });
        T(L('colBalance'), mx(led.balance.x, led.balance.w), y + 6, { width: led.balance.w, align: 'center' });
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
          doc.font(hasVazir && ARABIC_SCRIPT.test(desc) ? 'Vazir' : 'Helvetica').fontSize(7.5);
          const descH = Math.min(textHeight(desc, led.desc.w, 2), 28);
          const rowH = Math.max(16, descH + 6);
          ensure(rowH + 2, ledgerHeader);

          if (rowIndex % 2 === 1) doc.rect(40, y, 515, rowH).fill('#f7fafc');
          doc.fontSize(7.5).font('Helvetica').fillColor('#2d3748')
             .text(fmtDate(tx.createdAt), mx(led.date.x, led.date.w), y + 4, { width: led.date.w, align: alignStart });
          doc.font(hasVazir && ARABIC_SCRIPT.test(desc) ? 'Vazir' : 'Helvetica');
          T(desc, mx(led.desc.x, led.desc.w), y + 4, { width: led.desc.w, height: 28, ellipsis: true, align: alignStart, maxLines: 2 });
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
        doc.fontSize(8).font(FB).fillColor('#2d3748');
        T(L('periodTotals'), mx(led.date.x, led.date.w + led.desc.w), y + 6, { width: led.date.w + led.desc.w, align: alignStart });
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
        T(L('colTracking'), mx(pk.tracking.x, pk.tracking.w), y + 6, { width: pk.tracking.w, align: alignStart });
        T(L('colStatus'), mx(pk.status.x, pk.status.w), y + 6, { width: pk.status.w, align: alignStart });
        T(L('colWeight'), mx(pk.weight.x, pk.weight.w), y + 6, { width: pk.weight.w, align: 'center' });
        T(L('colCost'), mx(pk.cost.x, pk.cost.w), y + 6, { width: pk.cost.w, align: 'center' });
        T(L('colBatch'), mx(pk.batch.x, pk.batch.w), y + 6, { width: pk.batch.w, align: alignStart });
        T(L('colDate'), mx(pk.date.x, pk.date.w), y + 6, { width: pk.date.w, align: alignStart });
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
          doc.font(rtl ? FR : 'Helvetica').fillColor(getStatusColor(pkg.status));
          T(statusText(pkg.status), mx(pk.status.x, pk.status.w), y + 4, { width: pk.status.w, align: alignStart });
          doc.font('Helvetica').fillColor('#2d3748');
          doc.text(pkg.sizeConcealed ? '—' : `${pkg.weightKg.toFixed(1)} kg`, mx(pk.weight.x, pk.weight.w), y + 4, { width: pk.weight.w, align: 'center' });
          doc.text(pkg.sizeConcealed ? '—' : `$${pkg.costUsd.toFixed(2)}`, mx(pk.cost.x, pk.cost.w), y + 4, { width: pk.cost.w, align: 'center' });
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
        T(L('colDate'), mx(pay.date.x, pay.date.w), y + 6, { width: pay.date.w, align: alignStart });
        T(L('colAmount'), mx(pay.amount.x, pay.amount.w), y + 6, { width: pay.amount.w, align: 'center' });
        T(L('colMethod'), mx(pay.method.x, pay.method.w), y + 6, { width: pay.method.w, align: alignStart });
        T(L('colReference'), mx(pay.reference.x, pay.reference.w), y + 6, { width: pay.reference.w, align: alignStart });
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
          const ref = payment.reference || '-';
          doc.font(hasVazir && ARABIC_SCRIPT.test(ref) ? 'Vazir' : 'Helvetica');
          T(ref, mx(pay.reference.x, pay.reference.w), y + 4, { width: pay.reference.w, align: alignStart });
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

/**
 * The printed batch report (owner, 2026-11-09: «کۆنەکە زۆر ناتەواوە»).
 *
 * The old paper printed «Total Weight: 0.0 kg» beside a 32.5 kg card, called
 * the revenue «Total Cost», ran the customer's name into the code column, cut
 * the customers at twelve and the parcels at twenty, and printed the plane emoji
 * as «þ». It now prints the batch report's own figures - the same ones as the
 * screen (getBatchFinancialSummary + getBatchReportDetail, which add up) -
 * with every customer, in plain Latin text the built-in font can draw.
 */
interface BatchReportData {
  batch: {
    id: number;
    batchCode: string;
    shippingType: string;
    status: string;
    departureDate: Date | null;
    arrivalDate: Date | null;
    carrierInfo: string | null;
  };
  money: { revenue: number; cost: number; profit: number | null; margin: number | null; waitingFor: string | null };
  detail: NonNullable<Awaited<ReturnType<typeof getBatchReportDetail>>>;
  generatedAt: Date;
}

export async function getBatchReportData(batchId: number): Promise<BatchReportData | null> {
  const db = await getDb();
  if (!db) return null;
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId));
  if (!batch) return null;
  const summary = await getBatchFinancialSummary(batchId);
  const detail = await getBatchReportDetail(batchId);
  if (!summary || !detail) return null;
  const waitingFor = (summary.waitingFor as string | null) ?? null;
  return {
    batch: {
      id: batch.id,
      batchCode: batch.batchCode,
      shippingType: batch.shippingType,
      status: batch.status,
      departureDate: batch.departureDate,
      arrivalDate: batch.actualArrival,
      carrierInfo: batch.carrierInfo,
    },
    money: {
      revenue: Number(summary.totalRevenue) || 0,
      cost: Number(summary.totalCost) || 0,
      profit: waitingFor ? null : Number(summary.profit) || 0,
      margin: waitingFor ? null : Number(summary.profitMargin) || 0,
      waitingFor,
    },
    detail,
    generatedAt: new Date(),
  };
}

const KIND_LABEL: Record<string, string> = {
  self: 'Self order', commission: 'Commission', full_package: 'Full package', purchase_request: 'Purchase request',
};
/** Latin only: the built-in font cannot draw Arabic script, so such a name is left to its code. */
const latin = (v: string | null | undefined) => (v && !/[؀-ۿ]/.test(v) ? v : '');
const usdText = (n: number) => `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signedUsd = (n: number) => `${n >= 0 ? '+' : '-'}${usdText(Math.abs(n))}`;

export async function generateBatchPDF(data: BatchReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: { Title: `Wazn Express - Batch Report: ${data.batch.batchCode}`, Author: 'Wazn Express System', Subject: 'Batch Report', CreationDate: new Date() },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const d = data.detail;
      const sea = d.unit === 'cbm';
      const qty = (n: number) => (sea ? `${n.toFixed(3)} m3` : `${n.toFixed(2)} kg`);
      const GOOD = '#059669', BAD = '#e11d48', INK = '#1e293b', MUTED = '#64748b';
      const headerColor = sea ? '#0d9488' : '#2563eb';
      let y = 0;
      const need = (h: number) => { if (y + h > 770) { doc.addPage(); y = 40; } };
      const section = (title: string) => {
        need(40);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text(title, 40, y);
        y += 18;
      };
      /** A table: columns as [title, x, width, align]; rows of cell texts and optional colours. */
      const table = (cols: Array<[string, number, number, 'left' | 'right']>, rows: Array<Array<{ t: string; c?: string; b?: boolean }>>) => {
        const head = () => {
          doc.rect(40, y, 515, 18).fill('#e2e8f0');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155');
          for (const [t, x, w, al] of cols) doc.text(t, x, y + 5, { width: w, align: al, lineBreak: false });
          y += 18;
        };
        head();
        rows.forEach((r, i) => {
          if (y + 16 > 770) { doc.addPage(); y = 40; head(); }
          doc.rect(40, y, 515, 16).fill(i % 2 === 0 ? '#ffffff' : '#f8fafc');
          r.forEach((cell, j) => {
            const [, x, w, al] = cols[j];
            doc.fontSize(8).font(cell.b ? 'Helvetica-Bold' : 'Helvetica').fillColor(cell.c ?? INK)
              .text(cell.t, x, y + 4, { width: w, align: al, lineBreak: false, ellipsis: true });
          });
          y += 16;
        });
        y += 10;
      };

      // Header
      doc.rect(0, 0, 595, 100).fill(headerColor);
      if (!drawBrandLogo(doc, 40, 14, { height: 26, tile: true })) {
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#ffffff').text('WAZN EXPRESS', 40, 20);
      }
      doc.fontSize(13).font('Helvetica').fillColor('#e0e7ff').text('Batch Report', 40, 48);
      doc.roundedRect(40, 66, 200, 24, 4).fill('#ffffff');
      doc.fontSize(12).font('Helvetica-Bold').fillColor(headerColor).text(data.batch.batchCode, 48, 72, { width: 186, lineBreak: false, ellipsis: true });
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff').text(sea ? 'Sea freight' : 'Air freight', 360, 66, { width: 195, align: 'right' });
      doc.fontSize(8).font('Helvetica').fillColor('#e0e7ff').text(`Generated: ${data.generatedAt.toLocaleString('en-GB')}`, 360, 82, { width: 195, align: 'right' });
      y = 114;

      // Batch facts
      doc.fontSize(9).font('Helvetica').fillColor(MUTED);
      const facts = [
        `Status: ${formatStatus(data.batch.status)}`,
        data.batch.departureDate ? `Departure: ${data.batch.departureDate.toLocaleDateString('en-GB')}` : null,
        data.batch.arrivalDate ? `Arrival: ${data.batch.arrivalDate.toLocaleDateString('en-GB')}` : null,
        data.batch.carrierInfo ? `Carrier: ${latin(data.batch.carrierInfo) || '-'}` : null,
      ].filter(Boolean).join('   |   ');
      doc.text(facts, 40, y, { width: 515 });
      y += 20;

      // Money cards
      const cw = 122, gap = 9;
      const profitColor = data.money.profit === null ? MUTED : data.money.profit >= 0 ? GOOD : BAD;
      drawSummaryCard(doc, 40, y, cw, 'Revenue', usdText(data.money.revenue), '#2563eb');
      drawSummaryCard(doc, 40 + (cw + gap), y, cw, 'Cost', data.money.waitingFor === 'cost' ? 'not set' : usdText(data.money.cost), '#d97706');
      drawSummaryCard(doc, 40 + (cw + gap) * 2, y, cw, 'Profit', data.money.profit === null ? 'waiting' : signedUsd(data.money.profit), profitColor);
      drawSummaryCard(doc, 40 + (cw + gap) * 3, y, cw, 'Margin', data.money.margin === null ? '-' : `${data.money.margin.toFixed(1)}%`, profitColor);
      y += 75;
      drawSummaryCard(doc, 40, y, cw, 'Parcels', String(d.perCustomer.reduce((t, c) => t + c.parcels, 0)), '#475569');
      drawSummaryCard(doc, 40 + (cw + gap), y, cw, 'Customers', `${d.customers.total}`, '#7c3aed');
      drawSummaryCard(doc, 40 + (cw + gap) * 2, y, cw, sea ? 'CBM' : 'Chargeable', sea ? d.weights.cbm.toFixed(3) : `${d.weights.chargeableKg.toFixed(1)} kg`, '#0891b2');
      drawSummaryCard(doc, 40 + (cw + gap) * 3, y, cw, sea ? 'Profit per m3' : 'Profit per kg', d.averages.profitPerUnit === null ? '-' : signedUsd(d.averages.profitPerUnit), d.averages.profitPerUnit !== null && d.averages.profitPerUnit < 0 ? BAD : GOOD);
      y += 78;

      // A loss is said in red.
      if (data.money.profit !== null && (data.money.profit < 0 || d.lossCustomers > 0)) {
        doc.roundedRect(40, y, 515, 22, 4).fill('#ffe4e6');
        doc.fontSize(9).font('Helvetica-Bold').fillColor(BAD).text(
          [data.money.profit < 0 ? `This batch ran at a loss: ${signedUsd(data.money.profit)}.` : '', d.lossCustomers > 0 ? `${d.lossCustomers} customer(s) at a loss - in red below.` : ''].filter(Boolean).join('  '),
          48, y + 7, { width: 500 });
        y += 32;
      }

      // Weights and averages
      section('Weights and averages');
      doc.fontSize(9).font('Helvetica').fillColor(INK);
      const lines = sea
        ? [`Volume: ${d.weights.cbm.toFixed(3)} m3`, `Actual weight: ${d.weights.actualKg.toFixed(1)} kg`]
        : [`Actual: ${d.weights.actualKg.toFixed(1)} kg`, `Volumetric: ${d.weights.volumetricKg.toFixed(1)} kg`, `Chargeable: ${d.weights.chargeableKg.toFixed(1)} kg`, `Volumetric discount: ${d.weights.volumetricDiscountKg.toFixed(1)} kg`];
      lines.push(`Per parcel: ${qty(d.averages.perParcelQty)}`, `Sell per ${sea ? 'm3' : 'kg'}: ${usdText(d.averages.sellPerUnit)}`);
      if (d.averages.costPerUnit !== null) lines.push(`Cost per ${sea ? 'm3' : 'kg'}: ${usdText(d.averages.costPerUnit)}`);
      lines.push(`Revenue per customer: ${usdText(d.averages.revenuePerCustomer)}`, `Customers: ${d.customers.newcomers} new, ${d.customers.returning} returning`);
      lines.forEach((t, i) => doc.text(t, 40 + (i % 3) * 172, y + Math.floor(i / 3) * 14, { width: 168 }));
      y += Math.ceil(lines.length / 3) * 14 + 10;

      // By kind
      section('By kind of goods');
      table(
        [['Kind', 45, 150, 'left'], ['Parcels', 200, 60, 'right'], [sea ? 'm3' : 'kg', 270, 80, 'right'], ['Revenue', 360, 90, 'right'], ['Profit', 455, 95, 'right']],
        d.byKind.map((k) => [
          { t: KIND_LABEL[k.kind] ?? k.kind },
          { t: String(k.parcels) },
          { t: sea ? k.qty.toFixed(3) : k.qty.toFixed(2) },
          { t: usdText(k.revenue) },
          { t: k.profit === null ? '-' : signedUsd(k.profit), c: k.profit !== null && k.profit < 0 ? BAD : GOOD, b: true },
        ]),
      );

      // Categories
      if (d.byCategory.length > 0) {
        section('What the goods were');
        table(
          [['Category', 45, 220, 'left'], ['Parcels', 270, 80, 'right'], [sea ? 'm3' : 'kg', 360, 90, 'right'], ['Share', 455, 95, 'right']],
          d.byCategory.map((c) => [
            { t: c.categoryId ? (latin(c.nameEn) || latin(c.nameKu) || `#${c.categoryId}`) : 'No category' },
            { t: String(c.parcels) },
            { t: sea ? c.qty.toFixed(3) : c.qty.toFixed(2) },
            { t: `${c.sharePercent}%` },
          ]),
        );
      }

      // Every customer
      section('Customers');
      table(
        sea
          ? [['Code', 45, 60, 'left'], ['Name', 108, 130, 'left'], ['Parcels', 240, 40, 'right'], ['m3', 284, 55, 'right'], ['Share', 342, 40, 'right'], ['Revenue', 385, 55, 'right'], ['Cost', 443, 52, 'right'], ['Profit', 498, 55, 'right']]
          : [['Code', 45, 52, 'left'], ['Name', 99, 105, 'left'], ['Pcs', 206, 26, 'right'], ['Actual', 234, 46, 'right'], ['Charged', 282, 48, 'right'], ['Share', 332, 36, 'right'], ['Revenue', 370, 58, 'right'], ['Cost', 430, 58, 'right'], ['Profit', 490, 63, 'right']],
        d.perCustomer.map((c) => {
          const code = customerCodeOnly(c.code) || `#${c.customerId}`;
          const profitCell = { t: c.profit === null ? '-' : signedUsd(c.profit), c: c.profit !== null && c.profit < 0 ? BAD : GOOD, b: true };
          return sea
            ? [{ t: code, b: true }, { t: latin(c.name) }, { t: String(c.parcels) }, { t: c.cbm.toFixed(3) }, { t: `${c.sharePercent}%` }, { t: usdText(c.revenue) }, { t: usdText(c.cost) }, profitCell]
            : [{ t: code, b: true }, { t: latin(c.name) }, { t: String(c.parcels) }, { t: c.actualKg.toFixed(1) }, { t: c.chargeableKg.toFixed(1) }, { t: `${c.sharePercent}%` }, { t: usdText(c.revenue) }, { t: usdText(c.cost) }, profitCell];
        }),
      );

      // Heaviest parcels
      if (d.heaviest.length > 0) {
        section('Heaviest parcels');
        table(
          [['Tracking', 45, 200, 'left'], ['Customer', 250, 100, 'left'], [sea ? 'm3' : 'kg', 355, 90, 'right'], ['Revenue', 450, 100, 'right']],
          d.heaviest.map((h) => [{ t: h.trackingNumber }, { t: customerCodeOnly(h.customerCode) || '-' }, { t: sea ? h.qty.toFixed(3) : h.qty.toFixed(2) }, { t: usdText(h.revenue) }]),
        );
      }

      // Speed, problems, sources, the last batch
      section('More');
      doc.fontSize(9).font('Helvetica').fillColor(INK);
      const more: string[] = [];
      if (d.speed) more.push(`Registration to arrival: ${d.speed.avgDays} days on average, slowest ${d.speed.maxDays}.`);
      more.push(`Unclaimed: ${d.problems.unclaimed}   Returned/cancelled: ${d.problems.returnedOrCancelled}   No price: ${d.problems.noPrice}   No weight/size: ${d.problems.noMeasure}`);
      if (d.receiptDiscountsUsd > 0) more.push(`Discounts on box receipts: ${usdText(d.receiptDiscountsUsd)}`);
      if (d.bySource.length > 0) more.push(`Bought on: ${d.bySource.map((s) => `${s.platform} ${s.parcels}`).join(', ')}`);
      if (d.previous) more.push(`Last batch ${d.previous.batchCode}: ${qty(d.previous.qty)}, revenue ${usdText(d.previous.revenue)}${d.previous.profit !== null ? `, profit ${signedUsd(d.previous.profit)}` : ''}`);
      for (const t of more) { need(16); doc.text(t, 40, y, { width: 515 }); y += 15; }

      // Footer
      const range = doc.bufferedPageRange();
      const pageCount = range.start + range.count;
      for (let i = range.start; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#94a3b8').text(`Page ${i + 1} of ${pageCount} | Wazn Express | ${data.batch.batchCode}`, 40, 790, { align: 'center', width: 515, lineBreak: false });
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
      periodLabel = `${startDate.toLocaleDateString("en-GB")} - ${endDate.toLocaleDateString("en-GB")}`;
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
      if (!drawBrandLogo(doc, 40, 16, { height: 26, tile: true })) {
        doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff')
           .text('WAZN EXPRESS', 40, 25);
      }
      doc.fontSize(14).font('Helvetica').fillColor('#a0aec0')
         .text('Dashboard Report', 40, 50);
      
      // Period badge
      doc.roundedRect(40, 68, 200, 24, 4).fill('#3182ce');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
         .text(data.periodLabel, 50, 74);
      
      doc.fontSize(9).fillColor('#a0aec0')
         .text(`Generated: ${data.generatedAt.toLocaleString("en-GB")}`, 400, 78, { align: 'right' });

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