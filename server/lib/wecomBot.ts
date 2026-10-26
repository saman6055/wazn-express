/**
 * The WeCom (企业微信) group robot (owner, 2026-10-26): when a batch's
 * dispatch check is finished in China, the group is told by itself - free,
 * no person in between. WhatsApp and ordinary WeChat have no such door; they
 * are reached through the share sheet on the report page.
 *
 * The robot's key lives in system settings, set by the main admin. Anyone
 * holding it can post to the group, so it never goes back to a browser:
 * settings.list / settings.get leave it out, and the status call says only
 * whether one is set.
 *
 * Never in the way: a robot that is down, slow or mis-keyed is logged, and
 * the dispatch check it reports on has already been saved.
 */
import { getSetting } from "../db/settings.db";
import { appLogger } from "../utils/logger";
import { WECOM_SETTING_KEY } from "@shared/dispatchMessage";

/** Settings no browser receives. */
export const SERVER_ONLY_SETTINGS: readonly string[] = [WECOM_SETTING_KEY];

export async function wecomConfigured(): Promise<boolean> {
  return !!(await getSetting(WECOM_SETTING_KEY));
}

/** Post markdown to the group. True when WeCom said ok. */
export async function sendWecomMarkdown(content: string, keyOverride?: string): Promise<{ ok: boolean; error?: string }> {
  const key = keyOverride ?? (await getSetting(WECOM_SETTING_KEY));
  if (!key) return { ok: false, error: "not configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msgtype: "markdown", markdown: { content } }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as { errcode?: number; errmsg?: string };
    if (!res.ok || (body.errcode ?? 0) !== 0) {
      const error = `${res.status} ${body.errcode ?? ""} ${body.errmsg ?? ""}`.trim();
      appLogger.warn("[WeCom] robot refused the message", { error });
      return { ok: false, error };
    }
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    appLogger.warn("[WeCom] robot could not be reached", { error });
    return { ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}
