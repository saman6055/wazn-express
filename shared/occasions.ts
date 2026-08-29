/**
 * The days worth saying something to a customer about.
 *
 * Deliberately not notifications. The channel that carries "your goods are in
 * Erbil, come and collect" and "your payment was received" is the one thing
 * in this system a customer must never learn to ignore, and a greeting a day
 * is how that happens. These live on a card in the portal instead: free to
 * show, pleasant to find, and costing nothing when nobody looks.
 *
 * Two kinds of date, and they behave differently.
 *
 * The Gregorian ones are fixed and computable — Newroz, Labour Day, the
 * solstices. The Hijri ones are not: Ramadan and both Eids are set in Iraq by
 * sighting the moon, not by arithmetic, and a calculated calendar can be a
 * day out either way. Wishing somebody Eid Mubarak a day early is worse than
 * saying nothing, so those dates are fetched rather than assumed.
 *
 * What is never fetched is the wording. Only dates come from outside; every
 * word a customer reads is in this file, in four languages, where it can be
 * reviewed before it reaches anybody.
 */

export type OccasionKey =
  | "birthday"
  | "newroz"
  | "womens_day"
  | "mothers_day"
  | "fathers_day"
  | "labour_day"
  | "eid_fitr"
  | "eid_adha"
  | "ramadan_start"
  | "hijri_new_year"
  | "mawlid"
  | "summer"
  | "autumn"
  | "winter";

export interface Greeting {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

export interface Occasion {
  key: OccasionKey;
  title: Greeting;
  message: Greeting;
  /**
   * Which customers it is for. Undefined means everybody.
   *
   * Gender is optional on a customer record and a guess is worse than
   * silence: somebody wished a happy Father's Day who is not a father, or a
   * woman missed on her own day — both land badly. Unset means the gendered
   * days simply do not fire.
   */
  gender?: "male" | "female";
  /**
   * Higher wins when two land on one day, which the 21st of March does three
   * times over: Newroz, Mother's Day and the first day of spring.
   */
  priority: number;
}

/** What the caller knows about the reader. */
export interface OccasionAudience {
  gender?: string | null;
  /** Month and day only. The year is nobody's business here. */
  birthMonth?: number | null;
  birthDay?: number | null;
}

/** Hijri dates for this year, resolved elsewhere and passed in. */
export interface HijriDates {
  ramadanStart?: Date | string | null;
  eidFitr?: Date | string | null;
  eidAdha?: Date | string | null;
  hijriNewYear?: Date | string | null;
  mawlid?: Date | string | null;
}

const G = (ku: string, en: string, ar: string, zh: string): Greeting => ({ ku, en, ar, zh });

/** Fixed days in the Gregorian year. */
const FIXED: Array<{ key: OccasionKey; month: number; day: number; occasion: Omit<Occasion, "key"> }> = [
  {
    key: "womens_day", month: 3, day: 8,
    occasion: {
      gender: "female", priority: 80,
      title: G("ڕۆژی جیهانی ئافرەتان پیرۆز بێت", "Happy International Women's Day", "يوم المرأة العالمي مبارك", "国际妇女节快乐"),
      message: G(
        "ڕۆژت پیرۆز بێت. بەهێزی و سەرکەوتنت بۆ دەخوازین.",
        "Wishing you strength and success, today and always.",
        "نتمنى لك القوة والنجاح دائمًا.",
        "祝你坚强、成功。",
      ),
    },
  },
  {
    key: "newroz", month: 3, day: 21,
    occasion: {
      priority: 100,
      title: G("نەورۆز و سەری ساڵی کوردی پیرۆز بێت", "Happy Newroz", "نوروز مبارك", "诺鲁孜节快乐"),
      message: G(
        "ساڵێکی نوێ، پڕ لە خێر و بەرەکەت و ئاشتی بۆ تۆ و خێزانت.",
        "A new year of good fortune, peace and health to you and your family.",
        "عام جديد مليء بالخير والسلام لك ولعائلتك.",
        "新的一年，愿你与家人平安喜乐。",
      ),
    },
  },
  {
    key: "mothers_day", month: 3, day: 21,
    occasion: {
      gender: "female", priority: 90,
      title: G("ڕۆژی دایک پیرۆز بێت", "Happy Mother's Day", "عيد الأم مبارك", "母亲节快乐"),
      message: G(
        "ڕۆژت پیرۆز بێت — سوپاس بۆ هەموو ئەو شتانەی دەیکەیت.",
        "Thank you for everything you do.",
        "شكرًا على كل ما تقدمينه.",
        "感谢你所做的一切。",
      ),
    },
  },
  {
    key: "labour_day", month: 5, day: 1,
    occasion: {
      priority: 70,
      title: G("ڕۆژی جیهانی کرێکاران پیرۆز بێت", "Happy Labour Day", "عيد العمال مبارك", "劳动节快乐"),
      message: G(
        "ماندووبوونت جێی ڕێزە. ڕۆژێکی خۆش بۆت دەخوازین.",
        "Your hard work deserves respect. Have a good day.",
        "جهدك يستحق التقدير. نتمنى لك يومًا سعيدًا.",
        "你的辛勤值得敬意，祝你有美好的一天。",
      ),
    },
  },
  {
    key: "summer", month: 6, day: 21,
    occasion: {
      priority: 20,
      title: G("یەکەم ڕۆژی هاوین", "First day of summer", "أول يوم في الصيف", "夏季第一天"),
      message: G("هاوینێکی خۆش و ساغ بۆت دەخوازین.", "Wishing you a good, healthy summer.", "نتمنى لك صيفًا طيبًا.", "祝你度过一个愉快的夏天。"),
    },
  },
  {
    key: "autumn", month: 9, day: 23,
    occasion: {
      priority: 20,
      title: G("یەکەم ڕۆژی پایز", "First day of autumn", "أول يوم في الخريف", "秋季第一天"),
      message: G("پایزێکی خۆش بۆت دەخوازین.", "Wishing you a good autumn.", "نتمنى لك خريفًا طيبًا.", "祝你秋日安好。"),
    },
  },
  {
    key: "winter", month: 12, day: 21,
    occasion: {
      priority: 20,
      title: G("یەکەم ڕۆژی زستان", "First day of winter", "أول يوم في الشتاء", "冬季第一天"),
      message: G("زستانێکی گەرم و ساغ بۆت دەخوازین.", "Wishing you a warm, healthy winter.", "نتمنى لك شتاءً دافئًا.", "祝你冬日温暖安康。"),
    },
  },
];

/** The moving days, once their dates are known. */
const HIJRI: Array<{ key: OccasionKey; field: keyof HijriDates; occasion: Omit<Occasion, "key"> }> = [
  {
    key: "ramadan_start", field: "ramadanStart",
    occasion: {
      priority: 95,
      title: G("مانگی ڕەمەزان پیرۆز بێت", "Ramadan Mubarak", "رمضان مبارك", "斋月吉庆"),
      message: G("مانگێکی پڕ لە خێر و ڕەحمەت بۆت دەخوازین.", "Wishing you a blessed month.", "نتمنى لك شهرًا مباركًا.", "愿你度过一个吉庆的月份。"),
    },
  },
  {
    key: "eid_fitr", field: "eidFitr",
    occasion: {
      priority: 110,
      title: G("جەژنی ڕەمەزان پیرۆز بێت", "Eid Mubarak", "عيد فطر مبارك", "开斋节快乐"),
      message: G("جەژنت پیرۆز بێت — بە خۆشی و ساغی بۆ تۆ و خێزانت.", "Eid Mubarak to you and your family.", "عيد مبارك لك ولعائلتك.", "祝你与家人节日快乐。"),
    },
  },
  {
    key: "eid_adha", field: "eidAdha",
    occasion: {
      priority: 110,
      title: G("جەژنی قوربان پیرۆز بێت", "Eid al-Adha Mubarak", "عيد أضحى مبارك", "宰牲节快乐"),
      message: G("جەژنت پیرۆز بێت — بە خۆشی و ساغی بۆ تۆ و خێزانت.", "Eid Mubarak to you and your family.", "عيد مبارك لك ولعائلتك.", "祝你与家人节日快乐。"),
    },
  },
  {
    key: "hijri_new_year", field: "hijriNewYear",
    occasion: {
      priority: 60,
      title: G("سەری ساڵی کۆچی پیرۆز بێت", "Happy Hijri New Year", "رأس السنة الهجرية مبارك", "伊斯兰新年快乐"),
      message: G("ساڵێکی پڕ لە خێر بۆت دەخوازین.", "Wishing you a blessed year.", "نتمنى لك عامًا مباركًا.", "愿你新年吉庆。"),
    },
  },
  {
    key: "mawlid", field: "mawlid",
    occasion: {
      priority: 75,
      title: G("لەدایکبوونی پێغەمبەر پیرۆز بێت", "Mawlid Mubarak", "المولد النبوي مبارك", "圣纪节吉庆"),
      message: G("ڕۆژێکی پیرۆز بۆت دەخوازین.", "Wishing you a blessed day.", "نتمنى لك يومًا مباركًا.", "愿你度过吉庆的一天。"),
    },
  },
];

const asDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Father's Day: the third Sunday of June. */
export function fathersDay(year: number): Date {
  const june = new Date(year, 5, 1);
  const firstSunday = 1 + ((7 - june.getDay()) % 7);
  return new Date(year, 5, firstSunday + 14);
}

/**
 * Everything worth saying to this reader today, most important first.
 *
 * A list rather than one answer, because the 21st of March carries three at
 * once and which of them matters depends on who is reading.
 */
export function occasionsFor(
  today: Date,
  audience: OccasionAudience = {},
  hijri: HijriDates = {},
): Occasion[] {
  const found: Occasion[] = [];
  const gender = audience.gender === "male" || audience.gender === "female" ? audience.gender : null;
  const wants = (o: Omit<Occasion, "key">) => !o.gender || o.gender === gender;

  for (const f of FIXED) {
    if (today.getMonth() + 1 === f.month && today.getDate() === f.day && wants(f.occasion)) {
      found.push({ key: f.key, ...f.occasion });
    }
  }

  if (gender === "male" && sameDay(today, fathersDay(today.getFullYear()))) {
    found.push({
      key: "fathers_day", gender: "male", priority: 85,
      title: G("ڕۆژی باوک پیرۆز بێت", "Happy Father's Day", "عيد الأب مبارك", "父亲节快乐"),
      message: G("ڕۆژت پیرۆز بێت — سوپاس بۆ هەموو ئەو شتانەی دەیکەیت.", "Thank you for everything you do.", "شكرًا على كل ما تقدمه.", "感谢你所做的一切。"),
    });
  }

  for (const h of HIJRI) {
    const when = asDate(hijri[h.field]);
    if (when && sameDay(today, when)) found.push({ key: h.key, ...h.occasion });
  }

  // The most personal of them, so it outranks everything else.
  if (audience.birthMonth === today.getMonth() + 1 && audience.birthDay === today.getDate()) {
    found.push({
      key: "birthday", priority: 120,
      title: G("ڕۆژی لەدایکبوونت پیرۆز بێت", "Happy birthday", "عيد ميلاد سعيد", "生日快乐"),
      message: G(
        "ساڵێکی پڕ لە خۆشی و ساغی و سەرکەوتن بۆت دەخوازین.",
        "Wishing you a year of health, happiness and success.",
        "نتمنى لك عامًا من الصحة والسعادة والنجاح.",
        "祝你健康、快乐、成功。",
      ),
    });
  }

  return found.sort((a, b) => b.priority - a.priority);
}
