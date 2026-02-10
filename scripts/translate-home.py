#!/usr/bin/env python3
"""
Translate Home.tsx page - replace all hardcoded Kurdish text with t() calls
"""

import json
from pathlib import Path

# Home page specific translations
HOME_TRANSLATIONS = {
    # Navigation
    "خزمەتگوزاریەکان": {"key": "home.services", "en": "Services", "ar": "الخدمات", "zh": "服务"},
    "تایبەتمەندیەکان": {"key": "home.features", "en": "Features", "ar": "المميزات", "zh": "特点"},
    "پەیوەندی": {"key": "home.contact", "en": "Contact", "ar": "اتصل بنا", "zh": "联系我们"},
    "پۆرتاڵی کڕیار": {"key": "home.customerPortal", "en": "Customer Portal", "ar": "بوابة العملاء", "zh": "客户门户"},
    "چوونەژوورەوەی ستاف": {"key": "home.staffLogin", "en": "Staff Login", "ar": "دخول الموظفين", "zh": "员工登录"},
    
    # Hero Section
    "گواستنەوەی خێرا و متمانەپێکراو": {"key": "home.fastReliable", "en": "Fast & Reliable Shipping", "ar": "شحن سريع وموثوق", "zh": "快速可靠的运输"},
    "گواستنەوەی نێودەوڵەتی": {"key": "home.internationalShipping", "en": "International Shipping", "ar": "الشحن الدولي", "zh": "国际运输"},
    "لە چین بۆ عێراق": {"key": "home.chinaToIraq", "en": "From China to Iraq", "ar": "من الصين إلى العراق", "zh": "从中国到伊拉克"},
    "خزمەتگوزاری گواستنەوەی بار بە ئاسمان و دەریا لەگەڵ شوێنکەوتنی ڕاستەوخۆ، ژمێریاری ئۆتۆماتیکی، و پسوڵەی پرۆفیشناڵ": {
        "key": "home.heroDescription", 
        "en": "Air and sea cargo shipping services with real-time tracking, automatic accounting, and professional invoicing", 
        "ar": "خدمات شحن البضائع الجوية والبحرية مع التتبع في الوقت الفعلي والمحاسبة الآلية والفواتير الاحترافية", 
        "zh": "空运和海运货物运输服务，提供实时跟踪、自动记账和专业发票"
    },
    "شوێنکەوتنی خێرای بار": {"key": "home.quickTrack", "en": "Quick Package Tracking", "ar": "تتبع سريع للشحنات", "zh": "快速包裹追踪"},
    "ژمارەی شوێنکەوتن...": {"key": "home.trackingPlaceholder", "en": "Tracking number...", "ar": "رقم التتبع...", "zh": "追踪号码..."},
    
    # Tracking Card
    "شوێنکەوتنی بار": {"key": "home.packageTracking", "en": "Package Tracking", "ar": "تتبع الشحنة", "zh": "包裹追踪"},
    "ڕاستەوخۆ و دڵنیا": {"key": "home.liveReliable", "en": "Live & Reliable", "ar": "مباشر وموثوق", "zh": "实时可靠"},
    "وەرگیرا لە چین": {"key": "home.receivedChina", "en": "Received in China", "ar": "تم الاستلام في الصين", "zh": "已在中国收到"},
    "لە ڕێگادایە": {"key": "home.onTheWay", "en": "On the Way", "ar": "في الطريق", "zh": "运输中"},
    "گەیشتە عێراق": {"key": "home.arrivedIraq", "en": "Arrived in Iraq", "ar": "وصل إلى العراق", "zh": "已到达伊拉克"},
    "گەیاندن": {"key": "home.delivery", "en": "Delivery", "ar": "التسليم", "zh": "配送"},
    "چاوەڕوانکراو": {"key": "home.expected", "en": "Expected", "ar": "متوقع", "zh": "预计"},
    "ڕێژەی گەیاندن": {"key": "home.deliveryRate", "en": "Delivery Rate", "ar": "معدل التسليم", "zh": "送达率"},
    "پشتگیری": {"key": "home.support", "en": "Support", "ar": "الدعم", "zh": "支持"},
    
    # Stats
    "بار گەیەندراوە": {"key": "home.packagesDelivered", "en": "Packages Delivered", "ar": "شحنات تم تسليمها", "zh": "已送达包裹"},
    "وڵات": {"key": "home.countries", "en": "Countries", "ar": "دول", "zh": "国家"},
    "کڕیاری دڵخۆش": {"key": "home.happyCustomers", "en": "Happy Customers", "ar": "عملاء سعداء", "zh": "满意客户"},
    "ڕەزامەندی": {"key": "home.satisfaction", "en": "Satisfaction", "ar": "الرضا", "zh": "满意度"},
    
    # Services
    "خزمەتگوزاریەکانمان": {"key": "home.ourServices", "en": "Our Services", "ar": "خدماتنا", "zh": "我们的服务"},
    "خزمەتگوزاری تەواو بۆ گواستنەوەی بار لە چین و ئیمارات بۆ عێراق": {
        "key": "home.servicesDescription",
        "en": "Complete cargo shipping services from China and UAE to Iraq",
        "ar": "خدمات شحن البضائع الكاملة من الصين والإمارات إلى العراق",
        "zh": "从中国和阿联酋到伊拉克的完整货运服务"
    },
    "گواستنەوەی ئاسمانی": {"key": "home.airShipping", "en": "Air Shipping", "ar": "الشحن الجوي", "zh": "空运"},
    "گواستنەوەی خێرا بە فڕۆکە بۆ بارە گرنگەکان": {
        "key": "home.airShippingDesc",
        "en": "Fast shipping by air for important cargo",
        "ar": "شحن سريع بالطائرة للبضائع المهمة",
        "zh": "重要货物的快速空运"
    },
    "گواستنەوەی دەریایی": {"key": "home.seaShipping", "en": "Sea Shipping", "ar": "الشحن البحري", "zh": "海运"},
    "گواستنەوەی ئابووری بۆ بارە قورسەکان": {
        "key": "home.seaShippingDesc",
        "en": "Economical shipping for heavy cargo",
        "ar": "شحن اقتصادي للبضائع الثقيلة",
        "zh": "重货的经济运输"
    },
    "کۆکردنەوەی بار": {"key": "home.consolidation", "en": "Cargo Consolidation", "ar": "تجميع البضائع", "zh": "货物整合"},
    "کۆکردنەوەی چەند بار لە یەک کۆنتەینەردا": {
        "key": "home.consolidationDesc",
        "en": "Consolidating multiple shipments in one container",
        "ar": "تجميع عدة شحنات في حاوية واحدة",
        "zh": "将多个货物整合到一个集装箱中"
    },
    "گەیاندنی ناوخۆیی": {"key": "home.domesticDelivery", "en": "Domestic Delivery", "ar": "التوصيل المحلي", "zh": "国内配送"},
    "گەیاندن بۆ هەموو شارەکانی عێراق": {
        "key": "home.domesticDeliveryDesc",
        "en": "Delivery to all cities in Iraq",
        "ar": "التوصيل لجميع مدن العراق",
        "zh": "送达伊拉克所有城市"
    },
    "بیمەی بار": {"key": "home.cargoInsurance", "en": "Cargo Insurance", "ar": "تأمين البضائع", "zh": "货物保险"},
    "پاراستنی بارەکانت لە هەر زیانێک": {
        "key": "home.cargoInsuranceDesc",
        "en": "Protect your cargo from any damage",
        "ar": "حماية بضائعك من أي ضرر",
        "zh": "保护您的货物免受任何损坏"
    },
    "پشتگیری ٢٤/٧": {"key": "home.support247", "en": "24/7 Support", "ar": "دعم على مدار الساعة", "zh": "全天候支持"},
    "تیمی پشتگیری ئامادەیە بۆ یارمەتیدان": {
        "key": "home.support247Desc",
        "en": "Support team ready to help",
        "ar": "فريق الدعم جاهز للمساعدة",
        "zh": "支持团队随时准备提供帮助"
    },
    
    # Features
    "بۆچی وازن ئێکسپرێس؟": {"key": "home.whyWazn", "en": "Why Wazn Express?", "ar": "لماذا وازن إكسبريس؟", "zh": "为什么选择Wazn Express？"},
    "تایبەتمەندیەکانی سیستەمی بەڕێوەبردنی گواستنەوە": {
        "key": "home.featuresDescription",
        "en": "Features of our shipping management system",
        "ar": "مميزات نظام إدارة الشحن لدينا",
        "zh": "我们的运输管理系统的特点"
    },
    "شوێنکەوتنی ڕاستەوخۆ": {"key": "home.liveTracking", "en": "Live Tracking", "ar": "التتبع المباشر", "zh": "实时追踪"},
    "شوێنکەوتنی بارەکانت لە هەموو قۆناغەکاندا بە QR کۆد": {
        "key": "home.liveTrackingDesc",
        "en": "Track your packages at all stages with QR code",
        "ar": "تتبع شحناتك في جميع المراحل برمز QR",
        "zh": "通过QR码在所有阶段追踪您的包裹"
    },
    "ژمێریاری ئۆتۆماتیکی": {"key": "home.autoAccounting", "en": "Automatic Accounting", "ar": "المحاسبة الآلية", "zh": "自动记账"},
    "سیستەمی ژمێریاری تەواو بە چەند دراوێک": {
        "key": "home.autoAccountingDesc",
        "en": "Complete accounting system with multiple currencies",
        "ar": "نظام محاسبة كامل بعدة عملات",
        "zh": "支持多种货币的完整会计系统"
    },
    "کاتی گەیاندن دیاریکراو": {"key": "home.estimatedDelivery", "en": "Estimated Delivery Time", "ar": "وقت التسليم المتوقع", "zh": "预计送达时间"},
    "خەمڵاندنی کاتی گەیاندن بە وردی": {
        "key": "home.estimatedDeliveryDesc",
        "en": "Accurate delivery time estimation",
        "ar": "تقدير دقيق لوقت التسليم",
        "zh": "准确的送达时间估算"
    },
    "نرخی کڕیاری VIP": {"key": "home.vipPricing", "en": "VIP Customer Pricing", "ar": "أسعار عملاء VIP", "zh": "VIP客户定价"},
    "داشکاندنی تایبەت بۆ کڕیارە باوەکان": {
        "key": "home.vipPricingDesc",
        "en": "Special discounts for regular customers",
        "ar": "خصومات خاصة للعملاء المنتظمين",
        "zh": "常客专属折扣"
    },
    "پاراستنی زانیاری": {"key": "home.dataProtection", "en": "Data Protection", "ar": "حماية البيانات", "zh": "数据保护"},
    "پاراستنی زانیاریەکانت بە ئاستی بەرز": {
        "key": "home.dataProtectionDesc",
        "en": "High-level protection for your data",
        "ar": "حماية عالية المستوى لبياناتك",
        "zh": "高级别数据保护"
    },
    "سکانەری خێرا": {"key": "home.fastScanner", "en": "Fast Scanner", "ar": "الماسح السريع", "zh": "快速扫描"},
    "سکانکردنی بارەکان بە خێرایی و وردی": {
        "key": "home.fastScannerDesc",
        "en": "Fast and accurate package scanning",
        "ar": "مسح سريع ودقيق للشحنات",
        "zh": "快速准确的包裹扫描"
    },
    
    # CTA
    "ئامادەیت بۆ ناردنی بارەکانت؟": {"key": "home.readyToShip", "en": "Ready to Ship Your Cargo?", "ar": "هل أنت مستعد لشحن بضائعك؟", "zh": "准备好运送您的货物了吗？"},
    "ئێستا تۆمارببە و سوودی خزمەتگوزاریەکانمان وەربگرە": {
        "key": "home.ctaDescription",
        "en": "Register now and benefit from our services",
        "ar": "سجل الآن واستفد من خدماتنا",
        "zh": "立即注册并享受我们的服务"
    },
    "دەستپێبکە": {"key": "home.getStarted", "en": "Get Started", "ar": "ابدأ الآن", "zh": "开始使用"},
    "پەیوەندیمان پێوەبکە": {"key": "home.contactUs", "en": "Contact Us", "ar": "اتصل بنا", "zh": "联系我们"},
    
    # Footer
    "بەستەرە خێراکان": {"key": "home.quickLinks", "en": "Quick Links", "ar": "روابط سريعة", "zh": "快速链接"},
    "کۆمپانیای گواستنەوەی نێودەوڵەتی وازن ئێکسپرێس، خزمەتگوزاری گواستنەوەی بار لە چین و ئیمارات بۆ عێراق بە باشترین کوالیتی و نرخ.": {
        "key": "home.footerDescription",
        "en": "Wazn Express international shipping company, cargo shipping services from China and UAE to Iraq with the best quality and prices.",
        "ar": "شركة وازن إكسبريس للشحن الدولي، خدمات شحن البضائع من الصين والإمارات إلى العراق بأفضل جودة وأسعار.",
        "zh": "Wazn Express国际运输公司，提供从中国和阿联酋到伊拉克的货运服务，质量最佳，价格最优。"
    },
    "هەولێر، عێراق": {"key": "home.erbilIraq", "en": "Erbil, Iraq", "ar": "أربيل، العراق", "zh": "伊拉克埃尔比勒"},
    "هەموو مافەکان پارێزراون.": {"key": "home.allRightsReserved", "en": "All rights reserved.", "ar": "جميع الحقوق محفوظة.", "zh": "版权所有。"},
    "مەرجەکان": {"key": "home.terms", "en": "Terms", "ar": "الشروط", "zh": "条款"},
    "تایبەتمەندی": {"key": "home.privacy", "en": "Privacy", "ar": "الخصوصية", "zh": "隐私"},
}

def update_locale_files():
    """Update all locale files with home page translations"""
    locales_dir = Path("/home/ubuntu/wazn-express/client/src/locales")
    
    for lang in ['en', 'ku', 'ar', 'zh']:
        file_path = locales_dir / f"{lang}.json"
        
        # Read existing
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Add home section if not exists
        if 'home' not in data:
            data['home'] = {}
        
        # Add translations
        for kurdish_text, trans_data in HOME_TRANSLATIONS.items():
            key = trans_data['key']
            parts = key.split('.')
            
            if lang == 'ku':
                value = kurdish_text
            else:
                value = trans_data.get(lang, kurdish_text)
            
            # Navigate to correct location
            if parts[0] == 'home':
                if parts[1] not in data['home']:
                    data['home'][parts[1]] = value
        
        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        
        print(f"Updated {lang}.json with home translations")

def update_home_tsx():
    """Update Home.tsx with t() function calls"""
    file_path = Path("/home/ubuntu/wazn-express/client/src/pages/Home.tsx")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replacements for Home.tsx
    replacements = [
        # Navigation
        ('خزمەتگوزاریەکان</a>', '{t("home.services")}</a>'),
        ('تایبەتمەندیەکان</a>', '{t("home.features")}</a>'),
        ('پەیوەندی</a>', '{t("home.contact")}</a>'),
        ('>پۆرتاڵی کڕیار</span>', '>{t("home.customerPortal")}</span>'),
        ('>پۆرتاڵی کڕیار</Button>', '>{t("home.customerPortal")}</Button>'),
        ('>چوونەژوورەوەی ستاف</Button>', '>{t("home.staffLogin")}</Button>'),
        ('چوونەژوورەوەی ستاف\n                  <ArrowRight', '{t("home.staffLogin")}\n                  <ArrowRight'),
        
        # Hero
        ('>گواستنەوەی خێرا و متمانەپێکراو<', '>{t("home.fastReliable")}<'),
        ('>گواستنەوەی نێودەوڵەتی<', '>{t("home.internationalShipping")}<'),
        ('>لە چین بۆ عێراق<', '>{t("home.chinaToIraq")}<'),
        ('خزمەتگوزاری گواستنەوەی بار بە ئاسمان و دەریا لەگەڵ شوێنکەوتنی ڕاستەوخۆ، \n                ژمێریاری ئۆتۆماتیکی، و پسوڵەی پرۆفیشناڵ', '{t("home.heroDescription")}'),
        ('>شوێنکەوتنی خێرای بار<', '>{t("home.quickTrack")}<'),
        ('placeholder="ژمارەی شوێنکەوتن..."', 'placeholder={t("home.trackingPlaceholder")}'),
        
        # Tracking Card
        ('>شوێنکەوتنی بار<', '>{t("home.packageTracking")}<'),
        ('>ڕاستەوخۆ و دڵنیا<', '>{t("home.liveReliable")}<'),
        ('title="وەرگیرا لە چین"', 'title={t("home.receivedChina")}'),
        ('title="لە ڕێگادایە"', 'title={t("home.onTheWay")}'),
        ('title="گەیشتە عێراق"', 'title={t("home.arrivedIraq")}'),
        ('title="گەیاندن"', 'title={t("home.delivery")}'),
        ('date="چاوەڕوانکراو"', 'date={t("home.expected")}'),
        ('>ڕێژەی گەیاندن<', '>{t("home.deliveryRate")}<'),
        ('>پشتگیری<', '>{t("home.support")}<'),
        
        # Stats
        ('label="بار گەیەندراوە"', 'label={t("home.packagesDelivered")}'),
        ('label="وڵات"', 'label={t("home.countries")}'),
        ('label="کڕیاری دڵخۆش"', 'label={t("home.happyCustomers")}'),
        ('label="ڕەزامەندی"', 'label={t("home.satisfaction")}'),
        
        # Services Section
        ('>خزمەتگوزاریەکانمان<', '>{t("home.ourServices")}<'),
        ('>خزمەتگوزاری تەواو بۆ گواستنەوەی بار لە چین و ئیمارات بۆ عێراق<', '>{t("home.servicesDescription")}<'),
        ('title="گواستنەوەی ئاسمانی"', 'title={t("home.airShipping")}'),
        ('description="گواستنەوەی خێرا بە فڕۆکە بۆ بارە گرنگەکان"', 'description={t("home.airShippingDesc")}'),
        ('title="گواستنەوەی دەریایی"', 'title={t("home.seaShipping")}'),
        ('description="گواستنەوەی ئابووری بۆ بارە قورسەکان"', 'description={t("home.seaShippingDesc")}'),
        ('title="کۆکردنەوەی بار"', 'title={t("home.consolidation")}'),
        ('description="کۆکردنەوەی چەند بار لە یەک کۆنتەینەردا"', 'description={t("home.consolidationDesc")}'),
        ('title="گەیاندنی ناوخۆیی"', 'title={t("home.domesticDelivery")}'),
        ('description="گەیاندن بۆ هەموو شارەکانی عێراق"', 'description={t("home.domesticDeliveryDesc")}'),
        ('title="بیمەی بار"', 'title={t("home.cargoInsurance")}'),
        ('description="پاراستنی بارەکانت لە هەر زیانێک"', 'description={t("home.cargoInsuranceDesc")}'),
        ('title="پشتگیری ٢٤/٧"', 'title={t("home.support247")}'),
        ('description="تیمی پشتگیری ئامادەیە بۆ یارمەتیدان"', 'description={t("home.support247Desc")}'),
        
        # Features Section
        ('>بۆچی وازن ئێکسپرێس؟<', '>{t("home.whyWazn")}<'),
        ('>تایبەتمەندیەکانی سیستەمی بەڕێوەبردنی گواستنەوە<', '>{t("home.featuresDescription")}<'),
        ('title="شوێنکەوتنی ڕاستەوخۆ"', 'title={t("home.liveTracking")}'),
        ('description="شوێنکەوتنی بارەکانت لە هەموو قۆناغەکاندا بە QR کۆد"', 'description={t("home.liveTrackingDesc")}'),
        ('title="ژمێریاری ئۆتۆماتیکی"', 'title={t("home.autoAccounting")}'),
        ('description="سیستەمی ژمێریاری تەواو بە چەند دراوێک"', 'description={t("home.autoAccountingDesc")}'),
        ('title="کاتی گەیاندن دیاریکراو"', 'title={t("home.estimatedDelivery")}'),
        ('description="خەمڵاندنی کاتی گەیاندن بە وردی"', 'description={t("home.estimatedDeliveryDesc")}'),
        ('title="نرخی کڕیاری VIP"', 'title={t("home.vipPricing")}'),
        ('description="داشکاندنی تایبەت بۆ کڕیارە باوەکان"', 'description={t("home.vipPricingDesc")}'),
        ('title="پاراستنی زانیاری"', 'title={t("home.dataProtection")}'),
        ('description="پاراستنی زانیاریەکانت بە ئاستی بەرز"', 'description={t("home.dataProtectionDesc")}'),
        ('title="سکانەری خێرا"', 'title={t("home.fastScanner")}'),
        ('description="سکانکردنی بارەکان بە خێرایی و وردی"', 'description={t("home.fastScannerDesc")}'),
        
        # CTA
        ('>ئامادەیت بۆ ناردنی بارەکانت؟<', '>{t("home.readyToShip")}<'),
        ('>ئێستا تۆمارببە و سوودی خزمەتگوزاریەکانمان وەربگرە<', '>{t("home.ctaDescription")}<'),
        ('>دەستپێبکە<', '>{t("home.getStarted")}<'),
        ('>پەیوەندیمان پێوەبکە<', '>{t("home.contactUs")}<'),
        
        # Footer
        ('>بەستەرە خێراکان<', '>{t("home.quickLinks")}<'),
        ('> خزمەتگوزاریەکان</a>', '> {t("home.services")}</a>'),
        ('> تایبەتمەندیەکان</a>', '> {t("home.features")}</a>'),
        ('> پۆرتاڵی کڕیار</Link>', '> {t("home.customerPortal")}</Link>'),
        ('>پەیوەندی<', '>{t("home.contact")}<'),
        ('>هەولێر، عێراق<', '>{t("home.erbilIraq")}<'),
        ('هەموو مافەکان پارێزراون.', '{t("home.allRightsReserved")}'),
        ('>مەرجەکان<', '>{t("home.terms")}<'),
        ('>تایبەتمەندی<', '>{t("home.privacy")}<'),
    ]
    
    for old, new in replacements:
        content = content.replace(old, new)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Updated Home.tsx with t() function calls")

if __name__ == "__main__":
    print("Updating locale files...")
    update_locale_files()
    
    print("\nUpdating Home.tsx...")
    update_home_tsx()
    
    print("\nDone!")
