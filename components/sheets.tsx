"use client";

import { useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { completeProfile, createEvent, login, logout, setFreq, signup, updateEvent, type EventInput } from "@/app/actions";
import { PushToggle } from "./push";
import { ClubProfile } from "./club";
import { KakaoPayGuide } from "./KakaoPayGuide";
import { useSessionDraft } from "./useSessionDraft";
import { leaveClub, setPushPrefs, type PushPrefs } from "@/app/extra";
import { errText, FREQS, fmtShort, freqIcon, kstToday, NTRP_GUIDE, NTRP_STEPS, perHead, run, won, type Ev, type Freq, type Me } from "./util";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const startedOnBackdrop = useRef(false);
  const endedOnBackdrop = useRef(false);
  return (
    <div data-sheet-backdrop className="fixed inset-0 z-50 flex items-end justify-center bg-[#0E2A20]/55 sm:items-center"
      onPointerDown={(e) => { startedOnBackdrop.current = e.target === e.currentTarget; endedOnBackdrop.current = false; }}
      onPointerUp={(e) => { endedOnBackdrop.current = e.target === e.currentTarget; }}
      onPointerCancel={() => { startedOnBackdrop.current = false; endedOnBackdrop.current = false; }}
      onClick={(e) => { if (e.target === e.currentTarget && startedOnBackdrop.current && endedOnBackdrop.current) onClose(); startedOnBackdrop.current = false; endedOnBackdrop.current = false; }}>
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white px-5 pb-8 pt-4 shadow-2xl sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-mute hover:bg-paper" aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const field = "w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-[15px] text-ink outline-none focus:border-court focus:bg-white";
const label = "mb-1.5 block text-[13px] font-semibold text-mute";

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-xl bg-paper p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(([v, l]) => (
        <button type="button" key={v} onClick={() => onChange(v)}
          className={`rounded-lg py-2.5 text-[14px] font-semibold transition ${value === v ? "bg-white text-court-deep shadow-sm" : "text-mute"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function ErrorLine({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p role="alert" className="mt-3 rounded-lg bg-[#FCEDE6] px-3 py-2 text-[13px] font-medium text-clay">{msg}</p>;
}

type FormIssue = { field: string; message: string };
function focusIssue(id: string) {
  const target = document.getElementById(id);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  target?.focus({ preventScroll: true });
}
function FieldIssue({ issue, id }: { issue?: FormIssue; id: string }) {
  return issue ? <p id={id} className="mt-1 text-[12px] font-semibold text-clay">{issue.message}</p> : null;
}
function ValidationSummary({ issues, prefix }: { issues: FormIssue[]; prefix: string }) {
  if (!issues.length) return null;
  return <div role="alert" className="mt-4 rounded-xl bg-[#FCEDE6] p-3 text-[13px] text-clay"><p className="font-bold">아래 항목을 확인해주세요.</p><ul className="mt-1 list-inside list-disc space-y-1">{issues.map(x => <li key={x.field}><button type="button" className="text-left underline underline-offset-2" onClick={() => focusIssue(`${prefix}-${x.field}`)}>{x.message}</button></li>)}</ul></div>;
}
function DraftNotice({ restored, onReset, pin = false }: { restored: boolean; onReset: () => void; pin?: boolean }) {
  return <div className="mt-3 flex items-start justify-between gap-2 rounded-xl bg-paper p-3 text-[12px] text-mute"><p>{restored ? "작성 중인 내용을 불러왔어요." : "닫았다가 다시 열어도 작성 내용이 유지돼요."}<br />이 탭에서 최대 하루 동안 임시 저장해요.{pin && " PIN은 다시 입력해주세요."}</p><button type="button" onClick={onReset} className="shrink-0 font-semibold underline underline-offset-2">입력 초기화</button></div>;
}

const YEARS = Array.from({ length: 2012 - 1950 + 1 }, (_, i) => 2012 - i);

export function SomoimPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  return (
    <input type="date" aria-label="소모임 모임 가입일" className={field} value={value} min="2015-01-01" max={today}
      onChange={(e) => onChange(e.target.value)} />
  );
}
const yy = (y: number) => String(y).slice(2);

export function nickPreview(name: string, year: number | "", region: string, gender: "M" | "F", ntrp: number | null, freq: Freq | null) {
  const parts = [name.trim() || "이름", year ? yy(year) : "00", region.trim() || "지하철역", gender === "M" ? "남" : "여"];
  if (ntrp != null) parts.push(ntrp.toFixed(1) + freqIcon(freq));
  return parts.join("/");
}

function FreqPicker({ value, onChange }: { value: Freq | null; onChange: (f: Freq) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {FREQS.map((f) => (
        <button type="button" key={f.v} onClick={() => onChange(f.v)}
          className={`rounded-lg px-2 py-2.5 text-[13px] font-semibold ${value === f.v ? "bg-court text-white" : "bg-paper text-ink"}`}>
          {f.icon} {f.text}
        </button>
      ))}
    </div>
  );
}

function NtrpPicker({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-bold text-court-deep">STEP UP NTRP</p>
      <div className="space-y-1.5">
        {NTRP_GUIDE.map((g) => (
          <button type="button" key={g.n} onClick={() => onChange(g.n)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${value === g.n ? "bg-court text-white" : "bg-paper text-ink"}`}>
            <span className="w-9 shrink-0 text-[15px] font-black">{g.n.toFixed(1)}</span>
            <span className="text-[18px] leading-none">{g.icon}</span>
            <span className={`text-[13px] ${value === g.n ? "text-white/90" : "text-mute"}`}>{g.text}</span>
          </button>
        ))}
      </div>
      <p className="mb-1.5 mt-3 text-[12px] text-mute">3.5 ~ 7.0 · 📌 모임어플 [가입인사양식] 하단 사진 참고</p>
      <div className="grid grid-cols-8 gap-1.5">
        {NTRP_STEPS.filter((n) => n >= 3.5).map((n) => (
          <button type="button" key={n} onClick={() => onChange(n)}
            className={`rounded-lg py-2 text-[13px] font-bold ${value === n ? "bg-court text-white" : "bg-paper text-ink"}`}>
            {n.toFixed(1)}
          </button>
        ))}
      </div>
      <p className="mt-2 rounded-lg bg-[#FCEDE6] px-3 py-2 text-[12px] font-medium leading-relaxed text-clay">
        ⚠️ NTRP는 한 번 정하면 승급전이나 운영진의 별도 승급 외에는 바꿀 수 없어요. 신중하게 골라주세요.
      </p>
    </div>
  );
}

type AuthDraft = { mode: "login" | "signup"; name: string; year: number | ""; region: string; gender: "M" | "F"; ntrp: number | null; freq: Freq | null; somoim: string; legacy: boolean };
const emptyAuth = (): AuthDraft => ({ mode: "login", name: "", year: "", region: "", gender: "M", ntrp: null, freq: null, somoim: "", legacy: false });
function isAuthDraft(value: unknown): value is AuthDraft {
  const d = value as AuthDraft | null;
  return !!d && ["login", "signup"].includes(d.mode) && [d.name, d.region, d.somoim].every(x => typeof x === "string") && (d.year === "" || YEARS.includes(d.year)) && ["M", "F"].includes(d.gender) && (d.ntrp === null || NTRP_STEPS.includes(d.ntrp)) && (d.freq === null || FREQS.some(f => f.v === d.freq)) && typeof d.legacy === "boolean";
}

export function AuthSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { value: draft, setValue: setDraft, restored, clearDraft, resetDraft } = useSessionDraft("rb:auth-draft:v1", emptyAuth, isAuthDraft);
  const { mode, name, year, region, gender, ntrp, freq, somoim, legacy } = draft;
  const change = <K extends keyof AuthDraft>(key: K, value: AuthDraft[K]) => setDraft(d => ({ ...d, [key]: value }));
  const setName = (v: string) => change("name", v);
  const setYear = (v: number | "") => change("year", v);
  const setRegion = (v: string) => change("region", v);
  const setGender = (v: "M" | "F") => change("gender", v);
  const setNtrp = (v: number) => change("ntrp", v);
  const setFreqV = (v: Freq) => change("freq", v);
  const setSomoim = (v: string) => change("somoim", v);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const issues: FormIssue[] = [];
  if (!name.trim()) issues.push({ field: "name", message: legacy && mode === "login" ? "예전 닉네임을 입력해주세요." : "이름을 입력해주세요." });
  if (!year && !(mode === "login" && legacy)) issues.push({ field: "year", message: "출생연도를 선택해주세요." });
  if (mode === "signup") {
    if (!region.trim()) issues.push({ field: "region", message: "지하철역을 입력해주세요." });
    else if (!region.trim().endsWith("역") || region.trim().length < 2) issues.push({ field: "region", message: "지하철역 이름을 역까지 입력해주세요. 예: 삼전역" });
    if (ntrp === null) issues.push({ field: "ntrp", message: "NTRP를 선택해주세요." });
    if (freq === null) issues.push({ field: "freq", message: "실외코트 활동 빈도를 선택해주세요." });
    if (!somoim) issues.push({ field: "somoim", message: "소모임 가입일을 선택해주세요." });
    else if (somoim > kstToday()) issues.push({ field: "somoim", message: "소모임 가입일은 오늘까지 선택할 수 있어요." });
  }
  if (pin.length !== 4) issues.push({ field: "pin", message: "PIN 숫자 4자리를 입력해주세요." });
  const ready = issues.length === 0;
  const issueFor = (field: string) => attempted ? issues.find(x => x.field === field) : undefined;

  async function submit() {
    setAttempted(true);
    if (!ready) { setErr(null); focusIssue(`auth-${issues[0].field}`); return; }
    setBusy(true);
    setErr(null);
    try {
      if (mode === "login") await run(login(name, legacy || !year ? "" : yy(year), pin));
      else await run(signup({ name, yy: yy(year as number), region, gender, ntrp: ntrp as number, freq: freq as Freq, somoim, pin }));
      clearDraft();
      onDone();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={mode === "login" ? "로그인" : "처음 오셨나요? 가입하기"} onClose={() => { if (!busy) onClose(); }}>
      <Seg value={mode} onChange={(m) => { change("mode", m); setErr(null); setAttempted(false); }} options={[["login", "로그인"], ["signup", "가입"]]} />
      <DraftNotice restored={restored} pin onReset={() => { resetDraft(); change("mode", mode); setPin(""); setErr(null); setAttempted(false); }} />
      <div className="mt-4 space-y-4">
        <div className={legacy && mode === "login" ? "" : "grid grid-cols-[1fr_auto] gap-2"}>
          <div>
            <label htmlFor="auth-name" className={label}>{legacy && mode === "login" ? "예전 닉네임 (전체 그대로)" : "이름"}</label>
            <input id="auth-name" aria-invalid={!!issueFor("name")} aria-describedby="auth-name-error" className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={legacy ? 40 : 10} autoComplete="name" />
            <FieldIssue id="auth-name-error" issue={issueFor("name")} />
          </div>
          {!(legacy && mode === "login") && (
            <div>
              <label htmlFor="auth-year" className={label}>출생연도</label>
              <select id="auth-year" aria-invalid={!!issueFor("year")} aria-describedby="auth-year-error" className={`${field} w-32`} value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}>
                <option value="">선택</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}년생</option>)}
              </select>
              <FieldIssue id="auth-year-error" issue={issueFor("year")} />
            </div>
          )}
        </div>
        {mode === "signup" && (
          <>
            <div>
              <label htmlFor="auth-region" className={label}>지하철역</label>
              <input id="auth-region" aria-invalid={!!issueFor("region")} aria-describedby="auth-region-error" className={field} value={region} onChange={(e) => setRegion(e.target.value.replace(/[/]/g, ""))} maxLength={12} placeholder="예: 삼전역" />
              <FieldIssue id="auth-region-error" issue={issueFor("region")} />
            </div>
            <div>
              <label className={label}>성별</label>
              <Seg value={gender} onChange={setGender} options={[["M", "남"], ["F", "여"]]} />
            </div>
            <div id="auth-ntrp" tabIndex={-1} aria-describedby="auth-ntrp-error">
              <label className={label}>NTRP</label>
              <NtrpPicker value={ntrp} onChange={setNtrp} />
              <FieldIssue id="auth-ntrp-error" issue={issueFor("ntrp")} />
            </div>
            <div id="auth-freq" tabIndex={-1} aria-describedby="auth-freq-error">
              <label className={label}>실외코트 활동 빈도</label>
              <FreqPicker value={freq} onChange={setFreqV} />
              <FieldIssue id="auth-freq-error" issue={issueFor("freq")} />
            </div>
            <div id="auth-somoim" tabIndex={-1} aria-describedby="auth-somoim-error">
              <label className={label}>소모임 모임 가입일</label>
              <SomoimPicker value={somoim} onChange={setSomoim} />
              <FieldIssue id="auth-somoim-error" issue={issueFor("somoim")} />
              <p className="mt-1.5 text-[12px] text-mute">소모임 앱에서 우리 모임에 가입한 날짜예요. 활동 기록의 기준이 돼요.</p>
            </div>
          </>
        )}
        <div>
          <label htmlFor="auth-pin" className={label}>PIN 숫자 4자리</label>
          <input id="auth-pin" aria-invalid={!!issueFor("pin")} aria-describedby="auth-pin-error" className={`${field} tracking-[0.6em]`} value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            inputMode="numeric" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          <FieldIssue id="auth-pin-error" issue={issueFor("pin")} />
        </div>
        {mode === "signup" && (
          <div className="rounded-xl border border-line px-3 py-2.5">
            <p className="text-[12px] text-mute">닉네임은 이렇게 자동으로 만들어져요</p>
            <p className="mt-0.5 text-[16px] font-black text-court-deep">{nickPreview(name, year, region, gender, ntrp, freq)}</p>
          </div>
        )}
      </div>
      {attempted && <ValidationSummary issues={issues} prefix="auth" />}
      <ErrorLine msg={err} />
      <button onClick={submit} disabled={busy}
        className={`mt-5 w-full rounded-2xl bg-court py-4 text-[16px] font-bold text-white transition active:scale-[0.99] disabled:opacity-40 ${!ready ? "opacity-50" : ""}`}>
        {busy ? "잠시만요" : mode === "login" ? "들어가기" : "가입하고 시작하기"}
      </button>
      {mode === "login" && (
        <div className="mt-3 space-y-1 text-center text-[12px] text-mute">
          <button onClick={() => change("legacy", !legacy)} className="underline underline-offset-2">
            {legacy ? "이름 + 출생연도로 로그인" : "예전에 닉네임으로 가입했어요"}
          </button>
          <p>PIN을 잊었으면 운영진에게 초기화를 부탁하세요.</p>
        </div>
      )}
    </Sheet>
  );
}

export function CompleteProfileSheet({ me, onDone }: { me: NonNullable<Me>; onDone: () => void }) {
  const hasName = !!me.name;
  const [name, setName] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [region, setRegion] = useState("");
  const [freq, setFreqV] = useState<Freq | null>(me.freq);
  const [somoim, setSomoim] = useState(me.somoim ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = !!freq && !!somoim && (hasName || (!!name.trim() && !!year && !!region.trim()));

  async function save() {
    if (!hasName && !region.trim().endsWith("역")) { setErr("지하철역 이름을 역까지 입력해주세요. 예: 삼전역"); return; }
    setBusy(true);
    setErr(null);
    try {
      await run(completeProfile(name, year ? yy(year) : "", region, freq, somoim));
      onDone();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="프로필을 채워주세요" onClose={() => {}}>
      <p className="mb-4 text-[14px] text-mute">
        {hasName ? "몇 가지 정보가 새로 필요해졌어요. 한 번만 입력하면 돼요." : <>닉네임 규칙이 <b className="text-ink">이름/출생연도/지하철역/성별/NTRP+활동빈도</b>로 바뀌었어요. 한 번만 입력하면 닉네임이 자동으로 바뀝니다.</>}
      </p>
      <div className="space-y-4">
        {!hasName && (
          <>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <label className={label}>이름</label>
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={10} />
              </div>
              <div>
                <label className={label}>출생연도</label>
                <select className={`${field} w-32`} value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">선택</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}년생</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={label}>지하철역</label>
              <input className={field} value={region} onChange={(e) => setRegion(e.target.value.replace(/[/]/g, ""))} maxLength={12} placeholder="예: 삼전역" />
            </div>
          </>
        )}
        {!me.freq && (
          <div>
            <label className={label}>실외코트 활동 빈도</label>
            <FreqPicker value={freq} onChange={setFreqV} />
          </div>
        )}
        {!me.somoim && (
          <div>
            <label className={label}>소모임 모임 가입일</label>
            <SomoimPicker value={somoim} onChange={setSomoim} />
            <p className="mt-1.5 text-[12px] text-mute">소모임 앱에서 우리 모임에 가입한 날짜예요. 활동 기록의 기준이 돼요.</p>
          </div>
        )}
        {!hasName && (
          <div className="rounded-xl border border-line px-3 py-2.5">
            <p className="text-[12px] text-mute">새 닉네임</p>
            <p className="mt-0.5 text-[16px] font-black text-court-deep">{nickPreview(name, year, region, me.gender, Number(me.ntrp), freq)}</p>
          </div>
        )}
      </div>
      <ErrorLine msg={err} />
      <button onClick={save} disabled={busy || !ok}
        className="mt-5 w-full rounded-2xl bg-court py-4 text-[16px] font-bold text-white disabled:opacity-40">
        {busy ? "저장 중" : "저장하기"}
      </button>
    </Sheet>
  );
}

export function ProfileSheet({ me, onClose, onDone }: { me: NonNullable<Me>; onClose: () => void; onDone: () => void }) {
  const [freq, setFreqV] = useState<Freq | null>(me.freq);
  const [note, setNote] = useState<string | null>(null);

  async function changeFreq(f: Freq) {
    setFreqV(f);
    setNote(null);
    try {
      await run(setFreq(f));
      setNote("활동 빈도를 바꿨어요. 닉네임에도 반영됐어요.");
      onDone();
    } catch (e) {
      setNote(errText(e));
    }
  }

  return (
    <Sheet title={me.nickname} onClose={onClose}>
      <div className="flex items-center justify-between rounded-xl bg-paper px-4 py-3">
        <div>
          <p className="text-[12px] text-mute">내 NTRP</p>
          <p className="text-[22px] font-black text-court-deep">{Number(me.ntrp).toFixed(1)}</p>
        </div>
        <p className="max-w-[60%] text-right text-[12px] text-mute">승급전이나 운영진만 바꿀 수 있어요</p>
      </div>
      {me.isOwner ? (
        <p className="mt-3 text-[13px] font-semibold text-court">방장 계정이에요. 멤버 탭에서 운영진을 임명할 수 있어요.</p>
      ) : me.isAdmin ? (
        <p className="mt-3 text-[13px] font-semibold text-court">운영진 계정이에요. 멤버 탭에서 멤버를 관리할 수 있어요.</p>
      ) : null}
      {me.warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-[#F2C6B2] bg-[#FCEDE6] px-4 py-3">
          <p className="text-[13px] font-bold text-clay">받은 경고 {me.warnings.length}회</p>
          <ul className="mt-1.5 space-y-1 text-[13px] text-ink/80">
            {me.warnings.map((w, i) => <li key={i}>{w.at} · {w.reason}</li>)}
          </ul>
        </div>
      )}
      <div className="mt-5">
        <label className={label}>실외코트 활동 빈도 (언제든 바꿀 수 있어요)</label>
        <FreqPicker value={freq} onChange={changeFreq} />
        {note && <p className="mt-2 text-[12px] text-court-deep">{note}</p>}
      </div>
      <div className="mt-5">
        <label className={label}>알림</label>
        <PushToggle />
        <PrefToggles me={me} />
      </div>
      <ClubProfile me={me} onToast={setNote} />
      <button onClick={async () => { await logout(); onDone(); onClose(); }} className="mt-6 w-full py-3 text-[14px] font-semibold text-mute underline underline-offset-4">
        로그아웃
      </button>
      {!me.isOwner && <LeaveBox onLeft={() => { onDone(); onClose(); }} />}
    </Sheet>
  );
}

function MoneyInput({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder: string }) {
  return (
    <div className="relative">
      <input className={`${field} pr-8`} inputMode="numeric" placeholder={placeholder} value={value ? value.toLocaleString("ko-KR") : ""}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9]/g, "").slice(0, 8)) || 0)} />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[14px] text-mute">원</span>
    </div>
  );
}

type PayFields = { payLink: string; account: string };
type PayMode = "none" | "kakao" | "account";
type EventDraft = { f: EventInput; pay: PayFields; payMode: PayMode };
function isEventDraft(value: unknown): value is EventDraft {
  const d = value as EventDraft | null;
  return !!d?.f && !!d.pay && ["none", "kakao", "account"].includes(d.payMode)
    && [d.pay.payLink, d.pay.account, d.f.court, d.f.date, d.f.startTime, d.f.endTime, d.f.note].every(v => typeof v === "string")
    && ["any", "mens", "womens", "mixed"].includes(d.f.gameType)
    && [d.f.capacity, d.f.maleCap, d.f.femaleCap, d.f.courtFee, d.f.ballFee, d.f.cancelHours].every(v => typeof v === "number" && Number.isFinite(v))
    && [d.f.ntrpMin, d.f.ntrpMax].every(v => v === null || typeof v === "number");
}

export function EventSheet({ initial, defaults, userId, onClose, onDone }: { initial?: Ev; defaults?: Partial<PayFields>; userId: number; onClose: () => void; onDone: () => void }) {
  const ip = initial as unknown as { payLink?: string | null; account?: string | null } | undefined;
  const initialDraft = (): EventDraft => ({ pay: {
    payLink: (initial ? ip?.payLink : defaults?.payLink) ?? "",
    account: (initial ? ip?.account : defaults?.account) ?? "",
  }, payMode:
    (initial ? ip?.payLink : defaults?.payLink) ? "kakao" : (initial ? ip?.account : defaults?.account) ? "account" : "none",
    f:
    initial
      ? { title: initial.title, court: initial.court, date: initial.date, startTime: initial.startTime, endTime: initial.endTime, gameType: initial.gameType,
          capacity: initial.capacity, maleCap: initial.gameType === "mixed" ? initial.maleCap : 2, femaleCap: initial.gameType === "mixed" ? initial.femaleCap : 2, ntrpMin: initial.ntrpMin, ntrpMax: initial.ntrpMax,
          cancelHours: initial.cancelHours, note: initial.note, courtFee: initial.courtFee, ballFee: initial.ballFee }
      : { title: "", court: "", date: kstToday(), startTime: "08:00", endTime: "10:00", gameType: "any", capacity: 6, maleCap: 2, femaleCap: 2,
          ntrpMin: null, ntrpMax: null, cancelHours: 0, note: "", courtFee: 0, ballFee: 0 },
  });
  const { value: draft, setValue: setDraft, restored, clearDraft, resetDraft } = useSessionDraft(`rb:event-draft:v1:${userId}:${initial?.id ?? "new"}`, initialDraft, isEventDraft);
  const { f, pay, payMode } = draft;
  const setF: Dispatch<SetStateAction<EventInput>> = update => setDraft(d => ({ ...d, f: typeof update === "function" ? update(d.f) : update }));
  const setPay: Dispatch<SetStateAction<PayFields>> = update => setDraft(d => ({ ...d, pay: typeof update === "function" ? update(d.pay) : update }));
  const setPayMode = (payMode: PayMode) => setDraft(d => ({ ...d, payMode }));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v === "" ? null : Number(v));
  const seats = f.gameType === "mixed" ? f.maleCap + f.femaleCap : f.capacity;
  const autoTitle = /^\d{4}-\d{2}-\d{2}$/.test(f.date) && f.court.trim() ? `${fmtShort(f.date)} ${f.court.trim()}` : "날짜와 코트를 입력하면 제목이 만들어져요";
  const issues: FormIssue[] = [];
  if (!f.court.trim()) issues.push({ field: "court", message: "코트명을 입력해주세요." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) issues.push({ field: "date", message: "정모 날짜를 선택해주세요." });
  if (!f.startTime || !f.endTime || f.endTime <= f.startTime) issues.push({ field: "start", message: "시작·종료 시간을 확인해주세요. 종료는 시작보다 늦어야 해요." });
  if (f.gameType === "mixed" ? !Number.isInteger(f.maleCap) || !Number.isInteger(f.femaleCap) || f.maleCap < 0 || f.femaleCap < 0 || f.maleCap > 20 || f.femaleCap > 20 || seats < 1 : !Number.isInteger(seats) || seats < 1 || seats > 40) issues.push({ field: "capacity", message: "정원을 확인해주세요. 일반 정모는 1~40명, 혼복은 성별당 0~20명이에요." });
  if (f.ntrpMin !== null && f.ntrpMax !== null && f.ntrpMin > f.ntrpMax) issues.push({ field: "ntrp", message: "최소 NTRP는 최대 NTRP보다 높을 수 없어요." });
  if (payMode === "kakao" && !/^https:\/\/([a-z0-9-]+\.)*kakaopay\.com\/\S+$/i.test(pay.payLink)) issues.push({ field: "payment", message: "카카오페이 송금 링크를 붙여넣어주세요." });
  if (payMode === "account" && !pay.account.trim()) issues.push({ field: "payment", message: "송금 받을 은행·계좌번호·예금주를 입력해주세요." });

  async function save() {
    setAttempted(true);
    if (issues.length) { setErr(null); focusIssue(`event-${issues[0].field}`); return; }
    setBusy(true);
    setErr(null);
    try {
      const body = { ...f, title: "", payLink: payMode === "kakao" ? pay.payLink : "", account: payMode === "account" ? pay.account : "" } as EventInput;
      if (initial) await run(updateEvent(initial.id, body));
      else await run(createEvent(body));
      clearDraft();
      onDone();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={initial ? "일정 고치기" : "코트 잡았어요"} onClose={() => { if (!busy) onClose(); }}>
      <div className="mb-4"><DraftNotice restored={restored} onReset={() => { resetDraft(); setErr(null); setAttempted(false); }} /></div>
      <div className="space-y-4">
        <div>
          <label htmlFor="event-court" className={label}>코트</label>
          <input id="event-court" className={field} value={f.court} onChange={(e) => set("court", e.target.value)} maxLength={40} placeholder="예: 잠실유수지" aria-invalid={attempted && !f.court.trim()} aria-describedby="event-court-error" />
          <FieldIssue id="event-court-error" issue={attempted ? issues.find(x => x.field === "court") : undefined} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 sm:col-span-1">
            <label htmlFor="event-date" className={label}>날짜</label>
            <input id="event-date" type="date" className={field} value={f.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="col-span-3 grid grid-cols-2 gap-2 sm:col-span-2">
            <div>
              <label htmlFor="event-start" className={label}>시작</label>
              <input id="event-start" type="time" step={1800} className={field} value={f.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </div>
            <div>
              <label htmlFor="event-end" className={label}>끝</label>
              <input id="event-end" type="time" step={1800} className={field} value={f.endTime} onChange={(e) => set("endTime", e.target.value)} />
            </div>
          </div>
        </div>
        <div>
          <label className={label}>게임</label>
          <Seg value={f.gameType} onChange={(v) => set("gameType", v)} options={[["any", "자유"], ["mixed", "혼복"], ["mens", "남복"], ["womens", "여복"]]} />
        </div>
        {f.gameType === "mixed" ? (
          <div id="event-capacity" tabIndex={-1} className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>남자 자리</label>
              <input type="number" min={0} max={20} className={field} value={f.maleCap} onChange={(e) => set("maleCap", Number(e.target.value))} />
            </div>
            <div>
              <label className={label}>여자 자리</label>
              <input type="number" min={0} max={20} className={field} value={f.femaleCap} onChange={(e) => set("femaleCap", Number(e.target.value))} />
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="event-capacity" className={label}>정원 (넘치면 자동으로 대기)</label>
            <input id="event-capacity" type="number" min={1} max={40} className={field} value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value))} />
          </div>
        )}
        <div>
          <label className={label}>비용 (N빵 자동 계산)</label>
          <div className="grid grid-cols-2 gap-2">
            <MoneyInput placeholder="코트 대여비" value={f.courtFee} onChange={(v) => set("courtFee", v)} />
            <MoneyInput placeholder="캔볼 값" value={f.ballFee} onChange={(v) => set("ballFee", v)} />
          </div>
          {f.courtFee + f.ballFee > 0 && (
            <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-[13px] text-court-deep">
              합계 {won(f.courtFee + f.ballFee)} · 정원 {seats}명 다 차면 1인 <b>{won(perHead(f.courtFee + f.ballFee, seats))}</b>
            </p>
          )}
        </div>
        <div id="event-payment" tabIndex={-1}>
          <label className={label}>💸 송금 받을 곳 (하나만 골라요 · 다음 일정에 자동으로 채워져요)</label>
          <Seg value={payMode} onChange={setPayMode} options={[["none", "안 받음"], ["kakao", "카카오페이"], ["account", "계좌번호"]]} />
          {payMode === "kakao" && (
            <>
              <input className={`${field} mt-2`} value={pay.payLink} onChange={(e) => setPay((p) => ({ ...p, payLink: e.target.value.trim() }))}
                placeholder="https://qr.kakaopay.com/..." inputMode="url" />
              <KakaoPayGuide />
            </>
          )}
          {payMode === "account" && (
            <>
              <input className={`${field} mt-2`} value={pay.account} onChange={(e) => setPay((p) => ({ ...p, account: e.target.value }))}
                maxLength={80} placeholder="은행 · 계좌번호 · 예금주 (예: 카카오뱅크 3333-01-234567 홍길동)" />
              <p className="mt-1.5 text-[12px] text-mute">참석자에게는 계좌번호와 &quot;계좌 복사&quot; 버튼이 보여요.</p>
            </>
          )}
        </div>
        <div id="event-ntrp" tabIndex={-1}>
          <label className={label}>NTRP 제한 (비워두면 누구나)</label>
          <div className="grid grid-cols-2 gap-2">
            <select className={field} value={f.ntrpMin ?? ""} onChange={(e) => set("ntrpMin", num(e.target.value))}>
              <option value="">최소 없음</option>
              {NTRP_STEPS.map((n) => <option key={n} value={n}>{n.toFixed(1)} 이상</option>)}
            </select>
            <select className={field} value={f.ntrpMax ?? ""} onChange={(e) => set("ntrpMax", num(e.target.value))}>
              <option value="">최대 없음</option>
              {NTRP_STEPS.map((n) => <option key={n} value={n}>{n.toFixed(1)} 이하</option>)}
            </select>
          </div>
        </div>
        <p className="rounded-xl bg-paper p-3 text-[12px] text-mute">모든 정모에 모임의 취소·지각 규칙을 적용해요. 취소 시점에 따른 벌칙과 대참 안내는 참가 화면에서 확인할 수 있어요.</p>
        <div>
          <p className={label}>자동 생성 제목</p>
          <output aria-label="자동 생성 제목" className="block rounded-xl bg-paper px-3.5 py-3 text-[15px] font-bold text-court-deep">{autoTitle}</output>
          <p className="mt-1.5 text-[12px] text-mute">날짜·요일·코트명으로 정해져요. 별도 안내는 아래 메모에 적어주세요.</p>
        </div>
        <div>
          <label className={label}>메모</label>
          <textarea className={`${field} min-h-20`} value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={300} placeholder="코트 번호, 공 준비, 비 오면 취소 등" />
        </div>
      </div>
      {attempted && <ValidationSummary issues={issues} prefix="event" />}
      <ErrorLine msg={err} />
      <button onClick={save} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-clay py-4 text-[16px] font-bold text-white disabled:opacity-40">
        {busy ? "올리는 중" : initial ? "고친 내용 저장" : "일정 올리기"}
      </button>
    </Sheet>
  );
}

const PREF_LABELS: [keyof PushPrefs, string, string][] = [
  ["event", "🎾 새 일정", "내가 참석할 수 있는 일정이 올라오면"],
  ["promo", "✅ 참석 확정", "대기에서 참석으로 바뀌면"],
  ["comment", "💬 댓글", "내 일정·참석 일정·내 공지에 댓글이 달리면"],
  ["notice", "📢 공지", "새 공지가 올라오면"],
];

function PrefToggles({ me }: { me: NonNullable<Me> }) {
  const init = (me as unknown as { pushPrefs?: PushPrefs }).pushPrefs ?? { event: true, notice: true, comment: true, promo: true };
  const [prefs, setPrefs] = useState<PushPrefs>(init);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(k: keyof PushPrefs) {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    setErr(null);
    try {
      await run(setPushPrefs({ [k]: next[k] }));
    } catch (e) {
      setPrefs(prefs);
      setErr(errText(e));
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-line">
      <p className="bg-paper px-3 py-2 text-[12px] font-bold text-mute">받을 알림 고르기</p>
      {PREF_LABELS.map(([k, t, d]) => (
        <button key={k} type="button" onClick={() => toggle(k)} className="flex w-full items-center gap-3 border-t border-line px-3 py-2.5 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">{t}</span>
            <span className="block text-[12px] text-mute">{d}</span>
          </span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${prefs[k] ? "bg-court" : "bg-line"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${prefs[k] ? "left-[22px]" : "left-0.5"}`} />
          </span>
        </button>
      ))}
      <p className="border-t border-line px-3 py-2 text-[11px] text-mute">회비 안내와 활동 안내 알림은 운영상 꺼지지 않아요.</p>
      {err && <p className="px-3 pb-2 text-[12px] text-clay">{err}</p>}
    </div>
  );
}

function LeaveBox({ onLeft }: { onLeft: () => void }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function leave() {
    if (!window.confirm("정말 탈퇴할까요? 앞으로의 일정 참석도 모두 빠지고, 다시 들어오려면 운영진의 복귀 처리가 필요해요.")) return;
    setBusy(true);
    setErr(null);
    try {
      await run(leaveClub(pin));
      onLeft();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="w-full pb-1 text-[12px] text-mute/70 underline underline-offset-4">모임 탈퇴하기</button>;
  return (
    <div className="mt-2 rounded-xl border border-[#F2C6B2] bg-[#FCEDE6] p-3">
      <p className="text-[13px] font-bold text-clay">모임 탈퇴</p>
      <p className="mt-1 text-[12px] text-ink/70">확인을 위해 PIN 4자리를 입력해주세요.</p>
      <div className="mt-2 flex gap-2">
        <input className={`${field} tracking-[0.6em]`} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} />
        <button disabled={busy || pin.length !== 4} onClick={leave} className="shrink-0 rounded-xl bg-clay px-4 font-bold text-white disabled:opacity-40">탈퇴</button>
      </div>
      {err && <p className="mt-2 text-[12px] text-clay">{err}</p>}
    </div>
  );
}
