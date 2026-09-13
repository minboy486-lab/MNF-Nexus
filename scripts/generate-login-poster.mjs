/**
 * 로그인 QR + 크롬 웹앱 설치 포스터 생성
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

const logoPath = path.join(ROOT, "public/logo/mnf-logo-square.png");

async function makePoster({
  file,
  W,
  H,
  logoSize,
  logoTop,
  logoLeft,
  qrSize,
  qrTop,
  qrLeft,
  svg,
}) {
  const logo = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const qr = await sharp(qrPng).resize(qrSize, qrSize).png().toBuffer();
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  const out = path.join(OUT, file);
  await sharp(base)
    .composite([
      { input: logo, top: logoTop, left: logoLeft },
      { input: qr, top: qrTop, left: qrLeft },
    ])
    .png()
    .toFile(out);
  return out;
}

const printW = 2480;
const printH = 3508;
const printPath = await makePoster({
  file: "chrome-webapp-poster.png",
  W: printW,
  H: printH,
  logoSize: 420,
  logoTop: 280,
  logoLeft: printW - 180 - 420,
  qrSize: 980,
  qrTop: 670,
  qrLeft: 750,
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
  <circle cx="420" cy="380" r="520" fill="#9b6dff" opacity="0.10"/>
  <circle cx="2100" cy="3000" r="640" fill="#ff9ec4" opacity="0.10"/>
  <rect x="180" y="140" width="220" height="8" rx="4" fill="url(#accent)"/>
  <text x="180" y="220" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" fill="#c4b0c4" letter-spacing="8">MNF HOLDEM</text>
  <text x="180" y="360" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="96" font-weight="700" fill="#f4eef6">홈페이지 로그인</text>
  <text x="180" y="460" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="52" fill="#ffb6c9">QR을 스캔하세요</text>
  <text x="180" y="540" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" fill="#c4b0c4">휴대폰 카메라로 찍으면 로그인 화면으로 이동합니다</text>
  <rect x="720" y="640" width="1040" height="1040" rx="48" fill="#ffffff"/>
  <rect x="720" y="640" width="1040" height="1040" rx="48" fill="none" stroke="url(#accent)" stroke-width="6"/>
  <text x="1240" y="1760" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="34" fill="#c4b0c4">${LOGIN_URL}</text>
  <rect x="180" y="1880" width="2120" height="1320" rx="56" fill="url(#card)" stroke="#4a3848" stroke-width="3"/>
  <text x="280" y="2020" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#ffe4f0">크롬으로 웹앱 설치하기</text>
  <text x="280" y="2100" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="34" fill="#c4b0c4">한 번 설치하면 앱처럼 홈 화면에서 바로 실행됩니다</text>
  <circle cx="340" cy="2240" r="44" fill="url(#accent)"/>
  <text x="340" y="2254" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="700" fill="#1a1020">1</text>
  <text x="430" y="2230" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="600" fill="#f4eef6">Chrome으로 열기</text>
  <text x="430" y="2290" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" fill="#c4b0c4">위 QR을 스캔한 뒤, 브라우저에서 Chrome을 선택합니다</text>
  <circle cx="340" cy="2480" r="44" fill="url(#accent)"/>
  <text x="340" y="2494" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="700" fill="#1a1020">2</text>
  <text x="430" y="2470" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="600" fill="#f4eef6">오른쪽 위 ⋮ 메뉴</text>
  <text x="430" y="2530" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" fill="#c4b0c4">로그인 화면이 보이면 Chrome 우측 상단 점 3개 버튼을 누릅니다</text>
  <circle cx="340" cy="2720" r="44" fill="url(#accent)"/>
  <text x="340" y="2734" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="700" fill="#1a1020">3</text>
  <text x="430" y="2710" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="600" fill="#f4eef6">「앱 설치」 또는 「홈 화면에 추가」</text>
  <text x="430" y="2770" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" fill="#c4b0c4">설치를 누르면 홈 화면에 MNF HOLDEM 아이콘이 생깁니다</text>
  <circle cx="340" cy="2960" r="44" fill="url(#accent)"/>
  <text x="340" y="2974" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" font-weight="700" fill="#1a1020">4</text>
  <text x="430" y="2950" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="600" fill="#f4eef6">아이콘으로 바로 접속</text>
  <text x="430" y="3010" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="32" fill="#c4b0c4">다음부터는 브라우저 주소 없이 앱처럼 바로 로그인할 수 있습니다</text>
  <text x="1240" y="3360" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="36" fill="#9a8898">프리미엄 홀덤펍 · MNF HOLDEM</text>
</svg>`,
});

const phoneW = 1080;
const phoneH = 1920;
const phonePath = await makePoster({
  file: "chrome-webapp-poster-phone.png",
  W: phoneW,
  H: phoneH,
  logoSize: 280,
  logoTop: 70,
  logoLeft: 760,
  qrSize: 520,
  qrTop: 330,
  qrLeft: 280,
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
  <circle cx="180" cy="220" r="260" fill="#9b6dff" opacity="0.12"/>
  <circle cx="920" cy="1680" r="300" fill="#ff9ec4" opacity="0.12"/>
  <text x="64" y="100" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c4b0c4" letter-spacing="4">MNF HOLDEM</text>
  <text x="64" y="180" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="54" font-weight="700" fill="#f4eef6">홈페이지 로그인</text>
  <text x="64" y="240" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" fill="#ffb6c9">QR 스캔 → 로그인 화면</text>
  <rect x="250" y="300" width="580" height="580" rx="28" fill="#ffffff"/>
  <text x="540" y="930" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="18" fill="#c4b0c4">${LOGIN_URL}</text>
  <rect x="48" y="980" width="984" height="820" rx="32" fill="#16121e" stroke="#4a3848" stroke-width="2"/>
  <text x="88" y="1060" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="34" font-weight="700" fill="#ffe4f0">크롬으로 웹앱 설치</text>
  <text x="88" y="1115" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c4b0c4">Android Chrome 기준</text>
  <circle cx="120" cy="1210" r="28" fill="url(#accent)"/>
  <text x="120" y="1218" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">1</text>
  <text x="170" y="1205" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="600" fill="#f4eef6">Chrome으로 열기</text>
  <text x="170" y="1240" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="20" fill="#c4b0c4">QR 스캔 후 Chrome 선택</text>
  <circle cx="120" cy="1360" r="28" fill="url(#accent)"/>
  <text x="120" y="1368" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">2</text>
  <text x="170" y="1355" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="600" fill="#f4eef6">우측 상단 ⋮</text>
  <text x="170" y="1390" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="20" fill="#c4b0c4">Chrome 메뉴 버튼</text>
  <circle cx="120" cy="1510" r="28" fill="url(#accent)"/>
  <text x="120" y="1518" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">3</text>
  <text x="170" y="1505" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="600" fill="#f4eef6">앱 설치 / 홈 화면에 추가</text>
  <text x="170" y="1540" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="20" fill="#c4b0c4">홈 화면에 아이콘 생성</text>
  <circle cx="120" cy="1660" r="28" fill="url(#accent)"/>
  <text x="120" y="1668" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#1a1020">4</text>
  <text x="170" y="1655" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="600" fill="#f4eef6">아이콘으로 바로 접속</text>
  <text x="170" y="1690" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="20" fill="#c4b0c4">다음부터 앱처럼 실행</text>
  <text x="540" y="1860" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="20" fill="#9a8898">MNF HOLDEM</text>
</svg>`,
});

console.log(`Login URL: ${LOGIN_URL}`);
console.log(`QR:     ${qrPath}`);
console.log(`Print:  ${printPath}`);
console.log(`Phone:  ${phonePath}`);
