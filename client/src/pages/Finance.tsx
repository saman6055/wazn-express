import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { readFinanceLink } from "@shared/listLinks";
import { getCompanyInfoFromSettings } from "@/hooks/useCompanyInfo";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogFooter,
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
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Receipt,
  Clock,
  Plus,
  Banknote,
  Building,
  Wallet,
  Calendar,
  User,
  FileText,
  History,
  Download,
  FileSpreadsheet,
  Filter,
  SortAsc,
  SortDesc,
  ChevronDown,
  ChevronsUpDown,
  Check,
  Landmark,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

type SortField = 'balance' | 'name' | 'date' | 'code';
type SortDirection = 'asc' | 'desc';
type AccountFilter = 'all' | 'debtors' | 'credit' | 'zero' | 'active' | 'inactive';

export default function Finance() {
  const { t, language } = useTranslation();
  // A dashboard figure can open the tab its number came from —
  // /finance?tab=payments — rather than the overview every time.
  const [activeTab, setActiveTab] = useState<string>(() =>
    (typeof window === "undefined" ? undefined : readFinanceLink(window.location.search).tab) ?? "overview",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [isCreatePaymentOpen, setIsCreatePaymentOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCashAccountId, setSelectedCashAccountId] = useState<string>("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  
  // New filter and sort states
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  const [sortField, setSortField] = useState<SortField>('balance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Credit customers tab states
  const [creditSearch, setCreditSearch] = useState("");
  const [creditMinAmount, setCreditMinAmount] = useState("");
  const [creditMaxAmount, setCreditMaxAmount] = useState("");
  const [creditSortField, setCreditSortField] = useState<'balance' | 'name' | 'code' | 'lastTransaction'>('balance');
  const [creditSortDir, setCreditSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Queries - using unified ledger system
  const { data: summary, isLoading: summaryLoading } = trpc.ledger.getSummary.useQuery();
  const { data: accounts, isLoading: accountsLoading } = trpc.ledger.getAllAccounts.useQuery();
  const { data: recentTransactions, refetch: refetchTransactions } = trpc.ledger.getRecentTransactions.useQuery({ limit: 50 });
  const { data: debtors } = trpc.ledger.getDebtors.useQuery({ minBalanceUsd: 0 });
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: activeCashAccounts } = trpc.cashAccounts.listActive.useQuery();
  const { data: settings } = trpc.settings.list.useQuery();
  
  // Use ledger.recordPayment for recording payments (unified ledger system)
  const createPaymentMutation = trpc.ledger.recordPayment.useMutation({
    onSuccess: () => {
      toast.success(t("finance.paymentRecorded"));
      setIsCreatePaymentOpen(false);
      setSelectedCustomerId("");
      setSelectedCashAccountId("");
      setCustomerSearchQuery("");
      refetchTransactions();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  // Get payment transactions from ledger (CREDIT_PAYMENT type)
  const payments = recentTransactions?.filter(t => t.transactionType === 'CREDIT_PAYMENT') || [];
  
  // Advanced filtered and sorted accounts
  const filteredAndSortedAccounts = useMemo(() => {
    if (!accounts) return [];
    
    let filtered = accounts.filter(account => {
      // Search filter
      if (searchQuery) {
        const customer = account.customer;
        if (!customer) return false;
        const matchesSearch = 
          customer.customerCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.mobileNumber?.includes(searchQuery);
        if (!matchesSearch) return false;
      }
      
      // Account type filter
      const balanceUsd = parseFloat(account.currentBalanceUsd || '0');
      switch (accountFilter) {
        case 'debtors':
          return balanceUsd > 0;
        case 'credit':
          return balanceUsd < 0;
        case 'zero':
          return balanceUsd === 0;
        case 'active':
          return account.accountStatus === 'active';
        case 'inactive':
          return account.accountStatus !== 'active';
        default:
          return true;
      }
    });
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'balance':
          comparison = parseFloat(a.currentBalanceUsd || '0') - parseFloat(b.currentBalanceUsd || '0');
          break;
        case 'name':
          comparison = (a.customer?.fullName || '').localeCompare(b.customer?.fullName || '');
          break;
        case 'code':
          comparison = (a.customer?.customerCode || '').localeCompare(b.customer?.customerCode || '');
          break;
        case 'date':
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    
    return filtered;
  }, [accounts, searchQuery, accountFilter, sortField, sortDirection]);
  
  // Credit customers - filtered and sorted
  const creditCustomers = useMemo(() => {
    if (!accounts) return [];
    
    let filtered = accounts.filter(account => {
      const balanceUsd = parseFloat(account.currentBalanceUsd || '0');
      // Only show customers with credit (negative balance = they have money with us)
      if (balanceUsd >= 0) return false;
      
      // Search filter
      if (creditSearch) {
        const customer = account.customer;
        if (!customer) return false;
        const matchesSearch = 
          customer.customerCode?.toLowerCase().includes(creditSearch.toLowerCase()) ||
          customer.fullName?.toLowerCase().includes(creditSearch.toLowerCase()) ||
          customer.mobileNumber?.includes(creditSearch);
        if (!matchesSearch) return false;
      }
      
      // Amount range filter
      const absBalance = Math.abs(balanceUsd);
      if (creditMinAmount && absBalance < parseFloat(creditMinAmount)) return false;
      if (creditMaxAmount && absBalance > parseFloat(creditMaxAmount)) return false;
      
      return true;
    });
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (creditSortField) {
        case 'balance':
          comparison = Math.abs(parseFloat(a.currentBalanceUsd || '0')) - Math.abs(parseFloat(b.currentBalanceUsd || '0'));
          break;
        case 'name':
          comparison = (a.customer?.fullName || '').localeCompare(b.customer?.fullName || '');
          break;
        case 'code':
          comparison = (a.customer?.customerCode || '').localeCompare(b.customer?.customerCode || '');
          break;
        case 'lastTransaction':
          comparison = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
          break;
      }
      return creditSortDir === 'desc' ? -comparison : comparison;
    });
    
    return filtered;
  }, [accounts, creditSearch, creditMinAmount, creditMaxAmount, creditSortField, creditSortDir]);
  
  const totalCreditAmount = creditCustomers.reduce((sum, a) => sum + Math.abs(parseFloat(a.currentBalanceUsd || '0')), 0);
  
  // Credit customers export functions
  const exportCreditToExcel = () => {
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"></head>
      <body>
      <table border="1" style="direction: rtl; text-align: right;">
        <tr style="background: #059669; color: white; font-weight: bold;">
          <th>#</th>
          <th>${pickLang(language, { ku: "\u06a9\u06c6\u062f\u06cc \u06a9\u0695\u06cc\u0627\u0631", en: "Customer code", ar: "\u0631\u0645\u0632 \u0627\u0644\u0639\u0645\u064a\u0644", zh: "\u5ba2\u6237\u7f16\u53f7" })}</th>
          <th>${pickLang(language, { ku: "\u0646\u0627\u0648", en: "Name", ar: "\u0627\u0644\u0627\u0633\u0645", zh: "\u59d3\u540d" })}</th>
          <th>${pickLang(language, { ku: "\u0698\u0645\u0627\u0631\u06d5\u06cc \u0645\u06c6\u0628\u0627\u06cc\u0644", en: "Mobile number", ar: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641", zh: "\u624b\u673a\u53f7" })}</th>
          <th>${pickLang(language, { ku: "\u0628\u0695\u06cc \u06a9\u0631\u06cc\u062f\u06cc\u062a (USD)", en: "Credit amount (USD)", ar: "\u0645\u0628\u0644\u063a \u0627\u0644\u0631\u0635\u064a\u062f (USD)", zh: "\u8d37\u65b9\u91d1\u989d (USD)" })}</th>
          <th>${pickLang(language, { ku: "\u0628\u0627\u0631\u0648\u062f\u06c6\u062e", en: "Status", ar: "\u0627\u0644\u062d\u0627\u0644\u0629", zh: "\u72b6\u6001" })}</th>
        </tr>
    `;
    
    creditCustomers.forEach((account, index) => {
      const balance = Math.abs(parseFloat(account.currentBalanceUsd || '0'));
      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${account.customer?.customerCode || ''}</td>
          <td>${account.customer?.fullName || ''}</td>
          <td>${account.customer?.mobileNumber || '-'}</td>
          <td style="color: #059669; font-weight: bold;">$${balance.toFixed(2)}</td>
          <td>${account.accountStatus === 'active' ? pickLang(language, { ku: "\u0686\u0627\u0644\u0627\u06a9", en: "Active", ar: "\u0646\u0634\u0637", zh: "\u6d3b\u8dc3" }) : pickLang(language, { ku: "\u0646\u0627\u0686\u0627\u0644\u0627\u06a9", en: "Inactive", ar: "\u063a\u064a\u0631 \u0646\u0634\u0637", zh: "\u505c\u7528" })}</td>
        </tr>
      `;
    });

    html += `
      <tr style="background: #f0fdf4; font-weight: bold;">
        <td colspan="4">${pickLang(language, { ku: "\u06a9\u06c6\u06cc \u06af\u0634\u062a\u06cc", en: "Grand total", ar: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0639\u0627\u0645", zh: "\u603b\u8ba1" })}</td>
        <td style="color: #059669;">$${totalCreditAmount.toFixed(2)}</td>
        <td>${creditCustomers.length} ${pickLang(language, { ku: "\u06a9\u0695\u06cc\u0627\u0631", en: "customers", ar: "\u0639\u0645\u064a\u0644", zh: "\u5ba2\u6237" })}</td>
      </tr>
    </table></body></html>`;
    
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `credit-customers-${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
    toast.success(pickLang(language, { ku: "Excel \u062f\u0627\u0648\u0646\u0644\u06c6\u062f \u06a9\u0631\u0627", en: "Excel downloaded", ar: "\u062a\u0645 \u062a\u0646\u0632\u064a\u0644 Excel", zh: "Excel \u5df2\u4e0b\u8f7d" }));
  };
  
  const exportCreditToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const company = getCompanyInfoFromSettings(settings || []);
    let tableRows = '';
    creditCustomers.forEach((account, index) => {
      const balance = Math.abs(parseFloat(account.currentBalanceUsd || '0'));
      tableRows += `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${account.customer?.customerCode || ''}</strong></td>
          <td>${account.customer?.fullName || ''}</td>
          <td>${account.customer?.mobileNumber || '-'}</td>
          <td class="credit">$${balance.toFixed(2)}</td>
          <td><span class="badge ${account.accountStatus === 'active' ? 'active' : 'inactive'}">${account.accountStatus === 'active' ? pickLang(language, { ku: "\u0686\u0627\u0644\u0627\u06a9", en: "Active", ar: "\u0646\u0634\u0637", zh: "\u6d3b\u8dc3" }) : pickLang(language, { ku: "\u0646\u0627\u0686\u0627\u0644\u0627\u06a9", en: "Inactive", ar: "\u063a\u064a\u0631 \u0646\u0634\u0637", zh: "\u505c\u7528" })}</span></td>
        </tr>
      `;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ku">
      <head>
        <meta charset="UTF-8">
        <title>${pickLang(language, { ku: "\u0695\u0627\u067e\u06c6\u0631\u062a\u06cc \u06a9\u0695\u06cc\u0627\u0631\u0627\u0646\u06cc \u06a9\u0631\u06cc\u062f\u06cc\u062a\u062f\u0627\u0631", en: "Credit customers report", ar: "\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0623\u0635\u062d\u0627\u0628 \u0627\u0644\u0631\u0635\u064a\u062f", zh: "\u8d37\u65b9\u5ba2\u6237\u62a5\u544a" })}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Noto Sans Arabic', sans-serif; background: #fff; color: #1a1a2e; padding: 40px; }
          .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #059669; }
          .header h1 { font-size: 28px; color: #059669; margin-bottom: 8px; }
          .header .company { font-size: 16px; color: #666; margin-bottom: 4px; }
          .header .date { font-size: 13px; color: #999; }
          .summary-cards { display: flex; gap: 20px; margin-bottom: 30px; justify-content: center; }
          .summary-card { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px 30px; text-align: center; min-width: 180px; }
          .summary-card .label { font-size: 13px; color: #059669; margin-bottom: 6px; }
          .summary-card .value { font-size: 26px; font-weight: 700; color: #047857; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #059669; color: white; padding: 12px 16px; font-weight: 600; font-size: 13px; text-align: right; }
          td { padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: right; }
          tr:nth-child(even) { background: #f9fafb; }
          tr:hover { background: #ecfdf5; }
          .credit { color: #059669; font-weight: 700; font-size: 14px; }
          .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
          .badge.active { background: #dcfce7; color: #166534; }
          .badge.inactive { background: #fee2e2; color: #991b1b; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 2px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 12px; color: #999; }
          .total-row { background: #ecfdf5 !important; font-weight: 700; }
          .total-row td { border-top: 2px solid #059669; font-size: 14px; }
          @media print { body { padding: 20px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">${company.name}</div>
          <h1>${pickLang(language, { ku: "\u0695\u0627\u067e\u06c6\u0631\u062a\u06cc \u06a9\u0695\u06cc\u0627\u0631\u0627\u0646\u06cc \u06a9\u0631\u06cc\u062f\u06cc\u062a\u062f\u0627\u0631", en: "Credit customers report", ar: "\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0623\u0635\u062d\u0627\u0628 \u0627\u0644\u0631\u0635\u064a\u062f", zh: "\u8d37\u65b9\u5ba2\u6237\u62a5\u544a" })}</h1>
          <div class="date">${new Date().toLocaleDateString('ku', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        
        <div class="summary-cards">
          <div class="summary-card">
            <div class="label">${pickLang(language, { ku: "\u06a9\u06c6\u06cc \u06a9\u0631\u06cc\u062f\u06cc\u062a", en: "Total credit", ar: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0631\u0635\u064a\u062f", zh: "\u8d37\u65b9\u603b\u989d" })}</div>
            <div class="value">$${totalCreditAmount.toFixed(2)}</div>
          </div>
          <div class="summary-card">
            <div class="label">${pickLang(language, { ku: "\u0698\u0645\u0627\u0631\u06d5\u06cc \u06a9\u0695\u06cc\u0627\u0631", en: "Number of customers", ar: "\u0639\u062f\u062f \u0627\u0644\u0639\u0645\u0644\u0627\u0621", zh: "\u5ba2\u6237\u6570\u91cf" })}</div>
            <div class="value">${creditCustomers.length}</div>
          </div>
          <div class="summary-card">
            <div class="label">${pickLang(language, { ku: "\u0646\u0627\u0648\u06d5\u0646\u062f\u06cc \u06a9\u0631\u06cc\u062f\u06cc\u062a", en: "Average credit", ar: "\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u0631\u0635\u064a\u062f", zh: "\u5e73\u5747\u8d37\u65b9" })}</div>
            <div class="value">$${creditCustomers.length > 0 ? (totalCreditAmount / creditCustomers.length).toFixed(2) : '0.00'}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${pickLang(language, { ku: "\u06a9\u06c6\u062f\u06cc \u06a9\u0695\u06cc\u0627\u0631", en: "Customer code", ar: "\u0631\u0645\u0632 \u0627\u0644\u0639\u0645\u064a\u0644", zh: "\u5ba2\u6237\u7f16\u53f7" })}</th>
              <th>${pickLang(language, { ku: "\u0646\u0627\u0648", en: "Name", ar: "\u0627\u0644\u0627\u0633\u0645", zh: "\u59d3\u540d" })}</th>
              <th>${pickLang(language, { ku: "\u0698\u0645\u0627\u0631\u06d5\u06cc \u0645\u06c6\u0628\u0627\u06cc\u0644", en: "Mobile number", ar: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641", zh: "\u624b\u673a\u53f7" })}</th>
              <th>${pickLang(language, { ku: "\u0628\u0695\u06cc \u06a9\u0631\u06cc\u062f\u06cc\u062a (USD)", en: "Credit amount (USD)", ar: "\u0645\u0628\u0644\u063a \u0627\u0644\u0631\u0635\u064a\u062f (USD)", zh: "\u8d37\u65b9\u91d1\u989d (USD)" })}</th>
              <th>${pickLang(language, { ku: "\u0628\u0627\u0631\u0648\u062f\u06c6\u062e", en: "Status", ar: "\u0627\u0644\u062d\u0627\u0644\u0629", zh: "\u72b6\u6001" })}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row">
              <td colspan="4">${pickLang(language, { ku: "\u06a9\u06c6\u06cc \u06af\u0634\u062a\u06cc", en: "Grand total", ar: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0639\u0627\u0645", zh: "\u603b\u8ba1" })}</td>
              <td class="credit">$${totalCreditAmount.toFixed(2)}</td>
              <td>${creditCustomers.length} ${pickLang(language, { ku: "\u06a9\u0695\u06cc\u0627\u0631", en: "customers", ar: "\u0639\u0645\u064a\u0644", zh: "\u5ba2\u6237" })}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <span>${company.name} - ${pickLang(language, { ku: "\u0633\u06cc\u0633\u062a\u06d5\u0645\u06cc \u0628\u06d5\u0695\u06ce\u0648\u06d5\u0628\u0631\u062f\u0646\u06cc \u062f\u0627\u0631\u0627\u06cc\u06cc", en: "Financial management system", ar: "\u0646\u0638\u0627\u0645 \u0627\u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064a\u0629", zh: "\u8d22\u52a1\u7ba1\u7406\u7cfb\u7edf" })}</span>
          <span>${new Date().toLocaleString('ku')}</span>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 12px 40px; border-radius: 8px; font-size: 16px; cursor: pointer; font-family: inherit;">${pickLang(language, { ku: "\u0686\u0627\u067e\u06a9\u0631\u062f\u0646 / \u062f\u0627\u0648\u0646\u0644\u06c6\u062f PDF", en: "Print / Download PDF", ar: "\u0637\u0628\u0627\u0639\u0629 / \u062a\u0646\u0632\u064a\u0644 PDF", zh: "\u6253\u5370 / \u4e0b\u8f7d PDF" })}</button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    toast.success(pickLang(language, { ku: "PDF \u0626\u0627\u0645\u0627\u062f\u06d5\u06cc\u06d5 \u0628\u06c6 \u0686\u0627\u067e\u06a9\u0631\u062f\u0646", en: "PDF ready to print", ar: "\u0645\u0644\u0641 PDF \u062c\u0627\u0647\u0632 \u0644\u0644\u0637\u0628\u0627\u0639\u0629", zh: "PDF \u5df2\u51c6\u5907\u597d\u6253\u5370" }));
  };

  // Filter payment transactions from ledger
  const filteredPayments = payments?.filter(p => {
    const matchesSearch = !paymentSearch || 
      (p.description || '').toLowerCase().includes(paymentSearch.toLowerCase()) ||
      (p.transactionNumber || '').toLowerCase().includes(paymentSearch.toLowerCase());
    return matchesSearch && (methodFilter === "all" || true);
  });
  
  // Stats from ledger transactions
  const totalPayments = payments?.reduce((sum, p) => sum + Math.abs(Number(p.amountUsd || 0)), 0) || 0;
  const cashPayments = payments?.filter(p => (p.description || '').toLowerCase().includes('cash')).reduce((sum, p) => sum + Math.abs(Number(p.amountUsd || 0)), 0) || 0;
  const bankPayments = payments?.filter(p => (p.description || '').toLowerCase().includes('bank')).reduce((sum, p) => sum + Math.abs(Number(p.amountUsd || 0)), 0) || 0;
  
  // Helpers
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };
  
  const getTransactionTypeColor = (type: string) => {
    if (type.startsWith('DEBIT')) return 'text-red-600';
    if (type.startsWith('CREDIT')) return 'text-green-600';
    return 'text-gray-600';
  };
  
  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'DEBIT_PACKAGE': t('finance.transactionTypes.packagePrice'),
      'DEBIT_FULL_PACKAGE': t('finance.transactionTypes.fullPackage'),
      'DEBIT_PURCHASE_REQUEST': t('finance.transactionTypes.purchaseRequest'),
      'DEBIT_COMMISSION': t('finance.transactionTypes.commission'),
      'DEBIT_SERVICE': t('finance.transactionTypes.service'),
      'DEBIT_PENALTY': t('finance.transactionTypes.penalty'),
      'DEBIT_OTHER': t('finance.transactionTypes.otherDebit'),
      'CREDIT_PAYMENT': t('finance.transactionTypes.payment'),
      'CREDIT_DEPOSIT': t('finance.transactionTypes.deposit'),
      'CREDIT_REFUND': t('finance.transactionTypes.refund'),
      'CREDIT_DISCOUNT': t('finance.transactionTypes.discount'),
      'CREDIT_OTHER': t('finance.transactionTypes.otherCredit'),
      'ADJUSTMENT_DEBIT': t('finance.transactionTypes.debitAdjustment'),
      'ADJUSTMENT_CREDIT': t('finance.transactionTypes.creditAdjustment'),
    };
    return labels[type] || type;
  };
  
  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="h-4 w-4" />;
      case 'bank_transfer': return <Building className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'mobile_money': return <Wallet className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };
  
  const getMethodColor = (method: string) => {
    switch (method) {
      case 'cash': return 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400';
      case 'bank_transfer': return 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400';
      case 'card': return 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400';
      case 'mobile_money': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-400';
    }
  };
  
  const handleCreatePayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customer = customers?.find(c => c.id === parseInt(selectedCustomerId));
    if (!customer) {
      toast.error("Customer not found");
      return;
    }
    createPaymentMutation.mutate({
      customerId: parseInt(selectedCustomerId),
      customerCode: customer.customerCode || '',
      amountUsd: parseFloat(formData.get("amountUsd") as string) || 0,
      amountIqd: 0,
      paymentMethod: (formData.get("paymentMethod") as string) as any || 'CASH',
      receiptNumber: formData.get("referenceNumber") as string || undefined,
      notes: formData.get("notes") as string || undefined,
      cashAccountId: selectedCashAccountId && selectedCashAccountId !== 'none' ? parseInt(selectedCashAccountId) : undefined,
    });
  };
  
  // Export functions
  const exportToCSV = () => {
    const data = filteredAndSortedAccounts.map(account => ({
      [pickLang(language, { ku: "کۆدی کڕیار", en: "Customer code", ar: "رمز العميل", zh: "客户编号" })]: account.customer?.customerCode || '',
      [pickLang(language, { ku: "ناو", en: "Name", ar: "الاسم", zh: "姓名" })]: account.customer?.fullName || '',
      [pickLang(language, { ku: "ژمارەی حساب", en: "Account number", ar: "رقم الحساب", zh: "账户号" })]: account.accountNumber || '',
      [pickLang(language, { ku: "باڵانس (USD)", en: "Balance (USD)", ar: "الرصيد (USD)", zh: "余额 (USD)" })]: parseFloat(account.currentBalanceUsd || '0').toFixed(2),
      [pickLang(language, { ku: "بارودۆخ", en: "Status", ar: "الحالة", zh: "状态" })]: account.accountStatus === 'active' ? pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "活跃" }) : pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" }),
    }));
    
    const headers = Object.keys(data[0] || {}).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    const csv = '\uFEFF' + headers + '\n' + rows;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `accounts-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success(pickLang(language, { ku: "CSV داونلۆد کرا", en: "CSV downloaded", ar: "تم تنزيل CSV", zh: "CSV 已下载" }));
  };
  
  const exportToExcel = () => {
    // Create HTML table for Excel
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"></head>
      <body>
      <table border="1" style="direction: rtl; text-align: right;">
        <tr style="background: #10b981; color: white; font-weight: bold;">
          <th>${pickLang(language, { ku: "کۆدی کڕیار", en: "Customer code", ar: "رمز العميل", zh: "客户编号" })}</th>
          <th>${pickLang(language, { ku: "ناو", en: "Name", ar: "الاسم", zh: "姓名" })}</th>
          <th>${pickLang(language, { ku: "ژمارەی حساب", en: "Account number", ar: "رقم الحساب", zh: "账户号" })}</th>
          <th>${pickLang(language, { ku: "باڵانس (USD)", en: "Balance (USD)", ar: "الرصيد (USD)", zh: "余额 (USD)" })}</th>
          <th>${pickLang(language, { ku: "بارودۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</th>
        </tr>
    `;
    
    filteredAndSortedAccounts.forEach(account => {
      const balance = parseFloat(account.currentBalanceUsd || '0');
      const balanceColor = balance > 0 ? '#dc2626' : balance < 0 ? '#16a34a' : '#000';
      html += `
        <tr>
          <td>${account.customer?.customerCode || ''}</td>
          <td>${account.customer?.fullName || ''}</td>
          <td>${account.accountNumber || ''}</td>
          <td style="color: ${balanceColor}; font-weight: bold;">$${balance.toFixed(2)}</td>
          <td>${account.accountStatus === 'active' ? pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "活跃" }) : pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" })}</td>
        </tr>
      `;
    });

    html += '</table></body></html>';
    
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `accounts-${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
    toast.success(pickLang(language, { ku: "Excel داونلۆد کرا", en: "Excel downloaded", ar: "تم تنزيل Excel", zh: "Excel 已下载" }));
  };
  
  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const company = getCompanyInfoFromSettings(settings || []);
    const totalDebt = filteredAndSortedAccounts.reduce((sum, a) => {
      const bal = parseFloat(a.currentBalanceUsd || '0');
      return sum + (bal > 0 ? bal : 0);
    }, 0);
    
    const totalCredit = filteredAndSortedAccounts.reduce((sum, a) => {
      const bal = parseFloat(a.currentBalanceUsd || '0');
      return sum + (bal < 0 ? Math.abs(bal) : 0);
    }, 0);
    
    let tableRows = '';
    filteredAndSortedAccounts.forEach((account, index) => {
      const balance = parseFloat(account.currentBalanceUsd || '0');
      const balanceClass = balance > 0 ? 'debt' : balance < 0 ? 'credit' : '';
      tableRows += `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${account.customer?.customerCode || ''}</strong></td>
          <td>${account.customer?.fullName || ''}</td>
          <td class="mono">${account.accountNumber || ''}</td>
          <td class="${balanceClass}">$${balance.toFixed(2)}</td>
          <td><span class="badge ${account.accountStatus === 'active' ? 'active' : 'inactive'}">${account.accountStatus === 'active' ? pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "活跃" }) : pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" })}</span></td>
        </tr>
      `;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ku">
      <head>
        <meta charset="UTF-8">
        <title>${pickLang(language, { ku: "ڕاپۆرتی حسابەکان", en: "Accounts report", ar: "تقرير الحسابات", zh: "账户报告" })} - ${company.name}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; background: #f8fafc; }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 16px; margin-bottom: 30px; }
          .header h1 { font-size: 28px; margin-bottom: 8px; }
          .header p { opacity: 0.9; }
          .stats { display: flex; gap: 20px; margin-bottom: 30px; }
          .stat-card { flex: 1; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          .stat-card h3 { font-size: 14px; color: #64748b; margin-bottom: 8px; }
          .stat-card .value { font-size: 28px; font-weight: bold; }
          .stat-card .value.debt { color: #dc2626; }
          .stat-card .value.credit { color: #16a34a; }
          table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          th { background: #f1f5f9; padding: 14px 16px; text-align: right; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
          td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; }
          tr:hover { background: #f8fafc; }
          .mono { font-family: monospace; font-size: 13px; color: #64748b; }
          .debt { color: #dc2626; font-weight: 600; }
          .credit { color: #16a34a; font-weight: 600; }
          .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
          .badge.active { background: #dcfce7; color: #16a34a; }
          .badge.inactive { background: #fee2e2; color: #dc2626; }
          .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 13px; }
          @media print { body { padding: 20px; } .header { break-inside: avoid; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 ${pickLang(language, { ku: "ڕاپۆرتی حسابەکان", en: "Accounts report", ar: "تقرير الحسابات", zh: "账户报告" })}</h1>
          <p>${company.name} - ${new Date().toLocaleDateString('ku-IQ')}</p>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <h3>${pickLang(language, { ku: "کۆی حسابەکان", en: "Total accounts", ar: "إجمالي الحسابات", zh: "账户总数" })}</h3>
            <div class="value">${filteredAndSortedAccounts.length}</div>
          </div>
          <div class="stat-card">
            <h3>${pickLang(language, { ku: "کۆی قەرز", en: "Total debt", ar: "إجمالي الدين", zh: "欠款总额" })}</h3>
            <div class="value debt">$${totalDebt.toFixed(2)}</div>
          </div>
          <div class="stat-card">
            <h3>${pickLang(language, { ku: "کۆی کریدیت", en: "Total credit", ar: "إجمالي الرصيد", zh: "贷方总额" })}</h3>
            <div class="value credit">$${totalCredit.toFixed(2)}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${pickLang(language, { ku: "کۆدی کڕیار", en: "Customer code", ar: "رمز العميل", zh: "客户编号" })}</th>
              <th>${pickLang(language, { ku: "ناو", en: "Name", ar: "الاسم", zh: "姓名" })}</th>
              <th>${pickLang(language, { ku: "ژمارەی حساب", en: "Account number", ar: "رقم الحساب", zh: "账户号" })}</th>
              <th>${pickLang(language, { ku: "باڵانس (USD)", en: "Balance (USD)", ar: "الرصيد (USD)", zh: "余额 (USD)" })}</th>
              <th>${pickLang(language, { ku: "بارودۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        
        <div class="footer">
          <p>${pickLang(language, { ku: `ئەم ڕاپۆرتە لە ${new Date().toLocaleString('ku-IQ')} دروستکراوە`, en: `This report was generated on ${new Date().toLocaleString('ku-IQ')}`, ar: `تم إنشاء هذا التقرير في ${new Date().toLocaleString('ku-IQ')}`, zh: `本报告生成于 ${new Date().toLocaleString('ku-IQ')}` })}</p>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
    toast.success(pickLang(language, { ku: "PDF ئامادەیە بۆ چاپکردن", en: "PDF ready to print", ar: "ملف PDF جاهز للطباعة", zh: "PDF 已准备好打印" }));
  };

  // Filter label helper
  const getFilterLabel = (filter: AccountFilter) => {
    const labels: Record<AccountFilter, string> = {
      'all': pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" }),
      'debtors': pickLang(language, { ku: "قەرزدارەکان", en: "Debtors", ar: "المدينون", zh: "欠款客户" }),
      'credit': pickLang(language, { ku: "کریدیتدارەکان", en: "Credit holders", ar: "أصحاب الرصيد", zh: "贷方客户" }),
      'zero': pickLang(language, { ku: "سفر", en: "Zero", ar: "صفر", zh: "零" }),
      'active': pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "活跃" }),
      'inactive': pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" }),
    };
    return labels[filter];
  };
  
  // Sort label helper
  const getSortLabel = (field: SortField) => {
    const labels: Record<SortField, string> = {
      'balance': pickLang(language, { ku: "باڵانس", en: "Balance", ar: "الرصيد", zh: "余额" }),
      'name': pickLang(language, { ku: "ناو", en: "Name", ar: "الاسم", zh: "姓名" }),
      'code': pickLang(language, { ku: "کۆد", en: "Code", ar: "الرمز", zh: "编号" }),
      'date': pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" }),
    };
    return labels[field];
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Wallet className="w-6 h-6" />
                </div>
                {t("finance.title")}
              </h1>
              <p className="text-emerald-100 mt-1">{t("finance.subtitle")}</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link href="/finance/debtors">
                <Button variant="secondary" className="bg-red-500/20 hover:bg-red-500/30 text-white border-0">
                  <AlertTriangle className="w-4 h-4 me-2" />
                  {pickLang(language, { ku: "قەرزدارەکان", en: "Debtors", ar: "المدينون", zh: "欠款客户" })}
                </Button>
              </Link>
              <Dialog open={isCreatePaymentOpen} onOpenChange={setIsCreatePaymentOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                    <Plus className="w-4 h-4 me-2" />
                    {t("finance.recordPayment")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-green-500 dark:text-green-400" />
                      {t("finance.recordPayment")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("finance.recordPaymentDesc")}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreatePayment}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>{t("finance.selectCustomerLabel")} *</Label>
                        <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={customerSearchOpen}
                              className="h-11 w-full justify-between font-normal"
                            >
                              {selectedCustomerId
                                ? (() => {
                                    const c = customers?.find(c => c.id === parseInt(selectedCustomerId));
                                    return c ? `${c.fullName} (${c.customerCode})` : t("finance.selectCustomer");
                                  })()
                                : t("finance.selectCustomer")}
                              <ChevronDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent variant="panel" className="w-[400px]" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder={t("finance.searchCustomer") || pickLang(language, { ku: "گەڕان بە ناو یان کۆد...", en: "Search by name or code...", ar: "ابحث بالاسم أو الرمز...", zh: "按姓名或编号搜索..." })}
                                value={customerSearchQuery}
                                onValueChange={setCustomerSearchQuery}
                              />
                              <CommandList>
                                <CommandEmpty>{t("common.noResults") || pickLang(language, { ku: "هیچ ئەنجامێک نییە", en: "No results", ar: "لا توجد نتائج", zh: "无结果" })}</CommandEmpty>
                                <CommandGroup>
                                  {customers
                                    ?.filter(c => {
                                      if (!customerSearchQuery) return true;
                                      const q = customerSearchQuery.toLowerCase();
                                      return (
                                        (c.fullName || '').toLowerCase().includes(q) ||
                                        (c.customerCode || '').toLowerCase().includes(q) ||
                                        (c.mobileNumber || '').includes(q)
                                      );
                                    })
                                    .slice(0, 50)
                                    .map((customer) => (
                                      <CommandItem
                                        key={customer.id}
                                        value={customer.id.toString()}
                                        onSelect={() => {
                                          setSelectedCustomerId(customer.id.toString());
                                          setCustomerSearchOpen(false);
                                          setCustomerSearchQuery("");
                                        }}
                                        className="flex items-center gap-2 cursor-pointer"
                                      >
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                          {(customer.fullName || '?')[0]}
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="font-medium">{customer.fullName}</span>
                                          <span className="text-xs text-muted-foreground">{customer.customerCode} • {customer.mobileNumber || ''}</span>
                                        </div>
                                        {selectedCustomerId === customer.id.toString() && (
                                          <CheckCircle className="ml-auto h-4 w-4 text-primary" />
                                        )}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="amountUsd">{t("finance.amountUsd")} *</Label>
                          <Input
                            id="amountUsd"
                            name="amountUsd"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="h-11"
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="paymentMethod">{t("finance.method")} *</Label>
                          <Select name="paymentMethod" defaultValue="CASH">
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASH">{pickLang(language, { ku: "کاش", en: "Cash", ar: "نقدًا", zh: "现金" })}</SelectItem>
                              <SelectItem value="BANK_TRANSFER">{pickLang(language, { ku: "گواستنەوەی بانکی", en: "Bank transfer", ar: "تحويل بنكي", zh: "银行转账" })}</SelectItem>
                              <SelectItem value="FIB">FIB</SelectItem>
                              <SelectItem value="FASTPAY">FastPay</SelectItem>
                              <SelectItem value="ZAINCASH">ZainCash</SelectItem>
                              <SelectItem value="ASIAHAWALA">Asia Hawala</SelectItem>
                              <SelectItem value="CARD">{pickLang(language, { ku: "کارت", en: "Card", ar: "بطاقة", zh: "卡" })}</SelectItem>
                              <SelectItem value="OTHER">{pickLang(language, { ku: "شێوازی تر", en: "Other", ar: "أخرى", zh: "其他" })}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {/* Cash Account Selection */}
                      <div className="grid gap-2">
                        <Label>{t("bankAccounts.selectAccount") || pickLang(language, { ku: "هەژمار هەڵبژێرە", en: "Select account", ar: "اختر الحساب", zh: "选择账户" })}</Label>
                        <Popover modal={true}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="h-11 w-full justify-between font-normal">
                              {selectedCashAccountId && selectedCashAccountId !== 'none'
                                ? (() => {
                                    const acc = activeCashAccounts?.find(a => a.id.toString() === selectedCashAccountId);
                                    return acc ? `${acc.accountNameKu || acc.accountName} ($${Number(acc.currentBalance).toLocaleString()})` : t("bankAccounts.selectAccountOptional") || pickLang(language, { ku: "هەژمارێک هەڵبژێرە (ئارەزوومەندانە)", en: "Select an account (optional)", ar: "اختر حسابًا (اختياري)", zh: "选择账户（可选）" });
                                  })()
                                : t("bankAccounts.selectAccountOptional") || pickLang(language, { ku: "هەژمارێک هەڵبژێرە (ئارەزوومەندانە)", en: "Select an account (optional)", ar: "اختر حسابًا (اختياري)", zh: "选择账户（可选）" })}
                              <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent variant="panel" className="w-full min-w-[320px]" align="start">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  <CommandItem
                                    onSelect={() => setSelectedCashAccountId('none')}
                                    className="cursor-pointer"
                                  >
                                    <Check className={`me-2 h-4 w-4 ${selectedCashAccountId === 'none' || !selectedCashAccountId ? 'opacity-100' : 'opacity-0'}`} />
                                    {t("bankAccounts.noAccount") || pickLang(language, { ku: "بێ هەژمار", en: "No account", ar: "بدون حساب", zh: "无账户" })}
                                  </CommandItem>
                                  {activeCashAccounts?.map((acc) => (
                                    <CommandItem
                                      key={acc.id}
                                      onSelect={() => setSelectedCashAccountId(acc.id.toString())}
                                      className="cursor-pointer"
                                    >
                                      <Check className={`me-2 h-4 w-4 ${selectedCashAccountId === acc.id.toString() ? 'opacity-100' : 'opacity-0'}`} />
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
                        <p className="text-xs text-muted-foreground">{t("bankAccounts.accountSelectionHint") || pickLang(language, { ku: "حسابێک هەڵبژێرە بۆ تۆمارکردنی پارەدان لە حسابەکەدا", en: "Select an account to record the payment in that account", ar: "اختر حسابًا لتسجيل الدفعة في ذلك الحساب", zh: "选择一个账户以将付款记入该账户" })}</p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="referenceNumber">{t("finance.referenceNumber")}</Label>
                        <Input
                          id="referenceNumber"
                          name="referenceNumber"
                          placeholder="REF-001"
                          className="h-11"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="notes">{t("common.notes")}</Label>
                        <Input
                          id="notes"
                          name="notes"
                          placeholder={t("finance.notesPlaceholder")}
                          className="h-11"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsCreatePaymentOpen(false)}>
                        {t("common.cancel")}
                      </Button>
                      <Button type="submit" disabled={createPaymentMutation.isPending || !selectedCustomerId}>
                        {createPaymentMutation.isPending ? t("common.saving") : t("common.save")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{pickLang(language, { ku: "کۆی قەرز", en: "Total debt", ar: "إجمالي الدين", zh: "欠款总额" })}</p>
                  <p className="text-3xl font-bold text-red-700 dark:text-red-300">
                    {formatCurrency(summary?.totalDebtUsd || 0)}
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">{debtors?.length || 0} {pickLang(language, { ku: "کڕیاری قەرزدار", en: "debtor customers", ar: "عميل مدين", zh: "欠款客户" })}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-lg">
                  <TrendingUp className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">{pickLang(language, { ku: "کۆی پارەدان", en: "Total paid", ar: "إجمالي المدفوع", zh: "已付总额" })}</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(summary?.totalCreditUsd || 0)}
                  </p>
                  <p className="text-xs text-green-500 dark:text-green-400 mt-1">{payments?.length || 0} {pickLang(language, { ku: "پارەدان", en: "payments", ar: "دفعة", zh: "笔付款" })}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg">
                  <TrendingDown className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{pickLang(language, { ku: "کۆی حسابەکان", en: "Total accounts", ar: "إجمالي الحسابات", zh: "账户总数" })}</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                    {accounts?.length || 0}
                  </p>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">{pickLang(language, { ku: "حسابی چالاک", en: "Active accounts", ar: "حسابات نشطة", zh: "活跃账户" })}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                  <Users className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{pickLang(language, { ku: "باڵانسی نێت", en: "Net balance", ar: "الرصيد الصافي", zh: "净余额" })}</p>
                  <p className={`text-3xl font-bold ${((summary?.totalDebtUsd || 0) - (summary?.totalCreditUsd || 0)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency((summary?.totalDebtUsd || 0) - (summary?.totalCreditUsd || 0))}
                  </p>
                  <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">{pickLang(language, { ku: "قەرز - کریدیت", en: "Debt - Credit", ar: "الدين - الرصيد", zh: "欠款 - 贷方" })}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg">
                  <DollarSign className="h-7 w-7" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50 p-1 h-12 w-full justify-start gap-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 h-10 gap-2">
              <Receipt className="w-4 h-4" />
              {pickLang(language, { ku: "پارەدانەکان", en: "Payments", ar: "المدفوعات", zh: "付款" })}
            </TabsTrigger>
            <TabsTrigger value="accounts" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 h-10 gap-2">
              <Users className="w-4 h-4" />
              {pickLang(language, { ku: "حسابەکان", en: "Accounts", ar: "الحسابات", zh: "账户" })}
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 h-10 gap-2">
              <FileText className="w-4 h-4" />
              {pickLang(language, { ku: "پوختە", en: "Summary", ar: "ملخص", zh: "摘要" })}
            </TabsTrigger>
            <TabsTrigger value="credit-customers" className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 h-10 gap-2">
              <CreditCard className="w-4 h-4" />
              {pickLang(language, { ku: "کریدیتدارەکان", en: "Credit holders", ar: "أصحاب الرصيد", zh: "贷方客户" })}
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Customer Accounts Summary */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                    {pickLang(language, { ku: "حسابی کڕیاران", en: "Customer accounts", ar: "حسابات العملاء", zh: "客户账户" })}
                  </CardTitle>
                  <Link href="/finance?tab=accounts">
                    <Button variant="outline" size="sm">
                      {pickLang(language, { ku: "هەموو ببینە", en: "View all", ar: "عرض الكل", zh: "查看全部" })}
                      <ArrowUpRight className="w-3 h-3 ms-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{pickLang(language, { ku: "کڕیارەکان", en: "Customers", ar: "العملاء", zh: "客户" })}</TableHead>
                        <TableHead>{pickLang(language, { ku: "بارودۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                        <TableHead className="text-right">{pickLang(language, { ku: "باڵانس (USD)", en: "Balance (USD)", ar: "الرصيد (USD)", zh: "余额 (USD)" })}</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts?.slice(0, 5).map((account) => {
                        const balanceUsd = parseFloat(account.currentBalanceUsd || '0');
                        return (
                          <TableRow key={account.id} className="hover:bg-muted/50 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold">
                                  {account.customer?.fullName?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="font-medium">{account.customer?.customerCode}</p>
                                  <p className="text-sm text-muted-foreground">{account.customer?.fullName}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={account.accountStatus === 'active' ? 'default' : 'destructive'} className="gap-1">
                                {account.accountStatus === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {account.accountStatus === 'active' ? pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "活跃" }) : pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" })}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-bold text-lg ${balanceUsd > 0 ? 'text-red-600' : balanceUsd < 0 ? 'text-green-600' : ''}`}>
                              {formatCurrency(balanceUsd)}
                            </TableCell>
                            <TableCell>
                              <Link href={`/finance/customer/${account.customerId}`}>
                                <Button variant="ghost" size="sm" className="gap-1">
                                  {pickLang(language, { ku: "بینین", en: "View", ar: "عرض", zh: "查看" })}
                                  <ArrowUpRight className="w-3 h-3" />
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            
            {/* Recent Transactions */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                    {pickLang(language, { ku: "کۆی باڵانس", en: "Recent transactions", ar: "أحدث المعاملات", zh: "近期交易" })}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentTransactions?.slice(0, 8).map((tx) => {
                    const account = accounts?.find(a => a.id === tx.accountId);
                    const isDebit = tx.transactionType?.startsWith('DEBIT');
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isDebit ? 'bg-red-100 dark:bg-red-950/40 text-red-600' : 'bg-green-100 dark:bg-green-950/40 text-green-600'}`}>
                            {isDebit ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-medium">{account?.customer?.customerCode}</p>
                            <p className="text-sm text-muted-foreground">{getTransactionTypeLabel(tx.transactionType || '')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                            {isDebit ? '+' : '-'}{formatCurrency(Math.abs(Number(tx.amountUsd || 0)))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.createdAt || '').toLocaleDateString('ku-IQ')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            
            {/* Debtors Alert */}
            <Card className="border-0 shadow-lg border-l-4 border-l-red-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                    {t("auto.text_8f3c5b")}
                  </CardTitle>
                  <Link href="/finance/debtors">
                    <Button variant="outline" size="sm">
                      {t("auto.text_8247ac")}
                      <ArrowUpRight className="w-3 h-3 ms-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {debtors?.slice(0, 4).map((debtor) => (
                    <div key={debtor.customerId} className="p-4 border rounded-xl bg-gradient-to-br from-red-50 dark:from-red-950/40 to-rose-50 dark:to-rose-950/40 border-red-200 dark:border-red-800/60 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="bg-white dark:bg-card">{debtor.customer?.customerCode}</Badge>
                        <span className="text-red-600 dark:text-red-300 font-bold">{formatCurrency(String(debtor.balanceUsd || 0))}</span>
                      </div>
                      <p className="font-medium">{debtor.customer?.fullName}</p>
                      <p className="text-sm text-muted-foreground">{debtor.customer?.mobileNumber}</p>
                      <div className="mt-3">
                        <Link href={`/finance/customer/${debtor.customerId}`}>
                          <Button variant="outline" size="sm" className="w-full">
                            <Receipt className="w-3 h-3 me-1" />
                            {t("common.details")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3 border-b">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                    {pickLang(language, { ku: "هەموو حسابەکان", en: "All accounts", ar: "جميع الحسابات", zh: "所有账户" })}
                    <Badge variant="secondary" className="ms-2">{filteredAndSortedAccounts.length}</Badge>
                  </CardTitle>
                  
                  <div className="flex flex-wrap items-center gap-3 lg:mr-auto">
                    {/* Search */}
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder={pickLang(language, { ku: "گەڕان بە کۆد، ناو، یان مۆبایل...", en: "Search by code, name, or mobile...", ar: "ابحث بالرمز أو الاسم أو الهاتف...", zh: "按编号、姓名或手机搜索..." })}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10"
                      />
                    </div>
                    
                    {/* Filter Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10 gap-2">
                          <Filter className="w-4 h-4" />
                          {getFilterLabel(accountFilter)}
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>{pickLang(language, { ku: "فلتەری حساب", en: "Account filter", ar: "تصفية الحساب", zh: "账户筛选" })}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setAccountFilter('all')} className={accountFilter === 'all' ? 'bg-muted' : ''}>
                          {pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAccountFilter('debtors')} className={accountFilter === 'debtors' ? 'bg-muted' : ''}>
                          <TrendingUp className="w-4 h-4 me-2 text-red-500 dark:text-red-400" />
                          {pickLang(language, { ku: "قەرزدارەکان", en: "Debtors", ar: "المدينون", zh: "欠款客户" })}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAccountFilter('credit')} className={accountFilter === 'credit' ? 'bg-muted' : ''}>
                          <TrendingDown className="w-4 h-4 me-2 text-green-500 dark:text-green-400" />
                          {pickLang(language, { ku: "کریدیتدارەکان", en: "Credit holders", ar: "أصحاب الرصيد", zh: "贷方客户" })}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAccountFilter('zero')} className={accountFilter === 'zero' ? 'bg-muted' : ''}>
                          {pickLang(language, { ku: "سفر", en: "Zero", ar: "صفر", zh: "零" })}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setAccountFilter('active')} className={accountFilter === 'active' ? 'bg-muted' : ''}>
                          <CheckCircle className="w-4 h-4 me-2 text-green-500 dark:text-green-400" />
                          {pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "活跃" })}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAccountFilter('inactive')} className={accountFilter === 'inactive' ? 'bg-muted' : ''}>
                          <XCircle className="w-4 h-4 me-2 text-red-500 dark:text-red-400" />
                          {pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" })}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {/* Sort Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10 gap-2">
                          {sortDirection === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                          {getSortLabel(sortField)}
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>{pickLang(language, { ku: "ڕیزکردن بەپێی", en: "Sort by", ar: "ترتيب حسب", zh: "排序方式" })}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setSortField('balance'); setSortDirection('desc'); }}>
                          <TrendingUp className="w-4 h-4 me-2" />
                          {pickLang(language, { ku: "زۆرترین قەرز", en: "Highest debt", ar: "أعلى دين", zh: "欠款最多" })}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSortField('balance'); setSortDirection('asc'); }}>
                          <TrendingDown className="w-4 h-4 me-2" />
                          {pickLang(language, { ku: "زۆرترین کریدیت", en: "Highest credit", ar: "أعلى رصيد", zh: "贷方最多" })}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSortField('name'); setSortDirection('asc'); }}>
                          {pickLang(language, { ku: "ناو (A-Z)", en: "Name (A-Z)", ar: "الاسم (أ-ي)", zh: "姓名 (A-Z)" })}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSortField('code'); setSortDirection('asc'); }}>
                          {pickLang(language, { ku: "کۆد", en: "Code", ar: "الرمز", zh: "编号" })}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSortField('date'); setSortDirection('desc'); }}>
                          {pickLang(language, { ku: "نوێترین", en: "Newest", ar: "الأحدث", zh: "最新" })}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {/* Export Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="default" className="h-10 gap-2 bg-emerald-600 hover:bg-emerald-700">
                          <Download className="w-4 h-4" />
                          {pickLang(language, { ku: "داونلۆد", en: "Download", ar: "تنزيل", zh: "下载" })}
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>{pickLang(language, { ku: "داونلۆدی ڕاپۆرت", en: "Download report", ar: "تنزيل التقرير", zh: "下载报告" })}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={exportToPDF}>
                          <FileText className="w-4 h-4 me-2 text-red-500 dark:text-red-400" />
                          PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToExcel}>
                          <FileSpreadsheet className="w-4 h-4 me-2 text-green-500 dark:text-green-400" />
                          Excel
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToCSV}>
                          <FileText className="w-4 h-4 me-2 text-blue-500 dark:text-blue-400" />
                          CSV
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {accountsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="font-semibold">{pickLang(language, { ku: "کڕیارەکان", en: "Customers", ar: "العملاء", zh: "客户" })}</TableHead>
                          <TableHead className="font-semibold">{pickLang(language, { ku: "ژمارەی حساب", en: "Account number", ar: "رقم الحساب", zh: "账户号" })}</TableHead>
                          <TableHead className="text-right font-semibold">{pickLang(language, { ku: "باڵانس (USD)", en: "Balance (USD)", ar: "الرصيد (USD)", zh: "余额 (USD)" })}</TableHead>
                          <TableHead className="font-semibold">{pickLang(language, { ku: "بارودۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedAccounts.map((account) => {
                          const balanceUsd = parseFloat(account.currentBalanceUsd || '0');
                          return (
                            <TableRow key={account.id} className="hover:bg-muted/50 transition-colors">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold shadow">
                                    {account.customer?.fullName?.charAt(0) || '?'}
                                  </div>
                                  <div>
                                    <p className="font-semibold">{account.customer?.customerCode}</p>
                                    <p className="text-sm text-muted-foreground">{account.customer?.fullName}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground">{account.accountNumber}</TableCell>
                              <TableCell className={`text-right font-bold text-lg ${balanceUsd > 0 ? 'text-red-600' : balanceUsd < 0 ? 'text-green-600' : ''}`}>
                                {formatCurrency(balanceUsd)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={account.accountStatus === 'active' ? 'default' : 'destructive'} className="gap-1">
                                  {account.accountStatus === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {account.accountStatus === 'active' ? pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "活跃" }) : pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" })}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Link href={`/finance/customer/${account.customerId}`}>
                                  <Button variant="ghost" size="sm" className="gap-1">
                                    بینین
                                    <ArrowUpRight className="w-3 h-3" />
                                  </Button>
                                </Link>
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
          
          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            {/* Payment Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("finance.totalReceived")}</p>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-300">${totalPayments.toFixed(2)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("finance.cash")}</p>
                      <p className="text-3xl font-bold">${cashPayments.toFixed(2)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center text-white shadow-lg">
                      <Banknote className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("finance.bankTransfer")}</p>
                      <p className="text-3xl font-bold">${bankPayments.toFixed(2)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
                      <Building className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Payments List */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("finance.searchPayments")}
                      value={paymentSearch}
                      onChange={(e) => setPaymentSearch(e.target.value)}
                      className="pl-9 h-11 bg-background"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant={methodFilter === "all" ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setMethodFilter("all")}
                      className="h-9"
                    >
                      {t("common.all")}
                    </Button>
                    <Button 
                      variant={methodFilter === "cash" ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setMethodFilter("cash")}
                      className="h-9"
                    >
                      <Banknote className="h-4 w-4 me-1" /> {t("finance.cash")}
                    </Button>
                    <Button 
                      variant={methodFilter === "bank_transfer" ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setMethodFilter("bank_transfer")}
                      className="h-9"
                    >
                      <Building className="h-4 w-4 me-1" /> {t("finance.bank")}
                    </Button>
                    <Button 
                      variant={methodFilter === "card" ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setMethodFilter("card")}
                      className="h-9"
                    >
                      <CreditCard className="h-4 w-4 me-1" /> {t("finance.card")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">{t("common.date")}</TableHead>
                      <TableHead className="font-semibold">{t("customers.title")}</TableHead>
                      <TableHead className="font-semibold">{t("common.amount")}</TableHead>
                      <TableHead className="font-semibold">{t("finance.method")}</TableHead>
                      <TableHead className="font-semibold">{t("finance.referenceNumber")}</TableHead>
                      <TableHead className="font-semibold">{t("common.notes")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments?.map((payment) => {
                      const account = accounts?.find(a => a.id === payment.accountId);
                      const customer = account?.customer;
                      return (
                        <TableRow key={payment.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {new Date(payment.createdAt || '').toLocaleDateString('ku-IQ')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                                {customer?.fullName?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{customer?.customerCode}</p>
                                <p className="text-xs text-muted-foreground">{customer?.fullName}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-green-600 dark:text-green-300">
                              +{formatCurrency(Math.abs(Number(payment.amountUsd || 0)))}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={getMethodColor('cash')}>
                              {getMethodIcon('cash')}
                              <span className="ms-1">{t("finance.cash")}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {payment.transactionNumber || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {payment.description || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Credit Customers Tab */}
          <TabsContent value="credit-customers" className="space-y-4">
            {/* Credit Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-100/50 dark:from-emerald-950/20 dark:to-teal-900/10">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{pickLang(language, { ku: "کۆی کریدیت", en: "Total credit", ar: "إجمالي الرصيد", zh: "贷方总额" })}</p>
                      <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(totalCreditAmount)}
                      </p>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg">
                      <CreditCard className="h-7 w-7" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-100/50 dark:from-blue-950/20 dark:to-indigo-900/10">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{pickLang(language, { ku: "ژمارەی کڕیاری کریدیتدار", en: "Number of credit holders", ar: "عدد العملاء أصحاب الرصيد", zh: "贷方客户数量" })}</p>
                      <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                        {creditCustomers.length}
                      </p>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                      <Users className="h-7 w-7" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-violet-100/50 dark:from-purple-950/20 dark:to-violet-900/10">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600 dark:text-purple-400">{pickLang(language, { ku: "ناوەندی کریدیت", en: "Average credit", ar: "متوسط الرصيد", zh: "平均贷方" })}</p>
                      <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                        {formatCurrency(creditCustomers.length > 0 ? totalCreditAmount / creditCustomers.length : 0)}
                      </p>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shadow-lg">
                      <DollarSign className="h-7 w-7" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Filters & Export */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3 border-b bg-gradient-to-r from-muted/50 to-muted/30">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                    {pickLang(language, { ku: "کڕیارانی کریدیتدار", en: "Credit customers", ar: "العملاء أصحاب الرصيد", zh: "贷方客户" })}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportCreditToExcel} className="gap-1">
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportCreditToPDF} className="gap-1">
                      <FileText className="w-4 h-4" />
                      PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={pickLang(language, { ku: "گەڕان بە ناو، کۆد، یان ژمارە...", en: "Search by name, code, or number...", ar: "ابحث بالاسم أو الرمز أو الرقم...", zh: "按姓名、编号或号码搜索..." })}
                      value={creditSearch}
                      onChange={(e) => setCreditSearch(e.target.value)}
                      className="pl-10 h-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder={pickLang(language, { ku: "کەمترین بڕ", en: "Min amount", ar: "أقل مبلغ", zh: "最小金额" })}
                      value={creditMinAmount}
                      onChange={(e) => setCreditMinAmount(e.target.value)}
                      className="w-32 h-10"
                    />
                    <Input
                      type="number"
                      placeholder={pickLang(language, { ku: "زۆرترین بڕ", en: "Max amount", ar: "أقصى مبلغ", zh: "最大金额" })}
                      value={creditMaxAmount}
                      onChange={(e) => setCreditMaxAmount(e.target.value)}
                      className="w-32 h-10"
                    />
                  </div>
                  <Select value={creditSortField} onValueChange={(v: any) => setCreditSortField(v)}>
                    <SelectTrigger className="w-40 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balance">{pickLang(language, { ku: "بڕی کریدیت", en: "Credit amount", ar: "مبلغ الرصيد", zh: "贷方金额" })}</SelectItem>
                      <SelectItem value="name">{pickLang(language, { ku: "ناو", en: "Name", ar: "الاسم", zh: "姓名" })}</SelectItem>
                      <SelectItem value="code">{pickLang(language, { ku: "کۆد", en: "Code", ar: "الرمز", zh: "编号" })}</SelectItem>
                      <SelectItem value="lastTransaction">{pickLang(language, { ku: "دوایین مامەڵە", en: "Last transaction", ar: "آخر معاملة", zh: "最近交易" })}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setCreditSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                  >
                    {creditSortDir === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                  </Button>
                </div>
                
                {/* Table */}
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>{pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}</TableHead>
                        <TableHead>{pickLang(language, { ku: "ژمارەی مۆبایل", en: "Mobile number", ar: "رقم الهاتف", zh: "手机号" })}</TableHead>
                        <TableHead className="text-right">{pickLang(language, { ku: "بڕی کریدیت (USD)", en: "Credit amount (USD)", ar: "مبلغ الرصيد (USD)", zh: "贷方金额 (USD)" })}</TableHead>
                        <TableHead>{pickLang(language, { ku: "بارودۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditCustomers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-lg font-medium">{pickLang(language, { ku: "هیچ کڕیارێکی کریدیتدار نییە", en: "No credit customers", ar: "لا يوجد عملاء أصحاب رصيد", zh: "没有贷方客户" })}</p>
                            <p className="text-sm">{pickLang(language, { ku: "کاتێک کڕیارێک کریدیتی هەبێت لێرە نیشان دەدرێت", en: "When a customer has credit, they appear here", ar: "عندما يكون لدى عميل رصيد، يظهر هنا", zh: "当客户有贷方余额时将显示在此处" })}</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        creditCustomers.map((account, index) => {
                          const balance = Math.abs(parseFloat(account.currentBalanceUsd || '0'));
                          return (
                            <TableRow key={account.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-colors">
                              <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow">
                                    {account.customer?.fullName?.charAt(0) || '?'}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-sm">{account.customer?.fullName}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{account.customer?.customerCode}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {account.customer?.mobileNumber || '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                                  {formatCurrency(balance)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className={account.accountStatus === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}>
                                  {account.accountStatus === 'active' ? pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "活跃" }) : pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" })}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Link href={`/customers/${account.customer?.id}`}>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <ArrowUpRight className="w-4 h-4" />
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Footer Summary */}
                {creditCustomers.length > 0 && (
                  <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                        <CreditCard className="w-5 h-5" />
                        <span className="font-semibold">{pickLang(language, { ku: "کۆی گشتی", en: "Grand total", ar: "الإجمالي العام", zh: "总计" })}: {creditCustomers.length} {pickLang(language, { ku: "کڕیار", en: "customers", ar: "عميل", zh: "客户" })}</span>
                      </div>
                      <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(totalCreditAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
