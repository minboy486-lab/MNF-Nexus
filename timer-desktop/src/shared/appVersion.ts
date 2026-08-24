import { version as PACKAGE_VERSION } from "../../package.json";

/**
 * 타이머 앱 버전은 `timer-desktop/package.json` 하나다.
 * 헤더 표기: 패치가 0이면 V1.1, 아니면 V1.0.2.
 */
export const APP_VERSION: string = PACKAGE_VERSION;

export function formatAppVersionLabel(semver: string): string {
  const cleaned = semver.trim().replace(/^v/i, "");
  const core = cleaned.split("-")[0] ?? cleaned;
  const suffix = cleaned.slice(core.length);
  const [major = "0", minor = "0", patch = "0"] = core.split(".");
  if (patch === "0") return `V${major}.${minor}${suffix}`;
  return `V${major}.${minor}.${patch}${suffix}`;
}

export const APP_VERSION_LABEL = formatAppVersionLabel(APP_VERSION);
