import { useState, useMemo, Fragment } from "react";
import { BatchInvoiceView } from "@/components/BatchInvoiceView";
import { AccountRowList } from "@/components/AccountRowList";
import { BoxInvoiceView } from "@/components/BoxInvoiceView";
import { rowMeta } from "@shared/batchInvoice";
import { trpc } from "@/lib/trpc";
import { getCompanyInfoFromSettings } from "@/hooks/useCompanyInfo";
import DashboardLayout from "@/components/DashboardLayout";
import { CustomerPendingOrdersSection } from "@/components/customers/CustomerPendingOrdersSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Receipt,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Phone,
  Mail,
  User,
  Calendar,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  Eye,
  Package,
  ShoppingCart,
  Percent,
  X,
  ExternalLink,
  Wallet,
  Building2,
  Hash,
  CheckCircle,
  AlertCircle,
  Banknote,
  CircleDollarSign,
  Activity,
  BarChart3,
  PieChart,
  Sparkles,
  ChevronsUpDown,
  ChevronDown,
  Check,
  Landmark,
  Layers,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Ship,
  Plane,
  Boxes,
} from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { boxPaidState } from "@shared/boxSettlement";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function CustomerFinance() {
  const { t, language } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const customerId = parseInt(id || "0");
  
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentAmountIqd, setPaymentAmountIqd] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [paymentCashAccountId, setPaymentCashAccountId] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Which batch's invoice is open, and the two queries behind it. Nothing is
  // fetched until a batch is chosen.
  const [invoiceBatchId, setInvoiceBatchId] = useState<number | null>(null);
  const { data: customerBatchesRaw } = trpc.customerBatchInvoice.batchesForCustomer.useQuery({ customerId });
  const customerBatches = Array.isArray(customerBatchesRaw) ? customerBatchesRaw : [];
  const [invoiceBoxId, setInvoiceBoxId] = useState<number | null>(null);
  const { data: customerBoxesRaw } = trpc.customerBatchInvoice.boxesForCustomer.useQuery({ customerId });
  const customerBoxes = Array.isArray(customerBoxesRaw) ? customerBoxesRaw : [];
  const { data: officeBoxInvoice } = trpc.customerBatchInvoice.boxForCustomer.useQuery(
    { boxId: invoiceBoxId ?? 0, customerId },
    { enabled: invoiceBoxId != null },
  );
  const { data: officeInvoice } = trpc.customerBatchInvoice.forCustomer.useQuery(
    { batchId: invoiceBatchId ?? 0, customerId },
    { enabled: invoiceBatchId != null },
  );
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  // Tracks which invoice groups are currently expanded in the ledger table.
  // Keyed by invoiceId; absent = collapsed (default). Standalone rows
  // (invoiceId == null) are never grouped, so they ignore this set.
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());

  // Reverse / Refund modal state — opened from a row's action button on the
  // payments tab. `mode` decides which tRPC endpoint runs; `mistake` only
  // touches the customer ledger, `refund` also deducts a chosen cashbox.
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const [reverseTargetPayment, setReverseTargetPayment] = useState<any>(null);
  const [reverseMode, setReverseMode] = useState<'mistake' | 'refund'>('mistake');
  const [reverseAmount, setReverseAmount] = useState<string>("");
  const [reverseReason, setReverseReason] = useState<string>("");
  const [reverseCashAccountId, setReverseCashAccountId] = useState<string>("");

  // Manual balance adjustment — for orphaned balances where the payment
  // record no longer exists (so reverse/refund can't be used). Adjustment
  // posts an ADJUSTMENT_DEBIT or ADJUSTMENT_CREDIT directly to the ledger
  // with a mandatory reason.
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustDirection, setAdjustDirection] = useState<'debit' | 'credit'>('debit');
  const [adjustAmount, setAdjustAmount] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("");
  
  const utils = trpc.useUtils();
  
  const { data: customer, isLoading: customerLoading } = trpc.customers.getById.useQuery({ id: customerId });
  const { data: activeCashAccounts } = trpc.cashAccounts.listActive.useQuery();
  const { data: account, isLoading: accountLoading } = trpc.ledger.getAccountByCustomer.useQuery({ customerId });
  const { data: transactionsResponse, isLoading: transactionsLoading } = trpc.ledger.getTransactions.useQuery(
    { accountId: account?.id || 0, limit: 100 },
    { enabled: !!account?.id }
  );
  const transactions = transactionsResponse?.data ?? [];
  const { data: payments } = trpc.ledger.getPayments.useQuery(
    { accountId: account?.id || 0, limit: 50 },
    { enabled: !!account?.id }
  );
  const { data: breakdown } = trpc.ledger.getAccountBreakdown.useQuery(
    { accountId: account?.id || 0 },
    { enabled: !!account?.id }
  );
  const { data: settings } = trpc.settings.list.useQuery();
  // Used only to resolve invoiceId → invoiceNumber for grouped row headers.
  // Same page size as transactions so a 1:1 lookup map is realistic for the
  // visible window. Read-only — never written back.
  const { data: customerInvoicesResponse } = trpc.invoices.getByCustomer.useQuery(
    { customerId, limit: 100 },
    { enabled: !!customer }
  );
  
  const getOrCreateAccount = trpc.ledger.getOrCreateAccount.useMutation({
    onSuccess: () => {
      utils.ledger.getAccountByCustomer.invalidate({ customerId });
    }
  });
  
  // Re-used by both reverse + refund mutations to refresh every dependent
  // view (balance, transactions, payments, breakdown) and close the modal.
  const refreshAfterReversal = () => {
    utils.ledger.getAccountByCustomer.invalidate({ customerId });
    utils.ledger.getTransactions.invalidate();
    utils.ledger.getPayments.invalidate();
    utils.ledger.getAccountBreakdown.invalidate();
    utils.invoices.getByCustomer.invalidate();
    setReverseDialogOpen(false);
    setReverseTargetPayment(null);
    setReverseAmount("");
    setReverseReason("");
    setReverseCashAccountId("");
  };

  const reversePayment = trpc.ledger.reversePayment.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "پارەدان بە سەرکەوتوویی گەڕێنرایەوە", en: "Payment reversed successfully", ar: "تم عكس الدفعة بنجاح", zh: "付款已成功撤销" }));
      refreshAfterReversal();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const refundPayment = trpc.ledger.refundPayment.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "Refund بە سەرکەوتوویی جێبەجێکرا", en: "Refund completed successfully", ar: "تم تنفيذ الاسترداد بنجاح", zh: "退款已成功完成" }));
      refreshAfterReversal();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const adjustBalance = trpc.ledger.adjustBalance.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "بالانس بە سەرکەوتوویی ڕاستکرایەوە", en: "Balance adjusted successfully", ar: "تم تعديل الرصيد بنجاح", zh: "余额已成功调整" }));
      setAdjustDialogOpen(false);
      setAdjustAmount("");
      setAdjustReason("");
      utils.ledger.getAccountByCustomer.invalidate({ customerId });
      utils.ledger.getTransactions.invalidate();
      utils.ledger.getAccountBreakdown.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const recordPayment = trpc.ledger.recordPayment.useMutation({
    onSuccess: () => {
      toast.success(t("finance.paymentRecorded"));
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentAmountIqd("");
      setPaymentMethod("");
      setPaymentNotes("");
      setReceiptNumber("");
      setPaymentCashAccountId("");
      utils.ledger.getAccountByCustomer.invalidate({ customerId });
      utils.ledger.getTransactions.invalidate();
      utils.ledger.getPayments.invalidate();
      utils.ledger.getAccountBreakdown.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const handleCreateAccount = () => {
    if (customer) {
      getOrCreateAccount.mutate({
        customerId: customer.id,
        customerCode: customer.customerCode || `C${customer.id}`
      });
    }
  };
  
  const handleRecordPayment = () => {
    if (!customer || !paymentMethod) return;

    recordPayment.mutate({
      customerId: customer.id,
      customerCode: customer.customerCode || `C${customer.id}`,
      amountUsd: parseFloat(paymentAmount) || 0,
      amountIqd: parseFloat(paymentAmountIqd) || 0,
      paymentMethod: paymentMethod as any,
      notes: paymentNotes || undefined,
      receiptNumber: receiptNumber || undefined,
      cashAccountId: paymentCashAccountId && paymentCashAccountId !== 'none' ? parseInt(paymentCashAccountId) : undefined,
    });
  };

  // Open the reverse / refund modal pre-filled with the target payment's
  // remaining amount. `reversedAmountUsd` may be > 0 if a previous partial
  // reversal happened, so we offer only the remaining portion as default.
  const openReverseDialog = (payment: any) => {
    const original = parseFloat(payment.amountUsd || '0') || 0;
    const reversed = parseFloat(payment.reversedAmountUsd || '0') || 0;
    const remaining = Math.max(0, original - reversed);
    setReverseTargetPayment(payment);
    setReverseMode('mistake');
    setReverseAmount(remaining.toFixed(2));
    setReverseReason("");
    setReverseCashAccountId("");
    setReverseDialogOpen(true);
  };

  const reverseRemainingUsd = (() => {
    if (!reverseTargetPayment) return 0;
    const original = parseFloat(reverseTargetPayment.amountUsd || '0') || 0;
    const reversed = parseFloat(reverseTargetPayment.reversedAmountUsd || '0') || 0;
    return Math.max(0, original - reversed);
  })();

  // Quick action: pre-fill the adjustment form with whatever amount &
  // direction would bring the current balance to exactly zero. Common case
  // for orphaned negative balances (we owe customer but no payment record
  // exists to refund against) and orphaned positive balances (customer
  // owes us but the underlying charge is gone).
  const openAdjustDialogToZero = () => {
    const balance = parseFloat(account?.currentBalanceUsd || '0') || 0;
    if (balance === 0) {
      toast.info(pickLang(language, { ku: "بالانس پێشتر سفرە", en: "Balance is already zero", ar: "الرصيد صفر بالفعل", zh: "余额已为零" }));
      return;
    }
    // balance > 0 → customer owes us → CREDIT decreases balance to 0
    // balance < 0 → we owe customer → DEBIT increases balance to 0
    setAdjustDirection(balance > 0 ? 'credit' : 'debit');
    setAdjustAmount(Math.abs(balance).toFixed(2));
    setAdjustReason("");
    setAdjustDialogOpen(true);
  };

  const handleSubmitAdjust = () => {
    if (!customer) return;
    if (!adjustReason || adjustReason.trim().length < 5) {
      toast.error(pickLang(language, { ku: "هۆکار پێویستە لانیکەم ٥ پیت بێت", en: "Reason must be at least 5 characters", ar: "يجب أن يكون السبب 5 أحرف على الأقل", zh: "原因至少需要5个字符" }));
      return;
    }
    const amount = parseFloat(adjustAmount) || 0;
    if (amount <= 0) {
      toast.error(pickLang(language, { ku: "بڕ پێویستە لە سفر زیاتر بێت", en: "Amount must be greater than zero", ar: "يجب أن يكون المبلغ أكبر من صفر", zh: "金额必须大于零" }));
      return;
    }
    adjustBalance.mutate({
      customerId: customer.id,
      direction: adjustDirection,
      amountUsd: amount,
      reason: adjustReason.trim(),
    });
  };

  const adjustPreviewBalance = (() => {
    const current = parseFloat(account?.currentBalanceUsd || '0') || 0;
    const amount = parseFloat(adjustAmount) || 0;
    return adjustDirection === 'debit' ? current + amount : current - amount;
  })();

  const handleSubmitReverse = () => {
    if (!reverseTargetPayment) return;
    if (!reverseReason || reverseReason.trim().length < 5) {
      toast.error(pickLang(language, { ku: "هۆکار پێویستە لانیکەم ٥ پیت بێت", en: "Reason must be at least 5 characters", ar: "يجب أن يكون السبب 5 أحرف على الأقل", zh: "原因至少需要5个字符" }));
      return;
    }
    const amount = parseFloat(reverseAmount) || 0;
    if (amount <= 0) {
      toast.error(pickLang(language, { ku: "بڕی گەڕاندنەوە پێویستە لە سفر زیاتر بێت", en: "Reversal amount must be greater than zero", ar: "يجب أن يكون مبلغ العكس أكبر من صفر", zh: "撤销金额必须大于零" }));
      return;
    }
    if (amount > reverseRemainingUsd + 0.005) {
      toast.error(pickLang(language, { ku: `بڕی داواکراو ($${amount.toFixed(2)}) لە ماوە ($${reverseRemainingUsd.toFixed(2)}) زیاترە`, en: `Requested amount ($${amount.toFixed(2)}) exceeds the remaining ($${reverseRemainingUsd.toFixed(2)})`, ar: `المبلغ المطلوب ($${amount.toFixed(2)}) يتجاوز المتبقي ($${reverseRemainingUsd.toFixed(2)})`, zh: `请求金额 ($${amount.toFixed(2)}) 超过剩余金额 ($${reverseRemainingUsd.toFixed(2)})` }));
      return;
    }
    if (reverseMode === 'mistake') {
      reversePayment.mutate({
        paymentId: reverseTargetPayment.id,
        amountUsd: amount,
        reason: reverseReason.trim(),
      });
    } else {
      if (!reverseCashAccountId || reverseCashAccountId === 'none') {
        toast.error(pickLang(language, { ku: "تکایە حسابێکی نقدی هەڵبژێرە بۆ Refund", en: "Please select a cash account for the refund", ar: "يرجى اختيار حساب نقدي للاسترداد", zh: "请选择用于退款的现金账户" }));
        return;
      }
      refundPayment.mutate({
        paymentId: reverseTargetPayment.id,
        amountUsd: amount,
        cashAccountId: parseInt(reverseCashAccountId, 10),
        reason: reverseReason.trim(),
      });
    }
  };
  
  const formatCurrency = (amount: string | number, currency: string = "USD") => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (currency === "IQD") {
      return new Intl.NumberFormat('en-US', { style: 'decimal' }).format(num) + " IQD";
    }
    return "$" + num.toFixed(2);
  };
  
  const getTransactionTypeColor = (type: string) => {
    if (type.startsWith('DEBIT')) return 'text-red-600';
    if (type.startsWith('CREDIT')) return 'text-emerald-600';
    return 'text-gray-600';
  };
  
  const getTransactionTypeBgColor = (type: string) => {
    if (type.startsWith('DEBIT')) return 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-800/60';
    if (type.startsWith('CREDIT')) return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/60';
    return 'bg-gray-50 dark:bg-gray-950/40 border-gray-100 dark:border-gray-800/60';
  };
  
  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'DEBIT_PACKAGE': pickLang(language, { ku: 'نرخی پاکەت', en: 'Package charge', ar: 'رسوم الطرد', zh: '包裹费用' }),
      'DEBIT_FULL_PACKAGE': pickLang(language, { ku: 'پاکێجی تەواو', en: 'Full package', ar: 'الحزمة الكاملة', zh: '完整套餐' }),
      'DEBIT_PURCHASE_REQUEST': pickLang(language, { ku: 'داواکاری کڕین', en: 'Purchase request', ar: 'طلب شراء', zh: '采购请求' }),
      'DEBIT_COMMISSION': pickLang(language, { ku: 'عمولە', en: 'Commission', ar: 'عمولة', zh: '佣金' }),
      'DEBIT_SERVICE': pickLang(language, { ku: 'خزمەتگوزاری', en: 'Service', ar: 'خدمة', zh: '服务' }),
      'DEBIT_PENALTY': pickLang(language, { ku: 'سزا', en: 'Penalty', ar: 'غرامة', zh: '罚款' }),
      'DEBIT_OTHER': pickLang(language, { ku: 'قەرزی تر', en: 'Other debt', ar: 'دين آخر', zh: '其他欠款' }),
      'CREDIT_PAYMENT': pickLang(language, { ku: 'پارەدان', en: 'Payment', ar: 'دفعة', zh: '付款' }),
      'CREDIT_DEPOSIT': pickLang(language, { ku: 'پارە دانان', en: 'Deposit', ar: 'إيداع', zh: '存款' }),
      'CREDIT_REFUND': pickLang(language, { ku: 'گەڕاندنەوە', en: 'Refund', ar: 'استرداد', zh: '退款' }),
      'CREDIT_DISCOUNT': pickLang(language, { ku: 'داشکاندن', en: 'Discount', ar: 'خصم', zh: '折扣' }),
      'CREDIT_OTHER': pickLang(language, { ku: 'دراوی تر', en: 'Other credit', ar: 'دائن آخر', zh: '其他贷项' }),
      'ADJUSTMENT_DEBIT': pickLang(language, { ku: 'ڕێکخستنی قەرز', en: 'Debt adjustment', ar: 'تسوية الدين', zh: '欠款调整' }),
      'ADJUSTMENT_CREDIT': pickLang(language, { ku: 'ڕێکخستنی دراو', en: 'Credit adjustment', ar: 'تسوية الدائن', zh: '贷项调整' }),
    };
    return labels[type] || type;
  };
  
  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'CASH': pickLang(language, { ku: 'کاش', en: 'Cash', ar: 'نقدًا', zh: '现金' }),
      'BANK_TRANSFER': pickLang(language, { ku: 'گواستنەوەی بانکی', en: 'Bank transfer', ar: 'تحويل بنكي', zh: '银行转账' }),
      'FIB': 'FIB',
      'FASTPAY': 'FastPay',
      'ZAINCASH': 'ZainCash',
      'ASIAHAWALA': 'Asia Hawala',
      'CARD': pickLang(language, { ku: 'کارت', en: 'Card', ar: 'بطاقة', zh: '银行卡' }),
      'OTHER': pickLang(language, { ku: 'شێوازی تر', en: 'Other method', ar: 'طريقة أخرى', zh: '其他方式' }),
    };
    return labels[method] || method;
  };

  // Transaction type options for filter
  const transactionTypeOptions = [
    { value: 'all', label: pickLang(language, { ku: 'هەموو', en: 'All', ar: 'الكل', zh: '全部' }) },
    { value: 'DEBIT_PACKAGE', label: pickLang(language, { ku: 'نرخی پاکەت', en: 'Package charge', ar: 'رسوم الطرد', zh: '包裹费用' }) },
    { value: 'DEBIT_FULL_PACKAGE', label: pickLang(language, { ku: 'پاکێجی تەواو', en: 'Full package', ar: 'الحزمة الكاملة', zh: '完整套餐' }) },
    { value: 'DEBIT_COMMISSION', label: pickLang(language, { ku: 'عمولە', en: 'Commission', ar: 'عمولة', zh: '佣金' }) },
    { value: 'DEBIT_SERVICE', label: pickLang(language, { ku: 'خزمەتگوزاری', en: 'Service', ar: 'خدمة', zh: '服务' }) },
    { value: 'CREDIT_PAYMENT', label: pickLang(language, { ku: 'پارەدان', en: 'Payment', ar: 'دفعة', zh: '付款' }) },
    { value: 'CREDIT_DEPOSIT', label: pickLang(language, { ku: 'پارە دانان', en: 'Deposit', ar: 'إيداع', zh: '存款' }) },
    { value: 'CREDIT_REFUND', label: pickLang(language, { ku: 'گەڕاندنەوە', en: 'Refund', ar: 'استرداد', zh: '退款' }) },
  ];

  // Filter transactions by type
  const filteredTransactions = transactions?.filter(txn => {
    if (typeFilter === 'all') return true;
    return txn.transactionType === typeFilter;
  });

  // Map invoiceId → { invoiceNumber, batchId } for the grouped header. Only
  // a display lookup; ledger integrity does not depend on this query.
  const invoiceMap = useMemo(() => {
    const map = new Map<number, { invoiceNumber: string; batchId: number | null }>();
    const list = Array.isArray(customerInvoicesResponse)
      ? customerInvoicesResponse
      : (customerInvoicesResponse?.data ?? []);
    for (const inv of list) {
      if (inv?.id != null) {
        map.set(inv.id, {
          invoiceNumber: inv.invoiceNumber || `#${inv.id}`,
          batchId: (inv as any).batchId ?? null,
        });
      }
    }
    return map;
  }, [customerInvoicesResponse]);

  // Group consecutive transactions by invoiceId. Order from the API is
  // preserved (newest-first), so groups also surface newest-first.
  // - rows with invoiceId === null  → standalone group (manual credits, etc.)
  // - rows with same invoiceId      → one collapsible group
  // - groups of size 1 are still rendered as a normal row (no toggle)
  type LedgerTxn = NonNullable<typeof filteredTransactions>[number];
  type LedgerGroup =
    | { kind: 'standalone'; key: string; row: LedgerTxn }
    | {
        kind: 'invoice';
        key: string;
        invoiceId: number;
        invoiceNumber: string;
        batchId: number | null;
        rows: LedgerTxn[];
        netAmountUsd: number;       // signed: + for net debit, − for net credit
        balanceAfterUsd: number;    // post-state of newest row (group head)
        latestCreatedAt: Date;
      };

  const ledgerGroups = useMemo<LedgerGroup[]>(() => {
    const txns = filteredTransactions ?? [];
    const byInvoice = new Map<number, LedgerTxn[]>();
    const order: Array<{ kind: 'standalone'; row: LedgerTxn } | { kind: 'invoice'; invoiceId: number }> = [];

    for (const txn of txns) {
      const invId = (txn as any).invoiceId as number | null | undefined;
      if (invId == null) {
        order.push({ kind: 'standalone', row: txn });
        continue;
      }
      if (!byInvoice.has(invId)) {
        byInvoice.set(invId, []);
        order.push({ kind: 'invoice', invoiceId: invId });
      }
      byInvoice.get(invId)!.push(txn);
    }

    return order.map((slot, idx): LedgerGroup => {
      if (slot.kind === 'standalone') {
        return { kind: 'standalone', key: `s-${slot.row.id}`, row: slot.row };
      }
      const rows = byInvoice.get(slot.invoiceId) ?? [];
      const head = rows[0]; // newest first per API ordering
      const netAmountUsd = rows.reduce((sum, t) => {
        const amt = parseFloat(t.amountUsd || '0') || 0;
        return sum + (t.transactionType.startsWith('DEBIT') ? amt : -amt);
      }, 0);
      const meta = invoiceMap.get(slot.invoiceId);
      return {
        kind: 'invoice',
        key: `i-${slot.invoiceId}-${idx}`,
        invoiceId: slot.invoiceId,
        invoiceNumber: meta?.invoiceNumber ?? `#${slot.invoiceId}`,
        batchId: meta?.batchId ?? null,
        rows,
        netAmountUsd,
        balanceAfterUsd: parseFloat(head?.balanceAfterUsd || '0') || 0,
        latestCreatedAt: head?.createdAt ? new Date(head.createdAt) : new Date(),
      };
    });
  }, [filteredTransactions, invoiceMap]);

  const toggleInvoiceGroup = (invoiceId: number) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  };

  // Get transaction type icon
  const getTransactionTypeIcon = (type: string) => {
    if (type === 'DEBIT_PACKAGE') return <Package className="w-4 h-4" />;
    if (type === 'DEBIT_FULL_PACKAGE') return <ShoppingCart className="w-4 h-4" />;
    if (type === 'DEBIT_PURCHASE_REQUEST') return <ShoppingCart className="w-4 h-4" />;
    if (type === 'DEBIT_COMMISSION') return <Percent className="w-4 h-4" />;
    if (type.startsWith('DEBIT')) return <ArrowUpRight className="w-4 h-4" />;
    return <ArrowDownRight className="w-4 h-4" />;
  };

  // Professional PDF Export
  const exportToPDF = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast.error(t('toast.noDataToExport'));
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(t('toast.allowPopupsForPrint'));
      return;
    }

    const totalDebit = filteredTransactions
      .filter(t => t.transactionType.startsWith('DEBIT'))
      .reduce((sum, t) => sum + parseFloat(t.amountUsd || '0'), 0);
    
    const totalCredit = filteredTransactions
      .filter(t => t.transactionType.startsWith('CREDIT'))
      .reduce((sum, t) => sum + parseFloat(t.amountUsd || '0'), 0);

    const company = getCompanyInfoFromSettings(settings || []);
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ku">
      <head>
        <meta charset="UTF-8">
        <title>${pickLang(language, { ku: "ڕاپۆرتی دارایی", en: "Financial Report", ar: "التقرير المالي", zh: "财务报告" })} - ${customer?.customerCode}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Noto Sans Arabic', sans-serif;
          }
          
          body {
            background: #f8fafc;
            padding: 0;
            direction: rtl;
          }
          
          .page {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            min-height: 100vh;
          }
          
          /* Header */
          .header {
            background: linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%);
            color: white;
            padding: 40px;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 100%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
          }
          
          .header-content {
            position: relative;
            z-index: 1;
          }
          
          .company-name {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 5px;
            letter-spacing: -0.5px;
          }
          
          .report-title {
            font-size: 18px;
            opacity: 0.9;
            font-weight: 400;
          }
          
          .header-date {
            position: absolute;
            top: 40px;
            left: 40px;
            text-align: left;
            font-size: 14px;
            opacity: 0.8;
          }
          
          /* Customer Info */
          .customer-section {
            padding: 30px 40px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .customer-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
          }
          
          .customer-item {
            background: white;
            padding: 16px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
          }
          
          .customer-label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 4px;
          }
          
          .customer-value {
            font-size: 16px;
            font-weight: 600;
            color: #1e293b;
          }
          
          /* Balance Summary */
          .balance-section {
            padding: 30px 40px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .section-title::before {
            content: '';
            width: 4px;
            height: 20px;
            background: #059669;
            border-radius: 2px;
          }
          
          .balance-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
          
          .balance-card {
            padding: 20px;
            border-radius: 12px;
            text-align: center;
          }
          
          .balance-card.usd {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 1px solid #fbbf24;
          }
          
          .balance-card.iqd {
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            border: 1px solid #3b82f6;
          }
          
          .balance-card.status {
            background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
            border: 1px solid #10b981;
          }
          
          .balance-label {
            font-size: 13px;
            color: #475569;
            margin-bottom: 8px;
          }
          
          .balance-value {
            font-size: 28px;
            font-weight: 700;
          }
          
          .balance-card.usd .balance-value { color: #b45309; }
          .balance-card.iqd .balance-value { color: #1d4ed8; }
          .balance-card.status .balance-value { color: #047857; font-size: 18px; }
          
          /* Debt Breakdown */
          .breakdown-section {
            padding: 30px 40px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .breakdown-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 12px;
          }
          
          .breakdown-card {
            padding: 16px 12px;
            border-radius: 10px;
            text-align: center;
            border: 1px solid;
          }
          
          .breakdown-card.package { background: #eff6ff; border-color: #bfdbfe; }
          .breakdown-card.fullpackage { background: #f0fdf4; border-color: #bbf7d0; }
          .breakdown-card.commission { background: #fefce8; border-color: #fef08a; }
          .breakdown-card.service { background: #fdf4ff; border-color: #f5d0fe; }
          .breakdown-card.credit { background: #ecfdf5; border-color: #a7f3d0; }
          .breakdown-card.total { background: #fef2f2; border-color: #fecaca; }
          
          .breakdown-label {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 6px;
          }
          
          .breakdown-value {
            font-size: 16px;
            font-weight: 700;
          }
          
          .breakdown-card.package .breakdown-value { color: #1d4ed8; }
          .breakdown-card.fullpackage .breakdown-value { color: #15803d; }
          .breakdown-card.commission .breakdown-value { color: #a16207; }
          .breakdown-card.service .breakdown-value { color: #a21caf; }
          .breakdown-card.credit .breakdown-value { color: #047857; }
          .breakdown-card.total .breakdown-value { color: #dc2626; }
          
          /* Summary Row */
          .summary-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px dashed #e2e8f0;
          }
          
          .summary-item {
            text-align: center;
          }
          
          .summary-label {
            font-size: 13px;
            color: #64748b;
            margin-bottom: 4px;
          }
          
          .summary-value {
            font-size: 24px;
            font-weight: 700;
          }
          
          .summary-value.debit { color: #dc2626; }
          .summary-value.credit { color: #059669; }
          .summary-value.net { color: #1e293b; }
          
          /* Transactions Table */
          .transactions-section {
            padding: 30px 40px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
            font-size: 13px;
          }
          
          thead {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
          }
          
          th {
            padding: 14px 12px;
            text-align: right;
            font-weight: 600;
            font-size: 12px;
          }
          
          th:first-child {
            border-radius: 0 8px 0 0;
          }
          
          th:last-child {
            border-radius: 8px 0 0 0;
          }
          
          td {
            padding: 12px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: middle;
          }
          
          tr:nth-child(even) {
            background: #f8fafc;
          }
          
          tr:hover {
            background: #f1f5f9;
          }
          
          .amount-debit {
            color: #dc2626;
            font-weight: 600;
          }
          
          .amount-credit {
            color: #059669;
            font-weight: 600;
          }
          
          .type-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 500;
          }
          
          .type-badge.debit {
            background: #fef2f2;
            color: #dc2626;
          }
          
          .type-badge.credit {
            background: #ecfdf5;
            color: #059669;
          }
          
          .txn-number {
            font-family: monospace;
            font-size: 11px;
            color: #64748b;
          }
          
          .description {
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 12px;
            color: #475569;
          }
          
          /* Footer */
          .footer {
            padding: 30px 40px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            text-align: center;
          }
          
          .footer-text {
            color: #64748b;
            font-size: 12px;
          }
          
          .footer-brand {
            font-weight: 600;
            color: #059669;
          }
          
          @media print {
            body { background: white; }
            .page { box-shadow: none; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <!-- Header -->
          <div class="header">
            <div class="header-content">
              <div class="company-name">${company.name}</div>
              <div class="report-title">${pickLang(language, { ku: "ڕاپۆرتی دارایی کڕیار", en: "Customer Financial Report", ar: "التقرير المالي للعميل", zh: "客户财务报告" })}</div>
            </div>
            <div class="header-date">
              <div>${new Date().toLocaleDateString('ku-IQ', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div style="font-size: 12px; margin-top: 4px;">${new Date().toLocaleTimeString('ku-IQ')}</div>
            </div>
          </div>
          
          <!-- Customer Info -->
          <div class="customer-section">
            <div class="customer-grid">
              <div class="customer-item">
                <div class="customer-label">${pickLang(language, { ku: "کۆدی کڕیار", en: "Customer code", ar: "رمز العميل", zh: "客户编号" })}</div>
                <div class="customer-value">${customer?.customerCode || '-'}</div>
              </div>
              <div class="customer-item">
                <div class="customer-label">${pickLang(language, { ku: "ناوی کڕیار", en: "Customer name", ar: "اسم العميل", zh: "客户姓名" })}</div>
                <div class="customer-value">${customer?.fullName || '-'}</div>
              </div>
              <div class="customer-item">
                <div class="customer-label">${pickLang(language, { ku: "ژمارەی مۆبایل", en: "Mobile number", ar: "رقم الهاتف", zh: "手机号码" })}</div>
                <div class="customer-value">${customer?.mobileNumber || '-'}</div>
              </div>
              <div class="customer-item">
                <div class="customer-label">${pickLang(language, { ku: "بەرواری تۆمارکردن", en: "Registration date", ar: "تاريخ التسجيل", zh: "注册日期" })}</div>
                <div class="customer-value">${customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString('ku-IQ') : '-'}</div>
              </div>
            </div>
          </div>
          
          <!-- Balance Summary -->
          <div class="balance-section">
            <div class="section-title">${pickLang(language, { ku: "باڵانسی حساب", en: "Account balance", ar: "رصيد الحساب", zh: "账户余额" })}</div>
            <div class="balance-grid">
              <div class="balance-card usd">
                <div class="balance-label">${pickLang(language, { ku: "باڵانس (USD)", en: "Balance (USD)", ar: "الرصيد (USD)", zh: "余额 (USD)" })}</div>
                <div class="balance-value">$${parseFloat(account?.currentBalanceUsd || '0').toFixed(2)}</div>
              </div>

              <div class="balance-card status">
                <div class="balance-label">${pickLang(language, { ku: "دۆخی حساب", en: "Account status", ar: "حالة الحساب", zh: "账户状态" })}</div>
                <div class="balance-value">${account?.accountStatus === 'active' ? pickLang(language, { ku: '✓ چالاک', en: '✓ Active', ar: '✓ نشط', zh: '✓ 活跃' }) : pickLang(language, { ku: 'ناچالاک', en: 'Inactive', ar: 'غير نشط', zh: '停用' })}</div>
              </div>
            </div>
          </div>
          
          <!-- Debt Breakdown -->
          ${breakdown ? `
          <div class="breakdown-section">
            <div class="section-title">${pickLang(language, { ku: "شیکاری فرۆشتن", en: "Sales breakdown", ar: "تفصيل المبيعات", zh: "销售明细" })}</div>
            <div class="breakdown-grid">
              <div class="breakdown-card package">
                <div class="breakdown-label">${pickLang(language, { ku: "نرخی پاکەتەکان", en: "Package charges", ar: "رسوم الطرود", zh: "包裹费用" })}</div>
                <div class="breakdown-value">$${breakdown.packageDebt.toFixed(2)}</div>
              </div>
              <div class="breakdown-card fullpackage">
                <div class="breakdown-label">${pickLang(language, { ku: "نرخی پاکێجی تەواو", en: "Full package charges", ar: "رسوم الحزمة الكاملة", zh: "完整套餐费用" })}</div>
                <div class="breakdown-value">$${breakdown.fullPackageDebt.toFixed(2)}</div>
              </div>
              <div class="breakdown-card commission">
                <div class="breakdown-label">${pickLang(language, { ku: "نرخی عموڵە", en: "Commission charges", ar: "رسوم العمولة", zh: "佣金费用" })}</div>
                <div class="breakdown-value">$${breakdown.commissionDebt.toFixed(2)}</div>
              </div>
              <div class="breakdown-card service">
                <div class="breakdown-label">${pickLang(language, { ku: "نرخی خزمەتگوزاری", en: "Service charges", ar: "رسوم الخدمة", zh: "服务费用" })}</div>
                <div class="breakdown-value">$${breakdown.serviceDebt.toFixed(2)}</div>
              </div>
              <div class="breakdown-card credit">
                <div class="breakdown-label">${pickLang(language, { ku: "کۆی پارەدان", en: "Total paid", ar: "إجمالي المدفوع", zh: "已付总额" })}</div>
                <div class="breakdown-value">$${breakdown.creditBalance.toFixed(2)}</div>
              </div>
              <div class="breakdown-card total">
                <div class="breakdown-label">${pickLang(language, { ku: "کۆی فرۆشتن", en: "Total sales", ar: "إجمالي المبيعات", zh: "销售总额" })}</div>
                <div class="breakdown-value">$${breakdown.totalDebt.toFixed(2)}</div>
              </div>
            </div>
            <div class="summary-row">
              <div class="summary-item">
                <div class="summary-label">${pickLang(language, { ku: "کۆی فرۆشتن", en: "Total sales", ar: "إجمالي المبيعات", zh: "销售总额" })}</div>
                <div class="summary-value debit">$${totalDebit.toFixed(2)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">${pickLang(language, { ku: "کۆی پارەدانەکان", en: "Total payments", ar: "إجمالي المدفوعات", zh: "付款总额" })}</div>
                <div class="summary-value credit">$${totalCredit.toFixed(2)}</div>
              </div>

            </div>
          </div>
          ` : ''}
          
          <!-- Transactions Table -->
          <div class="transactions-section">
            <div class="section-title">${pickLang(language, { ku: "لیستی جوڵەکان", en: "Transactions list", ar: "قائمة الحركات", zh: "交易列表" })} (${filteredTransactions.length} ${pickLang(language, { ku: "جوڵە", en: "transactions", ar: "حركة", zh: "笔" })})</div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>${pickLang(language, { ku: "ژمارەی جوڵە", en: "Transaction no.", ar: "رقم الحركة", zh: "交易编号" })}</th>
                  <th>${pickLang(language, { ku: "جۆر", en: "Type", ar: "النوع", zh: "类型" })}</th>
                  <th>${pickLang(language, { ku: "بڕی USD", en: "Amount USD", ar: "المبلغ USD", zh: "金额 USD" })}</th>
                  <th>${pickLang(language, { ku: "باڵانس دوای", en: "Balance after", ar: "الرصيد بعد", zh: "之后余额" })}</th>
                  <th>${pickLang(language, { ku: "وەسف", en: "Description", ar: "الوصف", zh: "描述" })}</th>
                  <th>${pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTransactions.map((txn, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td class="txn-number">${txn.transactionNumber}</td>
                    <td>
                      <span class="type-badge ${txn.transactionType.startsWith('DEBIT') ? 'debit' : 'credit'}">
                        ${getTransactionTypeLabel(txn.transactionType)}
                      </span>
                    </td>
                    <td class="${txn.transactionType.startsWith('DEBIT') ? 'amount-debit' : 'amount-credit'}">
                      ${txn.transactionType.startsWith('DEBIT') ? '+' : '-'}$${parseFloat(txn.amountUsd || '0').toFixed(2)}
                    </td>
                    <td>$${parseFloat(txn.balanceAfterUsd || '0').toFixed(2)}</td>
                    <td class="description" title="${txn.description || ''}">${txn.description || '-'}</td>
                    <td>${new Date(txn.createdAt).toLocaleDateString('ku-IQ')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p class="footer-text">
              ${pickLang(language, { ku: "ئەم ڕاپۆرتە لەلایەن", en: "This report was generated by", ar: "تم إنشاء هذا التقرير بواسطة", zh: "本报告由" })} <span class="footer-brand">${company.name}</span> ${pickLang(language, { ku: "دروستکراوە", en: "", ar: "", zh: "生成" })}
              <br>
              ${new Date().toLocaleString('ku-IQ')}
            </p>
          </div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    toast.success(t('toast.pdfReady'));
  };

  // Professional Excel Export
  const exportToExcel = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast.error(t('toast.noDataToExport'));
      return;
    }

    const totalDebit = filteredTransactions
      .filter(t => t.transactionType.startsWith('DEBIT'))
      .reduce((sum, t) => sum + parseFloat(t.amountUsd || '0'), 0);
    
    const totalCredit = filteredTransactions
      .filter(t => t.transactionType.startsWith('CREDIT'))
      .reduce((sum, t) => sum + parseFloat(t.amountUsd || '0'), 0);

    // Create CSV with BOM for Kurdish support
    const BOM = '\uFEFF';
    
    // Header info
    const headerInfo = [
      [`${pickLang(language, { ku: "ڕاپۆرتی دارایی کڕیار", en: "Customer Financial Report", ar: "التقرير المالي للعميل", zh: "客户财务报告" })} - ${getCompanyInfoFromSettings(settings || []).name}`],
      [''],
      [pickLang(language, { ku: 'زانیاری کڕیار', en: 'Customer information', ar: 'معلومات العميل', zh: '客户信息' })],
      [`${pickLang(language, { ku: "کۆدی کڕیار", en: "Customer code", ar: "رمز العميل", zh: "客户编号" })}:,${customer?.customerCode || '-'}`],
      [`${pickLang(language, { ku: "ناوی کڕیار", en: "Customer name", ar: "اسم العميل", zh: "客户姓名" })}:,${customer?.fullName || '-'}`],
      [`${pickLang(language, { ku: "ژمارەی مۆبایل", en: "Mobile number", ar: "رقم الهاتف", zh: "手机号码" })}:,${customer?.mobileNumber || '-'}`],
      [`${pickLang(language, { ku: "بەرواری تۆمارکردن", en: "Registration date", ar: "تاريخ التسجيل", zh: "注册日期" })}:,${customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString('ku-IQ') : '-'}`],
      [''],
      [pickLang(language, { ku: 'باڵانسی حساب', en: 'Account balance', ar: 'رصيد الحساب', zh: '账户余额' })],
      [`${pickLang(language, { ku: "باڵانس (USD)", en: "Balance (USD)", ar: "الرصيد (USD)", zh: "余额 (USD)" })}:,$${parseFloat(account?.currentBalanceUsd || '0').toFixed(2)}`],
      [`${pickLang(language, { ku: "دۆخی حساب", en: "Account status", ar: "حالة الحساب", zh: "账户状态" })}:,${account?.accountStatus === 'active' ? pickLang(language, { ku: 'چالاک', en: 'Active', ar: 'نشط', zh: '活跃' }) : pickLang(language, { ku: 'ناچالاک', en: 'Inactive', ar: 'غير نشط', zh: '停用' })}`],
      [''],
    ];

    // Breakdown info
    const breakdownInfo = breakdown ? [
      [pickLang(language, { ku: 'شیکاری فرۆشتن', en: 'Sales breakdown', ar: 'تفصيل المبيعات', zh: '销售明细' })],
      [`${pickLang(language, { ku: "نرخی پاکەتەکان", en: "Package charges", ar: "رسوم الطرود", zh: "包裹费用" })}:,$${breakdown.packageDebt.toFixed(2)}`],
      [`${pickLang(language, { ku: "نرخی پاکێجی تەواو", en: "Full package charges", ar: "رسوم الحزمة الكاملة", zh: "完整套餐费用" })}:,$${breakdown.fullPackageDebt.toFixed(2)}`],
      [`${pickLang(language, { ku: "نرخی عموڵە", en: "Commission charges", ar: "رسوم العمولة", zh: "佣金费用" })}:,$${breakdown.commissionDebt.toFixed(2)}`],
      [`${pickLang(language, { ku: "نرخی خزمەتگوزاری", en: "Service charges", ar: "رسوم الخدمة", zh: "服务费用" })}:,$${breakdown.serviceDebt.toFixed(2)}`],
      [`${pickLang(language, { ku: "کۆی پارەدان", en: "Total paid", ar: "إجمالي المدفوع", zh: "已付总额" })}:,$${breakdown.creditBalance.toFixed(2)}`],
      [`${pickLang(language, { ku: "کۆی فرۆشتن", en: "Total sales", ar: "إجمالي المبيعات", zh: "销售总额" })}:,$${breakdown.totalDebt.toFixed(2)}`],
      [''],
    ] : [];

    // Summary
    const summaryInfo = [
      [pickLang(language, { ku: 'کورتەی جوڵەکان', en: 'Transactions summary', ar: 'ملخص الحركات', zh: '交易摘要' })],
      [`${pickLang(language, { ku: "کۆی فرۆشتن", en: "Total sales", ar: "إجمالي المبيعات", zh: "销售总额" })}:,$${totalDebit.toFixed(2)}`],
      [`${pickLang(language, { ku: "کۆی پارەدانەکان", en: "Total payments", ar: "إجمالي المدفوعات", zh: "付款总额" })}:,$${totalCredit.toFixed(2)}`],
      [`${pickLang(language, { ku: "ژمارەی جوڵەکان", en: "Number of transactions", ar: "عدد الحركات", zh: "交易数量" })}:,${filteredTransactions.length}`],
      [''],
    ];

    // Transaction headers
    const transactionHeaders = [
      pickLang(language, { ku: 'لیستی جوڵەکان', en: 'Transactions list', ar: 'قائمة الحركات', zh: '交易列表' })
    ];

    const tableHeaders = [
      '#',
      pickLang(language, { ku: 'ژمارەی جوڵە', en: 'Transaction no.', ar: 'رقم الحركة', zh: '交易编号' }),
      pickLang(language, { ku: 'جۆر', en: 'Type', ar: 'النوع', zh: '类型' }),
      pickLang(language, { ku: 'بڕی USD', en: 'Amount USD', ar: 'المبلغ USD', zh: '金额 USD' }),
      pickLang(language, { ku: 'باڵانس دوای', en: 'Balance after', ar: 'الرصيد بعد', zh: '之后余额' }),
      pickLang(language, { ku: 'وەسف', en: 'Description', ar: 'الوصف', zh: '描述' }),
      pickLang(language, { ku: 'بەروار', en: 'Date', ar: 'التاريخ', zh: '日期' })
    ];

    // Transaction rows
    const transactionRows = filteredTransactions.map((txn, index) => [
      index + 1,
      txn.transactionNumber,
      getTransactionTypeLabel(txn.transactionType),
      (txn.transactionType.startsWith('DEBIT') ? '+' : '-') + '$' + parseFloat(txn.amountUsd || '0').toFixed(2),
      '$' + parseFloat(txn.balanceAfterUsd || '0').toFixed(2),
      txn.description || '-',
      new Date(txn.createdAt).toLocaleDateString('ku-IQ')
    ]);

    // Combine all sections
    const allRows = [
      ...headerInfo,
      ...breakdownInfo,
      ...summaryInfo,
      [transactionHeaders],
      tableHeaders,
      ...transactionRows,
      [''],
      [pickLang(language, { ku: `ئەم ڕاپۆرتە لە ${new Date().toLocaleString('ku-IQ')} دروستکراوە`, en: `This report was generated on ${new Date().toLocaleString('ku-IQ')}`, ar: `تم إنشاء هذا التقرير في ${new Date().toLocaleString('ku-IQ')}`, zh: `本报告生成于 ${new Date().toLocaleString('ku-IQ')}` })]
    ];

    const csvContent = BOM + allRows.map(row => 
      Array.isArray(row) ? row.map(cell => `"${cell}"`).join(',') : `"${row}"`
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${customer?.customerCode || 'customer'}-financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(t('toast.excelReady'));
  };

  // Open transaction details
  const openTransactionDetails = (txn: any) => {
    setSelectedTransaction(txn);
    setDetailsDialogOpen(true);
  };

  if (customerLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-2xl" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="w-16 h-16 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">{pickLang(language, { ku: "کڕیار نەدۆزرایەوە", en: "Customer not found", ar: "العميل غير موجود", zh: "未找到客户" })}</p>
          <Link href="/finance">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 me-2" />
              {pickLang(language, { ku: "گەڕانەوە", en: "Back", ar: "رجوع", zh: "返回" })}
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Professional Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl"
        >
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />
          
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
          
          {/* Content */}
          <div className="relative p-8">
            {/* Top Row */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <Link href="/finance">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-xl">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Wallet className="w-7 h-7" />
                    {pickLang(language, { ku: "پڕۆفایلی دارایی کڕیار", en: "Customer financial profile", ar: "الملف المالي للعميل", zh: "客户财务档案" })}
                  </h1>
                  <p className="text-emerald-100 text-sm mt-1">{pickLang(language, { ku: "بەدواداچوونی حساب و مامەڵەکان", en: "Tracking account and transactions", ar: "متابعة الحساب والمعاملات", zh: "跟踪账户与交易" })}</p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Manual Balance Adjustment: for orphaned balances where
                    the payment record was hard-deleted before reversal
                    tooling existed. Posts an ADJUSTMENT_DEBIT/CREDIT
                    directly to the ledger with a mandatory reason. The
                    "هێنانە سفر" quick-mode pre-fills the form with the
                    exact amount + direction needed to zero the balance. */}
                <Button
                  className="bg-white dark:bg-card text-purple-700 dark:text-purple-300 hover:bg-purple-50 rounded-xl shadow-lg"
                  onClick={openAdjustDialogToZero}
                >
                  <Activity className="w-4 h-4 me-2" />
                  {pickLang(language, { ku: "ڕاستکردنەوەی بالانس", en: "Adjust balance", ar: "تعديل الرصيد", zh: "调整余额" })}
                </Button>
                {/* Refund: top-level entry point. Opens the same modal as
                    the per-row reverse button but starts at the picker
                    step so staff can search/choose any reversible payment
                    without scrolling to the payments tab. */}
                <Button
                  className="bg-white dark:bg-card text-amber-700 dark:text-amber-300 hover:bg-amber-50 rounded-xl shadow-lg"
                  onClick={() => {
                    setReverseTargetPayment(null);
                    setReverseMode('mistake');
                    setReverseAmount("");
                    setReverseReason("");
                    setReverseCashAccountId("");
                    setReverseDialogOpen(true);
                  }}
                >
                  <RotateCcw className="w-4 h-4 me-2" />
                  {pickLang(language, { ku: "ریفاوند", en: "Refund", ar: "استرداد", zh: "退款" })}
                </Button>
                <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-white dark:bg-card text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 rounded-xl shadow-lg">
                      <Plus className="w-4 h-4 me-2" />
                      {pickLang(language, { ku: "پارەدان", en: "Payment", ar: "دفعة", zh: "付款" })}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
                        {pickLang(language, { ku: "تۆمارکردنی پارەدان", en: "Record payment", ar: "تسجيل دفعة", zh: "登记付款" })}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>{pickLang(language, { ku: "بڕی USD", en: "Amount USD", ar: "المبلغ USD", zh: "金额 USD" })}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="0.00"
                            className="mt-1"
                          />
                        </div>

                      </div>
                      <div>
                        <Label>{pickLang(language, { ku: "شێوازی پارەدان", en: "Payment method", ar: "طريقة الدفع", zh: "付款方式" })}</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder={pickLang(language, { ku: "شێوازێک هەڵبژێرە", en: "Select a method", ar: "اختر طريقة", zh: "选择方式" })} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH">{pickLang(language, { ku: "کاش", en: "Cash", ar: "نقدًا", zh: "现金" })}</SelectItem>
                            <SelectItem value="BANK_TRANSFER">{pickLang(language, { ku: "گواستنەوەی بانکی", en: "Bank transfer", ar: "تحويل بنكي", zh: "银行转账" })}</SelectItem>
                            <SelectItem value="FIB">FIB</SelectItem>
                            <SelectItem value="FASTPAY">FastPay</SelectItem>
                            <SelectItem value="ZAINCASH">ZainCash</SelectItem>
                            <SelectItem value="ASIAHAWALA">Asia Hawala</SelectItem>
                            <SelectItem value="CARD">{pickLang(language, { ku: "کارت", en: "Card", ar: "بطاقة", zh: "银行卡" })}</SelectItem>
                            <SelectItem value="OTHER">{pickLang(language, { ku: "شێوازی تر", en: "Other method", ar: "طريقة أخرى", zh: "其他方式" })}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Cash Account Selection */}
                      <div>
                        <Label>{pickLang(language, { ku: "حسابی بانکی / سندوق", en: "Bank account / cashbox", ar: "حساب بنكي / صندوق", zh: "银行账户 / 现金箱" })}</Label>
                        <Popover modal={true}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="mt-1 w-full justify-between font-normal">
                              {paymentCashAccountId && paymentCashAccountId !== 'none'
                                ? (() => {
                                    const acc = activeCashAccounts?.find(a => a.id.toString() === paymentCashAccountId);
                                    return acc ? `${acc.accountNameKu || acc.accountName} ($${Number(acc.currentBalance).toLocaleString()})` : pickLang(language, { ku: "حسابێک هەڵبژێرە (ئارەزوومەندانە)", en: "Select an account (optional)", ar: "اختر حسابًا (اختياري)", zh: "选择账户（可选）" });
                                  })()
                                : pickLang(language, { ku: "حسابێک هەڵبژێرە (ئارەزوومەندانە)", en: "Select an account (optional)", ar: "اختر حسابًا (اختياري)", zh: "选择账户（可选）" })}
                              <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent variant="panel" className="w-full min-w-[320px]" align="start">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  <CommandItem
                                    onSelect={() => setPaymentCashAccountId('none')}
                                    className="cursor-pointer"
                                  >
                                    <Check className={`me-2 h-4 w-4 ${paymentCashAccountId === 'none' || !paymentCashAccountId ? 'opacity-100' : 'opacity-0'}`} />
                                    {pickLang(language, { ku: "بێ حساب", en: "No account", ar: "بدون حساب", zh: "无账户" })}
                                  </CommandItem>
                                  {activeCashAccounts?.map((acc) => (
                                    <CommandItem
                                      key={acc.id}
                                      onSelect={() => setPaymentCashAccountId(acc.id.toString())}
                                      className="cursor-pointer"
                                    >
                                      <Check className={`me-2 h-4 w-4 ${paymentCashAccountId === acc.id.toString() ? 'opacity-100' : 'opacity-0'}`} />
                                      <div className="flex items-center gap-2">
                                        <Landmark className="h-4 w-4 text-muted-foreground" />
                                        <span>{acc.accountNameKu || acc.accountName}</span>
                                        <Badge variant="secondary" className="text-xs">${Number(acc.currentBalance).toLocaleString()}</Badge>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-muted-foreground mt-1">{pickLang(language, { ku: "حسابێک هەڵبژێرە بۆ تۆمارکردنی پارەدان لە حسابەکەدا", en: "Select an account to record the payment into it", ar: "اختر حسابًا لتسجيل الدفعة فيه", zh: "选择一个账户以将付款记入其中" })}</p>
                      </div>
                      <div>
                        <Label>{pickLang(language, { ku: "ژمارەی پسوڵە (ئارەزوومەندانە)", en: "Receipt number (optional)", ar: "رقم الإيصال (اختياري)", zh: "收据编号（可选）" })}</Label>
                        <Input
                          value={receiptNumber}
                          onChange={(e) => setReceiptNumber(e.target.value)}
                          placeholder="RCP-001"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>{pickLang(language, { ku: "تێبینی (ئارەزوومەندانە)", en: "Note (optional)", ar: "ملاحظة (اختياري)", zh: "备注（可选）" })}</Label>
                        <Textarea
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          placeholder={pickLang(language, { ku: "تێبینی سەبارەت بە پارەدان...", en: "Note about the payment...", ar: "ملاحظة حول الدفعة...", zh: "关于付款的备注..." })}
                          rows={2}
                          className="mt-1"
                        />
                      </div>
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleRecordPayment}
                        disabled={recordPayment.isPending || (!paymentAmount && !paymentAmountIqd) || !paymentMethod}
                      >
                        {recordPayment.isPending ? pickLang(language, { ku: 'چاوەڕوان بە...', en: 'Please wait...', ar: 'يرجى الانتظار...', zh: '请稍候...' }) : pickLang(language, { ku: 'تۆمارکردن', en: 'Record', ar: 'تسجيل', zh: '登记' })}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            
            {/* Customer Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-100">{pickLang(language, { ku: "کڕیارەکان", en: "Customer", ar: "العميل", zh: "客户" })}</p>
                    <p className="font-bold text-white">{customer.customerCode} - {customer.fullName}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-100">{pickLang(language, { ku: "مۆبایل", en: "Mobile", ar: "الهاتف", zh: "手机" })}</p>
                    <p className="font-bold text-white">{customer.mobileNumber}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-100">{pickLang(language, { ku: "بەرواری تۆمارکردن", en: "Registration date", ar: "تاريخ التسجيل", zh: "注册日期" })}</p>
                    <p className="font-bold text-white">{new Date(customer.createdAt).toLocaleDateString('ku-IQ')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl">
                    <Hash className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-100">{pickLang(language, { ku: "ژمارەی حساب", en: "Account number", ar: "رقم الحساب", zh: "账号" })}</p>
                    <p className="font-bold text-white font-mono text-sm">{account?.accountNumber || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Account Info or Create Account */}
        {accountLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : !account ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-emerald-600 dark:text-emerald-300" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{pickLang(language, { ku: "هیچ حسابێک نییە بۆ ئەم کڕیارە", en: "No account exists for this customer", ar: "لا يوجد حساب لهذا العميل", zh: "此客户暂无账户" })}</h3>
              <p className="text-muted-foreground mb-6">{pickLang(language, { ku: "بۆ بەدواداچوونی دارایی، پێویستە حسابێک دروست بکەیت", en: "To track finances, you need to create an account", ar: "لمتابعة الأمور المالية، يجب إنشاء حساب", zh: "若要跟踪财务，需要创建一个账户" })}</p>
              <Button onClick={handleCreateAccount} disabled={getOrCreateAccount.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 me-2" />
                {pickLang(language, { ku: "دروستکردنی حساب", en: "Create account", ar: "إنشاء حساب", zh: "创建账户" })}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Balance Cards */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-4"
            >
              {/* USD Balance */}
              <Card className={cn(
                "overflow-hidden border-0 shadow-lg",
                parseFloat(account.currentBalanceUsd || '0') > 0 
                  ? "bg-gradient-to-br from-red-50 dark:from-red-950/40 to-rose-100 dark:to-rose-900/40" 
                  : "bg-gradient-to-br from-emerald-50 dark:from-emerald-950/40 to-teal-100 dark:to-teal-900/40"
              )}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{pickLang(language, { ku: "باڵانس (USD)", en: "Balance (USD)", ar: "الرصيد (USD)", zh: "余额 (USD)" })}</p>
                      <p className={cn(
                        "text-3xl font-bold",
                        parseFloat(account.currentBalanceUsd || '0') > 0 ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"
                      )}>
                        ${parseFloat(account.currentBalanceUsd || '0').toFixed(2)}
                      </p>
                    </div>
                    <div className={cn(
                      "p-4 rounded-2xl",
                      parseFloat(account.currentBalanceUsd || '0') > 0 ? "bg-red-200/50 dark:bg-red-900/50" : "bg-emerald-200/50 dark:bg-emerald-900/50"
                    )}>
                      <CircleDollarSign className={cn(
                        "w-8 h-8",
                        parseFloat(account.currentBalanceUsd || '0') > 0 ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"
                      )} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              

              
              {/* Account Status */}
              <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-50 dark:from-amber-950/40 to-orange-100 dark:to-orange-900/40">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{pickLang(language, { ku: "بارودۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</p>
                      <Badge 
                        variant={account.accountStatus === 'active' ? 'default' : 'destructive'} 
                        className={cn(
                          "mt-2 text-sm px-3 py-1",
                          account.accountStatus === 'active' 
                            ? "bg-emerald-500 hover:bg-emerald-600" 
                            : ""
                        )}
                      >
                        {account.accountStatus === 'active' ? pickLang(language, { ku: '✓ چالاک', en: '✓ Active', ar: '✓ نشط', zh: '✓ 活跃' }) : pickLang(language, { ku: 'ناچالاک', en: 'Inactive', ar: 'غير نشط', zh: '停用' })}
                      </Badge>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-200/50 dark:bg-amber-900/50">
                      <Activity className="w-8 h-8 text-amber-600 dark:text-amber-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>

            </motion.div>
            
            {/* Debt Breakdown */}
            {breakdown && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                      {pickLang(language, { ku: "شیکاری فرۆشتن", en: "Sales breakdown", ar: "تفصيل المبيعات", zh: "销售明细" })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-800/60">
                        <Package className="w-6 h-6 text-blue-600 dark:text-blue-300 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">{pickLang(language, { ku: "نرخی پاکەتەکان", en: "Package charges", ar: "رسوم الطرود", zh: "包裹费用" })}</p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-300">${breakdown.packageDebt.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-800/60">
                        <ShoppingCart className="w-6 h-6 text-emerald-600 dark:text-emerald-300 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">{pickLang(language, { ku: "نرخی پاکێجی تەواو", en: "Full package charges", ar: "رسوم الحزمة الكاملة", zh: "完整套餐费用" })}</p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300">${breakdown.fullPackageDebt.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-100 dark:border-amber-800/60">
                        <Percent className="w-6 h-6 text-amber-600 dark:text-amber-300 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">{pickLang(language, { ku: "نرخی عموڵە", en: "Commission charges", ar: "رسوم العمولة", zh: "佣金费用" })}</p>
                        <p className="text-lg font-bold text-amber-600 dark:text-amber-300">${breakdown.commissionDebt.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-4 bg-pink-50 dark:bg-pink-950/40 rounded-xl border border-pink-100 dark:border-pink-800/60">
                        <Sparkles className="w-6 h-6 text-pink-600 dark:text-pink-300 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">{pickLang(language, { ku: "نرخی خزمەتگوزاری", en: "Service charges", ar: "رسوم الخدمة", zh: "服务费用" })}</p>
                        <p className="text-lg font-bold text-pink-600 dark:text-pink-300">${breakdown.serviceDebt.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 dark:bg-green-950/40 rounded-xl border border-green-100 dark:border-green-800/60">
                        <Wallet className="w-6 h-6 text-green-600 dark:text-green-300 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">{pickLang(language, { ku: "کۆی پارەدان", en: "Total paid", ar: "إجمالي المدفوع", zh: "已付总额" })}</p>
                        <p className="text-lg font-bold text-green-600 dark:text-green-300">${breakdown.creditBalance.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-100 dark:border-red-800/60">
                        <TrendingUp className="w-6 h-6 text-red-600 dark:text-red-300 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">{pickLang(language, { ku: "کۆی فرۆشتن", en: "Total sales", ar: "إجمالي المبيعات", zh: "销售总额" })}</p>
                        <p className="text-lg font-bold text-red-600 dark:text-red-300">${breakdown.totalDebt.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Pending Orders — orders not yet delivered, no invoice yet */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <CustomerPendingOrdersSection customerId={customerId} />
            </motion.div>

            {/* Transactions & Payments Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Tabs defaultValue="transactions">
                <TabsList className="bg-muted/50 p-1 rounded-xl">
                  <TabsTrigger value="transactions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    {pickLang(language, { ku: "هەموو مامەڵەکان", en: "All transactions", ar: "جميع المعاملات", zh: "全部交易" })}
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    {pickLang(language, { ku: "پارەدانەکان", en: "Payments", ar: "المدفوعات", zh: "付款记录" })}
                  </TabsTrigger>
                  <TabsTrigger value="boxAccounts" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    {pickLang(language, { ku: "حیسابی سندوق", en: "Box accounts", ar: "حسابات الصناديق", zh: "箱子账目" })}
                  </TabsTrigger>
                  <TabsTrigger value="batchInvoices" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    {pickLang(language, { ku: "پسووڵەی باچ", en: "Batch invoices", ar: "فواتير الدفعات", zh: "批次账单" })}
                  </TabsTrigger>
                </TabsList>

                {/* The customer's own invoice, on the office's screen.
                    Same component, same shared rule, same figures — so the
                    person on the phone and the person answering are reading
                    one document rather than two that mostly agree. */}
                {/* The box that reaches their door, in the same shape as the
                    batch it travelled in. */}
                <TabsContent value="boxAccounts" className="mt-4">
                  <AccountRowList
                    language={language}
                    searchable
                    rows={customerBoxes.map((b: any) => ({
                      key: b.id,
                      code: b.boxCode,
                      icon: Boxes,
                      // Whether this box's money has been taken, said on the
                      // row rather than found by reading the ledger below it.
                      // Part paid is its own state and the one most worth
                      // seeing: "Paid $190" on a $200 box is true about the
                      // money and wrong about the box.
                      badge: (() => {
                        const state = boxPaidState(b.settledUsd, b.totalValueUsd);
                        const owed = Number(b.totalValueUsd || 0) - Number(b.settledUsd || 0);
                        if (state === "paid") return {
                          text: pickLang(language, { ku: "واصڵ کراوە", en: "Paid", ar: "مستلم", zh: "已收" }),
                          tone: "paid" as const,
                        };
                        if (state === "partly") return {
                          text: `${pickLang(language, { ku: "ماوە", en: "Owing", ar: "متبقٍ", zh: "尚欠" })} $${owed.toFixed(2)}`,
                          tone: "owed" as const,
                        };
                        return {
                          text: pickLang(language, { ku: "واصڵ نەکراوە", en: "Unpaid", ar: "غير مستلم", zh: "未收" }),
                          tone: "owed" as const,
                        };
                      })(),
                      meta: [
                        b.deliveredAt ? new Date(b.deliveredAt).toLocaleDateString() : null,
                        `${b.totalPackages ?? 0} ${pickLang(language, { ku: "بەرید", en: "parcels", ar: "طرود", zh: "件" })}`,
                        Number(b.totalWeightKg) > 0 ? `${Number(b.totalWeightKg)} kg` : null,
                        b.destinationCity || null,
                        // The receipt handed over, so a customer holding a
                        // printed slip can be matched to a row here.
                        b.settlementNumber || null,
                        Number(b.settledDiscountUsd) > 0
                          ? `${pickLang(language, { ku: "داشکاندن", en: "Discount", ar: "خصم", zh: "折扣" })} $${Number(b.settledDiscountUsd).toFixed(2)}`
                          : null,
                      ].filter(Boolean).join(" · "),
                    }))}
                    openKey={invoiceBoxId}
                    onToggle={setInvoiceBoxId}
                    emptyText={pickLang(language, { ku: "ئەم کڕیارە هیچ سندوقێکی نییە", en: "This customer has no boxes", ar: "لا توجد صناديق لهذا العميل", zh: "该客户没有箱子" })}
                    renderExpanded={() =>
                      officeBoxInvoice ? (
                        <BoxInvoiceView
                          invoice={officeBoxInvoice.invoice}
                          boxCode={officeBoxInvoice.box.boxCode}
                          destination={officeBoxInvoice.box.destinationCity}
                          deliveredAt={officeBoxInvoice.box.deliveredAt}
                          language={language}
                          onPrint={() => window.print()}
                        />
                      ) : (
                        <Skeleton className="h-40 w-full" />
                      )
                    }
                  />
                </TabsContent>
                <TabsContent value="batchInvoices" className="mt-4 space-y-3">
                  {customerBatches.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      {pickLang(language, { ku: "ئەم کڕیارە لە هیچ باچێکدا نییە", en: "This customer is in no batch", ar: "هذا العميل ليس في أي دفعة", zh: "该客户不在任何批次中" })}
                    </p>
                  ) : (
                    <>
                      <AccountRowList
                        language={language}
                        searchable
                        rows={customerBatches.map((b: any) => ({
                          key: b.id,
                          code: b.batchCode,
                          icon: b.shippingType === "sea" ? Ship : Plane,
                          meta: rowMeta(
                            b,
                            Number(b.myPackageCount ?? b.packageCount ?? 0),
                            { weightKg: Number(b.myWeightKg ?? 0), volumeCbm: Number(b.myVolumeCbm ?? 0) },
                            (d: Date | string) => new Date(d).toLocaleDateString(),
                            {
                              parcels: pickLang(language, { ku: "بەرید", en: "parcels", ar: "طرود", zh: "件" }),
                              kg: "kg",
                              cbm: "cbm",
                            },
                          ),
                        }))}
                        openKey={invoiceBatchId}
                        onToggle={setInvoiceBatchId}
                        renderExpanded={() =>
                          officeInvoice ? (
                            <BatchInvoiceView
                              invoice={officeInvoice.invoice}
                              batchCode={officeInvoice.batch.batchCode}
                              shippingType={officeInvoice.batch.shippingType}
                              arrivedAt={officeInvoice.batch.actualArrival}
                              language={language}
                              customerLabel={officeInvoice.customer?.customerCode ?? null}
                              onPrint={() => window.print()}
                            />
                          ) : (
                            <Skeleton className="h-40 w-full" />
                          )
                        }
                      />
                    </>
                  )}
                </TabsContent>
                
                <TabsContent value="transactions" className="mt-4">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
                          {pickLang(language, { ku: "داهاتی کڕیار", en: "Customer ledger", ar: "سجل العميل", zh: "客户账目" })}
                          {filteredTransactions && (
                            <Badge variant="secondary" className="me-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                              {filteredTransactions.length}
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Type Filter */}
                          <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-muted-foreground" />
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                              <SelectTrigger className="w-[180px] rounded-xl">
                                <SelectValue placeholder={pickLang(language, { ku: "فلتەر", en: "Filter", ar: "تصفية", zh: "筛选" })} />
                              </SelectTrigger>
                              <SelectContent>
                                {transactionTypeOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {/* Export Buttons */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={exportToExcel}
                              className="gap-1 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                              Excel
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={exportToPDF}
                              className="gap-1 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                            >
                              <FileText className="w-4 h-4" />
                              PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {transactionsLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Skeleton key={i} className="h-16 rounded-lg" />
                          ))}
                        </div>
                      ) : !filteredTransactions || filteredTransactions.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <Receipt className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <p className="text-muted-foreground">{pickLang(language, { ku: "هیچ جوڵەیەک نییە", en: "No transactions", ar: "لا توجد حركات", zh: "暂无交易" })}</p>
                        </div>
                      ) : (
                        <div className="rounded-xl border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "ژمارە", en: "Number", ar: "الرقم", zh: "编号" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "جۆر", en: "Type", ar: "النوع", zh: "类型" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "بڕی USD", en: "Amount USD", ar: "المبلغ USD", zh: "金额 USD" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "باڵانس دوای", en: "Balance after", ar: "الرصيد بعد", zh: "之后余额" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "وەسف", en: "Description", ar: "الوصف", zh: "描述" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "کردارەکان", en: "Actions", ar: "الإجراءات", zh: "操作" })}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {ledgerGroups.map((group) => {
                                // Standalone row — manual credits, refunds, advance
                                // payments not yet linked, etc. invoiceId is null,
                                // nothing to group under.
                                if (group.kind === 'standalone') {
                                  const txn = group.row;
                                  return (
                                    <TableRow
                                      key={group.key}
                                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                                      onClick={() => openTransactionDetails(txn)}
                                    >
                                      <TableCell className="font-mono text-sm text-muted-foreground">
                                        {txn.transactionNumber}
                                      </TableCell>
                                      <TableCell>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "gap-1 font-normal",
                                            txn.transactionType.startsWith('DEBIT')
                                              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60"
                                              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                                          )}
                                        >
                                          {getTransactionTypeIcon(txn.transactionType)}
                                          {getTransactionTypeLabel(txn.transactionType)}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className={cn(
                                        "font-semibold",
                                        txn.transactionType.startsWith('DEBIT') ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"
                                      )}>
                                        {txn.transactionType.startsWith('DEBIT') ? '+' : '-'}${parseFloat(txn.amountUsd || '0').toFixed(2)}
                                      </TableCell>
                                      <TableCell className="font-semibold">
                                        ${parseFloat(txn.balanceAfterUsd || '0').toFixed(2)}
                                      </TableCell>
                                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                                        {txn.description || '-'}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground text-sm">
                                        {new Date(txn.createdAt).toLocaleDateString('ku-IQ')}
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 rounded-lg hover:bg-emerald-100"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openTransactionDetails(txn);
                                          }}
                                        >
                                          <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                }

                                // Invoice group with a single transaction — render
                                // as a flat row, no toggle (avoids "expand to see
                                // 1 thing" noise).
                                if (group.rows.length === 1) {
                                  const txn = group.rows[0];
                                  return (
                                    <TableRow
                                      key={group.key}
                                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                                      onClick={() => openTransactionDetails(txn)}
                                    >
                                      <TableCell className="font-mono text-sm text-muted-foreground">
                                        {txn.transactionNumber}
                                      </TableCell>
                                      <TableCell>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "gap-1 font-normal",
                                            txn.transactionType.startsWith('DEBIT')
                                              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60"
                                              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                                          )}
                                        >
                                          {getTransactionTypeIcon(txn.transactionType)}
                                          {getTransactionTypeLabel(txn.transactionType)}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className={cn(
                                        "font-semibold",
                                        txn.transactionType.startsWith('DEBIT') ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"
                                      )}>
                                        {txn.transactionType.startsWith('DEBIT') ? '+' : '-'}${parseFloat(txn.amountUsd || '0').toFixed(2)}
                                      </TableCell>
                                      <TableCell className="font-semibold">
                                        ${parseFloat(txn.balanceAfterUsd || '0').toFixed(2)}
                                      </TableCell>
                                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                                        {txn.description || '-'}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground text-sm">
                                        {new Date(txn.createdAt).toLocaleDateString('ku-IQ')}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-1">
                                          <Link href={`/invoices/${group.invoiceId}`}>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 rounded-lg hover:bg-blue-100"
                                              title={pickLang(language, { ku: "بینینی پسووڵە", en: "View invoice", ar: "عرض الفاتورة", zh: "查看发票" })}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                                            </Button>
                                          </Link>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-lg hover:bg-emerald-100"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openTransactionDetails(txn);
                                            }}
                                          >
                                            <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                }

                                // Multi-transaction invoice group — collapsible.
                                // Header row shows aggregate; clicking toggles the
                                // child rows. Net amount is signed: a batch with
                                // both DEBIT_PACKAGE and a linked CREDIT_PAYMENT
                                // shows the net.
                                const isExpanded = expandedInvoices.has(group.invoiceId);
                                const isNetDebit = group.netAmountUsd >= 0;
                                const absNet = Math.abs(group.netAmountUsd);

                                return (
                                  <Fragment key={group.key}>
                                    <TableRow
                                      className={cn(
                                        "cursor-pointer transition-colors border-l-4",
                                        isExpanded
                                          ? "bg-emerald-50/40 dark:bg-emerald-950/40 hover:bg-emerald-50/60 border-l-emerald-500"
                                          : "hover:bg-muted/30 border-l-transparent"
                                      )}
                                      onClick={() => toggleInvoiceGroup(group.invoiceId)}
                                    >
                                      <TableCell className="font-mono text-sm">
                                        <div className="flex items-center gap-2">
                                          <ChevronDown
                                            className={cn(
                                              "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                                              isExpanded ? "rotate-0" : "-rotate-90"
                                            )}
                                          />
                                          <span className="text-emerald-700 dark:text-emerald-300 font-semibold truncate max-w-[180px]" title={group.invoiceNumber}>
                                            {group.invoiceNumber}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge
                                          variant="outline"
                                          className="gap-1 font-normal bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                                        >
                                          <Layers className="w-3.5 h-3.5" />
                                          {group.rows.length} {pickLang(language, { ku: "جوڵە", en: "transactions", ar: "حركة", zh: "笔" })}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className={cn(
                                        "font-bold text-base",
                                        isNetDebit ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"
                                      )}>
                                        {isNetDebit ? '+' : '-'}${absNet.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="font-semibold">
                                        ${group.balanceAfterUsd.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="max-w-[240px] truncate text-muted-foreground text-sm">
                                        {pickLang(language, { ku: "پسووڵەی کۆکراوە", en: "Grouped invoice", ar: "فاتورة مجمّعة", zh: "合并发票" })} — {group.rows.length} {pickLang(language, { ku: "مامەڵە", en: "transactions", ar: "معاملة", zh: "笔交易" })}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground text-sm">
                                        {group.latestCreatedAt.toLocaleDateString('ku-IQ')}
                                      </TableCell>
                                      <TableCell>
                                        <Link href={`/invoices/${group.invoiceId}`}>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-lg hover:bg-blue-100"
                                            title={pickLang(language, { ku: "بینینی پسووڵە", en: "View invoice", ar: "عرض الفاتورة", zh: "查看发票" })}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                                          </Button>
                                        </Link>
                                      </TableCell>
                                    </TableRow>

                                    {isExpanded && group.rows.map((txn, childIdx) => (
                                      <TableRow
                                        key={`${group.key}-${txn.id}`}
                                        className={cn(
                                          "cursor-pointer transition-colors bg-muted/10 hover:bg-muted/40 border-l-4 border-l-emerald-200",
                                          childIdx === group.rows.length - 1 && "border-b-2 border-b-emerald-100"
                                        )}
                                        onClick={() => openTransactionDetails(txn)}
                                      >
                                        <TableCell className="font-mono text-xs text-muted-foreground ps-8">
                                          <span className="text-muted-foreground/60 me-2">└─</span>
                                          {txn.transactionNumber}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "gap-1 font-normal text-xs",
                                              txn.transactionType.startsWith('DEBIT')
                                                ? "bg-red-50/70 dark:bg-red-950/70 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60"
                                                : "bg-emerald-50/70 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                                            )}
                                          >
                                            {getTransactionTypeIcon(txn.transactionType)}
                                            {getTransactionTypeLabel(txn.transactionType)}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className={cn(
                                          "font-semibold text-sm",
                                          txn.transactionType.startsWith('DEBIT') ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"
                                        )}>
                                          {txn.transactionType.startsWith('DEBIT') ? '+' : '-'}${parseFloat(txn.amountUsd || '0').toFixed(2)}
                                        </TableCell>
                                        <TableCell className="font-medium text-sm">
                                          ${parseFloat(txn.balanceAfterUsd || '0').toFixed(2)}
                                        </TableCell>
                                        <TableCell className="max-w-[240px] truncate text-muted-foreground text-xs">
                                          {txn.description || '-'}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                          {new Date(txn.createdAt).toLocaleDateString('ku-IQ')}
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-lg hover:bg-emerald-100"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openTransactionDetails(txn);
                                            }}
                                          >
                                            <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </Fragment>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="payments" className="mt-4">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
                        {pickLang(language, { ku: "پارەدانەکان", en: "Payments", ar: "المدفوعات", zh: "付款记录" })}
                        {payments && (
                          <Badge variant="secondary" className="me-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                            {payments.length}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!payments || payments.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <CreditCard className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <p className="text-muted-foreground">{pickLang(language, { ku: "هیچ پارەدانێک نییە", en: "No payments", ar: "لا توجد مدفوعات", zh: "暂无付款" })}</p>
                        </div>
                      ) : (
                        <div className="rounded-xl border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "ژمارە", en: "Number", ar: "الرقم", zh: "编号" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "شێواز", en: "Method", ar: "الطريقة", zh: "方式" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "بڕی USD", en: "Amount USD", ar: "المبلغ USD", zh: "金额 USD" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "ژمارەی پسوڵە", en: "Receipt number", ar: "رقم الإيصال", zh: "收据编号" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "تێبینی", en: "Note", ar: "ملاحظة", zh: "备注" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</TableHead>
                                <TableHead className="text-right font-semibold">{pickLang(language, { ku: "کردارەکان", en: "Actions", ar: "الإجراءات", zh: "操作" })}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {payments.map((payment: any) => {
                                const original = parseFloat(payment.amountUsd || '0') || 0;
                                const reversed = parseFloat(payment.reversedAmountUsd || '0') || 0;
                                const remaining = Math.max(0, original - reversed);
                                const isFullyReversed = remaining <= 0.005 && reversed > 0;
                                const isPartiallyReversed = reversed > 0 && !isFullyReversed;
                                return (
                                  <TableRow
                                    key={payment.id}
                                    className={cn(
                                      "hover:bg-muted/30",
                                      isFullyReversed && "opacity-60",
                                    )}
                                  >
                                    <TableCell className="font-mono text-sm text-muted-foreground">
                                      {payment.paymentNumber}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60">
                                        {getPaymentMethodLabel(payment.paymentMethod)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className={cn(
                                      "font-semibold",
                                      isFullyReversed ? "text-muted-foreground line-through" : "text-emerald-600 dark:text-emerald-300"
                                    )}>
                                      ${original.toFixed(2)}
                                      {isPartiallyReversed && (
                                        <span className="block text-xs text-amber-700 dark:text-amber-300 font-normal">
                                          ({pickLang(language, { ku: "ماوە", en: "remaining", ar: "المتبقي", zh: "剩余" })}: ${remaining.toFixed(2)})
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {isFullyReversed ? (
                                        <Badge variant="outline" className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60 gap-1">
                                          <RotateCcw className="w-3 h-3" /> {pickLang(language, { ku: "گەڕێنراوەتەوە", en: "Reversed", ar: "معكوسة", zh: "已撤销" })}
                                        </Badge>
                                      ) : isPartiallyReversed ? (
                                        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 gap-1">
                                          <RotateCcw className="w-3 h-3" /> {pickLang(language, { ku: "بە بەشێ", en: "Partial", ar: "جزئية", zh: "部分" })}
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 gap-1">
                                          <CheckCircle className="w-3 h-3" /> {pickLang(language, { ku: "چالاک", en: "Active", ar: "نشطة", zh: "有效" })}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                      {payment.receiptNumber || '-'}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                                      {payment.notes || '-'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                      {new Date(payment.createdAt).toLocaleDateString('ku-IQ')}
                                    </TableCell>
                                    <TableCell>
                                      {!isFullyReversed && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-3 rounded-lg hover:bg-amber-100 hover:text-amber-700 gap-1"
                                          onClick={() => openReverseDialog(payment)}
                                          title={pickLang(language, { ku: "گەڕاندنەوە یاخود Refund", en: "Reverse or refund", ar: "عكس أو استرداد", zh: "撤销或退款" })}
                                        >
                                          <RotateCcw className="w-4 h-4" />
                                          <span className="text-xs">{pickLang(language, { ku: "گەڕاندنەوە", en: "Reverse", ar: "عكس", zh: "撤销" })}</span>
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </>
        )}
      </div>
      
      {/* Manual Balance Adjustment Dialog
          Last-resort tool for orphaned balances where the payment record
          was hard-deleted before the reverse/refund flow existed. Posts
          an ADJUSTMENT_DEBIT/CREDIT directly to the ledger with a
          mandatory reason. The header button pre-fills the form with the
          exact amount + direction needed to zero the balance, but staff
          can edit either field for partial corrections. */}
      <Dialog open={adjustDialogOpen} onOpenChange={(open) => {
        setAdjustDialogOpen(open);
        if (!open) {
          setAdjustAmount("");
          setAdjustReason("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600 dark:text-purple-300" />
              {pickLang(language, { ku: "ڕاستکردنەوەی بالانس بە دەستی", en: "Manual balance adjustment", ar: "تعديل الرصيد يدويًا", zh: "手动调整余额" })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Warning banner — this tool is for emergencies only */}
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">{pickLang(language, { ku: "ئاگاداربە:", en: "Warning:", ar: "تنبيه:", zh: "注意：" })}</p>
                <p>{pickLang(language, { ku: "ئەم ئامرازە تەنها بۆ دۆخە تایبەتییەکانە (بۆ نمونە: تۆماری پارەدان لابراوە بەڵام بالانس ماوە). ئەگەر paymentRecord هەنووکە هەیە، بەکارهێنانی «ریفاوند» باشترە — context ـی زیاتر دەپارێزێت.", en: "This tool is only for special cases (e.g. the payment record was deleted but a balance remains). If the paymentRecord still exists, using \"Refund\" is better — it preserves more context.", ar: "هذه الأداة مخصصة للحالات الخاصة فقط (مثال: تم حذف سجل الدفعة لكن بقي رصيد). إذا كان سجل الدفعة لا يزال موجودًا، فإن استخدام «الاسترداد» أفضل — لأنه يحافظ على سياق أكثر.", zh: "此工具仅用于特殊情况（例如：付款记录已删除但余额仍存在）。如果付款记录仍然存在，使用\"退款\"更好——可保留更多上下文。" })}</p>
              </div>
            </div>

            {/* Balance preview: current → new */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-muted/40 border text-center">
                <div className="text-[10px] text-muted-foreground uppercase">{pickLang(language, { ku: "بالانسی ئێستا", en: "Current balance", ar: "الرصيد الحالي", zh: "当前余额" })}</div>
                <div className={cn(
                  "font-mono font-bold text-lg mt-1",
                  parseFloat(account?.currentBalanceUsd || '0') > 0 ? "text-red-600 dark:text-red-300"
                    : parseFloat(account?.currentBalanceUsd || '0') < 0 ? "text-emerald-600 dark:text-emerald-300"
                    : "text-muted-foreground"
                )}>
                  ${parseFloat(account?.currentBalanceUsd || '0').toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/40 border-2 border-purple-200 dark:border-purple-800/60 text-center">
                <div className="text-[10px] text-purple-700 dark:text-purple-300 uppercase">{pickLang(language, { ku: "بالانس دوای ڕاستکردنەوە", en: "Balance after adjustment", ar: "الرصيد بعد التعديل", zh: "调整后余额" })}</div>
                <div className={cn(
                  "font-mono font-bold text-lg mt-1",
                  adjustPreviewBalance > 0 ? "text-red-600"
                    : adjustPreviewBalance < 0 ? "text-emerald-600"
                    : "text-purple-700 dark:text-purple-300"
                )}>
                  ${adjustPreviewBalance.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Direction selector */}
            <div>
              <Label className="text-sm">{pickLang(language, { ku: "ئاراستە", en: "Direction", ar: "الاتجاه", zh: "方向" })}</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setAdjustDirection('debit')}
                  className={cn(
                    "p-3 rounded-lg border-2 text-sm transition-all text-right",
                    adjustDirection === 'debit'
                      ? "border-red-500 bg-red-50 dark:bg-red-950/40 shadow"
                      : "border-muted hover:border-red-300"
                  )}
                >
                  <div className="font-bold flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-red-600 dark:text-red-300" />
                    DEBIT (+)
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {pickLang(language, { ku: "بالانس بەرز دەکاتەوە (سڕینەوەی credit)", en: "Increases the balance (removes credit)", ar: "يزيد الرصيد (إزالة دائن)", zh: "增加余额（消除贷项）" })}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustDirection('credit')}
                  className={cn(
                    "p-3 rounded-lg border-2 text-sm transition-all text-right",
                    adjustDirection === 'credit'
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow"
                      : "border-muted hover:border-emerald-300"
                  )}
                >
                  <div className="font-bold flex items-center gap-1">
                    <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                    CREDIT (−)
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {pickLang(language, { ku: "بالانس کەم دەکاتەوە (سڕینەوەی قەرز)", en: "Decreases the balance (removes debt)", ar: "يقلل الرصيد (إزالة دين)", zh: "减少余额（消除欠款）" })}
                  </div>
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <Label className="text-sm">{pickLang(language, { ku: "بڕ (USD)", en: "Amount (USD)", ar: "المبلغ (USD)", zh: "金额 (USD)" })}</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 font-mono"
              />
            </div>

            {/* Reason — required */}
            <div>
              <Label className="text-sm">
                {pickLang(language, { ku: "هۆکار", en: "Reason", ar: "السبب", zh: "原因" })} <span className="text-red-500 dark:text-red-400">*</span>
              </Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder={pickLang(language, { ku: "بۆ نمونە: تۆماری پارەدانێکی هەڵە لاسرابوو بەڵام بالانس مابوو...", en: "e.g. an erroneous payment record was deleted but the balance remained...", ar: "مثال: تم حذف سجل دفعة خاطئ لكن بقي الرصيد...", zh: "例如：错误的付款记录已被删除但余额仍存在..." })}
                rows={3}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {pickLang(language, { ku: "لانیکەم ٥ پیت. لە audit log و سەر ledger دەنوسرێت.", en: "At least 5 characters. Recorded in the audit log and on the ledger.", ar: "5 أحرف على الأقل. يُسجَّل في سجل التدقيق وعلى دفتر الأستاذ.", zh: "至少5个字符。将记录在审计日志和账目中。" })}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAdjustDialogOpen(false)}
                disabled={adjustBalance.isPending}
              >
                {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                onClick={handleSubmitAdjust}
                disabled={adjustBalance.isPending}
              >
                {adjustBalance.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : pickLang(language, { ku: "ڕاستکردنەوە", en: "Adjust", ar: "تعديل", zh: "调整" })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reverse / Refund Payment Dialog
          Two modes share one form:
            - 'mistake' calls trpc.ledger.reversePayment — ledger-only undo,
              cashbox is NOT touched (because no cash physically moved).
            - 'refund'  calls trpc.ledger.refundPayment   — same ledger
              undo PLUS deducts the chosen cashbox (real cash going back).
          The amount input lets staff do partial reversals; the badge on
          the payments row shows partial state on subsequent visits. */}
      <Dialog open={reverseDialogOpen} onOpenChange={(open) => {
        setReverseDialogOpen(open);
        if (!open) {
          setReverseTargetPayment(null);
          setReverseAmount("");
          setReverseReason("");
          setReverseCashAccountId("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-300" />
              {pickLang(language, { ku: "گەڕاندنەوەی پارەدان", en: "Reverse payment", ar: "عكس الدفعة", zh: "撤销付款" })}
            </DialogTitle>
          </DialogHeader>

          {/* Picker step — shown only when the dialog is opened from the
              top-level "ریفاوند" button (no payment pre-selected). Lists
              every payment that still has remaining un-reversed amount;
              clicking one transitions the dialog into the form step. The
              per-row "گەڕاندنەوە" button skips this step entirely. */}
          {!reverseTargetPayment && (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                {pickLang(language, { ku: "پارەدانێک هەڵبژێرە بۆ گەڕاندنەوە یاخود ریفاوند:", en: "Select a payment to reverse or refund:", ar: "اختر دفعة للعكس أو الاسترداد:", zh: "选择要撤销或退款的付款：" })}
              </p>
              {!payments || payments.length === 0 ? (
                <div className="p-6 text-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  {pickLang(language, { ku: "هیچ پارەدانێکی تۆمارکراو نییە.", en: "No recorded payments.", ar: "لا توجد مدفوعات مسجلة.", zh: "暂无已登记的付款。" })}
                </div>
              ) : (() => {
                const reversible = (payments as any[]).filter((p) => {
                  const orig = parseFloat(p.amountUsd || '0') || 0;
                  const rev = parseFloat(p.reversedAmountUsd || '0') || 0;
                  return orig - rev > 0.005;
                });
                if (reversible.length === 0) {
                  return (
                    <div className="p-6 text-center rounded-lg border border-dashed text-sm text-muted-foreground">
                      {pickLang(language, { ku: "هەموو پارەدانەکان پێشتر گەڕێنراونەتەوە.", en: "All payments have already been reversed.", ar: "تم عكس جميع المدفوعات مسبقًا.", zh: "所有付款均已被撤销。" })}
                    </div>
                  );
                }
                return (
                  <div className="max-h-80 overflow-y-auto rounded-lg border divide-y">
                    {reversible.map((p) => {
                      const orig = parseFloat(p.amountUsd || '0') || 0;
                      const rev = parseFloat(p.reversedAmountUsd || '0') || 0;
                      const remaining = orig - rev;
                      const isPartial = rev > 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => openReverseDialog(p)}
                          className="w-full p-3 text-right hover:bg-amber-50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground truncate">
                                {p.paymentNumber}
                              </span>
                              <Badge variant="outline" className="text-[10px] py-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60">
                                {getPaymentMethodLabel(p.paymentMethod)}
                              </Badge>
                              {isPartial && (
                                <Badge variant="outline" className="text-[10px] py-0 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60">
                                  {pickLang(language, { ku: "بە بەشێ", en: "Partial", ar: "جزئية", zh: "部分" })}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {new Date(p.createdAt).toLocaleDateString('ku-IQ')}
                              {p.notes ? ` • ${p.notes}` : ''}
                            </div>
                          </div>
                          <div className="text-end shrink-0">
                            <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                              ${remaining.toFixed(2)}
                            </div>
                            {isPartial && (
                              <div className="text-[10px] text-muted-foreground">
                                {pickLang(language, { ku: "لە کۆی", en: "of", ar: "من إجمالي", zh: "共" })} ${orig.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setReverseDialogOpen(false)}
              >
                {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
              </Button>
            </div>
          )}

          {reverseTargetPayment && (
            <div className="space-y-4 mt-2">
              {/* Payment summary */}
              <div className="p-3 rounded-lg bg-muted/40 border text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{pickLang(language, { ku: "ژمارە:", en: "Number:", ar: "الرقم:", zh: "编号：" })}</span>
                  <span className="font-mono">{reverseTargetPayment.paymentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{pickLang(language, { ku: "بڕی پارەدان:", en: "Payment amount:", ar: "مبلغ الدفعة:", zh: "付款金额：" })}</span>
                  <span className="font-bold">${parseFloat(reverseTargetPayment.amountUsd || '0').toFixed(2)}</span>
                </div>
                {parseFloat(reverseTargetPayment.reversedAmountUsd || '0') > 0 && (
                  <div className="flex justify-between text-amber-700 dark:text-amber-300">
                    <span>{pickLang(language, { ku: "پێشتر گەڕێنراوەتەوە:", en: "Already reversed:", ar: "تم عكسه مسبقًا:", zh: "已撤销：" })}</span>
                    <span className="font-bold">${parseFloat(reverseTargetPayment.reversedAmountUsd || '0').toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-muted-foreground">{pickLang(language, { ku: "ماوە بۆ گەڕاندنەوە:", en: "Remaining to reverse:", ar: "المتبقي للعكس:", zh: "可撤销余额：" })}</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">${reverseRemainingUsd.toFixed(2)}</span>
                </div>
              </div>

              {/* Mode selector */}
              <div>
                <Label className="text-sm">{pickLang(language, { ku: "جۆری گەڕاندنەوە", en: "Reversal type", ar: "نوع العكس", zh: "撤销类型" })}</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setReverseMode('mistake')}
                    className={cn(
                      "p-3 rounded-lg border-2 text-sm transition-all text-right",
                      reverseMode === 'mistake'
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40 shadow"
                        : "border-muted hover:border-amber-300"
                    )}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                      {pickLang(language, { ku: "هەڵە", en: "Mistake", ar: "خطأ", zh: "错误" })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pickLang(language, { ku: "پارە بە هەڵە تۆمارکراوە. کاش وەرنەگیراوە.", en: "Payment was recorded by mistake. No cash was received.", ar: "تم تسجيل الدفعة عن طريق الخطأ. لم يُستلم نقد.", zh: "付款被错误登记。未收到现金。" })}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReverseMode('refund')}
                    className={cn(
                      "p-3 rounded-lg border-2 text-sm transition-all text-right",
                      reverseMode === 'refund'
                        ? "border-red-500 bg-red-50 dark:bg-red-950/40 shadow"
                        : "border-muted hover:border-red-300"
                    )}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <Banknote className="w-4 h-4 text-red-600 dark:text-red-300" />
                      Refund
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pickLang(language, { ku: "پارە بە کریار دەگەڕێتەوە. لە کاش کەم دەبیت.", en: "Money is returned to the customer. It is deducted from the cashbox.", ar: "تُعاد الأموال إلى العميل. تُخصم من الصندوق.", zh: "款项退还给客户。将从现金箱中扣除。" })}
                    </div>
                  </button>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <Label className="text-sm">{pickLang(language, { ku: "بڕ (USD)", en: "Amount (USD)", ar: "المبلغ (USD)", zh: "金额 (USD)" })}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={reverseRemainingUsd}
                  value={reverseAmount}
                  onChange={(e) => setReverseAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {pickLang(language, { ku: "هەرە زۆر", en: "Maximum", ar: "الحد الأقصى", zh: "最多" })}: ${reverseRemainingUsd.toFixed(2)}
                </p>
              </div>

              {/* Cash account selector — only for refund */}
              {reverseMode === 'refund' && (
                <div>
                  <Label className="text-sm">{pickLang(language, { ku: "حسابی نقدی (کاش لێی دەردەچێت)", en: "Cash account (cash exits from it)", ar: "حساب نقدي (يخرج منه النقد)", zh: "现金账户（从中扣款）" })}</Label>
                  <Popover modal={true}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="mt-1 w-full justify-between font-normal">
                        {reverseCashAccountId && reverseCashAccountId !== 'none'
                          ? (() => {
                              const acc = activeCashAccounts?.find(a => a.id.toString() === reverseCashAccountId);
                              return acc ? `${acc.accountNameKu || acc.accountName} ($${Number(acc.currentBalance).toLocaleString()})` : pickLang(language, { ku: "حسابێک هەڵبژێرە", en: "Select an account", ar: "اختر حسابًا", zh: "选择账户" });
                            })()
                          : pickLang(language, { ku: "حسابێک هەڵبژێرە", en: "Select an account", ar: "اختر حسابًا", zh: "选择账户" })}
                        <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent variant="panel" className="w-full min-w-[320px]" align="start">
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            {activeCashAccounts?.map((acc) => (
                              <CommandItem
                                key={acc.id}
                                onSelect={() => setReverseCashAccountId(acc.id.toString())}
                                className="cursor-pointer"
                              >
                                <Check className={`me-2 h-4 w-4 ${reverseCashAccountId === acc.id.toString() ? 'opacity-100' : 'opacity-0'}`} />
                                <div className="flex items-center gap-2">
                                  <Landmark className="h-4 w-4 text-muted-foreground" />
                                  <span>{acc.accountNameKu || acc.accountName}</span>
                                  <Badge variant="secondary" className="text-xs">${Number(acc.currentBalance).toLocaleString()}</Badge>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Reason — required */}
              <div>
                <Label className="text-sm">
                  {pickLang(language, { ku: "هۆکار", en: "Reason", ar: "السبب", zh: "原因" })} <span className="text-red-500 dark:text-red-400">*</span>
                </Label>
                <Textarea
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder={pickLang(language, { ku: "بۆ نمونە: تایپی هەڵە، کریاری هەڵە، کریار داوای پارەکەی کردووە...", en: "e.g. typing error, wrong customer, customer requested their money back...", ar: "مثال: خطأ في الإدخال، عميل خاطئ، طلب العميل استرداد أمواله...", zh: "例如：输入错误、客户错误、客户要求退款..." })}
                  rows={3}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {pickLang(language, { ku: "لانیکەم ٥ پیت. ئەم هۆکارە لە audit log و بەسەر invoice دەنوسرێت.", en: "At least 5 characters. This reason is recorded in the audit log and on the invoice.", ar: "5 أحرف على الأقل. يُسجَّل هذا السبب في سجل التدقيق وعلى الفاتورة.", zh: "至少5个字符。此原因将记录在审计日志和发票上。" })}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setReverseDialogOpen(false)}
                  disabled={reversePayment.isPending || refundPayment.isPending}
                >
                  {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
                </Button>
                <Button
                  className={cn(
                    "flex-1",
                    reverseMode === 'mistake'
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-red-600 hover:bg-red-700"
                  )}
                  onClick={handleSubmitReverse}
                  disabled={reversePayment.isPending || refundPayment.isPending}
                >
                  {(reversePayment.isPending || refundPayment.isPending)
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : reverseMode === 'mistake' ? pickLang(language, { ku: "گەڕاندنەوە", en: "Reverse", ar: "عكس", zh: "撤销" }) : "Refund"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
              {pickLang(language, { ku: "وردەکاری جوڵە", en: "Transaction details", ar: "تفاصيل الحركة", zh: "交易详情" })}
            </DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4 mt-4">
              <div className={cn(
                "p-4 rounded-xl border",
                getTransactionTypeBgColor(selectedTransaction.transactionType)
              )}>
                <div className="flex items-center justify-between mb-4">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "gap-1",
                      selectedTransaction.transactionType.startsWith('DEBIT') 
                        ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60" 
                        : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                    )}
                  >
                    {getTransactionTypeIcon(selectedTransaction.transactionType)}
                    {getTransactionTypeLabel(selectedTransaction.transactionType)}
                  </Badge>
                  <span className="text-sm text-muted-foreground font-mono">
                    {selectedTransaction.transactionNumber}
                  </span>
                </div>
                <div className="text-center">
                  <p className={cn(
                    "text-4xl font-bold",
                    selectedTransaction.transactionType.startsWith('DEBIT') ? "text-red-600 dark:text-red-300" : "text-emerald-600 dark:text-emerald-300"
                  )}>
                    {selectedTransaction.transactionType.startsWith('DEBIT') ? '+' : '-'}${parseFloat(selectedTransaction.amountUsd || '0').toFixed(2)}
                  </p>

                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">{pickLang(language, { ku: "باڵانس پێش", en: "Balance before", ar: "الرصيد قبل", zh: "之前余额" })}</span>
                  <span className="font-semibold">${parseFloat(selectedTransaction.balanceBeforeUsd || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">{pickLang(language, { ku: "باڵانس دوای", en: "Balance after", ar: "الرصيد بعد", zh: "之后余额" })}</span>
                  <span className="font-semibold">${parseFloat(selectedTransaction.balanceAfterUsd || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">{pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</span>
                  <span className="font-semibold">{new Date(selectedTransaction.createdAt).toLocaleString('ku-IQ')}</span>
                </div>
                {selectedTransaction.description && (
                  <div className="py-2">
                    <span className="text-muted-foreground block mb-1">{pickLang(language, { ku: "وەسف", en: "Description", ar: "الوصف", zh: "描述" })}</span>
                    <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedTransaction.description}</p>
                  </div>
                )}
              </div>
              
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => setDetailsDialogOpen(false)}
              >
                {pickLang(language, { ku: "داخستن", en: "Close", ar: "إغلاق", zh: "关闭" })}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
