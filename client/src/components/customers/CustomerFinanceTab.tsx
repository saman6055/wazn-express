import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, FileText, Eye, Download, Loader2 } from "lucide-react";

interface LedgerEntry {
  id: string;
  transactionType?: string;
  description?: string;
  amountUsd: string;
  balanceAfterUsd: string;
  createdAt: string;
}

interface InvoiceRecord {
  id: number;
  invoiceNumber: string;
  totalUsd: string;
  status: string;
  createdAt: string;
}

interface CustomerFinanceTabProps {
  ledger: LedgerEntry[] | undefined;
  invoices: InvoiceRecord[] | undefined;
  downloadingInvoiceId: number | null;
  onViewInvoice: (invoice: InvoiceRecord) => void;
  onDownloadInvoice: (id: number) => void;
  t: (key: string) => string;
}

export function CustomerFinanceTab({
  ledger,
  invoices,
  downloadingInvoiceId,
  onViewInvoice,
  onDownloadInvoice,
  t,
}: CustomerFinanceTabProps) {
  return (
    <>
      {/* Balance History Graph */}
      {ledger && ledger.length > 0 && (
        <Card className="border-0 shadow-lg mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("customers.balanceHistory")}</CardTitle>
            <CardDescription>{t("customers.balanceChangesOverTime")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end gap-1">
              {(() => {
                const entries = [...ledger].reverse().slice(-30);
                const maxBalance = Math.max(...entries.map((e) => Math.abs(parseFloat(e.balanceAfterUsd))));
                const minBalance = Math.min(...entries.map((e) => parseFloat(e.balanceAfterUsd)));
                const range = maxBalance - minBalance || 1;
                return entries.map((entry) => {
                  const balance = parseFloat(entry.balanceAfterUsd);
                  const height =
                    Math.max(10, ((Math.abs(balance) - Math.abs(minBalance)) / range) * 100 + 10);
                  const isPositive = balance > 0;
                  return (
                    <div
                      key={entry.id}
                      className="flex-1 group relative"
                      style={{ minWidth: "8px" }}
                    >
                      <div
                        className={`w-full rounded-t transition-all ${
                          isPositive
                            ? "bg-red-400 hover:bg-red-500"
                            : balance < 0
                              ? "bg-green-400 hover:bg-green-500"
                              : "bg-slate-300 hover:bg-slate-400"
                        }`}
                        style={{ height: `${height}%` }}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap border">
                          <div className="font-medium">${balance}</div>
                          <div className="text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>
                {ledger.length > 0
                  ? new Date(ledger[ledger.length - 1].createdAt).toLocaleDateString()
                  : ""}
              </span>
              <span>{t("time.justNow")}</span>
            </div>
            <div className="flex gap-4 mt-3 justify-center text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-400" />
                <span>{t("customers.owes")}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-400" />
                <span>{t("customers.credit")}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-slate-300" />
                <span>{t("customers.settled")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ledger Entries */}
      <Card className="border-0 shadow-lg mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t("customers.ledgerEntries")}</CardTitle>
              <CardDescription>{t("customers.financialTransactionHistory")}</CardDescription>
            </div>
            <Badge variant="secondary">{ledger?.length ?? 0} {t("common.records")}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger?.slice(0, 10).map((entry) => {
                const isCredit = entry.transactionType?.startsWith("CREDIT_");
                return (
                  <TableRow key={entry.id} className="hover:bg-muted/50">
                    <TableCell className="text-sm">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize text-xs ${
                          isCredit
                            ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/60"
                            : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60"
                        }`}
                      >
                        {entry.transactionType
                          ?.replace("DEBIT_", "")
                          .replace("CREDIT_", "")
                          .toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{entry.description ?? "-"}</TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm ${
                        isCredit ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300"
                      }`}
                    >
                      {isCredit ? "-" : "+"}${entry.amountUsd}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      ${entry.balanceAfterUsd}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!ledger || ledger.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <DollarSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">No ledger entries found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Invoices</CardTitle>
              <CardDescription>Invoice history</CardDescription>
            </div>
            <Badge variant="secondary">{invoices?.length ?? 0} invoices</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total (USD)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices?.map((invoice) => (
                <TableRow key={invoice.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">{invoice.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(invoice.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-mono text-sm">${invoice.totalUsd}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`capitalize text-xs ${
                        invoice.status === "paid"
                          ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/60"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                      }`}
                    >
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onViewInvoice(invoice)}
                      title={t("common.view") ?? "View"}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onDownloadInvoice(invoice.id)}
                      disabled={downloadingInvoiceId === invoice.id}
                      title={t("common.download") ?? "Download"}
                    >
                      {downloadingInvoiceId === invoice.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!invoices || invoices.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">No invoices found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
