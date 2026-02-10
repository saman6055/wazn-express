#!/usr/bin/env python3
"""
Add all remaining translations for Full Package, Scanning, and other pages.
"""

import json
from pathlib import Path

LOCALES_DIR = Path("/home/ubuntu/wazn-express/client/src/locales")

# All remaining translations
REMAINING_TRANSLATIONS = {
    # Full Package
    "fullPackage": {
        "title": {"ku": "پاکەتی تەواو", "en": "Full Package", "ar": "الطرد الكامل", "zh": "全包服务"},
        "dashboard": {"ku": "داشبۆرد", "en": "Dashboard", "ar": "لوحة التحكم", "zh": "仪表板"},
        "orders": {"ku": "داواکاریەکان", "en": "Orders", "ar": "الطلبات", "zh": "订单"},
        "newOrder": {"ku": "داواکاری نوێ", "en": "New Order", "ar": "طلب جديد", "zh": "新订单"},
        "orderCode": {"ku": "کۆدی داواکاری", "en": "Order Code", "ar": "رمز الطلب", "zh": "订单代码"},
        "productName": {"ku": "ناوی بەرهەم", "en": "Product Name", "ar": "اسم المنتج", "zh": "产品名称"},
        "productLink": {"ku": "لینکی بەرهەم", "en": "Product Link", "ar": "رابط المنتج", "zh": "产品链接"},
        "productImage": {"ku": "وێنەی بەرهەم", "en": "Product Image", "ar": "صورة المنتج", "zh": "产品图片"},
        "purchasePrice": {"ku": "نرخی کڕین", "en": "Purchase Price", "ar": "سعر الشراء", "zh": "采购价"},
        "sellingPrice": {"ku": "نرخی فرۆشتن", "en": "Selling Price", "ar": "سعر البيع", "zh": "售价"},
        "profit": {"ku": "قازانج", "en": "Profit", "ar": "الربح", "zh": "利润"},
        "profitMargin": {"ku": "ڕێژەی قازانج", "en": "Profit Margin", "ar": "هامش الربح", "zh": "利润率"},
        "supplier": {"ku": "دابینکەر", "en": "Supplier", "ar": "المورد", "zh": "供应商"},
        "selectSupplier": {"ku": "دابینکەر هەڵبژێرە", "en": "Select Supplier", "ar": "اختر المورد", "zh": "选择供应商"},
        "customer": {"ku": "کڕیار", "en": "Customer", "ar": "العميل", "zh": "客户"},
        "selectCustomer": {"ku": "کڕیار هەڵبژێرە", "en": "Select Customer", "ar": "اختر العميل", "zh": "选择客户"},
        "quantity": {"ku": "ژمارە", "en": "Quantity", "ar": "الكمية", "zh": "数量"},
        "totalCost": {"ku": "کۆی تێچوو", "en": "Total Cost", "ar": "التكلفة الإجمالية", "zh": "总费用"},
        "totalRevenue": {"ku": "کۆی داهات", "en": "Total Revenue", "ar": "إجمالي الإيرادات", "zh": "总收入"},
        "orderStatus": {"ku": "بارودۆخی داواکاری", "en": "Order Status", "ar": "حالة الطلب", "zh": "订单状态"},
        "pending": {"ku": "چاوەڕوان", "en": "Pending", "ar": "قيد الانتظار", "zh": "待处理"},
        "confirmed": {"ku": "پشتڕاستکراوە", "en": "Confirmed", "ar": "مؤكد", "zh": "已确认"},
        "processing": {"ku": "لە کاردا", "en": "Processing", "ar": "قيد المعالجة", "zh": "处理中"},
        "purchased": {"ku": "کڕدرا", "en": "Purchased", "ar": "تم الشراء", "zh": "已购买"},
        "shipped": {"ku": "ناردرا", "en": "Shipped", "ar": "تم الشحن", "zh": "已发货"},
        "inWarehouse": {"ku": "لە کۆگا", "en": "In Warehouse", "ar": "في المستودع", "zh": "在仓库"},
        "delivered": {"ku": "گەیاندرا", "en": "Delivered", "ar": "تم التسليم", "zh": "已送达"},
        "cancelled": {"ku": "هەڵوەشێنرا", "en": "Cancelled", "ar": "ملغى", "zh": "已取消"},
        "returned": {"ku": "گەڕێنرایەوە", "en": "Returned", "ar": "مرتجع", "zh": "已退回"},
        "orderDetails": {"ku": "وردەکاری داواکاری", "en": "Order Details", "ar": "تفاصيل الطلب", "zh": "订单详情"},
        "orderHistory": {"ku": "مێژووی داواکاری", "en": "Order History", "ar": "سجل الطلبات", "zh": "订单历史"},
        "createOrder": {"ku": "دروستکردنی داواکاری", "en": "Create Order", "ar": "إنشاء طلب", "zh": "创建订单"},
        "editOrder": {"ku": "دەستکاری داواکاری", "en": "Edit Order", "ar": "تعديل الطلب", "zh": "编辑订单"},
        "deleteOrder": {"ku": "سڕینەوەی داواکاری", "en": "Delete Order", "ar": "حذف الطلب", "zh": "删除订单"},
        "cancelOrder": {"ku": "هەڵوەشاندنی داواکاری", "en": "Cancel Order", "ar": "إلغاء الطلب", "zh": "取消订单"},
        "confirmOrder": {"ku": "پشتڕاستکردنی داواکاری", "en": "Confirm Order", "ar": "تأكيد الطلب", "zh": "确认订单"},
        "markAsPurchased": {"ku": "نیشانکردن وەک کڕدراو", "en": "Mark as Purchased", "ar": "تحديد كمشترى", "zh": "标记为已购买"},
        "markAsShipped": {"ku": "نیشانکردن وەک ناردراو", "en": "Mark as Shipped", "ar": "تحديد كمشحون", "zh": "标记为已发货"},
        "markAsDelivered": {"ku": "نیشانکردن وەک گەیاندراو", "en": "Mark as Delivered", "ar": "تحديد كمسلم", "zh": "标记为已送达"},
        "searchOrders": {"ku": "گەڕان بە داواکاری", "en": "Search orders", "ar": "البحث عن طلبات", "zh": "搜索订单"},
        "noOrders": {"ku": "داواکاری نییە", "en": "No orders", "ar": "لا توجد طلبات", "zh": "没有订单"},
        "orderCreated": {"ku": "داواکاری دروستکرا", "en": "Order created", "ar": "تم إنشاء الطلب", "zh": "订单已创建"},
        "orderUpdated": {"ku": "داواکاری نوێکرایەوە", "en": "Order updated", "ar": "تم تحديث الطلب", "zh": "订单已更新"},
        "orderDeleted": {"ku": "داواکاری سڕایەوە", "en": "Order deleted", "ar": "تم حذف الطلب", "zh": "订单已删除"},
        "orderCancelled": {"ku": "داواکاری هەڵوەشێنرا", "en": "Order cancelled", "ar": "تم إلغاء الطلب", "zh": "订单已取消"},
        "notes": {"ku": "تێبینی", "en": "Notes", "ar": "ملاحظات", "zh": "备注"},
        "color": {"ku": "ڕەنگ", "en": "Color", "ar": "اللون", "zh": "颜色"},
        "size": {"ku": "قەبارە", "en": "Size", "ar": "الحجم", "zh": "尺寸"},
        "specifications": {"ku": "تایبەتمەندیەکان", "en": "Specifications", "ar": "المواصفات", "zh": "规格"},
        "shippingFee": {"ku": "کرێی گواستنەوە", "en": "Shipping Fee", "ar": "رسوم الشحن", "zh": "运费"},
        "serviceFee": {"ku": "کرێی خزمەتگوزاری", "en": "Service Fee", "ar": "رسوم الخدمة", "zh": "服务费"},
        "totalOrders": {"ku": "کۆی داواکاریەکان", "en": "Total Orders", "ar": "إجمالي الطلبات", "zh": "订单总数"},
        "pendingOrders": {"ku": "داواکاری چاوەڕوان", "en": "Pending Orders", "ar": "الطلبات المعلقة", "zh": "待处理订单"},
        "completedOrders": {"ku": "داواکاری تەواوبوو", "en": "Completed Orders", "ar": "الطلبات المكتملة", "zh": "已完成订单"},
        "totalProfit": {"ku": "کۆی قازانج", "en": "Total Profit", "ar": "إجمالي الربح", "zh": "总利润"},
        "reports": {"ku": "ڕاپۆرتەکان", "en": "Reports", "ar": "التقارير", "zh": "报告"},
    },
    
    # Scanning
    "scanning": {
        "title": {"ku": "سکان", "en": "Scan", "ar": "مسح", "zh": "扫描"},
        "scanPackage": {"ku": "سکانی پاکەت", "en": "Scan Package", "ar": "مسح الطرد", "zh": "扫描包裹"},
        "scanBarcode": {"ku": "سکانی بارکۆد", "en": "Scan Barcode", "ar": "مسح الباركود", "zh": "扫描条码"},
        "scanQrCode": {"ku": "سکانی کۆدی QR", "en": "Scan QR Code", "ar": "مسح رمز QR", "zh": "扫描二维码"},
        "camera": {"ku": "کامێرا", "en": "Camera", "ar": "الكاميرا", "zh": "相机"},
        "manualEntry": {"ku": "داخڵکردنی دەستی", "en": "Manual Entry", "ar": "إدخال يدوي", "zh": "手动输入"},
        "todayScans": {"ku": "سکانەکانی ئەمڕۆ", "en": "Today's Scans", "ar": "عمليات المسح اليوم", "zh": "今日扫描"},
        "totalScans": {"ku": "کۆی سکانەکان", "en": "Total Scans", "ar": "إجمالي عمليات المسح", "zh": "总扫描数"},
        "scanSuccess": {"ku": "سکان سەرکەوتوو", "en": "Scan successful", "ar": "تم المسح بنجاح", "zh": "扫描成功"},
        "scanFailed": {"ku": "سکان سەرکەوتوو نەبوو", "en": "Scan failed", "ar": "فشل المسح", "zh": "扫描失败"},
        "packageNotFound": {"ku": "پاکەت نەدۆزرایەوە", "en": "Package not found", "ar": "الطرد غير موجود", "zh": "未找到包裹"},
        "alreadyScanned": {"ku": "پێشتر سکانکراوە", "en": "Already scanned", "ar": "تم المسح مسبقاً", "zh": "已扫描"},
        "enterTrackingNumber": {"ku": "ژمارەی تراکینگ داخڵ بکە", "en": "Enter tracking number", "ar": "أدخل رقم التتبع", "zh": "输入追踪号"},
        "scanHistory": {"ku": "مێژووی سکان", "en": "Scan History", "ar": "سجل المسح", "zh": "扫描历史"},
        "lastScanned": {"ku": "دوایین سکان", "en": "Last Scanned", "ar": "آخر مسح", "zh": "最后扫描"},
        "scanMode": {"ku": "شێوازی سکان", "en": "Scan Mode", "ar": "وضع المسح", "zh": "扫描模式"},
        "continuousScan": {"ku": "سکانی بەردەوام", "en": "Continuous Scan", "ar": "المسح المستمر", "zh": "连续扫描"},
        "singleScan": {"ku": "سکانی تاک", "en": "Single Scan", "ar": "مسح فردي", "zh": "单次扫描"},
        "scanDashboard": {"ku": "داشبۆردی سکان", "en": "Scan Dashboard", "ar": "لوحة المسح", "zh": "扫描仪表板"},
        "scanReports": {"ku": "ڕاپۆرتی سکان", "en": "Scan Reports", "ar": "تقارير المسح", "zh": "扫描报告"},
        "smartScanner": {"ku": "سکانەری زیرەک", "en": "Smart Scanner", "ar": "الماسح الذكي", "zh": "智能扫描"},
        "mobileScanner": {"ku": "سکانەری مۆبایل", "en": "Mobile Scanner", "ar": "الماسح المحمول", "zh": "移动扫描"},
        "selectBatch": {"ku": "باچ هەڵبژێرە", "en": "Select Batch", "ar": "اختر الدفعة", "zh": "选择批次"},
        "selectStatus": {"ku": "بارودۆخ هەڵبژێرە", "en": "Select Status", "ar": "اختر الحالة", "zh": "选择状态"},
        "updateStatus": {"ku": "نوێکردنەوەی بارودۆخ", "en": "Update Status", "ar": "تحديث الحالة", "zh": "更新状态"},
        "addToBatch": {"ku": "زیادکردن بۆ باچ", "en": "Add to Batch", "ar": "إضافة للدفعة", "zh": "添加到批次"},
        "removeFromBatch": {"ku": "لابردن لە باچ", "en": "Remove from Batch", "ar": "إزالة من الدفعة", "zh": "从批次移除"},
        "scanAndAdd": {"ku": "سکان و زیادکردن", "en": "Scan & Add", "ar": "مسح وإضافة", "zh": "扫描并添加"},
        "scanAndUpdate": {"ku": "سکان و نوێکردنەوە", "en": "Scan & Update", "ar": "مسح وتحديث", "zh": "扫描并更新"},
        "packagesScanned": {"ku": "پاکەتی سکانکراو", "en": "Packages Scanned", "ar": "الطرود الممسوحة", "zh": "已扫描包裹"},
        "successRate": {"ku": "ڕێژەی سەرکەوتن", "en": "Success Rate", "ar": "معدل النجاح", "zh": "成功率"},
        "errorRate": {"ku": "ڕێژەی هەڵە", "en": "Error Rate", "ar": "معدل الخطأ", "zh": "错误率"},
        "scanSpeed": {"ku": "خێرایی سکان", "en": "Scan Speed", "ar": "سرعة المسح", "zh": "扫描速度"},
        "averageTime": {"ku": "کاتی ناوەند", "en": "Average Time", "ar": "متوسط الوقت", "zh": "平均时间"},
        "perMinute": {"ku": "لە خولەکێکدا", "en": "per minute", "ar": "في الدقيقة", "zh": "每分钟"},
        "perHour": {"ku": "لە کاتژمێرێکدا", "en": "per hour", "ar": "في الساعة", "zh": "每小时"},
    },
    
    # Suppliers
    "suppliers": {
        "title": {"ku": "دابینکەرەکان", "en": "Suppliers", "ar": "الموردون", "zh": "供应商"},
        "addSupplier": {"ku": "زیادکردنی دابینکەر", "en": "Add Supplier", "ar": "إضافة مورد", "zh": "添加供应商"},
        "editSupplier": {"ku": "دەستکاری دابینکەر", "en": "Edit Supplier", "ar": "تعديل المورد", "zh": "编辑供应商"},
        "deleteSupplier": {"ku": "سڕینەوەی دابینکەر", "en": "Delete Supplier", "ar": "حذف المورد", "zh": "删除供应商"},
        "supplierName": {"ku": "ناوی دابینکەر", "en": "Supplier Name", "ar": "اسم المورد", "zh": "供应商名称"},
        "supplierCode": {"ku": "کۆدی دابینکەر", "en": "Supplier Code", "ar": "رمز المورد", "zh": "供应商代码"},
        "contactPerson": {"ku": "کەسی پەیوەندی", "en": "Contact Person", "ar": "جهة الاتصال", "zh": "联系人"},
        "phone": {"ku": "تەلەفۆن", "en": "Phone", "ar": "الهاتف", "zh": "电话"},
        "email": {"ku": "ئیمەیڵ", "en": "Email", "ar": "البريد الإلكتروني", "zh": "邮箱"},
        "address": {"ku": "ناونیشان", "en": "Address", "ar": "العنوان", "zh": "地址"},
        "country": {"ku": "وڵات", "en": "Country", "ar": "البلد", "zh": "国家"},
        "city": {"ku": "شار", "en": "City", "ar": "المدينة", "zh": "城市"},
        "website": {"ku": "ماڵپەڕ", "en": "Website", "ar": "الموقع الإلكتروني", "zh": "网站"},
        "notes": {"ku": "تێبینی", "en": "Notes", "ar": "ملاحظات", "zh": "备注"},
        "active": {"ku": "چالاک", "en": "Active", "ar": "نشط", "zh": "活跃"},
        "inactive": {"ku": "ناچالاک", "en": "Inactive", "ar": "غير نشط", "zh": "不活跃"},
        "totalOrders": {"ku": "کۆی داواکاریەکان", "en": "Total Orders", "ar": "إجمالي الطلبات", "zh": "订单总数"},
        "totalSpent": {"ku": "کۆی خەرجکراو", "en": "Total Spent", "ar": "إجمالي الإنفاق", "zh": "总支出"},
        "lastOrder": {"ku": "دوایین داواکاری", "en": "Last Order", "ar": "آخر طلب", "zh": "最后订单"},
        "searchSuppliers": {"ku": "گەڕان بە دابینکەر", "en": "Search suppliers", "ar": "البحث عن موردين", "zh": "搜索供应商"},
        "noSuppliers": {"ku": "دابینکەر نییە", "en": "No suppliers", "ar": "لا يوجد موردون", "zh": "没有供应商"},
        "supplierCreated": {"ku": "دابینکەر دروستکرا", "en": "Supplier created", "ar": "تم إنشاء المورد", "zh": "供应商已创建"},
        "supplierUpdated": {"ku": "دابینکەر نوێکرایەوە", "en": "Supplier updated", "ar": "تم تحديث المورد", "zh": "供应商已更新"},
        "supplierDeleted": {"ku": "دابینکەر سڕایەوە", "en": "Supplier deleted", "ar": "تم حذف المورد", "zh": "供应商已删除"},
    },
    
    # Expenses
    "expenses": {
        "title": {"ku": "خەرجییەکان", "en": "Expenses", "ar": "المصروفات", "zh": "支出"},
        "addExpense": {"ku": "زیادکردنی خەرجی", "en": "Add Expense", "ar": "إضافة مصروف", "zh": "添加支出"},
        "editExpense": {"ku": "دەستکاری خەرجی", "en": "Edit Expense", "ar": "تعديل المصروف", "zh": "编辑支出"},
        "deleteExpense": {"ku": "سڕینەوەی خەرجی", "en": "Delete Expense", "ar": "حذف المصروف", "zh": "删除支出"},
        "expenseCategory": {"ku": "جۆری خەرجی", "en": "Expense Category", "ar": "فئة المصروف", "zh": "支出类别"},
        "amount": {"ku": "بڕ", "en": "Amount", "ar": "المبلغ", "zh": "金额"},
        "date": {"ku": "بەروار", "en": "Date", "ar": "التاريخ", "zh": "日期"},
        "description": {"ku": "وەسف", "en": "Description", "ar": "الوصف", "zh": "描述"},
        "receipt": {"ku": "وەسڵ", "en": "Receipt", "ar": "الإيصال", "zh": "收据"},
        "uploadReceipt": {"ku": "بارکردنی وەسڵ", "en": "Upload Receipt", "ar": "رفع الإيصال", "zh": "上传收据"},
        "totalExpenses": {"ku": "کۆی خەرجییەکان", "en": "Total Expenses", "ar": "إجمالي المصروفات", "zh": "总支出"},
        "monthlyExpenses": {"ku": "خەرجیی مانگانە", "en": "Monthly Expenses", "ar": "المصروفات الشهرية", "zh": "月支出"},
        "yearlyExpenses": {"ku": "خەرجیی ساڵانە", "en": "Yearly Expenses", "ar": "المصروفات السنوية", "zh": "年支出"},
        "expenseReport": {"ku": "ڕاپۆرتی خەرجی", "en": "Expense Report", "ar": "تقرير المصروفات", "zh": "支出报告"},
        "searchExpenses": {"ku": "گەڕان بە خەرجی", "en": "Search expenses", "ar": "البحث عن مصروفات", "zh": "搜索支出"},
        "noExpenses": {"ku": "خەرجی نییە", "en": "No expenses", "ar": "لا توجد مصروفات", "zh": "没有支出"},
        "expenseCreated": {"ku": "خەرجی تۆمارکرا", "en": "Expense recorded", "ar": "تم تسجيل المصروف", "zh": "支出已记录"},
        "expenseUpdated": {"ku": "خەرجی نوێکرایەوە", "en": "Expense updated", "ar": "تم تحديث المصروف", "zh": "支出已更新"},
        "expenseDeleted": {"ku": "خەرجی سڕایەوە", "en": "Expense deleted", "ar": "تم حذف المصروف", "zh": "支出已删除"},
        # Categories
        "rent": {"ku": "کرێ", "en": "Rent", "ar": "الإيجار", "zh": "租金"},
        "utilities": {"ku": "خزمەتگوزاریەکان", "en": "Utilities", "ar": "المرافق", "zh": "公用事业"},
        "salaries": {"ku": "مووچەکان", "en": "Salaries", "ar": "الرواتب", "zh": "工资"},
        "supplies": {"ku": "کەلوپەلەکان", "en": "Supplies", "ar": "المستلزمات", "zh": "用品"},
        "transportation": {"ku": "گواستنەوە", "en": "Transportation", "ar": "النقل", "zh": "交通"},
        "marketing": {"ku": "مارکێتینگ", "en": "Marketing", "ar": "التسويق", "zh": "营销"},
        "maintenance": {"ku": "چاککردنەوە", "en": "Maintenance", "ar": "الصيانة", "zh": "维护"},
        "insurance": {"ku": "بیمە", "en": "Insurance", "ar": "التأمين", "zh": "保险"},
        "taxes": {"ku": "باج", "en": "Taxes", "ar": "الضرائب", "zh": "税"},
        "other": {"ku": "تر", "en": "Other", "ar": "أخرى", "zh": "其他"},
    },
    
    # Partners
    "partners": {
        "title": {"ku": "هاوبەشەکان", "en": "Partners", "ar": "الشركاء", "zh": "合伙人"},
        "addPartner": {"ku": "زیادکردنی هاوبەش", "en": "Add Partner", "ar": "إضافة شريك", "zh": "添加合伙人"},
        "editPartner": {"ku": "دەستکاری هاوبەش", "en": "Edit Partner", "ar": "تعديل الشريك", "zh": "编辑合伙人"},
        "deletePartner": {"ku": "سڕینەوەی هاوبەش", "en": "Delete Partner", "ar": "حذف الشريك", "zh": "删除合伙人"},
        "partnerName": {"ku": "ناوی هاوبەش", "en": "Partner Name", "ar": "اسم الشريك", "zh": "合伙人名称"},
        "sharePercentage": {"ku": "ڕێژەی پشک", "en": "Share Percentage", "ar": "نسبة الحصة", "zh": "股份比例"},
        "investmentAmount": {"ku": "بڕی وەبەرهێنان", "en": "Investment Amount", "ar": "مبلغ الاستثمار", "zh": "投资金额"},
        "profitShare": {"ku": "پشکی قازانج", "en": "Profit Share", "ar": "حصة الربح", "zh": "利润份额"},
        "joinDate": {"ku": "بەرواری پەیوەستبوون", "en": "Join Date", "ar": "تاريخ الانضمام", "zh": "加入日期"},
        "searchPartners": {"ku": "گەڕان بە هاوبەش", "en": "Search partners", "ar": "البحث عن شركاء", "zh": "搜索合伙人"},
        "noPartners": {"ku": "هاوبەش نییە", "en": "No partners", "ar": "لا يوجد شركاء", "zh": "没有合伙人"},
        "partnerCreated": {"ku": "هاوبەش زیادکرا", "en": "Partner added", "ar": "تم إضافة الشريك", "zh": "合伙人已添加"},
        "partnerUpdated": {"ku": "هاوبەش نوێکرایەوە", "en": "Partner updated", "ar": "تم تحديث الشريك", "zh": "合伙人已更新"},
        "partnerDeleted": {"ku": "هاوبەش سڕایەوە", "en": "Partner deleted", "ar": "تم حذف الشريك", "zh": "合伙人已删除"},
    },
    
    # Treasury
    "treasury": {
        "title": {"ku": "خەزنە", "en": "Treasury", "ar": "الخزينة", "zh": "财务"},
        "cashBalance": {"ku": "باڵانسی نەقد", "en": "Cash Balance", "ar": "الرصيد النقدي", "zh": "现金余额"},
        "bankBalance": {"ku": "باڵانسی بانک", "en": "Bank Balance", "ar": "الرصيد البنكي", "zh": "银行余额"},
        "totalBalance": {"ku": "کۆی باڵانس", "en": "Total Balance", "ar": "إجمالي الرصيد", "zh": "总余额"},
        "deposit": {"ku": "دانان", "en": "Deposit", "ar": "إيداع", "zh": "存款"},
        "withdraw": {"ku": "دەرهێنان", "en": "Withdraw", "ar": "سحب", "zh": "取款"},
        "transfer": {"ku": "گواستنەوە", "en": "Transfer", "ar": "تحويل", "zh": "转账"},
        "transactions": {"ku": "مامەڵەکان", "en": "Transactions", "ar": "المعاملات", "zh": "交易"},
        "recentTransactions": {"ku": "مامەڵە تازەکان", "en": "Recent Transactions", "ar": "المعاملات الأخيرة", "zh": "最近交易"},
        "transactionHistory": {"ku": "مێژووی مامەڵەکان", "en": "Transaction History", "ar": "سجل المعاملات", "zh": "交易历史"},
        "noTransactions": {"ku": "مامەڵە نییە", "en": "No transactions", "ar": "لا توجد معاملات", "zh": "没有交易"},
    },
    
    # Labels
    "labels": {
        "title": {"ku": "لەیبڵەکان", "en": "Labels", "ar": "الملصقات", "zh": "标签"},
        "printLabel": {"ku": "چاپکردنی لەیبڵ", "en": "Print Label", "ar": "طباعة الملصق", "zh": "打印标签"},
        "labelTemplate": {"ku": "قاڵبی لەیبڵ", "en": "Label Template", "ar": "قالب الملصق", "zh": "标签模板"},
        "labelSize": {"ku": "قەبارەی لەیبڵ", "en": "Label Size", "ar": "حجم الملصق", "zh": "标签尺寸"},
        "printAll": {"ku": "چاپکردنی هەموو", "en": "Print All", "ar": "طباعة الكل", "zh": "打印全部"},
        "printSelected": {"ku": "چاپکردنی هەڵبژێردراوەکان", "en": "Print Selected", "ar": "طباعة المحدد", "zh": "打印选中"},
        "qrCode": {"ku": "کۆدی QR", "en": "QR Code", "ar": "رمز QR", "zh": "二维码"},
        "barcode": {"ku": "بارکۆد", "en": "Barcode", "ar": "الباركود", "zh": "条形码"},
        "includeQr": {"ku": "لەگەڵ QR", "en": "Include QR", "ar": "تضمين QR", "zh": "包含二维码"},
        "includeBarcode": {"ku": "لەگەڵ بارکۆد", "en": "Include Barcode", "ar": "تضمين الباركود", "zh": "包含条形码"},
        "labelSettings": {"ku": "ڕێکخستنی لەیبڵ", "en": "Label Settings", "ar": "إعدادات الملصق", "zh": "标签设置"},
        "previewLabel": {"ku": "پێشبینینی لەیبڵ", "en": "Preview Label", "ar": "معاينة الملصق", "zh": "预览标签"},
    },
    
    # Invoices
    "invoices": {
        "title": {"ku": "پسوڵەکان", "en": "Invoices", "ar": "الفواتير", "zh": "发票"},
        "createInvoice": {"ku": "دروستکردنی پسوڵە", "en": "Create Invoice", "ar": "إنشاء فاتورة", "zh": "创建发票"},
        "invoiceNumber": {"ku": "ژمارەی پسوڵە", "en": "Invoice Number", "ar": "رقم الفاتورة", "zh": "发票号"},
        "invoiceDate": {"ku": "بەرواری پسوڵە", "en": "Invoice Date", "ar": "تاريخ الفاتورة", "zh": "发票日期"},
        "dueDate": {"ku": "بەرواری سەردەم", "en": "Due Date", "ar": "تاريخ الاستحقاق", "zh": "到期日"},
        "subtotal": {"ku": "کۆی لاوەکی", "en": "Subtotal", "ar": "المجموع الفرعي", "zh": "小计"},
        "tax": {"ku": "باج", "en": "Tax", "ar": "الضريبة", "zh": "税"},
        "discount": {"ku": "داشکاندن", "en": "Discount", "ar": "الخصم", "zh": "折扣"},
        "grandTotal": {"ku": "کۆی گشتی", "en": "Grand Total", "ar": "المجموع الكلي", "zh": "总计"},
        "paid": {"ku": "پارەدراو", "en": "Paid", "ar": "مدفوع", "zh": "已付"},
        "unpaid": {"ku": "پارەنەدراو", "en": "Unpaid", "ar": "غير مدفوع", "zh": "未付"},
        "partiallyPaid": {"ku": "بەشێکی پارەدراو", "en": "Partially Paid", "ar": "مدفوع جزئياً", "zh": "部分付款"},
        "overdue": {"ku": "دواکەوتوو", "en": "Overdue", "ar": "متأخر", "zh": "逾期"},
        "printInvoice": {"ku": "چاپکردنی پسوڵە", "en": "Print Invoice", "ar": "طباعة الفاتورة", "zh": "打印发票"},
        "downloadInvoice": {"ku": "داگرتنی پسوڵە", "en": "Download Invoice", "ar": "تحميل الفاتورة", "zh": "下载发票"},
        "sendInvoice": {"ku": "ناردنی پسوڵە", "en": "Send Invoice", "ar": "إرسال الفاتورة", "zh": "发送发票"},
        "invoiceTemplate": {"ku": "قاڵبی پسوڵە", "en": "Invoice Template", "ar": "قالب الفاتورة", "zh": "发票模板"},
        "invoiceSettings": {"ku": "ڕێکخستنی پسوڵە", "en": "Invoice Settings", "ar": "إعدادات الفاتورة", "zh": "发票设置"},
    },
    
    # Blog Management
    "blog": {
        "title": {"ku": "بەڕێوەبردنی بڵۆگ", "en": "Blog Management", "ar": "إدارة المدونة", "zh": "博客管理"},
        "posts": {"ku": "بڵاوکراوەکان", "en": "Posts", "ar": "المنشورات", "zh": "文章"},
        "newPost": {"ku": "بڵاوکراوەی نوێ", "en": "New Post", "ar": "منشور جديد", "zh": "新文章"},
        "editPost": {"ku": "دەستکاری بڵاوکراوە", "en": "Edit Post", "ar": "تعديل المنشور", "zh": "编辑文章"},
        "deletePost": {"ku": "سڕینەوەی بڵاوکراوە", "en": "Delete Post", "ar": "حذف المنشور", "zh": "删除文章"},
        "postTitle": {"ku": "ناونیشانی بڵاوکراوە", "en": "Post Title", "ar": "عنوان المنشور", "zh": "文章标题"},
        "postContent": {"ku": "ناوەڕۆکی بڵاوکراوە", "en": "Post Content", "ar": "محتوى المنشور", "zh": "文章内容"},
        "category": {"ku": "پۆل", "en": "Category", "ar": "الفئة", "zh": "分类"},
        "tags": {"ku": "تاگەکان", "en": "Tags", "ar": "الوسوم", "zh": "标签"},
        "published": {"ku": "بڵاوکراوەتەوە", "en": "Published", "ar": "منشور", "zh": "已发布"},
        "draft": {"ku": "ڕەشنووس", "en": "Draft", "ar": "مسودة", "zh": "草稿"},
        "publish": {"ku": "بڵاوکردنەوە", "en": "Publish", "ar": "نشر", "zh": "发布"},
        "unpublish": {"ku": "لابردنی بڵاوکردنەوە", "en": "Unpublish", "ar": "إلغاء النشر", "zh": "取消发布"},
        "featuredImage": {"ku": "وێنەی سەرەکی", "en": "Featured Image", "ar": "الصورة المميزة", "zh": "特色图片"},
        "searchPosts": {"ku": "گەڕان بە بڵاوکراوە", "en": "Search posts", "ar": "البحث عن منشورات", "zh": "搜索文章"},
        "noPosts": {"ku": "بڵاوکراوە نییە", "en": "No posts", "ar": "لا توجد منشورات", "zh": "没有文章"},
    },
    
    # Data Management
    "dataManagement": {
        "title": {"ku": "بەڕێوەبردنی داتا", "en": "Data Management", "ar": "إدارة البيانات", "zh": "数据管理"},
        "backup": {"ku": "پاشەکەوت", "en": "Backup", "ar": "نسخ احتياطي", "zh": "备份"},
        "restore": {"ku": "گەڕاندنەوە", "en": "Restore", "ar": "استعادة", "zh": "恢复"},
        "export": {"ku": "هەناردەکردن", "en": "Export", "ar": "تصدير", "zh": "导出"},
        "import": {"ku": "هاوردەکردن", "en": "Import", "ar": "استيراد", "zh": "导入"},
        "lastBackup": {"ku": "دوایین پاشەکەوت", "en": "Last Backup", "ar": "آخر نسخة احتياطية", "zh": "最后备份"},
        "createBackup": {"ku": "دروستکردنی پاشەکەوت", "en": "Create Backup", "ar": "إنشاء نسخة احتياطية", "zh": "创建备份"},
        "downloadBackup": {"ku": "داگرتنی پاشەکەوت", "en": "Download Backup", "ar": "تحميل النسخة الاحتياطية", "zh": "下载备份"},
        "uploadBackup": {"ku": "بارکردنی پاشەکەوت", "en": "Upload Backup", "ar": "رفع النسخة الاحتياطية", "zh": "上传备份"},
    },
    
    # Service Types
    "serviceTypes": {
        "title": {"ku": "جۆرەکانی خزمەتگوزاری", "en": "Service Types", "ar": "أنواع الخدمات", "zh": "服务类型"},
        "addServiceType": {"ku": "زیادکردنی جۆری خزمەتگوزاری", "en": "Add Service Type", "ar": "إضافة نوع خدمة", "zh": "添加服务类型"},
        "editServiceType": {"ku": "دەستکاری جۆری خزمەتگوزاری", "en": "Edit Service Type", "ar": "تعديل نوع الخدمة", "zh": "编辑服务类型"},
        "deleteServiceType": {"ku": "سڕینەوەی جۆری خزمەتگوزاری", "en": "Delete Service Type", "ar": "حذف نوع الخدمة", "zh": "删除服务类型"},
        "serviceName": {"ku": "ناوی خزمەتگوزاری", "en": "Service Name", "ar": "اسم الخدمة", "zh": "服务名称"},
        "serviceCode": {"ku": "کۆدی خزمەتگوزاری", "en": "Service Code", "ar": "رمز الخدمة", "zh": "服务代码"},
        "pricePerKg": {"ku": "نرخی هەر کیلۆیەک", "en": "Price per KG", "ar": "السعر لكل كغ", "zh": "每公斤价格"},
        "pricePerCbm": {"ku": "نرخی هەر CBM", "en": "Price per CBM", "ar": "السعر لكل متر مكعب", "zh": "每立方米价格"},
        "minimumCharge": {"ku": "کەمترین نرخ", "en": "Minimum Charge", "ar": "الحد الأدنى للرسوم", "zh": "最低收费"},
        "deliveryTime": {"ku": "کاتی گەیاندن", "en": "Delivery Time", "ar": "وقت التسليم", "zh": "送达时间"},
        "searchServiceTypes": {"ku": "گەڕان بە جۆری خزمەتگوزاری", "en": "Search service types", "ar": "البحث عن أنواع الخدمات", "zh": "搜索服务类型"},
        "noServiceTypes": {"ku": "جۆری خزمەتگوزاری نییە", "en": "No service types", "ar": "لا توجد أنواع خدمات", "zh": "没有服务类型"},
    },
    
    # Warehouse Operations
    "warehouse": {
        "title": {"ku": "کارەکانی کۆگا", "en": "Warehouse Operations", "ar": "عمليات المستودع", "zh": "仓库操作"},
        "inbound": {"ku": "هاتوو", "en": "Inbound", "ar": "الوارد", "zh": "入库"},
        "outbound": {"ku": "چوو", "en": "Outbound", "ar": "الصادر", "zh": "出库"},
        "inventory": {"ku": "ئەمبار", "en": "Inventory", "ar": "المخزون", "zh": "库存"},
        "stockLevel": {"ku": "ئاستی ئەمبار", "en": "Stock Level", "ar": "مستوى المخزون", "zh": "库存水平"},
        "location": {"ku": "شوێن", "en": "Location", "ar": "الموقع", "zh": "位置"},
        "shelf": {"ku": "ڕەف", "en": "Shelf", "ar": "الرف", "zh": "货架"},
        "bin": {"ku": "سندوق", "en": "Bin", "ar": "الصندوق", "zh": "箱"},
        "receivePackage": {"ku": "وەرگرتنی پاکەت", "en": "Receive Package", "ar": "استلام الطرد", "zh": "接收包裹"},
        "dispatchPackage": {"ku": "ناردنی پاکەت", "en": "Dispatch Package", "ar": "إرسال الطرد", "zh": "发送包裹"},
        "warehouseReport": {"ku": "ڕاپۆرتی کۆگا", "en": "Warehouse Report", "ar": "تقرير المستودع", "zh": "仓库报告"},
    },
    
    # Financial Reports
    "financialReports": {
        "title": {"ku": "ڕاپۆرتەکانی دارایی", "en": "Financial Reports", "ar": "التقارير المالية", "zh": "财务报告"},
        "profitLoss": {"ku": "قازانج و زەرەر", "en": "Profit & Loss", "ar": "الأرباح والخسائر", "zh": "盈亏"},
        "cashFlow": {"ku": "جووڵەی پارە", "en": "Cash Flow", "ar": "التدفق النقدي", "zh": "现金流"},
        "balanceSheet": {"ku": "تەرازووی حساب", "en": "Balance Sheet", "ar": "الميزانية العمومية", "zh": "资产负债表"},
        "debtorsReport": {"ku": "ڕاپۆرتی قەرزداران", "en": "Debtors Report", "ar": "تقرير المدينين", "zh": "债务人报告"},
        "serviceProfitReport": {"ku": "ڕاپۆرتی قازانجی خزمەتگوزاری", "en": "Service Profit Report", "ar": "تقرير أرباح الخدمات", "zh": "服务利润报告"},
        "customerPricingReport": {"ku": "ڕاپۆرتی نرخی کڕیاران", "en": "Customer Pricing Report", "ar": "تقرير أسعار العملاء", "zh": "客户定价报告"},
        "revenue": {"ku": "داهات", "en": "Revenue", "ar": "الإيرادات", "zh": "收入"},
        "expenses": {"ku": "خەرجییەکان", "en": "Expenses", "ar": "المصروفات", "zh": "支出"},
        "grossProfit": {"ku": "قازانجی کۆ", "en": "Gross Profit", "ar": "الربح الإجمالي", "zh": "毛利润"},
        "netProfit": {"ku": "قازانجی نێت", "en": "Net Profit", "ar": "صافي الربح", "zh": "净利润"},
        "assets": {"ku": "سامانەکان", "en": "Assets", "ar": "الأصول", "zh": "资产"},
        "liabilities": {"ku": "ئەرکەکان", "en": "Liabilities", "ar": "الالتزامات", "zh": "负债"},
        "equity": {"ku": "سەرمایە", "en": "Equity", "ar": "حقوق الملكية", "zh": "权益"},
    },
    
    # Tracking Alerts
    "trackingAlerts": {
        "title": {"ku": "ئاگادارکردنەوەکانی شوێنکەوتن", "en": "Tracking Alerts", "ar": "تنبيهات التتبع", "zh": "追踪提醒"},
        "addAlert": {"ku": "زیادکردنی ئاگادارکردنەوە", "en": "Add Alert", "ar": "إضافة تنبيه", "zh": "添加提醒"},
        "editAlert": {"ku": "دەستکاری ئاگادارکردنەوە", "en": "Edit Alert", "ar": "تعديل التنبيه", "zh": "编辑提醒"},
        "deleteAlert": {"ku": "سڕینەوەی ئاگادارکردنەوە", "en": "Delete Alert", "ar": "حذف التنبيه", "zh": "删除提醒"},
        "alertType": {"ku": "جۆری ئاگادارکردنەوە", "en": "Alert Type", "ar": "نوع التنبيه", "zh": "提醒类型"},
        "condition": {"ku": "مەرج", "en": "Condition", "ar": "الشرط", "zh": "条件"},
        "notification": {"ku": "ئاگادارکردنەوە", "en": "Notification", "ar": "الإشعار", "zh": "通知"},
        "email": {"ku": "ئیمەیڵ", "en": "Email", "ar": "البريد الإلكتروني", "zh": "邮箱"},
        "sms": {"ku": "SMS", "en": "SMS", "ar": "رسالة نصية", "zh": "短信"},
        "active": {"ku": "چالاک", "en": "Active", "ar": "نشط", "zh": "活跃"},
        "inactive": {"ku": "ناچالاک", "en": "Inactive", "ar": "غير نشط", "zh": "不活跃"},
    },
    
    # Financial Goals
    "financialGoals": {
        "title": {"ku": "ئامانجە داراییەکان", "en": "Financial Goals", "ar": "الأهداف المالية", "zh": "财务目标"},
        "addGoal": {"ku": "زیادکردنی ئامانج", "en": "Add Goal", "ar": "إضافة هدف", "zh": "添加目标"},
        "editGoal": {"ku": "دەستکاری ئامانج", "en": "Edit Goal", "ar": "تعديل الهدف", "zh": "编辑目标"},
        "deleteGoal": {"ku": "سڕینەوەی ئامانج", "en": "Delete Goal", "ar": "حذف الهدف", "zh": "删除目标"},
        "goalName": {"ku": "ناوی ئامانج", "en": "Goal Name", "ar": "اسم الهدف", "zh": "目标名称"},
        "targetAmount": {"ku": "بڕی ئامانج", "en": "Target Amount", "ar": "المبلغ المستهدف", "zh": "目标金额"},
        "currentAmount": {"ku": "بڕی ئێستا", "en": "Current Amount", "ar": "المبلغ الحالي", "zh": "当前金额"},
        "progress": {"ku": "پێشکەوتن", "en": "Progress", "ar": "التقدم", "zh": "进度"},
        "deadline": {"ku": "دوا وادە", "en": "Deadline", "ar": "الموعد النهائي", "zh": "截止日期"},
        "achieved": {"ku": "گەیشتووە", "en": "Achieved", "ar": "تم تحقيقه", "zh": "已达成"},
        "inProgress": {"ku": "لە کاردا", "en": "In Progress", "ar": "قيد التنفيذ", "zh": "进行中"},
        "notStarted": {"ku": "دەستپێنەکراوە", "en": "Not Started", "ar": "لم يبدأ", "zh": "未开始"},
    },
    
    # Debt Reminders
    "debtReminders": {
        "title": {"ku": "ئاگادارکردنەوەکانی قەرز", "en": "Debt Reminders", "ar": "تذكيرات الديون", "zh": "债务提醒"},
        "sendReminder": {"ku": "ناردنی ئاگادارکردنەوە", "en": "Send Reminder", "ar": "إرسال تذكير", "zh": "发送提醒"},
        "reminderSent": {"ku": "ئاگادارکردنەوە ناردرا", "en": "Reminder sent", "ar": "تم إرسال التذكير", "zh": "提醒已发送"},
        "lastReminder": {"ku": "دوایین ئاگادارکردنەوە", "en": "Last Reminder", "ar": "آخر تذكير", "zh": "最后提醒"},
        "daysOverdue": {"ku": "ڕۆژی دواکەوتوو", "en": "Days Overdue", "ar": "أيام التأخير", "zh": "逾期天数"},
        "totalDebt": {"ku": "کۆی قەرز", "en": "Total Debt", "ar": "إجمالي الدين", "zh": "总债务"},
    },
}

def update_locale_files():
    """Update all locale files with remaining translations"""
    for lang in ['en', 'ku', 'ar', 'zh']:
        file_path = LOCALES_DIR / f"{lang}.json"
        
        # Read existing
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Add all sections
        for section, translations in REMAINING_TRANSLATIONS.items():
            if section not in data:
                data[section] = {}
            
            for key, values in translations.items():
                if key not in data[section]:
                    data[section][key] = values.get(lang, values.get('ku', ''))
        
        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        
        print(f"Updated {lang}.json")

if __name__ == "__main__":
    print("Adding remaining translations...")
    update_locale_files()
    print("\nDone!")
