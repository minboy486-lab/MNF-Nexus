export async function requestGuestCameraAccess(): Promise<
  "granted" | "denied" | "unsupported"
> {
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    for (const track of stream.getTracks()) track.stop();
    return "granted";
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
    ) {
      return "denied";
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      for (const track of stream.getTracks()) track.stop();
      return "granted";
    } catch {
      return "denied";
    }
  }
}

export async function queryGuestCameraPermission(): Promise<PermissionState | "unknown"> {
  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}
