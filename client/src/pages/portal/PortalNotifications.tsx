import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { trpc } from "@/lib/trpc";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { 
  Bell, ArrowLeft, Package, CreditCard, Megaphone, 
  AlertCircle, CheckCircle, Info, Gift, ChevronRight,
  CheckCheck
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { pickLang } from "@/lib/lang";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { PortalErrorState } from "@/components/portal/PortalErrorState";

// Destinations that aren't worth a "View" link — landing on the portal home
// from the notifications page reads as "nothing happened".
const DEAD_ACTION_URLS = new Set(["/portal", "/portal/", "/"]);

export default function PortalNotifications() {
  // Banner colour follows the mode the customer picked, like every other page.
  const { banner: portalBanner } = usePortalPalette();
  // Was entirely English, including the timestamps every customer reads.
  const { language } = useLanguage();
const { data: notifications, isLoading, isError, isFetching, refetch } = trpc.customerPortal.getMyNotifications.useQuery();
  // Tapping a notification expands it in place to show the full message.
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // The bell badge on home reads getNotificationCount, a separate query.
  // Refetching only the list left the badge stuck at its old number — and the
  // bell kept ringing — after the customer had read everything.
  const utils = trpc.useUtils();
  const onRead = () => {
    refetch();
    utils.customerPortal.getNotificationCount.invalidate();
  };

  // Both used to fail silently — the only visible effect of a failure was the
  // button becoming clickable again.
  const onError = () =>
    toast.error(pickLang(language, {
      ku: "نەتوانرا بخوێنرێتەوە، دووبارە هەوڵ بدەرەوە",
      en: "Couldn't update. Please try again.",
      ar: "تعذّر التحديث، حاول مرة أخرى.",
      zh: "更新失败，请重试。",
    }));

  const markAsReadMutation = trpc.customerPortal.markNotificationAsRead.useMutation({
    onSuccess: onRead,
    onError,
  });

  const markAllAsReadMutation = trpc.customerPortal.markAllNotificationsAsRead.useMutation({
    onSuccess: onRead,
    onError,
  });
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "package":
        return <Package className="h-5 w-5" />;
      case "payment":
        return <CreditCard className="h-5 w-5" />;
      case "promotion":
        return <Gift className="h-5 w-5" />;
      case "success":
        return <CheckCircle className="h-5 w-5" />;
      case "warning":
        return <AlertCircle className="h-5 w-5" />;
      case "error":
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };
  
  const getNotificationColor = (type: string) => {
    switch (type) {
      case "package":
        return "from-blue-400 to-blue-500";
      case "payment":
        return "from-green-400 to-green-500";
      case "promotion":
        return "from-purple-400 to-purple-500";
      case "success":
        return "from-emerald-400 to-emerald-500";
      case "warning":
        return "from-amber-400 to-amber-500";
      case "error":
        return "from-red-400 to-red-500";
      default:
        return "from-gray-400 to-gray-500";
    }
  };
  
  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return pickLang(language, { ku: "ئێستا", en: "Just now", ar: "الآن", zh: "刚刚" });
    if (diffMins < 60) return `${diffMins} `+pickLang(language, { ku: "خولەک لەمەوپێش", en: "min ago", ar: "دقيقة مضت", zh: "分钟前" });
    if (diffHours < 24) return `${diffHours} `+pickLang(language, { ku: "کاتژمێر لەمەوپێش", en: "h ago", ar: "ساعة مضت", zh: "小时前" });
    if (diffDays < 7) return `${diffDays} `+pickLang(language, { ku: "ڕۆژ لەمەوپێش", en: "d ago", ar: "يوم مضى", zh: "天前" });
    return d.toLocaleDateString();
  };
  
  // The schema carries titleKu/titleAr and messageKu/messageAr, written by
  // whoever raised the notification — and nothing rendered them, so a Kurdish
  // customer read the default-language text even when a translation existed.
  const localised = (n: any, field: "title" | "message"): string => {
    const suffix = language === "ku" ? "Ku" : language === "ar" ? "Ar" : null;
    return (suffix && n[field + suffix]) || n[field] || "";
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <PortalLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950/40">
        {/* Header */}
        <div className="text-white px-4 py-4" style={portalBanner}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/portal/profile">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold">{pickLang(language, { ku: "ئاگادارکردنەوەکان", en: "Notifications", ar: "الإشعارات", zh: "通知" })}</h1>
                  <p className="text-xs text-gray-300">
                    {unreadCount > 0 ? `${unreadCount} `+pickLang(language, { ku: "نەخوێندراوە", en: "unread", ar: "غير مقروء", zh: "未读" }) : pickLang(language, { ku: "هەمووی خوێندراوەتەوە", en: "All caught up", ar: "لا جديد", zh: "全部已读" })}
                  </p>
                </div>
              </div>
            </div>
            
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 text-xs"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                <CheckCheck className="h-4 w-4 me-1" />
                {pickLang(language, { ku: "هەمووی بخوێنەوە", en: "Mark all read", ar: "تعليم الكل كمقروء", zh: "全部标为已读" })}
              </Button>
            )}
          </div>
        </div>
        
        {/* Notifications List */}
        <div className="px-4 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-full" />
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            /* Was indistinguishable from having no notifications. */
            <PortalErrorState onRetry={() => void refetch()} isRetrying={isFetching} />
          ) : notifications?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mb-4">
                <Bell className="h-10 w-10 text-blue-500" />
              </div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{pickLang(language, { ku: "هیچ ئاگادارکردنەوەیەک نییە", en: "No notifications", ar: "لا توجد إشعارات", zh: "暂无通知" })}</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                {pickLang(language, { ku: "هەموو شتێک خوێندراوەتەوە. کاتێک شتێکی گرنگ ڕوودەدات ئاگادارت دەکەینەوە.", en: "You are all caught up. We will let you know when something happens.", ar: "لا يوجد جديد. سنخبرك عند حدوث شيء مهم.", zh: "暂时没有新消息，有重要动态会通知您。" })}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications?.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "bg-white rounded-xl p-4 shadow-sm transition-all duration-200",
                    !notification.isRead && "border-l-4 border-blue-500 bg-blue-50/50"
                  )}
                  onClick={() => {
                    setExpandedId((prev) => (prev === notification.id ? null : notification.id));
                    if (!notification.isRead) {
                      markAsReadMutation.mutate({ notificationId: notification.id });
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0",
                      getNotificationColor(notification.type)
                    )}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={cn(
                          "font-medium text-gray-800 dark:text-gray-200",
                          !notification.isRead && "font-semibold"
                        )}>
                          {localised(notification, "title")}
                        </h3>
                        {!notification.isRead && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                        )}
                      </div>
                      
                      <p className={cn(
                        "text-sm text-gray-600 mt-1 whitespace-pre-wrap",
                        expandedId !== notification.id && "line-clamp-2"
                      )}>
                        {localised(notification, "message")}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {formatTime(notification.createdAt)}
                        </span>

                        {/* Only link out when there's a real destination —
                            generic "/portal" reads as a dead button. */}
                        {notification.actionUrl && !DEAD_ACTION_URLS.has(notification.actionUrl) && (
                          <Link href={notification.actionUrl} onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 h-auto p-0 text-xs">
                              {notification.actionLabel || "View"}
                              <ChevronRight className="h-3 w-3 ms-1" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
