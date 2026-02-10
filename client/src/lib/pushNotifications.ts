// Push Notification Service for Customer Portal
// This service handles browser push notifications for request status changes

// Check if browser supports notifications
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window;
};

// Check if notifications are enabled
export const isNotificationEnabled = (): boolean => {
  return isNotificationSupported() && Notification.permission === 'granted';
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNotificationSupported()) {
    console.warn('This browser does not support notifications');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission === 'denied') {
    console.warn('Notifications are blocked by the user');
    return false;
  }
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

// Notification types
export type NotificationType = 
  | 'request_quoted'
  | 'request_accepted'
  | 'request_rejected'
  | 'request_paid'
  | 'request_shipped'
  | 'request_arrived'
  | 'request_delivered'
  | 'payment_received'
  | 'new_message';

// Notification content configuration
const notificationContent: Record<NotificationType, { 
  title: string; 
  titleKu: string; 
  icon: string;
  badge: string;
}> = {
  request_quoted: {
    title: 'Quote Ready!',
    titleKu: 'نرخ ئامادەیە!',
    icon: '/icons/quote.png',
    badge: '/icons/badge.png'
  },
  request_accepted: {
    title: 'Request Accepted',
    titleKu: 'داواکاری قبوڵکرا',
    icon: '/icons/accepted.png',
    badge: '/icons/badge.png'
  },
  request_rejected: {
    title: 'Request Rejected',
    titleKu: 'داواکاری ڕەتکرایەوە',
    icon: '/icons/rejected.png',
    badge: '/icons/badge.png'
  },
  request_paid: {
    title: 'Payment Confirmed',
    titleKu: 'پارەدان پشتڕاستکرایەوە',
    icon: '/icons/payment.png',
    badge: '/icons/badge.png'
  },
  request_shipped: {
    title: 'Order Shipped!',
    titleKu: 'داواکاری نێردرا!',
    icon: '/icons/shipped.png',
    badge: '/icons/badge.png'
  },
  request_arrived: {
    title: 'Order Arrived',
    titleKu: 'داواکاری گەیشت',
    icon: '/icons/arrived.png',
    badge: '/icons/badge.png'
  },
  request_delivered: {
    title: 'Order Delivered',
    titleKu: 'داواکاری گەیەندرا',
    icon: '/icons/delivered.png',
    badge: '/icons/badge.png'
  },
  payment_received: {
    title: 'Payment Received',
    titleKu: 'پارە وەرگیرا',
    icon: '/icons/payment.png',
    badge: '/icons/badge.png'
  },
  new_message: {
    title: 'New Message',
    titleKu: 'نامەی نوێ',
    icon: '/icons/message.png',
    badge: '/icons/badge.png'
  }
};

// Show a notification
export const showNotification = (
  type: NotificationType,
  body: string,
  options?: {
    isKurdish?: boolean;
    onClick?: () => void;
    data?: any;
  }
): void => {
  if (!isNotificationEnabled()) {
    console.warn('Notifications are not enabled');
    return;
  }
  
  const content = notificationContent[type];
  const title = options?.isKurdish ? content.titleKu : content.title;
  
  const notification = new Notification(title, {
    body,
    icon: content.icon || '/logo.png',
    badge: content.badge || '/logo.png',
    tag: type,
    requireInteraction: type === 'request_quoted' || type === 'new_message',
    data: options?.data
  } as NotificationOptions);
  
  if (options?.onClick) {
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  }
};

// Notification preferences storage
const NOTIFICATION_PREFS_KEY = 'wazn_notification_prefs';

export interface NotificationPreferences {
  enabled: boolean;
  requestUpdates: boolean;
  paymentUpdates: boolean;
  messages: boolean;
  sound: boolean;
}

const defaultPreferences: NotificationPreferences = {
  enabled: true,
  requestUpdates: true,
  paymentUpdates: true,
  messages: true,
  sound: true
};

export const getNotificationPreferences = (): NotificationPreferences => {
  try {
    const stored = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Error reading notification preferences:', e);
  }
  return defaultPreferences;
};

export const setNotificationPreferences = (prefs: Partial<NotificationPreferences>): void => {
  try {
    const current = getNotificationPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving notification preferences:', e);
  }
};

// Play notification sound
export const playNotificationSound = (): void => {
  const prefs = getNotificationPreferences();
  if (!prefs.sound) return;
  
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore autoplay errors
    });
  } catch (e) {
    // Ignore errors
  }
};

// Check for status changes and show notifications
export const checkAndNotifyStatusChange = (
  previousStatus: string | null,
  currentStatus: string,
  productName: string,
  options?: { isKurdish?: boolean; onClick?: () => void }
): void => {
  if (!previousStatus || previousStatus === currentStatus) return;
  
  const prefs = getNotificationPreferences();
  if (!prefs.enabled || !prefs.requestUpdates) return;
  
  const statusToNotificationType: Record<string, NotificationType> = {
    quoted: 'request_quoted',
    accepted: 'request_accepted',
    rejected: 'request_rejected',
    paid: 'request_paid',
    shipped: 'request_shipped',
    in_transit: 'request_shipped',
    arrived: 'request_arrived',
    delivered: 'request_delivered',
    completed: 'request_delivered'
  };
  
  const notificationType = statusToNotificationType[currentStatus];
  if (!notificationType) return;
  
  const bodyKu = `${productName} - دۆخی نوێ: ${currentStatus}`;
  const bodyEn = `${productName} - New status: ${currentStatus}`;
  const body = options?.isKurdish ? bodyKu : bodyEn;
  
  showNotification(notificationType, body, options);
  playNotificationSound();
};
