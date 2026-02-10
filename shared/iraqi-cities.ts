// Iraqi cities organized by governorate
export const IRAQI_GOVERNORATES = [
  { id: "baghdad", nameEn: "Baghdad", nameAr: "بغداد", nameKu: "بەغدا" },
  { id: "erbil", nameEn: "Erbil", nameAr: "أربيل", nameKu: "هەولێر" },
  { id: "sulaymaniyah", nameEn: "Sulaymaniyah", nameAr: "السليمانية", nameKu: "سلێمانی" },
  { id: "duhok", nameEn: "Duhok", nameAr: "دهوك", nameKu: "دهۆک" },
  { id: "halabja", nameEn: "Halabja", nameAr: "حلبجة", nameKu: "هەڵەبجە" },
  { id: "kirkuk", nameEn: "Kirkuk", nameAr: "كركوك", nameKu: "کەرکووک" },
  { id: "nineveh", nameEn: "Nineveh", nameAr: "نينوى", nameKu: "نەینەوا" },
  { id: "basra", nameEn: "Basra", nameAr: "البصرة", nameKu: "بەسرە" },
  { id: "najaf", nameEn: "Najaf", nameAr: "النجف", nameKu: "نەجەف" },
  { id: "karbala", nameEn: "Karbala", nameAr: "كربلاء", nameKu: "کەربەلا" },
  { id: "diyala", nameEn: "Diyala", nameAr: "ديالى", nameKu: "دیالە" },
  { id: "anbar", nameEn: "Anbar", nameAr: "الأنبار", nameKu: "ئەنبار" },
  { id: "wasit", nameEn: "Wasit", nameAr: "واسط", nameKu: "واسط" },
  { id: "maysan", nameEn: "Maysan", nameAr: "ميسان", nameKu: "مەیسان" },
  { id: "dhi_qar", nameEn: "Dhi Qar", nameAr: "ذي قار", nameKu: "زیقار" },
  { id: "muthanna", nameEn: "Muthanna", nameAr: "المثنى", nameKu: "موسەننا" },
  { id: "qadisiyyah", nameEn: "Qadisiyyah", nameAr: "القادسية", nameKu: "قادسیە" },
  { id: "babylon", nameEn: "Babylon", nameAr: "بابل", nameKu: "بابل" },
  { id: "saladin", nameEn: "Saladin", nameAr: "صلاح الدين", nameKu: "سەلاحەدین" },
] as const;

export const IRAQI_CITIES = [
  // Baghdad
  { governorateId: "baghdad", nameEn: "Baghdad", nameAr: "بغداد", nameKu: "بەغدا" },
  { governorateId: "baghdad", nameEn: "Kadhimiya", nameAr: "الكاظمية", nameKu: "کازمیە" },
  { governorateId: "baghdad", nameEn: "Sadr City", nameAr: "مدينة الصدر", nameKu: "شاری سەدر" },
  { governorateId: "baghdad", nameEn: "Adhamiyah", nameAr: "الأعظمية", nameKu: "ئەعزەمیە" },
  { governorateId: "baghdad", nameEn: "Karrada", nameAr: "الكرادة", nameKu: "کەڕادە" },
  { governorateId: "baghdad", nameEn: "Mansour", nameAr: "المنصور", nameKu: "مەنسوور" },
  
  // Erbil
  { governorateId: "erbil", nameEn: "Erbil City", nameAr: "أربيل", nameKu: "شاری هەولێر" },
  { governorateId: "erbil", nameEn: "Ankawa", nameAr: "عنكاوا", nameKu: "عەنکاوە" },
  { governorateId: "erbil", nameEn: "Soran", nameAr: "سوران", nameKu: "سۆران" },
  { governorateId: "erbil", nameEn: "Shaqlawa", nameAr: "شقلاوة", nameKu: "شەقڵاوە" },
  { governorateId: "erbil", nameEn: "Koya", nameAr: "كويسنجق", nameKu: "کۆیە" },
  { governorateId: "erbil", nameEn: "Rawanduz", nameAr: "راوندوز", nameKu: "ڕەواندز" },
  { governorateId: "erbil", nameEn: "Mergasor", nameAr: "ميركه سور", nameKu: "مێرگەسۆر" },
  { governorateId: "erbil", nameEn: "Choman", nameAr: "جومان", nameKu: "چۆمان" },
  { governorateId: "erbil", nameEn: "Makhmur", nameAr: "مخمور", nameKu: "مەخموور" },
  
  // Sulaymaniyah
  { governorateId: "sulaymaniyah", nameEn: "Sulaymaniyah City", nameAr: "السليمانية", nameKu: "شاری سلێمانی" },
  { governorateId: "sulaymaniyah", nameEn: "Ranya", nameAr: "رانية", nameKu: "ڕانیە" },
  { governorateId: "sulaymaniyah", nameEn: "Qaladiza", nameAr: "قلعة دزة", nameKu: "قەڵادزێ" },
  { governorateId: "sulaymaniyah", nameEn: "Penjwin", nameAr: "بنجوين", nameKu: "پێنجوێن" },
  { governorateId: "sulaymaniyah", nameEn: "Chamchamal", nameAr: "جمجمال", nameKu: "چەمچەماڵ" },
  { governorateId: "sulaymaniyah", nameEn: "Darbandikhan", nameAr: "دربنديخان", nameKu: "دەربەندیخان" },
  { governorateId: "sulaymaniyah", nameEn: "Kalar", nameAr: "كلار", nameKu: "کەلار" },
  { governorateId: "sulaymaniyah", nameEn: "Kifri", nameAr: "كفري", nameKu: "کفری" },
  { governorateId: "sulaymaniyah", nameEn: "Dokan", nameAr: "دوكان", nameKu: "دووکان" },
  { governorateId: "sulaymaniyah", nameEn: "Said Sadiq", nameAr: "سيد صادق", nameKu: "سەیدسادق" },
  { governorateId: "sulaymaniyah", nameEn: "Bazian", nameAr: "بازيان", nameKu: "بازیان" },
  { governorateId: "sulaymaniyah", nameEn: "Sharbazher", nameAr: "شاربازير", nameKu: "شارباژێر" },
  
  // Duhok
  { governorateId: "duhok", nameEn: "Duhok City", nameAr: "دهوك", nameKu: "شاری دهۆک" },
  { governorateId: "duhok", nameEn: "Zakho", nameAr: "زاخو", nameKu: "زاخۆ" },
  { governorateId: "duhok", nameEn: "Amedi", nameAr: "العمادية", nameKu: "ئامێدی" },
  { governorateId: "duhok", nameEn: "Akre", nameAr: "عقرة", nameKu: "ئاکرێ" },
  { governorateId: "duhok", nameEn: "Bardarash", nameAr: "بردرش", nameKu: "بەردەڕەش" },
  { governorateId: "duhok", nameEn: "Semel", nameAr: "سيميل", nameKu: "سێمێل" },
  { governorateId: "duhok", nameEn: "Shekhan", nameAr: "شيخان", nameKu: "شێخان" },
  
  // Halabja
  { governorateId: "halabja", nameEn: "Halabja City", nameAr: "حلبجة", nameKu: "شاری هەڵەبجە" },
  { governorateId: "halabja", nameEn: "Khurmal", nameAr: "خورمال", nameKu: "خورماڵ" },
  { governorateId: "halabja", nameEn: "Sirwan", nameAr: "سيروان", nameKu: "سیروان" },
  
  // Kirkuk
  { governorateId: "kirkuk", nameEn: "Kirkuk City", nameAr: "كركوك", nameKu: "شاری کەرکووک" },
  { governorateId: "kirkuk", nameEn: "Hawija", nameAr: "الحويجة", nameKu: "حەویجە" },
  { governorateId: "kirkuk", nameEn: "Daquq", nameAr: "داقوق", nameKu: "داقووق" },
  { governorateId: "kirkuk", nameEn: "Dibis", nameAr: "دبس", nameKu: "دبس" },
  
  // Nineveh
  { governorateId: "nineveh", nameEn: "Mosul", nameAr: "الموصل", nameKu: "موسڵ" },
  { governorateId: "nineveh", nameEn: "Tal Afar", nameAr: "تلعفر", nameKu: "تەلعەفەر" },
  { governorateId: "nineveh", nameEn: "Sinjar", nameAr: "سنجار", nameKu: "شنگال" },
  { governorateId: "nineveh", nameEn: "Hamdaniya", nameAr: "الحمدانية", nameKu: "حەمدانیە" },
  { governorateId: "nineveh", nameEn: "Bashiqa", nameAr: "بعشيقة", nameKu: "باشیقا" },
  
  // Basra
  { governorateId: "basra", nameEn: "Basra City", nameAr: "البصرة", nameKu: "شاری بەسرە" },
  { governorateId: "basra", nameEn: "Zubair", nameAr: "الزبير", nameKu: "زوبەیر" },
  { governorateId: "basra", nameEn: "Abu Al-Khaseeb", nameAr: "أبو الخصيب", nameKu: "ئەبوولخەسیب" },
  { governorateId: "basra", nameEn: "Fao", nameAr: "الفاو", nameKu: "فاو" },
  
  // Najaf
  { governorateId: "najaf", nameEn: "Najaf City", nameAr: "النجف", nameKu: "شاری نەجەف" },
  { governorateId: "najaf", nameEn: "Kufa", nameAr: "الكوفة", nameKu: "کووفە" },
  { governorateId: "najaf", nameEn: "Manathira", nameAr: "المناذرة", nameKu: "مەنازرە" },
  
  // Karbala
  { governorateId: "karbala", nameEn: "Karbala City", nameAr: "كربلاء", nameKu: "شاری کەربەلا" },
  { governorateId: "karbala", nameEn: "Ain Al-Tamur", nameAr: "عين التمر", nameKu: "عەینوتەمر" },
  { governorateId: "karbala", nameEn: "Al-Hindiya", nameAr: "الهندية", nameKu: "هیندیە" },
  
  // Diyala
  { governorateId: "diyala", nameEn: "Baqubah", nameAr: "بعقوبة", nameKu: "بەعقووبە" },
  { governorateId: "diyala", nameEn: "Khanaqin", nameAr: "خانقين", nameKu: "خانەقین" },
  { governorateId: "diyala", nameEn: "Muqdadiya", nameAr: "المقدادية", nameKu: "موقدادیە" },
  { governorateId: "diyala", nameEn: "Mandali", nameAr: "مندلي", nameKu: "مەندەلی" },
  
  // Anbar
  { governorateId: "anbar", nameEn: "Ramadi", nameAr: "الرمادي", nameKu: "ڕەمادی" },
  { governorateId: "anbar", nameEn: "Fallujah", nameAr: "الفلوجة", nameKu: "فەلووجە" },
  { governorateId: "anbar", nameEn: "Hit", nameAr: "هيت", nameKu: "هیت" },
  { governorateId: "anbar", nameEn: "Haditha", nameAr: "حديثة", nameKu: "حەدیسە" },
  { governorateId: "anbar", nameEn: "Al-Qaim", nameAr: "القائم", nameKu: "قائم" },
  
  // Wasit
  { governorateId: "wasit", nameEn: "Kut", nameAr: "الكوت", nameKu: "کووت" },
  { governorateId: "wasit", nameEn: "Al-Suwaira", nameAr: "الصويرة", nameKu: "سوەیرە" },
  { governorateId: "wasit", nameEn: "Badra", nameAr: "بدرة", nameKu: "بەدرە" },
  
  // Maysan
  { governorateId: "maysan", nameEn: "Amarah", nameAr: "العمارة", nameKu: "عەمارە" },
  { governorateId: "maysan", nameEn: "Ali Al-Gharbi", nameAr: "علي الغربي", nameKu: "عەلی ئەلغەربی" },
  { governorateId: "maysan", nameEn: "Majar Al-Kabir", nameAr: "المجر الكبير", nameKu: "مەجەرکەبیر" },
  
  // Dhi Qar
  { governorateId: "dhi_qar", nameEn: "Nasiriyah", nameAr: "الناصرية", nameKu: "ناسریە" },
  { governorateId: "dhi_qar", nameEn: "Suq Al-Shuyukh", nameAr: "سوق الشيوخ", nameKu: "سووقەشیووخ" },
  { governorateId: "dhi_qar", nameEn: "Al-Rifai", nameAr: "الرفاعي", nameKu: "ڕیفاعی" },
  
  // Muthanna
  { governorateId: "muthanna", nameEn: "Samawah", nameAr: "السماوة", nameKu: "سەماوە" },
  { governorateId: "muthanna", nameEn: "Al-Rumaitha", nameAr: "الرميثة", nameKu: "ڕومەیسە" },
  { governorateId: "muthanna", nameEn: "Al-Khidr", nameAr: "الخضر", nameKu: "خەزر" },
  
  // Qadisiyyah
  { governorateId: "qadisiyyah", nameEn: "Diwaniyah", nameAr: "الديوانية", nameKu: "دیوانیە" },
  { governorateId: "qadisiyyah", nameEn: "Afak", nameAr: "عفك", nameKu: "عەفەک" },
  { governorateId: "qadisiyyah", nameEn: "Shamiya", nameAr: "الشامية", nameKu: "شامیە" },
  
  // Babylon
  { governorateId: "babylon", nameEn: "Hillah", nameAr: "الحلة", nameKu: "حیللە" },
  { governorateId: "babylon", nameEn: "Al-Musayyib", nameAr: "المسيب", nameKu: "موسەییب" },
  { governorateId: "babylon", nameEn: "Al-Mahawil", nameAr: "المحاويل", nameKu: "مەحاویل" },
  { governorateId: "babylon", nameEn: "Al-Hashimiya", nameAr: "الهاشمية", nameKu: "هاشمیە" },
  
  // Saladin
  { governorateId: "saladin", nameEn: "Tikrit", nameAr: "تكريت", nameKu: "تکریت" },
  { governorateId: "saladin", nameEn: "Samarra", nameAr: "سامراء", nameKu: "سامەڕا" },
  { governorateId: "saladin", nameEn: "Baiji", nameAr: "بيجي", nameKu: "بەیجی" },
  { governorateId: "saladin", nameEn: "Balad", nameAr: "بلد", nameKu: "بەلەد" },
  { governorateId: "saladin", nameEn: "Tuz Khurmatu", nameAr: "طوز خورماتو", nameKu: "تووزخورماتوو" },
] as const;

// Helper function to get cities by governorate
export function getCitiesByGovernorate(governorateId: string) {
  return IRAQI_CITIES.filter(city => city.governorateId === governorateId);
}

// Get all cities as flat list for dropdown
export function getAllCitiesForDropdown(language: 'en' | 'ar' | 'ku' = 'ku') {
  return IRAQI_CITIES.map(city => ({
    value: city.nameEn,
    label: language === 'ku' ? city.nameKu : language === 'ar' ? city.nameAr : city.nameEn,
    governorate: IRAQI_GOVERNORATES.find(g => g.id === city.governorateId),
  }));
}

// Get governorates for dropdown
export function getGovernoratesForDropdown(language: 'en' | 'ar' | 'ku' = 'ku') {
  return IRAQI_GOVERNORATES.map(gov => ({
    value: gov.id,
    label: language === 'ku' ? gov.nameKu : language === 'ar' ? gov.nameAr : gov.nameEn,
  }));
}
