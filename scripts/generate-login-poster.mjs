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
const printShare = await sharp(SHARE_ICON).resize(96, 96).png().toBuffer();
const printPath = await makePoster({
  file: "chrome-webapp-poster.png",
  qrSize: 720,
  qrTop: 420,
  qrLeft: 880,
  overlays: [
    // iPhone step 2 share icon
    { input: printShare, top: 2088, left: 1530 },
  ],
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
  <circle cx="360" cy="280" r="460" fill="#9b6dff" opacity="0.10"/>
  <circle cx="2140" cy="3180" r="560" fill="#ff9ec4" opacity="0.10"/>

  <text x="1240" y="130" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="58" fill="#c4b0c4" letter-spacing="8">${BRAND}</text>
  <text x="1240" y="250" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="118" font-weight="700" fill="#f4eef6">홈페이지 로그인</text>
  <text x="1240" y="340" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="52" fill="#ffb6c9">QR을 스캔하세요</text>

  <rect x="850" y="390" width="780" height="780" rx="40" fill="#ffffff"/>
  <rect x="850" y="390" width="780" height="780" rx="40" fill="none" stroke="url(#accent)" stroke-width="8"/>
  <text x="1240" y="1235" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" fill="#c4b0c4">${LOGIN_URL}</text>

  <!-- Android -->
  <rect x="80" y="1320" width="1120" height="2020" rx="52" fill="url(#card)" stroke="#4a3848" stroke-width="4"/>
  <text x="170" y="1490" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="84" font-weight="700" fill="#ffe4f0">Android</text>
  <text x="170" y="1580" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" fill="#c4b0c4">Chrome 기준</text>

  <circle cx="250" cy="1800" r="64" fill="url(#accent)"/>
  <text x="250" y="1822" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" font-weight="700" fill="#1a1020">1</text>
  <text x="360" y="1775" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">Chrome으로 열기</text>
  <text x="360" y="1860" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="38" fill="#c4b0c4">QR 스캔 후 Chrome 선택</text>

  <circle cx="250" cy="2160" r="64" fill="url(#accent)"/>
  <text x="250" y="2182" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" font-weight="700" fill="#1a1020">2</text>
  <text x="360" y="2135" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">오른쪽 위 ⋮ 메뉴</text>
  <text x="360" y="2220" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="38" fill="#c4b0c4">점 3개 버튼을 누름</text>

  <circle cx="250" cy="2520" r="64" fill="url(#accent)"/>
  <text x="250" y="2542" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" font-weight="700" fill="#1a1020">3</text>
  <text x="360" y="2495" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">앱 설치</text>
  <text x="360" y="2580" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="38" fill="#c4b0c4">또는 「홈 화면에 추가」</text>

  <circle cx="250" cy="2880" r="64" fill="url(#accent)"/>
  <text x="250" y="2902" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" font-weight="700" fill="#1a1020">4</text>
  <text x="360" y="2855" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">아이콘으로 실행</text>
  <text x="360" y="2940" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="38" fill="#c4b0c4">홈 화면에서 바로 접속</text>

  <!-- iPhone -->
  <rect x="1280" y="1320" width="1120" height="2020" rx="52" fill="url(#card)" stroke="#4a3848" stroke-width="4"/>
  <text x="1370" y="1490" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="84" font-weight="700" fill="#ffe4f0">iPhone</text>
  <text x="1370" y="1580" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" fill="#c4b0c4">Safari 기준</text>

  <circle cx="1450" cy="1800" r="64" fill="url(#accent)"/>
  <text x="1450" y="1822" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" font-weight="700" fill="#1a1020">1</text>
  <text x="1560" y="1775" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">Safari로 열기</text>
  <text x="1560" y="1860" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="38" fill="#c4b0c4">QR 스캔 후 Safari 선택</text>

  <circle cx="1450" cy="2160" r="64" fill="url(#accent)"/>
  <text x="1450" y="2182" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" font-weight="700" fill="#1a1020">2</text>
  <text x="1660" y="2135" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="52" font-weight="700" fill="#f4eef6">공유 아이콘 누르기</text>
  <text x="1560" y="2220" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="38" fill="#c4b0c4">주소창 오른쪽 공유 버튼</text>

  <circle cx="1450" cy="2520" r="64" fill="url(#accent)"/>
  <text x="1450" y="2542" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" font-weight="700" fill="#1a1020">3</text>
  <text x="1560" y="2495" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">더보기</text>
  <text x="1560" y="2580" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="38" fill="#c4b0c4">목록에서 「더보기」 선택</text>

  <circle cx="1450" cy="2880" r="64" fill="url(#accent)"/>
  <text x="1450" y="2902" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" font-weight="700" fill="#1a1020">4</text>
  <text x="1560" y="2855" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f4eef6">홈 화면에 추가</text>
  <text x="1560" y="2940" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="38" fill="#c4b0c4">추가 후 아이콘으로 실행</text>

  <text x="1240" y="3420" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" fill="#9a8898">${BRAND}</text>
</svg>`,
});

const phoneW = 1080;
const phoneH = 1920;
const phoneShare = await sharp(SHARE_ICON).resize(56, 56).png().toBuffer();
const phonePath = await makePoster({
  file: "chrome-webapp-poster-phone.png",
  qrSize: 340,
  qrTop: 200,
  qrLeft: 370,
  overlays: [{ input: phoneShare, top: 1070, left: 668 }],
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
  <circle cx="140" cy="160" r="200" fill="#9b6dff" opacity="0.12"/>
  <circle cx="960" cy="1740" r="240" fill="#ff9ec4" opacity="0.12"/>

  <text x="540" y="70" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" fill="#c4b0c4" letter-spacing="3">${BRAND}</text>
  <text x="540" y="135" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="58" font-weight="700" fill="#f4eef6">홈페이지 로그인</text>
  <text x="540" y="185" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" fill="#ffb6c9">QR 스캔 → 로그인</text>

  <rect x="350" y="180" width="380" height="380" rx="22" fill="#ffffff"/>
  <text x="540" y="600" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="17" fill="#c4b0c4">${LOGIN_URL}</text>

  <rect x="24" y="640" width="508" height="1180" rx="28" fill="#16121e" stroke="#4a3848" stroke-width="2"/>
  <text x="60" y="740" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="46" font-weight="700" fill="#ffe4f0">Android</text>
  <text x="60" y="795" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" fill="#c4b0c4">Chrome</text>

  <circle cx="95" cy="920" r="34" fill="url(#accent)"/>
  <text x="95" y="932" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="700" fill="#1a1020">1</text>
  <text x="155" y="910" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">Chrome으로 열기</text>
  <text x="155" y="955" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c4b0c4">QR 후 Chrome 선택</text>

  <circle cx="95" cy="1120" r="34" fill="url(#accent)"/>
  <text x="95" y="1132" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="700" fill="#1a1020">2</text>
  <text x="155" y="1110" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">우측 상단 ⋮</text>
  <text x="155" y="1155" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c4b0c4">Chrome 메뉴</text>

  <circle cx="95" cy="1320" r="34" fill="url(#accent)"/>
  <text x="95" y="1332" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="700" fill="#1a1020">3</text>
  <text x="155" y="1310" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">앱 설치</text>
  <text x="155" y="1355" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c4b0c4">또는 홈 화면에 추가</text>

  <circle cx="95" cy="1520" r="34" fill="url(#accent)"/>
  <text x="95" y="1532" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="700" fill="#1a1020">4</text>
  <text x="155" y="1510" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">아이콘으로 실행</text>
  <text x="155" y="1555" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c4b0c4">앱처럼 바로 접속</text>

  <rect x="548" y="640" width="508" height="1180" rx="28" fill="#16121e" stroke="#4a3848" stroke-width="2"/>
  <text x="584" y="740" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="46" font-weight="700" fill="#ffe4f0">iPhone</text>
  <text x="584" y="795" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" fill="#c4b0c4">Safari</text>

  <circle cx="619" cy="920" r="34" fill="url(#accent)"/>
  <text x="619" y="932" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="700" fill="#1a1020">1</text>
  <text x="679" y="910" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">Safari로 열기</text>
  <text x="679" y="955" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c4b0c4">QR 후 Safari 선택</text>

  <circle cx="619" cy="1120" r="34" fill="url(#accent)"/>
  <text x="619" y="1132" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="700" fill="#1a1020">2</text>
  <text x="740" y="1110" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f4eef6">공유 아이콘</text>
  <text x="679" y="1155" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c4b0c4">주소창 공유 버튼</text>

  <circle cx="619" cy="1320" r="34" fill="url(#accent)"/>
  <text x="619" y="1332" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="700" fill="#1a1020">3</text>
  <text x="679" y="1310" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">더보기</text>
  <text x="679" y="1355" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c4b0c4">목록에서 더보기</text>

  <circle cx="619" cy="1520" r="34" fill="url(#accent)"/>
  <text x="619" y="1532" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="700" fill="#1a1020">4</text>
  <text x="679" y="1510" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#f4eef6">홈 화면에 추가</text>
  <text x="679" y="1555" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c4b0c4">아이콘으로 실행</text>

  <text x="540" y="1880" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" fill="#9a8898">${BRAND}</text>
</svg>`,
});

console.log(`Brand:  ${BRAND}`);
console.log(`Login:  ${LOGIN_URL}`);
console.log(`QR:     ${qrPath}`);
console.log(`Print:  ${printPath}`);
console.log(`Phone:  ${phonePath}`);
