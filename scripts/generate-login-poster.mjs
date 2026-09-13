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

mkdirSync(OUT, { recursive: true });

const qrPng = await QRCode.toBuffer(LOGIN_URL, {
  type: "png",
  width: 1200,
  margin: 2,
  errorCorrectionLevel: "H",
  color: { dark: "#120816", light: "#ffffff" },
});

const qrPath = path.join(OUT, "login-qr.png");
await sharp(qrPng).png().toFile(qrPath);

async function makePoster({ file, qrSize, qrTop, qrLeft, svg }) {
  const qr = await sharp(qrPng).resize(qrSize, qrSize).png().toBuffer();
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  const out = path.join(OUT, file);
  await sharp(base)
    .composite([{ input: qr, top: qrTop, left: qrLeft }])
    .png()
    .toFile(out);
  return out;
}

const printW = 2480;
const printH = 3508;
const printPath = await makePoster({
  file: "chrome-webapp-poster.png",
  qrSize: 900,
  qrTop: 560,
  qrLeft: 790,
  svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${printW}" height="${printH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07050c"/>
      <stop offset="45%" stop-color="#120816"/>
      <stop offset="100%" stop-color="#1a0f1c"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#9b6dff"/>
      <stop offset="55%" stop-color="#ff9ec4"/>
      <stop offset="100%" stop-color="#ffb6c9"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1524"/>
      <stop offset="100%" stop-color="#121018"/>
    </linearGradient>
  </defs>
  <rect width="${printW}" height="${printH}" fill="url(#bg)"/>
  <circle cx="420" cy="320" r="480" fill="#9b6dff" opacity="0.10"/>
  <circle cx="2100" cy="3100" r="600" fill="#ff9ec4" opacity="0.10"/>

  <rect x="180" y="120" width="220" height="8" rx="4" fill="url(#accent)"/>
  <text x="180" y="210" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c4b0c4" letter-spacing="6">${BRAND}</text>
  <text x="180" y="340" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="92" font-weight="700" fill="#f4eef6">홈페이지 로그인</text>
  <text x="180" y="430" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="44" fill="#ffb6c9">QR을 스캔하세요</text>
  <text x="180" y="500" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="34" fill="#c4b0c4">휴대폰 카메라로 찍으면 로그인 화면으로 이동합니다</text>

  <rect x="760" y="530" width="960" height="960" rx="44" fill="#ffffff"/>
  <rect x="760" y="530" width="960" height="960" rx="44" fill="none" stroke="url(#accent)" stroke-width="6"/>
  <text x="1240" y="1550" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" fill="#c4b0c4">${LOGIN_URL}</text>

  <!-- Android card -->
  <rect x="180" y="1640" width="1020" height="1560" rx="48" fill="url(#card)" stroke="#4a3848" stroke-width="3"/>
  <text x="240" y="1760" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" font-weight="700" fill="#ffe4f0">Android</text>
  <text x="240" y="1830" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" fill="#c4b0c4">Chrome 기준</text>

  <circle cx="290" cy="1960" r="40" fill="url(#accent)"/>
  <text x="290" y="1974" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" font-weight="700" fill="#1a1020">1</text>
  <text x="370" y="1950" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="600" fill="#f4eef6">Chrome으로 열기</text>
  <text x="370" y="2005" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#c4b0c4">QR 스캔 후 Chrome을 선택</text>

  <circle cx="290" cy="2170" r="40" fill="url(#accent)"/>
  <text x="290" y="2184" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" font-weight="700" fill="#1a1020">2</text>
  <text x="370" y="2160" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="600" fill="#f4eef6">오른쪽 위 ⋮ 메뉴</text>
  <text x="370" y="2215" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#c4b0c4">Chrome 점 3개 버튼을 누름</text>

  <circle cx="290" cy="2380" r="40" fill="url(#accent)"/>
  <text x="290" y="2394" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" font-weight="700" fill="#1a1020">3</text>
  <text x="370" y="2370" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="600" fill="#f4eef6">앱 설치</text>
  <text x="370" y="2425" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#c4b0c4">「앱 설치」 또는 「홈 화면에 추가」</text>

  <circle cx="290" cy="2590" r="40" fill="url(#accent)"/>
  <text x="290" y="2604" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" font-weight="700" fill="#1a1020">4</text>
  <text x="370" y="2580" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="600" fill="#f4eef6">홈 화면 아이콘으로 실행</text>
  <text x="370" y="2635" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#c4b0c4">다음부터 앱처럼 바로 접속</text>

  <text x="240" y="2800" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#9a8898">※ 메뉴에 「앱 설치」가 없으면</text>
  <text x="240" y="2850" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#9a8898">「홈 화면에 추가」를 선택하세요</text>

  <!-- iPhone card -->
  <rect x="1280" y="1640" width="1020" height="1560" rx="48" fill="url(#card)" stroke="#4a3848" stroke-width="3"/>
  <text x="1340" y="1760" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" font-weight="700" fill="#ffe4f0">iPhone</text>
  <text x="1340" y="1830" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" fill="#c4b0c4">Safari 기준</text>

  <circle cx="1390" cy="1960" r="40" fill="url(#accent)"/>
  <text x="1390" y="1974" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" font-weight="700" fill="#1a1020">1</text>
  <text x="1470" y="1950" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="600" fill="#f4eef6">Safari로 열기</text>
  <text x="1470" y="2005" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#c4b0c4">QR 스캔 후 Safari를 선택</text>

  <circle cx="1390" cy="2170" r="40" fill="url(#accent)"/>
  <text x="1390" y="2184" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" font-weight="700" fill="#1a1020">2</text>
  <text x="1470" y="2160" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="600" fill="#f4eef6">하단 공유 버튼</text>
  <text x="1470" y="2215" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#c4b0c4">□↑ 모양 아이콘을 누름</text>

  <circle cx="1390" cy="2380" r="40" fill="url(#accent)"/>
  <text x="1390" y="2394" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" font-weight="700" fill="#1a1020">3</text>
  <text x="1470" y="2370" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="600" fill="#f4eef6">홈 화면에 추가</text>
  <text x="1470" y="2425" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#c4b0c4">목록을 내려 「홈 화면에 추가」</text>

  <circle cx="1390" cy="2590" r="40" fill="url(#accent)"/>
  <text x="1390" y="2604" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" font-weight="700" fill="#1a1020">4</text>
  <text x="1470" y="2580" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="600" fill="#f4eef6">추가 후 아이콘 실행</text>
  <text x="1470" y="2635" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#c4b0c4">홈 화면에서 바로 로그인</text>

  <text x="1340" y="2800" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#9a8898">※ iPhone은 Chrome이 아니라</text>
  <text x="1340" y="2850" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#9a8898">Safari에서만 홈 화면 추가가 됩니다</text>

  <text x="1240" y="3360" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" fill="#9a8898">${BRAND}</text>
</svg>`,
});

const phoneW = 1080;
const phoneH = 1920;
const phonePath = await makePoster({
  file: "chrome-webapp-poster-phone.png",
  qrSize: 440,
  qrTop: 280,
  qrLeft: 320,
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
  <circle cx="160" cy="180" r="220" fill="#9b6dff" opacity="0.12"/>
  <circle cx="940" cy="1700" r="280" fill="#ff9ec4" opacity="0.12"/>

  <text x="540" y="90" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#c4b0c4" letter-spacing="4">${BRAND}</text>
  <text x="540" y="160" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" font-weight="700" fill="#f4eef6">홈페이지 로그인</text>
  <text x="540" y="215" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="24" fill="#ffb6c9">QR 스캔 → 로그인 화면</text>

  <rect x="300" y="250" width="480" height="480" rx="24" fill="#ffffff"/>
  <text x="540" y="770" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#c4b0c4">${LOGIN_URL}</text>

  <!-- Android -->
  <rect x="40" y="820" width="480" height="980" rx="28" fill="#16121e" stroke="#4a3848" stroke-width="2"/>
  <text x="70" y="890" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#ffe4f0">Android</text>
  <text x="70" y="930" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="18" fill="#c4b0c4">Chrome</text>

  <circle cx="90" cy="1010" r="22" fill="url(#accent)"/>
  <text x="90" y="1017" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="18" font-weight="700" fill="#1a1020">1</text>
  <text x="130" y="1005" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="600" fill="#f4eef6">Chrome으로 열기</text>
  <text x="130" y="1035" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#c4b0c4">QR 후 Chrome 선택</text>

  <circle cx="90" cy="1130" r="22" fill="url(#accent)"/>
  <text x="90" y="1137" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="18" font-weight="700" fill="#1a1020">2</text>
  <text x="130" y="1125" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="600" fill="#f4eef6">우측 상단 ⋮</text>
  <text x="130" y="1155" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#c4b0c4">Chrome 메뉴</text>

  <circle cx="90" cy="1250" r="22" fill="url(#accent)"/>
  <text x="90" y="1257" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="18" font-weight="700" fill="#1a1020">3</text>
  <text x="130" y="1245" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="600" fill="#f4eef6">앱 설치</text>
  <text x="130" y="1275" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#c4b0c4">또는 홈 화면에 추가</text>

  <circle cx="90" cy="1370" r="22" fill="url(#accent)"/>
  <text x="90" y="1377" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="18" font-weight="700" fill="#1a1020">4</text>
  <text x="130" y="1365" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="600" fill="#f4eef6">아이콘으로 실행</text>
  <text x="130" y="1395" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#c4b0c4">앱처럼 바로 접속</text>

  <text x="70" y="1520" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#9a8898">메뉴에 앱 설치가 없으면</text>
  <text x="70" y="1550" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#9a8898">홈 화면에 추가를 선택</text>

  <!-- iPhone -->
  <rect x="560" y="820" width="480" height="980" rx="28" fill="#16121e" stroke="#4a3848" stroke-width="2"/>
  <text x="590" y="890" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" font-weight="700" fill="#ffe4f0">iPhone</text>
  <text x="590" y="930" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="18" fill="#c4b0c4">Safari</text>

  <circle cx="610" cy="1010" r="22" fill="url(#accent)"/>
  <text x="610" y="1017" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="18" font-weight="700" fill="#1a1020">1</text>
  <text x="650" y="1005" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="600" fill="#f4eef6">Safari로 열기</text>
  <text x="650" y="1035" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#c4b0c4">QR 후 Safari 선택</text>

  <circle cx="610" cy="1130" r="22" fill="url(#accent)"/>
  <text x="610" y="1137" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="18" font-weight="700" fill="#1a1020">2</text>
  <text x="650" y="1125" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="600" fill="#f4eef6">하단 공유 버튼</text>
  <text x="650" y="1155" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#c4b0c4">□↑ 아이콘</text>

  <circle cx="610" cy="1250" r="22" fill="url(#accent)"/>
  <text x="610" y="1257" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="18" font-weight="700" fill="#1a1020">3</text>
  <text x="650" y="1245" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="600" fill="#f4eef6">홈 화면에 추가</text>
  <text x="650" y="1275" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#c4b0c4">목록에서 선택</text>

  <circle cx="610" cy="1370" r="22" fill="url(#accent)"/>
  <text x="610" y="1377" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="18" font-weight="700" fill="#1a1020">4</text>
  <text x="650" y="1365" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="600" fill="#f4eef6">아이콘으로 실행</text>
  <text x="650" y="1395" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#c4b0c4">홈 화면에서 접속</text>

  <text x="590" y="1520" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#9a8898">iPhone은 Safari에서만</text>
  <text x="590" y="1550" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="16" fill="#9a8898">홈 화면 추가 가능</text>

  <text x="540" y="1870" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="20" fill="#9a8898">${BRAND}</text>
</svg>`,
});

console.log(`Brand:  ${BRAND}`);
console.log(`Login:  ${LOGIN_URL}`);
console.log(`QR:     ${qrPath}`);
console.log(`Print:  ${printPath}`);
console.log(`Phone:  ${phonePath}`);
