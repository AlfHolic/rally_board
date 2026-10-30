"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { flushClubNotifications } from "@/lib/club-push";
import type { Ev, Result } from "./actions";

const URL = process.env.SUPABASE_URL ?? "https://ouawzqhaioscsqcysago.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_FoWZSvJR7TaI5B2WP9GWJg_bvaGb-5k";
export type Payment = { event_id: number; user_id: number; amount: number; status: "pending" | "reported" | "paid" | "refund_pending" | "refunded" | "void"; payer_name: string | null; reference: string | null; title?: string; nickname?: string; participantStatus?: string };
export type Penalty = { id: number; event_id: number; user_id: number; nickname: string; title: string; kind: "cancellation" | "late15" | "late30" | "no_show"; amount: number; review_allowed: boolean; blocks_attendance: boolean; status: "unpaid" | "reported" | "settled" | "waived"; note: string; evidence: string | null; resolution: string | null };
export type NtrpRequest = { id: number; user_id: number; nickname?: string; requested: number; reason: string; status: "pending" | "approved" | "rejected" };
export type Dashboard = { station: string | null; stationConfirmed: boolean; blocked: boolean; duesExemption: string | null; penaltyAccount: string; payments: Payment[]; penalties: Penalty[]; requests: NtrpRequest[]; notifications: { id: number; event_id: number | null; title: string; body: string; read_at: string | null; created_at: string }[] };
export type MyEvent = Ev & { myStatus: "going" | "waiting" | "payment_pending"; review: string | null };
export type EventManagement = { participants: { id: number; nickname: string; status: string; payment: Payment | null }[]; cancellations: { id: number; user_id: number; nickname: string; reason: string; replacement_status: string; replacement_id: number | null }[]; review: string | null; canReview: boolean; reviewParticipants: { id: number; nickname: string }[] };
export type ClubAdmin = { penalties: Penalty[]; requests: NtrpRequest[]; payments: Payment[]; passes: { id: number; user_id: number; nickname: string; start_month: string; end_month: string; note: string }[]; exemptions: { id: number; nickname: string; reason: string; alreadyPaid: boolean }[] };

async function rpc<T>(fn: string, args: Record<string, unknown> = {}, authenticated = true): Promise<Result<T>> {
  try {
    const body = authenticated ? { p_token: (await cookies()).get("rb_session")?.value ?? null, ...args } : args;
    const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) return { ok: false, error: data?.code === "PGRST202" ? "새 기능의 DB 업데이트가 아직 적용되지 않았어요. 운영자에게 문의해주세요." : data?.message ?? "처리하지 못했어요." };
    if (authenticated) after(() => flushClubNotifications());
    return { ok: true, data };
  } catch { return { ok: false, error: "서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요." }; }
}

export async function getClubCapabilities() { return rpc<{ version: number; paymentMode: string }>("rb_club_capabilities", {}, false); }
export async function getClubDashboard() { return rpc<Dashboard>("rb_club_dashboard"); }
export async function getMyEvents(past: boolean) { return rpc<MyEvent[]>("rb_my_events", { p_past: past }); }
export async function getClubAdmin() { return rpc<ClubAdmin>("rb_club_admin"); }
export async function setStation(station: string) { return rpc<null>("rb_set_station", { p_station: station }); }
export async function reportEventPayment(eventId: number, payer: string) { return rpc<null>("rb_report_event_payment", { p_event_id: eventId, p_payer: payer }); }
export async function confirmEventPayment(eventId: number, uid: number, reference: string) { return rpc<string>("rb_confirm_event_payment", { p_event_id: eventId, p_uid: uid, p_reference: reference }); }
export async function manageParticipant(eventId: number, uid: number, status: "going" | "waiting" | "payment_pending") { return rpc<null>("rb_manage_participant", { p_event_id: eventId, p_uid: uid, p_status: status }); }
export async function getCancelQuote(eventId: number) { return rpc<{ amount: number; reviewAllowed: boolean; replacementRequired: boolean; refundPending: boolean }>("rb_cancel_quote", { p_event_id: eventId }); }
export async function cancelRegistration(eventId: number, reason: string) { return rpc<string>("rb_cancel_registration", { p_event_id: eventId, p_reason: reason }); }
export async function recordAttendancePenalty(eventId: number, uid: number, kind: "late15" | "late30" | "no_show", note: string) { return rpc<number>("rb_record_attendance_penalty", { p_event_id: eventId, p_uid: uid, p_kind: kind, p_note: note }); }
export async function reportPenalty(id: number, evidence: string) { return rpc<null>("rb_report_penalty", { p_id: id, p_evidence: evidence }); }
export async function resolvePenalty(id: number, resolution: "paid" | "review" | "waived", note: string) { return rpc<null>("rb_resolve_penalty", { p_id: id, p_resolution: resolution, p_note: note }); }
export async function requestNtrp(value: number, reason: string) { return rpc<null>("rb_request_ntrp", { p_value: value, p_reason: reason }); }
export async function resolveNtrp(id: number, approve: boolean) { return rpc<null>("rb_resolve_ntrp", { p_id: id, p_approve: approve }); }
export async function saveEventReview(eventId: number, body: string) { return rpc<null>("rb_save_event_review", { p_event_id: eventId, p_body: body }); }
export async function markInboxRead() { return rpc<null>("rb_mark_inbox_read"); }
export async function addAnnualPass(uid: number, start: string, end: string, note: string) { return rpc<null>("rb_add_annual_pass", { p_uid: uid, p_start: start, p_end: end, p_note: note }); }
export async function revokeAnnualPass(id: number) { return rpc<null>("rb_revoke_annual_pass", { p_id: id }); }
export async function confirmRefund(eventId: number, uid: number, reference: string) { return rpc<null>("rb_confirm_refund", { p_event_id: eventId, p_uid: uid, p_reference: reference }); }
export async function assignReplacement(id: number, uid: number) { return rpc<null>("rb_assign_replacement", { p_id: id, p_uid: uid }); }
export async function getEventManagement(eventId: number) { return rpc<EventManagement>("rb_event_management", { p_event_id: eventId }); }
