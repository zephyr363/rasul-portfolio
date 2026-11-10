// Деплой Worker с авто-объявлением техработ: announce(on) → wrangler deploy → announce(off).
// env: WORKER_URL, TG_WEBHOOK_SECRET (admin-secret). SKIP_ANNOUNCE=1 — без объявлений.
import { spawnSync } from "node:child_process";

const url = (process.env.WORKER_URL ?? "").replace(/\/+$/, "");
const secret = process.env.TG_WEBHOOK_SECRET ?? "";
const skip = process.env.SKIP_ANNOUNCE === "1";

async function announce(maintenance) {
  if (skip || !url || !secret) return;
  try {
    const res = await fetch(`${url}/admin/announce`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ maintenance }),
    });
    if (!res.ok) console.warn(`announce ${maintenance ? "on" : "off"}: HTTP ${res.status}`);
  } catch (e) {
    console.warn(`announce ${maintenance ? "on" : "off"} failed: ${e.message}`);
  }
}

await announce(true);

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npx, ["wrangler", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status === 0) await announce(false);
process.exit(result.status ?? 1);
