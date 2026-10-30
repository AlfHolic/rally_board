"use server";

import { cookies } from "next/headers";
import webpush from "web-push";
import type { Result } from "./actions";

const URL = process.env.SUPABASE_URL ?? "https://ouawzqhaioscsqcysago.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_FoWZSvJR7TaI5B2WP9GWJg_bvaGb-5k";
const VAPID_PUBLIC = "BBQaJL_i52GyqnmZT2dajaaXA02qdeuYBCdAKlpU4Rky5f1RDywIHA8pJtnLDmoNE-Y9DZbRutUucwSqglr8dOc";

export type DuesConfig = { amount: number; startDay: number; endDay: number; account: string; exemptJoinMonth: boolean; exemptAdmins: boolean };
export type MyDues = {
  enabled: boolean; month: string; amount: number; startDay: number; endDay: number; account: string;
  required: boolean; status: "unpaid" | "reported" | "paid" | "exempt"; payerName: string | null; deadline: string; overdue: boolean;
};
export type DuesRow = {
  id: number; nickname: string; ntrp: number; gender: "M" | "F"; role: "owner" | "admin" | "member";
  status: "unpaid" | "reported" | "paid" | "exempt" | "notRequired"; payerName: string | null; reportedAt: string | null; confirmedAt: string | null;
};
export type DuesBoard = {
  config: DuesConfig; month: string; current: string; deadline: string; closed: boolean; list: DuesRow[];
  stats: { active: number; joined: number; left: number };
};
export type LeftMember = { id: number; nickname: string; reason: string | null; kind: "unpaid" | "voluntary" | "kicked"; leftAt: string; somoimJoined: string | null };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  try {
    const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) return { ok: false, error: (body && body.message) || "문제가 생겼어요. 다시 시도해주세요." };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "서버에 연결하지 못했어요. 잠시 뒤 다시 시도해주세요." };
  }
}

async function token(): Promise<string | null> {
  return (await cookies()).get("rb_session")?.value ?? null;
}

export async function getMyDues() {
  return rpc<MyDues | null>("rb_my_dues", { p_token: await token() });
}
export async function reportDues(payer: string) {
  return rpc<null>("rb_report_dues", { p_token: await token(), p_payer: payer });
}
export async function getDuesBoard(month: string) {
  return rpc<DuesBoard>("rb_admin_dues_board", { p_token: await token(), p_month: month });
}
export async function setDues(uid: number, month: string, status: "paid" | "exempt" | "unpaid") {
  return rpc<null>("rb_admin_set_dues", { p_token: await token(), p_uid: uid, p_month: month, p_status: status });
}
export async function setDuesConfig(cfg: DuesConfig) {
  return rpc<null>("rb_admin_set_dues_config", { p_token: await token(), p: cfg });
}
export async function banUnpaid(month: string) {
  return rpc<number>("rb_admin_ban_unpaid", { p_token: await token(), p_month: month });
}
export async function clearDuesMonth(month: string) {
  return rpc<number>("rb_admin_clear_dues_month", { p_token: await token(), p_month: month });
}
export async function getLeftMembers() {
  return rpc<LeftMember[]>("rb_admin_left_members", { p_token: await token() });
}

/** Admin-triggered reminder to everyone who still owes for the month. */
export async function remindUnpaid(month: string): Promise<Result<number>> {
  const check = await getDuesBoard(month);
  if (!check.ok) return check;
  const secret = process.env.PUSH_SECRET;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !priv) return { ok: false, error: "알림 설정이 아직 안 되어 있어요." };
  const t = await rpc<{ title: string; body: string; url: string; tag: string; subs: { endpoint: string; p256dh: string; auth: string }[] }>(
    "rb_push_targets_dues", { p_secret: secret, p_month: month },
  );
  if (!t.ok) return t;
  webpush.setVapidDetails("mailto:rallyboard@example.com", VAPID_PUBLIC, priv);
  const payload = JSON.stringify({ title: t.data.title, body: t.data.body, url: t.data.url, tag: t.data.tag });
  await Promise.allSettled(
    t.data.subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await rpc("rb_drop_push", { p_secret: secret, p_endpoint: s.endpoint });
      }
    }),
  );
  return { ok: true, data: t.data.subs.length };
}
