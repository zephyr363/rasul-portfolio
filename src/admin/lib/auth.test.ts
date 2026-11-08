import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const authMock: { currentUser: unknown } = { currentUser: null };
  return {
    authMock,
    initializeApp: vi.fn(() => ({ name: "[DEFAULT]" })),
    getFirestore: vi.fn(() => ({})),
    getAuth: vi.fn(() => authMock),
    setPersistence: vi.fn(() => Promise.resolve()),
    getRedirectResult: vi.fn(() => Promise.resolve(null)),
    getIdTokenResult: vi.fn(),
    GoogleAuthProvider: vi.fn(function () {
      return { providerId: "google.com" };
    }),
    isSignInWithEmailLink: vi.fn(() => false),
    onAuthStateChanged: vi.fn(() => () => {}),
    sendSignInLinkToEmail: vi.fn(
      (_auth: unknown, _email: string, _settings: unknown) => Promise.resolve(),
    ),
    signInWithEmailLink: vi.fn(() => Promise.resolve({ user: { email: "x@y.z" } })),
    signInWithPopup: vi.fn(() => Promise.resolve({ user: { email: "x@y.z" } })),
    signInWithRedirect: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("firebase/app", () => ({ initializeApp: mocks.initializeApp }));
vi.mock("firebase/firestore", () => ({ getFirestore: mocks.getFirestore }));
vi.mock("firebase/auth", () => ({
  getAuth: mocks.getAuth,
  setPersistence: mocks.setPersistence,
  browserLocalPersistence: "LOCAL",
  getRedirectResult: mocks.getRedirectResult,
  getIdTokenResult: mocks.getIdTokenResult,
  GoogleAuthProvider: mocks.GoogleAuthProvider,
  isSignInWithEmailLink: mocks.isSignInWithEmailLink,
  onAuthStateChanged: mocks.onAuthStateChanged,
  sendSignInLinkToEmail: mocks.sendSignInLinkToEmail,
  signInWithEmailLink: mocks.signInWithEmailLink,
  signInWithPopup: mocks.signInWithPopup,
  signInWithRedirect: mocks.signInWithRedirect,
  signOut: mocks.signOut,
}));

import {
  completeEmailLinkIfPresent,
  describeAuthState,
  sendEmailLink,
  signInGoogle,
  signOutUser,
} from "./auth";
const ADMIN_EMAIL = "test@example.com";

describe("admin/lib/auth", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.stubEnv("BASE_URL", "/");
    localStorage.clear();
    vi.clearAllMocks();
    mocks.authMock.currentUser = null;
    mocks.getRedirectResult.mockResolvedValue(null);
    mocks.isSignInWithEmailLink.mockReturnValue(false);
    mocks.signInWithPopup.mockResolvedValue({ user: { email: ADMIN_EMAIL } });
  });

  describe("sendEmailLink", () => {
    it("preserves the production project base in the email continue URL", async () => {
      vi.stubEnv("BASE_URL", "/rasul-portfolio/");
      await sendEmailLink(ADMIN_EMAIL);
      expect(mocks.sendSignInLinkToEmail).toHaveBeenCalledWith(mocks.authMock, ADMIN_EMAIL, {
        url: `${window.location.origin}/rasul-portfolio/admin/login`,
        handleCodeInApp: true,
      });
    });
    it("вызывает SDK с actionCodeSettings (url /admin/login, handleCodeInApp) и сохраняет email", async () => {
      const email = "rasulakhmetov2004@gmail.com";
      await sendEmailLink(email);

      expect(mocks.sendSignInLinkToEmail).toHaveBeenCalledTimes(1);
      const [authArg, emailArg, settings] = mocks.sendSignInLinkToEmail.mock.calls[0];
      expect(authArg).toBe(mocks.authMock);
      expect(emailArg).toBe(email);
      expect(settings).toEqual({
        url: `${window.location.origin}/admin/login`,
        handleCodeInApp: true,
      });
      expect(localStorage.getItem("adminEmailForSignIn")).toBe(email);
    });
  });

  describe("signInGoogle", () => {
    it("popup-успех возвращает пользователя", async () => {
      const user = { email: ADMIN_EMAIL };
      mocks.signInWithPopup.mockResolvedValue({ user });

      await expect(signInGoogle()).resolves.toEqual(user);
      expect(mocks.signInWithRedirect).not.toHaveBeenCalled();
    });

    it("ошибка popup пробрасывается (redirect не используется)", async () => {
      mocks.signInWithPopup.mockRejectedValue(new Error("popup blocked"));

      await expect(signInGoogle()).rejects.toThrow("popup blocked");
      expect(mocks.getRedirectResult).not.toHaveBeenCalled();
      expect(mocks.signInWithRedirect).not.toHaveBeenCalled();
    });
  });

  describe("completeEmailLinkIfPresent", () => {
    it("возвращает null, когда ссылка не email-link", async () => {
      mocks.isSignInWithEmailLink.mockReturnValue(false);
      await expect(completeEmailLinkIfPresent()).resolves.toBeNull();
      expect(mocks.signInWithEmailLink).not.toHaveBeenCalled();
    });

    it("завершает passwordless-вход по сохранённому email", async () => {
      mocks.isSignInWithEmailLink.mockReturnValue(true);
      localStorage.setItem("adminEmailForSignIn", "rasulakhmetov2004@gmail.com");
      mocks.signInWithEmailLink.mockResolvedValue({ user: { email: ADMIN_EMAIL } });

      await expect(completeEmailLinkIfPresent()).resolves.toEqual({ email: ADMIN_EMAIL });
      expect(localStorage.getItem("adminEmailForSignIn")).toBeNull();
    });
  });

  describe("signOutUser", () => {
    it("вызывает SDK signOut", async () => {
      await signOutUser();
      expect(mocks.signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe("describeAuthState", () => {
    it("currentUser null → «сессия отсутствует» (без обращения к token)", async () => {
      mocks.authMock.currentUser = null;

      await expect(describeAuthState()).resolves.toBe("сессия отсутствует");
      expect(mocks.getIdTokenResult).not.toHaveBeenCalled();
    });

    it("формирует строку из claims id-token (то, что видит rules)", async () => {
      const user = { email: "rasulakhmetov2004@gmail.com", uid: "abcdef1234567890" };
      mocks.authMock.currentUser = user;
      mocks.getIdTokenResult.mockResolvedValue({
        claims: {
          email: "rasulakhmetov2004@gmail.com",
          email_verified: true,
          firebase: { sign_in_provider: "google.com" },
        },
      });

      await expect(describeAuthState()).resolves.toBe(
        "email=rasulakhmetov2004@gmail.com · claims.email=rasulakhmetov2004@gmail.com · verified=true · provider=google.com · uid=abcdef12",
      );
      expect(mocks.getIdTokenResult).toHaveBeenCalledWith(user);
    });

    it("claims.email отличается от профиля (регистр/алиас) → явная подсказка", async () => {
      const user = { email: "RasulAkhmetov2004@gmail.com", uid: "abcdef1234567890" };
      mocks.authMock.currentUser = user;
      mocks.getIdTokenResult.mockResolvedValue({
        claims: {
          email: "rasulakhmetov2004@gmail.com",
          email_verified: true,
          firebase: { sign_in_provider: "google.com" },
        },
      });

      const state = await describeAuthState();
      expect(state).toContain("email в токене отличается от профиля");
      expect(state).toContain("claims.email=rasulakhmetov2004@gmail.com");
    });

    it("claims.email отсутствует → «нет» и без подсказки", async () => {
      const user = { email: "rasulakhmetov2004@gmail.com", uid: "abcdef1234567890" };
      mocks.authMock.currentUser = user;
      mocks.getIdTokenResult.mockResolvedValue({
        claims: { email_verified: false },
      });

      const state = await describeAuthState();
      expect(state).toContain("claims.email=нет");
      expect(state).toContain("verified=false");
      expect(state).not.toContain("отличается от профиля");
    });
  });
});
