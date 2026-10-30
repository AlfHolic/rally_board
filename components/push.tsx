"use client";

import { useEffect, useState } from "react";
import { savePush } from "@/app/actions";
import { errText, run } from "./util";

const VAPID_PUBLIC = "BBQaJL_i52GyqnmZT2dajaaXA02qdeuYBCdAKlpU4Rky5f1RDywIHA8pJtnLDmoNE-Y9DZbRutUucwSqglr8dOc";

function keyBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Env = "loading" | "inapp" | "ios-browser" | "unsupported" | "ready";

function detect(): Env {
  const ua = navigator.userAgent;
  if (/KAKAOTALK|Instagram|NAVER|FBAN|FBAV|Line/i.test(ua)) return "inapp";
  const ios = /iPhone|iPad|iPod/.test(ua);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "ios-browser";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ready";
}

function PushControl({ compact }: { compact?: boolean }) {
  const [env, setEnv] = useState<Env>("loading");
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const e = detect();
    setEnv(e);
    if (e !== "ready") return;
    navigator.serviceWorker.getRegistration("/").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") setOn(true);
    }).catch(() => {});
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("알림 권한이 꺼져 있어요. 폰 설정에서 이 사이트 알림을 허용해주세요.");
        return;
      }
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
      const j = sub.toJSON();
      await run(savePush(j.endpoint!, j.keys!.p256dh, j.keys!.auth));
      setOn(true);
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setBusy(false);
    }
  }

  if (env === "loading") return null;
  const box = compact ? "text-[12px]" : "text-[13px]";

  if (env === "inapp")
    return <p className={`${box} rounded-lg bg-paper px-3 py-2 text-mute`}>🔔 카톡 안에서는 알림을 켤 수 없어요. 오른쪽 위 메뉴에서 <b>다른 브라우저로 열기</b>를 누른 뒤 켜주세요.</p>;
  if (env === "ios-browser")
    return <p className={`${box} rounded-lg bg-paper px-3 py-2 text-mute`}>🔔 아이폰은 사파리 아래 <b>공유 버튼 → 홈 화면에 추가</b>를 한 뒤, 생긴 랠리보드 아이콘으로 열어야 알림을 켤 수 있어요.</p>;
  if (env === "unsupported")
    return <p className={`${box} rounded-lg bg-paper px-3 py-2 text-mute`}>🔔 이 브라우저는 알림을 지원하지 않아요. 크롬이나 사파리로 열어주세요.</p>;

  return (
    <div>
      {on ? (
        <p className={`${box} rounded-lg bg-[#EEF3F0] px-3 py-2 font-semibold text-court-deep`}>🔔 이 폰으로 알림을 받고 있어요</p>
      ) : (
        <button onClick={enable} disabled={busy}
          className={`w-full rounded-xl border-2 border-dashed border-court px-3 py-2.5 font-bold text-court disabled:opacity-40 ${box}`}>
          {busy ? "켜는 중" : "🔔 이 폰으로 알림 받기"}
        </button>
      )}
      {msg && <p className="mt-2 text-[12px] text-clay">{msg}</p>}
    </div>
  );
}

export function PushGuide() {
  return (
    <details className="group mt-2 rounded-xl bg-paper px-3 py-2.5 text-[13px] leading-relaxed text-ink/85">
      <summary className="cursor-pointer list-none font-bold text-court-deep">
        📖 알림 설정 방법 보기 <span className="text-mute group-open:hidden">▼</span><span className="hidden text-mute group-open:inline">▲</span>
      </summary>
      <div className="mt-2 space-y-2.5">
        <div>
          <p className="font-bold">이런 알림이 와요</p>
          <p>새 일정(내 성별·NTRP로 참석할 수 있는 일정만) · 새 공지 · 내 공지에 달린 댓글 · 내가 올렸거나 참석·대기 중이거나 댓글을 단 일정의 새 댓글. 내가 쓴 글에는 알림이 오지 않아요.</p>
        </div>
        <div>
          <p className="font-bold">안드로이드</p>
          <p>크롬으로 랠리보드를 열고 위의 "이 폰으로 알림 받기"를 누른 뒤, 뜨는 창에서 <b>허용</b>을 눌러주세요. <b>앱 설치나 홈 화면 추가는 필요 없어요.</b></p>
          <p className="mt-1 text-mute">아이콘을 두고 싶다면 크롬 메뉴(⋮) → 홈 화면에 추가 → <b>바로가기 만들기</b>를 고르세요. "설치"를 고르면 Play 프로텍트 경고가 뜨 수 있어요.</p>
        </div>
        <div>
          <p className="font-bold">아이폰 (iOS 16.4 이상)</p>
          <p>① 사파리로 랠리보드 열기 → ② 아래 <b>공유 버튼(□↑)</b> → <b>홈 화면에 추가</b> → ③ 홈 화면에 생긴 랠리보드 아이콘으로 열기 → ④ 로그인 후 "이 폰으로 알림 받기" → <b>허용</b>. 사파리 창에서는 알림을 켤 수 없어요.</p>
        </div>
        <div>
          <p className="font-bold">카톡에서 링크를 열었다면</p>
          <p>카톡 안 화면에서는 알림이 안 돼요. 오른쪽 위(또는 아래) 메뉴에서 <b>다른 브라우저로 열기</b>를 눌러 크롬·사파리로 연 다음 위 순서대로 해주세요.</p>
        </div>
        <div>
          <p className="font-bold">알림이 안 온다면</p>
          <p>폰 설정 → 알림에서 크롬(아이폰은 랠리보드)의 알림이 켜져 있는지, 방해금지·집중 모드가 아닌지 확인해주세요. 폰을 바꾸거나 다른 기기를 쓰면 그 기기에서 한 번 더 켜야 해요.</p>
        </div>
        <div>
          <p className="font-bold">알림 끄기</p>
          <p>폰 설정 → 알림에서 크롬(아이폰은 랠리보드) 알림을 끄면 돼요.</p>
        </div>
      </div>
    </details>
  );
}

export function PushToggle({ compact }: { compact?: boolean }) {
  return (
    <div>
      <PushControl compact={compact} />
      <PushGuide />
    </div>
  );
}
