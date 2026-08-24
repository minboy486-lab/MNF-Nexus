import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as typeof import("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path") as typeof import("path");

export const DEFAULT_VENUE_ID = "00000000-0000-4000-8000-000000000001";

export function readEnvFile(): Record<string, string> {
  const candidates = [
    typeof process.resourcesPath === "string" ? path.join(process.resourcesPath, ".env") : "",
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../.env"),
    path.resolve(__dirname, "../../../../.env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "timer-desktop/.env"),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const env: Record<string, string> = {};
      for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const idx = t.indexOf("=");
        if (idx < 0) continue;
        const k = t.slice(0, idx).trim();
        const v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        env[k] = v;
      }
      return env;
    } catch {
      /* next */
    }
  }
  return {};
}

function supabaseUrlAndKeys(): { url: string; serviceKey: string; anonKey: string } {
  const env = readEnvFile();
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    env["SUPABASE_URL"] ||
    env["NEXT_PUBLIC_SUPABASE_URL"] ||
    ""
  ).trim();
  const serviceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env["SUPABASE_SERVICE_ROLE_KEY"] ||
    ""
  ).trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env["SUPABASE_ANON_KEY"] ||
    env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ||
    ""
  ).trim();
  return { url, serviceKey, anonKey };
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, serviceKey, anonKey } = supabaseUrlAndKeys();
  const key = serviceKey || anonKey;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

/** 비밀번호 검증 전용. 세션을 공유 클라이언트에 남기지 않는다. */
export function createPasswordClient(): SupabaseClient | null {
  const { url, serviceKey, anonKey } = supabaseUrlAndKeys();
  const key = anonKey || serviceKey;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function loginEmails(loginId: string): string[] {
  const id = loginId.trim().toLowerCase();
  if (!id) return [];
  if (id.includes("@")) return [id];
  return [...new Set([`${id}@auth.mnf.local`, `${id}@mnf.com`, `${id}@mnf.local`])];
}
