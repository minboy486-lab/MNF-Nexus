const CHO_LIST = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

/** 한글 음절·자모 → 초성 문자열 (영문/숫자는 소문자 그대로) */
export function extractChosung(text: string): string {
  return [...text]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        return CHO_LIST[Math.floor((code - 0xac00) / 588)] ?? "";
      }
      if (CHO_LIST.includes(char)) return char;
      if (code >= 0x3131 && code <= 0x314e) return char;
      return char.toLowerCase();
    })
    .join("");
}

/** 검색어가 초성(ㄱ–ㅎ)만으로 이루어졌는지 */
export function isChosungQuery(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  return [...q].every(
    (c) => CHO_LIST.includes(c) || (c.charCodeAt(0) >= 0x3131 && c.charCodeAt(0) <= 0x314e),
  );
}

/** 닉네임이 검색어와 일치 (부분 문자열 또는 초성 연속 매칭) */
export function matchesNicknameSearch(nickname: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const nick = nickname.toLowerCase();
  if (nick.includes(q)) return true;

  const nickCho = extractChosung(nickname);
  const qCho = extractChosung(q);

  if (!qCho) return false;
  if (isChosungQuery(q)) return nickCho.includes(qCho);
  return nickCho.startsWith(qCho) || nickCho.includes(qCho);
}
