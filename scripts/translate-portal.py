#!/usr/bin/env python3
"""
Add customer portal translations to locale files.
"""

import json
from pathlib import Path

LOCALES_DIR = Path("/home/ubuntu/wazn-express/client/src/locales")

# Customer Portal translations
PORTAL_TRANSLATIONS = {
    "portal": {
        # Batch Card
        "batchNo": {"ku": "ژمارەی باچ", "en": "Batch No.", "ar": "رقم الدفعة", "zh": "批次号"},
        "ctnQuantity": {"ku": "ژمارەی کارتۆن", "en": "CTN Quantity", "ar": "عدد الكراتين", "zh": "纸箱数量"},
        "viewDetails": {"ku": "بینینی وردەکاری", "en": "View Details", "ar": "عرض التفاصيل", "zh": "查看详情"},
        "estimatedArrival": {"ku": "کاتی گەیشتنی چاوەڕوانکراو", "en": "Estimated time of arrival", "ar": "الوقت المتوقع للوصول", "zh": "预计到达时间"},
        "days": {"ku": "ڕۆژ", "en": "days", "ar": "أيام", "zh": "天"},
        
        # Status labels
        "inTransit": {"ku": "لە ڕێگادا", "en": "In Transit", "ar": "في الطريق", "zh": "运输中"},
        "arrived": {"ku": "گەیشتووە", "en": "Arrived", "ar": "وصل", "zh": "已到达"},
        "received": {"ku": "وەرگیرا", "en": "Received", "ar": "تم الاستلام", "zh": "已收到"},
        "customs": {"ku": "گومرگ", "en": "Customs", "ar": "الجمارك", "zh": "海关"},
        "delivered": {"ku": "گەیاندرا", "en": "Delivered", "ar": "تم التسليم", "zh": "已送达"},
        
        # Shipping types
        "airTran": {"ku": "گواستنەوەی ئاسمانی", "en": "Air Transport", "ar": "الشحن الجوي", "zh": "空运"},
        "seaTran": {"ku": "گواستنەوەی دەریایی", "en": "Sea Transport", "ar": "الشحن البحري", "zh": "海运"},
        "dangerous": {"ku": "بارە مەترسیدارەکان", "en": "Dangerous Goods", "ar": "البضائع الخطرة", "zh": "危险品"},
        
        # Navigation tabs
        "news": {"ku": "هەواڵەکان", "en": "News", "ar": "الأخبار", "zh": "新闻"},
        "transport": {"ku": "گواستنەوە", "en": "Transport", "ar": "النقل", "zh": "运输"},
        "search": {"ku": "گەڕان", "en": "Search", "ar": "بحث", "zh": "搜索"},
        "financial": {"ku": "دارایی", "en": "Financial", "ar": "المالية", "zh": "财务"},
        "me": {"ku": "من", "en": "Me", "ar": "أنا", "zh": "我"},
        
        # Detail view
        "arrivalDate": {"ku": "بەرواری گەیشتن", "en": "Arrival Date", "ar": "تاريخ الوصول", "zh": "到达日期"},
        "departureDate": {"ku": "بەرواری ڕۆیشتن", "en": "Departure Date", "ar": "تاريخ المغادرة", "zh": "出发日期"},
        "totalWeight": {"ku": "کۆی کێش", "en": "Total Weight", "ar": "الوزن الإجمالي", "zh": "总重量"},
        "totalCtn": {"ku": "کۆی کارتۆن", "en": "Total CTN", "ar": "إجمالي الكراتين", "zh": "纸箱总数"},
        "trackingNumbers": {"ku": "ژمارەکانی شوێنکەوتن", "en": "Tracking Numbers", "ar": "أرقام التتبع", "zh": "追踪号"},
        "route": {"ku": "ڕێگا", "en": "Route", "ar": "المسار", "zh": "路线"},
        "flightNo": {"ku": "ژمارەی فڕۆکە", "en": "Flight No.", "ar": "رقم الرحلة", "zh": "航班号"},
        "vesselName": {"ku": "ناوی کەشتی", "en": "Vessel Name", "ar": "اسم السفينة", "zh": "船名"},
        "containerNo": {"ku": "ژمارەی کۆنتەینەر", "en": "Container No.", "ar": "رقم الحاوية", "zh": "集装箱号"},
        
        # Package details
        "packageCode": {"ku": "کۆدی پاکەت", "en": "Package Code", "ar": "رمز الطرد", "zh": "包裹代码"},
        "weight": {"ku": "کێش", "en": "Weight", "ar": "الوزن", "zh": "重量"},
        "volume": {"ku": "قەبارە", "en": "Volume", "ar": "الحجم", "zh": "体积"},
        "content": {"ku": "ناوەڕۆک", "en": "Content", "ar": "المحتوى", "zh": "内容"},
        "status": {"ku": "بارودۆخ", "en": "Status", "ar": "الحالة", "zh": "状态"},
        
        # Financial section
        "balance": {"ku": "باڵانس", "en": "Balance", "ar": "الرصيد", "zh": "余额"},
        "totalDebt": {"ku": "کۆی قەرز", "en": "Total Debt", "ar": "إجمالي الدين", "zh": "总债务"},
        "totalPaid": {"ku": "کۆی پارەدراو", "en": "Total Paid", "ar": "إجمالي المدفوع", "zh": "已付总额"},
        "unpaidInvoices": {"ku": "پسوڵە نەدراوەکان", "en": "Unpaid Invoices", "ar": "الفواتير غير المدفوعة", "zh": "未付发票"},
        "paymentHistory": {"ku": "مێژووی پارەدان", "en": "Payment History", "ar": "سجل المدفوعات", "zh": "付款历史"},
        "makePayment": {"ku": "پارەدان", "en": "Make Payment", "ar": "إجراء دفعة", "zh": "付款"},
        
        # Profile section
        "profile": {"ku": "پڕۆفایل", "en": "Profile", "ar": "الملف الشخصي", "zh": "个人资料"},
        "customerCode": {"ku": "کۆدی کڕیار", "en": "Customer Code", "ar": "رمز العميل", "zh": "客户代码"},
        "fullName": {"ku": "ناوی تەواو", "en": "Full Name", "ar": "الاسم الكامل", "zh": "全名"},
        "phone": {"ku": "تەلەفۆن", "en": "Phone", "ar": "الهاتف", "zh": "电话"},
        "email": {"ku": "ئیمەیڵ", "en": "Email", "ar": "البريد الإلكتروني", "zh": "邮箱"},
        "address": {"ku": "ناونیشان", "en": "Address", "ar": "العنوان", "zh": "地址"},
        "memberSince": {"ku": "ئەندام لە", "en": "Member Since", "ar": "عضو منذ", "zh": "注册时间"},
        "editProfile": {"ku": "دەستکاری پڕۆفایل", "en": "Edit Profile", "ar": "تعديل الملف الشخصي", "zh": "编辑资料"},
        "changePassword": {"ku": "گۆڕینی وشەی نهێنی", "en": "Change Password", "ar": "تغيير كلمة المرور", "zh": "修改密码"},
        "logout": {"ku": "چوونەدەرەوە", "en": "Logout", "ar": "تسجيل الخروج", "zh": "退出"},
        
        # Search
        "searchPackages": {"ku": "گەڕان بە پاکەت", "en": "Search Packages", "ar": "البحث عن طرود", "zh": "搜索包裹"},
        "enterTrackingNumber": {"ku": "ژمارەی شوێنکەوتن داخڵ بکە", "en": "Enter tracking number", "ar": "أدخل رقم التتبع", "zh": "输入追踪号"},
        "searchResults": {"ku": "ئەنجامەکانی گەڕان", "en": "Search Results", "ar": "نتائج البحث", "zh": "搜索结果"},
        "noResults": {"ku": "ئەنجام نەدۆزرایەوە", "en": "No results found", "ar": "لم يتم العثور على نتائج", "zh": "未找到结果"},
        
        # Notifications
        "notifications": {"ku": "ئاگادارکردنەوەکان", "en": "Notifications", "ar": "الإشعارات", "zh": "通知"},
        "noNotifications": {"ku": "ئاگادارکردنەوە نییە", "en": "No notifications", "ar": "لا توجد إشعارات", "zh": "没有通知"},
        "markAsRead": {"ku": "نیشانکردن وەک خوێندراو", "en": "Mark as read", "ar": "تحديد كمقروء", "zh": "标记为已读"},
        
        # Language
        "language": {"ku": "زمان", "en": "Language", "ar": "اللغة", "zh": "语言"},
        "kurdish": {"ku": "کوردی", "en": "Kurdish", "ar": "الكردية", "zh": "库尔德语"},
        "english": {"ku": "ئینگلیزی", "en": "English", "ar": "الإنجليزية", "zh": "英语"},
        "arabic": {"ku": "عەرەبی", "en": "Arabic", "ar": "العربية", "zh": "阿拉伯语"},
        "chinese": {"ku": "چینی", "en": "Chinese", "ar": "الصينية", "zh": "中文"},
        
        # Support
        "support": {"ku": "پشتگیری", "en": "Support", "ar": "الدعم", "zh": "支持"},
        "contactSupport": {"ku": "پەیوەندی بە پشتگیری", "en": "Contact Support", "ar": "اتصل بالدعم", "zh": "联系支持"},
        "helpCenter": {"ku": "ناوەندی یارمەتی", "en": "Help Center", "ar": "مركز المساعدة", "zh": "帮助中心"},
        "faq": {"ku": "پرسیارە باوەکان", "en": "FAQ", "ar": "الأسئلة الشائعة", "zh": "常见问题"},
        
        # Empty states
        "noPackages": {"ku": "پاکەت نییە", "en": "No packages", "ar": "لا توجد طرود", "zh": "没有包裹"},
        "noBatches": {"ku": "باچ نییە", "en": "No batches", "ar": "لا توجد دفعات", "zh": "没有批次"},
        "noTransactions": {"ku": "مامەڵە نییە", "en": "No transactions", "ar": "لا توجد معاملات", "zh": "没有交易"},
        
        # Actions
        "refresh": {"ku": "نوێکردنەوە", "en": "Refresh", "ar": "تحديث", "zh": "刷新"},
        "loadMore": {"ku": "زیاتر ببینە", "en": "Load More", "ar": "تحميل المزيد", "zh": "加载更多"},
        "back": {"ku": "گەڕانەوە", "en": "Back", "ar": "رجوع", "zh": "返回"},
        "close": {"ku": "داخستن", "en": "Close", "ar": "إغلاق", "zh": "关闭"},
        "copy": {"ku": "کۆپیکردن", "en": "Copy", "ar": "نسخ", "zh": "复制"},
        "share": {"ku": "هاوبەشکردن", "en": "Share", "ar": "مشاركة", "zh": "分享"},
        
        # Filters
        "all": {"ku": "هەموو", "en": "All", "ar": "الكل", "zh": "全部"},
        "filterByStatus": {"ku": "فلتەر بە بارودۆخ", "en": "Filter by status", "ar": "تصفية حسب الحالة", "zh": "按状态筛选"},
        "filterByDate": {"ku": "فلتەر بە بەروار", "en": "Filter by date", "ar": "تصفية حسب التاريخ", "zh": "按日期筛选"},
        "filterByType": {"ku": "فلتەر بە جۆر", "en": "Filter by type", "ar": "تصفية حسب النوع", "zh": "按类型筛选"},
    }
}

def update_locale_files():
    """Update all locale files with portal translations"""
    for lang in ['en', 'ku', 'ar', 'zh']:
        file_path = LOCALES_DIR / f"{lang}.json"
        
        # Read existing
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Add portal section
        if 'portal' not in data:
            data['portal'] = {}
        
        for key, translations in PORTAL_TRANSLATIONS['portal'].items():
            data['portal'][key] = translations.get(lang, translations.get('ku', ''))
        
        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        
        print(f"Updated {lang}.json with portal translations")

if __name__ == "__main__":
    update_locale_files()
    print("\nDone!")
