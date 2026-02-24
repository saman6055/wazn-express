import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getCompanyInfoFromSettings } from "@/hooks/useCompanyInfo";
import { useTranslation } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
  Wrench,
  Plus,
  Search,
  Filter,
  TrendingUp,
  DollarSign,
  Receipt,
  Users,
  Calendar,
  Eye,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Printer,
  Download,
  Check,
  ChevronsUpDown,
  X,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

export default function ServicesManagement() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedServiceType, setSelectedServiceType] = useState<string>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [dateFilterType, setDateFilterType] = useState<"all" | "range" | "month" | "year">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  
  // Dialog states
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [newService, setNewService] = useState({
    serviceTypeId: 0,
    customerId: 0,
    description: "",
    costAmount: "",
    priceAmount: "",
    notes: "",
  });
  
  // Queries
  const { data: services, isLoading: servicesLoading, refetch: refetchServices } = trpc.extraServices.list.useQuery({});
  const { data: serviceTypes } = trpc.extraServices.getActiveServiceTypes.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: settings } = trpc.settings.list.useQuery();
  
  // Mutation
  const createServiceMutation = trpc.extraServices.create.useMutation({
    onSuccess: () => {
      refetchServices();
    },
    onError: (error) => {
      toast.error(error.message || t('common.errorOccurred'));
    },
  });
  
  // Helper function to get customer by ID
  const getCustomerById = (id: number) => customers?.find((c: any) => c.id === id);
  
  // Filter customers by search query
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!customerSearchQuery) return customers;
    const query = customerSearchQuery.toLowerCase();
    return customers.filter((c: any) => 
      c.fullName?.toLowerCase().includes(query) ||
      c.customerCode?.toLowerCase().includes(query) ||
      c.phone?.includes(query)
    );
  }, [customers, customerSearchQuery]);
  
  // Handle group service creation
  const handleCreateService = async () => {
    if (isGroupMode) {
      if (selectedCustomerIds.length === 0) {
        toast.error(t("toast.selectAtLeastOneCustomer"));
        return;
      }
      if (!newService.serviceTypeId || !newService.description || !newService.priceAmount) {
        toast.error(t("toast.fillAllFields"));
        return;
      }
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const customerId of selectedCustomerIds) {
        try {
          await createServiceMutation.mutateAsync({
            customerId,
            serviceTypeId: newService.serviceTypeId,
            description: newService.description,
            costAmount: newService.costAmount || "0",
            priceAmount: newService.priceAmount,
            notes: newService.notes,
          });
          successCount++;
        } catch (e) {
          errorCount++;
        }
      }
      
      if (successCount > 0) {
        toast.success(t('services.bulkAddedSuccess', { count: successCount }));
      }
      if (errorCount > 0) {
        toast.error(t('services.bulkAddFailed', { count: errorCount }));
      }
      
      setIsAddServiceOpen(false);
      setIsGroupMode(false);
      setSelectedCustomerIds([]);
      setNewService({
        serviceTypeId: 0,
        customerId: 0,
        description: "",
        costAmount: "",
        priceAmount: "",
        notes: "",
      });
    } else {
      if (!newService.customerId || !newService.serviceTypeId || !newService.description || !newService.priceAmount) {
        toast.error(t("toast.fillAllFields"));
        return;
      }
      
      createServiceMutation.mutate({
        customerId: newService.customerId,
        serviceTypeId: newService.serviceTypeId,
        description: newService.description,
        costAmount: newService.costAmount || "0",
        priceAmount: newService.priceAmount,
        notes: newService.notes,
      });
      
      toast.success(t('services.addedSuccess'));
      setIsAddServiceOpen(false);
      setNewService({
        serviceTypeId: 0,
        customerId: 0,
        description: "",
        costAmount: "",
        priceAmount: "",
        notes: "",
      });
    }
  };
  
  // Filter services
  const filteredServices = useMemo(() => {
    if (!services) return [];
    
    const servicesList = services?.services || [];
    return servicesList.filter((service: any) => {
      // Search filter
      const matchesSearch = !searchQuery || 
        service.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.customer?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.serviceType?.nameKu?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Service type filter
      const matchesType = selectedServiceType === "all" || 
        service.serviceTypeId?.toString() === selectedServiceType;
      
      // Customer filter
      const matchesCustomer = selectedCustomer === "all" || 
        service.customerId?.toString() === selectedCustomer;
      
      // Date filter
      let matchesDate = true;
      const serviceDate = service.createdAt ? new Date(service.createdAt) : null;
      
      if (dateFilterType === "range" && startDate && endDate && serviceDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = serviceDate >= start && serviceDate <= end;
      } else if (dateFilterType === "month" && selectedMonth && serviceDate) {
        const [year, month] = selectedMonth.split("-");
        matchesDate = serviceDate.getFullYear() === parseInt(year) && 
                     serviceDate.getMonth() === parseInt(month) - 1;
      } else if (dateFilterType === "year" && selectedYear && serviceDate) {
        matchesDate = serviceDate.getFullYear() === parseInt(selectedYear);
      }
      
      return matchesSearch && matchesType && matchesCustomer && matchesDate;
    });
  }, [services, searchQuery, selectedServiceType, selectedCustomer, dateFilterType, startDate, endDate, selectedMonth, selectedYear]);
  
  // Calculate totals
  const totals = useMemo(() => {
    const total = filteredServices.length;
    const totalRevenue = filteredServices.reduce((sum: number, s: any) => sum + Number(s.priceAmount || 0), 0);
    const totalCost = filteredServices.reduce((sum: number, s: any) => sum + Number(s.costAmount || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    return { total, totalRevenue, totalCost, totalProfit, profitMargin };
  }, [filteredServices]);
  
  // Get customer name helper
  const getCustomerName = (customerId: number | null) => {
    if (!customerId) return t('services.withoutCustomer');
    const customer = customers?.find((c: any) => c.id === customerId);
    return customer?.fullName || t('services.customerNumber', { id: customerId });
  };
  
  // Generate years for filter
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);
  
  // Handle print
  const handlePrint = () => {
    const company = getCompanyInfoFromSettings(settings || []);
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ku">
      <head>
        <meta charset="UTF-8">
        <title>${t('services.servicesReport')}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10b981; padding-bottom: 20px; }
          .header h1 { color: #10b981; margin: 0; }
          .stats { display: flex; justify-content: space-around; margin-bottom: 30px; }
          .stat { text-align: center; padding: 15px; background: #f0fdf4; border-radius: 8px; }
          .stat-value { font-size: 24px; font-weight: bold; color: #10b981; }
          .stat-label { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background: #10b981; color: white; }
          tr:nth-child(even) { background: #f9f9f9; }
          .profit-positive { color: #10b981; }
          .profit-negative { color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${company.name}</h1>
          <p>${t('services.servicesReport')}</p>
          <p>${t('services.date')}: ${new Date().toLocaleDateString('ku')}</p>
        </div>
        <div class="stats">
          <div class="stat">
            <div class="stat-value">${totals.total}</div>
            <div class="stat-label">${t('services.totalServices')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">$${totals.totalRevenue.toFixed(2)}</div>
            <div class="stat-label">${t('services.totalRevenue')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">$${totals.totalCost.toFixed(2)}</div>
            <div class="stat-label">${t('services.totalCost')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">$${totals.totalProfit.toFixed(2)}</div>
            <div class="stat-label">${t('services.netProfit')}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>${t('services.date')}</th>
              <th>${t('services.customer')}</th>
              <th>${t('services.type')}</th>
              <th>${t('services.description')}</th>
              <th>${t('services.cost')}</th>
              <th>${t('services.price')}</th>
              <th>${t('services.profit')}</th>
            </tr>
          </thead>
          <tbody>
            ${filteredServices.map((service: any) => {
              const profit = Number(service.priceAmount || 0) - Number(service.costAmount || 0);
              return `
                <tr>
                  <td>${service.createdAt ? new Date(service.createdAt).toLocaleDateString('ku') : '-'}</td>
                  <td>${getCustomerName(service.customerId)}</td>
                  <td>${service.serviceType?.nameKu || service.serviceType?.nameEn || '-'}</td>
                  <td>${service.description || '-'}</td>
                  <td>$${Number(service.costAmount || 0).toFixed(2)}</td>
                  <td>$${Number(service.priceAmount || 0).toFixed(2)}</td>
                  <td class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">$${profit.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };
  
  // Handle CSV export
  const handleExportCSV = () => {
    const headers = [t('services.date'), t('services.customer'), t('services.type'), t('services.description'), t('services.cost'), t('services.price'), t('services.profit')];
    const rows = filteredServices.map((service: any) => {
      const profit = Number(service.priceAmount || 0) - Number(service.costAmount || 0);
      return [
        service.createdAt ? new Date(service.createdAt).toLocaleDateString() : '',
        getCustomerName(service.customerId),
        service.serviceType?.nameKu || service.serviceType?.nameEn || '',
        service.description || '',
        Number(service.costAmount || 0).toFixed(2),
        Number(service.priceAmount || 0).toFixed(2),
        profit.toFixed(2),
      ];
    });
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `services-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t('services.csvExported'));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Wrench className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t('services.management')}</h1>
                <p className="text-emerald-100 mt-1">{t('services.managementDescription')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => navigate("/services/types")}
              >
                <Settings className="h-4 w-4 ms-2" />
                {t('services.serviceTypes')}
              </Button>
              <Dialog open={isAddServiceOpen} onOpenChange={setIsAddServiceOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-emerald-600 hover:bg-emerald-50">
                    <Plus className="h-4 w-4 ms-2" />
                    {t('services.addService')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{t('services.addNewService')}</DialogTitle>
                    <DialogDescription>
                      {t('services.addNewServiceDescription')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <Button
                        type="button"
                        variant={!isGroupMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setIsGroupMode(false);
                          setSelectedCustomerIds([]);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Users className="h-4 w-4" />
                        {t('services.singleCustomer')}
                      </Button>
                      <Button
                        type="button"
                        variant={isGroupMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setIsGroupMode(true);
                          setNewService({ ...newService, customerId: 0 });
                        }}
                        className="flex items-center gap-2"
                      >
                        <UsersRound className="h-4 w-4" />
                        {t('services.multipleCustomers')}
                      </Button>
                    </div>
                    
                    {/* Customer Selection */}
                    <div className="space-y-2">
                      <Label>{isGroupMode ? t('services.customersRequired') : t('services.customerRequired')}</Label>
                      
                      {isGroupMode ? (
                        /* Multi-select for group mode */
                        <div className="space-y-2">
                          <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between h-auto min-h-10 py-2"
                              >
                                <span className="text-muted-foreground">
                                  {selectedCustomerIds.length > 0 
                                    ? t('services.customersSelected', { count: selectedCustomerIds.length })
                                    : t('services.selectCustomers')}
                                </span>
                                <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent variant="panel" className="w-full min-w-[320px]" align="start">
                              <Command>
                                <CommandInput 
                                  placeholder={t('services.searchByNameOrCode')} 
                                  value={customerSearchQuery}
                                  onValueChange={setCustomerSearchQuery}
                                />
                                <CommandList>
                                  <CommandEmpty>{t('services.noCustomersFound')}</CommandEmpty>
                                  <CommandGroup className="max-h-64 overflow-auto">
                                    {filteredCustomers?.map((customer: any) => (
                                      <CommandItem
                                        key={customer.id}
                                        value={`${customer.fullName} ${customer.customerCode}`}
                                        onSelect={() => {
                                          setSelectedCustomerIds(prev => 
                                            prev.includes(customer.id)
                                              ? prev.filter(id => id !== customer.id)
                                              : [...prev, customer.id]
                                          );
                                        }}
                                      >
                                        <div className="flex items-center gap-2 w-full">
                                          <Checkbox
                                            checked={selectedCustomerIds.includes(customer.id)}
                                            className="pointer-events-none"
                                          />
                                          <div className="flex-1">
                                            <div className="font-medium">{customer.fullName}</div>
                                            <div className="text-xs text-muted-foreground">
                                              {customer.customerCode} • {customer.phone}
                                            </div>
                                          </div>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          
                          {/* Selected customers chips */}
                          {selectedCustomerIds.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-muted/30">
                              {selectedCustomerIds.map(id => {
                                const customer = getCustomerById(id);
                                return (
                                  <Badge key={id} variant="secondary" className="flex items-center gap-1">
                                    {customer?.fullName}
                                    <X 
                                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                                      onClick={() => setSelectedCustomerIds(prev => prev.filter(cid => cid !== id))}
                                    />
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Single searchable select for single mode */
                        <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                            >
                              {newService.customerId 
                                ? getCustomerById(newService.customerId)?.fullName 
                                : t('services.selectCustomer')}
                              <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent variant="panel" className="w-full min-w-[320px]" align="start">
                            <Command>
                              <CommandInput 
                                placeholder={t('services.searchByNameOrCode')} 
                                value={customerSearchQuery}
                                onValueChange={setCustomerSearchQuery}
                              />
                              <CommandList>
                                <CommandEmpty>{t('services.noCustomersFound')}</CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-auto">
                                  {filteredCustomers?.map((customer: any) => (
                                    <CommandItem
                                      key={customer.id}
                                      value={`${customer.fullName} ${customer.customerCode}`}
                                      onSelect={() => {
                                        setNewService({ ...newService, customerId: customer.id });
                                        setCustomerPopoverOpen(false);
                                        setCustomerSearchQuery("");
                                      }}
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        <Check
                                          className={`h-4 w-4 ${newService.customerId === customer.id ? "opacity-100" : "opacity-0"}`}
                                        />
                                        <div className="flex-1">
                                          <div className="font-medium">{customer.fullName}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {customer.customerCode} • {customer.phone}
                                          </div>
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>{t('services.serviceTypeRequired')}</Label>
                      <Select
                        value={newService.serviceTypeId.toString()}
                        onValueChange={(v) => {
                          const typeId = parseInt(v);
                          const selectedType = serviceTypes?.find((t: any) => t.id === typeId);
                          setNewService({
                            ...newService,
                            serviceTypeId: typeId,
                            costAmount: selectedType?.defaultCost || "",
                            priceAmount: selectedType?.defaultPrice || "",
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('services.selectType')} />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceTypes?.map((type: any) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.nameKu || type.nameEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>{t('services.descriptionRequired')}</Label>
                      <Textarea
                        placeholder={t('services.descriptionPlaceholder')}
                        value={newService.description}
                        onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('services.cost')}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            className="pl-7"
                            placeholder="0.00"
                            value={newService.costAmount}
                            onChange={(e) => setNewService({ ...newService, costAmount: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('services.sellingPriceRequired')}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            className="pl-7"
                            placeholder="0.00"
                            value={newService.priceAmount}
                            onChange={(e) => setNewService({ ...newService, priceAmount: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Profit Display */}
                    {newService.costAmount && newService.priceAmount && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{t('services.profit')}:</span>
                          <span className={`font-bold ${
                            Number(newService.priceAmount) - Number(newService.costAmount) >= 0 
                              ? "text-green-600" 
                              : "text-red-600"
                          }`}>
                            ${(Number(newService.priceAmount) - Number(newService.costAmount)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label>{t('services.notes')}</Label>
                      <Textarea
                        placeholder={t('services.notesPlaceholder')}
                        value={newService.notes}
                        onChange={(e) => setNewService({ ...newService, notes: e.target.value })}
                      />
                    </div>
                    
                    {/* Auto payment notice */}
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        {t('services.autoInvoiceNotice')}
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setIsAddServiceOpen(false);
                      setIsGroupMode(false);
                      setSelectedCustomerIds([]);
                      setCustomerSearchQuery("");
                    }}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      onClick={handleCreateService}
                      disabled={createServiceMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {createServiceMutation.isPending 
                        ? t('services.pleaseWait') 
                        : isGroupMode 
                          ? t('services.addForCustomers', { count: selectedCustomerIds.length })
                          : t('common.add')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
        
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('services.totalServices')}</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{totals.total}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Wrench className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('services.totalRevenue')}</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">${totals.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('services.totalCost')}</p>
                  <p className="text-3xl font-bold text-red-600 mt-1">${totals.totalCost.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-xl">
                  <DollarSign className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('services.netProfit')}</p>
                  <p className={`text-3xl font-bold mt-1 ${totals.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ${totals.totalProfit.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totals.profitMargin.toFixed(1)}% {t('services.profitMargin')}
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  {totals.totalProfit >= 0 ? (
                    <ArrowUpRight className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="h-6 w-6 text-red-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{t('common.filters')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('common.search') + '...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9"
                />
              </div>
              
              {/* Service Type Filter */}
              <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
                <SelectTrigger>
                  <SelectValue placeholder={t('services.serviceTypeRequired')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('services.allTypes')}</SelectItem>
                  {serviceTypes?.map((type: any) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.nameKu || type.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Customer Filter */}
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder={t('services.customer')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('services.allCustomers')}</SelectItem>
                  {customers?.map((customer: any) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Date Filter Type */}
              <Select value={dateFilterType} onValueChange={(v: any) => setDateFilterType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('services.dateFilter')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('services.allTime')}</SelectItem>
                  <SelectItem value="range">{t('services.dateRange')}</SelectItem>
                  <SelectItem value="month">{t('services.monthly')}</SelectItem>
                  <SelectItem value="year">{t('services.yearly')}</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Date Range / Month / Year inputs */}
              {dateFilterType === "range" && (
                <div className="flex gap-2 lg:col-span-1">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1"
                  />
                </div>
              )}
              
              {dateFilterType === "month" && (
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              )}
              
              {dateFilterType === "year" && (
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('services.selectYear')} />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            {/* Export buttons */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 ms-2" />
                {t('common.print')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 ms-2" />
                {t('common.exportExcel')}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate("/reports/services")}
              >
                <FileText className="h-4 w-4 ms-2" />
                {t('services.fullReport')}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Services Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{t('services.servicesList')}</CardTitle>
                <CardDescription>{t('services.servicesCount', { count: filteredServices.length })}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-right">{t('services.date')}</TableHead>
                  <TableHead className="text-right">{t('services.customer')}</TableHead>
                  <TableHead className="text-right">{t('services.type')}</TableHead>
                  <TableHead className="text-right">{t('services.description')}</TableHead>
                  <TableHead className="text-right">{t('services.cost')}</TableHead>
                  <TableHead className="text-right">{t('services.price')}</TableHead>
                  <TableHead className="text-right">{t('services.profit')}</TableHead>
                  <TableHead className="text-right">{t('services.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicesLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                        <span>{t('services.pleaseWait')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {t('services.noServicesFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServices.map((service: any) => {
                    const profit = Number(service.priceAmount || 0) - Number(service.costAmount || 0);
                    return (
                      <TableRow key={service.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm text-muted-foreground">
                          {service.createdAt ? new Date(service.createdAt).toLocaleDateString('ku') : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto text-blue-600 hover:text-blue-800"
                            onClick={() => navigate(`/customers/${service.customerId}`)}
                          >
                            {getCustomerName(service.customerId)}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {service.serviceType?.nameKu || service.serviceType?.nameEn || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {service.description || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          ${Number(service.costAmount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-medium">
                          ${Number(service.priceAmount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${profit.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/customers/${service.customerId}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            
            {/* Footer totals */}
            {filteredServices.length > 0 && (
              <div className="border-t bg-muted/30 p-4">
                <div className="flex items-center justify-end gap-8">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t('services.totalCost')}:</span>
                    <span className="font-bold me-2">${totals.totalCost.toFixed(2)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t('services.totalRevenue')}:</span>
                    <span className="font-bold me-2">${totals.totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t('services.totalProfit')}:</span>
                    <span className={`font-bold me-2 ${totals.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${totals.totalProfit.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
