/**
 * Watching a shipment's flight into Erbil.
 *
 * The office fills in the flight number when the batch is made, and then
 * somebody has to remember to go and look at the airport's website every day
 * to find out whether it has landed. Nobody remembers on the right day, so the
 * first anyone knows is a phone call.
 *
 * The airport publishes arrivals — including the cargo flights — on a public
 * page, updated every five minutes. That is the signal. This decides when to
 * look, what a match means, and what happens after one.
 *
 * What it deliberately does not decide is whether the goods are ready. A
 * landed plane is the beginning of the process, not the end: customs starts
 * the following morning and can take days, and after that the boxes still have
 * to reach the depot and be sorted. Everything sent to a customer at this
 * point has to say that, or the office spends the next three days answering
 * "where is my parcel".
 */

/** Nothing is checked in the first days — a China–Erbil batch is never there yet. */
export const WATCH_AFTER_DAYS = 4;

/** After this many days with no sighting, stop looking and tell the office. */
export const GIVE_UP_AFTER_DAYS = 45;

/** The hour, local time, at which customs is considered to have started. */
export const CUSTOMS_STARTS_HOUR = 8;

const DAY = 24 * 60 * 60 * 1000;

export interface WatchableBatch {
  id: number;
  status?: string | null;
  shippingType?: string | null;
  flightNumber?: string | null;
  createdAt?: Date | string | null;
  /** When the flight was seen to land. Set once, never re-checked after. */
  flightArrivedAt?: Date | string | null;
}

function time(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Air shipments only — a container does not appear on an arrivals board. */
export function isAirBatch(shippingType?: string | null): boolean {
  return shippingType === "air_regular" || shippingType === "air_irregular";
}

/**
 * A flight number as the airport writes it, and as we might.
 *
 * The office types "TK6894"; the board says "TK 6894". Compared with the
 * spaces and case taken out, so neither side has to be careful.
 */
export function normaliseFlightNumber(value?: string | null): string {
  return String(value ?? "").replace(/[\s\-]/g, "").toUpperCase();
}

export type SkipReason =
  | "not-air"
  | "no-flight-number"
  | "too-early"
  | "already-arrived"
  | "finished"
  | "gave-up";

export interface WatchDecision {
  watch: boolean;
  reason?: SkipReason;
  /** Days since the batch was created, for the office to see. */
  ageDays: number;
}

/**
 * Should this batch's flight be looked up right now?
 *
 * Counted from when the batch was created, which is the moment the office
 * decided this shipment exists — the same clock the reminder colours use, so
 * one shipment is never four days old on one screen and six on another.
 */
export function watchDecision(batch: WatchableBatch, now: Date): WatchDecision {
  const created = time(batch.createdAt);
  const ageDays = created === null ? 0 : Math.floor((now.getTime() - created) / DAY);

  if (batch.status === "delivered" || batch.status === "closed") {
    return { watch: false, reason: "finished", ageDays };
  }
  if (batch.flightArrivedAt) return { watch: false, reason: "already-arrived", ageDays };
  if (!isAirBatch(batch.shippingType)) return { watch: false, reason: "not-air", ageDays };
  if (!normaliseFlightNumber(batch.flightNumber)) {
    return { watch: false, reason: "no-flight-number", ageDays };
  }
  if (ageDays < WATCH_AFTER_DAYS) return { watch: false, reason: "too-early", ageDays };
  if (ageDays > GIVE_UP_AFTER_DAYS) return { watch: false, reason: "gave-up", ageDays };

  return { watch: true, ageDays };
}

/** One row off the arrivals board. */
export interface FlightRow {
  flight: string;
  status: string;
  scheduled?: string;
  estimated?: string;
  from?: string;
  airline?: string;
}

/** The board's word for "it is on the ground". */
export function hasLanded(status?: string | null): boolean {
  const s = String(status ?? "").trim().toUpperCase();
  return s === "ARRIVED" || s === "LANDED";
}

/**
 * The row for this batch's flight, if the board is showing it as landed.
 *
 * A flight that is merely SCHEDULED is not an answer — it is the same answer
 * as yesterday. Only a landing is news.
 */
export function findLanded(rows: FlightRow[], flightNumber?: string | null): FlightRow | null {
  const wanted = normaliseFlightNumber(flightNumber);
  if (!wanted) return null;
  for (const row of rows) {
    if (normaliseFlightNumber(row.flight) === wanted && hasLanded(row.status)) return row;
  }
  return null;
}

/**
 * Has the morning after the landing come?
 *
 * The plane lands and customs opens the next day — so a batch that landed at
 * eleven at night should not be sitting in "customs" at half past eleven. It
 * moves at eight the following morning, which is when the work actually
 * starts.
 */
export function customsShouldStart(flightArrivedAt: Date | string | null | undefined, now: Date): boolean {
  const arrived = time(flightArrivedAt);
  if (arrived === null) return false;

  const landed = new Date(arrived);
  const nextMorning = new Date(landed.getFullYear(), landed.getMonth(), landed.getDate() + 1, CUSTOMS_STARTS_HOUR, 0, 0, 0);
  return now.getTime() >= nextMorning.getTime();
}

/* ─── what everybody is told ────────────────────────────────────────────── */

export interface Localised {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

/** The customer's message. Every line of it is doing a job. */
export const ARRIVED_TITLE: Localised = {
  ku: "بارەکەت گەیشتە عێراق",
  en: "Your shipment has reached Iraq",
  ar: "وصلت شحنتك إلى العراق",
  zh: "您的货物已抵达伊拉克",
};

/**
 * Said in this order on purpose: what happened, then that it is not ready,
 * then that nobody needs to ring us. Leave out the middle line and the office
 * spends three days on the phone explaining customs.
 */
export function arrivedMessage(batchCode: string, parcelCount: number): Localised {
  const parcels = (ku: string, en: string, ar: string, zh: string) => ({ ku, en, ar, zh });
  const p = parcels(
    `${parcelCount} پاکێتی تۆ لەم بارەدان`,
    `${parcelCount} of your parcels are in this shipment`,
    `${parcelCount} من طرودك في هذه الشحنة`,
    `本批次中有您的 ${parcelCount} 件包裹`,
  );
  return {
    ku: `فڕۆکەی ئەو بارەی تۆی تێدایە گەیشتە فڕۆکەخانەی هەولێر. هێشتا ئامادە نییە بۆ وەرگرتن — پرۆسەی گومرگ بەیانی دەستپێدەکات و لەوانەیە چەند ڕۆژێک بخایەنێت، دواتر بارەکان دەگەنە مەخزەنی ئێمە لە هەولێر و پێویستی بە ڕۆژێک هەیە بۆ جیاکردنەوە. کاتێک ئامادە بوو دووبارە ئاگادارت دەکەینەوە — پێویست ناکات پەیوەندیمان پێوە بکەیت. ${p.ku} · ${batchCode}`,
    en: `The flight carrying your goods has landed at Erbil airport. It is not ready for collection yet — customs clearance begins tomorrow and can take a few days, after which the goods reach our Erbil depot and need a day to be sorted. We will tell you again when yours is ready; there is no need to contact us. ${p.en} · ${batchCode}`,
    ar: `هبطت الطائرة التي تحمل بضاعتك في مطار أربيل. لم تصبح جاهزة للاستلام بعد — يبدأ التخليص الجمركي غداً وقد يستغرق عدة أيام، ثم تصل البضائع إلى مستودعنا في أربيل وتحتاج يوماً للفرز. سنُعلمك مجدداً عندما تصبح جاهزة، ولا داعي للاتصال بنا. ${p.ar} · ${batchCode}`,
    zh: `载有您货物的航班已降落埃尔比勒机场。目前尚不可提取——清关明天开始，可能需要几天，之后货物运抵我们埃尔比勒仓库，还需一天分拣。备妥后我们会再次通知您，无需联系我们。${p.zh} · ${batchCode}`,
  };
}

/**
 * Why this batch is not being watched, in a few words on the batch itself.
 *
 * The decision to skip was already being made and thrown away, so a shipment
 * nobody was checking looked exactly like one being checked every six hours.
 * Two of these reasons are ordinary — a sea batch is never on an arrivals
 * board, and a four-day-old batch is not there yet. Two of them mean somebody
 * has to do something, and those are the ones that were silent.
 */
export function watchExplain(decision: WatchDecision): { text: Localised; needsAction: boolean } {
  const days = decision.ageDays;

  if (decision.watch) {
    return {
      needsAction: false,
      text: {
        ku: "چاودێری دەکرێت",
        en: "Being watched",
        ar: "قيد المتابعة",
        zh: "监控中",
      },
    };
  }

  switch (decision.reason) {
    case "no-flight-number":
      return {
        needsAction: true,
        text: {
          ku: "ژمارەی فڕین نییە — چاودێری ناکرێت",
          en: "No flight number — not being watched",
          ar: "لا يوجد رقم رحلة — لا تتم المتابعة",
          zh: "无航班号 — 未监控",
        },
      };
    case "gave-up":
      return {
        needsAction: true,
        text: {
          ku: `${days} ڕۆژ بەبێ نیشانە — وازی لێهێنرا`,
          en: `${days} days with no sighting — gave up`,
          ar: `${days} يوماً دون أي أثر — توقفت المتابعة`,
          zh: `${days} 天未见踪迹 — 已停止监控`,
        },
      };
    case "not-air":
      return {
        needsAction: false,
        text: {
          ku: "دەریایی — بە دەست چێک دەکرێت",
          en: "Sea — checked by hand",
          ar: "بحري — تتم المتابعة يدوياً",
          zh: "海运 — 人工查询",
        },
      };
    case "too-early":
      return {
        needsAction: false,
        text: {
          ku: `هێشتا زووە (${days} ڕۆژ)`,
          en: `Too early (${days} days)`,
          ar: `ما زال مبكراً (${days} أيام)`,
          zh: `尚早（${days} 天）`,
        },
      };
    case "already-arrived":
      return {
        needsAction: false,
        text: {
          ku: "گەیشتووە",
          en: "Landed",
          ar: "وصلت",
          zh: "已抵达",
        },
      };
    default:
      return {
        needsAction: false,
        text: {
          ku: "تەواو بووە",
          en: "Finished",
          ar: "منتهية",
          zh: "已完成",
        },
      };
  }
}

/** The office's alert. Short, because it is one line in a list of alerts. */
export function adminAlertTitle(batchCode: string, flight: string): Localised {
  return {
    ku: `فڕۆکەی باچی ${batchCode} نیشتەوە — ${flight}`,
    en: `Flight for batch ${batchCode} has landed — ${flight}`,
    ar: `هبطت رحلة الدفعة ${batchCode} — ${flight}`,
    zh: `批次 ${batchCode} 的航班已降落 — ${flight}`,
  };
}

/**
 * Said when the watcher has read nothing for days.
 *
 * The airport's page is HTML, not an interface anybody promised us. If they
 * change it, the parser returns nothing and every batch looks like it has not
 * landed — which is the same as the watcher having been switched off, except
 * that nobody knows. So silence is reported as a fault, not as an answer.
 */
export const WATCHER_BROKEN: Localised = {
  ku: "چاودێری فڕۆکەکان هیچ زانیارییەکی نەخوێندووەتەوە لە چەند ڕۆژێکەوە — لەوانەیە سایتی فڕۆکەخانە گۆڕابێت. بە دەستی بپشکنە.",
  en: "The flight watcher has read nothing for several days — the airport site may have changed. Check flights manually.",
  ar: "لم يقرأ مراقب الرحلات أي بيانات منذ عدة أيام — قد يكون موقع المطار قد تغيّر. تحقق يدوياً.",
  zh: "航班监视器已连续数天未读取到任何数据——机场网站可能已更改。请手动核查。",
};
