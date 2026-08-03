import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Bell, 
  Send, 
  MessageSquare, 
  Mail, 
  Phone,
  Users,
  DollarSign,
  CheckCircle,
  RefreshCw,
  Filter
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";

export default function DebtReminders() {
    const { t } = useTranslation();
const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [reminderMethod, setReminderMethod] = useState<"whatsapp" | "email" | "both">("whatsapp");
  const [customMessage, setCustomMessage] = useState("");
  const [minDebt, setMinDebt] = useState("");
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);

  // Fetch debtors
  const { data: debtors, isLoading, refetch } = trpc.ledger.getDebtors.useQuery({
    minBalanceUsd: minDebt ? parseFloat(minDebt) : 0,
  });

  // Send reminder mutation - simplified for now
  const [isSending, setIsSending] = useState(false);

  const handleSelectAll = () => {
    if (selectedCustomers.length === debtors?.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(debtors?.map(d => d.customerId) || []);
    }
  };

  const handleSelectCustomer = (customerId: number) => {
    if (selectedCustomers.includes(customerId)) {
      setSelectedCustomers(selectedCustomers.filter(id => id !== customerId));
    } else {
      setSelectedCustomers([...selectedCustomers, customerId]);
    }
  };

  const handleSendReminders = async () => {
    if (selectedCustomers.length === 0) {
      toast.error(t("auto.text_071f37"));
      return;
    }

    setIsSending(true);
    try {
      // Simulate sending - in real implementation, call the API
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success(`یادکردنەوە نێردرا بۆ ${selectedCustomers.length} کڕیار`);
      setSelectedCustomers([]);
      setIsSendDialogOpen(false);
    } catch (error) {
      toast.error(t("auto.text_112d62"));
    } finally {
      setIsSending(false);
    }
  };

  const totalDebt = debtors?.reduce((sum, d) => sum + (d.balanceUsd || 0), 0) || 0;
  const selectedDebt = debtors
    ?.filter(d => selectedCustomers.includes(d.customerId))
    .reduce((sum, d) => sum + (d.balanceUsd || 0), 0) || 0;

  return (
    <DashboardLayout>
    <div className="space-y-6 p-6" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-amber-500 to-orange-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-7 w-7" />
              {t("auto.text_2eb7c4")}
            </h1>
            <p className="text-amber-100 mt-1">{t("auto.text_be961d")} </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => refetch()} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <RefreshCw className="h-4 w-4 ms-2" />{t("blog.update")}</Button>
            <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-orange-600 hover:bg-orange-50" disabled={selectedCustomers.length === 0}>
                  <Send className="h-4 w-4 ms-2" />
                  {t("auto.text_49e6d3")} ({selectedCustomers.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>{t("auto.text_fc0eda")} </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>{selectedCustomers.length}</strong> {t("auto.text_77fddc")}
                    </p>
                    <p className="text-lg font-bold text-amber-900 dark:text-amber-200 mt-1">
                      {t("auto.text_96973f")}: ${selectedDebt.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <Label>{t("auto.text_244ad9")} </Label>
                    <Select value={reminderMethod} onValueChange={(v: "whatsapp" | "email" | "both") => setReminderMethod(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-green-600" />
                            {t("auto.text_218781")}
                          </div>
                        </SelectItem>
                        <SelectItem value="email">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-600" />{t("auth.email")}</div>
                        </SelectItem>
                        <SelectItem value="both">
                          <div className="flex items-center gap-2">
                            <Send className="h-4 w-4 text-purple-600" />
                            {t("auto.text_837079")}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t("auto.text_59553e")} </Label>
                    <Textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder={t("auto.text_aaa5a7")}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsSendDialogOpen(false)}>{t("forms.cancel")}</Button>
                  <Button 
                    onClick={handleSendReminders} 
                    disabled={isSending}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {isSending ? t("auto.text_68b67e") : t("common.send")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950/40">
                <Users className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("auto.text_bb8925")} </p>
                <p className="text-2xl font-bold">{debtors?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-950/40">
                <DollarSign className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("finance.totalDebt")}</p>
                <p className="text-2xl font-bold">${totalDebt.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-950/40">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("tables.selected")}</p>
                <p className="text-2xl font-bold">{selectedCustomers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-950/40">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("auto.text_9d2075")} </p>
                <p className="text-2xl font-bold">${selectedDebt.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <Label>{t("auto.text_32ac8c")} </Label>
              <Input
                type="number"
                value={minDebt}
                onChange={(e) => setMinDebt(e.target.value)}
                placeholder="0"
                className="w-32"
              />
              <span className="text-muted-foreground">$</span>
            </div>
            <Button variant="outline" onClick={handleSelectAll}>
              {selectedCustomers.length === debtors?.length ? t("auto.text_005981") : t("common.selectAll")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Debtors List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("auto.text_9b151c")} </CardTitle>
          <CardDescription>{t("auto.text_fa549b")} </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : debtors && debtors.length > 0 ? (
            <div className="space-y-2">
              {debtors.map((debtor) => (
                <div
                  key={debtor.customerId}
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedCustomers.includes(debtor.customerId)
                      ? "bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800/60"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleSelectCustomer(debtor.customerId)}
                >
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedCustomers.includes(debtor.customerId)}
                      onCheckedChange={() => handleSelectCustomer(debtor.customerId)}
                    />
                    <div>
                      <p className="font-medium">{debtor.customer?.fullName || '{t("common.customer")}'}</p>
                      <p className="text-sm text-muted-foreground">{debtor.customer?.customerCode || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="font-bold text-red-600">${(debtor.balanceUsd || 0).toLocaleString()}</p>
                      {debtor.balanceIqd > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {debtor.balanceIqd.toLocaleString()} IQD
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {debtor.customer?.mobileNumber && (
                        <Badge variant="outline" className="text-green-600">
                          <Phone className="h-3 w-3" />
                        </Badge>
                      )}
                      {debtor.customer?.email && (
                        <Badge variant="outline" className="text-blue-600">
                          <Mail className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p>{t("auto.text_c74ac7")} </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
