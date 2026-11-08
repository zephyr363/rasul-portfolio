import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ doc: vi.fn((...args) => args), snapshot: vi.fn(), stop: vi.fn() }));
vi.mock("@/lib/firebase", () => ({ db: "db" }));
vi.mock("firebase/firestore", () => ({ doc: mocks.doc, onSnapshot: mocks.snapshot }));
import { subscribeAdminAccess } from "./access";
beforeEach(() => { vi.clearAllMocks(); mocks.snapshot.mockReturnValue(mocks.stop); });
it("subscribes own UID and forwards cancellation/errors", () => {
  const next = vi.fn(), error = vi.fn();
  const stop = subscribeAdminAccess("own-uid", next, error);
  expect(mocks.doc).toHaveBeenCalledWith("db", "adminAccess", "own-uid");
  expect(mocks.snapshot.mock.calls[0][2]).toBe(error); expect(stop).toBe(mocks.stop);
});
it("requires existing role admin and boolean enabled true, including revocation", () => {
  const next = vi.fn(); subscribeAdminAccess("uid", next, vi.fn());
  const emit = mocks.snapshot.mock.calls[0][1];
  for (const data of [undefined, { role: "admin", enabled: false }, { role: "reader", enabled: true }, { role: "admin", enabled: "true" }]) {
    emit({ exists: () => !!data, data: () => data }); expect(next).toHaveBeenLastCalledWith(false);
  }
  emit({ exists: () => true, data: () => ({ role: "admin", enabled: true }) }); expect(next).toHaveBeenLastCalledWith(true);
  emit({ exists: () => false, data: () => undefined }); expect(next).toHaveBeenLastCalledWith(false);
});
