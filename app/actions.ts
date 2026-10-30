"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { flushClubNotifications } from "@/lib/club-push";
import webpush from "web-push";

const URL = process.env.SUPABASE_URL ?? "https://ouawzqhaioscsqcysago.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_FoWZSvJR7TaI5B2WP9GWJg_bvaGb-5k";
const COOKIE = "rb_session";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type Person = { id: number; nickname: string; gender: "M" | "F"; ntrp: number; status: "going" | "waiting" | "payment_pending" | "declined" };
export type Comment = { id: number; userId: number; nickname: string; body: string; createdAt: string };
export type Ev = {
  id: number; hostId: number; hostName: string; title: string; court: string; date: string;
  startTime: string; endTime: string; gameType: "any" | "mens" | "womens" | "mixed"; capacity: number;
  maleCap: number; femaleCap: number; ntrpMin: number | null; ntrpMax: number | null; cancelHours: number;
  note: string; courtFee: number; ballFee: number; people: Person[]; comments: Comment[];
};
export type MeData = {
  id: number; nickname: string; gender: "M" | "F"; ntrp: number; freq: Freq | null; somoim: string | null; isAdmin: boolean; isOwner: boolean;
  name: string | null; needsProfile: boolean; warnings: { reason: string; at: string }[];
};
export type Freq = "none" | "m12" | "m34" | "w1" | "w23" | "w4";
export type Member = {
  id: number; nickname: string; gender: "M" | "F"; ntrp: number; role: "owner" | "admin" | "member";
  joinedAt: string; hosted: number; warnings: number | null; banned: boolean; bannedReason: string | null;
};
export type NComment = { id: number; userId: number; nickname: string; body: string; createdAt: string };
export type Notice = {
  id: number; authorId: number; author: string; title: string; body: string; pinned: boolean;
  createdAt: string; edited: boolean; comments: NComment[];
};
export type Warning = { id: number; reason: string; by: string; at: string };
export type RankRow = { id: number; nickname: string; gender: "M" | "F"; ntrp: number; n: number; last: string; rank: number };
export type Ranking = { month: string; members: number; list: RankRow[] };
export type EventInput = {
  title: string; court: string; date: string; startTime: string; endTime: string; gameType: Ev["gameType"];
  capacity: number; maleCap: number; femaleCap: number; ntrpMin: number | null; ntrpMax: number | null;
  cancelHours: number; note: string; courtFee: number; ballFee: number;
};

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  try {
    const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) return { ok: false, error: (body && body.message) || "문제가 생겼어요. 다시 시도해주세요." };
    if (["rb_update_event", "rb_delete_event", "rb_admin_ban"].includes(fn)) after(() => flushClubNotifications());
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "서버에 연결하지 못했어요. 잠시 뒤 다시 시도해주세요." };
  }
}

async function token(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

async function saveToken(t: string) {
  // Browsers cap cookie lifetime at 400 days; getMe refreshes it on every visit so the login never lapses.
  (await cookies()).set(COOKIE, t, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 400 });
}

export async function getMe(): Promise<Result<MeData | null>> {
  const t = await token();
  if (!t) return { ok: true, data: null };
  const r = await rpc<MeData | null>("rb_me", { p_token: t });
  if (r.ok && r.data) await saveToken(t);
  return r;
}

export type SignupInput = { name: string; yy: string; region: string; gender: "M" | "F"; ntrp: number; freq: Freq; somoim: string; pin: string };

export async function signup(d: SignupInput): Promise<Result<true>> {
  const r = await rpc<string>("rb_signup", { p_name: d.name, p_yy: d.yy, p_region: d.region, p_gender: d.gender, p_ntrp: d.ntrp, p_freq: d.freq, p_somoim: d.somoim, p_pin: d.pin });
  if (!r.ok) return r;
  await saveToken(r.data);
  return { ok: true, data: true };
}

export async function login(id: string, yy: string, pin: string): Promise<Result<true>> {
  const r = await rpc<{ token?: string; error?: string }>("rb_login2", { p_id: id, p_yy: yy, p_pin: pin });
  if (!r.ok) return r;
  if (!r.data?.token) return { ok: false, error: r.data?.error ?? "로그인하지 못했어요." };
  await saveToken(r.data.token);
  return { ok: true, data: true };
}

export async function logout(): Promise<Result<true>> {
  const t = await token();
  if (t) await rpc("rb_logout", { p_token: t });
  (await cookies()).delete(COOKIE);
  return { ok: true, data: true };
}

export async function completeProfile(name: string, yy: string, region: string, freq: Freq | null, somoim: string) {
  return rpc<null>("rb_complete_profile", { p_token: await token(), p_name: name, p_yy: yy, p_region: region, p_freq: freq ?? "", p_somoim: somoim });
}

export async function adminSetSomoim(uid: number, somoim: string) {
  return rpc<null>("rb_admin_set_somoim", { p_token: await token(), p_uid: uid, p_somoim: somoim });
}

export async function setFreq(freq: Freq) {
  return rpc<null>("rb_set_freq", { p_token: await token(), p_freq: freq });
}

export async function listMembers() {
  return rpc<Member[]>("rb_members", { p_token: await token() });
}

export async function adminSetNtrp(uid: number, ntrp: number) {
  return rpc<null>("rb_admin_set_ntrp", { p_token: await token(), p_uid: uid, p_ntrp: ntrp });
}

export async function adminWarn(uid: number, reason: string) {
  return rpc<null>("rb_admin_warn", { p_token: await token(), p_uid: uid, p_reason: reason });
}

export async function adminWarnings(uid: number) {
  return rpc<Warning[]>("rb_admin_warnings", { p_token: await token(), p_uid: uid });
}

export async function adminDeleteWarning(wid: number) {
  return rpc<null>("rb_admin_delete_warning", { p_token: await token(), p_wid: wid });
}

export async function adminBan(uid: number, reason: string) {
  return rpc<null>("rb_admin_ban", { p_token: await token(), p_uid: uid, p_reason: reason });
}

export async function adminUnban(uid: number) {
  return rpc<null>("rb_admin_unban", { p_token: await token(), p_uid: uid });
}

export async function adminResetPin(uid: number, pin: string) {
  return rpc<null>("rb_admin_reset_pin2", { p_token: await token(), p_uid: uid, p_pin: pin });
}

export async function ownerSetAdmin(uid: number, on: boolean) {
  return rpc<null>("rb_owner_set_admin", { p_token: await token(), p_uid: uid, p_on: on });
}

export async function listEvents() {
  return rpc<Ev[]>("rb_list_events", {});
}

export async function createEvent(input: EventInput): Promise<Result<number>> {
  const r = await rpc<number>("rb_create_event", { p_token: await token(), p: { ...input, title: "" } });
  if (r.ok) {
    const id = r.data;
    after(() => pushFrom("rb_push_targets_event", { p_event_id: id }));
  }
  return r;
}

export async function updateEvent(id: number, input: EventInput) {
  return rpc<null>("rb_update_event", { p_token: await token(), p_id: id, p: { ...input, title: "" } });
}

export async function deleteEvent(id: number) {
  return rpc<null>("rb_delete_event", { p_token: await token(), p_id: id });
}

export async function respond(id: number, action: "join" | "decline") {
  return rpc<"going" | "waiting" | "payment_pending" | "declined">("rb_respond", { p_token: await token(), p_id: id, p_action: action });
}

export async function getRanking(period: "all" | "month") {
  return rpc<Ranking>("rb_ranking", { p_period: period });
}

export async function addComment(eventId: number, body: string): Promise<Result<number>> {
  const r = await rpc<number>("rb_add_comment", { p_token: await token(), p_event_id: eventId, p_body: body });
  if (r.ok) {
    const id = r.data;
    after(() => notifyComment(id));
  }
  return r;
}

export async function deleteComment(id: number) {
  return rpc<null>("rb_delete_comment", { p_token: await token(), p_id: id });
}

export async function savePush(endpoint: string, p256dh: string, auth: string) {
  return rpc<null>("rb_save_push", { p_token: await token(), p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth });
}

export async function hasPush() {
  return rpc<boolean>("rb_has_push", { p_token: await token() });
}

export async function listNotices() {
  return rpc<Notice[]>("rb_list_notices", {});
}

export async function createNotice(title: string, body: string, pinned: boolean): Promise<Result<number>> {
  const r = await rpc<number>("rb_create_notice", { p_token: await token(), p_title: title, p_body: body, p_pinned: pinned });
  if (r.ok) {
    const id = r.data;
    after(() => pushFrom("rb_push_targets_notice", { p_notice_id: id }));
  }
  return r;
}

export async function updateNotice(id: number, title: string, body: string, pinned: boolean) {
  return rpc<null>("rb_update_notice", { p_token: await token(), p_id: id, p_title: title, p_body: body, p_pinned: pinned });
}

export async function deleteNotice(id: number) {
  return rpc<null>("rb_delete_notice", { p_token: await token(), p_id: id });
}

export async function addNoticeComment(noticeId: number, body: string): Promise<Result<number>> {
  const r = await rpc<number>("rb_add_notice_comment", { p_token: await token(), p_notice_id: noticeId, p_body: body });
  if (r.ok) {
    const id = r.data;
    after(() => pushFrom("rb_push_targets_ncomment", { p_comment_id: id }));
  }
  return r;
}

export async function deleteNoticeComment(id: number) {
  return rpc<null>("rb_delete_notice_comment", { p_token: await token(), p_id: id });
}

const VAPID_PUBLIC = "BBQaJL_i52GyqnmZT2dajaaXA02qdeuYBCdAKlpU4Rky5f1RDywIHA8pJtnLDmoNE-Y9DZbRutUucwSqglr8dOc";

type Targets = { title: string; body: string; url: string; tag: string; subs: { endpoint: string; p256dh: string; auth: string }[] };

async function sendPush(t: Targets, secret: string, priv: string) {
  if (!t.subs.length) return;
  webpush.setVapidDetails("mailto:rallyboard@example.com", VAPID_PUBLIC, priv);
  const payload = JSON.stringify({ title: t.title, body: t.body, url: t.url, tag: t.tag });
  await Promise.allSettled(
    t.subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await rpc("rb_drop_push", { p_secret: secret, p_endpoint: s.endpoint });
      }
    }),
  );
}

async function pushFrom(fn: string, args: Record<string, unknown>) {
  const secret = process.env.PUSH_SECRET;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !priv) return;
  const t = await rpc<Targets>(fn, { p_secret: secret, ...args });
  if (t.ok) await sendPush(t.data, secret, priv);
}

async function notifyComment(commentId: number) {
  const secret = process.env.PUSH_SECRET;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !priv) return;
  const t = await rpc<{ title: string; body: string; eventId: number; subs: Targets["subs"] }>(
    "rb_push_targets", { p_secret: secret, p_comment_id: commentId },
  );
  if (!t.ok) return;
  await sendPush({ title: t.data.title, body: t.data.body, url: `/?e=${t.data.eventId}&c=1`, tag: `ev-${t.data.eventId}`, subs: t.data.subs }, secret, priv);
}
