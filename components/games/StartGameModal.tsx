"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { StartGameForm } from "@/components/games/StartGameForm";
import type { GamePreset, PhysicalTable } from "@/lib/types";

type Props = {
  presets: GamePreset[];
  tables: PhysicalTable[];
  initialTableId?: string;
  onClose: () => void;
};

export function StartGameModal({ presets, tables, initialTableId, onClose }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/92 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-game-title"
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-lg shrink-0 rounded-2xl border border-white/12 shadow-2xl bg-[#0c0d14]/98 backdrop-blur-md my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 id="start-game-title" className="font-bold text-lg">
            게임 개설
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
        <div className="p-5 sm:p-6">
          <StartGameForm
            presets={presets}
            tables={tables}
            initialTableId={initialTableId}
            showCancel
            onCancel={onClose}
            onSuccess={() => {
              router.refresh();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
