import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), access: vi.fn(), stop: vi.fn(), signOutUser: vi.fn(),
}));
vi.mock("@/admin/lib/auth", () => ({ onAuthChanged: mocks.auth, signOutUser: mocks.signOutUser }));
vi.mock("@/admin/lib/access", () => ({ subscribeAdminAccess: mocks.access }));
vi.mock("./AdminLayout", () => ({ AdminLayout: () => <div>ADMIN</div> }));
import { AdminGate } from "./AdminGate";
let emitAuth: (user: unknown) => void;
let emitAccess: (allowed: boolean) => void;
let emitError: () => void;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockImplementation((next) => { emitAuth = next; return mocks.stop; });
  mocks.access.mockImplementation((_uid, next, error) => { emitAccess = next; emitError = error; return mocks.stop; });
});
function mount() { return render(<MemoryRouter initialEntries={["/admin"]}><Routes>
  <Route path="/admin" element={<AdminGate />} /><Route path="/admin/login" element={<div>LOGIN</div>} />
</Routes></MemoryRouter>); }
it("waits for auth and redirects anonymous", () => {
  mount(); expect(screen.getByRole("status")).toHaveTextContent("Проверка");
  act(() => emitAuth(null)); expect(screen.getByText("LOGIN")).toBeInTheDocument();
});
it("waits for own UID grant, allows any email, and handles revocation", () => {
  mount(); act(() => emitAuth({ uid: "uid", email: "any@example.com" }));
  expect(mocks.access).toHaveBeenCalledWith("uid", expect.any(Function), expect.any(Function));
  expect(screen.queryByText("ADMIN")).toBeNull();
  act(() => emitAccess(true)); expect(screen.getByText("ADMIN")).toBeInTheDocument();
  expect(mocks.auth).toHaveBeenCalledTimes(1);
  expect(mocks.access).toHaveBeenCalledTimes(1);
  act(() => emitAccess(false)); expect(screen.queryByText("ADMIN")).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("отозван");
});
it("reports subscription error and retries; unsubscribes on unmount", () => {
  const view = mount(); act(() => emitAuth({ uid: "uid" })); act(() => emitError());
  expect(screen.getByRole("alert")).toHaveTextContent("Не удалось");
  expect(screen.getByRole("alert")).toHaveTextContent("отсутствие прав администратора не подтверждено");
  expect(screen.queryByLabelText("UID текущего пользователя")).toBeNull();
  expect(screen.queryByText("ADMIN")).toBeNull();
  expect(screen.queryByText(/adminAccess\//)).toBeNull();
  fireEvent.click(screen.getByText("Повторить")); expect(mocks.auth).toHaveBeenCalledTimes(2);
  view.unmount(); expect(mocks.stop).toHaveBeenCalled();
});
it("shows selectable authenticated UID and exact typed bootstrap instructions only when denied", () => {
  mount(); act(() => emitAuth({ uid: "actual-user-123" })); act(() => emitAccess(false));
  const uid = screen.getByRole("textbox", { name: "UID текущего пользователя" });
  expect(uid).toHaveValue("actual-user-123");
  expect(uid).toHaveAttribute("readonly");
  fireEvent.focus(uid);
  expect((uid as HTMLInputElement).selectionStart).toBe(0);
  expect((uid as HTMLInputElement).selectionEnd).toBe("actual-user-123".length);
  expect(screen.getByText("adminAccess/actual-user-123")).toBeInTheDocument();
  expect(screen.getByText("role").parentElement).toHaveTextContent("тип string, значение admin");
  expect(screen.getByText("enabled").parentElement).toHaveTextContent("тип boolean, значение true (не строка)");
  expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
  expect(mocks.signOutUser).toHaveBeenCalledTimes(1);
});
it("ignores stale grant after account switch", () => {
  mount(); act(() => emitAuth({ uid: "first" })); const stale = emitAccess;
  act(() => emitAuth({ uid: "second" })); act(() => stale(true));
  expect(screen.queryByText("ADMIN")).toBeNull();
});
