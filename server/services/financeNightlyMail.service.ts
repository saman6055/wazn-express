import { schedule } from "node-cron";
import { Resend } from "resend";
import { appLogger } from "../utils/logger";
import { getSetting, setSetting } from "../db/settings.db";
import { getDebtors, getDebtAges, getAllCustomerAccountsWithInfo } from "../db";
import { getWorkingCapital } from "../db/workingCapital.db";

/**
 * The nightly copy of the books, off the server (owner, 2026-11-06, point
 * 41.4): at midnight Baghdad time, one spreadsheet (CSV, opens in Excel) of
 * every debtor, the money summary and the money received by place, mailed to
 * the owner's own address - so no server trouble can take the accounts with
 * it. Read only; nothing in the books moves.
 */
export const NIGHTLY_MAIL_KEY = "finance.nightlyMail";

export interface NightlyMailSettings { to: string | null; lastSentAt: string | null; lastError: string | null; lastDownloadAt?: string | null }

export async function getNightlyMailSettings(): Promise<NightlyMailSettings> {
  try {
    const raw = await getSetting(NIGHTLY_MAIL_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return { to: v.to ?? null, lastSentAt: v.lastSentAt ?? null, lastError: v.lastError ?? null, lastDownloadAt: v.lastDownloadAt ?? null };
  } catch {
    return { to: null, lastSentAt: null, lastError: null };
  }
}

async function saveNightly(next: NightlyMailSettings, userId: number): Promise<void> {
  await setSetting(NIGHTLY_MAIL_KEY, JSON.stringify(next), userId);
}

export async function setNightlyMailTo(to: string | null, userId: number): Promise<NightlyMailSettings> {
  const now = await getNightlyMailSettings();
  const next = { ...now, to: to && to.trim() ? to.trim() : null };
  await saveNightly(next, userId);
  return next;
}

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: unknown[]) => cells.map(cell).join(",");
const money = (n: unknown) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

/** The spreadsheet: the summary, then every debtor, then money received by place. */
export async function buildFinanceCsv(now = new Date()): Promise<string> {
  const [debtors, ages, wc, accounts] = await Promise.all([getDebtors(0), getDebtAges(), getWorkingCapital(), getAllCustomerAccountsWithInfo()]);
  const accountOf = new Map(accounts.map((a) => [Number(a.customerId), Number(a.id)]));
  const age = new Map(ages.map((a) => [a.accountId, a.oldestUnpaidAt]));
  const f = wc.facts;
  const lines: string[] = [];
  lines.push(row(["Wazn Express — nightly finance copy", now.toISOString()]));
  lines.push("");
  lines.push(row(["Summary", "USD"]));
  lines.push(row(["Customers owe (debt)", money(f.debtUsd)]));
  lines.push(row(["Debtors", f.debtors]));
  lines.push(row(["Customers' money with us (credit)", money(f.creditUsd)]));
  lines.push(row(["Goods on the road (at cost)", money(f.goodsOnRoadCostUsd)]));
  lines.push(row(["Net cash (derived)", money(wc.netCashUsd)]));
  lines.push(row(["Should be in the work", money(wc.shouldHoldUsd)]));
  lines.push(row(["Capital", money(f.capitalUsd)]));
  lines.push(row(["Work profit (all time)", money(f.profitUsd)]));
  lines.push(row(["Expenses (all time)", money(f.expensesUsd)]));
  lines.push(row(["Company's own account (spent)", money(f.houseUsd ?? 0)]));
  for (const w of f.withdrawals) lines.push(row([`Withdrawn by ${w.name}`, money(w.usd)]));
  lines.push("");
  lines.push(row(["Money received this month, by place", "USD", "Receipts"]));
  for (const m of wc.receivedByMethod ?? []) lines.push(row([m.method, money(m.usd), m.count]));
  const check = (wc.channelChecks ?? [])[0];
  if (check) {
    lines.push("");
    lines.push(row(["Last FIB / Qi check", check.at, "FIB USD", money(check.fibUsd), "Qi USD", money(check.qiUsd)]));
  }
  lines.push("");
  lines.push(row(["Code", "Name", "Mobile", "Owes USD", "Owes IQD", "Unpaid since"]));
  for (const d of debtors) {
    const since = age.get(accountOf.get(Number(d.customerId)) ?? -1) ?? null;
    lines.push(row([d.customer?.customerCode ?? d.customerId, d.customer?.fullName ?? "", d.customer?.mobileNumber ?? "", money(d.balanceUsd), Math.round(d.balanceIqd || 0), since ? new Date(since).toISOString().slice(0, 10) : ""]));
  }
  // A byte-order mark so Excel reads the Kurdish names as they are.
  return "﻿" + lines.join("\r\n");
}

/**
 * The copy taken by hand (owner, 2026-11-06: «شتی قورس پشت گوێ بخە»): no
 * account, no key - one press downloads it, and the day is remembered so the
 * finance centre can say when today's has not been taken.
 */
export async function takeFinanceCopy(userId: number): Promise<{ csv: string; fileName: string }> {
  const csv = await buildFinanceCsv();
  const now = await getNightlyMailSettings();
  await saveNightly({ ...now, lastDownloadAt: new Date().toISOString() }, userId);
  return { csv, fileName: `wazn-finance-${new Date().toISOString().slice(0, 10)}.csv` };
}

/** Whether today's copy (Baghdad day) has been taken by hand or by mail. */
export async function financeCopyTakenToday(now = new Date()): Promise<boolean> {
  const s = await getNightlyMailSettings();
  const day = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 10) : "");
  const today = day(now.toISOString());
  return day(s.lastDownloadAt) === today || day(s.lastSentAt) === today;
}

/** Send it now; the result is kept beside the address, for the page to show. */
export async function sendNightlyFinanceMail(userId = 1): Promise<NightlyMailSettings> {
  const settings = await getNightlyMailSettings();
  const fail = async (msg: string) => {
    const next = { ...settings, lastError: `${new Date().toISOString()} — ${msg}` };
    await saveNightly(next, userId);
    appLogger.error("[NightlyMail] not sent", { reason: msg });
    return next;
  };
  if (!settings.to) return fail("no address set");
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return fail("RESEND_API_KEY is not set on the server");
  try {
    const csv = await buildFinanceCsv();
    const day = new Date().toISOString().slice(0, 10);
    const { error } = await new Resend(key).emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Wazn Express <onboarding@resend.dev>",
      to: [settings.to],
      subject: `Wazn Express — finance copy ${day}`,
      text: "The nightly copy of the accounts is attached (opens in Excel).",
      attachments: [{ filename: `wazn-finance-${day}.csv`, content: Buffer.from(csv, "utf8") }],
    });
    if (error) return fail(typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error));
    const next = { ...settings, lastSentAt: new Date().toISOString(), lastError: null };
    await saveNightly(next, userId);
    appLogger.info("[NightlyMail] sent");
    return next;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

/** Midnight in Baghdad, every night. */
export function startNightlyFinanceMail(): void {
  schedule("0 0 * * *", () => { void sendNightlyFinanceMail(); }, { timezone: "Asia/Baghdad" });
  appLogger.info("[NightlyMail] scheduled for 00:00 Asia/Baghdad");
}
