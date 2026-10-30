"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listMembers } from "@/app/actions";
import {
  addAnnualPass, assignReplacement, confirmEventPayment, confirmRefund, getClubAdmin, getClubDashboard,
  getEventManagement, getMyEvents, manageParticipant, markInboxRead, recordAttendancePenalty,
  reportEventPayment, reportPenalty, requestNtrp, resolveNtrp, resolvePenalty, revokeAnnualPass,
  saveEventReview, setStation, type Payment, type Penalty,
} from "@/app/club";
import { Sheet } from "./sheets";
import { errText, fmtShort, NTRP_STEPS, run, won, type Ev, type Me } from "./util";

const field = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[14px] outline-none focus:border-court";
const button = "rounded-xl bg-court px-3 py-2 text-[13px] font-bold text-white disabled:opacity-40";
const secondary = "rounded-xl bg-paper px-3 py-2 text-[13px] font-semibold text-ink disabled:opacity-40";
const box = "rounded-2xl bg-white p-4 ring-1 ring-line";
export const RSVP_LABEL = { going: "참석 확정", payment_pending: "입금 대기", waiting: "자리 대기", declined: "취소·불참" };
const PAYMENT_LABEL: Record<Payment["status"], string> = { pending: "입금 대기", reported: "입금 확인 요청", paid: "입금 확인 완료", refund_pending: "환불 확인 대기", refunded: "환불 확인 완료", void: "신청 취소" };
const PENALTY_LABEL: Record<Penalty["kind"], string> = { cancellation: "참가 취소", late15: "15분 지각", late30: "30분 지각", no_show: "무단 불참·잠수" };
const PENALTY_STATUS = { unpaid: "미납", reported: "확인 요청", settled: "이행 확인", waived: "면제·정정" };

function useClubAction(onToast: (s: string) => void) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      await Promise.all(["club", "events", "myEvents", "eventManagement", "pastEvents", "members", "me", "rank", "duesBoard", "myDues"].map(key => qc.invalidateQueries({ queryKey: [key] })));
      onToast(message);
      return true;
    } catch (e) { onToast(errText(e)); return false; }
    finally { setBusy(false); }
  };
  return { busy, act };
}

export function ClubProfile({ me, onToast }: { me: NonNullable<Me>; onToast: (s: string) => void }) {
  const q = useQuery({ queryKey: ["club", "mine", me.id], queryFn: () => run(getClubDashboard()) });
  const [station, setStationValue] = useState("");
  const [ntrp, setNtrp] = useState(Number(me.ntrp));
  const [reason, setReason] = useState("");
  const { busy, act } = useClubAction(onToast);
  return <div className="mt-5 space-y-4 border-t border-line pt-4">
    <div>
      <label htmlFor="station-edit" className="text-[13px] font-bold">내 지하철역</label>
      <p className="my-1 text-[12px] text-mute">현재 {q.data?.station ?? "불러오는 중"}{q.data && !q.data.stationConfirmed ? " · 지하철역을 확인해주세요" : ""}</p>
      <div className="flex gap-2"><input id="station-edit" className={field} value={station} onChange={e => setStationValue(e.target.value)} placeholder="예: 삼전역" maxLength={12} /><button className={button} disabled={busy || !station.trim().endsWith("역")} onClick={() => act(() => run(setStation(station)), "지하철역과 닉네임을 변경했어요")}>저장</button></div>
    </div>
    <div className="space-y-2">
      <p className="text-[13px] font-bold">NTRP 수정 요청</p>
      <p className="text-[12px] text-mute">운영진이 확인 후 변경해요. 정모 호스트에게는 수정 권한이 없어요.</p>
      <select aria-label="요청 NTRP" className={field} value={ntrp} onChange={e => setNtrp(Number(e.target.value))}>{NTRP_STEPS.map(n => <option key={n} value={n}>{n.toFixed(1)}</option>)}</select>
      <textarea aria-label="NTRP 수정 요청 사유" className={field} value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="수정 요청 사유" />
      <button className={button} disabled={busy || !reason.trim() || ntrp === Number(me.ntrp)} onClick={() => act(() => run(requestNtrp(ntrp, reason)), "운영진에게 수정 요청을 보냈어요")}>운영진에게 요청</button>
      {q.data?.requests.filter(r => r.status === "pending").map(r => <p key={r.id} className="text-[12px] text-court">{r.requested.toFixed(1)} 요청 확인 중 · {r.reason}</p>)}
    </div>
    {q.isError && <p role="alert" className="text-[13px] text-clay">{errText(q.error)}</p>}
  </div>;
}

export function ClubRules() {
  return <details className="rounded-xl bg-paper p-3 text-[12px] leading-relaxed text-mute">
    <summary className="cursor-pointer font-bold text-court-deep">참가·취소·지각 규칙</summary>
    <div className="mt-2 space-y-2">
      <p>유료 정모는 실제 입금 확인 후 참석이 확정돼요. 입금 대기는 자리 확정이 아니므로 입금 전 호스트와 자리·금액을 확인해주세요. 자리 대기 중에는 입금하지 마세요.</p>
      <p>취소 전 호스트에게 알리고 대참자를 직접 구해주세요. 5~4일 전 무료 · 3~2일 전 2,000원 · 1일 전 5,000원 · 당일 10,000원 또는 당근리뷰.</p>
      <p>15분 지각 5,000원 · 30분 지각 10,000원 · 무단 불참·잠수 15,000원 또는 당근리뷰. 미납 지각·불참 벌칙이 있으면 앞으로의 신청이 취소되고, 운영진 확인까지 참석이 제한돼요.</p>
      <p>입금 기한·자리 보장 시간·환불 및 정산 기준은 협의 중이에요. 자동 기한 취소나 자동 환불·정산은 하지 않아요.</p>
    </div>
  </details>;
}

export function MyClub({ me, onNeedLogin, onToast, renderEvent }: { me: Me; onNeedLogin: () => void; onToast: (s: string) => void; renderEvent: (ev: Ev, past: boolean) => ReactNode }) {
  const [view, setView] = useState<"upcoming" | "past" | "payments" | "inbox">("upcoming");
  const [filter, setFilter] = useState("all");
  const d = useQuery({ queryKey: ["club", "mine", me?.id], queryFn: () => run(getClubDashboard()), enabled: !!me, refetchInterval: 30000 });
  const q = useQuery({ queryKey: ["myEvents", me?.id, view === "past"], queryFn: () => run(getMyEvents(view === "past")), enabled: !!me && (view === "upcoming" || view === "past") });
  const { busy, act } = useClubAction(onToast);
  if (!me) return <main className="mx-auto max-w-2xl px-4 py-10 text-center"><p className="font-bold">로그인하면 내 예정 정모와 입금 상태를 볼 수 있어요.</p><button onClick={onNeedLogin} className={`${button} mt-4`}>로그인</button></main>;
  const rows = q.data?.filter(e => filter === "all" || e.myStatus === filter) ?? [];
  const unread = d.data?.notifications.filter(n => !n.read_at).length ?? 0;
  return <main className="mx-auto max-w-2xl space-y-4 px-4 pt-5">
    <div><h2 className="text-xl font-black">내 정모</h2><p className="mt-1 text-[13px] text-mute">신청한 정모, 참가비, 나에게 온 알림을 확인하세요.</p></div>
    {d.data?.blocked && <p role="alert" className="rounded-xl bg-[#FCEDE6] p-3 text-[13px] font-bold text-clay">미납 지각·불참 벌칙으로 참석이 제한돼요. 입금·벌칙 탭에서 확인 요청해주세요.</p>}
    <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 ring-1 ring-line">{([["upcoming", "예정 정모"], ["past", "지난 정모"], ["payments", "입금·벌칙"], ["inbox", `알림${unread ? ` ${unread}` : ""}`]] as const).map(([k, label]) => <button key={k} className={`rounded-xl px-1 py-2.5 text-[13px] font-bold ${view === k ? "bg-court-deep text-white" : "text-mute"}`} onClick={() => { setView(k); setFilter("all"); }}>{label}</button>)}</div>
    <ClubRules />
    {d.isError && <p role="alert" className="text-clay">{errText(d.error)}</p>}
    {(view === "upcoming" || view === "past") && <>
      {view === "upcoming" && <div className="flex flex-wrap gap-2">{[["all", "전체"], ["payment_pending", "입금 대기"], ["going", "참석 확정"], ["waiting", "자리 대기"]].map(([k, label]) => <button key={k} onClick={() => setFilter(k)} className={filter === k ? button : secondary}>{label} {q.data?.filter(e => k === "all" || e.myStatus === k).length ?? 0}</button>)}</div>}
      {q.isLoading && <p className="py-8 text-center text-mute">내 정모 불러오는 중</p>}
      {q.isError && <p role="alert" className="text-clay">{errText(q.error)}</p>}
      {q.isSuccess && !rows.length && <p className={`${box} py-8 text-center text-mute`}>{view === "past" ? "참석한 지난 정모가 없어요." : "해당하는 예정 정모가 없어요."}</p>}
      {rows.map(ev => <div key={ev.id} className="space-y-2"><p className="text-[13px] font-bold text-court">{RSVP_LABEL[ev.myStatus]} · {fmtShort(ev.date)}</p>{renderEvent(ev, view === "past")}{ev.review && <div className={box}><p className="text-[13px] font-bold">호스트 후기</p><p className="mt-2 whitespace-pre-wrap text-[14px]">{ev.review}</p></div>}</div>)}
    </>}
    {view === "payments" && <>
      <div className={box}><p className="font-bold">정모 참가비</p><p className="mt-1 text-[12px] text-mute">모임 회비와 별개예요. 실제 입금 내역을 호스트·운영진이 확인해요. 가상계좌·자동 환불·호스트 정산은 아직 연결되지 않았어요.</p></div>
      {d.data?.payments.map(p => <div key={`${p.event_id}-${p.user_id}`} className={box}><p className="font-bold">{p.title}</p><p className="mt-1 text-[14px]">{won(p.amount)} · {PAYMENT_LABEL[p.status]}</p>
        {p.participantStatus === "payment_pending" && (p.status === "pending" || p.status === "reported") && <button disabled={busy} className={`${button} mt-3`} onClick={() => { const name = window.prompt("실제로 입금한 뒤 입금자명을 적어주세요. 이 요청만으로 참석이 확정되지 않아요.", p.payer_name ?? ""); if (name?.trim()) void act(() => run(reportEventPayment(p.event_id, name)), "입금 확인을 요청했어요"); }}>실제 입금 후 확인 요청</button>}
        {p.participantStatus === "waiting" && p.status !== "paid" && <p className="mt-2 text-[12px] text-mute">자리 대기 중에는 입금하지 마세요. 호스트의 자리 안내를 기다려주세요.</p>}
        {p.status === "refund_pending" && <p className="mt-2 text-[12px] text-clay">자동 환불되지 않아요. 호스트와 환불 금액·시점을 확인해주세요.</p>}</div>)}
      {!d.data?.payments.length && <p className="text-center text-[13px] text-mute">참가비 내역이 없어요.</p>}
      <div className={box}><p className="font-bold">벌칙 납부·이행</p><p className="mt-1 text-[13px] text-mute">{d.data?.penaltyAccount}</p></div>
      {d.data?.penalties.map(p => <PenaltyCard key={p.id} penalty={p}><button disabled={busy} className={button} onClick={() => { const note = window.prompt(p.review_allowed ? "입금일시·입금자명 또는 당근리뷰 이행 내용을 적어주세요." : "입금일시·입금자명을 적어주세요."); if (note?.trim()) void act(() => run(reportPenalty(p.id, note)), "운영진에게 확인을 요청했어요"); }}>납부·이행 확인 요청</button></PenaltyCard>)}
      {d.data?.duesExemption && <p className={box}>이번 달 회비 면제: <b>{d.data.duesExemption}</b></p>}
    </>}
    {view === "inbox" && <><div className="flex justify-end"><button disabled={busy || !unread} className={secondary} onClick={() => act(() => run(markInboxRead()), "알림을 읽음으로 표시했어요")}>모두 읽음</button></div>{d.data?.notifications.map(n => <article key={n.id} className={`${box} ${!n.read_at ? "border-l-4 border-court" : ""}`}><p className="font-bold">{n.title}</p><p className="mt-1 whitespace-pre-wrap text-[13px] text-mute">{n.body}</p><time className="mt-2 block text-[11px] text-mute">{new Date(n.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</time></article>)}{!d.data?.notifications.length && <p className="py-8 text-center text-mute">새 알림이 없어요.</p>}</>}
  </main>;
}

function PenaltyCard({ penalty: p, children }: { penalty: Penalty; children: ReactNode }) {
  return <article className={box}><p className="font-bold">{p.nickname} · {PENALTY_LABEL[p.kind]}</p><p className="mt-1 text-[13px] text-mute">{p.title}</p><p className="mt-2 text-[14px] font-bold">{won(p.amount)}{p.review_allowed ? " 또는 당근리뷰" : ""} · {PENALTY_STATUS[p.status]}</p><p className="mt-1 text-[13px]">{p.note}</p>{p.evidence && <p className="mt-1 text-[12px] text-court">확인 요청: {p.evidence}</p>}{p.resolution && <p className="mt-1 text-[12px] text-mute">처리: {p.resolution}</p>}{["unpaid", "reported"].includes(p.status) && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}</article>;
}

export function EventOperations({ ev, me, onToast }: { ev: Ev; me: NonNullable<Me>; onToast: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  return <><button className={`${secondary} mt-3 w-full ring-1 ring-line`} onClick={() => setOpen(true)}>참가·입금·지각·후기 관리</button>{open && <EventOperationsSheet ev={ev} me={me} onClose={() => setOpen(false)} onToast={onToast} />}</>;
}
function EventOperationsSheet({ ev, me, onClose, onToast }: { ev: Ev; me: NonNullable<Me>; onClose: () => void; onToast: (s: string) => void }) {
  const q = useQuery({ queryKey: ["eventManagement", ev.id, me.id], queryFn: () => run(getEventManagement(ev.id)) });
  const [review, setReview] = useState<string | null>(null);
  const { busy, act } = useClubAction(onToast);
  const started = Date.parse(`${ev.date}T${ev.startTime}:00+09:00`) <= Date.now();
  const finished = Date.parse(`${ev.date}T${ev.endTime}:00+09:00`) <= Date.now();
  const reference = (prompt: string, action: (s: string) => Promise<unknown>, message: string) => { const s = window.prompt(prompt); if (s?.trim()) void act(() => action(s), message); };
  return <Sheet title="정모 참가·운영 관리" onClose={onClose}>
    <p className="mb-3 text-[13px] font-bold">{ev.title}</p>
    <p className="mb-3 rounded-xl bg-paper p-3 text-[12px] text-mute">참가비는 실제 입금 내역을 확인한 뒤 처리하세요. 본인 입금은 다른 운영진이 확인해야 해요. 미입금자는 참석 확정할 수 없어요.</p>
    {q.isError && <p role="alert" className="text-clay">{errText(q.error)}</p>}
    {q.isLoading && <p className="py-6 text-mute">불러오는 중</p>}
    <div className="space-y-3">{q.data?.participants.map(p => <article key={p.id} className="rounded-xl border border-line p-3"><p className="text-[14px] font-bold">{p.nickname}</p><p className="mt-1 text-[12px] text-mute">{RSVP_LABEL[p.status as keyof typeof RSVP_LABEL]}{p.payment ? ` · ${won(p.payment.amount)} · ${PAYMENT_LABEL[p.payment.status]}` : " · 참가비 없음"}</p>{p.payment?.payer_name && <p className="text-[12px] text-court">입금자: {p.payment.payer_name}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {!started && p.id !== me.id && p.payment && ["pending", "reported"].includes(p.payment.status) && p.status !== "declined" && <button disabled={busy} className={button} onClick={() => reference(`${p.nickname} · ${won(p.payment!.amount)} 실제 입금을 확인했나요? 입금일시·입금자명 등 근거를 적어주세요.`, s => run(confirmEventPayment(ev.id, p.id, s)), "입금을 확인했어요. 참가 상태를 확인해주세요.")}>실제 입금 확인</button>}
        {!started && p.status !== "declined" && <select aria-label={`${p.nickname} 참가 상태`} className="rounded-lg border border-line px-2 py-1 text-[12px]" disabled={busy} value={p.status} onChange={e => { const s = e.target.value as "going" | "waiting" | "payment_pending"; if (window.confirm(`${p.nickname} 님을 ${RSVP_LABEL[s]} 상태로 변경할까요?`)) void act(() => run(manageParticipant(ev.id, p.id, s)), "참가 상태를 변경했어요"); }}><option value="payment_pending">입금 대기</option><option value="waiting">자리 대기</option><option value="going" disabled={!!p.payment && p.payment.status !== "paid"}>참석 확정</option></select>}
        {p.payment?.status === "refund_pending" && me.id !== p.id && <button disabled={busy} className={secondary} onClick={() => reference("실제로 환불한 금액·일시·확인 근거를 적어주세요. 이 버튼은 돈을 송금하지 않아요.", s => run(confirmRefund(ev.id, p.id, s)), "실제 환불 확인 내역을 기록했어요")}>환불 완료 기록</button>}
        {started && p.status === "going" && ([['late15', '15분 지각', 5000], ['late30', '30분 지각', 10000], ['no_show', '무단 불참', 15000]] as const).map(([kind, label, amount]) => <button key={kind} disabled={busy} className={`${secondary} text-clay`} onClick={() => { if (!window.confirm(`${p.nickname} 님의 ${label} ${won(amount)} 벌칙을 등록할까요?${kind === "no_show" ? " 당근리뷰로 대체할 수 있어요." : ""} 앞으로 신청한 정모가 자동 취소되고, 납부 확인까지 참석이 제한돼요.`)) return; reference("확인한 지각·불참 내용을 적어주세요.", note => run(recordAttendancePenalty(ev.id, p.id, kind, note)), "벌칙과 참석 제한을 등록하고 관련자 알림을 남겼어요"); }}>{label}</button>)}
      </div>
    </article>)}</div>
    {!!q.data?.cancellations.length && <section className="mt-5 space-y-2"><h3 className="font-bold">취소·대참 내역</h3>{q.data.cancellations.map(c => <div key={c.id} className="rounded-xl bg-paper p-3 text-[13px]"><p className="font-bold">{c.nickname} · {c.reason}</p><p className="mt-1 text-mute">{c.replacement_status === "confirmed" ? "대참자 확인 완료" : c.replacement_status === "needed" ? "대참자 확보 필요" : "대참 대상 아님"}</p>{c.replacement_status === "needed" && <select aria-label={`${c.nickname} 대참자`} className={`${field} mt-2`} value="" disabled={busy} onChange={e => { if (e.target.value) void act(() => run(assignReplacement(c.id, Number(e.target.value))), "대참자를 연결했어요. 환불은 별도로 확인해주세요."); }}><option value="">참석 확정된 대참자 선택</option>{q.data!.participants.filter(p => p.status === "going" && p.id !== c.user_id).map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}</select>}</div>)}</section>}
    {finished && <section className="mt-5 space-y-2 border-t border-line pt-4"><h3 className="font-bold">정모 후기</h3><p className="text-[12px] text-mute">호스트가 작성하며 참석자 전체를 대상으로 기록해요. 후기와 랭킹의 연계 기준은 협의 중으로 기존 랭킹은 그대로 유지돼요.</p><p className="text-[12px] text-court">대상: {q.data?.reviewParticipants.map(p => p.nickname).join(", ") || "출석 참가자 없음"}</p>{q.data?.canReview ? <><textarea aria-label="정모 후기" className={`${field} min-h-28`} value={review ?? q.data.review ?? ""} maxLength={3000} onChange={e => setReview(e.target.value)} /><button disabled={busy || !(review ?? q.data.review ?? "").trim()} className={button} onClick={() => act(() => run(saveEventReview(ev.id, review ?? q.data!.review ?? "")), "후기를 저장했어요")}>후기 저장</button></> : <p className="whitespace-pre-wrap text-[14px]">{q.data?.review || "호스트가 후기를 작성하면 표시돼요."}</p>}</section>}
  </Sheet>;
}

export function ClubAdministration({ onToast }: { onToast: (s: string) => void }) {
  const q = useQuery({ queryKey: ["club", "admin"], queryFn: () => run(getClubAdmin()) });
  const members = useQuery({ queryKey: ["members", "clubAdmin"], queryFn: () => run(listMembers()) });
  const [view, setView] = useState<"requests" | "penalties" | "payments" | "passes">("requests");
  const [pass, setPass] = useState({ uid: "", start: "", end: "", note: "" });
  const { busy, act } = useClubAction(onToast);
  return <div className="mt-4 space-y-3">
    <div className="grid grid-cols-4 gap-1">{([["requests", "등급 요청"], ["penalties", "벌칙"], ["payments", "참가비"], ["passes", "회비 면제"]] as const).map(([k, label]) => <button key={k} className={view === k ? button : secondary} onClick={() => setView(k)}>{label}</button>)}</div>
    {q.isLoading && <p className="py-8 text-center text-mute">불러오는 중</p>}{q.isError && <p role="alert" className="text-clay">{errText(q.error)}</p>}
    {view === "requests" && <>{q.data?.requests.map(r => <div key={r.id} className={box}><p className="font-bold">{r.nickname} → NTRP {r.requested.toFixed(1)}</p><p className="my-2 text-[13px]">{r.reason}</p><div className="flex gap-2"><button disabled={busy} className={button} onClick={() => act(() => run(resolveNtrp(r.id, true)), "등급을 변경했어요")}>승인·변경</button><button disabled={busy} className={secondary} onClick={() => act(() => run(resolveNtrp(r.id, false)), "요청을 반려했어요")}>반려</button></div></div>)}{q.data && !q.data.requests.length && <p className="py-8 text-center text-mute">대기 중인 등급 요청이 없어요.</p>}</>}
    {view === "penalties" && <><p className="text-[12px] text-mute">실제 납부·이행을 확인한 뒤 처리하세요. 미납 지각·불참 벌칙이 모두 해소되면 참석 제한이 풀려요. 기존 자동 취소는 복구되지 않아요.</p>{q.data?.penalties.map(p => <PenaltyCard key={p.id} penalty={p}>{([["paid", "입금 확인"], ...(p.review_allowed ? [["review", "당근리뷰 확인"]] : []), ["waived", "면제·오등록 정정"]] as ["paid" | "review" | "waived", string][]).map(([resolution, label]) => <button key={resolution} disabled={busy} className={resolution === "waived" ? secondary : button} onClick={() => { const note = window.prompt(`${label} 근거와 사유를 적어주세요.`); if (note?.trim()) void act(() => run(resolvePenalty(p.id, resolution, note)), "벌칙을 처리했어요"); }}>{label}</button>)}</PenaltyCard>)}</>}
    {view === "payments" && <><div className={box}><p className="font-bold">참가비 확인·환불 대기</p><p className="mt-1 text-[12px] text-mute">모임 회비와 구분해요. 가상계좌 수납·자동 입금 확인·환불·호스트 정산은 미연동이에요. 아래 처리는 실제 입출금 확인 기록이며 돈을 송금하지 않아요.</p></div>{q.data?.payments.map(p => <div className={box} key={`${p.event_id}-${p.user_id}`}><p className="font-bold">{p.title}</p><p className="mt-1 text-[13px]">{p.nickname} · {won(p.amount)} · {PAYMENT_LABEL[p.status]}</p><button disabled={busy} className={`${button} mt-3`} onClick={() => { const s = window.prompt(p.status === "refund_pending" ? "실제로 환불한 금액·일시·근거를 적어주세요." : "실제 입금일시·입금자명 등 확인 근거를 적어주세요."); if (s?.trim()) void act(() => p.status === "refund_pending" ? run(confirmRefund(p.event_id, p.user_id, s)) : run(confirmEventPayment(p.event_id, p.user_id, s)), "확인 내역을 기록했어요"); }}>{p.status === "refund_pending" ? "실제 환불 확인" : "실제 입금 확인"}</button></div>)}</>}
    {view === "passes" && <>
      <div className={box}><p className="font-bold">회비 면제 기준</p><p className="mt-2 text-[13px] leading-relaxed">가입 월 말일−10일부터 말일까지 가입 · 운영진 · 해당 월 종료된 정모 호스트 3회 이상 · 기존 1년권 적용월</p><p className="mt-2 text-[12px] text-mute">8월 21~31일, 4월 20~30일 가입자는 가입 월 면제예요. 이미 낸 회비는 자동 환불하지 않고 확인 대상으로 남겨요.</p></div>
      {q.data?.exemptions.map(x => <p key={x.id} className={`${box} text-[13px]`}><b>{x.nickname}</b> · {x.reason}{x.alreadyPaid && <span className="mt-1 block font-bold text-clay">이미 납부한 회비 있음 — 환불·이월 방식 협의 필요</span>}</p>)}
      <div className={`${box} space-y-2`}><p className="font-bold">기존 1년권 적용 기간 등록</p><p className="text-[12px] text-mute">구매 내역에서 확인한 시작월·종료월을 직접 입력하세요.</p><select aria-label="1년권 회원" className={field} value={pass.uid} onChange={e => setPass({ ...pass, uid: e.target.value })}><option value="">회원 선택</option>{members.data?.map(m => <option key={m.id} value={m.id}>{m.nickname}</option>)}</select><label className="block text-[12px]">시작월<input type="month" className={field} value={pass.start} onChange={e => setPass({ ...pass, start: e.target.value })} /></label><label className="block text-[12px]">종료월<input type="month" className={field} value={pass.end} onChange={e => setPass({ ...pass, end: e.target.value })} /></label><input aria-label="1년권 구매 확인 근거" className={field} maxLength={200} placeholder="구매 확인 근거" value={pass.note} onChange={e => setPass({ ...pass, note: e.target.value })} /><button className={button} disabled={busy || !pass.uid || !pass.start || !pass.end || pass.end < pass.start || !pass.note.trim()} onClick={() => act(() => run(addAnnualPass(Number(pass.uid), pass.start, pass.end, pass.note)), "1년권 면제 기간을 등록했어요")}>기간 등록</button></div>
      {q.data?.passes.map(p => <div key={p.id} className={box}><p className="text-[13px] font-bold">{p.nickname} · {p.start_month}~{p.end_month}</p><p className="my-2 text-[12px] text-mute">{p.note}</p><button className={secondary} disabled={busy} onClick={() => { if (window.confirm("이 1년권 면제 등록을 해제할까요?")) void act(() => run(revokeAnnualPass(p.id)), "면제 등록을 해제했어요"); }}>등록 해제</button></div>)}
    </>}
  </div>;
}
