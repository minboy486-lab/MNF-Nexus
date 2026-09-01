export type RequestNotificationResult =
  | { ok: true }
  | { error: string; denied?: boolean; unsupported?: boolean };

export async function requestStaffNotificationAccess(): Promise<RequestNotificationResult> {
  if (!("Notification" in window)) {
    return { error: "이 기기에서는 알림을 지원하지 않습니다.", unsupported: true };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      error: permission === "denied" ? "알림이 차단되었습니다." : "알림 권한이 필요합니다.",
      denied: permission === "denied",
    };
  }

  return { ok: true };
}
