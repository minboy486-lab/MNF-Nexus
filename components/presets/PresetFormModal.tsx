"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BlindStructureEditor } from "@/components/presets/BlindStructureEditor";
import { RankRowsEditor } from "@/components/presets/RankRowsEditor";
import { RebuyChipsEditor } from "@/components/presets/RebuyChipsEditor";
import {
  createPresetFromPayload,
  updatePresetFromPayload,
} from "@/lib/actions/games";
import { MpNumericInput } from "@/components/ui/MpNumericInput";
import { NumericInput } from "@/components/ui/NumericInput";
import { presetToFormState } from "@/lib/presets/preset-form";
import { createDefaultStructure, countPlayLevels } from "@/lib/presets/structure";
import type {
  BlindStructureRow,
  GamePreset,
  PresetGameKind,
  PrizePlacement,
  RebuyChipTier,
  WinPointPlacement,
} from "@/lib/types";

const fieldCls =
  "w-full bg-surface-container-low border border-white/10 rounded-lg py-2 px-3 text-sm focus:border-primary/40 focus:outline-none";
const labelCls = "text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide block mb-1";
const checkCls =
  "w-5 h-5 shrink-0 rounded border-white/25 bg-surface-container-low accent-primary cursor-pointer";

type Props = {
  onClose: () => void;
  onSaved?: (id: string) => void;
  preset?: GamePreset;
};

const defaultForm = {
  gameKind: "daily" as PresetGameKind,
  name: "",
  buyIn: 500000,
  rebuyCost: 500000,
  addonEnabled: false,
  bonusEnabled: false,
  addonPrice: 300000,
  buyInChips: 30000,
  rebuyChips: [{ order: 1, chips: 30000 }] as RebuyChipTier[],
  addonChips: 30000,
  bonusChips: 0,
  placements: [
    { rank: 1, percent: 50 },
    { rank: 2, percent: 30 },
    { rank: 3, percent: 20 },
  ] as PrizePlacement[],
  winPoints: [{ rank: 1, points: 100 }] as WinPointPlacement[],
  participationPoints: 0,
  prizePoolPercent: 100,
  structure: createDefaultStructure(),
};

function FieldBlock({
  label,
  id,
  value,
  onChange,
  mp,
}: {
  label: string;
  id: string;
  value: number;
  onChange: (n: number) => void;
  mp?: boolean;
}) {
  return (
    <div>
      <label className={labelCls} htmlFor={id}>
        {label}
      </label>
      {mp ? (
        <div className="flex items-center gap-2">
          <MpNumericInput
            id={id}
            valueWon={value}
            onChangeWon={onChange}
            className={`${fieldCls} flex-1`}
          />
          <span className="text-xs text-on-surface-variant shrink-0">MP</span>
        </div>
      ) : (
        <NumericInput id={id} value={value} onChange={onChange} className={fieldCls} />
      )}
    </div>
  );
}

export function PresetFormModal({ onClose, onSaved, preset }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const initial = preset ? presetToFormState(preset) : null;
  const isEdit = Boolean(preset);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [gameKind, setGameKind] = useState<PresetGameKind>(initial?.gameKind ?? defaultForm.gameKind);
  const [name, setName] = useState(initial?.name ?? defaultForm.name);
  const [buyIn, setBuyIn] = useState(initial?.buyIn ?? defaultForm.buyIn);
  const [rebuyCost, setRebuyCost] = useState(initial?.rebuyCost ?? defaultForm.rebuyCost);
  const [addonEnabled, setAddonEnabled] = useState(
    initial?.addonEnabled ?? defaultForm.addonEnabled,
  );
  const [bonusEnabled, setBonusEnabled] = useState(
    initial?.bonusEnabled ?? defaultForm.bonusEnabled,
  );
  const [addonPrice, setAddonPrice] = useState(initial?.addonPrice ?? defaultForm.addonPrice);
  const [buyInChips, setBuyInChips] = useState(initial?.buyInChips ?? defaultForm.buyInChips);
  const [rebuyChips, setRebuyChips] = useState<RebuyChipTier[]>(
    initial?.rebuyChips ?? defaultForm.rebuyChips,
  );
  const [addonChips, setAddonChips] = useState(initial?.addonChips ?? defaultForm.addonChips);
  const [bonusChips, setBonusChips] = useState(initial?.bonusChips ?? defaultForm.bonusChips);
  const [placements, setPlacements] = useState<PrizePlacement[]>(
    initial?.placements ?? defaultForm.placements,
  );
  const [winPoints, setWinPoints] = useState<WinPointPlacement[]>(
    initial?.winPoints ?? defaultForm.winPoints,
  );
  const [participationPoints, setParticipationPoints] = useState(
    initial?.participationPoints ?? defaultForm.participationPoints,
  );
  const [prizePoolPercent, setPrizePoolPercent] = useState(
    initial?.prizePoolPercent ?? defaultForm.prizePoolPercent,
  );
  const [structure, setStructure] = useState<BlindStructureRow[]>(
    initial?.structure ?? defaultForm.structure,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const percentSum = useMemo(
    () => placements.reduce((s, p) => s + (Number(p.percent) || 0), 0),
    [placements],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("이름을 입력하세요.");
      return;
    }
    if (countPlayLevels(structure) === 0) {
      setError("블라인드 레벨을 1개 이상 추가하세요.");
      return;
    }
    setPending(true);
    setError(null);
    const payload = {
      name: name.trim(),
      game_kind: gameKind,
      buy_in: buyIn,
      rebuy_cost: rebuyCost,
      addon_enabled: addonEnabled,
      bonus_enabled: bonusEnabled,
      addon_price: addonPrice,
      buy_in_chips: buyInChips,
      rebuy_chips: rebuyChips,
      addon_chips: addonChips,
      bonus_chips: bonusChips,
      blind_structure: structure,
      placements,
      win_points: winPoints,
      participation_points: participationPoints,
      prize_pool_percent: prizePoolPercent,
    };
    const res = isEdit && preset
      ? await updatePresetFromPayload(preset.id, payload)
      : await createPresetFromPayload(payload);
    setPending(false);
    if ("error" in res) {
      setError(res.error);
      requestAnimationFrame(() =>
        errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
      return;
    }
    router.refresh();
    if (res.id) onSaved?.(res.id);
    onClose();
  }

  if (!mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/92 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-form-title"
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-4xl sm:max-w-5xl shrink-0 rounded-2xl border border-white/12 shadow-2xl bg-[#0c0d14]/98 backdrop-blur-md my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0c0d14] rounded-t-2xl">
          <h2 id="preset-form-title" className="font-bold text-lg flex items-center gap-2">
            <span className="w-1 h-5 bg-primary rounded-full" />
            {isEdit ? "블라인드 수정" : "블라인드 생성"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-on-surface-variant"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-6 max-h-[calc(100dvh-6rem)] overflow-y-auto">
          {error && (
            <p
              ref={errorRef}
              className="text-sm text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2"
              role="alert"
            >
              {error}
            </p>
          )}
          <div>
            <span className={labelCls}>유형</span>
            <div className="mt-1 flex gap-2">
              {(
                [
                  { id: "daily" as const, label: "데일리" },
                  { id: "tournament" as const, label: "대회" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setGameKind(id)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                    gameKind === id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-white/10 text-on-surface-variant hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="preset-name">
              이름
            </label>
            <input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldCls}
              placeholder={gameKind === "daily" ? "데일리 기본" : "주말 MTT"}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-3 rounded-xl border border-white/10 p-4 bg-surface-container-low/20">
              <FieldBlock label="바인비용" id="buy-in" value={buyIn} onChange={setBuyIn} mp />
              <FieldBlock label="리바인비용" id="rebuy-cost" value={rebuyCost} onChange={setRebuyCost} mp />
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={addonEnabled}
                  onChange={(e) => setAddonEnabled(e.target.checked)}
                  className={checkCls}
                />
                <span className="text-sm font-medium">애드온</span>
              </label>
              {addonEnabled && (
                <FieldBlock
                  label="애드온비용"
                  id="addon-price"
                  value={addonPrice}
                  onChange={setAddonPrice}
                  mp
                />
              )}
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={bonusEnabled}
                  onChange={(e) => setBonusEnabled(e.target.checked)}
                  className={checkCls}
                />
                <span className="text-sm font-medium">보너스칩</span>
              </label>
            </div>
            <div className="space-y-3 rounded-xl border border-white/10 p-4 bg-surface-container-low/20">
              <FieldBlock label="바인칩" id="buy-in-chips" value={buyInChips} onChange={setBuyInChips} />
              <div>
                <p className={`${labelCls} mb-2`}>리바인 칩</p>
                <RebuyChipsEditor rows={rebuyChips} onChange={setRebuyChips} />
              </div>
              {addonEnabled && (
                <FieldBlock
                  label="애드온칩"
                  id="addon-chips"
                  value={addonChips}
                  onChange={setAddonChips}
                />
              )}
              {bonusEnabled && (
                <FieldBlock
                  label="보너스칩"
                  id="bonus-chips"
                  value={bonusChips}
                  onChange={setBonusChips}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <section>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold shrink-0">프라이즈</h3>
                <div
                  className="flex items-center gap-1.5 shrink-0"
                  title="총 바인비용 대비 프라이즈 풀 비율"
                >
                  <span className="text-[10px] text-on-surface-variant whitespace-nowrap">
                    프라이즈 풀
                  </span>
                  <NumericInput
                    mode="decimal"
                    max={100}
                    id="prize-pool-percent"
                    value={prizePoolPercent}
                    onChange={setPrizePoolPercent}
                    className="w-14 py-1 px-2 text-sm text-center rounded-md bg-surface-container-low border border-white/10 focus:border-primary/40"
                    aria-label="프라이즈 풀 비율"
                  />
                  <span className="text-[10px] text-on-surface-variant">%</span>
                </div>
              </div>
              <RankRowsEditor mode="prize" rows={placements} onChange={setPlacements} />
              {percentSum > 100 ? (
                <p className="text-xs text-error mt-2 font-medium">
                  등수별 비율 합계 {percentSum}% — 100%를 초과했습니다
                </p>
              ) : percentSum !== 100 ? (
                <p className="text-xs text-on-surface-variant/80 mt-2">
                  등수별 합계 {percentSum}%
                </p>
              ) : null}
            </section>
            <section>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold shrink-0">승점</h3>
                <div
                  className="flex items-center gap-1.5 shrink-0"
                  title="게임 1회 참여 시 부여 (리바인 무관)"
                >
                  <span className="text-[10px] text-on-surface-variant whitespace-nowrap">
                    참여
                  </span>
                  <NumericInput
                    id="participation-points"
                    value={participationPoints}
                    onChange={setParticipationPoints}
                    className="w-14 py-1 px-2 text-sm text-center rounded-md bg-surface-container-low border border-white/10 focus:border-primary/40"
                    aria-label="참여점수"
                  />
                  <span className="text-[10px] text-on-surface-variant">점</span>
                </div>
              </div>
              <RankRowsEditor mode="win" rows={winPoints} onChange={setWinPoints} />
            </section>
          </div>

          <section>
            <h3 className="text-sm font-bold mb-3">블라인드 구조</h3>
            <BlindStructureEditor rows={structure} onChange={setStructure} />
          </section>

          <div className="flex gap-3 pt-2 sticky bottom-0 bg-[#0c0d14] pb-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border border-white/15 text-sm font-medium hover:bg-white/5"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn-primary flex-1 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "저장 중…" : isEdit ? "수정 저장" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
