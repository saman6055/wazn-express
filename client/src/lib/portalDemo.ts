/**
 * The portal, shown to somebody who has no account.
 *
 * The owner, 2026-10-09: «ئەو کەسەی کە ئەکاونتی نییە کاتێ پۆرتال دەکاتەوە
 * بتوانێ دیمۆیەکی تەواوی پۆرتال ببینێ، ڕێک وەکو خۆی، وەکو کەسێک کە ئەکاونتی
 * هەیە، بەڵام دیمۆ بێت - بۆ نیشاندانی هێزی پۆرتالەکە، وەکو بەشێک لە
 * مارکێتینگ».
 *
 * "Exactly as it is" means the real pages, not a slideshow of them. So the
 * demo is the portal itself, asked the same questions, and answered from a
 * recording instead of from the server.
 *
 * Why a recording, and why here in the browser:
 *
 * - Nothing of it exists in the database. A demo customer with parcels and a
 *   balance would be a customer in the books: in the debt reports, the cash
 *   reconciliation, the risk bell. The company's money is counted from those
 *   tables, and a row that is not true has no place in them.
 * - The answers are the server's own. They were taken from the real
 *   procedures against a seeded throwaway database (demo/portalDemoData.json
 *   says when), so every shape a page reads is the shape the server sends.
 * - A visitor needs no session, so there is no public door that hands one
 *   out, and nothing for a script to knock on.
 *
 * What a demo cannot do is change anything: every mutation is answered with
 * a sentence that says so and where to get a real account.
 */

/** Per tab, like a look: closing the tab ends the demo. */
export const PORTAL_DEMO_KEY = "wazn-portal-demo";

type Words = { ku: string; en: string; ar: string; zh: string };

export const PORTAL_DEMO_WORDS = {
  banner: {
    ku: "ئەمە دیمۆیە — داتاکان نموونەن، هی هیچ کڕیارێک نین",
    en: "This is a demo — the data is a sample, not anybody's account",
    ar: "هذا عرض تجريبي — البيانات نموذجية وليست لأي عميل",
    zh: "这是演示 — 数据为示例，不属于任何客户",
  },
  open: {
    ku: "دیمۆی پۆرتال ببینە",
    en: "See a demo of the portal",
    ar: "شاهد عرضاً للبوابة",
    zh: "查看门户演示",
  },
  openHint: {
    ku: "بێ حیساب — هەموو بەشەکان بە داتای نموونە",
    en: "No account needed — every section, with sample data",
    ar: "بدون حساب — كل الأقسام ببيانات نموذجية",
    zh: "无需账户 — 所有功能，示例数据",
  },
  wantAccount: {
    ku: "حیسابم دەوێت",
    en: "I want an account",
    ar: "أريد حساباً",
    zh: "我要开户",
  },
  signIn: { ku: "چوونەژوورەوە", en: "Sign in", ar: "تسجيل الدخول", zh: "登录" },
  refused: {
    ku: "ئەمە دیمۆیە، هیچ شتێک ناگۆڕدرێت. بۆ ئەنجامدانی ئەم کارە حیسابێکی ڕاستەقینە پێویستە: 1. دوگمەی «حیسابم دەوێت» لە سەرەوە دابگرە. 2. لە واتساپ ناوت بنێرە.",
    en: "This is a demo, so nothing is changed. To do this you need a real account: 1. Press «I want an account» at the top. 2. Send us your name on WhatsApp.",
    ar: "هذا عرض تجريبي ولا يتغير فيه شيء. لتنفيذ ذلك تحتاج حساباً حقيقياً: 1. اضغط «أريد حساباً» في الأعلى. 2. أرسل اسمك عبر واتساب.",
    zh: "这是演示，不会更改任何内容。要执行此操作需要真实账户：1. 点击顶部的「我要开户」。2. 通过 WhatsApp 发送您的姓名。",
  },
  askAccount: {
    ku: "سڵاو وەزن ئێکسپرێس، دیمۆی پۆرتالەکەم بینی و حیسابێکم دەوێت",
    en: "Hello Wazn Express, I saw the portal demo and would like an account",
    ar: "مرحباً وزن اكسبريس، شاهدت عرض البوابة وأريد حساباً",
    zh: "您好 Wazn Express，我看了门户演示，想开一个账户",
  },
} satisfies Record<string, Words>;

export function isPortalDemo(): boolean {
  try {
    return sessionStorage.getItem(PORTAL_DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

/** Into the demo: a full load, so nothing asked before it is left in a cache. */
export function enterPortalDemo(): void {
  try {
    sessionStorage.setItem(PORTAL_DEMO_KEY, "1");
  } catch {
    /* no storage, no demo: the portal will ask them to sign in */
  }
  window.location.href = "/portal";
}

export function forgetPortalDemo(): void {
  try {
    sessionStorage.removeItem(PORTAL_DEMO_KEY);
  } catch {
    /* nothing was kept */
  }
}

/** Out of the demo, to the door a real customer uses. */
export function leavePortalDemo(): void {
  forgetPortalDemo();
  window.location.href = "/customer-login";
}

/**
 * A demo link somebody was sent (`/portal?demo=1`, on a QR or a post) starts
 * the demo and is taken off the address bar. Called once, before the app
 * mounts.
 */
export function readPortalDemoLink(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") !== "1") return;
    sessionStorage.setItem(PORTAL_DEMO_KEY, "1");
    params.delete("demo");
    const rest = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
  } catch {
    /* no storage: the link opens the ordinary portal */
  }
}

// ─────────────────────────── answering ───────────────────────────

interface Recorded {
  /** The input the answer was recorded for, as its JSON text. */
  input: string;
  /** The server's own `{ json, meta }`. */
  data: unknown;
}
export interface PortalDemoData {
  capturedAt: string;
  calls: Record<string, Recorded[]>;
}

/**
 * Changes a real portal makes without the customer asking for anything -
 * marking a notification read, counting a page view. Answered with a quiet
 * yes: refusing them would put a red toast on a page nobody touched.
 */
export const DEMO_QUIET_MUTATIONS: readonly string[] = [
  "customerPortal.trackActivity",
  "customerPortal.markNotificationAsRead",
  "customerPortal.markAllNotificationsAsRead",
  "supportChat.markAsRead",
  "tutorials.recordEvent",
  "prohibited.markViewed",
  "auth.logout",
];

const DAY = 86_400_000;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * Moves every moment in an answer forward by the days since it was recorded,
 * so "arrived three days ago" is still three days ago next spring. Whole
 * days: the hour a parcel was weighed stays the hour it was weighed.
 */
export function shiftDates<T>(value: T, days: number): T {
  if (days === 0) return value;
  if (typeof value === "string") {
    if (!STAMP.test(value)) return value;
    const at = new Date(value).getTime();
    return (Number.isFinite(at) ? new Date(at + days * DAY).toISOString() : value) as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, days)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = shiftDates(v, days);
    return out as T;
  }
  return value;
}

/**
 * Questions about one thing - this parcel, that receipt, a number typed into
 * the search. Another thing's answer would be a lie that looks like a find:
 * every search would "find" the first parcel. For these only the same input
 * counts, and anything else gets the answer the server gives for something
 * that is not theirs (kept under `__miss__`), or nothing.
 */
export const DEMO_EXACT_ONLY: readonly string[] = [
  "customerPortal.searchPackage",
  "customerPortal.searchOrder",
  "customerPortal.searchTrackingExtra",
  "customerPortal.getPackageTimeline",
  "customerPortal.getReceiptData",
  "customerPortal.getMyBoxInvoice",
  "customerPortal.getMyBoxProof",
  "customerPortal.getMyBatchInvoice",
  "customerPortal.getMyPackagesInBatch",
];

const NOTHING = { json: null };

/** The recorded answer for this question: the same input, else the first one kept. */
export function recordedAnswer(data: PortalDemoData, path: string, input: string, now: Date): unknown | undefined {
  const kept = data.calls[path];
  if (!kept || kept.length === 0) return DEMO_EXACT_ONLY.includes(path) ? NOTHING : undefined;
  const same = kept.find((k) => k.input === input);
  const hit = same ?? (DEMO_EXACT_ONLY.includes(path) ? kept.find((k) => k.input === "__miss__") : kept.find((k) => k.input !== "__miss__"));
  if (!hit) return NOTHING;
  const days = Math.floor((now.getTime() - new Date(data.capturedAt).getTime()) / DAY);
  return shiftDates(hit.data, Number.isFinite(days) && days > 0 ? days : 0);
}

function language(): keyof Words {
  try {
    const stored = localStorage.getItem("wazn-express-language");
    if (stored === "en" || stored === "ar" || stored === "zh" || stored === "ku") return stored;
  } catch {
    /* default below */
  }
  return "ku";
}

const answered = (data: unknown) => ({ result: { data } });
const refused = (path: string) => ({
  error: {
    json: {
      message: PORTAL_DEMO_WORDS.refused[language()],
      code: -32003,
      data: { code: "FORBIDDEN", httpStatus: 403, path },
    },
  },
});

let loading: Promise<PortalDemoData> | null = null;
/** The recording is its own chunk: a customer who signs in never downloads it. */
function recording(): Promise<PortalDemoData> {
  loading ??= import("@/demo/portalDemoData.json").then((m) => (m.default ?? m) as unknown as PortalDemoData);
  return loading;
}

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Stands where the network would be, for one tRPC request.
 *
 * A question the recording knows is answered from it. One it does not know
 * is something every visitor may ask anyway - the company's name, the theme,
 * the price list, the blog - and goes to the real server, so the demo wears
 * the company's real face. A change is refused in words, or quietly
 * accepted when the customer did not ask for it.
 */
export async function demoFetch(input: RequestInfo | URL, init: RequestInit | undefined, real: Fetch): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
  const paths = url.pathname.replace(/^\/api\/trpc\/?/, "").split(",").filter(Boolean);
  if (paths.length === 0) return real(input, init);

  const batch = url.searchParams.get("batch") === "1";
  const isQuery = (init?.method ?? "GET").toUpperCase() === "GET";
  const out: unknown[] = new Array(paths.length);

  if (!isQuery) {
    const data = await recording();
    paths.forEach((path, i) => {
      // A few pages open with a mutation that changes nothing a visitor can
      // see (the messages page fetching its conversation). Those were
      // recorded too, and are answered like a question.
      const kept = data.calls[path]?.[0];
      out[i] = kept ? answered(kept.data) : DEMO_QUIET_MUTATIONS.includes(path) ? answered({ json: null }) : refused(path);
    });
    return reply(batch ? out : out[0]);
  }

  let inputs: Record<string, { json?: unknown } | undefined> = {};
  try {
    const raw = url.searchParams.get("input");
    const parsed = raw ? JSON.parse(raw) : {};
    inputs = batch ? parsed : { 0: parsed };
  } catch {
    /* no readable input: every question matches its first recording */
  }

  const data = await recording();
  const now = new Date();
  const through: number[] = [];
  paths.forEach((path, i) => {
    const kept = recordedAnswer(data, path, JSON.stringify(inputs[i]?.json ?? null), now);
    if (kept === undefined) through.push(i);
    else out[i] = answered(kept);
  });

  if (through.length > 0) {
    const ask = new URL("/api/trpc/" + through.map((i) => paths[i]).join(","), window.location.origin);
    ask.searchParams.set("batch", "1");
    ask.searchParams.set("input", JSON.stringify(Object.fromEntries(through.map((i, n) => [n, inputs[i] ?? { json: null }]))));
    let got: unknown[] = [];
    try {
      const res = await real(ask.pathname + ask.search, init);
      const body = await res.json();
      got = Array.isArray(body) ? body : [body];
    } catch {
      /* offline: the recorded pages still open */
    }
    through.forEach((i, n) => {
      const one = got[n] as { result?: unknown } | undefined;
      // A question that needs a session and was never recorded: nothing to
      // show, rather than a refusal that looks like a broken page.
      out[i] = one && one.result !== undefined ? one : answered({ json: null });
    });
  }

  return reply(batch ? out : out[0]);
}

function reply(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
