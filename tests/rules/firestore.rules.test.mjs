/**
 * FB-QA — матрица тестов Firestore Rules на эмуляторе (без прода).
 *
 * Запуск: npm run test:rules
 * (обёртка: scripts/rules-test.mjs → `firebase-tools emulators:exec --only firestore`
 *  → `node --test tests/rules/firestore.rules.test.mjs`).
 *
 * Правила читаются из firestore.rules (источник истины, только чтение).
 * Эмулятор валидирует синтаксис: если в файле снова появится `auth` вместо
 * `request.auth`, инициализация упадёт — это тоже сигнал.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..", "..");
// RULES_FILE позволяет прогнать ту же матрицу на кандидате правил (без правки прод-файла).
const RULES_FILE = process.env.RULES_FILE ?? "firestore.rules";
const RULES = readFileSync(path.resolve(rootDir, RULES_FILE), "utf8");

/** Владелец проекта (как в live-диагностике CEO). */
const OWNER_EMAIL = "rasulakhmetov2004@gmail.com";
const OWNER_UID = "HoB3WV9d0aaaaaaaaaaaaaaaa";

const VALID_LEAD = {
  name: "Иван",
  phone: "+77012345678",
  hp: "",
  status: "new",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
};

let testEnv;

/** Контекст Firestore для произвольного id-token (или анонима). */
function dbFor(claims) {
  const { uid, ...rest } = claims;
  // rules-unit-testing v6 требует `sub` (а не `uid`) в mock-токене.
  return testEnv.authenticatedContext(uid, { sub: uid, ...rest }).firestore();
}

function owner(overrides = {}) {
  return dbFor({
    uid: OWNER_UID,
    email: OWNER_EMAIL,
    email_verified: true,
    firebase: { sign_in_provider: "google.com" },
    ...overrides,
  });
}

before(async () => {
  // Защита от случайного запуска против прод-проекта: только эмулятор.
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST не задан — запускайте через `npm run test:rules` (эмулятор), не `node --test` напрямую.",
    );
  }
  testEnv = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT ?? "porfo-ddb46",
    firestore: { rules: RULES },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

describe("UID access grants", () => {
  before(async () => { await seed(); });
  it("own get allowed; list and other UID get denied", async () => {
    const db = owner();
    await assertSucceeds(getDoc(doc(db, "adminAccess", OWNER_UID)));
    await assertFails(getDoc(doc(db, "adminAccess", "disabled")));
    await assertFails(getDocs(collection(db, "adminAccess")));
  });
  it("no client self escalation or grant modification", async () => {
    const db = dbFor({ uid: "self" });
    await assertFails(setDoc(doc(db, "adminAccess", "self"), { role: "admin", enabled: true }));
    await assertFails(updateDoc(doc(owner(), "adminAccess", OWNER_UID), { enabled: false }));
    await assertFails(deleteDoc(doc(owner(), "adminAccess", OWNER_UID)));
  });
  it("disabled grant and matching email without grant denied", async () => {
    await assertFails(getDocs(collection(dbFor({ uid: "disabled" }), "leads")));
    await assertFails(getDocs(collection(dbFor({ uid: "no-grant", email: OWNER_EMAIL }), "leads")));
  });
  it("enabled UID works without email", async () => {
    await assertSucceeds(getDocs(collection(dbFor({ uid: OWNER_UID }), "leads")));
  });
});

/** Полный сброс данных + сид (в обход правил). */
async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "adminAccess", OWNER_UID), { role: "admin", enabled: true });
    await setDoc(doc(db, "adminAccess", "disabled"), { role: "admin", enabled: false });
    await setDoc(doc(db, "leads", "lead-1"), {
      name: "Иван",
      phone: "+77012345678",
      hp: "",
      status: "new",
      createdAt: new Date("2026-11-01T10:00:00Z"),
      updatedAt: new Date("2026-11-01T10:00:00Z"),
    });
    await setDoc(doc(db, "cases", "case-1"), { id: "case-1", title: "Кейс" });
    await setDoc(doc(db, "siteContent", "locales"), { ru: {} });
  });
}

/* ==================== (а) Анонимный клиент ==================== */

describe("(a) anonymous", () => {
  let db;
  before(async () => {
    await seed();
    db = testEnv.unauthenticatedContext().firestore();
  });

  it("a1 get siteContent/locales → allow", () =>
    assertSucceeds(getDoc(doc(db, "siteContent", "locales"))));

  it("a2 get locales/default (дока нет) → allow", () =>
    assertSucceeds(getDoc(doc(db, "locales", "default"))));

  it("a3 list cases → allow", () => assertSucceeds(getDocs(collection(db, "cases"))));

  it("a4 get leads/lead-1 → deny", () =>
    assertFails(getDoc(doc(db, "leads", "lead-1"))));

  it("a5 list leads → deny", () => assertFails(getDocs(collection(db, "leads"))));

  it("a6 create valid lead (serverTimestamp) → allow", () =>
    assertSucceeds(addDoc(collection(db, "leads"), VALID_LEAD)));

  it("a7 create lead с невалидным phone → deny", () =>
    assertFails(
      addDoc(collection(db, "leads"), { ...VALID_LEAD, phone: "+7999" }),
    ));

  it("a8 create lead с непустым hp → deny", () =>
    assertFails(
      addDoc(collection(db, "leads"), { ...VALID_LEAD, hp: "spam-bot" }),
    ));

  it("a9 create lead с лишним полем → deny", () =>
    assertFails(
      addDoc(collection(db, "leads"), { ...VALID_LEAD, role: "admin" }),
    ));

  it("a10 create lead со status != new → deny", () =>
    assertFails(
      addDoc(collection(db, "leads"), { ...VALID_LEAD, status: "done" }),
    ));

  it("a11 create lead с пустым name → deny", () =>
    assertFails(addDoc(collection(db, "leads"), { ...VALID_LEAD, name: "   " })));

  it("a12 update lead → deny", () =>
    assertFails(updateDoc(doc(db, "leads", "lead-1"), { status: "done" })));

  it("a13 delete lead → deny", () =>
    assertFails(deleteDoc(doc(db, "leads", "lead-1"))));

  it("a14 write siteContent → deny", () =>
    assertFails(setDoc(doc(db, "siteContent", "locales"), { ru: { hack: 1 } })));

  it("a15 write cases → deny", () =>
    assertFails(setDoc(doc(db, "cases", "case-1"), { id: "case-1" })));
});

/* ==================== (б) Владелец (email из live-диагностики) ============ */

describe("(b) owner rasulakhmetov2004@gmail.com", () => {
  before(seed);

  it("b1 list leads → allow", () =>
    assertSucceeds(getDocs(collection(owner(), "leads"))));

  it("b2 get leads/lead-1 → allow", () =>
    assertSucceeds(getDoc(doc(owner(), "leads", "lead-1"))));

  it("b3 update только status+updatedAt → allow", () =>
    assertSucceeds(
      updateDoc(doc(owner(), "leads", "lead-1"), {
        status: "in_progress",
        updatedAt: serverTimestamp(),
      }),
    ));

  it("b4 update status + чужое поле (name) → deny", () =>
    assertFails(
      updateDoc(doc(owner(), "leads", "lead-1"), {
        status: "done",
        updatedAt: serverTimestamp(),
        name: "Подмена",
      }),
    ));

  it("b5 update без updatedAt → deny", () =>
    assertFails(updateDoc(doc(owner(), "leads", "lead-1"), { status: "done" })));

  it("b6 update со недопустимым status → deny", () =>
    assertFails(
      updateDoc(doc(owner(), "leads", "lead-1"), {
        status: "hacked",
        updatedAt: serverTimestamp(),
      }),
    ));

  it("b7 write siteContent → allow", () =>
    assertSucceeds(setDoc(doc(owner(), "siteContent", "locales"), { ru: { a: 1 } })));

  it("b8 write cases (id == caseId) → allow", () =>
    assertSucceeds(
      setDoc(doc(owner(), "cases", "case-1"), { id: "case-1", title: "Новый" }),
    ));

  it("b9 write cases (id != caseId) → deny", () =>
    assertFails(
      setDoc(doc(owner(), "cases", "case-2"), { id: "case-1", title: "Чужой id" }),
    ));

  it("b10 delete lead → allow", () =>
    assertSucceeds(deleteDoc(doc(owner(), "leads", "lead-1"))));
});

/* ==================== (в) Чужой авторизованный email ==================== */

describe("(c) stranger@example.com", () => {
  let db;
  before(async () => {
    await seed();
    db = dbFor({
      uid: "stranger-uid",
      email: "stranger@example.com",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    });
  });

  it("c1 list leads → deny", () => assertFails(getDocs(collection(db, "leads"))));
  it("c2 get lead → deny", () => assertFails(getDoc(doc(db, "leads", "lead-1"))));
  it("c3 update lead → deny", () =>
    assertFails(
      updateDoc(doc(db, "leads", "lead-1"), {
        status: "done",
        updatedAt: serverTimestamp(),
      }),
    ));
  it("c4 delete lead → deny", () => assertFails(deleteDoc(doc(db, "leads", "lead-1"))));
  it("c5 write siteContent → deny", () =>
    assertFails(setDoc(doc(db, "siteContent", "locales"), { ru: {} })));
  it("c6 write cases → deny", () =>
    assertFails(setDoc(doc(db, "cases", "case-1"), { id: "case-1" })));
  it("c7 create valid lead → allow (публичная форма)", () =>
    assertSucceeds(addDoc(collection(db, "leads"), VALID_LEAD)));
});

/* ==================== (г) Регистр email ==================== */

describe("(d) email does not affect UID grant", () => {
  before(seed);

  it("d1 RasulAkhmetov2004@Gmail.COM → list leads allow", () =>
    assertSucceeds(
      getDocs(collection(owner({ email: "RasulAkhmetov2004@Gmail.COM" }), "leads")),
    ));

  it("d2 RasulAkhmetov2004@Gmail.COM → write siteContent allow", () =>
    assertSucceeds(
      setDoc(
        doc(owner({ email: "RasulAkhmetov2004@Gmail.COM" }), "siteContent", "locales"),
        { ru: { a: 2 } },
      ),
    ));
});

/* ==================== (д) Алиас googlemail ==================== */

describe("(e) алиас googlemail", () => {
  before(seed);

  it("e1 rasulakhmetov2004@googlemail.com → list leads allow", () =>
    assertSucceeds(
      getDocs(collection(owner({ email: "rasulakhmetov2004@googlemail.com" }), "leads")),
    ));

  it("e2 RASULakhmetov2004@GoogleMail.com → get lead allow", () =>
    assertSucceeds(
      getDoc(
        doc(owner({ email: "RASULakhmetov2004@GoogleMail.com" }), "leads", "lead-1"),
      ),
    ));
});
