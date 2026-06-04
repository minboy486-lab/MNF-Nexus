/**
 * Generates supabase/seed_members.sql from nickname list.
 * Run: node scripts/generate-members-seed.mjs
 */
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const scryptAsync = promisify(scrypt);
const VENUE_ID = "00000000-0000-4000-8000-000000000001";
const PASSWORD = "123456";

const NICKNAMES_RAW = `
영희, 호열, 서초육, 지인4, 바비, 사쿠라, 도성, 대박, 에스, 콜라, 요거, 제이슨, 비트코인, 짜이, 지인1, W, 웨이홍, 에릭, 거북이, 봄비, 멍, 일일공, 아쎄이, 곤, 유준이, 쪽박, 진진, 맥스, T, 용이, 윤자, 고양이, 화랭이, 주주, 상이, 눈물, 317, 서초동, 담홍, 아이스커피, 메가, 꽃동, 데이빗, 갱모, 나루토, 하마, 밥밥, H님, 용, 쫀득이, 훈닝, 선우, 아무개, 아리몬, 감고, 영란, 도사, 빙빙, J, 천마, 이응, 고놈, BBB, 꽃사슴, 보리굴비, 지인3, 큐, 김진용, 키키, 크리스, TR, 진, 노루, 낑깡, 괴물, 스캇, 낙타, 젤리, 제이투, 지니, 대근, 최형, 아리몬2, HARDY, 안철, 지인2, 아린, 더블비, 애드가, M, 홈우드, KK, 짱구, 리차드, 사, 피쉬, 레전드, 대추, 털보, 곤, RS, 은식이, 갱, 용이, 윤자, 홍구, 족구, 건배, 트루, SS, 아니, 호구, 깨눈, 겸이, 엠, MM, 서남, 블루, 가은, 쭌, 퍼플, 톰, 제리, 정팔, 준오, 데이비드박, MJ, 지성, 스티, 여우, 훈3, 태희, 새로, 네이마르, 선우털이범, 은평구, 지우, MJ, 돌턴, 김성배, 훈지, 화이트, 호이, 호두마루, 호두, 현식, 혁, 행만, 해달, 한수, 하사, 하나, 풀문, 푸, 편경장, 톰, 토토, 태리, 탄, 킹스, 키키, 크잡, 크여, 크리스, 쿨탐, 콩, 코디악, 켈빈, 켈리, 켄, 케이비, 케빈투, 케빈, 칼, 칩죠, 츄러스, 춘자, 쵬, 초코아빠, 초코1, 초코, 초보, 철우, 철수2, 철수, 철, 창혁, 참치, 찰스, 찰리, 찡찡이, 쫀득이, 쪽박, 진가, 지인3, 지인2, 지석, 지니, 쥬핀, 준환, 준혁, 준준, 준수, 준서, 준님, 주성재, 주방장, 주노, 주, 조혜련, 조잡, 조단, 젤리, 젠틀맨, 제제, 제임스, 제인, 제이콥, 제이지, 제이제이, 제이엠, 제이쓰리, 제시카, 제리, 정재, 정랑, 정대표, 잼, 잭텐, 재호, 재형, 장군, 이수근, 이글, 이, 을석, 은호, 은식이2, 은식이, 윤, 유신투, 위너, 원준, 원이, 원스타, 원도, 웅이, 웅, 우찬, 우리1, 우리, 우기, 용투, 용비, 용, 요거, 와이, 올인, 오뚜기, 옐로우, 예지, 영이, 영웅, 영맨, 영란, 영, 연지, 역삼동, 엔젤, 에이오, 에이쓰, 에이스, 엄교수, 어리, 양주, 약지, 야미, 앤디, 애리, 알짜, 알렉스, 안철, 안다, 아이언, 아이사, 아쎄, 아몬드, 아리, 아루이, 아끼다, 아기고양이, 쏭가, 쏘뱅, 쏘니, 썸, 썰틴, 써틴, 싹다, 싱싱, 시호, 시옷, 시미켄, 시나, 승훈, 승호, 승우, 승, 스티플, 스카, 스누피, 숲, 수철, 수영, 수, 쇼다운, 손잡, 손님, 손, 셀린느, 세리, 섭, 설현, 선일, 선릉, 석석, 석군, 서초동오빠, 서서부, 샘, 새신랑, 상의, 상식, 상수, 삼육, 산체스, 산, 사탕, 사오, 사과, 사, 뽀숑, 빠따, 빠꾸, 빅스비, 비비, 블루, 블러핑, 브라이언2, 브라이언, 부엉이, 봉구, 봄비투, 복권, 보스, 보라돌이, 보니, 보고, 병석, 별하, 벨, 베타, 베베, 범고래, 버즈, 뱅커, 밸라, 배추, 방방, 박준혁, 바위, 바구니, 민영, 민성여친, 민성, 민서아빠, 민, 미스터박, 뭉치, 뭉제, 문곰, 문, 무사, 몽키, 몽구, 메버릭, 멍이, 머니, 맨발, 망고, 말자, 말대가리, 마스, 마린, 마귀, 마군, 림, 리플, 리콘, 리오, 리수, 로티, 로로로, 레오강, 레오1, 레드, 레기온, 러스, 랩, 라이언2, 라이언, 라이거, 라온, 라스, 라면, 또또, 따귀, 둘, 두둥, 동탄, 동네주민2, 동건, 덕구, 더덕, 댕찬, 대포, 대추, 다은, 뇽뇽, 뇽, 녹차, 노루, 납득이, 나몰라, 낑깡, 꼬지, 꼬마, 깨박, 김치, 김진짜, 김진용, 김씨씨, 김부장, 김기범, 길버트, 금자씨, 금손, 귤, 균3, 광렬, 곰, 곤, 고래, 건배, 강호태, 간지, 가은, TJ, SY, ppp, NH, MOON, MNH, MH, KS, KM, KH, KB, JS, JH, HK, HI, GRM, DS, DH, B, A, 2, 휴도, 희동
`.trim();

const CHO_KEYS = ["r", "R", "s", "e", "E", "f", "a", "q", "Q", "t", "T", "d", "w", "W", "c", "z", "x", "v", "g"];
const JUNG_KEYS = [
  "k", "o", "i", "O", "j", "p", "u", "P", "h", "hk", "ho", "hl", "y", "n", "nj", "np", "nl", "b", "m", "ml", "l",
];
const JONG_KEYS = [
  "", "r", "R", "rt", "s", "sw", "sg", "e", "f", "fr", "fa", "fq", "ft", "fx", "fv", "fg", "a", "q", "qt", "t", "T", "d", "w", "c", "z", "x", "v", "g",
];

function hangulToQwerty(char) {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const index = code - 0xac00;
  const cho = Math.floor(index / (21 * 28));
  const jung = Math.floor((index % (21 * 28)) / 28);
  const jong = index % 28;
  return CHO_KEYS[cho] + JUNG_KEYS[jung] + JONG_KEYS[jong];
}

function hasHangul(str) {
  return /[\u3131-\u318e\uac00-\ud7a3]/.test(str);
}

function nicknameToLoginId(nickname) {
  let out = "";
  for (const ch of nickname) {
    const q = hangulToQwerty(ch);
    if (q !== null) out += q;
    else if (/[a-zA-Z0-9]/.test(ch)) out += ch.toLowerCase();
    else if (ch === " ") out += "";
    else out += "";
  }
  out = out.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!out) out = "user";
  if (out.length < 3) out = (out + "00").slice(0, 3);
  return out.slice(0, 40);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

async function main() {
  const raw = NICKNAMES_RAW.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  const seenNick = new Set();
  const seenLogin = new Map();
  const rows = [];

  for (const nickname of raw) {
    if (seenNick.has(nickname)) continue;
    seenNick.add(nickname);

    let loginId = nicknameToLoginId(nickname);
    if (seenLogin.has(loginId)) {
      let n = 2;
      while (seenLogin.has(`${loginId}${n}`)) n++;
      loginId = `${loginId}${n}`.slice(0, 40);
    }
    seenLogin.set(loginId, nickname);

    const password_hash = await hashPassword(PASSWORD);
    rows.push({ nickname, loginId, password_hash });
  }

  const lines = [
    "-- 손님 닉네임 시드 (PW: 123456). Run after 006_members_auth.sql",
    `-- ${rows.length} members`,
    "",
    "insert into public.members (venue_id, nickname, login_id, password_hash, floor_status)",
    "values",
  ];

  const valueLines = rows.map((r, i) => {
    const comma = i < rows.length - 1 ? "," : "";
    return `  ('${VENUE_ID}', '${sqlEscape(r.nickname)}', '${sqlEscape(r.loginId)}', '${r.password_hash}', 'registered')${comma}`;
  });

  lines.push(...valueLines);
  lines.push("on conflict (venue_id, nickname) do nothing;");
  lines.push("");

  const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "seed_members.sql");
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${rows.length} members to ${outPath}`);

  // spot check
  const checks = ["영희", "말대가리", "W", "317", "H님"];
  for (const c of checks) {
    const row = rows.find((r) => r.nickname === c);
    if (row) console.log(`  ${c} -> ${row.loginId}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
