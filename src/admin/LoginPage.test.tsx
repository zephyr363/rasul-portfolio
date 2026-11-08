import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN_EMAIL = "rasulakhmetov2004@gmail.com";

// Мок auth-слоя: LoginPage обращается только к нему; реального Firebase нет.
const mocks = vi.hoisted(() => ({
  signInGoogle: vi.fn(),
  sendEmailLink: vi.fn(() => Promise.resolve()),
  completeEmailLinkIfPresent: vi.fn(() => Promise.resolve(null)),
  onAuthChanged: vi.fn<(cb: (user: unknown | null) => void) => () => void>(() => () => {}),
  isAdminUser: vi.fn(),
  signOutUser: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/admin/lib/auth", () => ({
  ADMIN_EMAIL: "rasulakhmetov2004@gmail.com",
  signInGoogle: mocks.signInGoogle,
  sendEmailLink: mocks.sendEmailLink,
  completeEmailLinkIfPresent: mocks.completeEmailLinkIfPresent,
  onAuthChanged: mocks.onAuthChanged,
  isAdminUser: mocks.isAdminUser,
  signOutUser: mocks.signOutUser,
}));

import { LoginPage } from "./LoginPage";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/admin/login"]}>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/leads" element={<div>ADMIN_LEADS</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.completeEmailLinkIfPresent.mockResolvedValue(null);
    mocks.onAuthChanged.mockReturnValue(() => {});
    mocks.signInGoogle.mockResolvedValue({ email: ADMIN_EMAIL });
    mocks.isAdminUser.mockReturnValue(true);
  });

  it("рендерит кнопку Google и поле email", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: "Войти через Google" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
  });

  it("клик «Войти через Google» вызывает signInGoogle", async () => {
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: "Войти через Google" }));

    expect(mocks.signInGoogle).toHaveBeenCalledTimes(1);
    // Владелец → редирект в админку.
    await screen.findByText("ADMIN_LEADS");
  });

  it("отправка email вызывает sendEmailLink и показывает подтверждение", async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: ADMIN_EMAIL },
    });
    fireEvent.click(screen.getByRole("button", { name: "Получить ссылку для входа" }));

    expect(mocks.sendEmailLink).toHaveBeenCalledWith(ADMIN_EMAIL);
    await screen.findByText(/Ссылка для входа отправлена на почту/);
  });

  it("любой email → UID проверяется gate, а не формой входа", async () => {
    mocks.signInGoogle.mockResolvedValue({ email: "stranger@gmail.com" });
    mocks.isAdminUser.mockReturnValue(false);

    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Войти через Google" }));

    await screen.findByText("ADMIN_LEADS");
    expect(mocks.signOutUser).not.toHaveBeenCalled();
  });

  it("auth/unauthorized-domain → понятная ошибка", async () => {
    mocks.signInGoogle.mockRejectedValue({ code: "auth/unauthorized-domain" });

    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Войти через Google" }));

    await screen.findByText(/Authorized domains/);
  });

  it("auth/invalid-email → понятная ошибка", async () => {
    mocks.sendEmailLink.mockRejectedValue({ code: "auth/invalid-email" });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Получить ссылку для входа" }));

    await screen.findByText(/Некорректный email/);
  });

  it("auth/popup-blocked → понятная ошибка", async () => {
    mocks.signInGoogle.mockRejectedValue({ code: "auth/popup-blocked" });

    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Войти через Google" }));

    await screen.findByText(/заблокировано браузером/);
  });
});
