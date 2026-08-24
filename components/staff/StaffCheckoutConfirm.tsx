"use client";

type Props = {
  pending?: boolean;
  onYes: () => void;
  onNo: () => void;
};

export function StaffCheckoutConfirm({ pending, onYes, onNo }: Props) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-confirm-title"
      onClick={onNo}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-surface-container-high border border-white/10 p-5 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="checkout-confirm-title" className="text-center text-base font-bold">
          퇴근하시겠습니까?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onYes}
            className="h-12 rounded-xl bg-red-600 text-white text-sm font-bold active:scale-[0.97] disabled:opacity-50"
          >
            {pending ? "처리 중..." : "예"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onNo}
            className="h-12 rounded-xl border border-white/20 bg-white/10 text-sm font-bold active:scale-[0.97] disabled:opacity-50"
          >
            아니오
          </button>
        </div>
      </div>
    </div>
  );
}
