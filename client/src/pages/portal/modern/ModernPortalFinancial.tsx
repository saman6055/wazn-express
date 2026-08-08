import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { ModernPortalLayout } from "@/components/ModernPortalLayout";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Clock,
  Receipt, Download, FileText, CreditCard,
  TrendingUp, AlertCircle, CheckCircle2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatementPdfButton } from "@/components/portal/StatementPdfButton";
import { OrderBillingGroups } from "@/components/portal/OrderBillingGroups";
import { WhatsAppHelpButton } from "@/components/portal/WhatsAppHelpButton";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { pickLang } from "@/lib/lang";
import { isCreditTx, isDebt, isInvoiceOutstanding, formatIqdAmount, describeLedgerRef } from "@/lib/portalMoney";
import { PortalErrorState } from "@/components/portal/PortalErrorState";
import { formatPortalDate } from "@/lib/portalClock";

type FilterTab = "all" | "credit" | "debit";

export default function ModernPortalFinancial() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [receiptTxId, setReceiptTxId] = useState<number | null>(null);

  const { data: summary, isLoading: summaryLoading } =
    trpc.customerPortal.getMyFinancialSummary.useQuery();
  const txQuery = trpc.customerPortal.getMyTransactions.useQuery({ limit: 50 });
  const { data: transactions, isLoading: transactionsLoading } = txQuery;
  const { data: invoices, isLoading: invoicesLoading } =
    trpc.customerPortal.getMyInvoices.useQuery();
  const { data: receiptData, isLoading: receiptLoading } =
    trpc.customerPortal.getReceiptData.useQuery(
      { transactionId: receiptTxId! },
      { enabled: !!receiptTxId }
    );

  // These three filters tested strings the database has never produced
  // ("payment", "unpaid", "charge"), so both tabs were permanently empty, the
  // unpaid-invoice section never rendered, and every payment the customer had
  // made was drawn as another charge. They now go through the shared rules.
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (activeTab === "all") return transactions;
    if (activeTab === "credit") return transactions.filter((tx: any) => isCreditTx(tx.transactionType));
    return transactions.filter((tx: any) => !isCreditTx(tx.transactionType));
  }, [transactions, activeTab]);

  const unpaidInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter((inv: any) => isInvoiceOutstanding(inv.status));
  }, [invoices]);

  const totalPaid = useMemo(() => {
    return summary?.totalPaid ?? 0;
  }, [summary]);

  const isCredit = (type: string) => isCreditTx(type);

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `$${Math.abs(num).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return formatPortalDate(date, language);
  };

  const handleDownloadReceipt = (txId: number) => {
    setReceiptTxId(txId);
  };

  const tabs: { value: FilterTab; label: string }[] = [
    { value: "all", label: t("portal.all") },
    {
      value: "credit",
      label: language === "ku" ? "واردە" : language === "ar" ? "وارد" : language === "zh" ? "收入" : "Credits",
    },
    {
      value: "debit",
      label: language === "ku" ? "دەرچووە" : language === "ar" ? "صادر" : language === "zh" ? "支出" : "Debits",
    },
  ];

  return (
    <ModernPortalLayout>
      <div className={cn("min-h-screen pb-24", isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

          {/* Balance Hero Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn(
              "rounded-2xl p-6 shadow-sm relative overflow-hidden",
              isDark
                ? "bg-gradient-to-br from-emerald-900/60 to-teal-900/40 border border-emerald-800/40"
                : "bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 dark:border-emerald-800/60"
            )}
          >
            <div className="absolute top-0 end-0 w-32 h-32 rounded-full bg-emerald-400/10 -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  isDark ? "bg-emerald-500/20" : "bg-emerald-500/10"
                )}>
                  <Wallet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className={cn(
                    "text-sm",
                    isDark ? "text-emerald-300/70" : "text-emerald-700 dark:text-emerald-300/70"
                  )}>
                    {t("portal.totalBalance")}
                  </p>
                </div>
              </div>

              {summaryLoading ? (
                <Skeleton className="h-12 w-40 mb-2" />
              ) : (
                <>
                  <h1 className={cn(
                    "text-4xl font-bold font-mono tracking-tight",
                    isDark ? "text-white" : "text-slate-900 dark:text-slate-200"
                  )}>
                    {/* Signed and unlabelled, this read as money the customer
                        HAS. Positive means they owe it, so say which. */}
                    <span dir="ltr">${Math.abs(summary?.balanceUsd ?? 0).toFixed(2)}</span>
                    <span className={cn(
                      "text-base font-normal ms-2",
                      isDark ? "text-emerald-300/60" : "text-emerald-600/60"
                    )}>
                      USD
                    </span>
                    {isDebt(summary?.balanceUsd) && (
                      <span className="ms-2 rounded-full bg-red-500/25 px-2 py-0.5 align-middle text-xs font-medium text-red-200">
                        {pickLang(language, { ku: "قەرز", en: "Owed", ar: "مستحق", zh: "欠款" })}
                      </span>
                    )}
                  </h1>
                  {(summary?.balanceIqd ?? 0) !== 0 && (
                    <p className={cn(
                      "text-sm font-mono mt-1",
                      isDark ? "text-emerald-300/50" : "text-emerald-700 dark:text-emerald-300/50"
                    )}>
                      {new Intl.NumberFormat("en-US").format(Number(summary?.balanceIqd ?? 0))} IQD
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                icon: TrendingUp,
                label: t("portal.totalPaid"),
                value: formatCurrency(totalPaid),
                color: "text-emerald-600 dark:text-emerald-400",
                bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50 dark:bg-emerald-950/40",
                iconBg: isDark ? "bg-emerald-500/20" : "bg-emerald-100 dark:bg-emerald-950/40",
              },
              {
                icon: FileText,
                label: t("portal.unpaidInvoices"),
                value: String(unpaidInvoices.length),
                color: "text-amber-600 dark:text-amber-400",
                bg: isDark ? "bg-amber-500/10" : "bg-amber-50 dark:bg-amber-950/40",
                iconBg: isDark ? "bg-amber-500/20" : "bg-amber-100 dark:bg-amber-950/40",
              },
              {
                icon: CreditCard,
                // Was labelled "Balance", next to a hero card also labelled
                // "Balance" showing a different number. This one is the credit
                // limit and always was.
                label: pickLang(language, { ku: "سنووری قەرز", en: "Credit limit", ar: "حد الائتمان", zh: "信用额度" }),
                value: formatCurrency(summary?.creditLimitUsd ?? 0),
                color: "text-sky-600 dark:text-sky-400",
                bg: isDark ? "bg-sky-500/10" : "bg-sky-50 dark:bg-sky-950/40",
                iconBg: isDark ? "bg-sky-500/20" : "bg-sky-100 dark:bg-sky-950/40",
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className={cn(
                  "rounded-2xl p-3 shadow-sm border",
                  isDark ? "border-slate-700/50" : "border-slate-100 dark:border-slate-800/60",
                  stat.bg
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", stat.iconBg)}>
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                </div>
                <p className={cn("text-lg font-bold font-mono", isDark ? "text-white" : "text-slate-900 dark:text-slate-200")}>
                  {stat.value}
                </p>
                <p className={cn("text-[11px] leading-tight", isDark ? "text-slate-400" : "text-slate-500")}>
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Filter Tabs */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "flex rounded-xl p-1 gap-1",
              isDark ? "bg-slate-800/60" : "bg-slate-100 dark:bg-slate-950/40"
            )}
          >
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  activeTab === tab.value
                    ? cn(
                        "shadow-sm",
                        isDark
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-emerald-700 dark:text-emerald-300 shadow-sm"
                      )
                    : isDark
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </motion.div>

          {/* Transaction List - Timeline style */}
          <div>
            <h2 className={cn(
              "text-lg font-bold mb-3",
              isDark ? "text-white" : "text-slate-900 dark:text-slate-200"
            )}>
              {t("portal.paymentHistory")}
            </h2>

            {transactionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-18 w-full rounded-2xl" />
                ))}
              </div>
            ) : txQuery.isError ? (
              /* On the money screen a failed request read as "no transactions". */
              <PortalErrorState onRetry={() => void txQuery.refetch()} isRetrying={txQuery.isFetching} />
            ) : filteredTransactions.length > 0 ? (
              <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                  {filteredTransactions.map((tx: any, index: number) => {
                    const credit = isCredit(tx.transactionType);

                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ delay: index * 0.03 }}
                        layout
                        className={cn(
                          "rounded-2xl p-4 shadow-sm border transition-colors",
                          isDark
                            ? "bg-slate-800/50 border-slate-700/40 hover:bg-slate-800/70"
                            : "bg-white border-slate-100 dark:border-slate-800/60 hover:border-slate-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {/* Icon */}
                          <div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                              credit
                                ? isDark
                                  ? "bg-emerald-500/15"
                                  : "bg-emerald-50 dark:bg-emerald-950/40"
                                : isDark
                                ? "bg-red-500/15"
                                : "bg-red-50 dark:bg-red-950/40"
                            )}
                          >
                            {credit ? (
                              <ArrowDownLeft
                                className={cn(
                                  "w-5 h-5",
                                  isDark ? "text-emerald-400" : "text-emerald-600"
                                )}
                              />
                            ) : (
                              <ArrowUpRight
                                className={cn(
                                  "w-5 h-5",
                                  isDark ? "text-red-400" : "text-red-500"
                                )}
                              />
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-medium truncate",
                                isDark ? "text-white" : "text-slate-900 dark:text-slate-200"
                              )}
                            >
                              {describeLedgerRef(tx.description, language) ||
                                tx.transactionNumber ||
                                (pickLang(language, { ku: "مامەڵە", en: "Transaction", ar: "معاملة", zh: "交易" }))}
                            </p>
                            <p
                              className={cn(
                                "text-xs mt-0.5",
                                isDark ? "text-slate-500" : "text-slate-400"
                              )}
                            >
                              {formatDate(tx.createdAt)}
                            </p>
                          </div>

                          {/* Amount + Download */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={cn(
                                "text-sm font-bold font-mono",
                                credit
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-500 dark:text-red-400"
                              )}
                            >
                              {credit ? "+" : "-"}
                              {formatCurrency(tx.amountUsd)}
                              {/* The dinar posted with this line, at that
                                  day's rate — not recomputed from today's. */}
                              {formatIqdAmount(tx.amountIqd) && (
                                <span className="block text-[10px] font-normal text-muted-foreground" dir="ltr">
                                  {formatIqdAmount(tx.amountIqd)}
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => handleDownloadReceipt(tx.id)}
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                isDark
                                  ? "hover:bg-slate-700 text-slate-500"
                                  : "hover:bg-slate-100 text-slate-400"
                              )}
                              title={t("portal.downloadInvoice")}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-2xl p-10 text-center shadow-sm border",
                  isDark
                    ? "bg-slate-800/50 border-slate-700/40"
                    : "bg-white border-slate-100 dark:border-slate-800/60"
                )}
              >
                <Receipt
                  className={cn(
                    "w-12 h-12 mx-auto mb-3",
                    isDark ? "text-slate-600" : "text-slate-300"
                  )}
                />
                <h3
                  className={cn(
                    "font-bold mb-1",
                    isDark ? "text-white" : "text-slate-900 dark:text-slate-200"
                  )}
                >
                  {t("portal.noTransactions")}
                </h3>
                <p className={cn("text-sm", isDark ? "text-slate-500" : "text-slate-400")}>
                  {pickLang(language, { ku: "مامەڵەکانت لێرە دەردەکەون", en: "Your transactions will appear here", ar: "ستظهر معاملاتك هنا", zh: "您的交易将显示在这里" })}
                </p>
              </motion.div>
            )}
          </div>

          {/* Statement PDF + per-order consolidated billing */}
          <div className="flex items-center justify-between gap-2">
            <WhatsAppHelpButton
              language={language}
              section={language === "ku" ? "دارایی" : language === "ar" ? "المالية" : language === "zh" ? "财务" : "Financial"}
              topic={`${language === "ku" ? "باڵانس" : language === "ar" ? "الرصيد" : language === "zh" ? "余额" : "Balance"}: $${Math.abs(Number(summary?.balanceUsd || 0)).toFixed(2)}`}
            />
            <StatementPdfButton language={language} />
          </div>
          <OrderBillingGroups transactions={transactions as any} language={language} isDark={isDark} />

          {/* Unpaid Invoices Section */}
          {!invoicesLoading && unpaidInvoices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900 dark:text-slate-200")}>
                  {t("portal.unpaidInvoices")}
                </h2>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-bold",
                    isDark ? "bg-red-500/20 text-red-400" : "bg-red-50 dark:bg-red-950/40 text-red-600"
                  )}
                >
                  {unpaidInvoices.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {unpaidInvoices.map((inv: any, i: number) => (
                  <motion.div
                    key={inv.id}
                    initial={{ opacity: 0, x: isRTL ? 12 : -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + i * 0.05 }}
                    className={cn(
                      "rounded-2xl p-4 shadow-sm border",
                      isDark
                        ? "bg-slate-800/50 border-slate-700/40"
                        : "bg-white border-slate-100 dark:border-slate-800/60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          isDark ? "bg-amber-500/15" : "bg-amber-50 dark:bg-amber-950/40"
                        )}
                      >
                        <AlertCircle
                          className={cn(
                            "w-5 h-5",
                            isDark ? "text-amber-400" : "text-amber-600"
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isDark ? "text-white" : "text-slate-900 dark:text-slate-200"
                          )}
                        >
                          {inv.invoiceNumber}
                        </p>
                        <p className={cn("text-xs mt-0.5", isDark ? "text-slate-500" : "text-slate-400")}>
                          {inv.dueDate
                            ? formatDate(inv.dueDate)
                            : inv.issuedAt
                            ? formatDate(inv.issuedAt)
                            : ""}
                        </p>
                      </div>

                      <div className="text-end shrink-0">
                        <p
                          className={cn(
                            "text-sm font-bold font-mono",
                            "text-red-500 dark:text-red-400"
                          )}
                        >
                          ${Number(inv.totalUsd || 0).toFixed(2)}
                        </p>
                        {/* The dinar the invoice was raised at — not a
                            conversion, so it matches their paper copy. */}
                        {formatIqdAmount(inv.totalIqd) && (
                          <p className="text-[10px] font-mono text-muted-foreground" dir="ltr">
                            {formatIqdAmount(inv.totalIqd)}
                          </p>
                        )}
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            inv.status === "overdue"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          )}
                        >
                          {inv.status === "overdue"
                            ? pickLang(language, { ku: "دواکەوتوو", en: "Overdue", ar: "متأخر", zh: "已逾期" })
                            : t("portal.pending")}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </ModernPortalLayout>
  );
}
