// Release-чеклист без деплоя: последовательно гоняет локальные проверки и
// останавливается на первой ошибке. Никаких git push / GitHub / Pages-действий
// и сборки-для-деплоя не делает.
//
// Usage: node scripts/verify-release.mjs   (или `npm run release:check`)
//   1. node scripts/validate-content.mjs  — контракты content/cases.json + locales.json
//   2. npm run test                       — vitest (unit, src/**)
//   3. npm run lint                       — tsc --noEmit (типы/компиляция)

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const steps = [];

/** Запускает shell-команду из корня проекта, вывод — в терминал, статус — в steps. */
function runStep(label, command) {
  process.stdout.write(`\n▶ ${label}\n   $ ${command}\n`);
  const started = performance.now();
  const res = spawnSync(command, {
    cwd: rootDir,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  const ms = Math.round(performance.now() - started);
  const ok = res.status === 0 && res.signal === null;
  steps.push({ label, ok, ms });
  if (!ok) {
    const reason = res.signal ? `killed by ${res.signal}` : `exit code ${res.status}`;
    console.error(`\n✗ ${label} FAILED (${reason}) in ${ms}ms`);
    return false;
  }
  console.log(`✓ ${label} ok (${ms}ms)`);
  return true;
}

function summarize() {
  const total = steps.reduce((acc, s) => acc + s.ms, 0);
  const failed = steps.filter((s) => !s.ok);
  const verdict = failed.length === 0 ? 'PASS' : 'FAIL';

  console.log('\n════════════════════════════════════════════════════════');
  console.log(`  RELEASE VERIFY: ${verdict}`);
  console.log('════════════════════════════════════════════════════════');
  for (const { label, ok, ms } of steps) {
    console.log(`  [${ok ? '✓' : '✗'}] ${label.padEnd(40)} ${ms}ms`);
  }
  console.log('────────────────────────────────────────────────────────');
  console.log(`  Total: ${total}ms`);
  console.log('════════════════════════════════════════════════════════');
  return failed.length === 0;
}

const ok =
  runStep('1. validate-content', 'node scripts/validate-content.mjs') &&
  runStep('2. unit tests (vitest)', 'npm run test') &&
  runStep('3. typecheck (tsc)', 'npm run lint');

const pass = summarize();
process.exit(ok && pass ? 0 : 1);
