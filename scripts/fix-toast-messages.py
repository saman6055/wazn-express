#!/usr/bin/env python3
"""
Fix hardcoded toast messages and common patterns in TSX files.
"""

import re
from pathlib import Path

PAGES_DIR = Path("/home/ubuntu/wazn-express/client/src/pages")

# Toast message translations
TOAST_TRANSLATIONS = {
    # Success messages
    "ڕاپۆرتی کڕیار دابەزێندرا": "messages.customerReportDownloaded",
    "بەڵگەنامە ئەپڵۆدکرا": "messages.documentUploaded",
    "بەڵگەنامە سڕایەوە": "messages.documentDeleted",
    "زانیاری کڕیار نوێکرایەوە": "messages.customerInfoUpdated",
    "کڕیار دروستکرا": "messages.customerCreated",
    "کڕیار نوێکرایەوە": "messages.customerUpdated",
    "کڕیار سڕایەوە": "messages.customerDeleted",
    "پاکەت تۆمارکرا": "messages.packageRegistered",
    "پاکەت نوێکرایەوە": "messages.packageUpdated",
    "پاکەت سڕایەوە": "messages.packageDeleted",
    "باچ دروستکرا": "messages.batchCreated",
    "باچ نوێکرایەوە": "messages.batchUpdated",
    "باچ سڕایەوە": "messages.batchDeleted",
    "پارەدان تۆمارکرا": "messages.paymentRecorded",
    "بە سەرکەوتوویی تۆمارکرا": "messages.savedSuccessfully",
    "بە سەرکەوتوویی نوێکرایەوە": "messages.updatedSuccessfully",
    "بە سەرکەوتوویی سڕایەوە": "messages.deletedSuccessfully",
    "بە سەرکەوتوویی دروستکرا": "messages.createdSuccessfully",
    "کۆپی کرا": "messages.copied",
    "لینک کۆپی کرا": "messages.linkCopied",
    "PDF داگیرا": "messages.pdfDownloaded",
    "فایل داگیرا": "messages.fileDownloaded",
    "فایل ئەپڵۆدکرا": "messages.fileUploaded",
    "سکان سەرکەوتوو بوو": "messages.scanSuccessful",
    "داواکاری دروستکرا": "messages.orderCreated",
    "داواکاری نوێکرایەوە": "messages.orderUpdated",
    "داواکاری سڕایەوە": "messages.orderDeleted",
    "دابینکەر دروستکرا": "messages.supplierCreated",
    "دابینکەر نوێکرایەوە": "messages.supplierUpdated",
    "دابینکەر سڕایەوە": "messages.supplierDeleted",
    "خەرجی تۆمارکرا": "messages.expenseRecorded",
    "خەرجی نوێکرایەوە": "messages.expenseUpdated",
    "خەرجی سڕایەوە": "messages.expenseDeleted",
    "هاوبەش زیادکرا": "messages.partnerAdded",
    "هاوبەش نوێکرایەوە": "messages.partnerUpdated",
    "هاوبەش سڕایەوە": "messages.partnerDeleted",
    "قەرز تۆمارکرا": "messages.debtRecorded",
    "قەرز نوێکرایەوە": "messages.debtUpdated",
    "قەرز سڕایەوە": "messages.debtDeleted",
    "حساب دروستکرا": "messages.accountCreated",
    "حساب نوێکرایەوە": "messages.accountUpdated",
    "حساب سڕایەوە": "messages.accountDeleted",
    "گواستنەوە تۆمارکرا": "messages.transferRecorded",
    "گواستنەوە سەرکەوتوو بوو": "messages.transferSuccessful",
    "ئاگادارکردنەوە ناردرا": "messages.reminderSent",
    "نرخ نوێکرایەوە": "messages.priceUpdated",
    "جۆری خزمەتگوزاری زیادکرا": "messages.serviceTypeAdded",
    "جۆری خزمەتگوزاری نوێکرایەوە": "messages.serviceTypeUpdated",
    "جۆری خزمەتگوزاری سڕایەوە": "messages.serviceTypeDeleted",
    "قاڵب تۆمارکرا": "messages.templateSaved",
    "قاڵب نوێکرایەوە": "messages.templateUpdated",
    "بڵاوکراوە تۆمارکرا": "messages.postSaved",
    "بڵاوکراوە نوێکرایەوە": "messages.postUpdated",
    "بڵاوکراوە سڕایەوە": "messages.postDeleted",
    "پۆل زیادکرا": "messages.categoryAdded",
    "پۆل نوێکرایەوە": "messages.categoryUpdated",
    "پۆل سڕایەوە": "messages.categoryDeleted",
    "ئامانج تۆمارکرا": "messages.goalSaved",
    "ئامانج نوێکرایەوە": "messages.goalUpdated",
    "ئامانج سڕایەوە": "messages.goalDeleted",
    "ئاگادارکردنەوە تۆمارکرا": "messages.alertSaved",
    "ئاگادارکردنەوە نوێکرایەوە": "messages.alertUpdated",
    "ئاگادارکردنەوە سڕایەوە": "messages.alertDeleted",
    
    # Error messages
    "هەڵە": "messages.error",
    "هەڵەیەک ڕوویدا": "messages.errorOccurred",
    "کێشەیەک ڕوویدا": "messages.problemOccurred",
    "قەبارەی فایل زۆرە": "messages.fileTooLarge",
    "زۆرترین 5MB": "messages.max5MB",
    "تکایە هەموو خانەکان پڕبکەرەوە": "messages.fillAllFields",
    "تکایە کڕیار هەڵبژێرە": "messages.selectCustomer",
    "تکایە بڕ داخڵ بکە": "messages.enterAmount",
    "تکایە شێواز هەڵبژێرە": "messages.selectMethod",
    "پاکەت نەدۆزرایەوە": "messages.packageNotFound",
    "کڕیار نەدۆزرایەوە": "messages.customerNotFound",
    "باچ نەدۆزرایەوە": "messages.batchNotFound",
    "ژمارەی تراکینگ داخڵ بکە": "messages.enterTrackingNumber",
    "پێشتر سکانکراوە": "messages.alreadyScanned",
    "سکان سەرکەوتوو نەبوو": "messages.scanFailed",
    
    # Warning messages
    "ئاگاداری": "messages.warning",
    "دڵنیایت لە سڕینەوە؟": "messages.confirmDelete",
    "ئەم کردارە ناگەڕێتەوە": "messages.actionCannotBeUndone",
    
    # Info messages
    "چاوەڕوانبە...": "messages.pleaseWait",
    "تۆمارکردن...": "messages.saving",
    "سڕینەوە...": "messages.deleting",
    "بارکردن...": "messages.loading",
    "گەڕان...": "messages.searching",
    "ناردن...": "messages.sending",
}

def add_message_translations():
    """Add message translations to locale files"""
    import json
    
    locales_dir = Path("/home/ubuntu/wazn-express/client/src/locales")
    
    # Build translations for each language
    messages_en = {}
    messages_ku = {}
    messages_ar = {}
    messages_zh = {}
    
    for ku_text, key in TOAST_TRANSLATIONS.items():
        short_key = key.replace("messages.", "")
        messages_ku[short_key] = ku_text
        
        # English translations
        en_map = {
            "customerReportDownloaded": "Customer report downloaded",
            "documentUploaded": "Document uploaded",
            "documentDeleted": "Document deleted",
            "customerInfoUpdated": "Customer info updated",
            "customerCreated": "Customer created",
            "customerUpdated": "Customer updated",
            "customerDeleted": "Customer deleted",
            "packageRegistered": "Package registered",
            "packageUpdated": "Package updated",
            "packageDeleted": "Package deleted",
            "batchCreated": "Batch created",
            "batchUpdated": "Batch updated",
            "batchDeleted": "Batch deleted",
            "paymentRecorded": "Payment recorded",
            "savedSuccessfully": "Saved successfully",
            "updatedSuccessfully": "Updated successfully",
            "deletedSuccessfully": "Deleted successfully",
            "createdSuccessfully": "Created successfully",
            "copied": "Copied",
            "linkCopied": "Link copied",
            "pdfDownloaded": "PDF downloaded",
            "fileDownloaded": "File downloaded",
            "fileUploaded": "File uploaded",
            "scanSuccessful": "Scan successful",
            "orderCreated": "Order created",
            "orderUpdated": "Order updated",
            "orderDeleted": "Order deleted",
            "supplierCreated": "Supplier created",
            "supplierUpdated": "Supplier updated",
            "supplierDeleted": "Supplier deleted",
            "expenseRecorded": "Expense recorded",
            "expenseUpdated": "Expense updated",
            "expenseDeleted": "Expense deleted",
            "partnerAdded": "Partner added",
            "partnerUpdated": "Partner updated",
            "partnerDeleted": "Partner deleted",
            "debtRecorded": "Debt recorded",
            "debtUpdated": "Debt updated",
            "debtDeleted": "Debt deleted",
            "accountCreated": "Account created",
            "accountUpdated": "Account updated",
            "accountDeleted": "Account deleted",
            "transferRecorded": "Transfer recorded",
            "transferSuccessful": "Transfer successful",
            "reminderSent": "Reminder sent",
            "priceUpdated": "Price updated",
            "serviceTypeAdded": "Service type added",
            "serviceTypeUpdated": "Service type updated",
            "serviceTypeDeleted": "Service type deleted",
            "templateSaved": "Template saved",
            "templateUpdated": "Template updated",
            "postSaved": "Post saved",
            "postUpdated": "Post updated",
            "postDeleted": "Post deleted",
            "categoryAdded": "Category added",
            "categoryUpdated": "Category updated",
            "categoryDeleted": "Category deleted",
            "goalSaved": "Goal saved",
            "goalUpdated": "Goal updated",
            "goalDeleted": "Goal deleted",
            "alertSaved": "Alert saved",
            "alertUpdated": "Alert updated",
            "alertDeleted": "Alert deleted",
            "error": "Error",
            "errorOccurred": "An error occurred",
            "problemOccurred": "A problem occurred",
            "fileTooLarge": "File is too large",
            "max5MB": "Maximum 5MB",
            "fillAllFields": "Please fill all fields",
            "selectCustomer": "Please select a customer",
            "enterAmount": "Please enter amount",
            "selectMethod": "Please select method",
            "packageNotFound": "Package not found",
            "customerNotFound": "Customer not found",
            "batchNotFound": "Batch not found",
            "enterTrackingNumber": "Enter tracking number",
            "alreadyScanned": "Already scanned",
            "scanFailed": "Scan failed",
            "warning": "Warning",
            "confirmDelete": "Are you sure you want to delete?",
            "actionCannotBeUndone": "This action cannot be undone",
            "pleaseWait": "Please wait...",
            "saving": "Saving...",
            "deleting": "Deleting...",
            "loading": "Loading...",
            "searching": "Searching...",
            "sending": "Sending...",
        }
        messages_en[short_key] = en_map.get(short_key, ku_text)
        
        # Arabic translations
        ar_map = {
            "customerReportDownloaded": "تم تحميل تقرير العميل",
            "documentUploaded": "تم رفع المستند",
            "documentDeleted": "تم حذف المستند",
            "customerInfoUpdated": "تم تحديث معلومات العميل",
            "customerCreated": "تم إنشاء العميل",
            "customerUpdated": "تم تحديث العميل",
            "customerDeleted": "تم حذف العميل",
            "packageRegistered": "تم تسجيل الطرد",
            "packageUpdated": "تم تحديث الطرد",
            "packageDeleted": "تم حذف الطرد",
            "batchCreated": "تم إنشاء الدفعة",
            "batchUpdated": "تم تحديث الدفعة",
            "batchDeleted": "تم حذف الدفعة",
            "paymentRecorded": "تم تسجيل الدفع",
            "savedSuccessfully": "تم الحفظ بنجاح",
            "updatedSuccessfully": "تم التحديث بنجاح",
            "deletedSuccessfully": "تم الحذف بنجاح",
            "createdSuccessfully": "تم الإنشاء بنجاح",
            "copied": "تم النسخ",
            "linkCopied": "تم نسخ الرابط",
            "pdfDownloaded": "تم تحميل PDF",
            "fileDownloaded": "تم تحميل الملف",
            "fileUploaded": "تم رفع الملف",
            "scanSuccessful": "تم المسح بنجاح",
            "orderCreated": "تم إنشاء الطلب",
            "orderUpdated": "تم تحديث الطلب",
            "orderDeleted": "تم حذف الطلب",
            "supplierCreated": "تم إنشاء المورد",
            "supplierUpdated": "تم تحديث المورد",
            "supplierDeleted": "تم حذف المورد",
            "expenseRecorded": "تم تسجيل المصروف",
            "expenseUpdated": "تم تحديث المصروف",
            "expenseDeleted": "تم حذف المصروف",
            "partnerAdded": "تم إضافة الشريك",
            "partnerUpdated": "تم تحديث الشريك",
            "partnerDeleted": "تم حذف الشريك",
            "debtRecorded": "تم تسجيل الدين",
            "debtUpdated": "تم تحديث الدين",
            "debtDeleted": "تم حذف الدين",
            "accountCreated": "تم إنشاء الحساب",
            "accountUpdated": "تم تحديث الحساب",
            "accountDeleted": "تم حذف الحساب",
            "transferRecorded": "تم تسجيل التحويل",
            "transferSuccessful": "تم التحويل بنجاح",
            "reminderSent": "تم إرسال التذكير",
            "priceUpdated": "تم تحديث السعر",
            "serviceTypeAdded": "تم إضافة نوع الخدمة",
            "serviceTypeUpdated": "تم تحديث نوع الخدمة",
            "serviceTypeDeleted": "تم حذف نوع الخدمة",
            "templateSaved": "تم حفظ القالب",
            "templateUpdated": "تم تحديث القالب",
            "postSaved": "تم حفظ المنشور",
            "postUpdated": "تم تحديث المنشور",
            "postDeleted": "تم حذف المنشور",
            "categoryAdded": "تم إضافة الفئة",
            "categoryUpdated": "تم تحديث الفئة",
            "categoryDeleted": "تم حذف الفئة",
            "goalSaved": "تم حفظ الهدف",
            "goalUpdated": "تم تحديث الهدف",
            "goalDeleted": "تم حذف الهدف",
            "alertSaved": "تم حفظ التنبيه",
            "alertUpdated": "تم تحديث التنبيه",
            "alertDeleted": "تم حذف التنبيه",
            "error": "خطأ",
            "errorOccurred": "حدث خطأ",
            "problemOccurred": "حدثت مشكلة",
            "fileTooLarge": "الملف كبير جداً",
            "max5MB": "الحد الأقصى 5 ميجابايت",
            "fillAllFields": "يرجى ملء جميع الحقول",
            "selectCustomer": "يرجى اختيار العميل",
            "enterAmount": "يرجى إدخال المبلغ",
            "selectMethod": "يرجى اختيار الطريقة",
            "packageNotFound": "الطرد غير موجود",
            "customerNotFound": "العميل غير موجود",
            "batchNotFound": "الدفعة غير موجودة",
            "enterTrackingNumber": "أدخل رقم التتبع",
            "alreadyScanned": "تم المسح مسبقاً",
            "scanFailed": "فشل المسح",
            "warning": "تحذير",
            "confirmDelete": "هل أنت متأكد من الحذف؟",
            "actionCannotBeUndone": "لا يمكن التراجع عن هذا الإجراء",
            "pleaseWait": "يرجى الانتظار...",
            "saving": "جاري الحفظ...",
            "deleting": "جاري الحذف...",
            "loading": "جاري التحميل...",
            "searching": "جاري البحث...",
            "sending": "جاري الإرسال...",
        }
        messages_ar[short_key] = ar_map.get(short_key, ku_text)
        
        # Chinese translations
        zh_map = {
            "customerReportDownloaded": "客户报告已下载",
            "documentUploaded": "文档已上传",
            "documentDeleted": "文档已删除",
            "customerInfoUpdated": "客户信息已更新",
            "customerCreated": "客户已创建",
            "customerUpdated": "客户已更新",
            "customerDeleted": "客户已删除",
            "packageRegistered": "包裹已登记",
            "packageUpdated": "包裹已更新",
            "packageDeleted": "包裹已删除",
            "batchCreated": "批次已创建",
            "batchUpdated": "批次已更新",
            "batchDeleted": "批次已删除",
            "paymentRecorded": "付款已记录",
            "savedSuccessfully": "保存成功",
            "updatedSuccessfully": "更新成功",
            "deletedSuccessfully": "删除成功",
            "createdSuccessfully": "创建成功",
            "copied": "已复制",
            "linkCopied": "链接已复制",
            "pdfDownloaded": "PDF已下载",
            "fileDownloaded": "文件已下载",
            "fileUploaded": "文件已上传",
            "scanSuccessful": "扫描成功",
            "orderCreated": "订单已创建",
            "orderUpdated": "订单已更新",
            "orderDeleted": "订单已删除",
            "supplierCreated": "供应商已创建",
            "supplierUpdated": "供应商已更新",
            "supplierDeleted": "供应商已删除",
            "expenseRecorded": "支出已记录",
            "expenseUpdated": "支出已更新",
            "expenseDeleted": "支出已删除",
            "partnerAdded": "合伙人已添加",
            "partnerUpdated": "合伙人已更新",
            "partnerDeleted": "合伙人已删除",
            "debtRecorded": "债务已记录",
            "debtUpdated": "债务已更新",
            "debtDeleted": "债务已删除",
            "accountCreated": "账户已创建",
            "accountUpdated": "账户已更新",
            "accountDeleted": "账户已删除",
            "transferRecorded": "转账已记录",
            "transferSuccessful": "转账成功",
            "reminderSent": "提醒已发送",
            "priceUpdated": "价格已更新",
            "serviceTypeAdded": "服务类型已添加",
            "serviceTypeUpdated": "服务类型已更新",
            "serviceTypeDeleted": "服务类型已删除",
            "templateSaved": "模板已保存",
            "templateUpdated": "模板已更新",
            "postSaved": "帖子已保存",
            "postUpdated": "帖子已更新",
            "postDeleted": "帖子已删除",
            "categoryAdded": "分类已添加",
            "categoryUpdated": "分类已更新",
            "categoryDeleted": "分类已删除",
            "goalSaved": "目标已保存",
            "goalUpdated": "目标已更新",
            "goalDeleted": "目标已删除",
            "alertSaved": "提醒已保存",
            "alertUpdated": "提醒已更新",
            "alertDeleted": "提醒已删除",
            "error": "错误",
            "errorOccurred": "发生错误",
            "problemOccurred": "出现问题",
            "fileTooLarge": "文件太大",
            "max5MB": "最大5MB",
            "fillAllFields": "请填写所有字段",
            "selectCustomer": "请选择客户",
            "enterAmount": "请输入金额",
            "selectMethod": "请选择方式",
            "packageNotFound": "未找到包裹",
            "customerNotFound": "未找到客户",
            "batchNotFound": "未找到批次",
            "enterTrackingNumber": "输入追踪号",
            "alreadyScanned": "已扫描",
            "scanFailed": "扫描失败",
            "warning": "警告",
            "confirmDelete": "确定要删除吗？",
            "actionCannotBeUndone": "此操作无法撤销",
            "pleaseWait": "请稍候...",
            "saving": "保存中...",
            "deleting": "删除中...",
            "loading": "加载中...",
            "searching": "搜索中...",
            "sending": "发送中...",
        }
        messages_zh[short_key] = zh_map.get(short_key, ku_text)
    
    # Update locale files
    for lang, messages in [('en', messages_en), ('ku', messages_ku), ('ar', messages_ar), ('zh', messages_zh)]:
        file_path = locales_dir / f"{lang}.json"
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'messages' not in data:
            data['messages'] = {}
        
        data['messages'].update(messages)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
    
    print("Added message translations to locale files")

def fix_toast_in_files():
    """Fix toast messages in TSX files"""
    total_fixes = 0
    
    for tsx_file in sorted(PAGES_DIR.glob("*.tsx")):
        with open(tsx_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        fixes = 0
        
        # Sort by length to avoid partial replacements
        sorted_items = sorted(TOAST_TRANSLATIONS.items(), key=lambda x: len(x[0]), reverse=True)
        
        for ku_text, trans_key in sorted_items:
            # Pattern for toast.success/error/info/warning('text')
            patterns = [
                (f"toast.success('{ku_text}')", f"toast.success(t('{trans_key}'))"),
                (f"toast.error('{ku_text}')", f"toast.error(t('{trans_key}'))"),
                (f"toast.info('{ku_text}')", f"toast.info(t('{trans_key}'))"),
                (f"toast.warning('{ku_text}')", f"toast.warning(t('{trans_key}'))"),
                (f'toast.success("{ku_text}")', f'toast.success(t("{trans_key}"))'),
                (f'toast.error("{ku_text}")', f'toast.error(t("{trans_key}"))'),
                (f'toast.info("{ku_text}")', f'toast.info(t("{trans_key}"))'),
                (f'toast.warning("{ku_text}")', f'toast.warning(t("{trans_key}"))'),
                (f"toast('{ku_text}')", f"toast(t('{trans_key}'))"),
                (f'toast("{ku_text}")', f'toast(t("{trans_key}"))'),
            ]
            
            for old, new in patterns:
                if old in content:
                    content = content.replace(old, new)
                    fixes += 1
        
        if content != original:
            with open(tsx_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"{tsx_file.name}: {fixes} toast fixes")
            total_fixes += fixes
    
    return total_fixes

if __name__ == "__main__":
    print("Adding message translations to locale files...")
    add_message_translations()
    
    print("\nFixing toast messages in TSX files...")
    total = fix_toast_in_files()
    print(f"\nTotal: {total} toast messages fixed")
