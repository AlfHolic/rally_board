"use client";

import { useState } from "react";
import Image from "next/image";

const steps = [
  { title: "더보기", text: "카카오톡 아래쪽의 더보기(⋯)를 눌러요." },
  { title: "송금", text: "노란 카카오페이 영역에서 송금(Send)을 눌러요." },
  { title: "QR 스캔", text: "송금 화면 아래 왼쪽의 스캔 아이콘을 눌러요." },
  { title: "나의 송금코드", text: "스캔 화면 아래의 나의 송금코드를 눌러요." },
  { title: "링크 복사", text: "링크 복사를 누른 뒤 위의 송금 링크 입력칸에 붙여넣어요." },
];

export function KakaoPayGuide() {
  const [step, setStep] = useState(0);
  const imageSrc = step === 1 ? "/guides/kakaopay/step-2-v2.png" : `/guides/kakaopay/step-${step + 1}.png`;
  return <details className="mt-2 rounded-xl bg-paper p-3 text-[13px] leading-relaxed">
    <summary className="cursor-pointer font-bold text-court-deep">사진으로 보는 카카오페이 송금 링크 만들기</summary>
    <p className="mt-2 text-[12px] text-mute">1~5단계를 차례로 눌러보세요. 빨간 표시가 누를 곳이에요. 이미지 속 개인정보는 가렸어요.</p>
    <ol aria-label="송금 링크 만들기 단계" className="my-3 grid grid-cols-5 gap-1">
      {steps.map((s, i) => <li key={s.title}><button type="button" aria-label={`${i + 1}단계 ${s.title}`} aria-pressed={i === step} onClick={() => setStep(i)} className={`w-full rounded-lg px-1 py-2 text-[12px] font-bold ${i === step ? "bg-court text-white" : "bg-white text-mute ring-1 ring-line"}`}>{i + 1}</button></li>)}
    </ol>
    <figure>
      <figcaption aria-live="polite" className="mb-2"><b>{step + 1}. {steps[step].title}</b><p className="mt-1 text-[12px] text-mute">{steps[step].text}</p></figcaption>
      <a href={imageSrc} target="_blank" rel="noreferrer" aria-label={`${step + 1}단계 안내 이미지 크게 보기`}>
        <Image key={imageSrc} src={imageSrc} width={852} height={1846} sizes="(max-width: 640px) 85vw, 400px" alt={`${step + 1}단계: ${steps[step].text} 클릭할 곳은 빨간 화살표로 표시하고 나머지는 가린 화면`} className="mx-auto max-h-[55dvh] w-auto rounded-xl border border-line object-contain" />
      </a>
    </figure>
    <div className="mt-3 flex items-center justify-between gap-2"><button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded-lg bg-white px-3 py-2 font-semibold disabled:opacity-30">이전</button><span className="text-[12px] text-mute">이미지를 누르면 크게 볼 수 있어요.</span><button type="button" disabled={step === 4} onClick={() => setStep(step + 1)} className="rounded-lg bg-court px-3 py-2 font-semibold text-white disabled:opacity-30">다음</button></div>
    <p className="mt-3 text-[12px] text-mute">메뉴 이름과 위치는 앱 버전에 따라 달라질 수 있어요. 링크를 붙여넣은 뒤 실제로 열리는지 확인해주세요.</p>
  </details>;
}
