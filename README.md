# 🎾 랠리보드 (RallyBoard)

STEP UP 테니스 2030 모임용 코트 일정·참석 관리 웹앱입니다.
카카오톡 오픈채팅방 대신 링크 하나로 코트 일정, 참석/대기, N빵, 공지, 랭킹, 회비, 멤버 관리를 할 수 있어요.

- **프론트/서버:** Next.js 16 (App Router, Server Actions) + Tailwind CSS 4
- **DB:** Supabase (Postgres). 모든 로직은 `public.rb_*` RPC 함수에 있어요.
- **배포:** Vercel (Hobby 무료) · 매일 09:00 KST Cron
- **알림:** Web Push (VAPID)

## 폴더 구조

```
app/
  actions.ts        로그인·일정·댓글·멤버·공지·푸시 등 대부분의 서버 액션 (Supabase RPC 호출)
  dues.ts           회비 관리 서버 액션
  extra.ts          지난 일정·출석 체크·알림 설정·자진 탈퇴·운영 설정
  promo.ts          대기 → 참석 확정 알림 발송
  ranking.ts        랭킹 조회
  api/cron/route.ts 매일 자동 알림 (회비 시작일·마감 D-1, 60일 미활동)
  layout.tsx, page.tsx, globals.css
components/
  RallyApp.tsx      메인 화면: 탭, 일정 카드, 송금 박스, 랭킹, 댓글
  sheets.tsx        가입/로그인, 프로필, 일정 등록 시트
  members.tsx       멤버 탭 (운영진 관리 메뉴 포함)
  notices.tsx       공지 탭
  admin.tsx         운영 탭: 회비 · 탈퇴자 · 설정, 회비 납부 배너
  push.tsx          알림 켜기 버튼·안내
  util.ts           날짜·금액 포맷, NTRP/활동빈도 상수
public/             서비스워커(sw.js), 아이콘, manifest
supabase/schema.sql DB 전체 구조 (테이블 + 함수 + 권한)
vercel.json         Cron 설정
```

## 자주 고치는 곳

| 바꾸고 싶은 것 | 파일 |
|---|---|
| 상단 제목·슬로건, 배경 이미지 | `components/RallyApp.tsx` (`HERO`, `<h1>`) |
| 색상 | `app/globals.css` (court, clay, ball 등) |
| NTRP 기준표, 활동빈도 이모지 | `components/util.ts` |
| 가입 화면 항목·문구 | `components/sheets.tsx` (`AuthSheet`) |
| 알림 문구 | 코드 수정 없이 사이트 **운영 → 설정**에서 변경 가능 |
| 규칙(정원, 대기 승격, 회비 대상 등) | `supabase/schema.sql`의 해당 함수 → Supabase SQL Editor에서 실행 |

## 로컬에서 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

## 처음부터 새로 세팅하기

1. **Supabase:** 새 프로젝트 생성 → SQL Editor에 `supabase/schema.sql` 전체를 붙여넣고 실행
   (`CHANGE_ME_TO_PUSH_SECRET`은 직접 만든 PUSH_SECRET 값으로 바꾸기)
2. **VAPID 키:** `npx web-push generate-vapid-keys` → 공개키는 코드 안 `VAPID_PUBLIC` 5곳, 개인키는 환경변수로
3. **Vercel:** 이 폴더를 GitHub에 올리고 Vercel에서 Import → `.env.example`의 환경변수 입력 → Deploy
4. 사이트에 **가장 먼저 가입한 사람이 방장**이 돼요.

## GitHub에 올리면 좋은 점

Vercel 프로젝트를 GitHub 저장소에 연결하면, 파일을 고치고 push할 때마다 자동으로 배포돼요.
여러 운영진이 함께 고치거나 예전 버전으로 되돌리기도 쉬워져요.

## 보안 메모

- 코드에 들어 있는 Supabase 키는 **publishable(공개용) 키**라서 공개돼도 괜찮아요. DB 테이블은 막혀 있고 `rb_*` 함수만 열려 있어요.
- `PUSH_SECRET`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, Supabase 비밀키는 **절대 코드나 저장소에 올리지 마세요.** Vercel 환경변수에만 넣어요.

## 라이선스

MIT
