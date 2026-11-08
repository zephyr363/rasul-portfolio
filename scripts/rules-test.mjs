// FB-QA — прогон Firestore Rules на локальном эмуляторе (без прода).
//
// Usage: npm run test:rules
// Обёртка над `firebase-tools emulators:exec`: поднимает только firestore-эмулятор
// (нужна Java), выполняет `node --test tests/rules/firestore.rules.test.mjs`,
// затем гасит эмулятор. Конфиг — tests/rules/firebase.emulator.json (порт 18080,
// отдельный от firebase.json), правила берутся из firestore.rules (read-only).
// Ничего не деплоит и не обращается к реальному проекту.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const args = [
  'emulators:exec',
  '--config',
  'firebase.rules-test.json',
  '--only',
  'firestore',
  '--project',
  process.env.RULES_TEST_PROJECT ?? 'porfo-ddb46',
  'node --test tests/rules/firestore.rules.test.mjs',
];

const cli = path.join('node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');

const res = spawnSync(process.execPath, [cli, ...args], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

process.exit(res.status ?? 1);
