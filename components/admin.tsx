"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  banUnpaid, clearDuesMonth, getDuesBoard, getLeftMembers, getMyDues, remindUnpaid, reportDues, setDues, setDuesConfig,
  type DuesConfig, type DuesRow, type LeftMember,
} from "@/app/dues";
import { adminUnban } from "@/app/actions";
import { getAdminSettings, saveAdminSettings, type PushTexts } from "@/app/extra";
import { Sheet } from "./sheets";
import { errText, kstToday, run, won, type Me } from "./util";

const field = "w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-[15px] text-ink outline-none focus:border-court focus:bg-white";
const label = "mb-1.5 block text-[13px] font-semibold text-mute";

function shiftMonth(ym: string, d: number) {
  const [y, m] = ym.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + d, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}
const monthLabel = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`;

/* ---------- member-facing banner ---------- */

export function DuesBanner({ me, onToast }: { me: Me; onToast: (m: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["myDues", me?.id], queryFn: () => run(getMyDues()), enabled: !!me });
  const [open, setOpen] = useState(false);
  const [payer, setPayer] = useState("");
  const [busy, setBusy] = useState(false);
  const d = q.data;
  if (!me || !d || !d.enabled || !d.required || d.status === "paid" || d.status === "exempt") return null;

  async function send() {
    setBusy(true);
    try {
      await run(reportDues(payer));
      onToast("확인 요청을 보냈어요. 운영진이 확인하면 완료로 바뀌어요");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["myDues"] });
    } catch (e) {
      onToast(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const m = Number(d.month.slice(5));
  const reported = d.status === "reported";
  return (
    <>
      <div className={`mt-4 rounded-2xl px-4 py-3 ring-1 ${reported ? "bg-[#EEF3F0] ring-line" : d.overdue ? "bg-[#FCEDE6] ring-[#F2C6B2]" : "bg-[#FFF6D6] ring-[#EBDCA0]"}`}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-black">
              {reported ? `⏳ ${m}월 회비 확인 중` : d.overdue ? `⚠️ ${m}월 회비 납부 기간이 지났어요` : `💳 ${m}월 회비 ${won(d.amount)}`}
            </p>
            <p className="mt-0.5 text-[12px] text-ink/70">
              {reported ? `입금자명 ${d.payerName} · 운영진이 확인하면 완료로 바뀌어요` : `${d.startDay}~${d.endDay}일 납부 · 미납 시 탈퇴 처리돼요`}
            </p>
          </div>
          <button onClick={() => { setPayer(d.payerName ?? ""); setOpen(true); }}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold ${reported ? "bg-white text-mute ring-1 ring-line" : "bg-ink text-white"}`}>
            {reported ? "수정" : "냈어요"}
          </button>
        </div>
      </div>
      {open && (
        <Sheet title={`${m}월 회비 납부`} onClose={() => setOpen(false)}>
          <div className="rounded-xl bg-paper px-4 py-3">
            <p className="text-[13px] text-mute">금액</p>
            <p className="text-[20px] font-black text-court-deep">{won(d.amount)}</p>
            {d.account && (
              <>
                <p className="mt-2 text-[13px] text-mute">입금 계좌</p>
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-bold">{d.account}</p>
                  <button onClick={() => { void navigator.clipboard.writeText(d.account).then(() => onToast("계좌를 복사했어요")); }}
                    className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold text-court ring-1 ring-line">복사</button>
                </div>
              </>
            )}
            <p className="mt-2 text-[12px] text-mute">납부 기간 매월 {d.startDay}일 ~ {d.endDay}일</p>
          </div>
          <div className="mt-4">
            <label className={label}>입금자명 (운영진이 통장과 맞춰봐요)</label>
            <input className={field} value={payer} onChange={(e) => setPayer(e.target.value)} maxLength={20} placeholder="예: 노신원" />
          </div>
          <button onClick={send} disabled={busy || !payer.trim()} className="mt-5 w-full rounded-2xl bg-court py-4 text-[16px] font-bold text-white disabled:opacity-40">
            {busy ? "보내는 중" : "입금했어요, 확인 요청"}
          </button>
        </Sheet>
      )}
    </>
  );
}

/* ---------- admin tab ---------- */

export function AdminPanel({ me, onToast }: { me: Me; onToast: (m: string) => void }) {
  const [view, setView] = useState<"dues" | "left" | "settings">("dues");
  if (!me?.isAdmin) return <main className="mx-auto max-w-2xl px-4 pt-10 text-center text-mute">운영진만 볼 수 있어요.</main>;
  return (
    <main className="mx-auto max-w-2xl px-4 pt-6">
      <p className="text-[12px] font-bold text-court-deep">🔒 운영진 전용</p>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 ring-1 ring-line">
        {([["dues", "💳 회비"], ["left", "🚪 탈퇴자"], ["settings", "⚙️ 설정"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className={`rounded-xl py-2.5 text-[14px] font-bold ${view === k ? "bg-court-deep text-white" : "text-mute"}`}>{l}</button>
        ))}
      </div>
      {view === "dues" ? <DuesManager onToast={onToast} /> : view === "left" ? <LeftList onToast={onToast} /> : <SettingsView onToast={onToast} />}
    </main>
  );
}

const STATUS: Record<DuesRow["status"], { t: string; c: string }> = {
  reported: { t: "확인 요청", c: "bg-[#FFF6D6] text-[#8A6A00]" },
  unpaid: { t: "미납", c: "bg-[#FCEDE6] text-clay" },
  paid: { t: "납부", c: "bg-[#E3F1EA] text-court-deep" },
  exempt: { t: "면제", c: "bg-paper text-mute" },
  notRequired: { t: "대상 아님", c: "bg-paper text-mute" },
};

function DuesManager({ onToast }: { onToast: (m: string) => void }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(kstToday().slice(0, 7));
  const [filter, setFilter] = useState<"all" | "reported" | "unpaid" | "paid">("all");
  const [cfgOpen, setCfgOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["duesBoard", month], queryFn: () => run(getDuesBoard(month)) });
  const b = q.data;

  const counts = useMemo(() => {
    const c = { reported: 0, unpaid: 0, paid: 0, exempt: 0 };
    for (const r of b?.list ?? []) if (r.status in c) c[r.status as keyof typeof c]++;
    return c;
  }, [b]);
  const list = (b?.list ?? []).filter((r) => (filter === "all" ? r.status !== "notRequired" : r.status === filter));
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["duesBoard"] }); void qc.invalidateQueries({ queryKey: ["myDues"] }); void qc.invalidateQueries({ queryKey: ["members"] }); };

  async function act(p: Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await p;
      if (ok) onToast(ok);
      refresh();
    } catch (e) {
      onToast(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyUnpaid() {
    const names = (b?.list ?? []).filter((r) => r.status === "unpaid").map((r) => r.nickname);
    const text = [`💳 ${Number(month.slice(5))}월 회비 미납자 (${names.length}명) · ${b?.config.endDay}일까지`, ...names].join(String.fromCharCode(10));
    await navigator.clipboard.writeText(text);
    onToast("미납자 명단을 복사했어요");
  }

  async function confirmAllReported() {
    const ids = (b?.list ?? []).filter((r) => r.status === "reported").map((r) => r.id);
    if (!ids.length || !window.confirm(`확인 요청 ${ids.length}건을 모두 납부로 처리할까요?`)) return;
    await act(Promise.all(ids.map((id) => run(setDues(id, month, "paid")))), `${ids.length}건 납부 처리했어요`);
  }

  async function clearMonth() {
    const n = counts.reported + counts.paid + counts.exempt;
    if (!window.confirm(`${Number(month.slice(5))}월 회비 기록 ${n}건(확인 요청·납부·면제)을 모두 지울까요? 모두 미납 상태로 돌아가요.`)) return;
    setBusy(true);
    try {
      const d = await run(clearDuesMonth(month));
      onToast(`${d}건을 지웠어요`);
      refresh();
    } catch (e) {
      onToast(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function banAll() {
    if (!window.confirm(`${Number(month.slice(5))}월 미납자 ${counts.unpaid}명을 탈퇴 처리할까요? 운영진은 제외돼요. 되돌리려면 탈퇴자 목록에서 한 명씩 풀어야 해요.`)) return;
    setBusy(true);
    try {
      const n = await run(banUnpaid(month));
      onToast(`${n}명을 회비 미납으로 탈퇴 처리했어요`);
      refresh();
      void qc.invalidateQueries({ queryKey: ["left"] });
    } catch (e) {
      onToast(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between rounded-2xl bg-white px-2 py-2 ring-1 ring-line">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="grid h-9 w-9 place-items-center rounded-full text-[18px] hover:bg-paper" aria-label="이전 달">‹</button>
        <p className="text-[16px] font-black">{monthLabel(month)}</p>
        <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={!!b && month >= b.current}
          className="grid h-9 w-9 place-items-center rounded-full text-[18px] hover:bg-paper disabled:opacity-30" aria-label="다음 달">›</button>
      </div>

      {q.isLoading && <p className="py-12 text-center text-mute">불러오는 중</p>}
      {q.isError && <p className="py-12 text-center text-clay">{errText(q.error)}</p>}

      {b && (
        <>
          {b.config.amount === 0 ? (
            <div className="mt-3 rounded-2xl border-2 border-dashed border-line bg-white p-5 text-center">
              <p className="font-bold">아직 회비가 설정되지 않았어요</p>
              <p className="mt-1 text-[13px] text-mute">금액과 납부 기간을 정하면 멤버 화면에 납부 안내가 떠요.</p>
              <button onClick={() => setCfgOpen(true)} className="mt-3 rounded-full bg-court px-5 py-2.5 font-bold text-white">회비 설정하기</button>
            </div>
          ) : (
            <>
              <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-line">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] text-mute">매월 {b.config.startDay}~{b.config.endDay}일 · {won(b.config.amount)}</p>
                    <p className="mt-0.5 text-[13px] text-mute">마감 {b.deadline.slice(5).replace("-", "/")} {b.closed ? "· 마감됨" : ""}</p>
                  </div>
                  <button onClick={() => setCfgOpen(true)} className="shrink-0 rounded-full bg-paper px-3 py-1 text-[12px] font-bold text-mute">설정</button>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                  {([["reported", "확인 요청"], ["unpaid", "미납"], ["paid", "납부"], ["all", "전체"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setFilter(k)}
                      className={`rounded-xl py-2 ${filter === k ? "bg-court-deep text-white" : "bg-paper"}`}>
                      <p className="text-[18px] font-black leading-none">{k === "all" ? counts.reported + counts.unpaid + counts.paid + counts.exempt : counts[k]}</p>
                      <p className="mt-1 text-[11px] font-bold opacity-80">{l}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-mute">
                  걷힌 회비 {won(counts.paid * b.config.amount)} · 활동 멤버 {b.stats.active}명 · 이달 신규 {b.stats.joined}명 · 이달 탈퇴 {b.stats.left}명
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {counts.reported > 0 && <button disabled={busy} onClick={confirmAllReported} className="rounded-full bg-court px-3 py-1.5 text-[12px] font-bold text-white">확인 요청 전부 납부 처리</button>}
                  {counts.unpaid > 0 && <button disabled={busy} onClick={copyUnpaid} className="rounded-full bg-paper px-3 py-1.5 text-[12px] font-bold">미납자 명단 복사</button>}
                  {counts.unpaid > 0 && !b.closed && (
                    <button disabled={busy} onClick={() => act(run(remindUnpaid(month)).then((n) => onToast(`알림을 켠 미납자 ${n}명에게 보냈어요`)))}
                      className="rounded-full bg-paper px-3 py-1.5 text-[12px] font-bold">미납자에게 알림 보내기</button>
                  )}
                  {counts.unpaid > 0 && b.closed && (
                    <button disabled={busy} onClick={banAll} className="rounded-full border-2 border-clay px-3 py-1 text-[12px] font-bold text-clay">미납자 {counts.unpaid}명 탈퇴 처리</button>
                  )}
                  {counts.reported + counts.paid + counts.exempt > 0 && (
                    <button disabled={busy} onClick={clearMonth} className="rounded-full px-3 py-1.5 text-[12px] font-bold text-mute underline underline-offset-2">이 달 기록 전체 삭제</button>
                  )}
                </div>
              </div>

              <ul className="mt-3 overflow-hidden rounded-[22px] bg-white ring-1 ring-line">
                {list.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-mute">해당하는 멤버가 없어요</li>}
                {list.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 border-b border-line px-4 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{r.nickname}</p>
                      <p className="text-[12px] text-mute">
                        <span className={`mr-1.5 rounded px-1.5 py-0.5 font-bold ${STATUS[r.status].c}`}>{STATUS[r.status].t}</span>
                        {r.payerName && <>입금자 {r.payerName} · {r.reportedAt}</>}
                        {r.status === "paid" && r.confirmedAt && !r.payerName && <>확인 {r.confirmedAt}</>}
                      </p>
                    </div>
                    {r.status !== "paid" && (
                      <button disabled={busy} onClick={() => act(run(setDues(r.id, month, "paid")))} className="shrink-0 rounded-full bg-court px-3 py-1.5 text-[12px] font-bold text-white">납부 ✓</button>
                    )}
                    <select disabled={busy} value="" onChange={(e) => e.target.value && act(run(setDues(r.id, month, e.target.value as "paid" | "exempt" | "unpaid")))}
                      className="shrink-0 rounded-full bg-paper px-2 py-1.5 text-[12px] font-bold text-mute">
                      <option value="">⋯</option>
                      {r.status !== "unpaid" && <option value="unpaid">기록 삭제 (미납으로)</option>}
                      {r.status !== "exempt" && <option value="exempt">이번 달 면제</option>}
                    </select>
                  </li>
                ))}
              </ul>
            </>
          )}
          {cfgOpen && <DuesConfigSheet initial={b.config} onClose={() => setCfgOpen(false)} onSaved={() => { setCfgOpen(false); refresh(); onToast("회비 설정을 저장했어요"); }} />}
        </>
      )}
    </div>
  );
}

function DuesConfigSheet({ initial, onClose, onSaved }: { initial: DuesConfig; onClose: () => void; onSaved: () => void }) {
  const [c, setC] = useState<DuesConfig>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof DuesConfig>(k: K, v: DuesConfig[K]) => setC((p) => ({ ...p, [k]: v }));
  const days = Array.from({ length: 28 }, (_, i) => i + 1);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await run(setDuesConfig(c));
      onSaved();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="회비 설정" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={label}>월 회비 (0원이면 회비 기능이 꺼져요)</label>
          <div className="relative">
            <input className={`${field} pr-8`} inputMode="numeric" value={c.amount ? c.amount.toLocaleString("ko-KR") : ""}
              onChange={(e) => set("amount", Number(e.target.value.replace(/[^0-9]/g, "").slice(0, 7)) || 0)} placeholder="10,000" />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[14px] text-mute">원</span>
          </div>
        </div>
        <div>
          <label className={label}>납부 기간 (매월)</label>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <select className={field} value={c.startDay} onChange={(e) => set("startDay", Number(e.target.value))}>
              {days.map((d) => <option key={d} value={d}>{d}일</option>)}
            </select>
            <span className="text-mute">~</span>
            <select className={field} value={c.endDay} onChange={(e) => set("endDay", Number(e.target.value))}>
              {days.filter((d) => d >= c.startDay).map((d) => <option key={d} value={d}>{d}일</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>입금 계좌 (멤버 화면에 보여요)</label>
          <input className={field} value={c.account} onChange={(e) => set("account", e.target.value)} maxLength={100} placeholder="카카오뱅크 3333-00-0000000 홍길동" />
        </div>
        <label className="flex items-start gap-2 text-[14px]">
          <input type="checkbox" checked={c.exemptJoinMonth} onChange={(e) => set("exemptJoinMonth", e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#1c6a50]" />
          <span><b>소모임 가입한 달은 면제</b><br /><span className="text-[12px] text-mute">가입한 다음 달부터 회비 대상이 돼요</span></span>
        </label>
        <label className="flex items-start gap-2 text-[14px]">
          <input type="checkbox" checked={c.exemptAdmins} onChange={(e) => set("exemptAdmins", e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#1c6a50]" />
          <span><b>운영진 회비 면제</b></span>
        </label>
      </div>
      {err && <p className="mt-3 rounded-lg bg-[#FCEDE6] px-3 py-2 text-[13px] font-medium text-clay">{err}</p>}
      <button onClick={save} disabled={busy} className="mt-5 w-full rounded-2xl bg-court py-4 text-[16px] font-bold text-white disabled:opacity-40">
        {busy ? "저장 중" : "저장"}
      </button>
      {initial.amount > 0 && (
        <button disabled={busy} onClick={async () => {
          if (!window.confirm("회비 기능을 끌까요? 멤버 화면의 납부 안내와 자동 회비 알림이 멈춰요. 지금까지의 납부 기록은 남아 있어요.")) return;
          setBusy(true);
          try {
            await run(setDuesConfig({ ...c, amount: 0 }));
            onSaved();
          } catch (e) {
            setErr(errText(e));
          } finally {
            setBusy(false);
          }
        }} className="mt-2 w-full py-3 text-[13px] font-semibold text-clay underline underline-offset-4">회비 기능 끄기</button>
      )}
    </Sheet>
  );
}

const KIND: Record<LeftMember["kind"], string> = { unpaid: "💳 회비 미납", kicked: "🚫 운영진 처리", voluntary: "👋 자진 탈퇴" };

function LeftList({ onToast }: { onToast: (m: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["left"], queryFn: () => run(getLeftMembers()) });
  const [kind, setKind] = useState<"all" | LeftMember["kind"]>("all");
  const list = (q.data ?? []).filter((m) => kind === "all" || m.kind === kind);
  const count = (k: LeftMember["kind"]) => (q.data ?? []).filter((m) => m.kind === k).length;

  async function restore(m: LeftMember) {
    if (!window.confirm(`${m.nickname} 님을 다시 멤버로 복귀시킬까요?`)) return;
    try {
      await run(adminUnban(m.id));
      onToast("복귀 처리했어요");
      void qc.invalidateQueries({ queryKey: ["left"] });
      void qc.invalidateQueries({ queryKey: ["members"] });
      void qc.invalidateQueries({ queryKey: ["duesBoard"] });
    } catch (e) {
      onToast(errText(e));
    }
  }

  return (
    <div className="mt-4">
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1.5">
          {([["all", `전체 ${q.data?.length ?? 0}`], ["unpaid", `${KIND.unpaid} ${count("unpaid")}`], ["voluntary", `${KIND.voluntary} ${count("voluntary")}`], ["kicked", `${KIND.kicked} ${count("kicked")}`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${kind === k ? "bg-court-deep text-white" : "bg-white ring-1 ring-line"}`}>{l}</button>
          ))}
        </div>
      </div>
      {q.isLoading && <p className="py-12 text-center text-mute">불러오는 중</p>}
      <ul className="mt-3 overflow-hidden rounded-[22px] bg-white ring-1 ring-line">
        {q.data && list.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-mute">탈퇴자가 없어요</li>}
        {list.map((m) => (
          <li key={m.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{m.nickname}</p>
              <p className="text-[12px] text-mute">{KIND[m.kind]} · {m.leftAt} 탈퇴{m.reason ? ` · ${m.reason}` : ""}</p>
            </div>
            <button onClick={() => restore(m)} className="shrink-0 rounded-full bg-paper px-3 py-1.5 text-[12px] font-bold text-court">복귀</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TEXT_KINDS: [string, string, string][] = [
  ["event", "🎾 새 일정", "{제목} {날짜} {시간} {게임} {정원} {NTRP} {코트} {올린사람}"],
  ["promo", "✅ 참석 확정", "{제목} {시간}"],
  ["notice", "📢 새 공지", "{제목} {내용}"],
  ["dues", "💳 회비 안내 (납부 시작일)", "{월} {금액} {마감일} {계좌}"],
  ["dues_last", "⏰ 회비 마감 D-1", "{월} {금액} {마감일} {계좌}"],
  ["nudge", "🎾 60일 미활동 안내", "{이름} {일수}"],
];

function SettingsView({ onToast }: { onToast: (m: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["adminSettings"], queryFn: () => run(getAdminSettings()) });
  const [start, setStart] = useState<string | null>(null);
  const [texts, setTexts] = useState<PushTexts | null>(null);
  const [busy, setBusy] = useState(false);
  if (!q.data) return <p className="py-12 text-center text-mute">{q.isError ? errText(q.error) : "불러오는 중"}</p>;
  const s = q.data;
  const recordStart = start ?? s.recordStart;
  const t = texts ?? s.pushTexts ?? {};

  async function save(p: Parameters<typeof saveAdminSettings>[0], ok: string) {
    setBusy(true);
    try {
      await run(saveAdminSettings(p));
      onToast(ok);
      void qc.invalidateQueries({ queryKey: ["adminSettings"] });
      void qc.invalidateQueries({ queryKey: ["members"] });
    } catch (e) {
      onToast(errText(e));
    } finally {
      setBusy(false);
    }
  }
  const setText = (k: string, f: "title" | "body", v: string) => setTexts({ ...t, [k]: { title: t[k]?.title ?? "", body: t[k]?.body ?? "", [f]: v } });

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <p className="text-[15px] font-black">📅 활동 기록 시작일</p>
        <p className="mt-1 text-[12px] leading-relaxed text-mute">
          활동 기록이 없는 멤버는 소모임 가입일과 이 날짜 중 늦은 날부터 미참 일수를 세요. 사이트 시작 전부터 활동하던 멤버가 바로 3개월 미참으로 잡히지 않게 해줘요.
        </p>
        <div className="mt-3 flex gap-2">
          <input type="date" className={field} value={recordStart} onChange={(e) => setStart(e.target.value)} />
          <button disabled={busy || recordStart === s.recordStart} onClick={() => save({ recordStart }, "기록 시작일을 저장했어요")}
            className="shrink-0 rounded-xl bg-court px-4 font-bold text-white disabled:opacity-40">저장</button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <p className="text-[15px] font-black">✏️ 알림 문구</p>
        <p className="mt-1 text-[12px] leading-relaxed text-mute">비워두면 기본 문구가 쓰여요. 중괄호 단어는 실제 값으로 바뀌어요.</p>
        <div className="mt-3 space-y-4">
          {TEXT_KINDS.map(([k, name, vars]) => (
            <div key={k} className="rounded-xl bg-paper p-3">
              <p className="text-[13px] font-bold">{name}</p>
              <p className="mt-0.5 text-[11px] text-mute">쓸 수 있는 값: {vars}</p>
              <input className={`${field} mt-2 bg-white`} value={t[k]?.title ?? ""} maxLength={80} placeholder={s.pushDefaults[k]?.title} onChange={(e) => setText(k, "title", e.target.value)} />
              <textarea className={`${field} mt-1.5 min-h-16 bg-white`} value={t[k]?.body ?? ""} maxLength={200} placeholder={s.pushDefaults[k]?.body} onChange={(e) => setText(k, "body", e.target.value)} />
            </div>
          ))}
        </div>
        <button disabled={busy || !texts} onClick={() => save({ pushTexts: t }, "알림 문구를 저장했어요")}
          className="mt-3 w-full rounded-2xl bg-court py-3.5 font-bold text-white disabled:opacity-40">문구 저장</button>
      </div>

      <div className="rounded-2xl bg-white p-4 text-[12px] leading-relaxed text-mute ring-1 ring-line">
        <p className="text-[15px] font-black text-ink">⏰ 자동 알림</p>
        <p className="mt-1">매일 오전 9시에 자동으로 확인해서 보내요.</p>
        <p className="mt-1">· 회비: 납부 시작일과 마감 전날, 미납자에게</p>
        <p>· 미활동: 마지막 활동 후 60일이 된 멤버에게 한 번</p>
      </div>
    </div>
  );
}
