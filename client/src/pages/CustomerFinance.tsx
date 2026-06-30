import { useState, useMemo, Fragment } from "react";
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
} from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function CustomerFinance() {
  const { t } = useTranslation();
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
      toast.success("پارەدان بە سەرکەوتوویی گەڕێنرایەوە");
      refreshAfterReversal();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const refundPayment = trpc.ledger.refundPayment.useMutation({
    onSuccess: () => {
      toast.success("Refund بە سەرکەوتوویی جێبەجێکرا");
      refreshAfterReversal();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const adjustBalance = trpc.ledger.adjustBalance.useMutation({
    onSuccess: () => {
      toast.success("بالانس بە سەرکەوتوویی ڕاستکرایەوە");
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
      toast.info("بالانس پێشتر سفرە");
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
      toast.error("هۆکار پێویستە لانیکەم ٥ پیت بێت");
      return;
    }
    const amount = parseFloat(adjustAmount) || 0;
    if (amount <= 0) {
      toast.error("بڕ پێویستە لە سفر زیاتر بێت");
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
      toast.error("هۆکار پێویستە لانیکەم ٥ پیت بێت");
      return;
    }
    const amount = parseFloat(reverseAmount) || 0;
    if (amount <= 0) {
      toast.error("بڕی گەڕاندنەوە پێویستە لە سفر زیاتر بێت");
      return;
    }
    if (amount > reverseRemainingUsd + 0.005) {
      toast.error(`بڕی داواکراو ($${amount.toFixed(2)}) لە ماوە ($${reverseRemainingUsd.toFixed(2)}) زیاترە`);
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
        toast.error("تکایە حسابێکی نقدی هەڵبژێرە بۆ Refund");
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
    if (type.startsWith('DEBIT')) return 'bg-red-50 border-red-100';
    if (type.startsWith('CREDIT')) return 'bg-emerald-50 border-emerald-100';
    return 'bg-gray-50 border-gray-100';
  };
  
  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'DEBIT_PACKAGE': 'نرخی پاکەت',
      'DEBIT_FULL_PACKAGE': 'پاکێجی تەواو',
      'DEBIT_PURCHASE_REQUEST': 'داواکاری کڕین',
      'DEBIT_COMMISSION': 'عمولە',
      'DEBIT_SERVICE': 'خزمەتگوزاری',
      'DEBIT_PENALTY': 'سزا',
      'DEBIT_OTHER': 'قەرزی تر',
      'CREDIT_PAYMENT': 'پارەدان',
      'CREDIT_DEPOSIT': 'پارە دانان',
      'CREDIT_REFUND': 'گەڕاندنەوە',
      'CREDIT_DISCOUNT': 'داشکاندن',
      'CREDIT_OTHER': 'دراوی تر',
      'ADJUSTMENT_DEBIT': 'ڕێکخستنی قەرز',
      'ADJUSTMENT_CREDIT': 'ڕێکخستنی دراو',
    };
    return labels[type] || type;
  };
  
  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'CASH': 'کاش',
      'BANK_TRANSFER': 'گواستنەوەی بانکی',
      'FIB': 'FIB',
      'FASTPAY': 'FastPay',
      'ZAINCASH': 'ZainCash',
      'ASIAHAWALA': 'Asia Hawala',
      'CARD': 'کارت',
      'OTHER': 'شێوازی تر',
    };
    return labels[method] || method;
  };

  // Transaction type options for filter
  const transactionTypeOptions = [
    { value: 'all', label: 'هەموو' },
    { value: 'DEBIT_PACKAGE', label: 'نرخی پاکەت' },
    { value: 'DEBIT_FULL_PACKAGE', label: 'پاکێجی تەواو' },
    { value: 'DEBIT_COMMISSION', label: 'عمولە' },
    { value: 'DEBIT_SERVICE', label: 'خزمەتگوزاری' },
    { value: 'CREDIT_PAYMENT', label: 'پارەدان' },
    { value: 'CREDIT_DEPOSIT', label: 'پارە دانان' },
    { value: 'CREDIT_REFUND', label: 'گەڕاندنەوە' },
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
        <title>ڕاپۆرتی دارایی - ${customer?.customerCode}</title>
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
              <div class="report-title">ڕاپۆرتی دارایی کڕیار</div>
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
                <div class="customer-label">کۆدی کڕیار</div>
                <div class="customer-value">${customer?.customerCode || '-'}</div>
              </div>
              <div class="customer-item">
                <div class="customer-label">ناوی کڕیار</div>
                <div class="customer-value">${customer?.fullName || '-'}</div>
              </div>
              <div class="customer-item">
                <div class="customer-label">ژمارەی مۆبایل</div>
                <div class="customer-value">${customer?.mobileNumber || '-'}</div>
              </div>
              <div class="customer-item">
                <div class="customer-label">بەرواری تۆمارکردن</div>
                <div class="customer-value">${customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString('ku-IQ') : '-'}</div>
              </div>
            </div>
          </div>
          
          <!-- Balance Summary -->
          <div class="balance-section">
            <div class="section-title">باڵانسی حساب</div>
            <div class="balance-grid">
              <div class="balance-card usd">
                <div class="balance-label">باڵانس (USD)</div>
                <div class="balance-value">$${parseFloat(account?.currentBalanceUsd || '0').toFixed(2)}</div>
              </div>

              <div class="balance-card status">
                <div class="balance-label">دۆخی حساب</div>
                <div class="balance-value">${account?.accountStatus === 'active' ? '✓ چالاک' : 'ناچالاک'}</div>
              </div>
            </div>
          </div>
          
          <!-- Debt Breakdown -->
          ${breakdown ? `
          <div class="breakdown-section">
            <div class="section-title">شیکاری فرۆشتن</div>
            <div class="breakdown-grid">
              <div class="breakdown-card package">
                <div class="breakdown-label">نرخی پاکەتەکان</div>
                <div class="breakdown-value">$${breakdown.packageDebt.toFixed(2)}</div>
              </div>
              <div class="breakdown-card fullpackage">
                <div class="breakdown-label">نرخی پاکێجی تەواو</div>
                <div class="breakdown-value">$${breakdown.fullPackageDebt.toFixed(2)}</div>
              </div>
              <div class="breakdown-card commission">
                <div class="breakdown-label">نرخی عموڵە</div>
                <div class="breakdown-value">$${breakdown.commissionDebt.toFixed(2)}</div>
              </div>
              <div class="breakdown-card service">
                <div class="breakdown-label">نرخی خزمەتگوزاری</div>
                <div class="breakdown-value">$${breakdown.serviceDebt.toFixed(2)}</div>
              </div>
              <div class="breakdown-card credit">
                <div class="breakdown-label">کۆی پارەدان</div>
                <div class="breakdown-value">$${breakdown.creditBalance.toFixed(2)}</div>
              </div>
              <div class="breakdown-card total">
                <div class="breakdown-label">کۆی فرۆشتن</div>
                <div class="breakdown-value">$${breakdown.totalDebt.toFixed(2)}</div>
              </div>
            </div>
            <div class="summary-row">
              <div class="summary-item">
                <div class="summary-label">کۆی فرۆشتن</div>
                <div class="summary-value debit">$${totalDebit.toFixed(2)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">کۆی پارەدانەکان</div>
                <div class="summary-value credit">$${totalCredit.toFixed(2)}</div>
              </div>

            </div>
          </div>
          ` : ''}
          
          <!-- Transactions Table -->
          <div class="transactions-section">
            <div class="section-title">لیستی جوڵەکان (${filteredTransactions.length} جوڵە)</div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>ژمارەی جوڵە</th>
                  <th>جۆر</th>
                  <th>بڕی USD</th>
                  <th>باڵانس دوای</th>
                  <th>وەسف</th>
                  <th>بەروار</th>
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
              ئەم ڕاپۆرتە لەلایەن <span class="footer-brand">${company.name}</span> دروستکراوە
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
      [`ڕاپۆرتی دارایی کڕیار - ${getCompanyInfoFromSettings(settings || []).name}`],
      [''],
      ['زانیاری کڕیار'],
      [`کۆدی کڕیار:,${customer?.customerCode || '-'}`],
      [`ناوی کڕیار:,${customer?.fullName || '-'}`],
      [`ژمارەی مۆبایل:,${customer?.mobileNumber || '-'}`],
      [`بەرواری تۆمارکردن:,${customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString('ku-IQ') : '-'}`],
      [''],
      ['باڵانسی حساب'],
      [`باڵانس (USD):,$${parseFloat(account?.currentBalanceUsd || '0').toFixed(2)}`],
      [`دۆخی حساب:,${account?.accountStatus === 'active' ? 'چالاک' : 'ناچالاک'}`],
      [''],
    ];

    // Breakdown info
    const breakdownInfo = breakdown ? [
      ['شیکاری فرۆشتن'],
      [`نرخی پاکەتەکان:,$${breakdown.packageDebt.toFixed(2)}`],
      [`نرخی پاکێجی تەواو:,$${breakdown.fullPackageDebt.toFixed(2)}`],
      [`نرخی عموڵە:,$${breakdown.commissionDebt.toFixed(2)}`],
      [`نرخی خزمەتگوزاری:,$${breakdown.serviceDebt.toFixed(2)}`],
      [`کۆی پارەدان:,$${breakdown.creditBalance.toFixed(2)}`],
      [`کۆی فرۆشتن:,$${breakdown.totalDebt.toFixed(2)}`],
      [''],
    ] : [];

    // Summary
    const summaryInfo = [
      ['کورتەی جوڵەکان'],
      [`کۆی فرۆشتن:,$${totalDebit.toFixed(2)}`],
      [`کۆی پارەدانەکان:,$${totalCredit.toFixed(2)}`],
      [`ژمارەی جوڵەکان:,${filteredTransactions.length}`],
      [''],
    ];

    // Transaction headers
    const transactionHeaders = [
      'لیستی جوڵەکان'
    ];

    const tableHeaders = [
      '#',
      'ژمارەی جوڵە',
      'جۆر',
      'بڕی USD',
      'باڵانس دوای',
      'وەسف',
      'بەروار'
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
      [`ئەم ڕاپۆرتە لە ${new Date().toLocaleString('ku-IQ')} دروستکراوە`]
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
          <p className="text-muted-foreground text-lg">کڕیار نەدۆزرایەوە</p>
          <Link href="/finance">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 me-2" />
              گەڕانەوە
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
                    پڕۆفایلی دارایی کڕیار
                  </h1>
                  <p className="text-emerald-100 text-sm mt-1">بەدواداچوونی حساب و مامەڵەکان</p>
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
                  className="bg-white text-purple-700 hover:bg-purple-50 rounded-xl shadow-lg"
                  onClick={openAdjustDialogToZero}
                >
                  <Activity className="w-4 h-4 me-2" />
                  ڕاستکردنەوەی بالانس
                </Button>
                {/* Refund: top-level entry point. Opens the same modal as
                    the per-row reverse button but starts at the picker
                    step so staff can search/choose any reversible payment
                    without scrolling to the payments tab. */}
                <Button
                  className="bg-white text-amber-700 hover:bg-amber-50 rounded-xl shadow-lg"
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
                  ریفاوند
                </Button>
                <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl shadow-lg">
                      <Plus className="w-4 h-4 me-2" />
                      پارەدان
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-emerald-600" />
                        تۆمارکردنی پارەدان
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>بڕی USD</Label>
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
                        <Label>شێوازی پارەدان</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="شێوازێک هەڵبژێرە" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH">کاش</SelectItem>
                            <SelectItem value="BANK_TRANSFER">گواستنەوەی بانکی</SelectItem>
                            <SelectItem value="FIB">FIB</SelectItem>
                            <SelectItem value="FASTPAY">FastPay</SelectItem>
                            <SelectItem value="ZAINCASH">ZainCash</SelectItem>
                            <SelectItem value="ASIAHAWALA">Asia Hawala</SelectItem>
                            <SelectItem value="CARD">کارت</SelectItem>
                            <SelectItem value="OTHER">شێوازی تر</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Cash Account Selection */}
                      <div>
                        <Label>حسابی بانکی / سندوق</Label>
                        <Popover modal={true}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="mt-1 w-full justify-between font-normal">
                              {paymentCashAccountId && paymentCashAccountId !== 'none'
                                ? (() => {
                                    const acc = activeCashAccounts?.find(a => a.id.toString() === paymentCashAccountId);
                                    return acc ? `${acc.accountNameKu || acc.accountName} ($${Number(acc.currentBalance).toLocaleString()})` : "حسابێک هەڵبژێرە (ئارەزوومەندانە)";
                                  })()
                                : "حسابێک هەڵبژێرە (ئارەزوومەندانە)"}
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
                                    بێ حساب
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
                        <p className="text-xs text-muted-foreground mt-1">حسابێک هەڵبژێرە بۆ تۆمارکردنی پارەدان لە حسابەکەدا</p>
                      </div>
                      <div>
                        <Label>ژمارەی پسوڵە (ئارەزوومەندانە)</Label>
                        <Input
                          value={receiptNumber}
                          onChange={(e) => setReceiptNumber(e.target.value)}
                          placeholder="RCP-001"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>تێبینی (ئارەزوومەندانە)</Label>
                        <Textarea
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          placeholder="تێبینی سەبارەت بە پارەدان..."
                          rows={2}
                          className="mt-1"
                        />
                      </div>
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleRecordPayment}
                        disabled={recordPayment.isPending || (!paymentAmount && !paymentAmountIqd) || !paymentMethod}
                      >
                        {recordPayment.isPending ? 'چاوەڕوان بە...' : 'تۆمارکردن'}
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
                    <p className="text-xs text-emerald-100">کڕیارەکان</p>
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
                    <p className="text-xs text-emerald-100">مۆبایل</p>
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
                    <p className="text-xs text-emerald-100">بەرواری تۆمارکردن</p>
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
                    <p className="text-xs text-emerald-100">ژمارەی حساب</p>
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
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">هیچ حسابێک نییە بۆ ئەم کڕیارە</h3>
              <p className="text-muted-foreground mb-6">بۆ بەدواداچوونی دارایی، پێویستە حسابێک دروست بکەیت</p>
              <Button onClick={handleCreateAccount} disabled={getOrCreateAccount.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 me-2" />
                دروستکردنی حساب
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
                  ? "bg-gradient-to-br from-red-50 to-rose-100" 
                  : "bg-gradient-to-br from-emerald-50 to-teal-100"
              )}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">باڵانس (USD)</p>
                      <p className={cn(
                        "text-3xl font-bold",
                        parseFloat(account.currentBalanceUsd || '0') > 0 ? "text-red-600" : "text-emerald-600"
                      )}>
                        ${parseFloat(account.currentBalanceUsd || '0').toFixed(2)}
                      </p>
                    </div>
                    <div className={cn(
                      "p-4 rounded-2xl",
                      parseFloat(account.currentBalanceUsd || '0') > 0 ? "bg-red-200/50" : "bg-emerald-200/50"
                    )}>
                      <CircleDollarSign className={cn(
                        "w-8 h-8",
                        parseFloat(account.currentBalanceUsd || '0') > 0 ? "text-red-600" : "text-emerald-600"
                      )} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              

              
              {/* Account Status */}
              <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">بارودۆخ</p>
                      <Badge 
                        variant={account.accountStatus === 'active' ? 'default' : 'destructive'} 
                        className={cn(
                          "mt-2 text-sm px-3 py-1",
                          account.accountStatus === 'active' 
                            ? "bg-emerald-500 hover:bg-emerald-600" 
                            : ""
                        )}
                      >
                        {account.accountStatus === 'active' ? '✓ چالاک' : 'ناچالاک'}
                      </Badge>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-200/50">
                      <Activity className="w-8 h-8 text-amber-600" />
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
                      <BarChart3 className="w-5 h-5 text-purple-600" />
                      شیکاری فرۆشتن
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <Package className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">نرخی پاکەتەکان</p>
                        <p className="text-lg font-bold text-blue-600">${breakdown.packageDebt.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                        <ShoppingCart className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">نرخی پاکێجی تەواو</p>
                        <p className="text-lg font-bold text-emerald-600">${breakdown.fullPackageDebt.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
                        <Percent className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">نرخی عموڵە</p>
                        <p className="text-lg font-bold text-amber-600">${breakdown.commissionDebt.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-4 bg-pink-50 rounded-xl border border-pink-100">
                        <Sparkles className="w-6 h-6 text-pink-600 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">نرخی خزمەتگوزاری</p>
                        <p className="text-lg font-bold text-pink-600">${breakdown.serviceDebt.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100">
                        <Wallet className="w-6 h-6 text-green-600 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">کۆی پارەدان</p>
                        <p className="text-lg font-bold text-green-600">${breakdown.creditBalance.toFixed(2)}</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
                        <TrendingUp className="w-6 h-6 text-red-600 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">کۆی فرۆشتن</p>
                        <p className="text-lg font-bold text-red-600">${breakdown.totalDebt.toFixed(2)}</p>
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
                    هەموو مامەڵەکان
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    پارەدانەکان
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="transactions" className="mt-4">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Clock className="w-5 h-5 text-emerald-600" />
                          داهاتی کڕیار
                          {filteredTransactions && (
                            <Badge variant="secondary" className="me-2 bg-emerald-100 text-emerald-700">
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
                                <SelectValue placeholder="فلتەر" />
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
                          <p className="text-muted-foreground">هیچ جوڵەیەک نییە</p>
                        </div>
                      ) : (
                        <div className="rounded-xl border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-right font-semibold">ژمارە</TableHead>
                                <TableHead className="text-right font-semibold">جۆر</TableHead>
                                <TableHead className="text-right font-semibold">بڕی USD</TableHead>
                                <TableHead className="text-right font-semibold">باڵانس دوای</TableHead>
                                <TableHead className="text-right font-semibold">وەسف</TableHead>
                                <TableHead className="text-right font-semibold">بەروار</TableHead>
                                <TableHead className="text-right font-semibold">کردارەکان</TableHead>
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
                                              ? "bg-red-50 text-red-700 border-red-200"
                                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          )}
                                        >
                                          {getTransactionTypeIcon(txn.transactionType)}
                                          {getTransactionTypeLabel(txn.transactionType)}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className={cn(
                                        "font-semibold",
                                        txn.transactionType.startsWith('DEBIT') ? "text-red-600" : "text-emerald-600"
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
                                          <Eye className="w-4 h-4 text-emerald-600" />
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
                                              ? "bg-red-50 text-red-700 border-red-200"
                                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          )}
                                        >
                                          {getTransactionTypeIcon(txn.transactionType)}
                                          {getTransactionTypeLabel(txn.transactionType)}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className={cn(
                                        "font-semibold",
                                        txn.transactionType.startsWith('DEBIT') ? "text-red-600" : "text-emerald-600"
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
                                              title="بینینی پسووڵە"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <ExternalLink className="w-4 h-4 text-blue-600" />
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
                                            <Eye className="w-4 h-4 text-emerald-600" />
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
                                          ? "bg-emerald-50/40 hover:bg-emerald-50/60 border-l-emerald-500"
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
                                          <span className="text-emerald-700 font-semibold truncate max-w-[180px]" title={group.invoiceNumber}>
                                            {group.invoiceNumber}
                                          </span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge
                                          variant="outline"
                                          className="gap-1 font-normal bg-emerald-50 text-emerald-700 border-emerald-200"
                                        >
                                          <Layers className="w-3.5 h-3.5" />
                                          {group.rows.length} جوڵە
                                        </Badge>
                                      </TableCell>
                                      <TableCell className={cn(
                                        "font-bold text-base",
                                        isNetDebit ? "text-red-600" : "text-emerald-600"
                                      )}>
                                        {isNetDebit ? '+' : '-'}${absNet.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="font-semibold">
                                        ${group.balanceAfterUsd.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="max-w-[240px] truncate text-muted-foreground text-sm">
                                        پسووڵەی کۆکراوە — {group.rows.length} مامەڵە
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
                                            title="بینینی پسووڵە"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <ExternalLink className="w-4 h-4 text-blue-600" />
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
                                                ? "bg-red-50/70 text-red-700 border-red-200"
                                                : "bg-emerald-50/70 text-emerald-700 border-emerald-200"
                                            )}
                                          >
                                            {getTransactionTypeIcon(txn.transactionType)}
                                            {getTransactionTypeLabel(txn.transactionType)}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className={cn(
                                          "font-semibold text-sm",
                                          txn.transactionType.startsWith('DEBIT') ? "text-red-600" : "text-emerald-600"
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
                                            <Eye className="w-4 h-4 text-emerald-600" />
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
                        <CreditCard className="w-5 h-5 text-emerald-600" />
                        پارەدانەکان
                        {payments && (
                          <Badge variant="secondary" className="me-2 bg-emerald-100 text-emerald-700">
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
                          <p className="text-muted-foreground">هیچ پارەدانێک نییە</p>
                        </div>
                      ) : (
                        <div className="rounded-xl border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-right font-semibold">ژمارە</TableHead>
                                <TableHead className="text-right font-semibold">شێواز</TableHead>
                                <TableHead className="text-right font-semibold">بڕی USD</TableHead>
                                <TableHead className="text-right font-semibold">دۆخ</TableHead>
                                <TableHead className="text-right font-semibold">ژمارەی پسوڵە</TableHead>
                                <TableHead className="text-right font-semibold">تێبینی</TableHead>
                                <TableHead className="text-right font-semibold">بەروار</TableHead>
                                <TableHead className="text-right font-semibold">کردارەکان</TableHead>
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
                                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                        {getPaymentMethodLabel(payment.paymentMethod)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className={cn(
                                      "font-semibold",
                                      isFullyReversed ? "text-muted-foreground line-through" : "text-emerald-600"
                                    )}>
                                      ${original.toFixed(2)}
                                      {isPartiallyReversed && (
                                        <span className="block text-xs text-amber-700 font-normal">
                                          (ماوە: ${remaining.toFixed(2)})
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {isFullyReversed ? (
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                                          <RotateCcw className="w-3 h-3" /> گەڕێنراوەتەوە
                                        </Badge>
                                      ) : isPartiallyReversed ? (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                                          <RotateCcw className="w-3 h-3" /> بە بەشێ
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                                          <CheckCircle className="w-3 h-3" /> چالاک
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
                                          title="گەڕاندنەوە یاخود Refund"
                                        >
                                          <RotateCcw className="w-4 h-4" />
                                          <span className="text-xs">گەڕاندنەوە</span>
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
              <Activity className="w-5 h-5 text-purple-600" />
              ڕاستکردنەوەی بالانس بە دەستی
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Warning banner — this tool is for emergencies only */}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">ئاگاداربە:</p>
                <p>ئەم ئامرازە تەنها بۆ دۆخە تایبەتییەکانە (بۆ نمونە: تۆماری پارەدان لابراوە بەڵام بالانس ماوە). ئەگەر paymentRecord هەنووکە هەیە، بەکارهێنانی «ریفاوند» باشترە — context ـی زیاتر دەپارێزێت.</p>
              </div>
            </div>

            {/* Balance preview: current → new */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-muted/40 border text-center">
                <div className="text-[10px] text-muted-foreground uppercase">بالانسی ئێستا</div>
                <div className={cn(
                  "font-mono font-bold text-lg mt-1",
                  parseFloat(account?.currentBalanceUsd || '0') > 0 ? "text-red-600"
                    : parseFloat(account?.currentBalanceUsd || '0') < 0 ? "text-emerald-600"
                    : "text-muted-foreground"
                )}>
                  ${parseFloat(account?.currentBalanceUsd || '0').toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 border-2 border-purple-200 text-center">
                <div className="text-[10px] text-purple-700 uppercase">بالانس دوای ڕاستکردنەوە</div>
                <div className={cn(
                  "font-mono font-bold text-lg mt-1",
                  adjustPreviewBalance > 0 ? "text-red-600"
                    : adjustPreviewBalance < 0 ? "text-emerald-600"
                    : "text-purple-700"
                )}>
                  ${adjustPreviewBalance.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Direction selector */}
            <div>
              <Label className="text-sm">ئاراستە</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setAdjustDirection('debit')}
                  className={cn(
                    "p-3 rounded-lg border-2 text-sm transition-all text-right",
                    adjustDirection === 'debit'
                      ? "border-red-500 bg-red-50 shadow"
                      : "border-muted hover:border-red-300"
                  )}
                >
                  <div className="font-bold flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-red-600" />
                    DEBIT (+)
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    بالانس بەرز دەکاتەوە (سڕینەوەی credit)
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustDirection('credit')}
                  className={cn(
                    "p-3 rounded-lg border-2 text-sm transition-all text-right",
                    adjustDirection === 'credit'
                      ? "border-emerald-500 bg-emerald-50 shadow"
                      : "border-muted hover:border-emerald-300"
                  )}
                >
                  <div className="font-bold flex items-center gap-1">
                    <TrendingDown className="w-4 h-4 text-emerald-600" />
                    CREDIT (−)
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    بالانس کەم دەکاتەوە (سڕینەوەی قەرز)
                  </div>
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <Label className="text-sm">بڕ (USD)</Label>
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
                هۆکار <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="بۆ نمونە: تۆماری پارەدانێکی هەڵە لاسرابوو بەڵام بالانس مابوو..."
                rows={3}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                لانیکەم ٥ پیت. لە audit log و سەر ledger دەنوسرێت.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAdjustDialogOpen(false)}
                disabled={adjustBalance.isPending}
              >
                پاشگەزبوونەوە
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                onClick={handleSubmitAdjust}
                disabled={adjustBalance.isPending}
              >
                {adjustBalance.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : "ڕاستکردنەوە"}
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
              <RotateCcw className="w-5 h-5 text-amber-600" />
              گەڕاندنەوەی پارەدان
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
                پارەدانێک هەڵبژێرە بۆ گەڕاندنەوە یاخود ریفاوند:
              </p>
              {!payments || payments.length === 0 ? (
                <div className="p-6 text-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  هیچ پارەدانێکی تۆمارکراو نییە.
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
                      هەموو پارەدانەکان پێشتر گەڕێنراونەتەوە.
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
                              <Badge variant="outline" className="text-[10px] py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                                {getPaymentMethodLabel(p.paymentMethod)}
                              </Badge>
                              {isPartial && (
                                <Badge variant="outline" className="text-[10px] py-0 bg-amber-50 text-amber-700 border-amber-200">
                                  بە بەشێ
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {new Date(p.createdAt).toLocaleDateString('ku-IQ')}
                              {p.notes ? ` • ${p.notes}` : ''}
                            </div>
                          </div>
                          <div className="text-end shrink-0">
                            <div className="font-mono font-bold text-emerald-700">
                              ${remaining.toFixed(2)}
                            </div>
                            {isPartial && (
                              <div className="text-[10px] text-muted-foreground">
                                لە کۆی ${orig.toFixed(2)}
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
                پاشگەزبوونەوە
              </Button>
            </div>
          )}

          {reverseTargetPayment && (
            <div className="space-y-4 mt-2">
              {/* Payment summary */}
              <div className="p-3 rounded-lg bg-muted/40 border text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ژمارە:</span>
                  <span className="font-mono">{reverseTargetPayment.paymentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">بڕی پارەدان:</span>
                  <span className="font-bold">${parseFloat(reverseTargetPayment.amountUsd || '0').toFixed(2)}</span>
                </div>
                {parseFloat(reverseTargetPayment.reversedAmountUsd || '0') > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>پێشتر گەڕێنراوەتەوە:</span>
                    <span className="font-bold">${parseFloat(reverseTargetPayment.reversedAmountUsd || '0').toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-muted-foreground">ماوە بۆ گەڕاندنەوە:</span>
                  <span className="font-bold text-emerald-700">${reverseRemainingUsd.toFixed(2)}</span>
                </div>
              </div>

              {/* Mode selector */}
              <div>
                <Label className="text-sm">جۆری گەڕاندنەوە</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setReverseMode('mistake')}
                    className={cn(
                      "p-3 rounded-lg border-2 text-sm transition-all text-right",
                      reverseMode === 'mistake'
                        ? "border-amber-500 bg-amber-50 shadow"
                        : "border-muted hover:border-amber-300"
                    )}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      هەڵە
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      پارە بە هەڵە تۆمارکراوە. کاش وەرنەگیراوە.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReverseMode('refund')}
                    className={cn(
                      "p-3 rounded-lg border-2 text-sm transition-all text-right",
                      reverseMode === 'refund'
                        ? "border-red-500 bg-red-50 shadow"
                        : "border-muted hover:border-red-300"
                    )}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <Banknote className="w-4 h-4 text-red-600" />
                      Refund
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      پارە بە کریار دەگەڕێتەوە. لە کاش کەم دەبیت.
                    </div>
                  </button>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <Label className="text-sm">بڕ (USD)</Label>
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
                  هەرە زۆر: ${reverseRemainingUsd.toFixed(2)}
                </p>
              </div>

              {/* Cash account selector — only for refund */}
              {reverseMode === 'refund' && (
                <div>
                  <Label className="text-sm">حسابی نقدی (کاش لێی دەردەچێت)</Label>
                  <Popover modal={true}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="mt-1 w-full justify-between font-normal">
                        {reverseCashAccountId && reverseCashAccountId !== 'none'
                          ? (() => {
                              const acc = activeCashAccounts?.find(a => a.id.toString() === reverseCashAccountId);
                              return acc ? `${acc.accountNameKu || acc.accountName} ($${Number(acc.currentBalance).toLocaleString()})` : "حسابێک هەڵبژێرە";
                            })()
                          : "حسابێک هەڵبژێرە"}
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
                  هۆکار <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="بۆ نمونە: تایپی هەڵە، کریاری هەڵە، کریار داوای پارەکەی کردووە..."
                  rows={3}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  لانیکەم ٥ پیت. ئەم هۆکارە لە audit log و بەسەر invoice دەنوسرێت.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setReverseDialogOpen(false)}
                  disabled={reversePayment.isPending || refundPayment.isPending}
                >
                  پاشگەزبوونەوە
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
                    : reverseMode === 'mistake' ? "گەڕاندنەوە" : "Refund"}
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
              <Receipt className="w-5 h-5 text-emerald-600" />
              وردەکاری جوڵە
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
                        ? "bg-red-100 text-red-700 border-red-200" 
                        : "bg-emerald-100 text-emerald-700 border-emerald-200"
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
                    selectedTransaction.transactionType.startsWith('DEBIT') ? "text-red-600" : "text-emerald-600"
                  )}>
                    {selectedTransaction.transactionType.startsWith('DEBIT') ? '+' : '-'}${parseFloat(selectedTransaction.amountUsd || '0').toFixed(2)}
                  </p>

                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">باڵانس پێش</span>
                  <span className="font-semibold">${parseFloat(selectedTransaction.balanceBeforeUsd || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">باڵانس دوای</span>
                  <span className="font-semibold">${parseFloat(selectedTransaction.balanceAfterUsd || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">بەروار</span>
                  <span className="font-semibold">{new Date(selectedTransaction.createdAt).toLocaleString('ku-IQ')}</span>
                </div>
                {selectedTransaction.description && (
                  <div className="py-2">
                    <span className="text-muted-foreground block mb-1">وەسف</span>
                    <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedTransaction.description}</p>
                  </div>
                )}
              </div>
              
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => setDetailsDialogOpen(false)}
              >
                داخستن
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
