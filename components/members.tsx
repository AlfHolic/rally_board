"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  adminBan, adminDeleteWarning, adminResetPin, adminSetNtrp, adminSetSomoim, adminUnban, adminWarn, adminWarnings, listMembers, ownerSetAdmin,
  type Member,
} from "@/app/actions";
import { Sheet, SomoimPicker } from "./sheets";
import { errText, NTRP_STEPS, run, type Me } from "./util";

const ROLE: Record<Member["role"], string> = { owner: "방장", admin: "운영진", member: "" };

type MemberX = Member & { idleDays: number | null; lastActive: string | null; recent90: number | null; somoimJoined: string | null };
type Filter = "all" | "inactive" | "warn";

function activity(m: MemberX): "inactive" | "warn" | "ok" | null {
  if (m.idleDays == null) return null;
  if (m.idleDays >= 90) return "inactive";
  if (m.idleDays >= 60) return "warn";
  return "ok";
}

function fmtMD(d: string | null) {
  if (!d) return "없음";
  const [, mo, dd] = d.split("-");
  return `${Number(mo)}/${Number(dd)}`;
}

export function MembersPanel({ me, onNeedLogin, onToast }: { me: Me; onNeedLogin: () => void; onToast: (m: string) => void }) {
  const q = useQuery({ queryKey: ["members", me?.id], queryFn: () => run(listMembers()), enabled: !!me });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [picked, setPicked] = useState<Member | null>(null);

  const all = (q.data ?? []) as MemberX[];
  const counts = useMemo(() => ({
    inactive: all.filter((m) => !m.banned && activity(m) === "inactive").length,
    warn: all.filter((m) => !m.banned && activity(m) === "warn").length,
  }), [all]);
  const list = useMemo(() => {
    const k = query.trim().toLowerCase();
    let r = all.filter((m) => !k || m.nickname.toLowerCase().includes(k));
    if (filter !== "all") r = r.filter((m) => activity(m) === filter).sort((a, b) => (b.idleDays ?? 0) - (a.idleDays ?? 0));
    return r;
  }, [all, query, filter]);
  const active = list.filter((m) => !m.banned);

  if (!me)
    return (
      <main className="mx-auto max-w-2xl px-4 pt-10 text-center">
        <p className="text-[16px] font-bold">멤버 목록은 로그인하면 볼 수 있어요</p>
        <button onClick={onNeedLogin} className="mt-4 rounded-full bg-court px-6 py-3 font-bold text-white">로그인</button>
      </main>
    );

  return (
    <main className="mx-auto max-w-2xl px-4 pt-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-black">멤버 {q.data ? q.data.length : ""}명</h2>
          <p className="mt-0.5 text-[13px] text-mute">{me.isAdmin ? "이름을 누르면 NTRP 변경, 경고, 탈퇴 처리를 할 수 있어요. 탈퇴자는 운영 탭에서 봐요." : "같이 치는 멤버들이에요."}</p>
        </div>
      </div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름, 지하철역으로 찾기"
        className="mt-4 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] outline-none focus:border-court" />

      {me.isAdmin && q.data && (
        <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-line">
          <p className="text-[12px] font-bold text-court-deep">🔒 운영진만 보이는 활동 현황</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {([["all", "전체", null], ["inactive", "🔴 3개월 미참", counts.inactive], ["warn", "🟡 60일+ 미참", counts.warn]] as const).map(([k, l, n]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`rounded-xl px-2 py-2 text-[12px] font-bold ${filter === k ? "bg-court-deep text-white" : "bg-paper text-ink"}`}>
                {l}{n != null ? ` ${n}` : ""}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-mute">
            활동 = 참석 확정 후 실제로 열린 일정, 또는 직접 잡은 코트. 마지막 활동일부터 센 날짜이고, 활동이 없으면 소모임 모임 가입일부터 세요.
          </p>
        </div>
      )}

      {q.isLoading && <p className="py-16 text-center text-mute">불러오는 중</p>}
      {q.isError && <p className="py-16 text-center text-clay">{errText(q.error)}</p>}

      {active.length > 0 && (
        <ul className="mt-4 overflow-hidden rounded-[22px] bg-white ring-1 ring-line">
          {active.map((m) => (
            <li key={m.id}>
              <button disabled={!me.isAdmin} onClick={() => setPicked(m)}
                className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0 enabled:hover:bg-paper">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-black ${m.gender === "M" ? "bg-[#E4EEF8] text-[#2B5C8A]" : "bg-[#FBE7EE] text-[#A23D62]"}`}>
                  {Number(m.ntrp).toFixed(1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {m.nickname}
                    {m.id === me.id && <span className="ml-1.5 rounded bg-court px-1.5 py-0.5 align-middle text-[11px] font-bold text-white">나</span>}
                  </span>
                  <span className="block text-[12px] text-mute">
                    {m.joinedAt} 가입 · 코트 {m.hosted}회
                    {m.warnings ? <b className="ml-1.5 text-clay">경고 {m.warnings}</b> : null}
                  </span>
                  {me.isAdmin && (m as MemberX).idleDays != null && (
                    <span className="block text-[12px] text-mute">
                      소모임 {(m as MemberX).somoimJoined ? (m as MemberX).somoimJoined!.split("-").join(".") : "미입력"} · 최근 3개월 참석 {(m as MemberX).recent90}회 · 마지막 활동 {fmtMD((m as MemberX).lastActive)}
                      {activity(m as MemberX) === "inactive" && <b className="ml-1.5 rounded bg-[#FCEDE6] px-1.5 text-clay">🔴 3개월 미참 D+{(m as MemberX).idleDays}</b>}
                      {activity(m as MemberX) === "warn" && <b className="ml-1.5 rounded bg-[#FFF6D6] px-1.5 text-[#8A6A00]">🟡 D+{(m as MemberX).idleDays}</b>}
                    </span>
                  )}
                </span>
                {ROLE[m.role] && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${m.role === "owner" ? "bg-ink text-white" : "bg-ball text-court-deep"}`}>{ROLE[m.role]}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && <MemberSheet me={me} m={picked} onClose={() => setPicked(null)} onToast={onToast} />}
    </main>
  );
}

const field = "w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-[15px] text-ink outline-none focus:border-court focus:bg-white";
const label = "mb-1.5 block text-[13px] font-semibold text-mute";

function MemberSheet({ me, m, onClose, onToast }: { me: NonNullable<Me>; m: Member; onClose: () => void; onToast: (s: string) => void }) {
  const qc = useQueryClient();
  const warnQ = useQuery({ queryKey: ["warnings", m.id], queryFn: () => run(adminWarnings(m.id)) });
  const [ntrp, setNtrp] = useState(Number(m.ntrp));
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [somoim, setSomoim] = useState((m as MemberX).somoimJoined ?? "");
  const [busy, setBusy] = useState(false);
  const isSelf = m.id === me.id;
  const protectedTarget = m.role === "owner" || (m.role === "admin" && !me.isOwner);

  async function act(p: () => Promise<unknown>, ok: string, close = false) {
    setBusy(true);
    try {
      await p();
      onToast(ok);
      void qc.invalidateQueries({ queryKey: ["members"] });
      void qc.invalidateQueries({ queryKey: ["warnings", m.id] });
      void qc.invalidateQueries({ queryKey: ["events"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      if (close) onClose();
    } catch (e) {
      onToast(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={m.nickname} onClose={onClose}>
      <p className="-mt-2 mb-4 text-[13px] text-mute">{m.joinedAt} 가입 · 코트 {m.hosted}회{ROLE[m.role] ? ` · ${ROLE[m.role]}` : ""}</p>

      {m.banned ? (
        <button disabled={busy} onClick={() => act(() => run(adminUnban(m.id)), "탈퇴 처리를 풀었어요", true)}
          className="w-full rounded-xl border-2 border-court py-3 font-bold text-court disabled:opacity-40">탈퇴 처리 풀기</button>
      ) : (
        <div className="space-y-5">
          <div>
            <label className={label}>NTRP 변경 (승급·조정)</label>
            <div className="flex gap-2">
              <select className={field} value={ntrp} onChange={(e) => setNtrp(Number(e.target.value))}>
                {NTRP_STEPS.map((n) => <option key={n} value={n}>{n.toFixed(1)}</option>)}
              </select>
              <button disabled={busy || ntrp === Number(m.ntrp)} onClick={() => act(() => run(adminSetNtrp(m.id, ntrp)), "NTRP를 바꿨어요. 닉네임도 같이 바뀌었어요", true)}
                className="shrink-0 rounded-xl bg-court px-4 font-bold text-white disabled:opacity-40">변경</button>
            </div>
          </div>

          <div>
            <label className={label}>소모임 모임 가입일</label>
            <div className="flex gap-2">
              <div className="flex-1"><SomoimPicker value={somoim} onChange={setSomoim} /></div>
              <button disabled={busy || !somoim || somoim === (m as MemberX).somoimJoined} onClick={() => act(() => run(adminSetSomoim(m.id, somoim)), "소모임 가입일을 바꿨어요")}
                className="shrink-0 rounded-xl bg-court px-4 font-bold text-white disabled:opacity-40">저장</button>
            </div>
          </div>

          {me.isOwner && !isSelf && m.role !== "owner" && (
            <button disabled={busy} onClick={() => act(() => run(ownerSetAdmin(m.id, m.role !== "admin")), m.role === "admin" ? "운영진에서 해제했어요" : "운영진으로 임명했어요", true)}
              className={`w-full rounded-xl py-3 font-bold disabled:opacity-40 ${m.role === "admin" ? "border-2 border-line text-mute" : "bg-ball text-court-deep"}`}>
              {m.role === "admin" ? "운영진 해제" : "운영진으로 임명"}
            </button>
          )}

          {!protectedTarget && !isSelf && (
            <div>
              <label className={label}>경고 주기</label>
              <div className="flex gap-2">
                <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="사유 (예: 노쇼, 당일 취소)" />
                <button disabled={busy || !reason.trim()} onClick={() => act(async () => { await run(adminWarn(m.id, reason)); setReason(""); }, "경고를 남겼어요")}
                  className="shrink-0 rounded-xl bg-clay px-4 font-bold text-white disabled:opacity-40">경고</button>
              </div>
            </div>
          )}

          <div>
            <label className={label}>경고 기록 {warnQ.data ? `${warnQ.data.length}회` : ""}</label>
            {warnQ.data && warnQ.data.length === 0 && <p className="text-[13px] text-mute">경고 기록이 없어요.</p>}
            <ul className="space-y-1.5">
              {warnQ.data?.map((w) => (
                <li key={w.id} className="flex items-start justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-[13px]">
                  <span>{w.at} · {w.reason}<span className="block text-[11px] text-mute">{w.by}</span></span>
                  <button disabled={busy} onClick={() => act(() => run(adminDeleteWarning(w.id)), "경고를 지웠어요")} className="shrink-0 text-[12px] text-mute underline">삭제</button>
                </li>
              ))}
            </ul>
          </div>

          {(!protectedTarget || isSelf) && (
            <div>
              <label className={label}>PIN 초기화</label>
              <div className="flex gap-2">
                <input className={field} value={pin} inputMode="numeric" placeholder="새 PIN 4자리" onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} />
                <button disabled={busy || pin.length !== 4} onClick={() => act(async () => { await run(adminResetPin(m.id, pin)); setPin(""); }, "PIN을 바꿨어요. 본인에게 알려주세요")}
                  className="shrink-0 rounded-xl bg-ink px-4 font-bold text-white disabled:opacity-40">초기화</button>
              </div>
            </div>
          )}

          {!protectedTarget && !isSelf && (
            <button disabled={busy} onClick={() => {
              const r = window.prompt(`${m.nickname} 님을 탈퇴 처리할까요? 앞으로의 일정 참석도 모두 빠져요. 사유를 적어주세요.`);
              if (r === null) return;
              void act(() => run(adminBan(m.id, r)), "탈퇴 처리했어요", true);
            }} className="w-full rounded-xl border-2 border-clay py-3 font-bold text-clay disabled:opacity-40">탈퇴 처리</button>
          )}
          {protectedTarget && <p className="text-[12px] text-mute">{m.role === "owner" ? "방장은 관리할 수 없어요." : "운영진은 방장만 관리할 수 있어요."}</p>}
        </div>
      )}
    </Sheet>
  );
}
