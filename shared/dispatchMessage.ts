/**
 * The words that travel when a batch leaves China (owner, 2026-10-26): the
 * dispatch check is done, and Wazn's WhatsApp, the WeChat group and the
 * WeCom group robot are told - one text for all of them, so they never say
 * different things.
 *
 * Two languages in one message: the group in China reads Chinese, the
 * office in Erbil reads Kurdish.
 */

export interface DispatchFacts {
  batchCode: string;
  cartons: number;
  parcels: number;
  /** Parcels of the batch not put in any carton. */
  leftOut: number;
  note?: string | null;
  by?: string | null;
  /** The report page, for whoever is signed in. */
  reportUrl?: string | null;
}

const lines = (f: DispatchFacts): { zh: string[]; ku: string[] } => ({
  zh: [
    `发货核对完成 · ${f.batchCode}`,
    `${f.cartons} 箱 · ${f.parcels} 件`,
    ...(f.leftOut > 0 ? [`${f.leftOut} 件未装箱${f.note ? `：${f.note}` : ""}`] : ["全部已装箱"]),
  ],
  ku: [
    `پشکنینی ناردن تەواو بوو · ${f.batchCode}`,
    `${f.cartons} کارتۆن · ${f.parcels} پاکێج`,
    ...(f.leftOut > 0 ? [`${f.leftOut} پاکێج نەخراونەتە کارتۆن${f.note ? `: ${f.note}` : ""}`] : ["هەموو پاکێجەکان لە کارتۆندان"]),
  ],
});

/** Plain text, for WhatsApp and WeChat (the share sheet). */
export function dispatchPlainText(f: DispatchFacts): string {
  const l = lines(f);
  return [...l.zh, "", ...l.ku, ...(f.by ? ["", `👤 ${f.by}`] : []), ...(f.reportUrl ? ["", f.reportUrl] : [])].join("\n");
}

/** WeCom robot markdown: the warning line in its own colour. Under the robot's 4096-byte limit. */
export function dispatchWecomMarkdown(f: DispatchFacts): string {
  const l = lines(f);
  const warn = (s: string) => (f.leftOut > 0 ? `<font color="warning">${s}</font>` : `<font color="info">${s}</font>`);
  const out = [
    `**${l.zh[0]}**`,
    `> ${l.zh[1]}`,
    `> ${warn(l.zh[2])}`,
    "",
    `**${l.ku[0]}**`,
    `> ${l.ku[1]}`,
    `> ${warn(l.ku[2])}`,
    ...(f.by ? ["", `> 👤 ${f.by}`] : []),
    ...(f.reportUrl ? ["", `[查看报告 · ڕاپۆرت](${f.reportUrl})`] : []),
  ].join("\n");
  return out.length > 3800 ? `${out.slice(0, 3800)}…` : out;
}

/**
 * A WeCom group robot's key, from whatever the admin pasted: the whole
 * webhook address or the key alone. Null when it is neither - the server
 * only ever calls qyapi.weixin.qq.com with a key it built the address for.
 */
export function wecomKeyFrom(input: string): string | null {
  const t = (input ?? "").trim();
  const fromUrl = /^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=([A-Za-z0-9-]{20,64})$/.exec(t);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z0-9-]{20,64}$/.test(t) ? t : null;
}

export const WECOM_SETTING_KEY = "wecom_dispatch_webhook_key";
