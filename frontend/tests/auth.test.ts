import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NativeRequest = globalThis.Request;
class LocalRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(
      typeof input === "string" ? new URL(input, "http://localhost") : input,
      init,
    );
  }
}
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("Request", LocalRequest);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("in-memory auth and RTK Query refresh", () => {
  it("isolates Redux state between server requests", async () => {
    const { makeStore } = await import("../app/app/store");
    const { tokenReceived } = await import("../app/features/auth/authSlice");
    const a = makeStore();
    const b = makeStore();
    a.dispatch(tokenReceived("a"));
    expect(a.getState().auth.access).toBe("a");
    expect(b.getState().auth.access).toBeNull();
  });
  it("refreshes once for concurrent 401 responses and retries with the new access token", async () => {
    let refreshes = 0;
    let protectedCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const request =
          input instanceof NativeRequest ? input : new LocalRequest(input);
        const url = request.url;
        if (url.endsWith("auth/csrf/")) return json({ csrfToken: "csrf-test" });
        if (url.endsWith("auth/refresh/")) {
          refreshes++;
          await new Promise((resolve) => setTimeout(resolve, 30));
          return json({ access: "renewed" });
        }
        protectedCalls++;
        return request.headers.get("Authorization") === "Bearer renewed"
          ? json({ count: 0, next: null, results: [] })
          : json({ detail: "expired" }, 401);
      }),
    );
    const { makeStore } = await import("../app/app/store");
    const { api } = await import("../app/shared/api/client");
    const { tokenReceived } = await import("../app/features/auth/authSlice");
    const store = makeStore();
    store.dispatch(tokenReceived("old"));
    await Promise.all([
      store
        .dispatch(
          api.endpoints.inbox.initiate({
            page: 1,
            status: "",
            search: "first",
            ordering: "-created_at",
          }),
        )
        .unwrap(),
      store
        .dispatch(
          api.endpoints.inbox.initiate({
            page: 1,
            status: "",
            search: "second",
            ordering: "-created_at",
          }),
        )
        .unwrap(),
    ]);
    expect(refreshes).toBe(1);
    expect(protectedCalls).toBe(4);
    expect(store.getState().auth.access).toBe("renewed");
    store.dispatch(api.util.resetApiState());
  });
  it("ends an invalid refresh session and clears private cached data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const request =
          input instanceof NativeRequest ? input : new LocalRequest(input);
        return request.url.endsWith("auth/csrf/")
          ? json({ csrfToken: "csrf" })
          : json({ detail: "invalid" }, 401);
      }),
    );
    const { makeStore } = await import("../app/app/store");
    const { api, refreshSession } = await import("../app/shared/api/client");
    const { tokenReceived } = await import("../app/features/auth/authSlice");
    const store = makeStore();
    store.dispatch(tokenReceived("old"));
    await store.dispatch(
      api.util.upsertQueryData("me", undefined, {
        username: "owner",
        is_staff: true,
      }),
    );
    const result = await refreshSession(
      {
        dispatch: store.dispatch,
        getState: store.getState,
        signal: new AbortController().signal,
        abort: vi.fn(),
        extra: undefined,
        endpoint: "test",
        type: "query",
      },
      {},
    );
    expect(result).toBe(false);
    expect(store.getState().auth.status).toBe("anonymous");
    expect(store.getState().auth.access).toBeNull();
    expect(Object.keys(store.getState().api.queries)).toHaveLength(0);
  });
  it("preserves the session on an unavailable server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "temporarily unavailable" }, 503)),
    );
    const { makeStore } = await import("../app/app/store");
    const { refreshSession } = await import("../app/shared/api/client");
    const { tokenReceived } = await import("../app/features/auth/authSlice");
    const store = makeStore();
    store.dispatch(tokenReceived("existing"));
    await refreshSession(
      {
        dispatch: store.dispatch,
        getState: store.getState,
        signal: new AbortController().signal,
        abort: vi.fn(),
        extra: undefined,
        endpoint: "test",
        type: "query",
      },
      {},
    );
    expect(store.getState().auth.status).toBe("offline");
    expect(store.getState().auth.access).toBe("existing");
  });
  it("retries a protected request only once when it still returns 401", async () => {
    let refreshes = 0;
    let protectedCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: Request | string) => {
        const request =
          input instanceof NativeRequest ? input : new LocalRequest(input);
        if (request.url.endsWith("auth/csrf/"))
          return json({ csrfToken: "csrf" });
        if (request.url.endsWith("auth/refresh/")) {
          refreshes++;
          return json({ access: "new" });
        }
        protectedCalls++;
        return json({ detail: "expired" }, 401);
      }),
    );
    const { makeStore } = await import("../app/app/store");
    const { api } = await import("../app/shared/api/client");
    const store = makeStore();
    await store
      .dispatch(api.endpoints.me.initiate())
      .unwrap()
      .catch(() => null);
    expect(refreshes).toBe(1);
    expect(protectedCalls).toBe(2);
    store.dispatch(api.util.resetApiState());
  });
});
