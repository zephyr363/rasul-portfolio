import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeadItem, LeadStatus } from "@/data/leads";

const mocks = vi.hoisted(() => ({
  getLeadsStream: vi.fn(),
  updateLeadStatus: vi.fn(),
  deleteLead: vi.fn(),
  describeLeadsError: vi.fn(),
  describeAuthState: vi.fn(),
}));

vi.mock("@/data/leads", () => ({
  getLeadsStream: mocks.getLeadsStream,
  updateLeadStatus: mocks.updateLeadStatus,
  deleteLead: mocks.deleteLead,
  describeLeadsError: mocks.describeLeadsError,
}));

vi.mock("@/admin/lib/auth", () => ({
  describeAuthState: mocks.describeAuthState,
}));

import { LeadsPage } from "./LeadsPage";

/** Честная копия describeLeadsError для мока (permission-denied → «Нет доступа»). */
function describeLeadsErrorImpl(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  const msg = err instanceof Error ? err.message : String(err);
  if (code === "permission-denied") return "Нет доступа: войдите под аккаунтом владельца.";
  return msg;
}

/** Диагностика auth-состояния (мок): строка из claims id-token, как её отдаёт auth.ts. */
const AUTH_STATE_DIAG =
  "email=rasulakhmetov2004@gmail.com · claims.email=rasulakhmetov2004@gmail.com · verified=true · provider=google.com · uid=abcdef12";

function makeLead(id: string, name: string, status: LeadStatus): LeadItem {
  return {
    id,
    name,
    phone: "+77012345678",
    status,
    // Локальное время (без Z) — формат DD.MM.YYYY HH:MM не зависит от часового пояса CI.
    createdAt: new Date(2026, 10, 1, 10, 0, 0),
    updatedAt: new Date(2026, 10, 1, 10, 0, 0),
  };
}

const DEFAULT_LEADS: LeadItem[] = [
  makeLead("l1", "Иван", "new"),
  makeLead("l2", "Аня", "done"),
];

/** getLeadsStream по умолчанию синхронно отдаёт список (как первый onSnapshot). */
function emit(leads: LeadItem[] = DEFAULT_LEADS) {
  mocks.getLeadsStream.mockImplementation((_filters, cb) => {
    cb(leads);
    return () => {};
  });
}

describe("LeadsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateLeadStatus.mockResolvedValue(undefined);
    mocks.deleteLead.mockResolvedValue(undefined);
    mocks.describeLeadsError.mockImplementation(describeLeadsErrorImpl);
    mocks.describeAuthState.mockResolvedValue(AUTH_STATE_DIAG);
    emit();
  });

  it("показывает заголовок и чипы-фильтры", () => {
    render(<LeadsPage />);

    expect(screen.getByRole("heading", { name: "Заявки" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Все/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Новые/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Спам/ })).toBeInTheDocument();
  });

  it("фильтр меняет запрос: getLeadsStream вызывается с новым фильтром", () => {
    render(<LeadsPage />);

    expect(mocks.getLeadsStream).toHaveBeenCalledWith(
      {},
      expect.any(Function),
      expect.any(Function),
    );

    fireEvent.click(screen.getByRole("button", { name: /В работе/ }));

    expect(mocks.getLeadsStream).toHaveBeenLastCalledWith(
      { status: "in_progress" },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("показывает skeleton при загрузке", () => {
    mocks.getLeadsStream.mockReturnValue(() => {}); // не вызывает cb — состояние loading

    render(<LeadsPage />);

    expect(screen.getByRole("status", { name: "Загрузка заявок" })).toBeInTheDocument();
    expect(screen.queryByText("Заявок пока нет")).toBeNull();
  });

  it("пусто (Все) → «Заявок пока нет»", () => {
    emit([]);

    render(<LeadsPage />);

    expect(screen.getByText("Заявок пока нет")).toBeInTheDocument();
    expect(screen.getByText("Заявки появятся из формы на сайте.")).toBeInTheDocument();
  });

  it("пусто после фильтра → «Нет заявок с этим статусом»", () => {
    emit([]);

    render(<LeadsPage />);
    fireEvent.click(screen.getByRole("button", { name: /В работе/ }));

    expect(screen.getByText("Нет заявок с этим статусом")).toBeInTheDocument();
  });

  it("ошибка → текст + диагностика + «Повторить» (переподписка)", async () => {
    mocks.getLeadsStream.mockImplementation((_filters, _cb, onError) => {
      onError?.({ code: "permission-denied" });
      return () => {};
    });

    render(<LeadsPage />);

    // Диагностика ставится асинхронно (после describeAuthState) — ждём появления alert.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Нет доступа/);
    expect(alert).toHaveTextContent(/claims\.email/);
    expect(mocks.describeAuthState).toHaveBeenCalledTimes(1);
    expect(mocks.getLeadsStream).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(mocks.getLeadsStream).toHaveBeenCalledTimes(2);
  });

  it("клик по строке открывает Sheet с деталями заявки", async () => {
    render(<LeadsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть заявку Иван" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // Детали доступны в Sheet (телефон дублируется в таблице — проверяем внутри dialog).
    expect(dialog.textContent).toContain("Иван");
    expect(dialog.textContent).toContain("+77012345678");
    expect(dialog.textContent).toContain("01.11.2026 10:00");
  });

  it("смена статуса в Sheet вызывает updateLeadStatus", async () => {
    render(<LeadsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть заявку Иван" }));
    const select = await screen.findByRole("combobox", { name: "Статус заявки" });

    fireEvent.change(select, { target: { value: "in_progress" } });

    await waitFor(() => {
      expect(mocks.updateLeadStatus).toHaveBeenCalledWith("l1", "in_progress");
    });
  });

  it("удаление требует подтверждения и вызывает deleteLead", async () => {
    render(<LeadsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть заявку Иван" }));

    // Открывает диалог подтверждения, но ещё не удаляет.
    fireEvent.click(await screen.findByRole("button", { name: "Удалить заявку" }));
    expect(mocks.deleteLead).not.toHaveBeenCalled();

    // Подтверждение.
    fireEvent.click(await screen.findByRole("button", { name: "Удалить навсегда" }));

    await waitFor(() => {
      expect(mocks.deleteLead).toHaveBeenCalledWith("l1");
    });
  });

  it("ошибка смены статуса показывается inline", async () => {
    mocks.updateLeadStatus.mockRejectedValue({ code: "permission-denied" });

    render(<LeadsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть заявку Иван" }));
    const select = await screen.findByRole("combobox", { name: "Статус заявки" });

    fireEvent.change(select, { target: { value: "spam" } });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Нет доступа/);
    });
  });
});
