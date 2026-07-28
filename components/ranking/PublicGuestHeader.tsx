"use client";

import { MnfLogo } from "@/components/brand/MnfLogo";
import { GuestNicknameModal } from "@/components/ranking/GuestNicknameModal";
import { PublicGuestProfileChip } from "@/components/ranking/PublicGuestProfileChip";

type Props = {
  nickname: string | null;
  showNicknameModal: boolean;
  onSaveNickname: (nick: string) => void;
  onOpenEdit: () => void;
  onCloseEdit?: () => void;
};

export function PublicGuestHeader({
  nickname,
  showNicknameModal,
  onSaveNickname,
  onOpenEdit,
  onCloseEdit,
}: Props) {
  return (
    <>
      {showNicknameModal && (
        <GuestNicknameModal
          initial={nickname ?? ""}
          onSave={onSaveNickname}
          onClose={nickname ? onCloseEdit : undefined}
        />
      )}

      <header className="public-ranking-header">
        <div className="public-ranking-header-logo-wrap">
          <MnfLogo variant="horizontal" priority className="public-ranking-header-logo" />
        </div>
        <PublicGuestProfileChip nickname={nickname} onClick={onOpenEdit} />
      </header>
    </>
  );
}
