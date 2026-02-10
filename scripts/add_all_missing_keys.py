import os
import re
import json

# Get all translation keys used in code
all_keys = set()
for root, dirs, files in os.walk('/home/ubuntu/wazn-express/client/src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                matches = re.findall(r't\("([^"]+)"\)', content)
                all_keys.update(matches)

# Get all keys in ku.json
with open('/home/ubuntu/wazn-express/client/src/locales/ku.json', 'r', encoding='utf-8') as f:
    ku_data = json.load(f)

def get_all_keys(data, prefix=''):
    keys = set()
    for key, value in data.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            keys.update(get_all_keys(value, full_key))
        else:
            keys.add(full_key)
    return keys

existing_keys = get_all_keys(ku_data)

# Find missing keys - filter out invalid keys
missing_keys = all_keys - existing_keys
valid_missing = [k for k in missing_keys if k and len(k) > 2 and '.' in k and not k.startswith(' ') and not k.startswith(',')]

# Translations dictionary
translations = {
    "ku": {},
    "en": {},
    "ar": {},
    "zh": {}
}

# Define translations for each key
key_translations = {
    # Actions
    "actions.download": {"ku": "داگرتن", "en": "Download", "ar": "تحميل", "zh": "下载"},
    "actions.print": {"ku": "چاپکردن", "en": "Print", "ar": "طباعة", "zh": "打印"},
    
    # Batches
    "batches.noBatch": {"ku": "باچ نییە", "en": "No Batch", "ar": "لا توجد دفعة", "zh": "无批次"},
    "batches.selectBatch": {"ku": "باچێک هەڵبژێرە", "en": "Select Batch", "ar": "اختر دفعة", "zh": "选择批次"},
    
    # Customers
    "customers.activeCustomer": {"ku": "کڕیاری چالاک", "en": "Active Customer", "ar": "عميل نشط", "zh": "活跃客户"},
    "customers.addCustomerDesc": {"ku": "زیادکردنی کڕیاری نوێ", "en": "Add new customer", "ar": "إضافة عميل جديد", "zh": "添加新客户"},
    "customers.addressKu": {"ku": "ناونیشان (کوردی)", "en": "Address (Kurdish)", "ar": "العنوان (كردي)", "zh": "地址（库尔德语）"},
    "customers.addressEn": {"ku": "ناونیشان (ئینگلیزی)", "en": "Address (English)", "ar": "العنوان (إنجليزي)", "zh": "地址（英语）"},
    "customers.businessType": {"ku": "جۆری بازرگانی", "en": "Business Type", "ar": "نوع العمل", "zh": "业务类型"},
    "customers.city": {"ku": "شار", "en": "City", "ar": "المدينة", "zh": "城市"},
    "customers.confirmDelete": {"ku": "دڵنیای لە سڕینەوە؟", "en": "Confirm delete?", "ar": "تأكيد الحذف؟", "zh": "确认删除？"},
    "customers.customerAdded": {"ku": "کڕیار زیادکرا", "en": "Customer added", "ar": "تمت إضافة العميل", "zh": "客户已添加"},
    "customers.customerDeleted": {"ku": "کڕیار سڕایەوە", "en": "Customer deleted", "ar": "تم حذف العميل", "zh": "客户已删除"},
    "customers.customerInfo": {"ku": "زانیاری کڕیار", "en": "Customer Info", "ar": "معلومات العميل", "zh": "客户信息"},
    "customers.customerName": {"ku": "ناوی کڕیار", "en": "Customer Name", "ar": "اسم العميل", "zh": "客户名称"},
    "customers.customerNameKu": {"ku": "ناوی کڕیار (کوردی)", "en": "Customer Name (Kurdish)", "ar": "اسم العميل (كردي)", "zh": "客户名称（库尔德语）"},
    "customers.customerNameEn": {"ku": "ناوی کڕیار (ئینگلیزی)", "en": "Customer Name (English)", "ar": "اسم العميل (إنجليزي)", "zh": "客户名称（英语）"},
    "customers.customerUpdated": {"ku": "کڕیار نوێکرایەوە", "en": "Customer updated", "ar": "تم تحديث العميل", "zh": "客户已更新"},
    "customers.discount": {"ku": "داشکاندن", "en": "Discount", "ar": "خصم", "zh": "折扣"},
    "customers.discountPercent": {"ku": "ڕێژەی داشکاندن", "en": "Discount Percent", "ar": "نسبة الخصم", "zh": "折扣百分比"},
    "customers.female": {"ku": "مێ", "en": "Female", "ar": "أنثى", "zh": "女"},
    "customers.fillRequiredFields": {"ku": "خانە پێویستەکان پڕبکەرەوە", "en": "Fill required fields", "ar": "املأ الحقول المطلوبة", "zh": "填写必填字段"},
    "customers.gender": {"ku": "ڕەگەز", "en": "Gender", "ar": "الجنس", "zh": "性别"},
    "customers.governorate": {"ku": "پارێزگا", "en": "Governorate", "ar": "المحافظة", "zh": "省份"},
    "customers.idNumber": {"ku": "ژمارەی ناسنامە", "en": "ID Number", "ar": "رقم الهوية", "zh": "身份证号"},
    "customers.idNumberPlaceholder": {"ku": "ژمارەی ناسنامە", "en": "ID Number", "ar": "رقم الهوية", "zh": "身份证号"},
    "customers.individual": {"ku": "کەسی", "en": "Individual", "ar": "فردي", "zh": "个人"},
    "customers.lastActivity": {"ku": "دوایین چالاکی", "en": "Last Activity", "ar": "آخر نشاط", "zh": "最后活动"},
    "customers.male": {"ku": "نێر", "en": "Male", "ar": "ذكر", "zh": "男"},
    "customers.newCustomer": {"ku": "کڕیاری نوێ", "en": "New Customer", "ar": "عميل جديد", "zh": "新客户"},
    "customers.noActivityFound": {"ku": "چالاکی نەدۆزرایەوە", "en": "No activity found", "ar": "لم يتم العثور على نشاط", "zh": "未找到活动"},
    "customers.noExtraServices": {"ku": "خزمەتگوزاری زیادە نییە", "en": "No extra services", "ar": "لا توجد خدمات إضافية", "zh": "无额外服务"},
    "customers.notesAndStatus": {"ku": "تێبینی و دۆخ", "en": "Notes and Status", "ar": "ملاحظات والحالة", "zh": "备注和状态"},
    "customers.other": {"ku": "هیتر", "en": "Other", "ar": "أخرى", "zh": "其他"},
    "customers.owes": {"ku": "قەرزدارە", "en": "Owes", "ar": "مدين", "zh": "欠款"},
    "customers.perPackage": {"ku": "بۆ هەر پاکەت", "en": "Per Package", "ar": "لكل طرد", "zh": "每包"},
    "customers.personal": {"ku": "کەسی", "en": "Personal", "ar": "شخصي", "zh": "个人"},
    "customers.personalInfo": {"ku": "زانیاری کەسی", "en": "Personal Info", "ar": "معلومات شخصية", "zh": "个人信息"},
    "customers.preferredShipping": {"ku": "گواستنەوەی خوازراو", "en": "Preferred Shipping", "ar": "الشحن المفضل", "zh": "首选运输"},
    "customers.primaryMobile": {"ku": "ژمارەی سەرەکی", "en": "Primary Mobile", "ar": "الهاتف الرئيسي", "zh": "主要手机"},
    "customers.secondaryMobile": {"ku": "ژمارەی دووەم", "en": "Secondary Mobile", "ar": "الهاتف الثانوي", "zh": "次要手机"},
    "customers.selectBusinessType": {"ku": "جۆری بازرگانی هەڵبژێرە", "en": "Select Business Type", "ar": "اختر نوع العمل", "zh": "选择业务类型"},
    "customers.selectGender": {"ku": "ڕەگەز هەڵبژێرە", "en": "Select Gender", "ar": "اختر الجنس", "zh": "选择性别"},
    "customers.selectGovernorate": {"ku": "پارێزگا هەڵبژێرە", "en": "Select Governorate", "ar": "اختر المحافظة", "zh": "选择省份"},
    "customers.serviceType": {"ku": "جۆری خزمەتگوزاری", "en": "Service Type", "ar": "نوع الخدمة", "zh": "服务类型"},
    "customers.settled": {"ku": "تەسفیەکراو", "en": "Settled", "ar": "تمت التسوية", "zh": "已结算"},
    "customers.totalWeight": {"ku": "کۆی کێش", "en": "Total Weight", "ar": "الوزن الإجمالي", "zh": "总重量"},
    "customers.trader": {"ku": "بازرگان", "en": "Trader", "ar": "تاجر", "zh": "商人"},
    "customers.verificationDocuments": {"ku": "بەڵگەنامەکانی پشتڕاستکردنەوە", "en": "Verification Documents", "ar": "وثائق التحقق", "zh": "验证文件"},
    
    # Debts
    "debts.activeDebts": {"ku": "قەرزە چالاکەکان", "en": "Active Debts", "ar": "الديون النشطة", "zh": "活跃债务"},
    "debts.collateral": {"ku": "گرەو", "en": "Collateral", "ar": "ضمان", "zh": "抵押品"},
    "debts.collateralPlaceholder": {"ku": "گرەو", "en": "Collateral", "ar": "ضمان", "zh": "抵押品"},
    "debts.confirmDelete": {"ku": "دڵنیای لە سڕینەوە؟", "en": "Confirm delete?", "ar": "تأكيد الحذف؟", "zh": "确认删除？"},
    "debts.creditorName": {"ku": "ناوی قەرزدەر", "en": "Creditor Name", "ar": "اسم الدائن", "zh": "债权人姓名"},
    "debts.creditorNamePlaceholder": {"ku": "ناوی قەرزدەر", "en": "Creditor Name", "ar": "اسم الدائن", "zh": "债权人姓名"},
    "debts.creditorType": {"ku": "جۆری قەرزدەر", "en": "Creditor Type", "ar": "نوع الدائن", "zh": "债权人类型"},
    "debts.debtAdded": {"ku": "قەرز زیادکرا", "en": "Debt added", "ar": "تمت إضافة الدين", "zh": "债务已添加"},
    "debts.description": {"ku": "وەسف", "en": "Description", "ar": "الوصف", "zh": "描述"},
    "debts.dueDate": {"ku": "بەرواری دواوە", "en": "Due Date", "ar": "تاريخ الاستحقاق", "zh": "到期日"},
    "debts.end": {"ku": "کۆتایی", "en": "End", "ar": "نهاية", "zh": "结束"},
    "debts.fillCreditorAndAmount": {"ku": "ناوی قەرزدەر و بڕ پڕبکەرەوە", "en": "Fill creditor and amount", "ar": "املأ اسم الدائن والمبلغ", "zh": "填写债权人和金额"},
    "debts.installmentCount": {"ku": "ژمارەی قیست", "en": "Installment Count", "ar": "عدد الأقساط", "zh": "分期数"},
    "debts.installments": {"ku": "قیستەکان", "en": "Installments", "ar": "الأقساط", "zh": "分期付款"},
    "debts.interest": {"ku": "سوو", "en": "Interest", "ar": "فائدة", "zh": "利息"},
    "debts.interestRate": {"ku": "ڕێژەی سوو", "en": "Interest Rate", "ar": "معدل الفائدة", "zh": "利率"},
    "debts.mustBePaid": {"ku": "دەبێت بدرێت", "en": "Must be paid", "ar": "يجب الدفع", "zh": "必须支付"},
    "debts.needsToBePaid": {"ku": "پێویستە بدرێت", "en": "Needs to be paid", "ar": "يحتاج للدفع", "zh": "需要支付"},
    "debts.newDebt": {"ku": "قەرزی نوێ", "en": "New Debt", "ar": "دين جديد", "zh": "新债务"},
    "debts.noPaymentsFound": {"ku": "پارەدان نەدۆزرایەوە", "en": "No payments found", "ar": "لم يتم العثور على مدفوعات", "zh": "未找到付款"},
    "debts.paid": {"ku": "دراوە", "en": "Paid", "ar": "مدفوع", "zh": "已付"},
    "debts.paidBack": {"ku": "گەڕێندرایەوە", "en": "Paid Back", "ar": "تم السداد", "zh": "已偿还"},
    "debts.pdfError": {"ku": "هەڵەی PDF", "en": "PDF Error", "ar": "خطأ PDF", "zh": "PDF错误"},
    "debts.pdfGenerated": {"ku": "PDF دروستکرا", "en": "PDF Generated", "ar": "تم إنشاء PDF", "zh": "PDF已生成"},
    "debts.personal": {"ku": "کەسی", "en": "Personal", "ar": "شخصي", "zh": "个人"},
    "debts.purpose": {"ku": "مەبەست", "en": "Purpose", "ar": "الغرض", "zh": "目的"},
    "debts.purposePlaceholder": {"ku": "مەبەست", "en": "Purpose", "ar": "الغرض", "zh": "目的"},
    "debts.recordDebt": {"ku": "تۆمارکردنی قەرز", "en": "Record Debt", "ar": "تسجيل دين", "zh": "记录债务"},
    "debts.recordDebtDesc": {"ku": "تۆمارکردنی قەرزی نوێ", "en": "Record new debt", "ar": "تسجيل دين جديد", "zh": "记录新债务"},
    "debts.recordPaymentDesc": {"ku": "تۆمارکردنی پارەدان", "en": "Record payment", "ar": "تسجيل دفعة", "zh": "记录付款"},
    "debts.remaining": {"ku": "ماوە", "en": "Remaining", "ar": "المتبقي", "zh": "剩余"},
    "debts.restructured": {"ku": "ڕێکخراوەتەوە", "en": "Restructured", "ar": "معاد هيكلته", "zh": "已重组"},
    "debts.selectDebt": {"ku": "قەرز هەڵبژێرە", "en": "Select Debt", "ar": "اختر دين", "zh": "选择债务"},
    "debts.start": {"ku": "دەستپێک", "en": "Start", "ar": "بداية", "zh": "开始"},
    "debts.startDate": {"ku": "بەرواری دەستپێک", "en": "Start Date", "ar": "تاريخ البداية", "zh": "开始日期"},
    "debts.title": {"ku": "قەرزەکان", "en": "Debts", "ar": "الديون", "zh": "债务"},
    "debts.totalDebt": {"ku": "کۆی قەرز", "en": "Total Debt", "ar": "إجمالي الدين", "zh": "总债务"},
    "debts.totalPaid": {"ku": "کۆی دراو", "en": "Total Paid", "ar": "إجمالي المدفوع", "zh": "已付总额"},
    "debts.totalPlusInterest": {"ku": "کۆی لەگەڵ سوو", "en": "Total Plus Interest", "ar": "الإجمالي مع الفائدة", "zh": "含利息总额"},
    
    # Expenses
    "expenses.activeCategory": {"ku": "پۆلی چالاک", "en": "Active Category", "ar": "فئة نشطة", "zh": "活跃分类"},
    "expenses.addCategory": {"ku": "زیادکردنی پۆل", "en": "Add Category", "ar": "إضافة فئة", "zh": "添加分类"},
    "expenses.addCategoryDesc": {"ku": "زیادکردنی پۆلی نوێ", "en": "Add new category", "ar": "إضافة فئة جديدة", "zh": "添加新分类"},
    "expenses.allCategories": {"ku": "هەموو پۆلەکان", "en": "All Categories", "ar": "جميع الفئات", "zh": "所有分类"},
    "expenses.building": {"ku": "بینا", "en": "Building", "ar": "مبنى", "zh": "建筑"},
    "expenses.categories": {"ku": "پۆلەکان", "en": "Categories", "ar": "الفئات", "zh": "分类"},
    "expenses.categoryDescription": {"ku": "وەسفی پۆل", "en": "Category Description", "ar": "وصف الفئة", "zh": "分类描述"},
    "expenses.confirmDeleteCategory": {"ku": "دڵنیای لە سڕینەوەی پۆل؟", "en": "Confirm delete category?", "ar": "تأكيد حذف الفئة؟", "zh": "确认删除分类？"},
    "expenses.confirmDeleteExpense": {"ku": "دڵنیای لە سڕینەوەی خەرجی؟", "en": "Confirm delete expense?", "ar": "تأكيد حذف المصروف؟", "zh": "确认删除支出？"},
    "expenses.dailyAverage": {"ku": "ناوەندی ڕۆژانە", "en": "Daily Average", "ar": "المتوسط اليومي", "zh": "日均"},
    "expenses.electricity": {"ku": "کارەبا", "en": "Electricity", "ar": "كهرباء", "zh": "电费"},
    "expenses.employees": {"ku": "کارمەندەکان", "en": "Employees", "ar": "الموظفون", "zh": "员工"},
    "expenses.enterCategoryName": {"ku": "ناوی پۆل بنووسە", "en": "Enter category name", "ar": "أدخل اسم الفئة", "zh": "输入分类名称"},
    "expenses.expenseAdded": {"ku": "خەرجی زیادکرا", "en": "Expense added", "ar": "تمت إضافة المصروف", "zh": "支出已添加"},
    "expenses.expenseDescription": {"ku": "وەسفی خەرجی", "en": "Expense Description", "ar": "وصف المصروف", "zh": "支出描述"},
    "expenses.expenses": {"ku": "خەرجییەکان", "en": "Expenses", "ar": "المصروفات", "zh": "支出"},
    "expenses.expensesByCategory": {"ku": "خەرجییەکان بەپێی پۆل", "en": "Expenses by Category", "ar": "المصروفات حسب الفئة", "zh": "按分类支出"},
    "expenses.newCategory": {"ku": "پۆلی نوێ", "en": "New Category", "ar": "فئة جديدة", "zh": "新分类"},
    "expenses.newExpense": {"ku": "خەرجیی نوێ", "en": "New Expense", "ar": "مصروف جديد", "zh": "新支出"},
    "expenses.noExpensesFound": {"ku": "خەرجی نەدۆزرایەوە", "en": "No expenses found", "ar": "لم يتم العثور على مصروفات", "zh": "未找到支出"},
    "expenses.pdfError": {"ku": "هەڵەی PDF", "en": "PDF Error", "ar": "خطأ PDF", "zh": "PDF错误"},
    "expenses.pdfGenerated": {"ku": "PDF دروستکرا", "en": "PDF Generated", "ar": "تم إنشاء PDF", "zh": "PDF已生成"},
    "expenses.phone": {"ku": "تەلەفۆن", "en": "Phone", "ar": "هاتف", "zh": "电话"},
    "expenses.recordCount": {"ku": "ژمارەی تۆمار", "en": "Record Count", "ar": "عدد السجلات", "zh": "记录数"},
    "expenses.recordExpense": {"ku": "تۆمارکردنی خەرجی", "en": "Record Expense", "ar": "تسجيل مصروف", "zh": "记录支出"},
    "expenses.recordExpenseDesc": {"ku": "تۆمارکردنی خەرجیی نوێ", "en": "Record new expense", "ar": "تسجيل مصروف جديد", "zh": "记录新支出"},
    "expenses.recurring": {"ku": "دووبارەبوو", "en": "Recurring", "ar": "متكرر", "zh": "重复"},
    "expenses.recurringMonthly": {"ku": "مانگانە", "en": "Monthly", "ar": "شهري", "zh": "每月"},
    "expenses.selectCategory": {"ku": "پۆل هەڵبژێرە", "en": "Select Category", "ar": "اختر فئة", "zh": "选择分类"},
    "expenses.vendorSupplier": {"ku": "فرۆشیار", "en": "Vendor/Supplier", "ar": "المورد", "zh": "供应商"},
    "expenses.warehouseRent": {"ku": "کرێی کۆگا", "en": "Warehouse Rent", "ar": "إيجار المستودع", "zh": "仓库租金"},
    
    # Finance
    "finance.currency": {"ku": "دراو", "en": "Currency", "ar": "العملة", "zh": "货币"},
    
    # Packages
    "packages.allPackageInfo": {"ku": "هەموو زانیاری پاکەت", "en": "All Package Info", "ar": "جميع معلومات الطرد", "zh": "所有包裹信息"},
    "packages.calculatedCost": {"ku": "تێچووی حیسابکراو", "en": "Calculated Cost", "ar": "التكلفة المحسوبة", "zh": "计算成本"},
    "packages.changingFrom": {"ku": "گۆڕین لە", "en": "Changing from", "ar": "التغيير من", "zh": "从...更改"},
    "packages.costAndDates": {"ku": "تێچوو و بەروار", "en": "Cost and Dates", "ar": "التكلفة والتواريخ", "zh": "成本和日期"},
    "packages.cubicMeter": {"ku": "مەتری کیوبی", "en": "Cubic Meter", "ar": "متر مكعب", "zh": "立方米"},
    "packages.customerInfo": {"ku": "زانیاری کڕیار", "en": "Customer Info", "ar": "معلومات العميل", "zh": "客户信息"},
    "packages.customerSelected": {"ku": "کڕیار هەڵبژێردرا", "en": "Customer selected", "ar": "تم اختيار العميل", "zh": "已选择客户"},
    "packages.danger": {"ku": "مەترسیدار", "en": "Danger", "ar": "خطر", "zh": "危险"},
    "packages.daysSinceRegistration": {"ku": "ڕۆژ لە تۆمارکردن", "en": "Days since registration", "ar": "أيام منذ التسجيل", "zh": "注册天数"},
    "packages.descriptionPlaceholder": {"ku": "وەسف", "en": "Description", "ar": "الوصف", "zh": "描述"},
    "packages.estimatedPrice": {"ku": "نرخی خەمڵێنراو", "en": "Estimated Price", "ar": "السعر التقديري", "zh": "预估价格"},
    "packages.goodsDescription": {"ku": "وەسفی کاڵا", "en": "Goods Description", "ar": "وصف البضائع", "zh": "货物描述"},
    "packages.goodsType": {"ku": "جۆری کاڵا", "en": "Goods Type", "ar": "نوع البضائع", "zh": "货物类型"},
    "packages.goodsTypePlaceholder": {"ku": "جۆری کاڵا", "en": "Goods Type", "ar": "نوع البضائع", "zh": "货物类型"},
    "packages.inProgress": {"ku": "لە ڕێگادا", "en": "In Progress", "ar": "قيد التنفيذ", "zh": "进行中"},
    "packages.newStatus": {"ku": "دۆخی نوێ", "en": "New Status", "ar": "حالة جديدة", "zh": "新状态"},
    "packages.noBatch": {"ku": "باچ نییە", "en": "No Batch", "ar": "لا توجد دفعة", "zh": "无批次"},
    "packages.noCategory": {"ku": "پۆل نییە", "en": "No Category", "ar": "لا توجد فئة", "zh": "无分类"},
    "packages.noPackagesToExport": {"ku": "پاکەت نییە بۆ هەناردن", "en": "No packages to export", "ar": "لا توجد طرود للتصدير", "zh": "无包裹可导出"},
    "packages.normal": {"ku": "ئاسایی", "en": "Normal", "ar": "عادي", "zh": "普通"},
    "packages.package": {"ku": "پاکەت", "en": "Package", "ar": "طرد", "zh": "包裹"},
    "packages.pricePerCBM": {"ku": "نرخ بۆ CBM", "en": "Price per CBM", "ar": "السعر لكل CBM", "zh": "每CBM价格"},
    "packages.pricePerKG": {"ku": "نرخ بۆ KG", "en": "Price per KG", "ar": "السعر لكل كجم", "zh": "每公斤价格"},
    "packages.productCategory": {"ku": "پۆلی بەرهەم", "en": "Product Category", "ar": "فئة المنتج", "zh": "产品分类"},
    "packages.selectCategory": {"ku": "پۆل هەڵبژێرە", "en": "Select Category", "ar": "اختر فئة", "zh": "选择分类"},
    "packages.statusUpdated": {"ku": "دۆخ نوێکرایەوە", "en": "Status updated", "ar": "تم تحديث الحالة", "zh": "状态已更新"},
    "packages.trackingAndShipping": {"ku": "تراکینگ و گواستنەوە", "en": "Tracking and Shipping", "ar": "التتبع والشحن", "zh": "追踪和运输"},
    "packages.warning": {"ku": "ئاگاداری", "en": "Warning", "ar": "تحذير", "zh": "警告"},
    "packages.weightAndDimensions": {"ku": "کێش و قەبارە", "en": "Weight and Dimensions", "ar": "الوزن والأبعاد", "zh": "重量和尺寸"},
    "packages.weightKg": {"ku": "کێش (کگ)", "en": "Weight (kg)", "ar": "الوزن (كجم)", "zh": "重量（公斤）"},
    "packages.weightPlaceholder": {"ku": "کێش", "en": "Weight", "ar": "الوزن", "zh": "重量"},
    
    # Partners
    "partners.accumulatedBalance": {"ku": "باڵانسی کۆکراوە", "en": "Accumulated Balance", "ar": "الرصيد المتراكم", "zh": "累计余额"},
    "partners.activePartner": {"ku": "هاوبەشی چالاک", "en": "Active Partner", "ar": "شريك نشط", "zh": "活跃合伙人"},
    "partners.addPartnerDesc": {"ku": "زیادکردنی هاوبەشی نوێ", "en": "Add new partner", "ar": "إضافة شريك جديد", "zh": "添加新合伙人"},
    "partners.adjustment": {"ku": "ڕێکخستن", "en": "Adjustment", "ar": "تعديل", "zh": "调整"},
    "partners.capitalContribution": {"ku": "بەشداری سەرمایە", "en": "Capital Contribution", "ar": "مساهمة رأس المال", "zh": "资本贡献"},
    "partners.capitalPlusBalance": {"ku": "سەرمایە + باڵانس", "en": "Capital + Balance", "ar": "رأس المال + الرصيد", "zh": "资本+余额"},
    "partners.confirmDelete": {"ku": "دڵنیای لە سڕینەوە؟", "en": "Confirm delete?", "ar": "تأكيد الحذف؟", "zh": "确认删除？"},
    "partners.fillNameAndCapital": {"ku": "ناو و سەرمایە پڕبکەرەوە", "en": "Fill name and capital", "ar": "املأ الاسم ورأس المال", "zh": "填写姓名和资本"},
    "partners.initialCapital": {"ku": "سەرمایەی سەرەتایی", "en": "Initial Capital", "ar": "رأس المال الأولي", "zh": "初始资本"},
    "partners.initialCapitalDesc": {"ku": "سەرمایەی سەرەتایی", "en": "Initial Capital", "ar": "رأس المال الأولي", "zh": "初始资本"},
    "partners.loanRepayment": {"ku": "گەڕاندنەوەی قەرز", "en": "Loan Repayment", "ar": "سداد القرض", "zh": "贷款偿还"},
    "partners.loanToCompany": {"ku": "قەرز بە کۆمپانیا", "en": "Loan to Company", "ar": "قرض للشركة", "zh": "贷款给公司"},
    "partners.management": {"ku": "بەڕێوەبردن", "en": "Management", "ar": "الإدارة", "zh": "管理"},
    "partners.newPartner": {"ku": "هاوبەشی نوێ", "en": "New Partner", "ar": "شريك جديد", "zh": "新合伙人"},
    "partners.newTransaction": {"ku": "مامەڵەی نوێ", "en": "New Transaction", "ar": "معاملة جديدة", "zh": "新交易"},
    "partners.noTransactionsFound": {"ku": "مامەڵە نەدۆزرایەوە", "en": "No transactions found", "ar": "لم يتم العثور على معاملات", "zh": "未找到交易"},
    "partners.ownershipPercentage": {"ku": "ڕێژەی خاوەندارێتی", "en": "Ownership Percentage", "ar": "نسبة الملكية", "zh": "所有权百分比"},
    "partners.partner": {"ku": "هاوبەش", "en": "Partner", "ar": "شريك", "zh": "合伙人"},
    "partners.partnerAdded": {"ku": "هاوبەش زیادکرا", "en": "Partner added", "ar": "تمت إضافة الشريك", "zh": "合伙人已添加"},
    "partners.partnerCount": {"ku": "ژمارەی هاوبەش", "en": "Partner Count", "ar": "عدد الشركاء", "zh": "合伙人数"},
    "partners.pdfGenerated": {"ku": "PDF دروستکرا", "en": "PDF Generated", "ar": "تم إنشاء PDF", "zh": "PDF已生成"},
    "partners.recordTransaction": {"ku": "تۆمارکردنی مامەڵە", "en": "Record Transaction", "ar": "تسجيل معاملة", "zh": "记录交易"},
    "partners.recordTransactionDesc": {"ku": "تۆمارکردنی مامەڵەی نوێ", "en": "Record new transaction", "ar": "تسجيل معاملة جديدة", "zh": "记录新交易"},
    "partners.retainedEarnings": {"ku": "قازانجی پاشەکەوتکراو", "en": "Retained Earnings", "ar": "الأرباح المحتجزة", "zh": "留存收益"},
    "partners.selectPartner": {"ku": "هاوبەش هەڵبژێرە", "en": "Select Partner", "ar": "اختر شريك", "zh": "选择合伙人"},
    "partners.totalCapital": {"ku": "کۆی سەرمایە", "en": "Total Capital", "ar": "إجمالي رأس المال", "zh": "总资本"},
    "partners.totalOwnersEquity": {"ku": "کۆی مافی خاوەن", "en": "Total Owners Equity", "ar": "إجمالي حقوق الملكية", "zh": "所有者权益总额"},
    "partners.trackCapitalAndBalance": {"ku": "بەدواداچوونی سەرمایە و باڵانس", "en": "Track Capital and Balance", "ar": "تتبع رأس المال والرصيد", "zh": "跟踪资本和余额"},
    "partners.transactionDescription": {"ku": "وەسفی مامەڵە", "en": "Transaction Description", "ar": "وصف المعاملة", "zh": "交易描述"},
    "partners.transactionHistory": {"ku": "مێژووی مامەڵە", "en": "Transaction History", "ar": "سجل المعاملات", "zh": "交易历史"},
    "partners.transactionRecorded": {"ku": "مامەڵە تۆمارکرا", "en": "Transaction recorded", "ar": "تم تسجيل المعاملة", "zh": "交易已记录"},
    "partners.transactionType": {"ku": "جۆری مامەڵە", "en": "Transaction Type", "ar": "نوع المعاملة", "zh": "交易类型"},
    "partners.withdrawal": {"ku": "دەرهێنان", "en": "Withdrawal", "ar": "سحب", "zh": "提款"},
    
    # Reports
    "reports.profitLoss": {"ku": "قازانج و زیان", "en": "Profit & Loss", "ar": "الربح والخسارة", "zh": "损益"},
    
    # Scan Reports
    "scanReports.title": {"ku": "ڕاپۆرتی سکان", "en": "Scan Reports", "ar": "تقارير المسح", "zh": "扫描报告"},
    
    # Scanner
    "scanner.barcodeScanner": {"ku": "سکانەری بارکۆد", "en": "Barcode Scanner", "ar": "ماسح الباركود", "zh": "条码扫描器"},
    "scanner.camera": {"ku": "کامێرا", "en": "Camera", "ar": "الكاميرا", "zh": "相机"},
    "scanner.changeStatus": {"ku": "گۆڕینی دۆخ", "en": "Change Status", "ar": "تغيير الحالة", "zh": "更改状态"},
    "scanner.customerInfo": {"ku": "زانیاری کڕیار", "en": "Customer Info", "ar": "معلومات العميل", "zh": "客户信息"},
    "scanner.enterTrackingNumber": {"ku": "ژمارەی تراکینگ بنووسە", "en": "Enter tracking number", "ar": "أدخل رقم التتبع", "zh": "输入追踪号"},
    "scanner.myRecentScans": {"ku": "سکانەکانی دوایی من", "en": "My Recent Scans", "ar": "عمليات المسح الأخيرة", "zh": "我的最近扫描"},
    "scanner.noScansYet": {"ku": "هێشتا سکان نییە", "en": "No scans yet", "ar": "لا توجد عمليات مسح بعد", "zh": "暂无扫描"},
    "scanner.notesOptional": {"ku": "تێبینی (ئارەزوومەندانە)", "en": "Notes (optional)", "ar": "ملاحظات (اختياري)", "zh": "备注（可选）"},
    "scanner.packageFound": {"ku": "پاکەت دۆزرایەوە", "en": "Package found", "ar": "تم العثور على الطرد", "zh": "找到包裹"},
    "scanner.packageInfo": {"ku": "زانیاری پاکەت", "en": "Package Info", "ar": "معلومات الطرد", "zh": "包裹信息"},
    "scanner.packageRegistered": {"ku": "پاکەت تۆمارکرا", "en": "Package registered", "ar": "تم تسجيل الطرد", "zh": "包裹已注册"},
    "scanner.registerNewPackage": {"ku": "تۆمارکردنی پاکەتی نوێ", "en": "Register New Package", "ar": "تسجيل طرد جديد", "zh": "注册新包裹"},
    "scanner.scanDescription": {"ku": "سکانکردن یان نووسینی ژمارەی تراکینگ", "en": "Scan or type tracking number", "ar": "امسح أو اكتب رقم التتبع", "zh": "扫描或输入追踪号"},
    "scanner.scanOrTypeNumber": {"ku": "سکان یان نووسین", "en": "Scan or type", "ar": "امسح أو اكتب", "zh": "扫描或输入"},
    "scanner.scanRecorded": {"ku": "سکان تۆمارکرا", "en": "Scan recorded", "ar": "تم تسجيل المسح", "zh": "扫描已记录"},
    "scanner.scannerManual": {"ku": "دەستی", "en": "Manual", "ar": "يدوي", "zh": "手动"},
    "scanner.searchByTracking": {"ku": "گەڕان بە تراکینگ", "en": "Search by tracking", "ar": "البحث بالتتبع", "zh": "按追踪号搜索"},
    "scanner.searchError": {"ku": "هەڵەی گەڕان", "en": "Search error", "ar": "خطأ في البحث", "zh": "搜索错误"},
    "scanner.selectCustomer": {"ku": "کڕیار هەڵبژێرە", "en": "Select Customer", "ar": "اختر عميل", "zh": "选择客户"},
    "scanner.selectCustomerError": {"ku": "تکایە کڕیارێک هەڵبژێرە", "en": "Please select a customer", "ar": "الرجاء اختيار عميل", "zh": "请选择客户"},
    "scanner.smartScanner": {"ku": "سکانەری زیرەک", "en": "Smart Scanner", "ar": "الماسح الذكي", "zh": "智能扫描器"},
    "scanner.smartScannerDescription": {"ku": "سکانکردنی خێرا و زیرەک", "en": "Fast and smart scanning", "ar": "مسح سريع وذكي", "zh": "快速智能扫描"},
    "scanner.todayStats": {"ku": "ئامارەکانی ئەمڕۆ", "en": "Today's Stats", "ar": "إحصائيات اليوم", "zh": "今日统计"},
    "scanner.trackingNumberLabel": {"ku": "ژمارەی تراکینگ", "en": "Tracking Number", "ar": "رقم التتبع", "zh": "追踪号"},
    "scanner.trackingPlaceholder": {"ku": "ژمارەی تراکینگ", "en": "Tracking Number", "ar": "رقم التتبع", "zh": "追踪号"},
    
    # Treasury
    "treasury.account": {"ku": "هەژمار", "en": "Account", "ar": "حساب", "zh": "账户"},
    "treasury.accountAdded": {"ku": "هەژمار زیادکرا", "en": "Account added", "ar": "تمت إضافة الحساب", "zh": "账户已添加"},
    "treasury.accountDescription": {"ku": "وەسفی هەژمار", "en": "Account Description", "ar": "وصف الحساب", "zh": "账户描述"},
    "treasury.accountName": {"ku": "ناوی هەژمار", "en": "Account Name", "ar": "اسم الحساب", "zh": "账户名称"},
    "treasury.accountNumber": {"ku": "ژمارەی هەژمار", "en": "Account Number", "ar": "رقم الحساب", "zh": "账号"},
    "treasury.accountType": {"ku": "جۆری هەژمار", "en": "Account Type", "ar": "نوع الحساب", "zh": "账户类型"},
    "treasury.addAccount": {"ku": "زیادکردنی هەژمار", "en": "Add Account", "ar": "إضافة حساب", "zh": "添加账户"},
    "treasury.addAccountDesc": {"ku": "زیادکردنی هەژماری نوێ", "en": "Add new account", "ar": "إضافة حساب جديد", "zh": "添加新账户"},
    "treasury.adjustment": {"ku": "ڕێکخستن", "en": "Adjustment", "ar": "تعديل", "zh": "调整"},
    "treasury.bankAccount": {"ku": "هەژماری بانک", "en": "Bank Account", "ar": "حساب بنكي", "zh": "银行账户"},
    "treasury.bankName": {"ku": "ناوی بانک", "en": "Bank Name", "ar": "اسم البنك", "zh": "银行名称"},
    "treasury.bankNamePlaceholder": {"ku": "ناوی بانک", "en": "Bank Name", "ar": "اسم البنك", "zh": "银行名称"},
    "treasury.cashBox": {"ku": "سندوقی پارە", "en": "Cash Box", "ar": "صندوق النقد", "zh": "现金箱"},
    "treasury.cashBoxBalance": {"ku": "باڵانسی سندوق", "en": "Cash Box Balance", "ar": "رصيد الصندوق", "zh": "现金箱余额"},
    "treasury.cashMoney": {"ku": "پارەی نەقد", "en": "Cash Money", "ar": "نقد", "zh": "现金"},
    "treasury.confirmDelete": {"ku": "دڵنیای لە سڕینەوە؟", "en": "Confirm delete?", "ar": "تأكيد الحذف؟", "zh": "确认删除？"},
    "treasury.currentBalance": {"ku": "باڵانسی ئێستا", "en": "Current Balance", "ar": "الرصيد الحالي", "zh": "当前余额"},
    "treasury.description": {"ku": "وەسف", "en": "Description", "ar": "الوصف", "zh": "描述"},
    "treasury.destinationAccount": {"ku": "هەژماری مەبەست", "en": "Destination Account", "ar": "الحساب الوجهة", "zh": "目标账户"},
    "treasury.enterAccountName": {"ku": "ناوی هەژمار بنووسە", "en": "Enter account name", "ar": "أدخل اسم الحساب", "zh": "输入账户名称"},
    "treasury.initialBalance": {"ku": "باڵانسی سەرەتایی", "en": "Initial Balance", "ar": "الرصيد الأولي", "zh": "初始余额"},
    "treasury.mainCashBox": {"ku": "سندوقی سەرەکی", "en": "Main Cash Box", "ar": "الصندوق الرئيسي", "zh": "主现金箱"},
    "treasury.mobileWallet": {"ku": "جزدانی مۆبایل", "en": "Mobile Wallet", "ar": "محفظة الهاتف", "zh": "手机钱包"},
    "treasury.newAccount": {"ku": "هەژماری نوێ", "en": "New Account", "ar": "حساب جديد", "zh": "新账户"},
    "treasury.newTransaction": {"ku": "مامەڵەی نوێ", "en": "New Transaction", "ar": "معاملة جديدة", "zh": "新交易"},
    "treasury.noTransactionsFound": {"ku": "مامەڵە نەدۆزرایەوە", "en": "No transactions found", "ar": "لم يتم العثور على معاملات", "zh": "未找到交易"},
    "treasury.receiptNumber": {"ku": "ژمارەی پسوولە", "en": "Receipt Number", "ar": "رقم الإيصال", "zh": "收据号"},
    "treasury.recordTransaction": {"ku": "تۆمارکردنی مامەڵە", "en": "Record Transaction", "ar": "تسجيل معاملة", "zh": "记录交易"},
    "treasury.selectAccount": {"ku": "هەژمار هەڵبژێرە", "en": "Select Account", "ar": "اختر حساب", "zh": "选择账户"},
    "treasury.selectDestinationAccount": {"ku": "هەژماری مەبەست هەڵبژێرە", "en": "Select destination account", "ar": "اختر الحساب الوجهة", "zh": "选择目标账户"},
    "treasury.totalCurrency": {"ku": "کۆی دراو", "en": "Total Currency", "ar": "إجمالي العملة", "zh": "货币总额"},
    "treasury.transactionDesc": {"ku": "وەسفی مامەڵە", "en": "Transaction Description", "ar": "وصف المعاملة", "zh": "交易描述"},
    "treasury.transactionDescription": {"ku": "وەسفی مامەڵە", "en": "Transaction Description", "ar": "وصف المعاملة", "zh": "交易描述"},
    "treasury.transactionRecorded": {"ku": "مامەڵە تۆمارکرا", "en": "Transaction recorded", "ar": "تم تسجيل المعاملة", "zh": "交易已记录"},
    "treasury.transactionType": {"ku": "جۆری مامەڵە", "en": "Transaction Type", "ar": "نوع المعاملة", "zh": "交易类型"},
    "treasury.transferOut": {"ku": "گواستنەوە", "en": "Transfer Out", "ar": "تحويل صادر", "zh": "转出"},
    "treasury.withdrawal": {"ku": "دەرهێنان", "en": "Withdrawal", "ar": "سحب", "zh": "提款"},
}

# Add more keys for remaining categories
additional_keys = {
    "actualCbm": {"ku": "CBM ڕاستەقینە", "en": "Actual CBM", "ar": "CBM الفعلي", "zh": "实际CBM"},
    "actualWeightKg": {"ku": "کێشی ڕاستەقینە (کگ)", "en": "Actual Weight (kg)", "ar": "الوزن الفعلي (كجم)", "zh": "实际重量（公斤）"},
    "addNote": {"ku": "زیادکردنی تێبینی", "en": "Add Note", "ar": "إضافة ملاحظة", "zh": "添加备注"},
    "addToCustomerBalance": {"ku": "زیادکردن بۆ باڵانسی کڕیار", "en": "Add to Customer Balance", "ar": "إضافة لرصيد العميل", "zh": "添加到客户余额"},
    "adminResponse": {"ku": "وەڵامی بەڕێوەبەر", "en": "Admin Response", "ar": "رد المسؤول", "zh": "管理员回复"},
    "allPackagesClaimed": {"ku": "هەموو پاکەتەکان داواکراون", "en": "All packages claimed", "ar": "تم المطالبة بجميع الطرود", "zh": "所有包裹已认领"},
    "amountUsd": {"ku": "بڕ (دۆلار)", "en": "Amount (USD)", "ar": "المبلغ (دولار)", "zh": "金额（美元）"},
    "announcements": {"ku": "ڕاگەیاندنەکان", "en": "Announcements", "ar": "الإعلانات", "zh": "公告"},
    "approved": {"ku": "پەسەندکراو", "en": "Approved", "ar": "موافق عليه", "zh": "已批准"},
    "arrived": {"ku": "گەیشتووە", "en": "Arrived", "ar": "وصل", "zh": "已到达"},
    "availablePackages": {"ku": "پاکەتە بەردەستەکان", "en": "Available Packages", "ar": "الطرود المتاحة", "zh": "可用包裹"},
    "batchCode": {"ku": "کۆدی باچ", "en": "Batch Code", "ar": "رمز الدفعة", "zh": "批次代码"},
    "cancel": {"ku": "پاشگەزبوونەوە", "en": "Cancel", "ar": "إلغاء", "zh": "取消"},
    "carrierInfo": {"ku": "زانیاری گواستنەوە", "en": "Carrier Info", "ar": "معلومات الناقل", "zh": "承运人信息"},
    "chargedCbm": {"ku": "CBM حیسابکراو", "en": "Charged CBM", "ar": "CBM المحسوب", "zh": "收费CBM"},
    "chargedWeightKg": {"ku": "کێشی حیسابکراو (کگ)", "en": "Charged Weight (kg)", "ar": "الوزن المحسوب (كجم)", "zh": "收费重量（公斤）"},
    "checkTrackingNumber": {"ku": "ژمارەی تراکینگ بپشکنە", "en": "Check tracking number", "ar": "تحقق من رقم التتبع", "zh": "检查追踪号"},
    "city": {"ku": "شار", "en": "City", "ar": "المدينة", "zh": "城市"},
    "claimNotePlaceholder": {"ku": "تێبینی داواکردن", "en": "Claim note", "ar": "ملاحظة المطالبة", "zh": "认领备注"},
    "claimPackage": {"ku": "داواکردنی پاکەت", "en": "Claim Package", "ar": "المطالبة بالطرد", "zh": "认领包裹"},
    "claimPackageDesc": {"ku": "داواکردنی پاکەتی بێ خاوەن", "en": "Claim unclaimed package", "ar": "المطالبة بطرد غير مطالب به", "zh": "认领无主包裹"},
}

key_translations.update(additional_keys)

# Load and update each locale file
for locale in ['ku', 'en', 'ar', 'zh']:
    filepath = f'/home/ubuntu/wazn-express/client/src/locales/{locale}.json'
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Add missing keys
    for key, trans in key_translations.items():
        if key in valid_missing:
            parts = key.split('.')
            if len(parts) == 2:
                section, subkey = parts
                if section not in data:
                    data[section] = {}
                if subkey not in data[section]:
                    data[section][subkey] = trans.get(locale, key)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Updated {locale}.json")

print("\nAll locale files updated with missing keys!")
