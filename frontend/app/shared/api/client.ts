import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import {
  tokenReceived,
  signedOut,
  networkUnavailable,
} from "~/features/auth/authSlice";
import type { Inquiry, InquiryInput } from "~/shared/types";

type AuthState = { auth: { access: string | null } };
const raw = fetchBaseQuery({
  baseUrl: "/api/v1/",
  credentials: "same-origin",
  timeout: 15000,
  prepareHeaders(headers, { getState }) {
    const token = (getState() as AuthState).auth.access;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});
const csrf = async () => {
  const response = await fetch("/api/v1/auth/csrf/", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("CSRF unavailable");
  return ((await response.json()) as { csrfToken: string }).csrfToken;
};
const isNetwork = (error: FetchBaseQueryError) =>
  error.status === "FETCH_ERROR" ||
  error.status === "TIMEOUT_ERROR" ||
  (typeof error.status === "number" && error.status >= 500);
export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Inbox"],
  endpoints: (builder) => ({
    contact: builder.mutation<Inquiry, InquiryInput>({
      query: (body) => ({ url: "contact/", method: "POST", body }),
      invalidatesTags: ["Inbox"],
    }),
    login: builder.mutation<
      { access: string },
      { username: string; password: string }
    >({ query: (body) => ({ url: "auth/login/", method: "POST", body }) }),
    logout: builder.mutation<void, void>({
      query: () => ({ url: "auth/logout/", method: "POST" }),
    }),
    me: builder.query<{ username: string; is_staff: boolean }, void>({
      query: () => "auth/me/",
    }),
    inbox: builder.query<
      { count: number; next: string | null; results: Inquiry[] },
      { page: number; status: string; search: string; ordering: string }
    >({
      query: (params) => ({ url: "inbox/", params }),
      providesTags: ["Inbox"],
    }),
  }),
});

let refreshing: Promise<boolean> | null = null;
export async function refreshSession(
  queryApi: Parameters<BaseQueryFn>[1],
  extra: object,
): Promise<boolean> {
  if (!refreshing) {
    const execute = async () => {
      try {
        const result = await raw(
          {
            url: "auth/refresh/",
            method: "POST",
            headers: { "X-CSRFToken": await csrf() },
          },
          queryApi,
          extra,
        );
        if (result.data) {
          queryApi.dispatch(
            tokenReceived((result.data as { access: string }).access),
          );
          return true;
        }
        if (result.error && isNetwork(result.error)) {
          queryApi.dispatch(networkUnavailable());
          return false;
        }
        queryApi.dispatch(signedOut());
        queryApi.dispatch(api.util.resetApiState());
        return false;
      } catch {
        queryApi.dispatch(networkUnavailable());
        return false;
      }
    };
    // Browser Web Locks serialize refresh across tabs; the API also accepts a 5-second rotation grace.
    refreshing = (async () => {
      if (typeof navigator !== "undefined" && navigator.locks)
        return await navigator.locks.request("portfolio-refresh", execute);
      return await execute();
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing!;
}
async function baseQueryWithReauth(
  args: string | FetchArgs,
  queryApi: Parameters<BaseQueryFn>[1],
  extra: object,
) {
  let request = typeof args === "string" ? { url: args } : args;
  if (request.method && request.method !== "GET") {
    try {
      request = {
        ...request,
        headers: { ...request.headers, "X-CSRFToken": await csrf() },
      };
    } catch {
      return {
        error: {
          status: "FETCH_ERROR" as const,
          error: "Нет соединения с сервером",
        },
      };
    }
  }
  let result = await raw(request, queryApi, extra);
  if (
    result.error?.status === 401 &&
    !["auth/login/", "auth/refresh/", "auth/logout/", "auth/csrf/"].includes(
      request.url,
    ) &&
    (await refreshSession(queryApi, extra))
  )
    result = await raw(request, queryApi, extra);
  return result;
}
export const {
  useContactMutation,
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useInboxQuery,
} = api;
export function announceLogout() {
  const channel = new BroadcastChannel("portfolio-session");
  channel.postMessage("logout");
  channel.close();
}
