/**
 * MNF 승점·출석 엑셀 템플릿 생성
 * 사용: node scripts/generate-scores-xlsx.mjs
 */
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../docs/mnf-scores-template.xlsx");

const S_INPUT = "'게임기록'";
const S_RAW = "'기록'";
const S_RANK = "'승점순위'";

const HEADER_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF3D2F3A" },
};
const HEADER_FONT = { bold: true, color: { argb: "FFF5C4D8" }, size: 10 };
const TITLE_FONT = { bold: true, color: { argb: "FFF5C4D8" }, size: 11 };
const BORDER_THIN = {
  top: { style: "thin", color: { argb: "FF555555" } },
  left: { style: "thin", color: { argb: "FF555555" } },
  bottom: { style: "thin", color: { argb: "FF555555" } },
  right: { style: "thin", color: { argb: "FF555555" } },
};

const GAMES = [
  { gameNo: 1, nick: "B", buy: "C", rebuy: "D", money: "E", start: 5 },
  { gameNo: 2, nick: "H", buy: "I", rebuy: "J", money: "K", start: 5 },
  { gameNo: 3, nick: "N", buy: "O", rebuy: "P", money: "Q", start: 5 },
  { gameNo: 4, nick: "B", buy: "C", rebuy: "D", money: "E", start: 28 },
  { gameNo: 5, nick: "H", buy: "I", rebuy: "J", money: "K", start: 28 },
  { gameNo: 6, nick: "N", buy: "O", rebuy: "P", money: "Q", start: 28 },
  { gameNo: 7, nick: "B", buy: "C", rebuy: "D", money: "E", start: 51 },
  { gameNo: 8, nick: "H", buy: "I", rebuy: "J", money: "K", start: 51 },
  { gameNo: 9, nick: "N", buy: "O", rebuy: "P", money: "Q", start: 51 },
];

const ROWS_PER_GAME = 20;
const TOTAL_RECORD_ROWS = GAMES.length * ROWS_PER_GAME;
const MAX_LIST = 200;
const LIST_END = 4 + MAX_LIST;

const rawNick = `${S_RAW}!$C$2:$C$${TOTAL_RECORD_ROWS + 1}`;
const rawDate = `${S_RAW}!$A$2:$A$${TOTAL_RECORD_ROWS + 1}`;
/** Excel formula empty string literal */
const E = '""';

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
}

function nickListFormula(n) {
  return `IFERROR(INDEX(_xlfn.UNIQUE(_xlfn.FILTER(${rawNick},(${rawNick}<>${E})*(${rawDate}>=$B$1)*(${rawDate}<=$B$2))),${n}),${E})`;
}

function setupGameBlock(ws, titleRow, headerRow, gameCols) {
  for (const { gameNo, num, nick, buy, rebuy, money } of gameCols) {
    ws.getCell(`${num}${titleRow}`).value = `${gameNo}게임`;
    ws.getCell(`${num}${titleRow}`).font = TITLE_FONT;
    for (const [col, label] of [
      [num, "#"],
      [nick, "닉네임"],
      [buy, "바이인"],
      [rebuy, "리바인"],
      [money, "머니인"],
    ]) {
      ws.getCell(`${col}${headerRow}`).value = label;
    }
  }
  styleHeaderRow(ws.getRow(headerRow));
  const dataStart = headerRow + 1;
  const dataEnd = headerRow + ROWS_PER_GAME;
  for (const { num } of gameCols) {
    for (let r = dataStart; r <= dataEnd; r++) {
      ws.getCell(`${num}${r}`).value = r - dataStart + 1;
      ws.getCell(`${num}${r}`).alignment = { horizontal: "center" };
      ws.getCell(`${num}${r}`).font = { size: 9, color: { argb: "FF999999" } };
    }
  }
}

function fillRecordRows(raw) {
  for (let i = 0; i < TOTAL_RECORD_ROWS; i++) {
    const game = GAMES[Math.floor(i / ROWS_PER_GAME)];
    const line = game.start + (i % ROWS_PER_GAME);
    const r = i + 2;
    const nick = `${S_INPUT}!$${game.nick}$${line}`;
    const buy = `${S_INPUT}!$${game.buy}$${line}`;
    const rebuy = `${S_INPUT}!$${game.rebuy}$${line}`;
    const money = `${S_INPUT}!$${game.money}$${line}`;
    const pts = `${buy}+${rebuy}+${money}`;
    const ok = `AND(${nick}<>${E},${pts}>0)`;

    raw.getCell(r, 1).value = { formula: `IF(${ok},${S_INPUT}!$B$1,${E})` };
    raw.getCell(r, 2).value = { formula: `IF($A${r}=${E},${E},${game.gameNo})` };
    raw.getCell(r, 3).value = { formula: `IF($A${r}=${E},${E},${nick})` };
    raw.getCell(r, 4).value = { formula: `IF($A${r}=${E},${E},${buy})` };
    raw.getCell(r, 5).value = { formula: `IF($A${r}=${E},${E},${rebuy})` };
    raw.getCell(r, 6).value = { formula: `IF($A${r}=${E},${E},${money})` };
    raw.getCell(r, 7).value = { formula: `IF($A${r}=${E},${E},${pts})` };
  }
}

function hideHelperColumns(ws) {
  for (let c = 8; c <= 17; c++) ws.getColumn(c).hidden = true;
}

function applySortDisplay(ws, startRow, sortFormulaAtN) {
  ws.getCell(`N${startRow}`).value = { formula: sortFormulaAtN };
  for (let i = 0; i < MAX_LIST; i++) {
    const r = startRow + i;
    const n = i + 1;
    for (let c = 0; c < 4; c++) {
      ws.getCell(r, c + 1).value = {
        formula: `IFERROR(INDEX($N$${startRow}:$Q$${LIST_END},${n},${c + 1}),${E})`,
      };
    }
  }
  hideHelperColumns(ws);
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MNF HOLDEM";
  wb.created = new Date();

  const input = wb.addWorksheet("게임기록", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  for (const [col, w] of [
    ["A", 3], ["B", 11], ["C", 7], ["D", 7], ["E", 7], ["F", 2],
    ["G", 3], ["H", 11], ["I", 7], ["J", 7], ["K", 7], ["L", 2],
    ["M", 3], ["N", 11], ["O", 7], ["P", 7], ["Q", 7],
  ]) {
    input.getColumn(col).width = w;
  }

  input.getCell("A1").value = "날짜";
  input.getCell("A1").font = { bold: true };
  input.getCell("B1").value = { formula: "TODAY()" };
  input.getCell("B1").numFmt = "yyyy-mm-dd";
  input.mergeCells("A2:Q2");
  input.getCell("A2").value =
    "닉네임+점수 입력 → 기록 자동 반영 → 승점순위·출석 확인 (Excel 365)";
  input.getCell("A2").font = { size: 9, color: { argb: "FFAAAAAA" } };

  const block = [
    { gameNo: 1, num: "A", nick: "B", buy: "C", rebuy: "D", money: "E" },
    { gameNo: 2, num: "G", nick: "H", buy: "I", rebuy: "J", money: "K" },
    { gameNo: 3, num: "M", nick: "N", buy: "O", rebuy: "P", money: "Q" },
  ];
  setupGameBlock(input, 3, 4, block);
  setupGameBlock(input, 26, 27, block.map((g, i) => ({ ...g, gameNo: i + 4 })));
  setupGameBlock(input, 49, 50, block.map((g, i) => ({ ...g, gameNo: i + 7 })));

  const raw = wb.addWorksheet("기록");
  raw.views = [{ state: "frozen", ySplit: 1 }];
  ["날짜", "게임", "닉네임", "바이인", "리바인", "머니인", "합계"].forEach((h, i) => {
    const cell = raw.getCell(1, i + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = BORDER_THIN;
  });
  raw.getColumn(1).width = 12;
  raw.getColumn(2).width = 6;
  raw.getColumn(3).width = 14;
  [4, 5, 6, 7].forEach((c) => { raw.getColumn(c).width = 8; });
  fillRecordRows(raw);

  const rank = wb.addWorksheet("승점순위");
  rank.views = [{ state: "frozen", ySplit: 4 }];
  rank.getCell("A1").value = "기간 시작";
  rank.getCell("A1").font = { bold: true };
  rank.getCell("B1").value = { formula: "DATE(YEAR(TODAY()),MONTH(TODAY()),1)" };
  rank.getCell("B1").numFmt = "yyyy-mm-dd";
  rank.getCell("A2").value = "기간 종료";
  rank.getCell("A2").font = { bold: true };
  rank.getCell("B2").value = { formula: "EOMONTH(B1,0)" };
  rank.getCell("B2").numFmt = "yyyy-mm-dd";
  rank.mergeCells("A3:D3");
  rank.getCell("A3").value = "총점 내림차순 · 출석일=서로 다른 날짜 수";
  rank.getCell("A3").font = { size: 9, color: { argb: "FFAAAAAA" } };
  ["순위", "닉네임", "총점", "출석일"].forEach((h, i) => {
    rank.getCell(4, i + 1).value = h;
  });
  styleHeaderRow(rank.getRow(4));
  rank.getColumn(1).width = 6;
  rank.getColumn(2).width = 14;
  rank.getColumn(3).width = 10;
  rank.getColumn(4).width = 10;

  for (let i = 0; i < MAX_LIST; i++) {
    const r = 5 + i;
    const n = i + 1;
    rank.getCell(r, 8).value = { formula: `IF(I${r}=${E},${E},${n})` };
    rank.getCell(r, 9).value = { formula: nickListFormula(n) };
    rank.getCell(r, 10).value = {
      formula: `IF(I${r}=${E},${E},SUMIFS(${S_RAW}!$G:$G,${S_RAW}!$C:$C,I${r},${S_RAW}!$A:$A,">="&$B$1,${S_RAW}!$A:$A,"<="&$B$2))`,
    };
    rank.getCell(r, 11).value = {
      formula: `IF(I${r}=${E},${E},COUNTA(_xlfn.UNIQUE(_xlfn.FILTER(${S_RAW}!$A:$A,((${S_RAW}!$C:$C=I${r})*(${S_RAW}!$A:$A>=$B$1)*(${S_RAW}!$A:$A<=$B$2))))))`,
    };
    rank.getCell(r, 12).value = { formula: `IF(I${r}=${E},${E},J${r})` };
  }
  applySortDisplay(rank, 5, `_xlfn.SORTBY(H5:L${LIST_END},L5:L${LIST_END},-1)`);

  const att = wb.addWorksheet("출석");
  att.views = [{ state: "frozen", ySplit: 4 }];
  att.getCell("A1").value = "기간 시작";
  att.getCell("A1").font = { bold: true };
  att.getCell("B1").value = { formula: `${S_RANK}!B1` };
  att.getCell("B1").numFmt = "yyyy-mm-dd";
  att.getCell("A2").value = "기간 종료";
  att.getCell("A2").font = { bold: true };
  att.getCell("B2").value = { formula: `${S_RANK}!B2` };
  att.getCell("B2").numFmt = "yyyy-mm-dd";
  att.mergeCells("A3:D3");
  att.getCell("A3").value = "방문=날짜 수 · 게임=기록 행 수 · 방문 많은 순";
  att.getCell("A3").font = { size: 9, color: { argb: "FFAAAAAA" } };
  ["닉네임", "방문", "게임", "방문 날짜"].forEach((h, i) => {
    att.getCell(4, i + 1).value = h;
  });
  styleHeaderRow(att.getRow(4));
  att.getColumn(1).width = 14;
  att.getColumn(2).width = 8;
  att.getColumn(3).width = 8;
  att.getColumn(4).width = 40;

  for (let i = 0; i < MAX_LIST; i++) {
    const r = 5 + i;
    const n = i + 1;
    att.getCell(r, 8).value = { formula: nickListFormula(n) };
    att.getCell(r, 9).value = {
      formula: `IF(H${r}=${E},${E},COUNTA(_xlfn.UNIQUE(_xlfn.FILTER(${S_RAW}!$A:$A,((${S_RAW}!$C:$C=H${r})*(${S_RAW}!$A:$A>=$B$1)*(${S_RAW}!$A:$A<=$B$2))))))`,
    };
    att.getCell(r, 10).value = {
      formula: `IF(H${r}=${E},${E},COUNTIFS(${S_RAW}!$C:$C,H${r},${S_RAW}!$A:$A,">="&$B$1,${S_RAW}!$A:$A,"<="&$B$2))`,
    };
    att.getCell(r, 11).value = {
      formula: `IF(H${r}=${E},${E},_xlfn.TEXTJOIN(", ",TRUE,_xlfn.UNIQUE(_xlfn.FILTER(${S_RAW}!$A:$A,((${S_RAW}!$C:$C=H${r})*(${S_RAW}!$A:$A>=$B$1)*(${S_RAW}!$A:$A<=$B$2))))))`,
    };
    att.getCell(r, 12).value = { formula: `IF(H${r}=${E},${E},I${r})` };
  }
  applySortDisplay(att, 5, `_xlfn.SORTBY(H5:L${LIST_END},I5:I${LIST_END},-1)`);

  const guide = wb.addWorksheet("사용법");
  guide.getColumn(1).width = 80;
  [
    "MNF 승점·출석 엑셀 템플릿",
    "",
    "■ Microsoft Excel 365 필요 (UNIQUE, FILTER, SORTBY)",
    "",
    "■ 게임기록 — B1 날짜, 9게임×20행 입력",
    "■ 기록 — 자동 집계 (180행, 수정하지 마세요)",
    "■ 승점순위 — B1~B2 기간, 총점 순 정렬",
    "■ 출석 — 방문·게임·날짜 목록, 방문 순 정렬",
  ].forEach((text, i) => {
    const cell = guide.getCell(i + 1, 1);
    cell.value = text;
    cell.font = i === 0 ? { bold: true, size: 14 } : { size: 11 };
  });

  mkdirSync(dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log(`Created: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
