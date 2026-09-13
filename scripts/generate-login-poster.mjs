/**
 * 로그인 QR + 웹앱 설치 포스터 생성 (미드나잇 홀덤)
 * Usage: node scripts/generate-login-poster.mjs
 * Optional: LOGIN_URL=https://... node scripts/generate-login-poster.mjs
 */
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
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
const LOGO_PATH = path.join(OUT, "midnight-flush-logo.png");
const LOGO_SRC =
  process.env.LOGO_SRC?.trim() ||
  path.join(OUT, "midnight-flush-logo-source.jpg");

mkdirSync(OUT, { recursive: true });

// Burgundy brand (from Mid Night Flush logo)
const BURGUNDY = "#6d1018";
const BURGUNDY_SOFT = "#a83a48";
const CREAM = "#f3d6da";

async function prepareLogo() {
  const src = existsSync(LOGO_SRC) ? LOGO_SRC : LOGO_PATH;
  if (!existsSync(src)) throw new Error(`로고 파일을 찾을 수 없습니다: ${src}`);

  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < 235 || g < 235 || b < 235) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 10;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const cropped = await sharp(src)
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const d = cropped.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (r > 230 && g > 230 && b > 230) d[i + 3] = 0;
  }

  await sharp(d, { raw: { width: cropped.info.width, height: cropped.info.height, channels: 4 } })
    .png()
    .toFile(LOGO_PATH);
}

await prepareLogo();

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
  color: { dark: BURGUNDY, light: "#ffffff" },
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
const printLogoW = 780;
const printLogo = await sharp(LOGO_PATH)
  .resize({ width: printLogoW, withoutEnlargement: false })
  .png()
  .toBuffer();
const printLogoMeta = await sharp(printLogo).metadata();
const printLogoH = printLogoMeta.height ?? 280;
const printLogoLeft = Math.round((printW - printLogoW) / 2);
const printLogoTop = 60;
const printPlatePadX = 60;
const printPlatePadY = 36;
const printPlateBottom = printLogoTop + printLogoH + printPlatePadY * 2;
const printTitleY = printPlateBottom + 90;
const printSubY = printTitleY + 70;
const printQrTop = printSubY + 50;
const printQrSize = 620;
const printQrLeft = Math.round((printW - printQrSize) / 2);
const printUrlY = printQrTop + printQrSize + 50;
const printCardsY = printUrlY + 70;
const printH = printCardsY + 1580;

const printPath = await makePoster({
  file: "chrome-webapp-poster.png",
  qrSize: printQrSize,
  qrTop: printQrTop + 30,
  qrLeft: printQrLeft + 30,
  overlays: [{ input: printLogo, top: printLogoTop + printPlatePadY, left: printLogoLeft }],
  svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${printW}" height="${printH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0607"/>
      <stop offset="50%" stop-color="#14090b"/>
      <stop offset="100%" stop-color="#1a0c0e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${BURGUNDY}"/>
      <stop offset="100%" stop-color="${BURGUNDY_SOFT}"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1c1214"/>
      <stop offset="100%" stop-color="#12090b"/>
    </linearGradient>
  </defs>
  <rect width="${printW}" height="${printH}" fill="url(#bg)"/>
  <circle cx="360" cy="280" r="420" fill="${BURGUNDY}" opacity="0.16"/>
  <circle cx="2140" cy="2700" r="500" fill="${BURGUNDY_SOFT}" opacity="0.12"/>

  <rect x="${printLogoLeft - printPlatePadX}" y="${printLogoTop}" width="${printLogoW + printPlatePadX * 2}" height="${printLogoH + printPlatePadY * 2}" rx="36" fill="#ffffff"/>
  <rect x="${printLogoLeft - printPlatePadX}" y="${printLogoTop}" width="${printLogoW + printPlatePadX * 2}" height="${printLogoH + printPlatePadY * 2}" rx="36" fill="none" stroke="${BURGUNDY}" stroke-width="4"/>

  <text x="1240" y="${printTitleY}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="92" font-weight="700" fill="#f8ecee">홈페이지 로그인</text>
  <text x="1240" y="${printSubY}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" fill="${CREAM}">QR을 스캔하세요</text>

  <rect x="${printQrLeft}" y="${printQrTop}" width="${printQrSize}" height="${printQrSize}" rx="34" fill="#ffffff"/>
  <rect x="${printQrLeft}" y="${printQrTop}" width="${printQrSize}" height="${printQrSize}" rx="34" fill="none" stroke="url(#accent)" stroke-width="8"/>
  <text x="1240" y="${printUrlY}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="30" fill="#c9a8ad">${LOGIN_URL}</text>

  <rect x="90" y="${printCardsY}" width="1110" height="1400" rx="44" fill="url(#card)" stroke="#4a3034" stroke-width="4"/>
  <text x="180" y="${printCardsY + 140}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="76" font-weight="700" fill="${CREAM}">Android</text>
  <text x="180" y="${printCardsY + 215}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" fill="#c9a8ad">Chrome 기준</text>

  <circle cx="250" cy="${printCardsY + 400}" r="56" fill="url(#accent)"/>
  <text x="250" y="${printCardsY + 420}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#fff8f8">1</text>
  <text x="360" y="${printCardsY + 375}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f8ecee">Chrome으로 열기</text>
  <text x="360" y="${printCardsY + 460}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c9a8ad">QR 스캔 후 Chrome 선택</text>

  <circle cx="250" cy="${printCardsY + 690}" r="56" fill="url(#accent)"/>
  <text x="250" y="${printCardsY + 710}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#fff8f8">2</text>
  <text x="360" y="${printCardsY + 665}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f8ecee">오른쪽 위 ⋮ 메뉴</text>
  <text x="360" y="${printCardsY + 750}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c9a8ad">점 3개 버튼을 누름</text>

  <circle cx="250" cy="${printCardsY + 980}" r="56" fill="url(#accent)"/>
  <text x="250" y="${printCardsY + 1000}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#fff8f8">3</text>
  <text x="360" y="${printCardsY + 955}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f8ecee">앱 설치</text>
  <text x="360" y="${printCardsY + 1040}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c9a8ad">또는 「홈 화면에 추가」</text>

  <circle cx="250" cy="${printCardsY + 1270}" r="56" fill="url(#accent)"/>
  <text x="250" y="${printCardsY + 1290}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#fff8f8">4</text>
  <text x="360" y="${printCardsY + 1245}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f8ecee">아이콘으로 실행</text>
  <text x="360" y="${printCardsY + 1330}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c9a8ad">홈 화면에서 바로 접속</text>

  <rect x="1280" y="${printCardsY}" width="1110" height="1400" rx="44" fill="url(#card)" stroke="#4a3034" stroke-width="4"/>
  <text x="1370" y="${printCardsY + 140}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="76" font-weight="700" fill="${CREAM}">iPhone</text>
  <text x="1370" y="${printCardsY + 215}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" fill="#c9a8ad">Safari 기준</text>

  <circle cx="1450" cy="${printCardsY + 400}" r="56" fill="url(#accent)"/>
  <text x="1450" y="${printCardsY + 420}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#fff8f8">1</text>
  <text x="1560" y="${printCardsY + 375}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f8ecee">Safari로 열기</text>
  <text x="1560" y="${printCardsY + 460}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c9a8ad">QR 스캔 후 Safari 선택</text>

  <circle cx="1450" cy="${printCardsY + 690}" r="56" fill="url(#accent)"/>
  <text x="1450" y="${printCardsY + 710}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#fff8f8">2</text>
  <text x="1560" y="${printCardsY + 665}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="54" font-weight="700" fill="#f8ecee">공유 아이콘 누르기</text>
  <g transform="translate(2140 ${printCardsY + 628})" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M32 6 L32 42"/>
    <path d="M16 22 L32 6 L48 22"/>
    <path d="M12 36 L12 62 Q12 68 18 68 L46 68 Q52 68 52 62 L52 36"/>
  </g>
  <text x="1560" y="${printCardsY + 750}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c9a8ad">주소창 오른쪽 공유 버튼</text>

  <circle cx="1450" cy="${printCardsY + 980}" r="56" fill="url(#accent)"/>
  <text x="1450" y="${printCardsY + 1000}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#fff8f8">3</text>
  <text x="1560" y="${printCardsY + 955}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f8ecee">더보기</text>
  <text x="1560" y="${printCardsY + 1040}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c9a8ad">목록에서 「더보기」 선택</text>

  <circle cx="1450" cy="${printCardsY + 1270}" r="56" fill="url(#accent)"/>
  <text x="1450" y="${printCardsY + 1290}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#fff8f8">4</text>
  <text x="1560" y="${printCardsY + 1245}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="56" font-weight="700" fill="#f8ecee">홈 화면에 추가</text>
  <text x="1560" y="${printCardsY + 1330}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="48" fill="#c9a8ad">추가 후 아이콘으로 실행</text>

  <text x="1240" y="${printCardsY + 1520}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="40" fill="#9a7076">${BRAND}</text>
</svg>`,
});

const phoneW = 1080;
const phoneH = 1920;
const phoneLogoW = 380;
const phoneLogo = await sharp(LOGO_PATH).resize({ width: phoneLogoW }).png().toBuffer();
const phoneLogoMeta = await sharp(phoneLogo).metadata();
const phoneLogoH = phoneLogoMeta.height ?? 140;
const phoneLogoLeft = Math.round((phoneW - phoneLogoW) / 2);
const phoneLogoTop = 28;
const phonePadX = 24;
const phonePadY = 16;
const phonePlateBottom = phoneLogoTop + phoneLogoH + phonePadY * 2;
const phoneTitleY = phonePlateBottom + 50;
const phoneSubY = phoneTitleY + 40;
const phoneQrTop = phoneSubY + 30;
const phoneQrSize = 280;
const phoneQrLeft = Math.round((phoneW - phoneQrSize) / 2);
const phoneUrlY = phoneQrTop + phoneQrSize + 35;
const phoneCardsY = phoneUrlY + 45;

const phonePath = await makePoster({
  file: "chrome-webapp-poster-phone.png",
  qrSize: phoneQrSize - 20,
  qrTop: phoneQrTop + 10,
  qrLeft: phoneQrLeft + 10,
  overlays: [{ input: phoneLogo, top: phoneLogoTop + phonePadY, left: phoneLogoLeft }],
  svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${phoneW}" height="${phoneH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0607"/>
      <stop offset="100%" stop-color="#1a0c0e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${BURGUNDY}"/>
      <stop offset="100%" stop-color="${BURGUNDY_SOFT}"/>
    </linearGradient>
  </defs>
  <rect width="${phoneW}" height="${phoneH}" fill="url(#bg)"/>
  <circle cx="140" cy="160" r="180" fill="${BURGUNDY}" opacity="0.16"/>
  <circle cx="960" cy="1700" r="220" fill="${BURGUNDY_SOFT}" opacity="0.12"/>

  <rect x="${phoneLogoLeft - phonePadX}" y="${phoneLogoTop}" width="${phoneLogoW + phonePadX * 2}" height="${phoneLogoH + phonePadY * 2}" rx="18" fill="#ffffff"/>
  <rect x="${phoneLogoLeft - phonePadX}" y="${phoneLogoTop}" width="${phoneLogoW + phonePadX * 2}" height="${phoneLogoH + phonePadY * 2}" rx="18" fill="none" stroke="${BURGUNDY}" stroke-width="2"/>

  <text x="540" y="${phoneTitleY}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="42" font-weight="700" fill="#f8ecee">홈페이지 로그인</text>
  <text x="540" y="${phoneSubY}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="${CREAM}">QR 스캔 → 로그인</text>

  <rect x="${phoneQrLeft}" y="${phoneQrTop}" width="${phoneQrSize}" height="${phoneQrSize}" rx="16" fill="#ffffff"/>
  <text x="540" y="${phoneUrlY}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="14" fill="#c9a8ad">${LOGIN_URL}</text>

  <rect x="28" y="${phoneCardsY}" width="500" height="1020" rx="24" fill="#161012" stroke="#4a3034" stroke-width="2"/>
  <text x="62" y="${phoneCardsY + 85}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="40" font-weight="700" fill="${CREAM}">Android</text>
  <text x="62" y="${phoneCardsY + 130}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c9a8ad">Chrome</text>

  <circle cx="98" cy="${phoneCardsY + 240}" r="30" fill="url(#accent)"/>
  <text x="98" y="${phoneCardsY + 251}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#fff8f8">1</text>
  <text x="155" y="${phoneCardsY + 230}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f8ecee">Chrome으로 열기</text>
  <text x="155" y="${phoneCardsY + 275}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c9a8ad">QR 후 Chrome 선택</text>

  <circle cx="98" cy="${phoneCardsY + 395}" r="30" fill="url(#accent)"/>
  <text x="98" y="${phoneCardsY + 406}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#fff8f8">2</text>
  <text x="155" y="${phoneCardsY + 385}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f8ecee">우측 상단 ⋮</text>
  <text x="155" y="${phoneCardsY + 430}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c9a8ad">Chrome 메뉴</text>

  <circle cx="98" cy="${phoneCardsY + 550}" r="30" fill="url(#accent)"/>
  <text x="98" y="${phoneCardsY + 561}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#fff8f8">3</text>
  <text x="155" y="${phoneCardsY + 540}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f8ecee">앱 설치</text>
  <text x="155" y="${phoneCardsY + 585}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c9a8ad">또는 홈 화면에 추가</text>

  <circle cx="98" cy="${phoneCardsY + 705}" r="30" fill="url(#accent)"/>
  <text x="98" y="${phoneCardsY + 716}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#fff8f8">4</text>
  <text x="155" y="${phoneCardsY + 695}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f8ecee">아이콘으로 실행</text>
  <text x="155" y="${phoneCardsY + 740}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c9a8ad">앱처럼 바로 접속</text>

  <rect x="552" y="${phoneCardsY}" width="500" height="1020" rx="24" fill="#161012" stroke="#4a3034" stroke-width="2"/>
  <text x="586" y="${phoneCardsY + 85}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="40" font-weight="700" fill="${CREAM}">iPhone</text>
  <text x="586" y="${phoneCardsY + 130}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c9a8ad">Safari</text>

  <circle cx="622" cy="${phoneCardsY + 240}" r="30" fill="url(#accent)"/>
  <text x="622" y="${phoneCardsY + 251}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#fff8f8">1</text>
  <text x="679" y="${phoneCardsY + 230}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f8ecee">Safari로 열기</text>
  <text x="679" y="${phoneCardsY + 275}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c9a8ad">QR 후 Safari 선택</text>

  <circle cx="622" cy="${phoneCardsY + 395}" r="30" fill="url(#accent)"/>
  <text x="622" y="${phoneCardsY + 406}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#fff8f8">2</text>
  <text x="679" y="${phoneCardsY + 385}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="26" font-weight="700" fill="#f8ecee">공유 아이콘</text>
  <g transform="translate(900 ${phoneCardsY + 353})" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 3 L18 24"/>
    <path d="M9 12 L18 3 L27 12"/>
    <path d="M6 20 L6 34 Q6 38 10 38 L26 38 Q30 38 30 34 L30 20"/>
  </g>
  <text x="679" y="${phoneCardsY + 430}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c9a8ad">주소창 공유 버튼</text>

  <circle cx="622" cy="${phoneCardsY + 550}" r="30" fill="url(#accent)"/>
  <text x="622" y="${phoneCardsY + 561}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#fff8f8">3</text>
  <text x="679" y="${phoneCardsY + 540}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f8ecee">더보기</text>
  <text x="679" y="${phoneCardsY + 585}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c9a8ad">목록에서 더보기</text>

  <circle cx="622" cy="${phoneCardsY + 705}" r="30" fill="url(#accent)"/>
  <text x="622" y="${phoneCardsY + 716}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" font-weight="700" fill="#fff8f8">4</text>
  <text x="679" y="${phoneCardsY + 695}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="28" font-weight="700" fill="#f8ecee">홈 화면에 추가</text>
  <text x="679" y="${phoneCardsY + 740}" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#c9a8ad">아이콘으로 실행</text>

  <text x="540" y="${phoneCardsY + 1080}" text-anchor="middle" font-family="Apple SD Gothic Neo, AppleGothic, sans-serif" font-size="22" fill="#9a7076">${BRAND}</text>
</svg>`,
});

console.log(`Brand:  ${BRAND}`);
console.log(`Login:  ${LOGIN_URL}`);
console.log(`Logo:   ${LOGO_PATH}`);
console.log(`QR:     ${qrPath}`);
console.log(`Print:  ${printPath}`);
console.log(`Phone:  ${phonePath}`);
