# 로컬에서 Vercel 화면 보면서 수정하기

Vercel에 배포된 것과 **같은 코드**를 PC에서 실행하면, 저장할 때마다 브라우저에 바로 반영됩니다.

## 1. 개발 서버 실행

```bash
cd /Users/min/mnf
npm run dev
```

터미널에 `Local: http://localhost:3000` 이 보이면 성공입니다.

## 2. 브라우저에서 열기

| 화면 | 주소 |
|------|------|
| 로그인 | http://localhost:3000/login |
| 통합 테이블 | http://localhost:3000/admin/tables |
| 손님 관리 | http://localhost:3000/admin/guests |
| 대시보드 | http://localhost:3000/admin/dashboard |

**Vercel URL**과 **localhost**는 같은 DB(`.env.local`의 Supabase)를 쓰면 데이터도 동일합니다.

## 3. Cursor에서 나란히 보기

1. 왼쪽: 코드 편집 (`components/`, `app/` 등)
2. 오른쪽: **Simple Browser** 또는 Chrome에서 `http://localhost:3000/admin/tables` 고정
3. 파일 저장 → 1~2초 안에 화면 자동 새로고침 (Hot Reload)

## 4. Vercel에 반영 (배포)

로컬에서 확인한 뒤:

```bash
git add .
git commit -m "변경 내용"
git push
```

Vercel이 자동으로 다시 빌드·배포합니다. 배포 URL은 Vercel 대시보드에서 확인하세요.

## 5. 환경 변수 (Vercel과 맞추기)

로컬 `.env.local`이 Vercel **Settings → Environment Variables** 와 같아야 합니다.

```bash
npm run check:env
```

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Vercel에서 값 복사: Project → Settings → Environment Variables → Production

## 6. 자주 쓰는 경로

- 코드 수정 후 테이블 UI: `components/tables/IntegratedTableView.tsx`
- 손님 관리 UI: `components/guests/GuestsClient.tsx`
- 스타일: `app/globals.css`

## 문제 해결

| 증상 | 해결 |
|------|------|
| localhost 안 열림 | `npm run dev` 다시 실행, 3000 포트 사용 중인지 확인 |
| Vercel과 데이터 다름 | `.env.local` Supabase 키가 Production과 같은지 확인 |
| 변경이 안 보임 | 브라우저 강력 새로고침 (Cmd+Shift+R) |
