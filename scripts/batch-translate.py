#!/usr/bin/env python3
"""
Batch translation script for Wazn Express.
This script processes all TSX files and replaces hardcoded Kurdish text with t() function calls.
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict

# Directory paths
PAGES_DIR = Path("/home/ubuntu/wazn-express/client/src/pages")
LOCALES_DIR = Path("/home/ubuntu/wazn-express/client/src/locales")

# Comprehensive translation mapping
TRANSLATIONS = {
    # ============ COMMON ============
    "تۆمارکردن": {"key": "common.save", "en": "Save", "ar": "حفظ", "zh": "保存"},
    "پاشەکەوتکردن": {"key": "common.save", "en": "Save", "ar": "حفظ", "zh": "保存"},
    "تۆمارکردن...": {"key": "common.saving", "en": "Saving...", "ar": "جاري الحفظ...", "zh": "保存中..."},
    "گۆڕانکاری": {"key": "common.edit", "en": "Edit", "ar": "تعديل", "zh": "编辑"},
    "دەستکاری": {"key": "common.edit", "en": "Edit", "ar": "تعديل", "zh": "编辑"},
    "سڕینەوە": {"key": "common.delete", "en": "Delete", "ar": "حذف", "zh": "删除"},
    "زیادکردن": {"key": "common.add", "en": "Add", "ar": "إضافة", "zh": "添加"},
    "دروستکردن": {"key": "common.create", "en": "Create", "ar": "إنشاء", "zh": "创建"},
    "نوێکردنەوە": {"key": "common.update", "en": "Update", "ar": "تحديث", "zh": "更新"},
    "گەڕان": {"key": "common.search", "en": "Search", "ar": "بحث", "zh": "搜索"},
    "فلتەر": {"key": "common.filter", "en": "Filter", "ar": "تصفية", "zh": "筛选"},
    "فلتەرەکان": {"key": "common.filters", "en": "Filters", "ar": "التصفيات", "zh": "筛选"},
    "هەناردەکردن": {"key": "common.export", "en": "Export", "ar": "تصدير", "zh": "导出"},
    "هاوردەکردن": {"key": "common.import", "en": "Import", "ar": "استيراد", "zh": "导入"},
    "داخستن": {"key": "common.close", "en": "Close", "ar": "إغلاق", "zh": "关闭"},
    "دڵنیاکردنەوە": {"key": "common.confirm", "en": "Confirm", "ar": "تأكيد", "zh": "确认"},
    "بەڵێ": {"key": "common.yes", "en": "Yes", "ar": "نعم", "zh": "是"},
    "نەخێر": {"key": "common.no", "en": "No", "ar": "لا", "zh": "否"},
    "هەموو": {"key": "common.all", "en": "All", "ar": "الكل", "zh": "全部"},
    "هیچ": {"key": "common.none", "en": "None", "ar": "لا شيء", "zh": "无"},
    "کردارەکان": {"key": "common.actions", "en": "Actions", "ar": "الإجراءات", "zh": "操作"},
    "بارودۆخ": {"key": "common.status", "en": "Status", "ar": "الحالة", "zh": "状态"},
    "بەروار": {"key": "common.date", "en": "Date", "ar": "التاريخ", "zh": "日期"},
    "کات": {"key": "common.time", "en": "Time", "ar": "الوقت", "zh": "时间"},
    "ناو": {"key": "common.name", "en": "Name", "ar": "الاسم", "zh": "名称"},
    "وەسف": {"key": "common.description", "en": "Description", "ar": "الوصف", "zh": "描述"},
    "تێبینی": {"key": "common.notes", "en": "Notes", "ar": "ملاحظات", "zh": "备注"},
    "تێبینییەکان": {"key": "common.notes", "en": "Notes", "ar": "ملاحظات", "zh": "备注"},
    "کۆ": {"key": "common.total", "en": "Total", "ar": "المجموع", "zh": "总计"},
    "بڕ": {"key": "common.amount", "en": "Amount", "ar": "المبلغ", "zh": "金额"},
    "نرخ": {"key": "common.price", "en": "Price", "ar": "السعر", "zh": "价格"},
    "ژمارە": {"key": "common.quantity", "en": "Quantity", "ar": "الكمية", "zh": "数量"},
    "کێش": {"key": "common.weight", "en": "Weight", "ar": "الوزن", "zh": "重量"},
    "قەبارە": {"key": "common.volume", "en": "Volume", "ar": "الحجم", "zh": "体积"},
    "سەرکەوتوو": {"key": "common.success", "en": "Success", "ar": "نجاح", "zh": "成功"},
    "هەڵە": {"key": "common.error", "en": "Error", "ar": "خطأ", "zh": "错误"},
    "ئاگاداری": {"key": "common.warning", "en": "Warning", "ar": "تحذير", "zh": "警告"},
    "زانیاری": {"key": "common.info", "en": "Info", "ar": "معلومات", "zh": "信息"},
    "داتا نییە": {"key": "common.noData", "en": "No data", "ar": "لا توجد بيانات", "zh": "无数据"},
    "ئەنجام نەدۆزرایەوە": {"key": "common.noResults", "en": "No results found", "ar": "لم يتم العثور على نتائج", "zh": "未找到结果"},
    "گەڕانەوە": {"key": "common.back", "en": "Back", "ar": "رجوع", "zh": "返回"},
    "دواتر": {"key": "common.next", "en": "Next", "ar": "التالي", "zh": "下一步"},
    "پێشتر": {"key": "common.previous", "en": "Previous", "ar": "السابق", "zh": "上一步"},
    "ناردن": {"key": "common.submit", "en": "Submit", "ar": "إرسال", "zh": "提交"},
    "ڕیسێتکردن": {"key": "common.reset", "en": "Reset", "ar": "إعادة تعيين", "zh": "重置"},
    "پاککردنەوە": {"key": "common.clear", "en": "Clear", "ar": "مسح", "zh": "清除"},
    "هەڵبژاردن": {"key": "common.select", "en": "Select", "ar": "اختيار", "zh": "选择"},
    "داگرتن": {"key": "common.download", "en": "Download", "ar": "تحميل", "zh": "下载"},
    "بارکردن": {"key": "common.upload", "en": "Upload", "ar": "رفع", "zh": "上传"},
    "چاپکردن": {"key": "common.print", "en": "Print", "ar": "طباعة", "zh": "打印"},
    "کۆپیکردن": {"key": "common.copy", "en": "Copy", "ar": "نسخ", "zh": "复制"},
    "بینین": {"key": "common.view", "en": "View", "ar": "عرض", "zh": "查看"},
    "وردەکاری": {"key": "common.details", "en": "Details", "ar": "التفاصيل", "zh": "详情"},
    "زیاتر": {"key": "common.more", "en": "More", "ar": "المزيد", "zh": "更多"},
    "کەمتر": {"key": "common.less", "en": "Less", "ar": "أقل", "zh": "更少"},
    "چالاک": {"key": "common.active", "en": "Active", "ar": "نشط", "zh": "活跃"},
    "ناچالاک": {"key": "common.inactive", "en": "Inactive", "ar": "غير نشط", "zh": "不活跃"},
    "پێویست": {"key": "common.required", "en": "Required", "ar": "مطلوب", "zh": "必填"},
    "ئارەزوومەندانە": {"key": "common.optional", "en": "Optional", "ar": "اختياري", "zh": "可选"},
    "نوێ": {"key": "common.new", "en": "New", "ar": "جديد", "zh": "新"},
    "کۆن": {"key": "common.old", "en": "Old", "ar": "قديم", "zh": "旧"},
    "لە": {"key": "common.from", "en": "From", "ar": "من", "zh": "从"},
    "بۆ": {"key": "common.to", "en": "To", "ar": "إلى", "zh": "到"},
    "ئەمڕۆ": {"key": "common.today", "en": "Today", "ar": "اليوم", "zh": "今天"},
    "دوێنێ": {"key": "common.yesterday", "en": "Yesterday", "ar": "أمس", "zh": "昨天"},
    "سبەینێ": {"key": "common.tomorrow", "en": "Tomorrow", "ar": "غداً", "zh": "明天"},
    "ئەم هەفتەیە": {"key": "common.thisWeek", "en": "This Week", "ar": "هذا الأسبوع", "zh": "本周"},
    "هەفتەی ڕابردوو": {"key": "common.lastWeek", "en": "Last Week", "ar": "الأسبوع الماضي", "zh": "上周"},
    "ئەم مانگە": {"key": "common.thisMonth", "en": "This Month", "ar": "هذا الشهر", "zh": "本月"},
    "مانگی ڕابردوو": {"key": "common.lastMonth", "en": "Last Month", "ar": "الشهر الماضي", "zh": "上个月"},
    "ئەم ساڵە": {"key": "common.thisYear", "en": "This Year", "ar": "هذا العام", "zh": "今年"},
    "ساڵی ڕابردوو": {"key": "common.lastYear", "en": "Last Year", "ar": "العام الماضي", "zh": "去年"},
    "چاوەڕوان بە...": {"key": "common.loading", "en": "Loading...", "ar": "جاري التحميل...", "zh": "加载中..."},
    "چاوەڕوانبە...": {"key": "common.loading", "en": "Loading...", "ar": "جاري التحميل...", "zh": "加载中..."},
    "بارکردن...": {"key": "common.loading", "en": "Loading...", "ar": "جاري التحميل...", "zh": "加载中..."},
    "پاشگەزبوونەوە": {"key": "common.cancel", "en": "Cancel", "ar": "إلغاء", "zh": "取消"},
    "هەڵوەشاندنەوە": {"key": "common.cancel", "en": "Cancel", "ar": "إلغاء", "zh": "取消"},
    "هەموو ببینە": {"key": "common.viewAll", "en": "View All", "ar": "عرض الكل", "zh": "查看全部"},
    "جۆر": {"key": "common.type", "en": "Type", "ar": "النوع", "zh": "类型"},
    "ڕۆژ": {"key": "common.days", "en": "Days", "ar": "أيام", "zh": "天"},
    "کاتژمێر": {"key": "common.hours", "en": "Hours", "ar": "ساعات", "zh": "小时"},
    "خولەک": {"key": "common.minutes", "en": "Minutes", "ar": "دقائق", "zh": "分钟"},
    "چرکە": {"key": "common.seconds", "en": "Seconds", "ar": "ثواني", "zh": "秒"},
    
    # ============ FINANCE ============
    "دارایی": {"key": "finance.title", "en": "Finance", "ar": "المالية", "zh": "财务"},
    "پارەدان": {"key": "finance.payments", "en": "Payments", "ar": "المدفوعات", "zh": "付款"},
    "پارەدانەکان": {"key": "finance.payments", "en": "Payments", "ar": "المدفوعات", "zh": "付款"},
    "تۆمارکردنی پارەدان": {"key": "finance.recordPayment", "en": "Record Payment", "ar": "تسجيل دفعة", "zh": "记录付款"},
    "قەرزداران": {"key": "finance.debtors", "en": "Debtors", "ar": "المدينون", "zh": "债务人"},
    "کۆی قەرز": {"key": "finance.totalDebt", "en": "Total Debt", "ar": "إجمالي الدين", "zh": "总债务"},
    "کۆی پارەدان": {"key": "finance.totalPayments", "en": "Total Payments", "ar": "إجمالي المدفوعات", "zh": "总付款"},
    "کۆی حسابەکان": {"key": "finance.totalAccounts", "en": "Total Accounts", "ar": "إجمالي الحسابات", "zh": "账户总数"},
    "حسابی چالاک": {"key": "finance.activeAccounts", "en": "Active Accounts", "ar": "الحسابات النشطة", "zh": "活跃账户"},
    "باڵانسی نێت": {"key": "finance.netBalance", "en": "Net Balance", "ar": "الرصيد الصافي", "zh": "净余额"},
    "پوختە": {"key": "finance.overview", "en": "Overview", "ar": "نظرة عامة", "zh": "概览"},
    "حسابەکان": {"key": "finance.accounts", "en": "Accounts", "ar": "الحسابات", "zh": "账户"},
    "حسابی کڕیاران": {"key": "finance.customerAccounts", "en": "Customer Accounts", "ar": "حسابات العملاء", "zh": "客户账户"},
    "هەموو حسابەکان": {"key": "finance.allAccounts", "en": "All Accounts", "ar": "جميع الحسابات", "zh": "所有账户"},
    "ژمارەی حساب": {"key": "finance.accountNumber", "en": "Account Number", "ar": "رقم الحساب", "zh": "账号"},
    "نەقد": {"key": "finance.cash", "en": "Cash", "ar": "نقداً", "zh": "现金"},
    "گواستنەوەی بانکی": {"key": "finance.bankTransfer", "en": "Bank Transfer", "ar": "تحويل بنكي", "zh": "银行转账"},
    "کارت": {"key": "finance.card", "en": "Card", "ar": "بطاقة", "zh": "卡"},
    "بانک": {"key": "finance.bank", "en": "Bank", "ar": "بنك", "zh": "银行"},
    "شێواز": {"key": "finance.method", "en": "Method", "ar": "الطريقة", "zh": "方式"},
    "ژمارەی سەندی": {"key": "finance.referenceNumber", "en": "Reference Number", "ar": "رقم المرجع", "zh": "参考编号"},
    "ژمارەی سەند": {"key": "finance.referenceNumber", "en": "Reference Number", "ar": "رقم المرجع", "zh": "参考编号"},
    "کۆی وەرگیراو": {"key": "finance.totalReceived", "en": "Total Received", "ar": "إجمالي المستلم", "zh": "总收款"},
    "داهات": {"key": "finance.income", "en": "Income", "ar": "الدخل", "zh": "收入"},
    "خەرجی": {"key": "finance.expense", "en": "Expense", "ar": "المصروف", "zh": "支出"},
    "قازانج": {"key": "finance.profit", "en": "Profit", "ar": "الربح", "zh": "利润"},
    "زەرەر": {"key": "finance.loss", "en": "Loss", "ar": "الخسارة", "zh": "亏损"},
    "باڵانس": {"key": "finance.balance", "en": "Balance", "ar": "الرصيد", "zh": "余额"},
    "قەرز": {"key": "finance.debt", "en": "Debt", "ar": "الدين", "zh": "债务"},
    "کرێدیت": {"key": "finance.credit", "en": "Credit", "ar": "الائتمان", "zh": "信用"},
    
    # ============ CUSTOMERS ============
    "کڕیارەکان": {"key": "customers.title", "en": "Customers", "ar": "العملاء", "zh": "客户"},
    "کڕیار": {"key": "customers.title", "en": "Customer", "ar": "العميل", "zh": "客户"},
    "زیادکردنی کڕیار": {"key": "customers.addCustomer", "en": "Add Customer", "ar": "إضافة عميل", "zh": "添加客户"},
    "دەستکاریکردنی کڕیار": {"key": "customers.editCustomer", "en": "Edit Customer", "ar": "تعديل العميل", "zh": "编辑客户"},
    "سڕینەوەی کڕیار": {"key": "customers.deleteCustomer", "en": "Delete Customer", "ar": "حذف العميل", "zh": "删除客户"},
    "ناوی کڕیار": {"key": "customers.customerName", "en": "Customer Name", "ar": "اسم العميل", "zh": "客户名称"},
    "کۆدی کڕیار": {"key": "customers.customerCode", "en": "Customer Code", "ar": "رمز العميل", "zh": "客户代码"},
    "ژمارەی تەلەفۆن": {"key": "customers.phone", "en": "Phone Number", "ar": "رقم الهاتف", "zh": "电话号码"},
    "ئیمەیڵ": {"key": "customers.email", "en": "Email", "ar": "البريد الإلكتروني", "zh": "邮箱"},
    "ناونیشان": {"key": "customers.address", "en": "Address", "ar": "العنوان", "zh": "地址"},
    "شار": {"key": "customers.city", "en": "City", "ar": "المدينة", "zh": "城市"},
    "وڵات": {"key": "customers.country", "en": "Country", "ar": "البلد", "zh": "国家"},
    "پارێزگا": {"key": "customers.governorate", "en": "Governorate", "ar": "المحافظة", "zh": "省份"},
    
    # ============ PACKAGES ============
    "پاکەتەکان": {"key": "packages.title", "en": "Packages", "ar": "الطرود", "zh": "包裹"},
    "پاکەت": {"key": "packages.title", "en": "Package", "ar": "الطرد", "zh": "包裹"},
    "تۆمارکردنی پاکەت": {"key": "packages.registerPackage", "en": "Register Package", "ar": "تسجيل طرد", "zh": "登记包裹"},
    "کۆدی پاکەت": {"key": "packages.packageCode", "en": "Package Code", "ar": "رمز الطرد", "zh": "包裹代码"},
    "ژمارەی تراکینگ": {"key": "packages.trackingNumber", "en": "Tracking Number", "ar": "رقم التتبع", "zh": "追踪号"},
    "کێشی ڕاستەقینە": {"key": "packages.actualWeight", "en": "Actual Weight", "ar": "الوزن الفعلي", "zh": "实际重量"},
    "کێشی قەبارەیی": {"key": "packages.volumetricWeight", "en": "Volumetric Weight", "ar": "الوزن الحجمي", "zh": "体积重量"},
    "تۆمارکراو": {"key": "packages.registered", "en": "Registered", "ar": "مسجل", "zh": "已登记"},
    "لە کۆگا": {"key": "packages.inWarehouse", "en": "In Warehouse", "ar": "في المستودع", "zh": "在仓库"},
    "لە باچ": {"key": "packages.inBatch", "en": "In Batch", "ar": "في الدفعة", "zh": "在批次中"},
    "لە ڕێگا": {"key": "packages.onRoute", "en": "On Route", "ar": "في الطريق", "zh": "运输中"},
    "گەیشتووە": {"key": "packages.arrived", "en": "Arrived", "ar": "وصل", "zh": "已到达"},
    "گەیاندرا": {"key": "packages.delivered", "en": "Delivered", "ar": "تم التسليم", "zh": "已送达"},
    "گەڕێندراوە": {"key": "packages.returned", "en": "Returned", "ar": "مرتجع", "zh": "已退回"},
    "ونبووە": {"key": "packages.lost", "en": "Lost", "ar": "مفقود", "zh": "丢失"},
    "زیانی پێگەیشتووە": {"key": "packages.damaged", "en": "Damaged", "ar": "تالف", "zh": "损坏"},
    "ئاسمانی ئاسایی": {"key": "packages.airRegular", "en": "Air Regular", "ar": "جوي عادي", "zh": "普通空运"},
    "ئاسمانی نائاسایی": {"key": "packages.airIrregular", "en": "Air Irregular", "ar": "جوي غير عادي", "zh": "特殊空运"},
    "دەریایی": {"key": "packages.sea", "en": "Sea", "ar": "بحري", "zh": "海运"},
    "جۆری گواستنەوە": {"key": "packages.shippingType", "en": "Shipping Type", "ar": "نوع الشحن", "zh": "运输类型"},
    
    # ============ BATCHES ============
    "باچەکان": {"key": "batches.title", "en": "Batches", "ar": "الدفعات", "zh": "批次"},
    "باچ": {"key": "batches.title", "en": "Batch", "ar": "الدفعة", "zh": "批次"},
    "باچی نوێ": {"key": "batches.newBatch", "en": "New Batch", "ar": "دفعة جديدة", "zh": "新批次"},
    "کۆدی باچ": {"key": "batches.batchCode", "en": "Batch Code", "ar": "رمز الدفعة", "zh": "批次代码"},
    "ناوی باچ": {"key": "batches.batchName", "en": "Batch Name", "ar": "اسم الدفعة", "zh": "批次名称"},
    "گواستنەوە": {"key": "batches.carrier", "en": "Carrier", "ar": "الناقل", "zh": "承运商"},
    "بەرواری ڕۆیشتن": {"key": "batches.departureDate", "en": "Departure Date", "ar": "تاريخ المغادرة", "zh": "出发日期"},
    "بەرواری گەیشتنی چاوەڕوانکراو": {"key": "batches.expectedArrival", "en": "Expected Arrival", "ar": "الوصول المتوقع", "zh": "预计到达"},
    "بەرواری گەیشتنی ڕاستەقینە": {"key": "batches.actualArrival", "en": "Actual Arrival", "ar": "الوصول الفعلي", "zh": "实际到达"},
    "ئامادەکردن": {"key": "batches.preparing", "en": "Preparing", "ar": "جاري التحضير", "zh": "准备中"},
    "ڕۆیشتووە": {"key": "batches.departed", "en": "Departed", "ar": "غادر", "zh": "已出发"},
    "لە گواستنەوە": {"key": "batches.inTransit", "en": "In Transit", "ar": "في الطريق", "zh": "运输中"},
    "تەواوبوو": {"key": "batches.completed", "en": "Completed", "ar": "مكتمل", "zh": "已完成"},
    "هەڵوەشێنراوە": {"key": "batches.cancelled", "en": "Cancelled", "ar": "ملغى", "zh": "已取消"},
    
    # ============ DASHBOARD ============
    "داشبۆرد": {"key": "dashboard.title", "en": "Dashboard", "ar": "لوحة التحكم", "zh": "仪表板"},
    "بەخێربێیت!": {"key": "dashboard.welcome", "en": "Welcome!", "ar": "مرحباً!", "zh": "欢迎！"},
    "ڕاپۆرتی ڕۆژانە": {"key": "dashboard.dailyReport", "en": "Daily Report", "ar": "التقرير اليومي", "zh": "每日报告"},
    "داهاتی ئەمڕۆ": {"key": "dashboard.todayIncome", "en": "Today's Income", "ar": "دخل اليوم", "zh": "今日收入"},
    "داهاتی هەفتانە": {"key": "dashboard.weeklyIncome", "en": "Weekly Income", "ar": "الدخل الأسبوعي", "zh": "周收入"},
    "داهاتی مانگانە": {"key": "dashboard.monthlyIncome", "en": "Monthly Income", "ar": "الدخل الشهري", "zh": "月收入"},
    "پاکەتەکانی ئەمڕۆ": {"key": "dashboard.todayPackages", "en": "Today's Packages", "ar": "طرود اليوم", "zh": "今日包裹"},
    "کڕیارە نوێیەکان": {"key": "dashboard.newCustomers", "en": "New Customers", "ar": "العملاء الجدد", "zh": "新客户"},
    "باچە چالاکەکان": {"key": "dashboard.activeBatches", "en": "Active Batches", "ar": "الدفعات النشطة", "zh": "活跃批次"},
    
    # ============ FULL PACKAGE ============
    "پاکەتی تەواو": {"key": "fullPackage.title", "en": "Full Package", "ar": "الطرد الكامل", "zh": "全包服务"},
    "داواکاری نوێ": {"key": "fullPackage.newOrder", "en": "New Order", "ar": "طلب جديد", "zh": "新订单"},
    "کۆدی داواکاری": {"key": "fullPackage.orderCode", "en": "Order Code", "ar": "رمز الطلب", "zh": "订单代码"},
    "ناوی بەرهەم": {"key": "fullPackage.productName", "en": "Product Name", "ar": "اسم المنتج", "zh": "产品名称"},
    "لینکی بەرهەم": {"key": "fullPackage.productLink", "en": "Product Link", "ar": "رابط المنتج", "zh": "产品链接"},
    "نرخی کڕین": {"key": "fullPackage.purchasePrice", "en": "Purchase Price", "ar": "سعر الشراء", "zh": "采购价"},
    "نرخی فرۆشتن": {"key": "fullPackage.sellingPrice", "en": "Selling Price", "ar": "سعر البيع", "zh": "售价"},
    "دابینکەر": {"key": "fullPackage.supplier", "en": "Supplier", "ar": "المورد", "zh": "供应商"},
    "دابینکەرەکان": {"key": "suppliers.title", "en": "Suppliers", "ar": "الموردون", "zh": "供应商"},
    
    # ============ SCANNING ============
    "سکان": {"key": "scanning.title", "en": "Scan", "ar": "مسح", "zh": "扫描"},
    "سکانکردن": {"key": "scanning.title", "en": "Scanning", "ar": "المسح", "zh": "扫描"},
    "سکانی پاکەت": {"key": "scanning.scanPackage", "en": "Scan Package", "ar": "مسح الطرد", "zh": "扫描包裹"},
    "سکانی بارکۆد": {"key": "scanning.scanBarcode", "en": "Scan Barcode", "ar": "مسح الباركود", "zh": "扫描条码"},
    "کامێرا": {"key": "scanning.camera", "en": "Camera", "ar": "الكاميرا", "zh": "相机"},
    "داخڵکردنی دەستی": {"key": "scanning.manualEntry", "en": "Manual Entry", "ar": "إدخال يدوي", "zh": "手动输入"},
    "سکانەکانی ئەمڕۆ": {"key": "scanning.todayScans", "en": "Today's Scans", "ar": "عمليات المسح اليوم", "zh": "今日扫描"},
    "کۆی سکانەکان": {"key": "scanning.totalScans", "en": "Total Scans", "ar": "إجمالي عمليات المسح", "zh": "总扫描数"},
    
    # ============ REPORTS ============
    "ڕاپۆرتەکان": {"key": "reports.title", "en": "Reports", "ar": "التقارير", "zh": "报告"},
    "ڕاپۆرت": {"key": "reports.title", "en": "Report", "ar": "التقرير", "zh": "报告"},
    "ڕاپۆرتی هەفتانە": {"key": "reports.weeklyReport", "en": "Weekly Report", "ar": "التقرير الأسبوعي", "zh": "周报"},
    "ڕاپۆرتی مانگانە": {"key": "reports.monthlyReport", "en": "Monthly Report", "ar": "التقرير الشهري", "zh": "月报"},
    "ڕاپۆرتی ساڵانە": {"key": "reports.yearlyReport", "en": "Yearly Report", "ar": "التقرير السنوي", "zh": "年报"},
    
    # ============ SETTINGS ============
    "ڕێکخستنەکان": {"key": "settings.title", "en": "Settings", "ar": "الإعدادات", "zh": "设置"},
    "ڕێکخستن": {"key": "settings.title", "en": "Settings", "ar": "الإعدادات", "zh": "设置"},
    "زمان": {"key": "settings.language", "en": "Language", "ar": "اللغة", "zh": "语言"},
    "ڕووکار": {"key": "settings.appearance", "en": "Appearance", "ar": "المظهر", "zh": "外观"},
    "تاریک": {"key": "settings.darkMode", "en": "Dark Mode", "ar": "الوضع المظلم", "zh": "深色模式"},
    "ڕووناک": {"key": "settings.lightMode", "en": "Light Mode", "ar": "الوضع الفاتح", "zh": "浅色模式"},
    "ئاگادارکردنەوەکان": {"key": "settings.notifications", "en": "Notifications", "ar": "الإشعارات", "zh": "通知"},
    "پڕۆفایل": {"key": "settings.profile", "en": "Profile", "ar": "الملف الشخصي", "zh": "个人资料"},
    "ئەمنیەت": {"key": "settings.security", "en": "Security", "ar": "الأمان", "zh": "安全"},
    "گۆڕینی وشەی نهێنی": {"key": "settings.changePassword", "en": "Change Password", "ar": "تغيير كلمة المرور", "zh": "修改密码"},
    
    # ============ COMPANY FINANCE ============
    "دارایی کۆمپانیا": {"key": "companyFinance.title", "en": "Company Finance", "ar": "مالية الشركة", "zh": "公司财务"},
    "قازانج و زەرەر": {"key": "companyFinance.profitLoss", "en": "Profit & Loss", "ar": "الأرباح والخسائر", "zh": "盈亏"},
    "جووڵەی پارە": {"key": "companyFinance.cashFlow", "en": "Cash Flow", "ar": "التدفق النقدي", "zh": "现金流"},
    "تەرازووی حساب": {"key": "companyFinance.balanceSheet", "en": "Balance Sheet", "ar": "الميزانية العمومية", "zh": "资产负债表"},
    "حسابە بانکییەکان": {"key": "companyFinance.bankAccounts", "en": "Bank Accounts", "ar": "الحسابات البنكية", "zh": "银行账户"},
    "خەرجییەکان": {"key": "companyFinance.expenses", "en": "Expenses", "ar": "المصروفات", "zh": "支出"},
    "هاوبەشەکان": {"key": "companyFinance.partners", "en": "Partners", "ar": "الشركاء", "zh": "合伙人"},
    "قەرزەکان": {"key": "companyFinance.debts", "en": "Debts", "ar": "الديون", "zh": "债务"},
    "خەزنە": {"key": "companyFinance.treasury", "en": "Treasury", "ar": "الخزينة", "zh": "财务"},
}

def process_file(file_path, dry_run=True):
    """Process a single TSX file and replace hardcoded text"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    replacements_made = []
    
    # Sort translations by length (longest first) to avoid partial matches
    sorted_translations = sorted(TRANSLATIONS.items(), key=lambda x: -len(x[0]))
    
    for kurdish_text, translation_data in sorted_translations:
        key = translation_data['key']
        
        # Pattern 1: JSX text content >Kurdish text<
        pattern1 = re.compile(r'(>)(' + re.escape(kurdish_text) + r')(<)', re.UNICODE)
        if pattern1.search(content):
            content = pattern1.sub(r'>{t("' + key + r'")}<', content)
            replacements_made.append((kurdish_text, key, 'jsx'))
        
        # Pattern 2: String in placeholder="Kurdish text"
        pattern2 = re.compile(r'placeholder="' + re.escape(kurdish_text) + r'"', re.UNICODE)
        if pattern2.search(content):
            content = pattern2.sub(r'placeholder={t("' + key + r'")}', content)
            replacements_made.append((kurdish_text, key, 'placeholder'))
        
        # Pattern 3: String in title="Kurdish text"
        pattern3 = re.compile(r'title="' + re.escape(kurdish_text) + r'"', re.UNICODE)
        if pattern3.search(content):
            content = pattern3.sub(r'title={t("' + key + r'")}', content)
            replacements_made.append((kurdish_text, key, 'title'))
    
    if not dry_run and content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return replacements_made, content != original_content

def update_translation_files():
    """Update all translation files with new keys"""
    languages = {
        'en': {},
        'ku': {},
        'ar': {},
        'zh': {}
    }
    
    # Build translation dictionaries
    for kurdish_text, data in TRANSLATIONS.items():
        key = data['key']
        parts = key.split('.')
        
        for lang in languages:
            if lang == 'ku':
                value = kurdish_text
            else:
                value = data.get(lang, kurdish_text)
            
            # Navigate/create nested structure
            current = languages[lang]
            for i, part in enumerate(parts[:-1]):
                if part not in current:
                    current[part] = {}
                current = current[part]
            current[parts[-1]] = value
    
    # Update each language file
    for lang, new_translations in languages.items():
        file_path = LOCALES_DIR / f"{lang}.json"
        
        # Read existing translations
        existing = {}
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        
        # Deep merge new translations
        def deep_merge(base, updates):
            for key, value in updates.items():
                if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                    deep_merge(base[key], value)
                elif key not in base:
                    base[key] = value
            return base
        
        merged = deep_merge(existing, new_translations)
        
        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(merged, f, ensure_ascii=False, indent=2)
            f.write('\n')
        
        print(f"Updated {lang}.json")

def main():
    """Main function"""
    print(f"\n{'='*60}")
    print("BATCH TRANSLATION PROCESSOR")
    print(f"{'='*60}\n")
    
    # First update translation files
    print("Updating translation files...")
    update_translation_files()
    
    # Process TSX files (dry run first)
    print("\nProcessing TSX files (dry run)...")
    total_replacements = 0
    files_modified = 0
    
    for tsx_file in sorted(PAGES_DIR.glob("*.tsx")):
        replacements, modified = process_file(tsx_file, dry_run=True)
        if replacements:
            total_replacements += len(replacements)
            files_modified += 1
            print(f"  {tsx_file.name}: {len(replacements)} replacements")
    
    print(f"\n{'='*60}")
    print(f"DRY RUN SUMMARY:")
    print(f"  Files to modify: {files_modified}")
    print(f"  Total replacements: {total_replacements}")
    print(f"{'='*60}\n")
    
    # Actually apply changes
    print("Applying changes...")
    for tsx_file in sorted(PAGES_DIR.glob("*.tsx")):
        replacements, modified = process_file(tsx_file, dry_run=False)
        if modified:
            print(f"  Modified: {tsx_file.name}")
    
    print("\nDone!")

if __name__ == "__main__":
    main()
