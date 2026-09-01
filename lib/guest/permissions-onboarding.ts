const ONBOARDING_DONE_KEY = "mnf-guest-permissions-onboarding-done";

export function isInstalledGuestPwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isGuestPermissionOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markGuestPermissionOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function shouldShowGuestPermissionOnboarding(): boolean {
  return isInstalledGuestPwa() && !isGuestPermissionOnboardingDone();
}
