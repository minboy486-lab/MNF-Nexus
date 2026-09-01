const ONBOARDING_DONE_KEY = "mnf-staff-permissions-onboarding-done";

export function isInstalledStaffPwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isStaffPermissionOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markStaffPermissionOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function shouldShowStaffPermissionOnboarding(): boolean {
  return isInstalledStaffPwa() && !isStaffPermissionOnboardingDone();
}
