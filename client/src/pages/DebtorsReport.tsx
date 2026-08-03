import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  DollarSign,
  Users,
  Download,
  Search,
  TrendingUp,
  Phone,
  Eye,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { Money } from "@/components/ui/money";
import { MiniProgress } from "@/components/dashboard/MiniProgress";

type AgingCategory = 'all' | '0-30' | '30-60' | '60-90' | '90+';

export default function DebtorsReport() {
    const { t } = useTranslation();
const [searchTerm, setSearchTerm] = useState("");
  const [agingFilter, setAgingFilter] = useState<AgingCategory>("all");
  const [sortBy, setSortBy] = useState<'balance' | 'days'>('balance');
  
  const { data: accounts, isLoading } = trpc.ledger.getAllAccounts.useQuery();
  
  // Calculate aging for each account
  const debtorAccounts = useMemo(() => {
    if (!accounts) return [];
    
    return accounts
      .filter((acc: any) => parseFloat(acc.currentBalanceUsd || '0') > 0)
      .map((acc: any) => {
        const lastActivityDate = acc.lastTransactionDate ? new Date(acc.lastTransactionDate) : new Date(acc.createdAt);
        const daysSinceActivity = Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let agingCategory: '0-30' | '30-60' | '60-90' | '90+';
        if (daysSinceActivity <= 30) agingCategory = '0-30';
        else if (daysSinceActivity <= 60) agingCategory = '30-60';
        else if (daysSinceActivity <= 90) agingCategory = '60-90';
        else agingCategory = '90+';
        
        return {
          ...acc,
          daysSinceActivity,
          agingCategory,
        };
      });
  }, [accounts]);
  
  // Filter and sort
  const filteredDebtors = useMemo(() => {
    let result = debtorAccounts;
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((acc: any) => 
        acc.customerCode?.toLowerCase().includes(term) ||
        acc.accountNumber?.toLowerCase().includes(term)
      );
    }
    
    // Aging filter
    if (agingFilter !== 'all') {
      result = result.filter((acc: any) => acc.agingCategory === agingFilter);
    }
    
    // Sort
    if (sortBy === 'balance') {
      result = [...result].sort((a: any, b: any) => parseFloat(b.currentBalanceUsd || '0') - parseFloat(a.currentBalanceUsd || '0'));
    } else {
      result = [...result].sort((a: any, b: any) => b.daysSinceActivity - a.daysSinceActivity);
    }
    
    return result;
  }, [debtorAccounts, searchTerm, agingFilter, sortBy]);
  
  // Calculate summary stats
  const stats = useMemo(() => {
    const total = debtorAccounts.reduce((sum: number, acc: any) => sum + parseFloat(acc.currentBalanceUsd || '0'), 0);
    const aging0_30 = debtorAccounts.filter((a: any) => a.agingCategory === '0-30').reduce((sum: number, acc: any) => sum + parseFloat(acc.currentBalanceUsd || '0'), 0);
    const aging30_60 = debtorAccounts.filter((a: any) => a.agingCategory === '30-60').reduce((sum: number, acc: any) => sum + parseFloat(acc.currentBalanceUsd || '0'), 0);
    const aging60_90 = debtorAccounts.filter((a: any) => a.agingCategory === '60-90').reduce((sum: number, acc: any) => sum + parseFloat(acc.currentBalanceUsd || '0'), 0);
    const aging90Plus = debtorAccounts.filter((a: any) => a.agingCategory === '90+').reduce((sum: number, acc: any) => sum + parseFloat(acc.currentBalanceUsd || '0'), 0);
    
    return {
      totalDebt: total,
      totalDebtors: debtorAccounts.length,
      aging0_30,
      aging30_60,
      aging60_90,
      aging90Plus,
      count0_30: debtorAccounts.filter((a: any) => a.agingCategory === '0-30').length,
      count30_60: debtorAccounts.filter((a: any) => a.agingCategory === '30-60').length,
      count60_90: debtorAccounts.filter((a: any) => a.agingCategory === '60-90').length,
      count90Plus: debtorAccounts.filter((a: any) => a.agingCategory === '90+').length,
    };
  }, [debtorAccounts]);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };
  
  const getAgingBadge = (category: string) => {
    switch (category) {
      case '0-30':
        return <Badge className="bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200">{t("auto.text_9c94d3")} </Badge>;
      case '30-60':
        return <Badge className="bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-200">{t("auto.text_89c656")} </Badge>;
      case '60-90':
        return <Badge className="bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-200">{t("auto.text_aebd66")} </Badge>;
      case '90+':
        return <Badge className="bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-200">{t("auto.text_3192e6")} </Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/finance">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">{t("auto.text_fcb1a0")} </h1>
                <p className="text-red-100">{t("auto.text_cad531")} </p>
              </div>
            </div>
            <Button variant="secondary" size="sm">
              <Download className="w-4 h-4 me-2" />{t("actions.download")}</Button>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("finance.totalDebt")}</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalDebt)}</p>
                  <p className="text-xs text-muted-foreground">{stats.totalDebtors} {t("auto.text_cfa8e7")}</p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-full">
                  <DollarSign className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`border-l-4 border-l-green-500 cursor-pointer hover:shadow-md transition-shadow ${agingFilter === '0-30' ? 'ring-2 ring-green-500' : ''}`}
                onClick={() => setAgingFilter(agingFilter === '0-30' ? 'all' : '0-30')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("auto.text_9c94d3")} </p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(stats.aging0_30)}</p>
                  <p className="text-xs text-muted-foreground">{stats.count0_30} {t("common.customer")}</p>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-950/40 rounded-full">
                  <Clock className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`border-l-4 border-l-yellow-500 cursor-pointer hover:shadow-md transition-shadow ${agingFilter === '30-60' ? 'ring-2 ring-yellow-500' : ''}`}
                onClick={() => setAgingFilter(agingFilter === '30-60' ? 'all' : '30-60')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("auto.text_89c656")} </p>
                  <p className="text-xl font-bold text-yellow-600">{formatCurrency(stats.aging30_60)}</p>
                  <p className="text-xs text-muted-foreground">{stats.count30_60} {t("common.customer")}</p>
                </div>
                <div className="p-2 bg-yellow-100 dark:bg-yellow-950/40 rounded-full">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`border-l-4 border-l-orange-500 cursor-pointer hover:shadow-md transition-shadow ${agingFilter === '60-90' ? 'ring-2 ring-orange-500' : ''}`}
                onClick={() => setAgingFilter(agingFilter === '60-90' ? 'all' : '60-90')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("auto.text_aebd66")} </p>
                  <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.aging60_90)}</p>
                  <p className="text-xs text-muted-foreground">{stats.count60_90} {t("common.customer")}</p>
                </div>
                <div className="p-2 bg-orange-100 dark:bg-orange-950/40 rounded-full">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`border-l-4 border-l-red-700 cursor-pointer hover:shadow-md transition-shadow ${agingFilter === '90+' ? 'ring-2 ring-red-700' : ''}`}
                onClick={() => setAgingFilter(agingFilter === '90+' ? 'all' : '90+')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("auto.text_3192e6")} </p>
                  <p className="text-xl font-bold text-red-700 dark:text-red-300">{formatCurrency(stats.aging90Plus)}</p>
                  <p className="text-xs text-muted-foreground">{stats.count90Plus} {t("common.customer")}</p>
                </div>
                <div className="p-2 bg-red-100 dark:bg-red-950/40 rounded-full">
                  <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-300" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debt Aging breakdown — display-only aggregation of already-computed stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" />
              {t("finance.debtAging") || "تەمەنی قەرز"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(() => {
              const sixtyPlusTotal = stats.aging60_90 + stats.aging90Plus;
              const sixtyPlusCount = stats.count60_90 + stats.count90Plus;
              const maxBucket = Math.max(
                stats.aging0_30,
                stats.aging30_60,
                sixtyPlusTotal,
                1,
              );
              const buckets = [
                {
                  label: t("finance.aging0_30") || "٠–٣٠ ڕۆژ",
                  total: stats.aging0_30,
                  count: stats.count0_30,
                  color: "bg-emerald-500",
                },
                {
                  label: t("finance.aging30_60") || "٣٠–٦٠ ڕۆژ",
                  total: stats.aging30_60,
                  count: stats.count30_60,
                  color: "bg-amber-500",
                },
                {
                  label: t("finance.aging60Plus") || "٦٠+ ڕۆژ",
                  total: sixtyPlusTotal,
                  count: sixtyPlusCount,
                  color: "bg-red-600",
                },
              ];
              return buckets.map((b) => (
                <div key={b.label} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-foreground">{b.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {b.count} {t("common.customer")}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    <Money value={b.total} decimals={0} />
                  </div>
                  <MiniProgress value={Math.round(b.total)} max={Math.round(maxBucket)} color={b.color} />
                </div>
              ));
            })()}
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t("auto.text_fd2772")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("tables.sort")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance">{t("auto.text_da16dd")} </SelectItem>
                  <SelectItem value="days">{t("auto.text_02bd7d")} </SelectItem>
                </SelectContent>
              </Select>
              {agingFilter !== 'all' && (
                <Button variant="outline" onClick={() => setAgingFilter('all')}>
                  {t("auto.text_b6ca18")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Debtors Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t("auto.text_c552b6")} ({filteredDebtors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">{t("common.loading")}</div>
            ) : filteredDebtors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("auto.text_295932")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("customers.customerCode")}</TableHead>
                    <TableHead>{t("finance.accountNumber")}</TableHead>
                    <TableHead className="text-right">{t("companyFinance.debtAmount")}</TableHead>
                    <TableHead>{t("auto.text_675273")} </TableHead>
                    <TableHead>{t("common.days")}</TableHead>
                    <TableHead>{t("customers.lastActivity")}</TableHead>
                    <TableHead>{t("auto.text_610226")} </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDebtors.map((debtor: any) => (
                    <TableRow key={debtor.id}>
                      <TableCell className="font-medium">{debtor.customerCode}</TableCell>
                      <TableCell className="font-mono text-sm">{debtor.accountNumber}</TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {formatCurrency(parseFloat(debtor.currentBalanceUsd || '0'))}
                      </TableCell>
                      <TableCell>{getAgingBadge(debtor.agingCategory)}</TableCell>
                      <TableCell>{debtor.daysSinceActivity} ڕ{t("auto.text_05f45d")}</TableCell>
                      <TableCell>
                        {debtor.lastTransactionDate 
                          ? new Date(debtor.lastTransactionDate).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/finance/customer/${debtor.customerId}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
