import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

const timerAlias = {
  "@mnf/timer": resolve(__dirname, "../lib/timer"),
  "@mnf/venue": resolve(__dirname, "../lib/venue"),
};

/** .env 파일을 직접 파싱해서 define 객체로 변환 */
function loadEnvDefines(): Record<string, string> {
  const envPath = resolve(__dirname, ".env");
  if (!existsSync(envPath)) return {};
  const lines = readFileSync(envPath, "utf-8").split("\n");
  const defines: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    defines[`process.env.${key}`] = JSON.stringify(val);
  }
  return defines;
}

const envDefines = loadEnvDefines();

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: timerAlias },
    define: envDefines,
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: timerAlias },
    build: {
      rollupOptions: {
        input: {
          control: resolve(__dirname, "src/preload/control.ts"),
          display: resolve(__dirname, "src/preload/display.ts"),
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    resolve: { alias: timerAlias },
    plugins: [react()],
    server: { host: true, allowedHosts: true },
    build: {
      rollupOptions: {
        input: {
          control: resolve(__dirname, "src/renderer/control/index.html"),
          display: resolve(__dirname, "src/renderer/display/index.html"),
          remote: resolve(__dirname, "src/renderer/remote/index.html"),
        },
      },
    },
  },
});
