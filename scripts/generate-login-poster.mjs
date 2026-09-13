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
const printH = 2980;
const printPath = await makePoster({
  file: "chrome-webapp-poster.png",
  qrSize: 680,
  qrTop: 380,
  qrLeft: 900,
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
  <circle cx="360" cy="240" r="400" fill="#9b6dff" opacity="0.10"/>
  <circle cx="2140" cy="2800" r="480" fill="#ff9ec4" opacity="0.10"/>

  <text x="1240" y="110" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="52" fill="#c4b0c4" letter-spacing="8">${BRAND}</text>
  <text x="1240" y="220" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="108" font-weight="700" fill="#f4eef6">홈페이지 로그인</text>
  <text x="1240" y="300" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#ffb6c9">QR을 스캔하세요</text>

  <rect x="870" y="350" width="740" height="740" rx="36" fill="#ffffff"/>
  <rect x="870" y="350" width="740" height="740" rx="36" fill="none" stroke="url(#accent)" stroke-width="8"/>
  <text x="1240" y="1145" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" fill="#c4b0c4">${LOGIN_URL}</text>

  <!-- Android -->
  <rect x="90" y="1220" width="1110" height="1480" rx="44" fill="url(#card)" stroke="#4a3848" stroke-width="4"/>
  <text x="180" y="1360" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="76" font-weight="700" fill="#ffe4f0">Android</text>
  <text x="180" y="1435" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" fill="#c4b0c4">Chrome 기준</text>

  <circle cx="250" cy="1620" r="56" fill="url(#accent)"/>
  <text x="250" y="1640" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#1a1020">1</text>
  <text x="360" y="1595" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">Chrome으로 열기</text>
  <text x="360" y="1680" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c4b0c4">QR 스캔 후 Chrome 선택</text>

  <circle cx="250" cy="1910" r="56" fill="url(#accent)"/>
  <text x="250" y="1930" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#1a1020">2</text>
  <text x="360" y="1885" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">오른쪽 위 ⋮ 메뉴</text>
  <text x="360" y="1970" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c4b0c4">점 3개 버튼을 누름</text>

  <circle cx="250" cy="2200" r="56" fill="url(#accent)"/>
  <text x="250" y="2220" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#1a1020">3</text>
  <text x="360" y="2175" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">앱 설치</text>
  <text x="360" y="2260" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c4b0c4">또는 「홈 화면에 추가」</text>

  <circle cx="250" cy="2490" r="56" fill="url(#accent)"/>
  <text x="250" y="2510" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#1a1020">4</text>
  <text x="360" y="2465" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">아이콘으로 실행</text>
  <text x="360" y="2550" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c4b0c4">홈 화면에서 바로 접속</text>

  <!-- iPhone -->
  <rect x="1280" y="1220" width="1110" height="1480" rx="44" fill="url(#card)" stroke="#4a3848" stroke-width="4"/>
  <text x="1370" y="1360" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="76" font-weight="700" fill="#ffe4f0">iPhone</text>
  <text x="1370" y="1435" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" fill="#c4b0c4">Safari 기준</text>

  <circle cx="1450" cy="1620" r="56" fill="url(#accent)"/>
  <text x="1450" y="1640" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#1a1020">1</text>
  <text x="1560" y="1595" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">Safari로 열기</text>
  <text x="1560" y="1680" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c4b0c4">QR 스캔 후 Safari 선택</text>

  <circle cx="1450" cy="1910" r="56" fill="url(#accent)"/>
  <text x="1450" y="1930" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#1a1020">2</text>
  <!-- title + share icon on one line, subtitle below aligned with title -->
  <text x="1560" y="1885" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="54" font-weight="700" fill="#f4eef6">공유 아이콘 누르기</text>
  <g transform="translate(2140 1836)" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M32 6 L32 42"/>
    <path d="M16 22 L32 6 L48 22"/>
    <path d="M12 36 L12 62 Q12 68 18 68 L46 68 Q52 68 52 62 L52 36"/>
  </g>
  <text x="1560" y="1970" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c4b0c4">주소창 오른쪽 공유 버튼</text>

  <circle cx="1450" cy="2200" r="56" fill="url(#accent)"/>
  <text x="1450" y="2220" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#1a1020">3</text>
  <text x="1560" y="2175" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">더보기</text>
  <text x="1560" y="2260" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c4b0c4">목록에서 「더보기」 선택</text>

  <circle cx="1450" cy="2490" r="56" fill="url(#accent)"/>
  <text x="1450" y="2510" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#1a1020">4</text>
  <text x="1560" y="2465" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">홈 화면에 추가</text>
  <text x="1560" y="2550" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c4b0c4">추가 후 아이콘으로 실행</text>

  <text x="1240" y="2880" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" fill="#9a8898">${BRAND}</text>
</svg>`,
});

const phoneW = 1080;
const phoneH = 1680;
const phonePath = await makePoster({
  file: "chrome-webapp-poster-phone.png",
  qrSize: 300,
  qrTop: 175,
  qrLeft: 390,
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
  <circle cx="140" cy="120" r="160" fill="#9b6dff" opacity="0.12"/>
  <circle cx="960" cy="1560" r="200" fill="#ff9ec4" opacity="0.12"/>

  <text x="540" y="58" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" fill="#c4b0c4" letter-spacing="3">${BRAND}</text>
  <text x="540" y="115" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="50" font-weight="700" fill="#f4eef6">홈페이지 로그인</text>
  <text x="540" y="158" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" fill="#ffb6c9">QR 스캔 → 로그인</text>

  <rect x="370" y="155" width="340" height="340" rx="18" fill="#ffffff"/>
  <text x="540" y="525" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="15" fill="#c4b0c4">${LOGIN_URL}</text>

  <rect x="28" y="555" width="500" height="1040" rx="24" fill="#16121e" stroke="#4a3848" stroke-width="2"/>
  <text x="62" y="640" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#ffe4f0">Android</text>
  <text x="62" y="688" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">Chrome</text>

  <circle cx="98" cy="800" r="30" fill="url(#accent)"/>
  <text x="98" y="811" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">1</text>
  <text x="155" y="790" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f4eef6">Chrome으로 열기</text>
  <text x="155" y="835" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">QR 후 Chrome 선택</text>

  <circle cx="98" cy="960" r="30" fill="url(#accent)"/>
  <text x="98" y="971" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">2</text>
  <text x="155" y="950" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f4eef6">우측 상단 ⋮</text>
  <text x="155" y="995" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">Chrome 메뉴</text>

  <circle cx="98" cy="1120" r="30" fill="url(#accent)"/>
  <text x="98" y="1131" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">3</text>
  <text x="155" y="1110" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f4eef6">앱 설치</text>
  <text x="155" y="1155" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">또는 홈 화면에 추가</text>

  <circle cx="98" cy="1280" r="30" fill="url(#accent)"/>
  <text x="98" y="1291" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">4</text>
  <text x="155" y="1270" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f4eef6">아이콘으로 실행</text>
  <text x="155" y="1315" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">앱처럼 바로 접속</text>

  <rect x="552" y="555" width="500" height="1040" rx="24" fill="#16121e" stroke="#4a3848" stroke-width="2"/>
  <text x="586" y="640" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#ffe4f0">iPhone</text>
  <text x="586" y="688" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">Safari</text>

  <circle cx="622" cy="800" r="30" fill="url(#accent)"/>
  <text x="622" y="811" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">1</text>
  <text x="679" y="790" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f4eef6">Safari로 열기</text>
  <text x="679" y="835" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">QR 후 Safari 선택</text>

  <circle cx="622" cy="960" r="30" fill="url(#accent)"/>
  <text x="622" y="971" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">2</text>
  <text x="679" y="950" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="700" fill="#f4eef6">공유 아이콘</text>
  <g transform="translate(900 918)" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 3 L18 24"/>
    <path d="M9 12 L18 3 L27 12"/>
    <path d="M6 20 L6 34 Q6 38 10 38 L26 38 Q30 38 30 34 L30 20"/>
  </g>
  <text x="679" y="995" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">주소창 공유 버튼</text>

  <circle cx="622" cy="1120" r="30" fill="url(#accent)"/>
  <text x="622" y="1131" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">3</text>
  <text x="679" y="1110" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f4eef6">더보기</text>
  <text x="679" y="1155" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">목록에서 더보기</text>

  <circle cx="622" cy="1280" r="30" fill="url(#accent)"/>
  <text x="622" y="1291" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">4</text>
  <text x="679" y="1270" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f4eef6">홈 화면에 추가</text>
  <text x="679" y="1315" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4">아이콘으로 실행</text>

  <text x="540" y="1680" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#9a8898">${BRAND}</text>
</svg>`,
});

console.log(`Brand:  ${BRAND}`);
console.log(`Login:  ${LOGIN_URL}`);
console.log(`QR:     ${qrPath}`);
console.log(`Print:  ${printPath}`);
console.log(`Phone:  ${phonePath}`);
