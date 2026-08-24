import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/** 구간별 크기 — 선택(또는 커서 위치)에만 적용 */
const FONT_SIZES = [16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 120];
const DEFAULT_SIZE = 48;
const FONT_STACK = '"Pretendard", "Apple SD Gothic Neo", "Segoe UI", Inter, sans-serif';

const COLORS = [
  { label: "기본", value: "#e8e6ef" },
  { label: "핑크", value: "#ffb6c9" },
  { label: "퍼플", value: "#b7b0ff" },
  { label: "흰", value: "#ffffff" },
  { label: "노랑", value: "#fde047" },
  { label: "초록", value: "#86efac" },
  { label: "빨강", value: "#fca5a5" },
  { label: "회색", value: "#9ca3af" },
];

type Props = {
  html: string;
  onChange: (html: string) => void;
};

export type NoticeRichEditorHandle = {
  getHtml: () => string;
};

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const NoticeRichEditor = forwardRef<NoticeRichEditorHandle, Props>(
  function NoticeRichEditor({ html, onChange }, ref) {
    const editorRef = useRef<HTMLDivElement>(null);
    const skipSync = useRef(false);
    /** select/color 클릭 전에 에디터 선택 구간 보존 */
    const savedRangeRef = useRef<Range | null>(null);

    useImperativeHandle(ref, () => ({
      getHtml: () => editorRef.current?.innerHTML ?? "",
    }));

    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      if (skipSync.current) {
        skipSync.current = false;
        return;
      }
      if (el.innerHTML !== html) el.innerHTML = html || "";
    }, [html]);

    function emit() {
      const el = editorRef.current;
      if (!el) return;
      skipSync.current = true;
      onChange(el.innerHTML);
    }

    function saveSelection() {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return;
      savedRangeRef.current = range.cloneRange();
    }

    function restoreSelection() {
      const el = editorRef.current;
      const range = savedRangeRef.current;
      if (!el || !range) {
        el?.focus();
        return;
      }
      el.focus();
      const sel = window.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      try {
        sel.addRange(range);
      } catch {
        // 에디터 DOM이 바뀐 경우 무시
      }
    }

    function run(cmd: string, value?: string) {
      restoreSelection();
      document.execCommand(cmd, false, value);
      saveSelection();
      emit();
    }

    function applyColor(color: string) {
      restoreSelection();
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("foreColor", false, color);
      saveSelection();
      emit();
    }

    function applyFontSize(px: number) {
      restoreSelection();
      document.execCommand("styleWithCSS", false, "true");
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        // 선택 없으면 에디터 끝에 커서용 스팬
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        const span = document.createElement("span");
        span.style.fontSize = `${px}px`;
        span.style.fontFamily = FONT_STACK;
        span.appendChild(document.createTextNode("\u200b"));
        el.appendChild(span);
        const r = document.createRange();
        r.setStart(span.firstChild!, 1);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);
        saveSelection();
        emit();
        return;
      }

      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        const span = document.createElement("span");
        span.style.fontSize = `${px}px`;
        span.style.fontFamily = FONT_STACK;
        span.appendChild(document.createTextNode("\u200b"));
        range.insertNode(span);
        range.setStart(span.firstChild!, 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        try {
          const span = document.createElement("span");
          span.style.fontSize = `${px}px`;
          span.style.fontFamily = FONT_STACK;
          range.surroundContents(span);
        } catch {
          const text = range.toString();
          document.execCommand(
            "insertHTML",
            false,
            `<span style="font-size:${px}px;font-family:${FONT_STACK}">${escapeHtml(text)}</span>`,
          );
        }
      }
      saveSelection();
      emit();
    }

    return (
      <div className="notice-rich">
        <div className="notice-rich__toolbar">
          <select
            className="notice-rich__select"
            defaultValue={String(DEFAULT_SIZE)}
            title="글씨 크기 (선택한 글자에만 적용)"
            onMouseDown={saveSelection}
            onChange={(e) => applyFontSize(Number(e.target.value))}
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>
          <div className="notice-rich__colors" title="글씨 색">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className="notice-rich__swatch"
                style={{ background: c.value }}
                title={c.label}
                onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
                onClick={() => applyColor(c.value)}
              />
            ))}
            <label
              className="notice-rich__swatch notice-rich__swatch--picker"
              title="직접 색 선택"
              onMouseDown={saveSelection}
            >
              <input
                type="color"
                className="notice-rich__color-input"
                defaultValue="#ffb6c9"
                onChange={(e) => applyColor(e.target.value)}
              />
            </label>
          </div>
          <button type="button" className="notice-rich__btn" title="굵게" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => run("bold")}>
            <strong>가</strong>
          </button>
          <button type="button" className="notice-rich__btn" title="기울임" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => run("italic")}>
            <em>가</em>
          </button>
          <button type="button" className="notice-rich__btn" title="밑줄" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => run("underline")}>
            <span style={{ textDecoration: "underline" }}>가</span>
          </button>
          <span className="notice-rich__sep" />
          <button type="button" className="notice-rich__btn" title="왼쪽 정렬" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => run("justifyLeft")}>
            ≡←
          </button>
          <button type="button" className="notice-rich__btn" title="가운데 정렬" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => run("justifyCenter")}>
            ≡
          </button>
          <button type="button" className="notice-rich__btn" title="오른쪽 정렬" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => run("justifyRight")}>
            →≡
          </button>
          <button type="button" className="notice-rich__btn" title="양쪽 정렬" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => run("justifyFull")}>
            ☰
          </button>
        </div>
        <div
          ref={editorRef}
          className="notice-rich__body"
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          data-placeholder="문구를 입력하세요"
        />
      </div>
    );
  },
);
