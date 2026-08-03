import { notifyStaffAlert } from "../_core/notifyStaff";
import * as db from "../db";
import { appLogger } from "../utils/logger";

interface OrderWithDaysWaiting {
  id: number;
  orderCode: string;
  productName: string;
  daysWaiting: number;
  calculatedAlertLevel: "none" | "warning" | "urgent" | "critical";
}

/**
 * Check for packages without tracking numbers for 3+ days
 * and send notifications to the owner
 */
export async function checkAndNotifyTrackingAlerts(): Promise<void> {
  try {
    // Get all packages without tracking numbers
    const orders = await db.getOrdersPendingTracking();
    const now = new Date();
    
    // Calculate days waiting and filter for alerts
    const alertingPackages: OrderWithDaysWaiting[] = orders
      .map(order => {
        const orderDate = order.orderDate ? new Date(order.orderDate) : null;
        const daysWaiting = orderDate ? Math.floor((now.getTime() - orderDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
        
        let alertLevel: "none" | "warning" | "urgent" | "critical" = "none";
        if (daysWaiting >= 7) alertLevel = "critical";
        else if (daysWaiting >= 5) alertLevel = "urgent";
        else if (daysWaiting >= 3) alertLevel = "warning";
        
        return {
          id: order.id,
          orderCode: order.orderCode,
          productName: order.productName,
          daysWaiting,
          calculatedAlertLevel: alertLevel,
        };
      })
      .filter(o => o.daysWaiting >= 3);
    
    if (alertingPackages.length === 0) {
      appLogger.info("[Tracking Alerts] No packages requiring notifications");
      return;
    }

    // Group by severity
    const critical = alertingPackages.filter(p => p.daysWaiting >= 7);
    const urgent = alertingPackages.filter(p => p.daysWaiting >= 5 && p.daysWaiting < 7);
    const warning = alertingPackages.filter(p => p.daysWaiting >= 3 && p.daysWaiting < 5);

    // Build notification content
    let content = "**ئاگادارکردنەوەی تراکینگ**\n\n";
    
    if (critical.length > 0) {
      content += `🔴 **فریاکەوتن (7+ رۆژ)**: ${critical.length} پاکەت\n`;
      critical.slice(0, 3).forEach(p => {
        content += `  • ${p.orderCode} - ${p.productName} (${p.daysWaiting} رۆژ)\n`;
      });
      if (critical.length > 3) {
        content += `  ... و ${critical.length - 3} پاکەتی تر\n`;
      }
      content += "\n";
    }

    if (urgent.length > 0) {
      content += `🟠 **گرنگ (5-7 رۆژ)**: ${urgent.length} پاکەت\n`;
      urgent.slice(0, 3).forEach(p => {
        content += `  • ${p.orderCode} - ${p.productName} (${p.daysWaiting} رۆژ)\n`;
      });
      if (urgent.length > 3) {
        content += `  ... و ${urgent.length - 3} پاکەتی تر\n`;
      }
      content += "\n";
    }

    if (warning.length > 0) {
      content += `🟡 **ئاگاداری (3-5 رۆژ)**: ${warning.length} پاکەت\n`;
      warning.slice(0, 3).forEach(p => {
        content += `  • ${p.orderCode} - ${p.productName} (${p.daysWaiting} رۆژ)\n`;
      });
      if (warning.length > 3) {
        content += `  ... و ${warning.length - 3} پاکەتی تر\n`;
      }
    }

    content += `\n**کۆی پاکەتەکان**: ${alertingPackages.length}\n`;
    content += "بڕۆ بۆ ئاگادارکردنەوەی تراکینگ بۆ تێڕوانین و تراکینگ نەمبەرەکان زیاد بکە.";

    // Goes to the staff activity feed, which staff actually read, and onward
    // to the external service only when that is configured.
    await notifyStaffAlert({
      action: "tracking_alert_digest",
      category: "full_package",
      severity: "warning",
      title: `⚠️ ئاگادارکردنەوەی تراکینگ - ${alertingPackages.length} پاکەت بێ تراکینگ`,
      content,
    });
    appLogger.info("[Tracking Alerts] Alert raised", { count: alertingPackages.length });
  } catch (error) {
    appLogger.error("[Tracking Alerts] Error checking and notifying", { error: error instanceof Error ? error.message : String(error) });
  }
}

let trackingAlertInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Schedule tracking alert notifications
 * Should be called from a background job or cron service
 */
export async function scheduleTrackingAlertNotifications(): Promise<void> {
  // Clear any existing interval to prevent duplicates
  if (trackingAlertInterval) {
    clearInterval(trackingAlertInterval);
    trackingAlertInterval = null;
  }

  // Run every 6 hours
  trackingAlertInterval = setInterval(async () => {
    try {
      await checkAndNotifyTrackingAlerts();
    } catch (error) {
      appLogger.error("[Tracking Alerts] Scheduled check failed", { error: error instanceof Error ? error.message : String(error) });
    }
  }, 6 * 60 * 60 * 1000);

  // Run once on startup
  await checkAndNotifyTrackingAlerts();
}

export function stopTrackingAlertNotifications(): void {
  if (trackingAlertInterval) {
    clearInterval(trackingAlertInterval);
    trackingAlertInterval = null;
  }
}
