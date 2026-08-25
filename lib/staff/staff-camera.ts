const CAMERA_OK_KEY = "mnf-staff-camera-ok";

export function rememberCameraGranted(): void {
  try {
    localStorage.setItem(CAMERA_OK_KEY, "1");
  } catch {
    /* private mode */
  }
}

export async function queryCameraPermission(): Promise<PermissionState | "unknown"> {
  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

export function isCameraDeniedError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
  );
}

function androidBrowserPackage(ua: string): string {
  if (/KAKAOTALK/i.test(ua)) return "com.kakao.talk";
  if (/NAVER/i.test(ua)) return "com.nhn.android.search";
  if (/SamsungBrowser/i.test(ua)) return "com.sec.android.app.sbrowser";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "com.facebook.katana";
  if (/Instagram/i.test(ua)) return "com.instagram.android";
  if (/EdgA/i.test(ua)) return "com.microsoft.emmx";
  if (/Firefox/i.test(ua)) return "org.mozilla.firefox";
  if (/Whale/i.test(ua)) return "com.naver.whale";
  return "com.android.chrome";
}

/** 아이폰·안드로이드 모두 브라우저 앱 설정(카메라 항상 허용)으로 보냄 */
export function openAppSettings(): void {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) {
    window.location.href = "app-settings:";
    return;
  }
  if (!/Android/i.test(ua)) return;
  const pkg = androidBrowserPackage(ua);
  const fallback = encodeURIComponent(window.location.href);
  window.location.href = `intent://#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;scheme=package;package=${pkg};S.browser_fallback_url=${fallback};end`;
}

export async function openStaffCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("카메라 없음", "NotFoundError");
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    rememberCameraGranted();
    return stream;
  } catch (err) {
    if (isCameraDeniedError(err)) throw err;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    rememberCameraGranted();
    return stream;
  }
}
