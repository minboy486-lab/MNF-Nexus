#!/usr/bin/env node
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
const migrations = [
  "supabase/migrations/001_initial.sql",
  "supabase/migrations/002_platform.sql",
  "supabase/migrations/003_prize_guest.sql",
  "supabase/migrations/004_features.sql",
  "supabase/migrations/005_counter_role.sql",
  "supabase/migrations/006_members_auth.sql",
  "supabase/seed.sql",
];

let ok = true;

for (const rel of migrations) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    console.error(`MISSING: ${rel}`);
    ok = false;
  }
}

if (!existsSync(envPath)) {
  console.warn("WARN: .env.local not found — copy .env.example to .env.local");
  ok = false;
} else {
  const raw = readFileSync(envPath, "utf8");
  const url = raw.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
  const key = raw.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
  if (!url || url.includes("your-project")) {
    console.warn("WARN: NEXT_PUBLIC_SUPABASE_URL not configured");
  } else {
    console.log("OK: Supabase URL set");
  }
  if (!key || key.includes("your-anon")) {
    console.warn("WARN: NEXT_PUBLIC_SUPABASE_ANON_KEY not configured");
  } else {
    console.log("OK: Supabase anon key set");
  }
}

console.log("\nApply in Supabase SQL Editor (in order):");
migrations.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));

process.exit(ok ? 0 : 1);
