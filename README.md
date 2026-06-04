# MNF HOLDEM · Nexus

홀덤 매장 통합 관리 (Next.js App Router + Supabase).

## 시작하기

```bash
cp .env.example .env.local
# Supabase URL / anon key 입력 (Vercel Production과 동일하게 맞추면 데이터 일치)

npm install
npm run dev
```

브라우저에서 **http://localhost:3000** — 저장하면 즉시 반영 (Vercel 배포 전 미리보기).

- **Supabase 미설정:** [http://localhost:3000/admin/dashboard](http://localhost:3000/admin/dashboard) 데모 데이터로 UI 확인
- **Supabase 설정 후:** [http://localhost:3000/login](http://localhost:3000/login) 로그인

**Vercel 화면 보면서 수정:** [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md)

## Supabase 설정

**순서대로** SQL Editor에 붙여 넣고 실행하세요.

먼저 [supabase/check_schema.sql](supabase/check_schema.sql)로 상태 확인.

| 오류 | 의미 | 할 일 |
|------|------|------|
| `relation "profiles" already exists` | **001은 이미 적용됨** | 001 다시 실행하지 말 것 |
| `relation "members" does not exist` | **002 미적용** | 002 실행 |

1. [supabase/migrations/001_initial.sql](supabase/migrations/001_initial.sql) — **최초 1회만**. 이미 `profiles` 있으면 **Skip**
2. [supabase/migrations/002_platform.sql](supabase/migrations/002_platform.sql) SQL 실행 — `venue_players` → `members` 변경
3. [supabase/migrations/003_prize_guest.sql](supabase/migrations/003_prize_guest.sql) SQL 실행
4. [supabase/migrations/004_features.sql](supabase/migrations/004_features.sql) SQL 실행
5. [supabase/migrations/005_counter_role.sql](supabase/migrations/005_counter_role.sql) SQL 실행
6. [supabase/seed.sql](supabase/seed.sql) 시드 실행

환경 확인: `npm run check:env`

7. Auth에서 사용자 생성 후 `profiles.role` 지정:

```sql
-- 관리자
update public.profiles
set role = 'admin', venue_id = '00000000-0000-4000-8000-000000000001'
where id = '<user-uuid>';

-- 접수대 태블릿 (로그인 시 /counter 자동, 사이드바 메뉴 없음)
update public.profiles set role = 'counter' where id = '<counter-tablet-user-uuid>';
```

8. 관리자 대시보드에서 **영업 시작** → 접수대 태블릿에서 방문 등록

## 주요 경로

| 경로 | 설명 |
|------|------|
| `/login` | 로그인 |
| `/counter` | 접수대 (`role=counter` 전용, 태블릿 로그인 시 자동 진입) |
| `/admin/games/[id]/settlement` | 프라이즈 · ICM 찹 |
| `/guest` | 손님 모바일 (포인트·예약·바이인·이체 요청) |
| `/admin/dashboard` | 관리자 대시보드 · 영업 오픈/마감 |
| `/admin/tables` | 물리 테이블 통합 뷰 (A–D) |
| `/admin/tables/[id]` | 테이블 상세 · 좌석 배정 |
| `/admin/guests` | 손님 (방문/대기/게임중/예약) |
| `/admin/presets` | 블라인드 |
| `/admin/games/new` | 게임 개설 |
| `/admin/games/[id]` | 라이브 타이머 · 멀티테이블 |
| `/staff/games` | 직원용 게임 목록 |
| `/admin/operations` | 진행 게임 멀티 탭 |
| `/admin/settlement/daily` | 일일 정산 · 대차 검증 |
| `/admin/settlement/monthly` | 월간 P&L · 급여 · 승점 |
| `/admin/staff` | 직원 출퇴근 · 가불 |
| `/admin/events` | 돌림판 · 뽑기 |
| `/tv` | TV 타이머 (대형 표시) |

## 문서

- [docs/PRD.md](docs/PRD.md) — 요구사항 정의
