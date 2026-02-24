import { trpc } from "@/lib/trpc";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { Button } from "@/components/ui/button";
import { 
  Bell, ArrowLeft, Package, CreditCard, Megaphone, 
  AlertCircle, CheckCircle, Info, Gift, ChevronRight,
  CheckCheck
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export default function PortalNotifications() {
const { data: notifications, isLoading, refetch } = trpc.customerPortal.getMyNotifications.useQuery();
  
  const markAsReadMutation = trpc.customerPortal.markNotificationAsRead.useMutation({
    onSuccess: () => refetch(),
  });
  
  const markAllAsReadMutation = trpc.customerPortal.markAllNotificationsAsRead.useMutation({
    onSuccess: () => refetch(),
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
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };
  
  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <CustomerPortalLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-4">
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
                  <h1 className="font-semibold">Notifications</h1>
                  <p className="text-xs text-gray-300">
                    {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
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
                Mark all read
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
          ) : notifications?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mb-4">
                <Bell className="h-10 w-10 text-blue-500" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">No Notifications</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                You're all caught up! We'll notify you when something important happens.
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
                          "font-medium text-gray-800",
                          !notification.isRead && "font-semibold"
                        )}>
                          {notification.title}
                        </h3>
                        {!notification.isRead && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {formatTime(notification.createdAt)}
                        </span>
                        
                        {notification.actionUrl && (
                          <Link href={notification.actionUrl}>
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
    </CustomerPortalLayout>
  );
}
