import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ reset: vi.fn() }));
vi.mock("firebase/auth", () => ({ sendPasswordResetEmail: mocks.reset }));
vi.mock("@/lib/firebase", () => ({ auth: { currentUser: { email: "a@example.com", providerData: [{ providerId: "google.com" }] } } }));
import { SettingsPage } from "./SettingsPage";
import { ThemeProvider } from "@/lib/theme";
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
it("shows account/provider and saves/reset theme preference", () => {
  render(<ThemeProvider><SettingsPage /></ThemeProvider>);
  expect(screen.getByText(/a@example.com/)).toBeInTheDocument();
  expect(screen.getByText(/Способ входа: google.com/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Тема"), { target: { value: "dark" } });
  expect(localStorage.getItem("rasul-theme")).toBe("dark");
  fireEvent.change(screen.getByLabelText("Тема"), { target: { value: "system" } });
  expect(localStorage.getItem("rasul-theme")).toBeNull();
});
it("disables duplicate reset and truthfully reports requested email", async () => {
  let resolve!: () => void;
  mocks.reset.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
  render(<ThemeProvider><SettingsPage /></ThemeProvider>);
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button")).toBeDisabled();
  expect(mocks.reset).toHaveBeenCalledTimes(1);
  resolve(); expect(await screen.findByRole("status")).toHaveTextContent("Пароль здесь не изменён");
});
it("reports Firebase reset error", async () => {
  mocks.reset.mockRejectedValue(new Error("network"));
  render(<ThemeProvider><SettingsPage /></ThemeProvider>); fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось отправить");
});
