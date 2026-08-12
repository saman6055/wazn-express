import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Phone,
  Save,
  Loader2,
  Package,
  Truck,
  CheckCircle,
  AlertTriangle,
  Settings,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";

// Event type definitions with icons and descriptions
const eventTypes = [
  { 
    id: "package_registered", 
    name: "Package Registered", 
    description: "When a new package is registered",
    icon: Package,
    category: "package"
  },
  { 
    id: "package_in_batch", 
    name: "Added to Batch", 
    description: "When package is added to a shipping batch",
    icon: Package,
    category: "package"
  },
  { 
    id: "package_in_transit", 
    name: "In Transit", 
    description: "When package starts shipping",
    icon: Truck,
    category: "package"
  },
  { 
    id: "package_customs", 
    name: "At Customs", 
    description: "When package is at customs processing",
    icon: AlertTriangle,
    category: "package"
  },
  { 
    id: "package_ready_delivery", 
    name: "Ready for Delivery", 
    description: "When package arrives at local warehouse",
    icon: CheckCircle,
    category: "package"
  },
  { 
    id: "package_delivered", 
    name: "Delivered", 
    description: "When package is delivered to customer",
    icon: CheckCircle,
    category: "package"
  },
  { 
    id: "invoice_created", 
    name: "Invoice Created", 
    description: "When a new invoice is generated",
    icon: Mail,
    category: "billing"
  },
  { 
    id: "payment_received", 
    name: "Payment Received", 
    description: "When customer makes a payment",
    icon: CheckCircle,
    category: "billing"
  },
  { 
    id: "package_claimed", 
    name: "Package Claimed", 
    description: "When an unclaimed package is assigned to customer",
    icon: Package,
    category: "package"
  },
];

type NotificationSetting = {
  eventType: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappApiKey?: string;
  whatsappPhoneNumberId?: string;
  whatsappTemplateId?: string;
  customSubject?: string;
  customBody?: string;
};

export default function NotificationSettings() {
    const { t } = useTranslation();
const [settings, setSettings] = useState<Record<string, NotificationSetting>>({});
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [whatsappConfig, setWhatsappConfig] = useState({
    apiKey: "",
    phoneNumberId: "",
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: savedSettings, isLoading, refetch } = trpc.notifications.getSettings.useQuery();
  
  const updateSetting = trpc.notifications.updateSetting.useMutation({
    onSuccess: () => {
      toast.success("Settings saved successfully");
      setHasChanges(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const saveWhatsappConfig = trpc.notifications.saveWhatsappConfig.useMutation({
    onSuccess: () => {
      toast.success("WhatsApp configuration saved");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to save WhatsApp config: ${error.message}`);
    },
  });

  // Initialize settings from saved data
  useEffect(() => {
    if (savedSettings) {
      const settingsMap: Record<string, NotificationSetting> = {};
      for (const event of eventTypes) {
        const saved = savedSettings.find((s: any) => s.eventType === event.id);
        settingsMap[event.id] = {
          eventType: event.id,
          emailEnabled: saved?.emailEnabled ?? false,
          smsEnabled: saved?.smsEnabled ?? false,
          whatsappEnabled: saved?.whatsappEnabled ?? false,
          whatsappApiKey: saved?.whatsappApiKey || "",
          whatsappPhoneNumberId: saved?.whatsappPhoneNumberId || "",
          whatsappTemplateId: saved?.whatsappTemplateId || "",
          customSubject: saved?.customSubject || "",
          customBody: saved?.customBody || "",
        };
      }
      setSettings(settingsMap);
      
      // Get global WhatsApp config from first setting that has it
      const whatsappSetting = savedSettings.find((s: any) => s.whatsappApiKey);
      if (whatsappSetting) {
        setWhatsappConfig({
          apiKey: whatsappSetting.whatsappApiKey || "",
          phoneNumberId: whatsappSetting.whatsappPhoneNumberId || "",
        });
      }
    }
  }, [savedSettings]);

  const toggleChannel = (eventType: string, channel: "emailEnabled" | "smsEnabled" | "whatsappEnabled") => {
    setSettings(prev => ({
      ...prev,
      [eventType]: {
        ...prev[eventType],
        [channel]: !prev[eventType]?.[channel],
      },
    }));
    setHasChanges(true);
  };

  const updateCustomTemplate = (eventType: string, field: "customSubject" | "customBody", value: string) => {
    setSettings(prev => ({
      ...prev,
      [eventType]: {
        ...prev[eventType],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const saveSetting = (eventType: string) => {
    const setting = settings[eventType];
    if (setting) {
      updateSetting.mutate({
        eventType,
        emailEnabled: setting.emailEnabled,
        smsEnabled: setting.smsEnabled,
        whatsappEnabled: setting.whatsappEnabled,
        customSubject: setting.customSubject || undefined,
        customBody: setting.customBody || undefined,
      });
    }
  };

  const saveAllSettings = () => {
    for (const eventType of Object.keys(settings)) {
      saveSetting(eventType);
    }
  };

  const handleSaveWhatsappConfig = () => {
    saveWhatsappConfig.mutate({
      apiKey: whatsappConfig.apiKey,
      phoneNumberId: whatsappConfig.phoneNumberId,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const packageEvents = eventTypes.filter(e => e.category === "package");
  const billingEvents = eventTypes.filter(e => e.category === "billing");

  return (
    <DashboardLayout>
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notification Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure email, SMS, and WhatsApp notifications for each event
          </p>
        </div>
        {hasChanges && (
          <Button onClick={saveAllSettings} disabled={updateSetting.isPending}>
            {updateSetting.isPending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="me-2 h-4 w-4" />
            )}
            Save All Changes
          </Button>
        )}
      </div>

      {/* WhatsApp Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-300" />
            WhatsApp Business API Configuration
          </CardTitle>
          <CardDescription>
            Configure your WhatsApp Business API credentials to enable WhatsApp notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-api-key">API Key / Access Token</Label>
              <Input
                id="whatsapp-api-key"
                type="password"
                placeholder="Enter your WhatsApp API key"
                value={whatsappConfig.apiKey}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-phone-id">Phone Number ID</Label>
              <Input
                id="whatsapp-phone-id"
                placeholder="Enter your WhatsApp Phone Number ID"
                value={whatsappConfig.phoneNumberId}
                onChange={(e) => setWhatsappConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleSaveWhatsappConfig}
              disabled={saveWhatsappConfig.isPending || !whatsappConfig.apiKey}
            >
              {saveWhatsappConfig.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="me-2 h-4 w-4" />
              )}
              Save WhatsApp Config
            </Button>
            <span className="text-sm text-muted-foreground">
              Get your credentials from <a href="https://business.facebook.com/settings/whatsapp-business-accounts" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta Business Suite</a>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Package Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Package Events
          </CardTitle>
          <CardDescription>
            Notifications related to package status changes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {packageEvents.map(event => {
            const setting = settings[event.id];
            const Icon = event.icon;
            const isExpanded = expandedEvent === event.id;
            
            return (
              <Collapsible key={event.id} open={isExpanded} onOpenChange={() => setExpandedEvent(isExpanded ? null : event.id)}>
                <div className="border rounded-lg">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{event.name}</p>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Channel toggles */}
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                          <Switch
                            checked={setting?.emailEnabled ?? false}
                            onCheckedChange={() => toggleChannel(event.id, "emailEnabled")}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                          <Switch
                            checked={setting?.smsEnabled ?? false}
                            onCheckedChange={() => toggleChannel(event.id, "smsEnabled")}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-300" />
                          <Switch
                            checked={setting?.whatsappEnabled ?? false}
                            onCheckedChange={() => toggleChannel(event.id, "whatsappEnabled")}
                            disabled={!whatsappConfig.apiKey}
                          />
                        </div>
                      </div>
                      
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4 me-1" />
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                  
                  <CollapsibleContent>
                    <div className="border-t p-4 bg-muted/30 space-y-4">
                      <div className="space-y-2">
                        <Label>Custom Subject (optional)</Label>
                        <Input
                          placeholder="Leave empty to use default template"
                          value={setting?.customSubject || ""}
                          onChange={(e) => updateCustomTemplate(event.id, "customSubject", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Custom Message (optional)</Label>
                        <Textarea
                          placeholder="Leave empty to use default template. Use {{customerName}}, {{packageCode}}, {{trackingNumber}} as variables."
                          value={setting?.customBody || ""}
                          onChange={(e) => updateCustomTemplate(event.id, "customBody", e.target.value)}
                          rows={4}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button 
                          size="sm" 
                          onClick={() => saveSetting(event.id)}
                          disabled={updateSetting.isPending}
                        >
                          {updateSetting.isPending ? (
                            <Loader2 className="me-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="me-2 h-4 w-4" />
                          )}
                          Save This Event
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* Billing Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Billing Events
          </CardTitle>
          <CardDescription>
            Notifications related to invoices and payments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {billingEvents.map(event => {
            const setting = settings[event.id];
            const Icon = event.icon;
            const isExpanded = expandedEvent === event.id;
            
            return (
              <Collapsible key={event.id} open={isExpanded} onOpenChange={() => setExpandedEvent(isExpanded ? null : event.id)}>
                <div className="border rounded-lg">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{event.name}</p>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                          <Switch
                            checked={setting?.emailEnabled ?? false}
                            onCheckedChange={() => toggleChannel(event.id, "emailEnabled")}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                          <Switch
                            checked={setting?.smsEnabled ?? false}
                            onCheckedChange={() => toggleChannel(event.id, "smsEnabled")}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-300" />
                          <Switch
                            checked={setting?.whatsappEnabled ?? false}
                            onCheckedChange={() => toggleChannel(event.id, "whatsappEnabled")}
                            disabled={!whatsappConfig.apiKey}
                          />
                        </div>
                      </div>
                      
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4 me-1" />
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                  
                  <CollapsibleContent>
                    <div className="border-t p-4 bg-muted/30 space-y-4">
                      <div className="space-y-2">
                        <Label>Custom Subject (optional)</Label>
                        <Input
                          placeholder="Leave empty to use default template"
                          value={setting?.customSubject || ""}
                          onChange={(e) => updateCustomTemplate(event.id, "customSubject", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Custom Message (optional)</Label>
                        <Textarea
                          placeholder="Leave empty to use default template"
                          value={setting?.customBody || ""}
                          onChange={(e) => updateCustomTemplate(event.id, "customBody", e.target.value)}
                          rows={4}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button 
                          size="sm" 
                          onClick={() => saveSetting(event.id)}
                          disabled={updateSetting.isPending}
                        >
                          {updateSetting.isPending ? (
                            <Loader2 className="me-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="me-2 h-4 w-4" />
                          )}
                          Save This Event
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              <span>Email</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-purple-600 dark:text-purple-300" />
              <span>SMS</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-300" />
              <span>WhatsApp</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
