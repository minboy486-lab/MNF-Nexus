/**
 * 로그인 QR + 웹앱 설치 포스터 생성 (미드나잇 홀덤)
 * Usage: node scripts/generate-login-poster.mjs
 * Optional: LOGIN_URL=https://... node scripts/generate-login-poster.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const QRCode = require("../timer-desktop/node_modules/qrcode");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/marketing");
const LOGIN_URL = (process.env.LOGIN_URL ?? "https://mnf-nexus.vercel.app/login").trim();
const BRAND = "미드나잇 홀덤";
const SHARE_ICON = path.join(OUT, "safari-share-icon-clean.png");

mkdirSync(OUT, { recursive: true });

// Safari 공유 아이콘 (로그인 화면 주소창과 동일한 □↑ 형태)
const shareSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="#ffffff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
    <path d="M128 36 L128 150"/>
    <path d="M86 78 L128 36 L170 78"/>
    <path d="M56 118 L56 210 Q56 222 68 222 L188 222 Q200 222 200 210 L200 118"/>
  </g>
</svg>`);
await sharp(shareSvg).png().toFile(SHARE_ICON);

const qrPng = await QRCode.toBuffer(LOGIN_URL, {
  type: "png",
  width: 1200,
  margin: 2,
  errorCorrectionLevel: "H",
  color: { dark: "#120816", light: "#ffffff" },
});

const qrPath = path.join(OUT, "login-qr.png");
await sharp(qrPng).png().toFile(qrPath);

async function makePoster({ file, qrSize, qrTop, qrLeft, overlays, svg }) {
  const qr = await sharp(qrPng).resize(qrSize, qrSize).png().toBuffer();
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  const out = path.join(OUT, file);
  await sharp(base)
    .composite([{ input: qr, top: qrTop, left: qrLeft }, ...overlays])
    .png()
    .toFile(out);
  return out;
}

const printW = 2480;
const printH = 3508;
const printPath = await makePoster({
  file: "chrome-webapp-poster.png",
  qrSize: 700,
  qrTop: 400,
  qrLeft: 890,
  overlays: [],
  svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${printW}" height="${printH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07050c"/>
      <stop offset="50%" stop-color="#120816"/>
      <stop offset="100%" stop-color="#1a0f1c"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#9b6dff"/>
      <stop offset="100%" stop-color="#ffb6c9"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1c1628"/>
      <stop offset="100%" stop-color="#121018"/>
    </linearGradient>
  </defs>
  <rect width="${printW}" height="${printH}" fill="url(#bg)"/>
  <circle cx="360" cy="260" r="420" fill="#9b6dff" opacity="0.10"/>
  <circle cx="2140" cy="3100" r="520" fill="#ff9ec4" opacity="0.10"/>

  <text x="1240" y="120" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="54" fill="#c4b0c4" letter-spacing="8">${BRAND}</text>
  <text x="1240" y="235" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="112" font-weight="700" fill="#f4eef6">홈페이지 로그인</text>
  <text x="1240" y="320" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="50" fill="#ffb6c9">QR을 스캔하세요</text>

  <rect x="860" y="370" width="760" height="760" rx="40" fill="#ffffff"/>
  <rect x="860" y="370" width="760" height="760" rx="40" fill="none" stroke="url(#accent)" stroke-width="8"/>
  <text x="1240" y="1190" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="34" fill="#c4b0c4">${LOGIN_URL}</text>

  <!-- Android: shorter card -->
  <rect x="90" y="1280" width="1110" height="1680" rx="48" fill="url(#card)" stroke="#4a3848" stroke-width="4"/>
  <text x="180" y="1430" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="78" font-weight="700" fill="#ffe4f0">Android</text>
  <text x="180" y="1510" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" fill="#c4b0c4">Chrome 기준</text>

  <circle cx="250" cy="1700" r="58" fill="url(#accent)"/>
  <text x="250" y="1720" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" font-weight="700" fill="#1a1020">1</text>
  <text x="360" y="1675" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="58" font-weight="700" fill="#f4eef6">Chrome으로 열기</text>
  <text x="360" y="1760" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="46" fill="#c4b0c4">QR 스캔 후 Chrome 선택</text>

  <circle cx="250" cy="2020" r="58" fill="url(#accent)"/>
  <text x="250" y="2040" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" font-weight="700" fill="#1a1020">2</text>
  <text x="360" y="1995" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="58" font-weight="700" fill="#f4eef6">오른쪽 위 ⋮ 메뉴</text>
  <text x="360" y="2080" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="46" fill="#c4b0c4">점 3개 버튼을 누름</text>

  <circle cx="250" cy="2340" r="58" fill="url(#accent)"/>
  <text x="250" y="2360" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" font-weight="700" fill="#1a1020">3</text>
  <text x="360" y="2315" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="58" font-weight="700" fill="#f4eef6">앱 설치</text>
  <text x="360" y="2400" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="46" fill="#c4b0c4">또는 「홈 화면에 추가」</text>

  <circle cx="250" cy="2660" r="58" fill="url(#accent)"/>
  <text x="250" y="2680" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" font-weight="700" fill="#1a1020">4</text>
  <text x="360" y="2635" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="58" font-weight="700" fill="#f4eef6">아이콘으로 실행</text>
  <text x="360" y="2720" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="46" fill="#c4b0c4">홈 화면에서 바로 접속</text>

  <!-- iPhone: shorter card -->
  <rect x="1280" y="1280" width="1110" height="1680" rx="48" fill="url(#card)" stroke="#4a3848" stroke-width="4"/>
  <text x="1370" y="1430" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="78" font-weight="700" fill="#ffe4f0">iPhone</text>
  <text x="1370" y="1510" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" fill="#c4b0c4">Safari 기준</text>

  <circle cx="1450" cy="1700" r="58" fill="url(#accent)"/>
  <text x="1450" y="1720" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" font-weight="700" fill="#1a1020">1</text>
  <text x="1560" y="1675" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="58" font-weight="700" fill="#f4eef6">Safari로 열기</text>
  <text x="1560" y="1760" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="46" fill="#c4b0c4">QR 스캔 후 Safari 선택</text>

  <circle cx="1450" cy="2020" r="58" fill="url(#accent)"/>
  <text x="1450" y="2040" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" font-weight="700" fill="#1a1020">2</text>
  <!-- share icon vertically centered with title line -->
  <g transform="translate(1560 1978)" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <path d="M44 8 L44 58"/>
    <path d="M24 28 L44 8 L64 28"/>
    <path d="M16 48 L16 84 Q16 92 24 92 L64 92 Q72 92 72 84 L72 48"/>
  </g>
  <text x="1660" y="1995" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="54" font-weight="700" fill="#f4eef6">공유 아이콘 누르기</text>
  <text x="1560" y="2080" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="46" fill="#c4b0c4">주소창 오른쪽 공유 버튼</text>

  <circle cx="1450" cy="2340" r="58" fill="url(#accent)"/>
  <text x="1450" y="2360" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" font-weight="700" fill="#1a1020">3</text>
  <text x="1560" y="2315" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="58" font-weight="700" fill="#f4eef6">더보기</text>
  <text x="1560" y="2400" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="46" fill="#c4b0c4">목록에서 「더보기」 선택</text>

  <circle cx="1450" cy="2660" r="58" fill="url(#accent)"/>
  <text x="1450" y="2680" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" font-weight="700" fill="#1a1020">4</text>
  <text x="1560" y="2635" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="58" font-weight="700" fill="#f4eef6">홈 화면에 추가</text>
  <text x="1560" y="2720" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="46" fill="#c4b0c4">추가 후 아이콘으로 실행</text>

  <text x="1240" y="3180" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" fill="#9a8898">${BRAND}</text>
</svg>`,
});

const phoneW = 1080;
const phoneH = 1920;
const phonePath = await makePoster({
  file: "chrome-webapp-poster-phone.png",
  qrSize: 320,
  qrTop: 190,
  qrLeft: 380,
  overlays: [],
  svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${phoneW}" height="${phoneH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07050c"/>
      <stop offset="100%" stop-color="#1a0f1c"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#9b6dff"/>
      <stop offset="100%" stop-color="#ffb6c9"/>
    </linearGradient>
  </defs>
  <rect width="${phoneW}" height="${phoneH}" fill="url(#bg)"/>
  <circle cx="140" cy="140" r="180" fill="#9b6dff" opacity="0.12"/>
  <circle cx="960" cy="1680" r="220" fill="#ff9ec4" opacity="0.12"/>

  <text x="540" y="65" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#c4b0c4" letter-spacing="3">${BRAND}</text>
  <text x="540" y="125" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="54" font-weight="700" fill="#f4eef6">홈페이지 로그인</text>
  <text x="540" y="172" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#ffb6c9">QR 스캔 → 로그인</text>

  <rect x="360" y="170" width="360" height="360" rx="20" fill="#ffffff"/>
  <text x="540" y="565" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#c4b0c4">${LOGIN_URL}</text>

  <rect x="28" y="600" width="500" height="1040" rx="26" fill="#16121e" stroke="#4a3848" stroke-width="2"/>
  <text x="62" y="690" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" font-weight="700" fill="#ffe4f0">Android</text>
  <text x="62" y="740" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">Chrome</text>

  <circle cx="98" cy="860" r="32" fill="url(#accent)"/>
  <text x="98" y="872" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" font-weight="700" fill="#1a1020">1</text>
  <text x="155" y="850" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">Chrome으로 열기</text>
  <text x="155" y="895" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">QR 후 Chrome 선택</text>

  <circle cx="98" cy="1030" r="32" fill="url(#accent)"/>
  <text x="98" y="1042" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" font-weight="700" fill="#1a1020">2</text>
  <text x="155" y="1020" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">우측 상단 ⋮</text>
  <text x="155" y="1065" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">Chrome 메뉴</text>

  <circle cx="98" cy="1200" r="32" fill="url(#accent)"/>
  <text x="98" y="1212" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" font-weight="700" fill="#1a1020">3</text>
  <text x="155" y="1190" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">앱 설치</text>
  <text x="155" y="1235" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">또는 홈 화면에 추가</text>

  <circle cx="98" cy="1370" r="32" fill="url(#accent)"/>
  <text x="98" y="1382" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" font-weight="700" fill="#1a1020">4</text>
  <text x="155" y="1360" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">아이콘으로 실행</text>
  <text x="155" y="1405" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">앱처럼 바로 접속</text>

  <rect x="552" y="600" width="500" height="1040" rx="26" fill="#16121e" stroke="#4a3848" stroke-width="2"/>
  <text x="586" y="690" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" font-weight="700" fill="#ffe4f0">iPhone</text>
  <text x="586" y="740" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">Safari</text>

  <circle cx="622" cy="860" r="32" fill="url(#accent)"/>
  <text x="622" y="872" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" font-weight="700" fill="#1a1020">1</text>
  <text x="679" y="850" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">Safari로 열기</text>
  <text x="679" y="895" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">QR 후 Safari 선택</text>

  <circle cx="622" cy="1030" r="32" fill="url(#accent)"/>
  <text x="622" y="1042" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" font-weight="700" fill="#1a1020">2</text>
  <g transform="translate(678 1000)" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 4 L22 30"/>
    <path d="M12 14 L22 4 L32 14"/>
    <path d="M8 24 L8 42 Q8 46 12 46 L32 46 Q36 46 36 42 L36 24"/>
  </g>
  <text x="730" y="1020" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f4eef6">공유 아이콘</text>
  <text x="679" y="1065" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">주소창 공유 버튼</text>

  <circle cx="622" cy="1200" r="32" fill="url(#accent)"/>
  <text x="622" y="1212" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" font-weight="700" fill="#1a1020">3</text>
  <text x="679" y="1190" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">더보기</text>
  <text x="679" y="1235" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">목록에서 더보기</text>

  <circle cx="622" cy="1370" r="32" fill="url(#accent)"/>
  <text x="622" y="1382" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" font-weight="700" fill="#1a1020">4</text>
  <text x="679" y="1360" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">홈 화면에 추가</text>
  <text x="679" y="1405" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">아이콘으로 실행</text>

  <text x="540" y="1760" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#9a8898">${BRAND}</text>
</svg>`,
});

console.log(`Brand:  ${BRAND}`);
console.log(`Login:  ${LOGIN_URL}`);
console.log(`QR:     ${qrPath}`);
console.log(`Print:  ${printPath}`);
console.log(`Phone:  ${phonePath}`);
