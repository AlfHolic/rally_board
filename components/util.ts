import type { Ev, MeData, Result } from "@/app/actions";

export type { Ev };
export type Me = MeData | null;

const WD = "일월화수목금토";

export async function run<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

export function kstToday(): string {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}
export function weekday(date: string): string {
  return WD[new Date(`${date}T12:00:00Z`).getUTCDay()];
}
export function fmtDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일 (${weekday(date)})`;
}
export function fmtShort(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)} ${weekday(date)}`;
}
export function fmtClock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? "오전" : "오후"} ${hh}:${String(m).padStart(2, "0")}`;
}
export function daysLeft(date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${kstToday()}T00:00:00Z`)) / 86400000);
}
export const GAME_LABEL: Record<Ev["gameType"], string> = { any: "자유", mens: "남복", womens: "여복", mixed: "혼복" };
export function ntrpLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? `NTRP ${min.toFixed(1)}` : `NTRP ${min.toFixed(1)}~${max.toFixed(1)}`;
  if (min != null) return `NTRP ${min.toFixed(1)}+`;
  return `NTRP ~${max!.toFixed(1)}`;
}
export function errText(e: unknown): string {
  return e instanceof Error ? e.message : "문제가 생겼어요. 다시 시도해주세요.";
}
export function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}
/** Per-person share, rounded up to the nearest 100 won. */
export function perHead(total: number, people: number): number {
  return people <= 0 ? 0 : Math.ceil(total / people / 100) * 100;
}
export const NTRP_STEPS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0];

export const NTRP_GUIDE: { n: number; icon: string; text: string }[] = [
  { n: 0.5, icon: "🪺", text: "코트 경험 없음 또는 레슨 3개월 미만" },
  { n: 1.0, icon: "🐣", text: "볼머신 10회 이상 & 게임 룰 숙지" },
  { n: 1.5, icon: "🌱", text: "게임 경험 20회 이상 & 서브 유효타 목표" },
  { n: 2.0, icon: "🎾", text: "발리 유효타 목표 & 서브 성공률 상승" },
  { n: 2.5, icon: "🔥", text: "발리 가능 & 스트로크 안정적" },
  { n: 3.0, icon: "💪", text: "코스 조절 가능" },
];

export type Freq = "none" | "m12" | "m34" | "w1" | "w23" | "w4";
export const FREQS: { v: Freq; icon: string; text: string }[] = [
  { v: "none", icon: "⚪", text: "거의 없음" },
  { v: "m12", icon: "🟢", text: "월 1~2회" },
  { v: "m34", icon: "🔵", text: "월 3~4회" },
  { v: "w1", icon: "🟡", text: "주 1회" },
  { v: "w23", icon: "🟠", text: "주 2~3회" },
  { v: "w4", icon: "🔴", text: "주 4회 이상" },
];
export const freqIcon = (f: Freq | null | undefined) => FREQS.find((x) => x.v === f)?.icon ?? "";
