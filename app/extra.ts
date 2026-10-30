"use server";

import { cookies } from "next/headers";
import type { Ev, Result } from "./actions";

const URL = process.env.SUPABASE_URL ?? "https://ouawzqhaioscsqcysago.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_FoWZSvJR7TaI5B2WP9GWJg_bvaGb-5k";

export type PushPrefs = { event: boolean; notice: boolean; comment: boolean; promo: boolean };
export type PushTexts = Record<string, { title: string; body: string }>;
export type AdminSettings = { recordStart: string; pushTexts: PushTexts; pushDefaults: PushTexts };

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

export async function listPastEvents() {
  return rpc<(Ev & { people: (Ev["people"][number] & { attended: boolean | null })[] })[]>("rb_list_past_events", { p_token: await token() });
}
export async function setAttendance(eventId: number, uid: number, attended: boolean | null) {
  return rpc<null>("rb_set_attendance", { p_token: await token(), p_event_id: eventId, p_uid: uid, p_attended: attended });
}
export async function getAdminSettings() {
  return rpc<AdminSettings>("rb_admin_get_settings", { p_token: await token() });
}
export async function saveAdminSettings(p: { recordStart?: string; pushTexts?: PushTexts }) {
  return rpc<null>("rb_admin_set_settings", { p_token: await token(), p });
}
export async function setPushPrefs(p: Partial<PushPrefs>) {
  return rpc<null>("rb_set_push_prefs", { p_token: await token(), p });
}
export async function leaveClub(pin: string): Promise<Result<true>> {
  const r = await rpc<null>("rb_leave", { p_token: await token(), p_pin: pin });
  if (!r.ok) return r;
  (await cookies()).delete("rb_session");
  return { ok: true, data: true };
}
