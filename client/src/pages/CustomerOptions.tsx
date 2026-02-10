import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, 
  Plus, 
  Trash2, 
  Save, 
  ArrowLeft,
  Users,
  Globe,
  Briefcase,
  Hash,
  Mail,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
// Code prefixes are now fetched from database via trpc.customerCodePrefixes.list

interface OptionItem {
  id: string;
  nameEn: string;
  nameKu: string;
}

export default function CustomerOptions() {
  const { t, isRTL } = useTranslation();
  const [, setLocation] = useLocation();
  
  // Settings state
  const [defaultCodePrefix, setDefaultCodePrefix] = useState("AZ");
  const [emailRequired, setEmailRequired] = useState(false);
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(true);
  
  // Custom options
  const [nationalities, setNationalities] = useState<OptionItem[]>([
    { id: "kurdish", nameEn: "Kurdish", nameKu: "کورد" },
    { id: "arab", nameEn: "Arab", nameKu: "عەرەب" },
    { id: "turkmen", nameEn: "Turkmen", nameKu: "تورکمان" },
    { id: "assyrian", nameEn: "Assyrian", nameKu: "ئاشووری" },
    { id: "armenian", nameEn: "Armenian", nameKu: "ئەرمەنی" },
    { id: "foreign", nameEn: "Foreign", nameKu: "بیانی" },
    { id: "other", nameEn: "Other", nameKu: "تر" },
  ]);
  
  const [businessTypes, setBusinessTypes] = useState<OptionItem[]>([
    { id: "online_page", nameEn: "Online Page", nameKu: "پەیجی ئۆنلاین" },
    { id: "shop_owner", nameEn: "Shop Owner", nameKu: "دوکاندار" },
    { id: "wholesaler", nameEn: "Wholesaler", nameKu: "جوملەفرۆش" },
    { id: "personal", nameEn: "Personal", nameKu: "کەسی (شەخصی)" },
    { id: "company", nameEn: "Company", nameKu: "کۆمپانیا" },
    { id: "agent", nameEn: "Agent", nameKu: "ئەیجنت" },
    { id: "other", nameEn: "Other", nameKu: "تر" },
  ]);
  
  // Dialog states
  const [showAddNationality, setShowAddNationality] = useState(false);
  const [showAddBusinessType, setShowAddBusinessType] = useState(false);
  const [newOption, setNewOption] = useState({ id: "", nameEn: "", nameKu: "" });
  
  // Queries
  const { data: settingsData, refetch: refetchSettings } = trpc.system.getSettings.useQuery();
  const { data: codePrefixes } = trpc.customerCodePrefixes.list.useQuery();
  const updateSetting = trpc.system.updateSetting.useMutation({
    onSuccess: () => {
      refetchSettings();
      toast.success(t("common.saved"));
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  // Load settings on mount
  useEffect(() => {
    if (settingsData) {
      const codePrefixSetting = settingsData.find(s => s.settingKey === "defaultCodePrefix");
      if (codePrefixSetting) setDefaultCodePrefix(codePrefixSetting.settingValue || 'AZ');
      
      const emailRequiredSetting = settingsData.find(s => s.settingKey === "emailRequired");
      if (emailRequiredSetting) setEmailRequired(emailRequiredSetting.settingValue === "true");
      
      const autoPasswordSetting = settingsData.find(s => s.settingKey === "autoGeneratePassword");
      if (autoPasswordSetting) setAutoGeneratePassword(autoPasswordSetting.settingValue === "true");
      
      const nationalitiesSetting = settingsData.find(s => s.settingKey === "nationalities");
      if (nationalitiesSetting) {
        try {
          setNationalities(JSON.parse(nationalitiesSetting.settingValue || '[]'));
        } catch (e) {}
      }
      
      const businessTypesSetting = settingsData.find(s => s.settingKey === "businessTypes");
      if (businessTypesSetting) {
        try {
          setBusinessTypes(JSON.parse(businessTypesSetting.settingValue || '[]'));
        } catch (e) {}
      }
    }
  }, [settingsData]);
  
  const saveSettings = async () => {
    try {
      await updateSetting.mutateAsync({ key: "defaultCodePrefix", value: defaultCodePrefix });
      await updateSetting.mutateAsync({ key: "emailRequired", value: emailRequired.toString() });
      await updateSetting.mutateAsync({ key: "autoGeneratePassword", value: autoGeneratePassword.toString() });
      await updateSetting.mutateAsync({ key: "nationalities", value: JSON.stringify(nationalities) });
      await updateSetting.mutateAsync({ key: "businessTypes", value: JSON.stringify(businessTypes) });
      toast.success(t("customerOptions.settingsSaved"));
    } catch (error) {
      toast.error(t("common.error"));
    }
  };
  
  const addNationality = () => {
    if (!newOption.id || !newOption.nameEn || !newOption.nameKu) {
      toast.error(t("common.fillAllFields"));
      return;
    }
    setNationalities([...nationalities, { ...newOption }]);
    setNewOption({ id: "", nameEn: "", nameKu: "" });
    setShowAddNationality(false);
  };
  
  const removeNationality = (id: string) => {
    setNationalities(nationalities.filter(n => n.id !== id));
  };
  
  const addBusinessType = () => {
    if (!newOption.id || !newOption.nameEn || !newOption.nameKu) {
      toast.error(t("common.fillAllFields"));
      return;
    }
    setBusinessTypes([...businessTypes, { ...newOption }]);
    setNewOption({ id: "", nameEn: "", nameKu: "" });
    setShowAddBusinessType(false);
  };
  
  const removeBusinessType = (id: string) => {
    setBusinessTypes(businessTypes.filter(b => b.id !== id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/customers")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="h-6 w-6" />
                {t("customerOptions.title")}
              </h1>
              <p className="text-muted-foreground">{t("customerOptions.subtitle")}</p>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={updateSetting.isPending}>
            <Save className="h-4 w-4 me-2" />
            {updateSetting.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t("customerOptions.general")}
            </TabsTrigger>
            <TabsTrigger value="nationalities" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("customerOptions.nationalities")}
            </TabsTrigger>
            <TabsTrigger value="businessTypes" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              {t("customerOptions.businessTypes")}
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>{t("customerOptions.generalSettings")}</CardTitle>
                <CardDescription>{t("customerOptions.generalSettingsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Default Code Prefix */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    {t("customerOptions.defaultCodePrefix")}
                  </Label>
                  <Select value={defaultCodePrefix} onValueChange={setDefaultCodePrefix}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {codePrefixes?.map((prefix) => (
                        <SelectItem key={prefix.code} value={prefix.code}>
                          {prefix.code} - {prefix.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">{t("customerOptions.codePrefixDesc")}</p>
                </div>

                {/* Email Required */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {t("customerOptions.emailRequired")}
                    </Label>
                    <p className="text-sm text-muted-foreground">{t("customerOptions.emailRequiredDesc")}</p>
                  </div>
                  <Switch checked={emailRequired} onCheckedChange={setEmailRequired} />
                </div>

                {/* Auto Generate Password */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {t("customerOptions.autoGeneratePassword")}
                    </Label>
                    <p className="text-sm text-muted-foreground">{t("customerOptions.autoGeneratePasswordDesc")}</p>
                  </div>
                  <Switch checked={autoGeneratePassword} onCheckedChange={setAutoGeneratePassword} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nationalities */}
          <TabsContent value="nationalities">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t("customerOptions.nationalities")}</CardTitle>
                  <CardDescription>{t("customerOptions.nationalitiesDesc")}</CardDescription>
                </div>
                <Button onClick={() => setShowAddNationality(true)}>
                  <Plus className="h-4 w-4 me-2" />
                  {t("common.add")}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {nationalities.map((nationality) => (
                    <div key={nationality.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{nationality.id}</Badge>
                        <span>{nationality.nameEn}</span>
                        <span className="text-muted-foreground">({nationality.nameKu})</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeNationality(nationality.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Business Types */}
          <TabsContent value="businessTypes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t("customerOptions.businessTypes")}</CardTitle>
                  <CardDescription>{t("customerOptions.businessTypesDesc")}</CardDescription>
                </div>
                <Button onClick={() => setShowAddBusinessType(true)}>
                  <Plus className="h-4 w-4 me-2" />
                  {t("common.add")}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {businessTypes.map((type) => (
                    <div key={type.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{type.id}</Badge>
                        <span>{type.nameEn}</span>
                        <span className="text-muted-foreground">({type.nameKu})</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeBusinessType(type.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Nationality Dialog */}
        <Dialog open={showAddNationality} onOpenChange={setShowAddNationality}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("customerOptions.addNationality")}</DialogTitle>
              <DialogDescription>{t("customerOptions.addNationalityDesc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("customerOptions.optionId")}</Label>
                <Input 
                  value={newOption.id} 
                  onChange={(e) => setNewOption({ ...newOption, id: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                  placeholder="e.g., chinese"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("customerOptions.nameEnglish")}</Label>
                <Input 
                  value={newOption.nameEn} 
                  onChange={(e) => setNewOption({ ...newOption, nameEn: e.target.value })}
                  placeholder="e.g., Chinese"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("customerOptions.nameKurdish")}</Label>
                <Input 
                  value={newOption.nameKu} 
                  onChange={(e) => setNewOption({ ...newOption, nameKu: e.target.value })}
                  placeholder="e.g., چینی"
                  dir="rtl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddNationality(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={addNationality}>
                {t("common.add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Business Type Dialog */}
        <Dialog open={showAddBusinessType} onOpenChange={setShowAddBusinessType}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("customerOptions.addBusinessType")}</DialogTitle>
              <DialogDescription>{t("customerOptions.addBusinessTypeDesc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("customerOptions.optionId")}</Label>
                <Input 
                  value={newOption.id} 
                  onChange={(e) => setNewOption({ ...newOption, id: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                  placeholder="e.g., manufacturer"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("customerOptions.nameEnglish")}</Label>
                <Input 
                  value={newOption.nameEn} 
                  onChange={(e) => setNewOption({ ...newOption, nameEn: e.target.value })}
                  placeholder="e.g., Manufacturer"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("customerOptions.nameKurdish")}</Label>
                <Input 
                  value={newOption.nameKu} 
                  onChange={(e) => setNewOption({ ...newOption, nameKu: e.target.value })}
                  placeholder="e.g., بەرهەمهێنەر"
                  dir="rtl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddBusinessType(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={addBusinessType}>
                {t("common.add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
