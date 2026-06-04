"use client";

import { useRouter } from "next/navigation";
import { StartGameForm } from "@/components/games/StartGameForm";
import type { GamePreset, PhysicalTable } from "@/lib/types";

type Props = {
  presets: GamePreset[];
  tables: PhysicalTable[];
};

export function NewGamePageClient({ presets, tables }: Props) {
  const router = useRouter();

  return (
    <StartGameForm
      presets={presets}
      tables={tables}
      onSuccess={(gameId) => router.push(`/admin/games/${gameId}`)}
    />
  );
}
