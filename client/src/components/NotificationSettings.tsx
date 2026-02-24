import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  BellRing,
  Volume2,
  VolumeX,
  Package,
  CreditCard,
  MessageCircle,
  Settings,
  Check,
  X,
  Sparkles
} from "lucide-react";
import {
  isNotificationSupported,
  isNotificationEnabled,
  requestNotificationPermission,
  getNotificationPreferences,
  setNotificationPreferences,
  showNotification,
  type NotificationPreferences
} from "@/lib/pushNotifications";

interface NotificationSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationSettings({ open, onOpenChange }: NotificationSettingsProps) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isKurdish = language === "ku";
  const isDark = theme === "dark";
  
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences>(getNotificationPreferences());
  const [isRequesting, setIsRequesting] = useState(false);
  
  useEffect(() => {
    if (isNotificationSupported()) {
      setBrowserPermission(Notification.permission);
    }
  }, [open]);
  
  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestNotificationPermission();
      setBrowserPermission(Notification.permission);
      
      if (granted) {
        toast.success(isKurdish ? "ئاگادارییەکان چالاککران!" : "Notifications enabled!");
        // Show a test notification
        showNotification('new_message', isKurdish ? "ئاگادارییەکان کاردەکەن!" : "Notifications are working!", { isKurdish });
      } else {
        toast.error(isKurdish ? "ئاگادارییەکان بلۆککراون" : "Notifications were blocked");
      }
    } catch (error) {
      toast.error(isKurdish ? "هەڵەیەک ڕوویدا" : "An error occurred");
    }
    setIsRequesting(false);
  };
  
  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    setNotificationPreferences(updated);
    
    if (key === 'enabled' && value) {
      toast.success(isKurdish ? "ئاگادارییەکان چالاککران" : "Notifications enabled");
    } else if (key === 'enabled' && !value) {
      toast.info(isKurdish ? "ئاگادارییەکان ناچالاککران" : "Notifications disabled");
    }
  };
  
  const settingsItems = [
    {
      key: 'requestUpdates' as const,
      icon: Package,
      label: isKurdish ? "نوێکاری داواکارییەکان" : "Request Updates",
      description: isKurdish ? "ئاگاداری کاتێک دۆخی داواکاری دەگۆڕێت" : "Get notified when request status changes",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    {
      key: 'paymentUpdates' as const,
      icon: CreditCard,
      label: isKurdish ? "نوێکاری پارەدان" : "Payment Updates",
      description: isKurdish ? "ئاگاداری پارەدان و گواستنەوەی پارە" : "Get notified about payments and transfers",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10"
    },
    {
      key: 'messages' as const,
      icon: MessageCircle,
      label: isKurdish ? "نامەکان" : "Messages",
      description: isKurdish ? "ئاگاداری نامەی نوێ" : "Get notified about new messages",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    {
      key: 'sound' as const,
      icon: preferences.sound ? Volume2 : VolumeX,
      label: isKurdish ? "دەنگی ئاگاداری" : "Notification Sound",
      description: isKurdish ? "لێدانی دەنگ کاتێک ئاگاداری دێت" : "Play sound when notification arrives",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10"
    }
  ];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-md p-0 overflow-hidden",
        isDark ? "bg-slate-900 border-slate-700" : "bg-white"
      )}>
        {/* Header */}
        <div className={cn(
          "relative overflow-hidden",
          isDark 
            ? "bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-900" 
            : "bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-600"
        )}>
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          </div>
          
          <div className="relative px-6 py-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center"
            >
              <BellRing className="w-8 h-8 text-white" />
            </motion.div>
            <DialogTitle className="text-xl font-bold text-white mb-2">
              {isKurdish ? "ڕێکخستنی ئاگادارییەکان" : "Notification Settings"}
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {isKurdish 
                ? "ڕێکخستنی ئاگادارییەکان بۆ نوێکاری داواکارییەکانت" 
                : "Configure notifications for your request updates"}
            </DialogDescription>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Browser Permission Status */}
          {!isNotificationSupported() ? (
            <Card className={cn(
              "border-amber-200",
              isDark ? "bg-amber-500/10" : "bg-amber-50"
            )}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <BellOff className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "font-medium text-sm",
                    isDark ? "text-amber-400" : "text-amber-800"
                  )}>
                    {isKurdish ? "ئەم براوزەرە پشتگیری ئاگاداری ناکات" : "This browser doesn't support notifications"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : browserPermission === 'denied' ? (
            <Card className={cn(
              "border-red-200",
              isDark ? "bg-red-500/10" : "bg-red-50"
            )}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "font-medium text-sm",
                    isDark ? "text-red-400" : "text-red-800"
                  )}>
                    {isKurdish ? "ئاگادارییەکان بلۆککراون" : "Notifications are blocked"}
                  </p>
                  <p className={cn(
                    "text-xs mt-1",
                    isDark ? "text-red-400/70" : "text-red-600"
                  )}>
                    {isKurdish 
                      ? "تکایە لە ڕێکخستنەکانی براوزەر ڕێگەی پێبدە" 
                      : "Please enable in browser settings"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : browserPermission === 'default' ? (
            <Card className={cn(
              "border-purple-200",
              isDark ? "bg-purple-500/10" : "bg-purple-50"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      "font-medium text-sm",
                      isDark ? "text-purple-400" : "text-purple-800"
                    )}>
                      {isKurdish ? "ئاگادارییەکان چالاک نییە" : "Notifications not enabled"}
                    </p>
                    <p className={cn(
                      "text-xs mt-1",
                      isDark ? "text-purple-400/70" : "text-purple-600"
                    )}>
                      {isKurdish 
                        ? "ڕێگەی پێبدە بۆ وەرگرتنی نوێکارییەکان" 
                        : "Enable to receive updates"}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleRequestPermission}
                  disabled={isRequesting}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
                >
                  {isRequesting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Bell className="w-4 h-4 me-2" />
                    </motion.div>
                  ) : (
                    <Bell className="w-4 h-4 me-2" />
                  )}
                  {isKurdish ? "چالاککردنی ئاگادارییەکان" : "Enable Notifications"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className={cn(
              "border-emerald-200",
              isDark ? "bg-emerald-500/10" : "bg-emerald-50"
            )}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "font-medium text-sm",
                    isDark ? "text-emerald-400" : "text-emerald-800"
                  )}>
                    {isKurdish ? "ئاگادارییەکان چالاکن" : "Notifications are enabled"}
                  </p>
                </div>
                <Switch
                  checked={preferences.enabled}
                  onCheckedChange={(checked) => handlePreferenceChange('enabled', checked)}
                />
              </CardContent>
            </Card>
          )}
          
          {/* Settings List */}
          <AnimatePresence>
            {browserPermission === 'granted' && preferences.enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                {settingsItems.map((item, index) => (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl",
                      isDark ? "bg-slate-800" : "bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      item.bgColor
                    )}>
                      <item.icon className={cn("w-5 h-5", item.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium text-sm",
                        isDark ? "text-white" : "text-slate-800"
                      )}>
                        {item.label}
                      </p>
                      <p className={cn(
                        "text-xs truncate",
                        isDark ? "text-slate-400" : "text-slate-500"
                      )}>
                        {item.description}
                      </p>
                    </div>
                    <Switch
                      checked={preferences[item.key]}
                      onCheckedChange={(checked) => handlePreferenceChange(item.key, checked)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Notification Bell Button Component
export function NotificationBellButton({ onClick }: { onClick: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [hasPermission, setHasPermission] = useState(false);
  
  useEffect(() => {
    setHasPermission(isNotificationEnabled());
  }, []);
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        "relative rounded-xl",
        isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
      )}
    >
      {hasPermission ? (
        <Bell className={cn("w-5 h-5", isDark ? "text-slate-400" : "text-slate-600")} />
      ) : (
        <>
          <BellOff className={cn("w-5 h-5", isDark ? "text-slate-400" : "text-slate-600")} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
        </>
      )}
    </Button>
  );
}
