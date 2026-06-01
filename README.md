# MNF HOLDEM · Nexus

홀덤 매장 통합 관리 (Next.js App Router + Supabase).

## 시작하기

```bash
cp .env.example .env.local
# Supabase URL / anon key 입력

npm install
npm run dev
```

- **Supabase 미설정:** [http://localhost:3000/admin/dashboard](http://localhost:3000/admin/dashboard) 데모 데이터로 UI 확인
- **Supabase 설정 후:** [http://localhost:3000/login](http://localhost:3000/login) 로그인

## Supabase 설정

1. [supabase/migrations/001_initial.sql](supabase/migrations/001_initial.sql) SQL 실행
2. [supabase/migrations/002_platform.sql](supabase/migrations/002_platform.sql) SQL 실행
3. [supabase/migrations/003_prize_guest.sql](supabase/migrations/003_prize_guest.sql) SQL 실행
4. [supabase/seed.sql](supabase/seed.sql) 시드 실행
4. Auth에서 사용자 생성 후:

```sql
update public.profiles
set role = 'admin',
    venue_id = '00000000-0000-4000-8000-000000000001'
where id = '<user-uuid>';
-- 직원: role = 'staff'
```

5. 대시보드에서 **영업 시작** → `/counter` 접수대 · 방문 등록 사용

## 주요 경로

| 경로 | 설명 |
|------|------|
| `/login` | 로그인 |
| `/counter` | 접수대 (전화 조회 · 방문 자동 등록) |
| `/admin/games/[id]/settlement` | 프라이즈 · ICM 찹 |
| `/guest` | 손님 모바일 (포인트·예약·바이인·이체 요청) |
| `/admin/dashboard` | 관리자 대시보드 · 영업 오픈/마감 |
| `/admin/tables` | 물리 테이블 통합 뷰 (A–D) |
| `/admin/tables/[id]` | 테이블 상세 · 좌석 배정 |
| `/admin/guests` | 손님 (방문/대기/게임중/예약) |
| `/admin/presets` | 게임 프리셋 |
| `/admin/games/new` | 게임 개설 |
| `/admin/games/[id]` | 라이브 타이머 · 멀티테이블 |
| `/staff/games` | 직원용 게임 목록 |

## 문서

- [docs/PRD.md](docs/PRD.md) — 요구사항 정의
