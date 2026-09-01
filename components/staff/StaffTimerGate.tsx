"use client";

import { StaffTimerConnect } from "@/components/staff/StaffTimerConnect";

type Props = {
  loginId: string;
};

export function StaffTimerGate({ loginId }: Props) {
  return <StaffTimerConnect loginId={loginId} autoConnect />;
}
