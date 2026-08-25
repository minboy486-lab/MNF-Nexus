import { LAN_CLUSTER_PATH, REMOTE_PORT } from "../../shared/remote";
import { LAN_GAMES_PATH, type LanDiscoveredGame, type LanHostGames } from "../../shared/lanView";
import { listLanIPv4 } from "./lan";

const SCAN_MS = 450;
const CONCURRENCY = 48;

function subnetHosts(ip: string): string[] {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return [];
  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const hosts: string[] = [];
  for (let i = 1; i <= 254; i++) {
    if (i === parts[3]) continue;
    hosts.push(`${prefix}.${i}`);
  }
  return hosts;
}

async function fetchHost(ip: string): Promise<LanDiscoveredGame[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), SCAN_MS);
  try {
    const r = await fetch(`http://${ip}:${REMOTE_PORT}${LAN_GAMES_PATH}`, {
      signal: ctrl.signal,
    });
    if (!r.ok) return [];
    const data = (await r.json()) as LanHostGames;
    if (!data?.ok || !Array.isArray(data.games)) return [];
    return data.games.map((g) => ({
      ...g,
      host: ip,
      hostname: data.hostname || ip,
      theme: data.theme,
      soundVolume: data.soundVolume,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function listLanScanTargets(): Promise<string[]> {
  const mine = await listLanIPv4();
  const seen = new Set<string>(mine);
  const targets: string[] = [];
  for (const ip of mine) {
    for (const host of subnetHosts(ip)) {
      if (seen.has(host)) continue;
      seen.add(host);
      targets.push(host);
    }
  }
  return targets;
}

export async function discoverLanGames(): Promise<LanDiscoveredGame[]> {
  const targets = await listLanScanTargets();
  const found: LanDiscoveredGame[] = [];
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    const rows = await Promise.all(chunk.map(fetchHost));
    for (const list of rows) found.push(...list);
  }
  return found;
}

export type LanClusterHello = {
  host: string;
  hostname: string;
  pin: string;
};

async function fetchCluster(ip: string): Promise<LanClusterHello | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), SCAN_MS);
  try {
    const r = await fetch(`http://${ip}:${REMOTE_PORT}${LAN_CLUSTER_PATH}`, {
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { ok?: boolean; hostname?: string; pin?: string };
    if (!data?.ok || typeof data.pin !== "string" || !/^\d{4}$/.test(data.pin)) return null;
    return {
      host: ip,
      hostname: typeof data.hostname === "string" && data.hostname.trim() ? data.hostname.trim() : ip,
      pin: data.pin,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function discoverLanCluster(): Promise<LanClusterHello[]> {
  const targets = await listLanScanTargets();
  const found: LanClusterHello[] = [];
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    const rows = await Promise.all(chunk.map(fetchCluster));
    for (const row of rows) if (row) found.push(row);
  }
  return found;
}
