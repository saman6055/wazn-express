import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Plus, DollarSign, TrendingUp, TrendingDown, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Accounting() {
    const { t } = useTranslation();
const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isExchangeOpen, setIsExchangeOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [search, setSearch] = useState("");
  
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: exchangeRates, refetch: refetchRates } = trpc.exchangeRates.list.useQuery();
  // Use new ledger system
  const { data: account } = trpc.ledger.getAccountByCustomer.useQuery(
    { customerId: parseInt(selectedCustomerId) },
    { enabled: !!selectedCustomerId }
  );
  const { data: transactionsResponse, refetch: refetchTransactions } = trpc.ledger.getTransactions.useQuery(
    { accountId: account?.id || 0, limit: 50 },
    { enabled: !!account?.id }
  );
  const transactions = transactionsResponse?.data ?? [];
  
  const customerBalance = account ? parseFloat(account.currentBalanceUsd || '0') : 0;
  
  // Use new ledger system for payment recording
  const recordPaymentMutation = trpc.ledger.recordPayment.useMutation({
    onSuccess: () => {
      toast.success(t("toast.paymentRecorded"));
      setIsPaymentOpen(false);
      refetchTransactions();
    },
    onError: (error) => toast.error(error.message)
  });

  const createExchangeRateMutation = trpc.exchangeRates.create.useMutation({
    onSuccess: () => {
      toast.success(t("toast.exchangeRateCreated"));
      setIsExchangeOpen(false);
      refetchRates();
    },
    onError: (error) => toast.error(error.message)
  });

  const handleRecordPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customer = customers?.find(c => c.id === parseInt(formData.get("customerId") as string));
    if (!customer || !customer.customerCode) {
      toast.error(t("toast.customerNotFoundOrMissingCode"));
      return;
    }
    
    recordPaymentMutation.mutate({
      customerId: customer.id,
      customerCode: customer.customerCode,
      amountUsd: parseFloat(formData.get("amountUsd") as string) || 0,
      amountIqd: 0, // Can be extended later
      paymentMethod: (formData.get("paymentMethod") as any) || 'CASH',
      notes: formData.get("notes") as string || undefined,
    });
  };

  const handleCreateExchangeRate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createExchangeRateMutation.mutate({
      targetCurrency: formData.get("toCurrency") as string,
      rate: formData.get("rate") as string,
    });
  };

  const filteredCustomers = customers?.filter(c =>
    (c.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customerCode || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedCustomer = customers?.find(c => c.id === parseInt(selectedCustomerId));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
            <p className="text-muted-foreground">Manage payments, ledger, and exchange rates</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isExchangeOpen} onOpenChange={setIsExchangeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <RefreshCw className="h-4 w-4 me-2" />
                  Exchange Rates
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Manage Exchange Rates</DialogTitle>
                  <DialogDescription>Set current exchange rates for multi-currency support.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateExchangeRate}>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="fromCurrency">From Currency</Label>
                        <Select name="fromCurrency" required>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="IQD">IQD</SelectItem>
                            <SelectItem value="RMB">RMB</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="toCurrency">To Currency</Label>
                        <Select name="toCurrency" required>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="IQD">IQD</SelectItem>
                            <SelectItem value="RMB">RMB</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="rate">Exchange Rate</Label>
                        <Input id="rate" name="rate" type="number" step="0.0001" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="effectiveFrom">Effective From</Label>
                        <Input id="effectiveFrom" name="effectiveFrom" type="date" required />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createExchangeRateMutation.isPending}>
                      Save Rate
                    </Button>
                  </DialogFooter>
                </form>
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-2">Current Rates</h4>
                  <div className="space-y-2 text-sm">
                    {exchangeRates?.map(rate => (
                      <div key={rate.id} className="flex justify-between p-2 bg-muted rounded">
                        <span>{rate.baseCurrency} → {rate.targetCurrency}</span>
                        <span className="font-mono">{rate.rate}</span>
                      </div>
                    ))}
                    {(!exchangeRates || exchangeRates.length === 0) && (
                      <p className="text-muted-foreground">No active rates</p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 me-2" />
                  Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Payment</DialogTitle>
                  <DialogDescription>Record a customer payment to their account.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRecordPayment}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="customerId">Customer *</Label>
                      <Select name="customerId" required>
                        <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                        <SelectContent>
                          {customers?.filter(c => c.isActive).map(c => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                              {c.customerCode} - {c.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="amountUsd">Amount (USD) *</Label>
                        <Input id="amountUsd" name="amountUsd" type="number" step="0.01" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="paymentMethod">Payment Method *</Label>
                        <Select name="paymentMethod" required>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                            <SelectItem value="FIB">FIB</SelectItem>
                            <SelectItem value="FASTPAY">FastPay</SelectItem>
                            <SelectItem value="ZAINCASH">ZainCash</SelectItem>
                            <SelectItem value="ASIAHAWALA">Asia Hawala</SelectItem>
                            <SelectItem value="CARD">Card</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="currency">Original Currency</Label>
                        <Select name="currency" defaultValue="USD">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="IQD">IQD</SelectItem>
                            <SelectItem value="RMB">RMB</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="originalAmount">Original Amount</Label>
                        <Input id="originalAmount" name="originalAmount" type="number" step="0.01" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="reference">Reference #</Label>
                      <Input id="reference" name="reference" placeholder="Transaction reference" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Input id="notes" name="notes" placeholder="Additional notes" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={recordPaymentMutation.isPending}>
                      {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="ledger">
          <TabsList>
            <TabsTrigger value="ledger">Customer Ledger</TabsTrigger>
            <TabsTrigger value="balances">Account Balances</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label>Select Customer</Label>
                    <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose a customer to view ledger" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.filter(c => c.isActive).map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.customerCode} - {c.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedCustomer && (
                    <div className="flex items-end">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Current Balance</p>
                        <p className={`text-xl font-bold ${(customerBalance || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                          ${Math.abs(customerBalance || 0).toFixed(2)}
                          <span className="text-xs font-normal ms-1">
                            {(customerBalance || 0) > 0 ? "owed" : (customerBalance || 0) < 0 ? "credit" : ""}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedCustomerId ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions?.map((txn) => {
                        const isDebit = txn.transactionType.startsWith('DEBIT');
                        const isCredit = txn.transactionType.startsWith('CREDIT');
                        return (
                          <TableRow key={txn.id}>
                            <TableCell>{new Date(txn.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={isCredit ? "default" : isDebit ? "destructive" : "secondary"}
                                className="capitalize"
                              >
                                {txn.transactionType.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>{txn.description || "-"}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                              {isDebit ? `$${txn.amountUsd}` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                              {isCredit ? `$${txn.amountUsd}` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              ${txn.balanceAfterUsd}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!transactions || transactions.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No transactions for this customer
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Select a customer to view their ledger</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balances" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search customers..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers?.map((customer) => (
                      <CustomerBalanceRow key={customer.id} customer={customer} />
                    ))}
                    {(!filteredCustomers || filteredCustomers.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No customers found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function CustomerBalanceRow({ customer }: { customer: any }) {
  const { data: balance } = trpc.customers.getBalance.useQuery({ customerId: customer.id });
  
  return (
    <TableRow>
      <TableCell className="font-mono">{customer.customerCode}</TableCell>
      <TableCell className="font-medium">{customer.fullName}</TableCell>
      <TableCell>{customer.mobileNumber}</TableCell>
      <TableCell className="text-right">
        <span className={`font-mono font-medium ${(balance || 0) > 0 ? "text-red-600" : (balance || 0) < 0 ? "text-green-600" : ""}`}>
          ${Math.abs(balance || 0).toFixed(2)}
        </span>
      </TableCell>
      <TableCell className="text-right">
        {(balance || 0) > 0 ? (
          <Badge variant="destructive" className="gap-1">
            <TrendingUp className="h-3 w-3" />
            Owes
          </Badge>
        ) : (balance || 0) < 0 ? (
          <Badge variant="default" className="gap-1 bg-green-600">
            <TrendingDown className="h-3 w-3" />
            Credit
          </Badge>
        ) : (
          <Badge variant="secondary">Clear</Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
