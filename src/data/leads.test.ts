import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addDoc: vi.fn((_ref: unknown, _payload: Record<string, unknown>) =>
    Promise.resolve({ id: "lead-1" }),
  ),
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  doc: vi.fn((_db: unknown, name: string, id: string) => ({ name, id })),
  deleteDoc: vi.fn((_ref: unknown) => Promise.resolve()),
  updateDoc: vi.fn((_ref: unknown, _payload: Record<string, unknown>) =>
    Promise.resolve(),
  ),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((field: string, dir: string) => ({ type: "orderBy", field, dir })),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((field: string, op: string, value: unknown) => ({
    type: "where",
    field,
    op,
    value,
  })),
  limit: vi.fn((n: number) => ({ type: "limit", n })),
  serverTimestamp: vi.fn(() => ({ type: "server-timestamp" })),
  initializeApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  getFirestore: vi.fn(() => ({})),
  getAuth: vi.fn(() => ({})),
  setPersistence: vi.fn(() => Promise.resolve()),
}));

vi.mock("firebase/app", () => ({ initializeApp: mocks.initializeApp }));
vi.mock("firebase/firestore", () => ({
  getFirestore: mocks.getFirestore,
  addDoc: mocks.addDoc,
  collection: mocks.collection,
  doc: mocks.doc,
  deleteDoc: mocks.deleteDoc,
  updateDoc: mocks.updateDoc,
  onSnapshot: mocks.onSnapshot,
  orderBy: mocks.orderBy,
  query: mocks.query,
  where: mocks.where,
  limit: mocks.limit,
  serverTimestamp: mocks.serverTimestamp,
}));
vi.mock("firebase/auth", () => ({
  getAuth: mocks.getAuth,
  setPersistence: mocks.setPersistence,
  browserLocalPersistence: "LOCAL",
}));

import {
  createLead,
  deleteLead,
  describeLeadsError,
  getLeadsStream,
  normalizePhone,
  updateLeadStatus,
} from "./leads";

describe("leads — normalizePhone", () => {
  it("нормализует маску `+7 (XXX) XXX-XX-XX` в `+7XXXXXXXXXX`", () => {
    expect(normalizePhone("+7 (701) 234-56-78")).toBe("+77012345678");
    expect(normalizePhone("+7 (999) 000-00-00")).toBe("+79990000000");
    expect(normalizePhone("+7(123)456-78-90")).toBe("+71234567890");
  });

  it("игнорирует пробелы/дефисы вокруг маски", () => {
    expect(normalizePhone("  +7 (701) 234-56-78  ")).toBe("+77012345678");
  });

  it("бросает ошибку на невалидный ввод (итог обязан быть ^\\+7\\d{10}$)", () => {
    expect(() => normalizePhone("+7999")).toThrow(/Некорректный номер/);
    expect(() => normalizePhone("abc")).toThrow(/Некорректный номер/);
    expect(() => normalizePhone("")).toThrow(/Некорректный номер/);
    // «8…» → «+7…» НЕ требуется — принимаем только маску с +7.
    expect(() => normalizePhone("8 (701) 234-56-78")).toThrow(/Некорректный номер/);
  });
});

describe("leads — createLead", () => {
  beforeEach(() => {
    mocks.addDoc.mockClear();
    mocks.collection.mockClear();
    mocks.serverTimestamp.mockClear();
  });

  it("сохраняет payload: status new, нормализованный phone, hp пуст, serverTimestamp", async () => {
    const id = await createLead({
      name: "  Иван  ",
      phone: "+7 (701) 234-56-78",
    });

    expect(id).toBe("lead-1");

    expect(mocks.collection).toHaveBeenCalledWith(expect.anything(), "leads");
    expect(mocks.serverTimestamp).toHaveBeenCalledTimes(2);

    const [ref, payload] = mocks.addDoc.mock.calls[0];
    expect(ref).toEqual({ name: "leads" });
    expect(payload).toMatchObject({
      name: "Иван",
      phone: "+77012345678",
      hp: "",
      status: "new",
    });
    // createdAt/updatedAt — результат serverTimestamp() (время сервера).
    expect(payload.createdAt).toEqual({ type: "server-timestamp" });
    expect(payload.updatedAt).toEqual({ type: "server-timestamp" });
  });

  it("не пишет в Firestore при невалидном телефоне", async () => {
    await expect(
      createLead({ name: "Иван", phone: "bad-phone" }),
    ).rejects.toThrow(/Некорректный номер/);

    expect(mocks.addDoc).not.toHaveBeenCalled();
  });

  it("пробрасывает отказ Firestore (permission-denied) без маскировки", async () => {
    // QA (FB-QA): форма должна показать submitError, а не «успех».
    const denied = Object.assign(new Error("Missing or insufficient permissions."), {
      code: "permission-denied",
    });
    mocks.addDoc.mockRejectedValueOnce(denied);

    await expect(
      createLead({ name: "Иван", phone: "+7 (701) 234-56-78" }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("передаёт непустой hp как есть (honeypot: отказ даёт rules)", async () => {
    await createLead({
      name: "Иван",
      phone: "+7 (701) 234-56-78",
      hp: "spam-bot",
    });

    const [, payload] = mocks.addDoc.mock.calls[0];
    expect(payload.hp).toBe("spam-bot");
  });
});

describe("leads — getLeadsStream", () => {
  beforeEach(() => {
    mocks.onSnapshot.mockClear();
    mocks.query.mockClear();
    mocks.collection.mockClear();
    mocks.where.mockClear();
    mocks.orderBy.mockClear();
    mocks.limit.mockClear();
  });

  it("маппит доки в LeadItem (без hp, времена → Date|undefined) и возвращает отписку", () => {
    const unsubscribe = vi.fn();
    mocks.onSnapshot.mockImplementation(
      (_q: unknown, onNext: (s: unknown) => void) => {
        onNext({
          docs: [
            {
              id: "l1",
              data: () => ({
                name: "Иван",
                phone: "+77012345678",
                hp: "secret",
                status: "new",
                createdAt: new Date("2026-11-01T10:00:00Z"),
                updatedAt: new Date("2026-11-01T10:00:00Z"),
              }),
            },
            {
              id: "l2",
              data: () => ({
                name: "Аня",
                phone: "+77098765432",
                hp: "",
                status: "done",
                // serverTimestamp в момент незавершённой записи → null.
                createdAt: null,
                updatedAt: null,
              }),
            },
          ],
        });
        return unsubscribe;
      },
    );

    const cb = vi.fn();
    const unsub = getLeadsStream({}, cb);

    expect(unsub).toBe(unsubscribe);
    expect(cb).toHaveBeenCalledTimes(1);
    const leads = cb.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(leads).toHaveLength(2);
    expect(leads[0]).toEqual({
      id: "l1",
      name: "Иван",
      phone: "+77012345678",
      status: "new",
      createdAt: new Date("2026-11-01T10:00:00Z"),
      updatedAt: new Date("2026-11-01T10:00:00Z"),
    });
    expect(leads[0]).not.toHaveProperty("hp");
    expect(leads[1].createdAt).toBeUndefined();
    expect(leads[1].updatedAt).toBeUndefined();
  });

  it("без фильтра строит query без where (orderBy createdAt desc, limit 50)", () => {
    mocks.onSnapshot.mockImplementation((_q: unknown, onNext: (s: unknown) => void) => {
      onNext({ docs: [] });
      return () => {};
    });

    getLeadsStream({}, () => {});

    expect(mocks.where).not.toHaveBeenCalled();
    expect(mocks.orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(mocks.limit).toHaveBeenCalledWith(50);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("фильтр по статусу применяется на клиенте (без where в запросе)", () => {
    mocks.onSnapshot.mockImplementation((_q: unknown, onNext: (s: unknown) => void) => {
      onNext({
        docs: [
          {
            id: "l1",
            data: () => ({
              name: "A",
              phone: "+7 (700) 111-11-11",
              hp: "",
              status: "new",
              createdAt: new Date("2026-11-01T10:00:00Z"),
              updatedAt: new Date("2026-11-01T10:00:00Z"),
            }),
          },
          {
            id: "l2",
            data: () => ({
              name: "B",
              phone: "+7 (700) 222-22-22",
              hp: "",
              status: "in_progress",
              createdAt: new Date("2026-11-01T11:00:00Z"),
              updatedAt: new Date("2026-11-01T11:00:00Z"),
            }),
          },
        ],
      });
      return () => {};
    });

    const cb = vi.fn();
    getLeadsStream({ status: "in_progress" }, cb);

    expect(mocks.where).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
    const items = cb.mock.calls[0][0] as Array<{ id: string }>;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("l2");
  });

  it("пробрасывает ошибку подписки в onError", () => {
    const boom = new Error("unavailable");
    mocks.onSnapshot.mockImplementation(
      (_q: unknown, _onNext: unknown, onError: (e: unknown) => void) => {
        onError(boom);
        return () => {};
      },
    );

    const onError = vi.fn();
    getLeadsStream({}, () => {}, onError);

    expect(onError).toHaveBeenCalledWith(boom);
  });

  it("подставляет дефолты для отсутствующих полей (status=new, name/phone='')", () => {
    mocks.onSnapshot.mockImplementation((_q: unknown, onNext: (s: unknown) => void) => {
      onNext({ docs: [{ id: "l3", data: () => ({}) }] });
      return () => {};
    });

    const cb = vi.fn();
    getLeadsStream({}, cb);

    expect(cb.mock.calls[0][0]).toEqual([
      {
        id: "l3",
        name: "",
        phone: "",
        status: "new",
        createdAt: undefined,
        updatedAt: undefined,
      },
    ]);
  });

  it("принимает Timestamp-подобное значение (duck-typing toDate) и null", () => {
    // Как у SDK: toDate() вызывает this.toMillis() — вызов без привязки падает.
    const expected = new Date("2026-11-02T12:00:00Z");
    const ts = {
      toMillis() {
        return expected.getTime();
      },
      toDate() {
        return new Date(this.toMillis());
      },
    };
    mocks.onSnapshot.mockImplementation((_q: unknown, onNext: (s: unknown) => void) => {
      onNext({
        docs: [
          { id: "l4", data: () => ({ createdAt: ts, updatedAt: ts, status: "done" }) },
        ],
      });
      return () => {};
    });

    const cb = vi.fn();
    getLeadsStream({ status: "done" }, cb);

    expect(cb.mock.calls[0][0][0].createdAt).toEqual(new Date("2026-11-02T12:00:00Z"));
    expect(cb.mock.calls[0][0][0].updatedAt).toEqual(new Date("2026-11-02T12:00:00Z"));
  });
});

describe("leads — updateLeadStatus / deleteLead", () => {
  beforeEach(() => {
    mocks.doc.mockClear();
    mocks.updateDoc.mockClear();
    mocks.deleteDoc.mockClear();
    mocks.serverTimestamp.mockClear();
  });

  it("updateLeadStatus пишет ровно {status, updatedAt} (правила требуют эти ключи)", async () => {
    await updateLeadStatus("lead-1", "done");

    expect(mocks.doc).toHaveBeenCalledWith(expect.anything(), "leads", "lead-1");
    const [ref, payload] = mocks.updateDoc.mock.calls[0];
    expect(ref).toEqual({ name: "leads", id: "lead-1" });
    expect(Object.keys(payload)).toEqual(["status", "updatedAt"]);
    expect(payload.status).toBe("done");
    expect(payload.updatedAt).toEqual({ type: "server-timestamp" });
  });

  it("deleteLead удаляет документ по id", async () => {
    await deleteLead("lead-1");

    expect(mocks.doc).toHaveBeenCalledWith(expect.anything(), "leads", "lead-1");
    expect(mocks.deleteDoc).toHaveBeenCalledWith({ name: "leads", id: "lead-1" });
  });

  it("updateLeadStatus пробрасывает отказ rules (permission-denied)", async () => {
    mocks.updateDoc.mockRejectedValueOnce(
      Object.assign(new Error("Missing or insufficient permissions."), {
        code: "permission-denied",
      }),
    );

    await expect(updateLeadStatus("lead-1", "done")).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});

describe("leads — Telegram notify", () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it("после создания заявки шлёт POST с id uuid и полями заявки", async () => {
    vi.stubEnv("VITE_TG_NOTIFY_URL", "https://bot.example/notify");
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await createLead({ name: "Иван", phone: "+7 (701) 234-56-78" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://bot.example/notify");
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({ leadId: "lead-1", name: "Иван", phone: "+77012345678" });
      expect(body.id).toMatch(UUID_RE);
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });

  it("сбой notify не ломает createLead", async () => {
    vi.stubEnv("VITE_TG_NOTIFY_URL", "https://bot.example/notify");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));
    try {
      await expect(createLead({ name: "Иван", phone: "+7 (701) 234-56-78" })).resolves.toBe("lead-1");
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });
});

describe("leads — describeLeadsError", () => {
  it("permission-denied → «Нет доступа»", () => {
    expect(describeLeadsError({ code: "permission-denied" })).toMatch(/Нет доступа/);
  });

  it("failed-precondition / index → текст с кодом индекса", () => {
    expect(describeLeadsError({ code: "failed-precondition" })).toMatch(
      /составной индекс Firestore/,
    );
    expect(describeLeadsError(new Error("The query requires an index"))).toMatch(
      /составной индекс Firestore/,
    );
  });

  it("иначе — исходное сообщение", () => {
    expect(describeLeadsError(new Error("boom"))).toBe("boom");
  });
});
