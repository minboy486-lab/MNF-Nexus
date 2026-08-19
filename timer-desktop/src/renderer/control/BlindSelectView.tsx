import { useEffect, useState } from "react";
import type { BlindStructureOption } from "@mnf/timer/types";

type Props = {
  options: BlindStructureOption[];
  loading: boolean;
  pending: boolean;
  onBack: () => void;
  onSelect: (structure: BlindStructureOption) => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
};

export function BlindSelectView({ options, loading, pending, onBack, onSelect, onOpenSettings, onRefresh }: Props) {
  const [localBlinds, setLocalBlinds] = useState<BlindStructureOption[]>([]);
  const [showLocal, setShowLocal] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  // 마운트 시 로컬 캐시 미리 로드 (options 비어있을 때 자동 표시)
  useEffect(() => {
    window.controlApi.listLocalBlinds().then((local) => {
      setLocalBlinds(local);
    }).catch(() => {});
  }, []);

  // options가 비어있고 로컬 캐시가 있으면 자동으로 로컬 목록 표시
  const displayed = (showLocal || (!loading && options.length === 0 && localBlinds.length > 0))
    ? localBlinds
    : options;

  async function handleShowLocal() {
    setShowLocal(true);
    setLocalLoading(true);
    const local = await window.controlApi.listLocalBlinds();
    setLocalBlinds(local);
    setLocalLoading(false);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenSettings();
        return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) {
        const opt = displayed[n - 1];
        if (opt && !pending) onSelect(opt);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [displayed, pending, onSelect, onOpenSettings]);

  return (
    <section className="sub-panel">
      <button type="button" className="back-btn" onClick={onBack}>
        ← 매장 화면
      </button>

      <div className="sub-panel__head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 className="sub-panel__title">블라인드 선택</h2>
          <button
            type="button"
            className={`blind-refresh-btn${loading ? " blind-refresh-btn--spinning" : ""}`}
            onClick={onRefresh}
            disabled={loading}
            title="새로고침"
          >
            ↻
          </button>
        </div>
        <div className="blind-head-btns">
          <button
            type="button"
            className={`blind-local-btn${showLocal ? " active" : ""}`}
            onClick={() => showLocal ? setShowLocal(false) : handleShowLocal()}
          >
            {showLocal ? "온라인 목록" : "로컬 저장 목록"}
          </button>
          <button
            type="button"
            className="blind-edit-btn"
            onClick={() => window.controlApi.openExternal("https://mnf-nexus.vercel.app/admin/presets")}
          >
            ＋ 블라인드 추가 / 편집
          </button>
        </div>
      </div>

      {(loading || localLoading) && <p className="muted">불러오는 중...</p>}

      {!loading && !localLoading && displayed.length === 0 && (
        <p className="muted" style={{ marginTop: 16 }}>
          블라인드 구조를 불러올 수 없습니다. 인터넷 연결을 확인하거나 로컬 저장 목록을 시도해 주세요.
        </p>
      )}

      {showLocal && !localLoading && localBlinds.length === 0 && (
        <p className="muted" style={{ marginTop: 8 }}>
          로컬에 저장된 블라인드가 없습니다. 온라인에서 한 번 불러오면 자동으로 저장됩니다.
        </p>
      )}

      <ul className="blind-list">
        {displayed.map((opt, i) => {
          const key = i < 9 ? i + 1 : null;
          return (
            <li key={opt.id}>
              <button
                type="button"
                className="blind-card"
                disabled={pending}
                onClick={() => onSelect(opt)}
              >
                {key && <span className="blind-card__key">{key}</span>}
                <div className="blind-card__body">
                  <strong>{opt.name}</strong>
                  <span className="muted">
                    바이인 {opt.defaultBuyIn.toLocaleString("ko-KR")} · {opt.levels.length}레벨
                    &nbsp;·&nbsp;L1 {opt.levels[0]?.small}/{opt.levels[0]?.big}
                    &nbsp;·&nbsp;{Math.round((opt.levels[0]?.durationSec ?? 0) / 60)}분
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
