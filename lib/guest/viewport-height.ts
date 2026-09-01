const CSS_VAR = "--guest-vh";

/** iOS PWA 첫 진입 시 visual viewport 높이를 셸에 맞춥니다. */
export function bindGuestViewportHeight(): () => void {
  if (typeof window === "undefined") return () => {};

  const root = document.documentElement;

  function apply() {
    const height = window.visualViewport?.height ?? window.innerHeight;
    root.style.setProperty(CSS_VAR, `${Math.round(height)}px`);
  }

  apply();
  window.visualViewport?.addEventListener("resize", apply);
  window.visualViewport?.addEventListener("scroll", apply);
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);

  return () => {
    window.visualViewport?.removeEventListener("resize", apply);
    window.visualViewport?.removeEventListener("scroll", apply);
    window.removeEventListener("resize", apply);
    window.removeEventListener("orientationchange", apply);
    root.style.removeProperty(CSS_VAR);
  };
}
