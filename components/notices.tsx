"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { addNoticeComment, createNotice, deleteNotice, deleteNoticeComment, listNotices, updateNotice, type Notice } from "@/app/actions";
import { PushToggle } from "./push";
import { Sheet } from "./sheets";
import { errText, run, type Me } from "./util";
import { fmtAgo } from "./RallyApp";

export function NoticesPanel({ me, focusId, onNeedLogin, onToast }: { me: Me; focusId: number | null; onNeedLogin: () => void; onToast: (m: string) => void }) {
  const q = useQuery({ queryKey: ["notices"], queryFn: () => run(listNotices()), refetchInterval: 60000 });
  const [editing, setEditing] = useState<Notice | "new" | null>(null);

  useEffect(() => {
    if (!focusId || !q.data) return;
    document.getElementById(`notice-${focusId}`)?.scrollIntoView({ block: "start" });
  }, [focusId, q.data]);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-black">공지사항</h2>
          <p className="mt-0.5 text-[13px] text-mute">운영진이 올리는 소식이에요. 댓글은 누구나 달 수 있어요.</p>
        </div>
        {me?.isAdmin && (
          <button onClick={() => setEditing("new")} className="shrink-0 rounded-full bg-ink px-4 py-2 text-[14px] font-bold text-white">공지 쓰기</button>
        )}
      </div>

      {me && (
        <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-line">
          <PushToggle compact />
        </div>
      )}

      {q.isLoading && <p className="py-16 text-center text-mute">불러오는 중</p>}
      {q.isError && <p className="py-16 text-center text-clay">{errText(q.error)}</p>}
      {q.data && q.data.length === 0 && (
        <div className="mt-6 rounded-3xl border-2 border-dashed border-line bg-white p-8 text-center text-mute">아직 공지가 없어요</div>
      )}

      <div className="mt-4 space-y-3">
        {q.data?.map((n) => (
          <NoticeCard key={n.id} n={n} me={me} defaultOpen={n.id === focusId || (q.data!.length <= 2)}
            onEdit={() => setEditing(n)} onNeedLogin={onNeedLogin} onToast={onToast} />
        ))}
      </div>

      {editing && <NoticeEditor initial={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onToast={onToast} />}
    </main>
  );
}

function NoticeCard({ n, me, defaultOpen, onEdit, onNeedLogin, onToast }: {
  n: Notice; me: Me; defaultOpen: boolean; onEdit: () => void; onNeedLogin: () => void; onToast: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["notices"] });

  async function send() {
    if (!me) return onNeedLogin();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await run(addNoticeComment(n.id, text));
      setText("");
      refresh();
    } catch (e) {
      onToast(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeComment(id: number) {
    if (!window.confirm("댓글을 지울까요?")) return;
    try {
      await run(deleteNoticeComment(id));
      refresh();
    } catch (e) {
      onToast(errText(e));
    }
  }

  async function removeNotice() {
    if (!window.confirm(`"${n.title}" 공지를 지울까요?`)) return;
    try {
      await run(deleteNotice(n.id));
      onToast("공지를 지웠어요");
      refresh();
    } catch (e) {
      onToast(errText(e));
    }
  }

  return (
    <article id={`notice-${n.id}`} className={`overflow-hidden rounded-[22px] bg-white ring-1 ${n.pinned ? "ring-2 ring-ball" : "ring-line"}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full px-4 pb-3 pt-4 text-left" aria-expanded={open}>
        <div className="flex items-center gap-2 text-[12px] text-mute">
          {n.pinned && <span className="rounded bg-ball px-1.5 py-0.5 font-bold text-court-deep">📌 고정</span>}
          <span>{fmtAgo(n.createdAt)}{n.edited ? " · 수정됨" : ""}</span>
          <span className="ml-auto">💬 {n.comments.length}</span>
        </div>
        <h3 className="mt-1.5 text-[17px] font-bold leading-snug">{n.title}</h3>
        {!open && <p className="mt-1 line-clamp-2 text-[14px] text-mute">{n.body}</p>}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{n.body}</p>
          <div className="mt-3 flex items-center justify-between text-[12px] text-mute">
            <span>{n.author}</span>
            {me?.isAdmin && (
              <span className="flex gap-3">
                <button onClick={onEdit} className="font-semibold text-court underline underline-offset-2">고치기</button>
                <button onClick={removeNotice} className="font-semibold text-clay underline underline-offset-2">지우기</button>
              </span>
            )}
          </div>

          <div className="mt-3 border-t border-line pt-3">
            <ul className="space-y-2.5">
              {n.comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EEF3F0] text-[12px] font-black text-court-deep">{c.nickname.slice(0, 1)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-mute">
                      <b className="text-ink">{c.nickname}</b>
                      <span className="ml-1.5">{fmtAgo(c.createdAt)}</span>
                      {me && (me.id === c.userId || me.isAdmin) && (
                        <button onClick={() => removeComment(c.id)} className="ml-2 underline underline-offset-2">지우기</button>
                      )}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-end gap-2">
              <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} onFocus={() => { if (!me) onNeedLogin(); }}
                rows={1} placeholder={me ? "댓글 달기" : "로그인하고 댓글 달기"}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] outline-none focus:border-court focus:bg-white" />
              <button onClick={send} disabled={busy || !text.trim()} className="h-11 shrink-0 rounded-xl bg-court px-4 text-[14px] font-bold text-white disabled:opacity-40">
                {busy ? "…" : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

const field = "w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-[15px] text-ink outline-none focus:border-court focus:bg-white";
const label = "mb-1.5 block text-[13px] font-semibold text-mute";

function NoticeEditor({ initial, onClose, onToast }: { initial?: Notice; onClose: () => void; onToast: (m: string) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      if (initial) await run(updateNotice(initial.id, title, body, pinned));
      else await run(createNotice(title, body, pinned));
      void qc.invalidateQueries({ queryKey: ["notices"] });
      onToast(initial ? "공지를 고쳤어요" : "공지를 올렸어요. 알림을 켜 멤버에게 알림이 가요");
      onClose();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={initial ? "공지 고치기" : "공지 쓰기"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={label}>제목</label>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
        <div>
          <label className={label}>내용</label>
          <textarea className={`${field} min-h-48`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} />
          <p className="mt-1 text-right text-[12px] text-mute">{body.length}/3000</p>
        </div>
        <label className="flex items-center gap-2 text-[14px] font-semibold">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-5 w-5 accent-[#1c6a50]" />
          📌 맨 위에 고정
        </label>
        {!initial && <p className="text-[12px] text-mute">올리면 알림을 켜둔 모든 멤버에게 알림이 가요.</p>}
      </div>
      {err && <p className="mt-3 rounded-lg bg-[#FCEDE6] px-3 py-2 text-[13px] font-medium text-clay">{err}</p>}
      <button onClick={save} disabled={busy || !title.trim() || !body.trim()} className="mt-5 w-full rounded-2xl bg-ink py-4 text-[16px] font-bold text-white disabled:opacity-40">
        {busy ? "저장 중" : initial ? "고친 내용 저장" : "공지 올리기"}
      </button>
    </Sheet>
  );
}
