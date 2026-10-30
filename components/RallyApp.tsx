"use client";

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { addComment, deleteComment, deleteEvent, getMe, listEvents, respond } from "@/app/actions";
import { getRanking } from "@/app/ranking";
import { flushPromotions } from "@/app/promo";
import { PushToggle } from "./push";
import { MembersPanel } from "./members";
import { NoticesPanel } from "./notices";
import { AdminPanel, DuesBanner } from "./admin";
import { listPastEvents, setAttendance } from "@/app/extra";
import { AuthSheet, CompleteProfileSheet, EventSheet, ProfileSheet } from "./sheets";
import { ClubRules, EventOperations, MyClub } from "./club";
import { cancelRegistration, getCancelQuote, getClubCapabilities } from "@/app/club";
import { daysLeft, errText, fmtClock, fmtDate, fmtShort, GAME_LABEL, ntrpLabel, perHead, run, weekday, won, type Ev, type Me } from "./util";

const HERO = "https://d8j0ntlcm91z4.cloudfront.net/user_37v9hge1XsR4EQQ1bvcBaDNhtel/hf_20261008_021947_f25de514-fb16-477b-89dc-81d058ac3cf0.png";

type SheetState = { kind: "auth" } | { kind: "profile" } | { kind: "event"; ev?: Ev } | null;

export function RallyApp() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10000, retry: 1 } } }));
  return (
    <QueryClientProvider client={client}>
      <Board />
    </QueryClientProvider>
  );
}

function Board() {
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => run(getMe()) });
  const evQ = useQuery({ queryKey: ["events"], queryFn: () => run(listEvents()), refetchInterval: 30000 });
  const me: Me = meQ.data ?? null;
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [focusComments, setFocusComments] = useState(false);
  const [tab, setTab] = useState<"events" | "mine" | "notice" | "rank" | "members" | "admin">("events");
  const clubQ = useQuery({ queryKey: ["club", "capabilities"], queryFn: () => run(getClubCapabilities()), retry: false });
  const [noticeFocus, setNoticeFocus] = useState<number | null>(null);
  const [monthSel, setMonthSel] = useState<string | null>(null);
  const [daySel, setDaySel] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const pastQ = useQuery({ queryKey: ["pastEvents"], queryFn: () => run(listPastEvents()), enabled: showPast && !!me });

  useEffect(() => {
    void flushPromotions();
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = Number(q.get("e"));
    if (id) setFocus(id);
    if (q.get("c")) setFocusComments(true);
    if (q.get("dues")) setTab("events");
    if (q.get("tab") === "mine") setTab("mine");
    if (q.get("tab") === "notice") {
      setTab("notice");
      const n = Number(q.get("n"));
      if (n) setNoticeFocus(n);
    }
  }, []);
  useEffect(() => {
    if (!focus || !evQ.data) return;
    document.getElementById(`ev-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus, evQ.data]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["events"] });
    void qc.invalidateQueries({ queryKey: ["pastEvents"] });
    void qc.invalidateQueries({ queryKey: ["me"] });
    void qc.invalidateQueries({ queryKey: ["rank"] });
    void qc.invalidateQueries({ queryKey: ["club"] });
    void qc.invalidateQueries({ queryKey: ["myEvents"] });
    void qc.invalidateQueries({ queryKey: ["eventManagement"] });
  };

  const allGroups = useMemo(() => {
    const m = new Map<string, Ev[]>();
    for (const e of evQ.data ?? []) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [evQ.data]);
  const months = useMemo(() => {
    const m = new Map<string, number>();
    for (const [d, evs] of allGroups) m.set(d.slice(0, 7), (m.get(d.slice(0, 7)) ?? 0) + evs.length);
    return [...m.entries()];
  }, [allGroups]);
  const pastGroups = useMemo(() => {
    const m = new Map<string, Ev[]>();
    for (const e of (pastQ.data ?? []) as Ev[]) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [pastQ.data]);
  const groups = useMemo(
    () => showPast ? pastGroups : allGroups.filter(([d]) => (!monthSel || d.startsWith(monthSel)) && (!daySel || d === daySel)),
    [allGroups, pastGroups, showPast, monthSel, daySel],
  );
  const monthDays = monthSel ? allGroups.filter(([d]) => d.startsWith(monthSel)) : [];

  async function act(ev: Ev, action: "join" | "decline") {
    if (!me) return setSheet({ kind: "auth" });
    if (!clubQ.data) return setToast("새 참가 규칙의 DB 업데이트 확인이 필요해요. 운영자에게 문의해주세요.");
    try {
      let s: string;
      if (action === "decline") {
        const q = await run(getCancelQuote(ev.id));
        const message = [`${ev.title} 신청을 취소할까요?`, q.amount > 0 ? `취소 벌칙 ${won(q.amount)}${q.reviewAllowed ? " 또는 당근리뷰" : ""}` : "취소 벌칙 없음", q.replacementRequired ? "호스트에게 미리 알리고 대참자를 직접 구해주세요." : "", q.refundPending ? "참가비는 자동 환불되지 않으며, 호스트와 환불·대참 정산을 확인해야 해요." : ""].filter(Boolean).join("\n");
        if (!window.confirm(message)) return;
        const reason = window.prompt("취소 사유를 적어주세요.");
        if (!reason?.trim()) return;
        s = await run(cancelRegistration(ev.id, reason));
      } else {
        s = await run(respond(ev.id, action));
      }
      setToast(s === "going" ? "참석이 확정됐어요" : s === "waiting" ? "자리 대기로 등록했어요. 아직 입금하지 마세요." : s === "payment_pending" ? "입금 대기로 등록했어요. 입금 전 호스트와 자리·금액을 확인해주세요." : "신청을 취소하고 관련자에게 알림을 남겼어요");
      refresh();
      if (s === "declined") void flushPromotions();
    } catch (e) {
      setToast(errText(e));
    }
  }

  async function remove(ev: Ev) {
    if (!window.confirm(`${ev.title} 일정을 지울까요?`)) return;
    try {
      await run(deleteEvent(ev.id));
      setToast("일정을 지웠어요");
      refresh();
    } catch (e) {
      setToast(errText(e));
    }
  }

  async function share(ev: Ev) {
    const url = `${window.location.origin}/?e=${ev.id}`;
    const total = ev.courtFee + ev.ballFee;
    const ntrp = ntrpLabel(ev.ntrpMin, ev.ntrpMax);
    const lines = [
      `🎾 ${ev.title}`,
      `${fmtDate(ev.date)} ${fmtClock(ev.startTime)}~${fmtClock(ev.endTime)}`,
      `${GAME_LABEL[ev.gameType]} · ${ev.capacity}명${ntrp ? " · " + ntrp : ""}`,
      total > 0 ? `비용 ${won(total)} (정원 기준 1인 ${won(perHead(total, ev.capacity))})` : null,
      `참석하기 👉 ${url}`,
    ];
    const text = lines.filter(Boolean).join(String.fromCharCode(10));
    try {
      await navigator.clipboard.writeText(text);
      setToast("복사했어요. 오픈채팅방에 붙여넣으세요");
    } catch {
      window.prompt("이 내용을 복사하세요", text);
    }
  }

  return (
    <div className="min-h-dvh bg-paper pb-28 text-ink">
      <header className="relative overflow-hidden bg-court-deep text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-court-deep/30 via-court-deep/60 to-court-deep" />
        <div className="relative mx-auto max-w-2xl px-5 pb-6 pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/favicon.svg" alt="" className="h-8 w-8" />
              <span className="font-display text-[19px] font-bold tracking-tight">랠리보드</span>
            </div>
            {me ? (
              <button onClick={() => setSheet({ kind: "profile" })} className="flex items-center gap-2 rounded-full bg-white/15 py-1.5 pl-3 pr-1.5 text-[13px] font-semibold backdrop-blur">
                {me.nickname}
                <span className="rounded-full bg-ball px-2 py-0.5 text-[12px] font-bold text-court-deep">{Number(me.ntrp).toFixed(1)}</span>
              </button>
            ) : (
              <button onClick={() => setSheet({ kind: "auth" })} className="rounded-full border border-white/60 px-4 py-1.5 text-[13px] font-bold hover:bg-white hover:text-court-deep">
                로그인
              </button>
            )}
          </div>
          <h1 className="mt-7 text-[26px] font-black leading-tight">🎾STEP UP 🎾 테니스 2030</h1>
          <p className="mt-1.5 text-[14px] text-white/80">✨하루를 바꾸는 가장 좋은 루틴 ☀️WAKE UP &amp; STEP UP!🎾</p>
          <nav className="mt-5 flex flex-wrap gap-1 rounded-2xl bg-white/15 p-1 backdrop-blur" aria-label="화면 전환">
            {([["events", "일정"], ["mine", "내 정모"], ["notice", "공지"], ["rank", "랭킹"], ["members", "멤버"], ...(me?.isAdmin ? [["admin", "운영"]] : [])] as [typeof tab, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-full px-3.5 py-1.5 text-[14px] font-bold transition ${tab === k ? "bg-white text-court-deep" : "text-white/85"}`}>
                {l}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {clubQ.isError && <p role="status" className="mx-auto mt-4 max-w-2xl rounded-xl bg-[#FFF6D6] px-4 py-3 text-[13px] text-ink">새 참가·입금 규칙을 적용 중이에요. 참가 신청·취소와 새 운영 기능은 업데이트 완료 후 이용해주세요.</p>}
      {tab === "mine" ? (
        <MyClub me={me} onNeedLogin={() => setSheet({ kind: "auth" })} onToast={setToast}
          renderEvent={(ev, past) => <EventCard ev={ev} me={me} past={past} focused={false} focusComments={false} onAct={act} onNeedLogin={() => setSheet({ kind: "auth" })} onToast={setToast} onChanged={refresh} onEdit={() => setSheet({ kind: "event", ev })} onDelete={() => remove(ev)} onShare={() => share(ev)} />} />
      ) : tab === "admin" ? (
        <AdminPanel me={me} onToast={setToast} />
      ) : tab === "notice" ? (
        <NoticesPanel me={me} focusId={noticeFocus} onNeedLogin={() => setSheet({ kind: "auth" })} onToast={setToast} />
      ) : tab === "members" ? (
        <MembersPanel me={me} onNeedLogin={() => setSheet({ kind: "auth" })} onToast={setToast} />
      ) : tab === "rank" ? (
        <Ranking me={me} />
      ) : (
        <main className="mx-auto max-w-2xl px-4">
          {evQ.isLoading && <p className="py-16 text-center text-mute">일정 불러오는 중</p>}
          {evQ.isError && <p className="py-16 text-center text-clay">{errText(evQ.error)}</p>}
          <DuesBanner me={me} onToast={setToast} />
          {(months.length > 0 || me) && (
            <div className="mt-4 space-y-2">
              <div className="-mx-4 overflow-x-auto px-4">
                <div className="flex w-max gap-1.5">
                  <button onClick={() => { setShowPast(false); setMonthSel(null); setDaySel(null); }}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${!showPast && !monthSel ? "bg-court-deep text-white" : "bg-white text-ink ring-1 ring-line"}`}>
                    전체 {evQ.data?.length ?? 0}
                  </button>
                  {months.map(([ym, n]) => (
                    <button key={ym} onClick={() => { setShowPast(false); setMonthSel(ym); setDaySel(null); }}
                      className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${!showPast && monthSel === ym ? "bg-court-deep text-white" : "bg-white text-ink ring-1 ring-line"}`}>
                      {Number(ym.slice(5))}월 <span className="opacity-70">{n}</span>
                    </button>
                  ))}
                  {me && (
                    <button onClick={() => { setShowPast((v) => !v); setMonthSel(null); setDaySel(null); }}
                      className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${showPast ? "bg-ink text-white" : "bg-white text-mute ring-1 ring-line"}`}>
                      🕘 지난 일정
                    </button>
                  )}
                </div>
              </div>
              {monthSel && !showPast && (
                <div className="-mx-4 overflow-x-auto px-4">
                  <div className="flex w-max gap-1.5">
                    <button onClick={() => setDaySel(null)}
                      className={`grid h-14 w-12 place-items-center rounded-xl text-[12px] font-bold ${!daySel ? "bg-court text-white" : "bg-white text-mute ring-1 ring-line"}`}>
                      전체
                    </button>
                    {monthDays.map(([d, evs]) => {
                      const wd = weekday(d);
                      const tone = wd === "일" ? "text-[#C0392B]" : wd === "토" ? "text-[#2B5C8A]" : "text-mute";
                      const on = daySel === d;
                      return (
                        <button key={d} onClick={() => setDaySel(on ? null : d)}
                          className={`relative flex h-14 w-12 flex-col items-center justify-center rounded-xl ${on ? "bg-court text-white" : "bg-white ring-1 ring-line"}`}>
                          <span className="text-[17px] font-black leading-none">{Number(d.slice(8))}</span>
                          <span className={`mt-1 text-[11px] font-bold ${on ? "text-white/85" : tone}`}>{wd}</span>
                          {evs.length > 1 && <span className={`absolute right-1 top-1 rounded-full px-1 text-[9px] font-black ${on ? "bg-white text-court" : "bg-clay text-white"}`}>{evs.length}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {showPast && <p className="mt-3 text-[12px] text-mute">최근 30일 일정이에요. 코트 잡은 사람과 운영진은 참석자별로 출석·노쇼를 체크할 수 있고, 노쇼는 참석 랭킹과 활동 기록에서 빠져요.</p>}
          {showPast && pastQ.isLoading && <p className="py-12 text-center text-mute">불러오는 중</p>}
          {((showPast && pastQ.data) || (!showPast && evQ.data)) && groups.length === 0 && (
            <div className="mt-10 rounded-3xl border-2 border-dashed border-line bg-white p-8 text-center">
              <p className="text-[17px] font-bold">{showPast ? "최근 30일 동안 열린 일정이 없어요" : "아직 올라온 일정이 없어요"}</p>
              {!showPast && <p className="mt-1 text-[14px] text-mute">코트 잡았으면 첫 일정을 올려주세요.</p>}
            </div>
          )}
          {groups.map(([date, evs]) => (
            <section key={date} className="mt-6">
              <h2 className="sticky top-0 z-10 -mx-4 bg-paper/95 px-4 py-2 text-[14px] font-bold text-court-deep backdrop-blur">
                {fmtShort(date)} <span className="font-medium text-mute">{showPast ? "" : dayHint(date)}</span>
              </h2>
              <div className="space-y-3">
                {evs.map((ev) => (
                  <EventCard key={ev.id} ev={ev} me={me} past={showPast} focused={focus === ev.id} focusComments={focus === ev.id && focusComments} onAct={act}
                    onNeedLogin={() => setSheet({ kind: "auth" })} onToast={setToast} onChanged={refresh}
                    onEdit={() => setSheet({ kind: "event", ev })} onDelete={() => remove(ev)} onShare={() => share(ev)} />
                ))}
              </div>
            </section>
          ))}
        </main>
      )}

      {tab === "events" && <button disabled={meQ.isLoading} onClick={() => setSheet(me ? { kind: "event" } : { kind: "auth" })}
        className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-clay px-6 py-4 text-[15px] font-bold text-white shadow-[0_10px_30px_-8px_rgba(210,97,44,0.7)] transition active:scale-95">
        <span className="text-[20px] leading-none">+</span> 코트 잡았어요
      </button>}

      {toast && <div role="status" className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg">{toast}</div>}

      {me?.needsProfile && <CompleteProfileSheet me={me} onDone={() => { refresh(); setToast("닉네임이 바뀌었어요"); }} />}
      {sheet?.kind === "auth" && <AuthSheet onClose={() => setSheet(null)} onDone={() => { setSheet(null); refresh(); setToast("반가워요!"); }} />}
      {sheet?.kind === "profile" && me && <ProfileSheet me={me} onClose={() => setSheet(null)} onDone={refresh} />}
      {sheet?.kind === "event" && me && (
        <EventSheet key={`${me.id}:${sheet.ev?.id ?? "new"}`} userId={me.id} initial={sheet.ev} defaults={{ payLink: (me as unknown as { lastPayLink?: string })?.lastPayLink ?? "", account: (me as unknown as { lastAccount?: string })?.lastAccount ?? "" }} onClose={() => setSheet(null)}
          onDone={() => { const edited = !!sheet.ev; setSheet(null); refresh(); if (edited) void flushPromotions(); setToast(edited ? "고쳤어요" : "일정을 올렸어요. 공유 버튼으로 방에 알려주세요"); }} />
      )}
    </div>
  );
}

function dayHint(date: string): string {
  const d = daysLeft(date);
  return d === 0 ? "오늘" : d === 1 ? "내일" : `${d}일 뒤`;
}

function EventCard({ ev, me, past, focused, focusComments, onAct, onEdit, onDelete, onShare, onNeedLogin, onToast, onChanged }: {
  ev: Ev; me: Me; past?: boolean; focused: boolean; focusComments: boolean;
  onAct: (ev: Ev, a: "join" | "decline") => void; onEdit: () => void; onDelete: () => void; onShare: () => void;
  onNeedLogin: () => void; onToast: (m: string) => void; onChanged: () => void;
}) {
  const [open, setOpen] = useState((focused && !focusComments) || !!past);
  const [talk, setTalk] = useState(focusComments);
  const going = ev.people.filter((p) => p.status === "going");
  const waiting = ev.people.filter((p) => p.status === "waiting");
  const pending = ev.people.filter((p) => p.status === "payment_pending");
  const declined = ev.people.filter((p) => p.status === "declined");
  const mine = me ? ev.people.find((p) => p.id === me.id) : undefined;
  const mixed = ev.gameType === "mixed";
  const myQueue = mine?.status === "waiting" ? waiting.filter((p) => !mixed || p.gender === mine.gender).findIndex((p) => p.id === mine.id) + 1 : 0;
  const canManage = !!me && (me.id === ev.hostId || me.isAdmin);
  const left = daysLeft(ev.date);
  const goingM = going.filter((p) => p.gender === "M").length;
  const goingF = going.filter((p) => p.gender === "F").length;
  const fullM = goingM >= ev.maleCap;
  const fullF = goingF >= ev.femaleCap;
  const full = mixed ? fullM && fullF : going.length >= ev.capacity;
  const myFull = mixed && me ? (me.gender === "M" ? fullM : fullF) : full;
  const ntrp = ntrpLabel(ev.ntrpMin, ev.ntrpMax);

  return (
    <article id={`ev-${ev.id}`} className={`overflow-hidden rounded-[22px] bg-white ring-1 ${focused ? "ring-2 ring-clay" : "ring-line"}`}>
      <div className="flex items-center gap-2 bg-[#EEF3F0] px-4 py-2.5 text-[13px] text-mute">
        <span aria-hidden>◷</span>
        {past ? "지난 일정이에요" : left === 0 ? "오늘 일정이에요" : `일정까지 ${left}일 남았습니다`}
        {!past && (full || (mixed && (fullM || fullF))) && (
          <span className="ml-auto rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">
            {full ? "마감 · 대기 가능" : fullM ? "남 마감 · 대기 가능" : "여 마감 · 대기 가능"}
          </span>
        )}
        {canManage && !past && (
          <span className={`flex shrink-0 gap-1.5 ${full || (mixed && (fullM || fullF)) ? "" : "ml-auto"}`}>
            <button onClick={onEdit} className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold text-court ring-1 ring-line">수정</button>
            <button onClick={onDelete} className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold text-clay ring-1 ring-line">삭제</button>
          </span>
        )}
      </div>
      <div className="px-4 pb-4 pt-3.5">
        <h3 className="text-[18px] font-bold leading-snug">{ev.title} <span className="font-semibold text-mute">(~{ev.capacity}명)</span></h3>
        <p className="mt-2 text-[15px]">{fmtDate(ev.date)}</p>
        <p className="mt-0.5 text-[15px]">{fmtClock(ev.startTime)} ~ {fmtClock(ev.endTime)}</p>
        <p className="mt-2 flex items-center gap-1.5 text-[13px]">
          <span aria-hidden>🎾</span>
          <span className="text-mute">코트 잡은 사람</span>
          <b className="truncate text-ink">{ev.hostName}</b>
          {me?.id === ev.hostId && <span className="rounded bg-court px-1.5 py-0.5 text-[11px] font-bold text-white">나</span>}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] font-bold">
          <span className="rounded-md bg-court px-2 py-1 text-white">{GAME_LABEL[ev.gameType]}{mixed ? ` 남${ev.maleCap}·여${ev.femaleCap}` : ""}</span>
          {ntrp && <span className="rounded-md bg-ball px-2 py-1 text-court-deep">{ntrp}</span>}
          <span className="rounded-md bg-paper px-2 py-1 text-mute">📍 {ev.court}</span>
        </div>
        <CostLine ev={ev} />
        <PayBox ev={ev} onToast={onToast} />
        {ev.note && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-paper px-3 py-2 text-[14px] text-ink/80">{ev.note}</p>}

        {!past && <div className="mt-4 flex items-center gap-2">
          <button onClick={() => onAct(ev, "join")}
            className={`rounded-full border-2 px-5 py-2.5 text-[15px] font-bold transition ${mine?.status === "going" ? "border-court bg-court text-white" : mine?.status === "waiting" ? "border-clay bg-[#FCEDE6] text-clay" : "border-ink/70 text-ink hover:border-court hover:text-court"}`}>
            {mine?.status === "going" ? "참석 확정 ✓" : mine?.status === "payment_pending" ? "입금 대기" : mine?.status === "waiting" ? `자리 대기 ${myQueue}번` : myFull ? "자리 대기 신청" : "참가 신청"}
          </button>
          <button onClick={() => onAct(ev, "decline")}
            className={`rounded-full px-5 py-2.5 text-[15px] font-semibold transition ${mine?.status === "declined" ? "bg-ink text-white" : "bg-paper text-mute hover:bg-line"}`}>
            신청 취소
          </button>
          <button onClick={onShare} className="ml-auto grid h-10 w-10 place-items-center rounded-full text-mute hover:bg-paper" aria-label="오픈채팅방에 공유" title="오픈채팅방에 공유">↗</button>
        </div>}

        <div className="mt-3 flex items-center gap-3">
        <button onClick={() => setTalk((t) => !t)} aria-expanded={talk}
          className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-bold ${talk ? "bg-court-deep text-white" : "bg-[#EEF3F0] text-court-deep"}`}>
          💬 댓글 {ev.comments.length}
        </button>
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center justify-end gap-3 text-[13px] text-mute" aria-expanded={open}>
          {mixed ? <span>남 {goingM}/{ev.maleCap} · 여 {goingF}/{ev.femaleCap} 참석</span> : <span>{going.length}명 참석</span>}
          {waiting.length > 0 && <span className="font-semibold text-clay">{waiting.length}명 대기</span>}
          {pending.length > 0 && <span className="font-semibold text-court">{pending.length}명 입금 대기</span>}
          <span>{declined.length}명 불참</span>
          <span aria-hidden>{open ? "▲" : "▼"}</span>
        </button>
        </div>

        {talk && <Comments ev={ev} me={me} onNeedLogin={onNeedLogin} onToast={onToast} onChanged={onChanged} />}

        {open && (
          <div className="mt-3 space-y-3 border-t border-line pt-3 text-[14px]">
            {past ? <AttendRow ev={ev} people={going} canCheck={canManage} onToast={onToast} onChanged={onChanged} /> : mixed ? (
              <>
                {(["M", "F"] as const).map((g) => {
                  const gGoing = going.filter((p) => p.gender === g);
                  const gWait = waiting.filter((p) => p.gender === g);
                  const cap = g === "M" ? ev.maleCap : ev.femaleCap;
                  return (
                    <div key={g} className={`space-y-2 rounded-xl px-3 py-2.5 ${g === "M" ? "bg-[#EEF4FA]" : "bg-[#FBF0F4]"}`}>
                      <p className={`text-[12px] font-black ${g === "M" ? "text-[#2B5C8A]" : "text-[#A23D62]"}`}>
                        {g === "M" ? "🙋‍♂️ 남자" : "🙋‍♀️ 여자"} 참석 {gGoing.length}/{cap}{gWait.length > 0 ? ` · 대기 ${gWait.length}` : ""}
                      </p>
                      <PeopleRow label="참석" people={gGoing} />
                      {gWait.length > 0 && <PeopleRow label="대기" people={gWait} numbered />}
                    </div>
                  );
                })}
                <p className="text-[12px] text-mute">혼복은 남녀 자리가 따로예요. 남자 자리가 비면 남자 대기자만, 여자 자리가 비면 여자 대기자만 올라가요.</p>
              </>
            ) : <PeopleRow label="참석" people={going} />}
            {!mixed && waiting.length > 0 && <PeopleRow label="대기" people={waiting} numbered />}
            {pending.length > 0 && <PeopleRow label="입금 대기" people={pending} />}
            {declined.length > 0 && <PeopleRow label="불참" people={declined} muted />}
            <ClubRules />
          </div>
        )}
        {canManage && me && <EventOperations ev={ev} me={me} onToast={onToast} />}
      </div>
    </article>
  );
}

function PeopleRow({ label, people, numbered, muted }: { label: string; people: Ev["people"]; numbered?: boolean; muted?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="w-9 shrink-0 pt-1 text-[12px] font-bold text-mute">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {people.length === 0 && <span className="pt-1 text-mute">아직 없어요</span>}
        {people.map((p, i) => (
          <span key={p.id} className={`rounded-full px-2.5 py-1 text-[13px] ${muted ? "bg-paper text-mute" : "bg-[#EEF3F0] text-ink"}`}>
            {numbered ? `${i + 1}. ` : ""}{p.nickname}
            <span className="ml-1 text-[11px] text-mute">{p.gender === "M" ? "남" : "여"} {Number(p.ntrp).toFixed(1)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CostLine({ ev }: { ev: Ev }) {
  const total = ev.courtFee + ev.ballFee;
  if (total <= 0) return null;
  const parts = [ev.courtFee > 0 ? `코트 ${won(ev.courtFee)}` : null, ev.ballFee > 0 ? `캔볼 ${won(ev.ballFee)}` : null].filter(Boolean);
  return (
    <div className="mt-3 rounded-xl border border-line px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2 text-[13px] text-mute">
        <span>{parts.join(" + ")}</span>
        <span className="font-semibold text-ink">합계 {won(total)}</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-mute">정원 {ev.capacity}명 기준 참가비</span>
        <span className="text-[17px] font-black text-court-deep">1인 {won(perHead(total, ev.capacity))}</span>
      </div>
      <p className="mt-0.5 text-right text-[12px] text-mute">입금 전 호스트에게 자리와 금액을 확인해주세요.</p>
    </div>
  );
}

const MEDAL = [
  { ring: "ring-2 ring-[#E3B341]", bg: "bg-gradient-to-r from-[#FFF6D6] to-white", badge: "bg-[#E3B341] text-white" },
  { ring: "ring-2 ring-[#A9B4BE]", bg: "bg-gradient-to-r from-[#EEF2F5] to-white", badge: "bg-[#8E9AA6] text-white" },
  { ring: "ring-2 ring-[#C98A5A]", bg: "bg-gradient-to-r from-[#FBEDE2] to-white", badge: "bg-[#C47A45] text-white" },
];

function Ranking({ me }: { me: Me }) {
  const [period, setPeriod] = useState<"all" | "month">("all");
  const [kind, setKind] = useState<"host" | "attend">("host");
  const q = useQuery({ queryKey: ["rank", kind, period], queryFn: () => run(getRanking(period, kind)) });
  const monthLabel = q.data ? `${Number(q.data.month.slice(5))}월` : "이번 달";
  const Me = ({ id }: { id: number }) => (me?.id === id ? <span className="ml-1.5 rounded bg-court px-1.5 py-0.5 align-middle text-[11px] font-bold text-white">나</span> : null);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-6">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 ring-1 ring-line">
        {([["host", "🎾 코트 등록 랭킹"], ["attend", "🏃 참석 랭킹"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setKind(k)}
            className={`rounded-xl py-2.5 text-[14px] font-bold transition ${kind === k ? "bg-court-deep text-white" : "text-mute"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-black">{kind === "host" ? "코트 잡은 사람" : "많이 친 사람"}</h2>
          <p className="mt-0.5 text-[13px] text-mute">
            {kind === "host" ? "일정을 올린 횟수예요. 지운 일정은 빠져요." : "참석 확정으로 시작 시간이 지난 일정 수예요. 대기·불참은 빠져요."}
          </p>
        </div>
        <div className="flex shrink-0 rounded-full bg-white p-1 ring-1 ring-line">
          {([["all", "전체"], ["month", monthLabel]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)} className={`rounded-full px-3 py-1 text-[13px] font-bold ${period === k ? "bg-court text-white" : "text-mute"}`}>{l}</button>
          ))}
        </div>
      </div>

      {q.isLoading && <p className="py-16 text-center text-mute">불러오는 중</p>}
      {q.isError && <p className="py-16 text-center text-clay">{errText(q.error)}</p>}
      {q.data && q.data.list.length === 0 && (
        <div className="mt-6 rounded-3xl border-2 border-dashed border-line bg-white p-8 text-center text-mute">{kind === "host" ? "아직 코트를 잡은 사람이 없어요" : "아직 참석 기록이 없어요"}</div>
      )}

      {q.data && q.data.list.length > 0 && (
        <>
          <ol className="mt-5 space-y-2.5">
            {q.data.list.filter((r) => r.rank <= 3).map((r) => {
              const m = MEDAL[r.rank - 1];
              return (
                <li key={r.id} className={`flex items-center gap-4 rounded-[22px] px-4 py-4 shadow-sm ${m.bg} ${m.ring}`}>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[20px] font-black ${m.badge}`}>{r.rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-black">{r.nickname}<Me id={r.id} /></p>
                    <p className="text-[12px] text-mute">{r.gender === "M" ? "남" : "여"} · NTRP {Number(r.ntrp).toFixed(1)} · 최근 {fmtShort(r.last)}</p>
                  </div>
                  <p className="text-right">
                    <span className="text-[28px] font-black leading-none text-court-deep">{r.n}</span>
                    <span className="ml-0.5 text-[13px] font-bold text-mute">회</span>
                  </p>
                </li>
              );
            })}
          </ol>
          {q.data.list.some((r) => r.rank > 3) && (
            <ol className="mt-4 overflow-hidden rounded-[22px] bg-white ring-1 ring-line">
              {q.data.list.filter((r) => r.rank > 3).map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                  <span className="w-7 text-center text-[14px] font-bold text-mute">{r.rank}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.nickname}<Me id={r.id} /></span>
                  <span className="text-[12px] text-mute">NTRP {Number(r.ntrp).toFixed(1)}</span>
                  <span className="w-12 text-right text-[15px] font-black text-court-deep">{r.n}회</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 text-center text-[12px] text-mute">가입 멤버 {q.data.members}명 중 {q.data.list.length}명이 {kind === "host" ? "코트를 잡았어요" : "일정에 참석했어요"}</p>
        </>
      )}
    </main>
  );
}

function Comments({ ev, me, onNeedLogin, onToast, onChanged }: { ev: Ev; me: Me; onNeedLogin: () => void; onToast: (m: string) => void; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!me) return onNeedLogin();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await run(addComment(ev.id, text));
      setText("");
      onChanged();
    } catch (e) {
      onToast(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("댓글을 지울까요?")) return;
    try {
      await run(deleteComment(id));
      onChanged();
    } catch (e) {
      onToast(errText(e));
    }
  }

  const canDelete = (uid: number) => !!me && (me.id === uid || me.id === ev.hostId || me.isAdmin);

  return (
    <div className="mt-3 border-t border-line pt-3">
      {ev.comments.length === 0 && <p className="pb-2 text-[13px] text-mute">첫 댓글을 남겨보세요. 코트 번호, 늦는다는 연락 같은 것도 좋아요.</p>}
      <ul className="space-y-2.5">
        {ev.comments.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-black ${c.userId === ev.hostId ? "bg-court text-white" : "bg-[#EEF3F0] text-court-deep"}`}>
              {c.nickname.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-mute">
                <b className="text-ink">{c.nickname}</b>
                {c.userId === ev.hostId && <span className="ml-1 text-court">방장</span>}
                <span className="ml-1.5">{fmtAgo(c.createdAt)}</span>
                {canDelete(c.userId) && (
                  <button onClick={() => remove(c.id)} className="ml-2 text-mute underline underline-offset-2">지우기</button>
                )}
              </p>
              <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 300))}
          onFocus={() => { if (!me) onNeedLogin(); }}
          rows={1}
          placeholder={me ? "댓글 달기" : "로그인하고 댓글 달기"}
          className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] outline-none focus:border-court focus:bg-white"
        />
        <button onClick={send} disabled={busy || !text.trim()} className="h-11 shrink-0 rounded-xl bg-court px-4 text-[14px] font-bold text-white disabled:opacity-40">
          {busy ? "…" : "등록"}
        </button>
      </div>
      {me && <div className="mt-2"><PushToggle compact /></div>}
    </div>
  );
}

export function fmtAgo(createdAt: string): string {
  const t = Date.parse(`${createdAt}:00+09:00`);
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  const [d, hm] = createdAt.split("T");
  const [, mo, dd] = d.split("-");
  return `${Number(mo)}/${Number(dd)} ${hm}`;
}

function AttendRow({ ev, people, canCheck, onToast, onChanged }: {
  ev: Ev; people: Ev["people"]; canCheck: boolean; onToast: (m: string) => void; onChanged: () => void;
}) {
  async function mark(uid: number, v: boolean | null) {
    if (v === false && !window.confirm("무단 불참 벌칙 15,000원 또는 당근리뷰를 등록할까요? 앞으로 신청한 정모가 취소되고 운영진의 납부·이행 확인까지 참가가 제한돼요.")) return;
    try {
      await run(setAttendance(ev.id, uid, v));
      onChanged();
    } catch (e) {
      onToast(errText(e));
    }
  }
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-bold text-mute">참석 확정 {people.length}명{canCheck ? " · 출석 체크" : ""}</p>
      {people.length === 0 && <p className="text-mute">참석자가 없었어요</p>}
      <ul className="space-y-1.5">
        {people.map((p) => {
          const a = (p as unknown as { attended: boolean | null }).attended;
          return (
            <li key={p.id} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2">
              <span className={`min-w-0 flex-1 truncate text-[13px] ${a === false ? "text-mute line-through" : ""}`}>{p.nickname}</span>
              {canCheck ? (
                <span className="flex shrink-0 gap-1">
                  <button onClick={() => mark(p.id, a === true ? null : true)}
                    className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${a === true ? "bg-court text-white" : "bg-white text-mute ring-1 ring-line"}`}>출석</button>
                  <button onClick={() => mark(p.id, a === false ? null : false)}
                    className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${a === false ? "bg-clay text-white" : "bg-white text-mute ring-1 ring-line"}`}>노쇼</button>
                </span>
              ) : a === false ? (
                <span className="shrink-0 rounded bg-[#FCEDE6] px-1.5 text-[11px] font-bold text-clay">노쇼</span>
              ) : a === true ? (
                <span className="shrink-0 text-[11px] font-bold text-court">출석</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PayBox({ ev, onToast }: { ev: Ev; onToast: (m: string) => void }) {
  const p = ev as unknown as { payLink?: string | null; account?: string | null };
  if (!p.payLink && !p.account) return null;
  const total = ev.courtFee + ev.ballFee;
  const each = total > 0 ? perHead(total, ev.capacity) : 0;
  const copy = (t: string, msg: string) => { void navigator.clipboard.writeText(t).then(() => onToast(msg)).catch(() => window.prompt("복사하세요", t)); };
  return (
    <div className="mt-2 rounded-xl bg-[#FFFBE0] px-3 py-2.5 ring-1 ring-[#F2E58C]">
      {each > 0 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] text-ink/70">1인 참가비 <b className="text-[15px] text-ink">{won(each)}</b> (정원 기준)</span>
          <button onClick={() => copy(String(each), "금액을 복사했어요")} className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold text-mute ring-1 ring-line">금액 복사</button>
        </div>
      )}
      {p.payLink && (
        <a href={p.payLink} target="_blank" rel="noopener noreferrer"
          className={`flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FEE500] py-2.5 text-[15px] font-black text-[#191919] ${each > 0 ? "mt-2" : ""}`}>
          💛 카카오페이로 송금하기
        </a>
      )}
      {p.payLink && <p className="mt-2 text-[12px] text-ink/70">카카오페이는 휴대폰에서 확인해주세요. 링크가 열리지 않으면 호스트에게 계좌를 요청하세요. 송금 후 내 정모에서 입금 확인을 요청해야 해요.</p>}
      {p.account && (
        <div className={`flex items-center justify-between gap-2 ${p.payLink || each > 0 ? "mt-2" : ""}`}>
          <span className="min-w-0 truncate text-[13px] text-ink/80">🏦 {p.account}</span>
          <button onClick={() => copy(p.account as string, "계좌를 복사했어요")} className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold text-mute ring-1 ring-line">계좌 복사</button>
        </div>
      )}
    </div>
  );
}
