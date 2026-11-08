import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { describeAuthState } from "@/admin/lib/auth";
import {
  deleteLead,
  describeLeadsError,
  getLeadsStream,
  updateLeadStatus,
  type LeadItem,
  type LeadStatus,
} from "@/data/leads";

/** Подписи статусов для бейджей/фильтров. */
const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Завершена",
  spam: "Спам",
};

/** Чипы фильтра: порядок и подписи (значение `all` = без фильтра). */
const FILTERS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "in_progress", label: "В работе" },
  { value: "done", label: "Завершены" },
  { value: "spam", label: "Спам" },
];

/** Опции выбора статуса в деталях заявки. */
const STATUS_OPTIONS: LeadStatus[] = ["new", "in_progress", "done", "spam"];

/** Цвет бейджа по статусу: new=акцент, in_progress=жёлтый, done=зелёный, spam=серый. */
const STATUS_BADGE: Record<LeadStatus, string> = {
  new: "bg-accent/15 text-accent",
  in_progress: "bg-yellow-500/15 text-yellow-400",
  done: "bg-green-500/15 text-green-400",
  spam: "bg-zinc-500/20 text-zinc-400",
};

/** `DD.MM.YYYY HH:MM` (или `—`, если времени нет — serverTimestamp не резолвился). */
function formatDateTime(date: Date | undefined): string {
  if (!date) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Цветной бейдж статуса. */
function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_BADGE[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; leads: LeadItem[] }
  | { status: "error"; message: string };

/** Пункты skeleton на время загрузки. */
function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" />
      ))}
    </div>
  );
}

/**
 * Раздел «Заявки» (FB-T7): стрим заявок из Firestore, фильтры-чипы по статусу,
 * таблица/карточки (адаптив ≤700px), Sheet с деталями, смена статуса и удаление.
 */
export function LeadsPage() {
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  // Детали (Sheet) по id, чтобы строка всегда отражала актуальный статус из стрима.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeadItem | null>(null);

  // Inline-ошибки записи (без потери выбранного значения — статус меняется
  // только после успешного апдейта через стрим).
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setLoad({ status: "loading" });
    const filters = filter === "all" ? {} : { status: filter };
    const unsubscribe = getLeadsStream(
      filters,
      (leads) => setLoad({ status: "ready", leads }),
      (err) => {
        void describeAuthState().then((state) => {
          setLoad({ status: "error", message: `${describeLeadsError(err)} [${state}]` });
        });
      },
    );
    return unsubscribe;
  }, [filter, reloadKey]);

  // Счётчики чипов «по текущей загрузке».
  const counts = useMemo(() => {
    if (load.status !== "ready") return null;
    const c: Record<LeadStatus, number> = { new: 0, in_progress: 0, done: 0, spam: 0 };
    for (const lead of load.leads) c[lead.status] += 1;
    return { all: load.leads.length, ...c };
  }, [load]);

  const selected =
    selectedId && load.status === "ready"
      ? (load.leads.find((l) => l.id === selectedId) ?? null)
      : null;

  function openLead(id: string) {
    setStatusError(null);
    setSelectedId(id);
  }

  async function handleStatusChange(next: LeadStatus) {
    if (!selected || selected.status === next) return;
    setSavingStatus(true);
    setStatusError(null);
    try {
      await updateLeadStatus(selected.id, next);
      // Обновлённый статус придёт через стрим — select отразит его автоматически.
    } catch (err) {
      setStatusError(`Не удалось изменить статус. ${describeLeadsError(err)}`);
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteLead(confirmDelete.id);
      if (selectedId === confirmDelete.id) setSelectedId(null);
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(`Не удалось удалить заявку. ${describeLeadsError(err)}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <h1 className="text-display text-2xl font-bold">Заявки</h1>
      <p className="mt-2 max-w-[560px] text-sm text-muted">
        Заявки из формы контакта на сайте. Нажмите на заявку, чтобы сменить статус
        или удалить её.
      </p>

      {/* Фильтры-чипы по статусу */}
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Фильтр заявок">
        {FILTERS.map(({ value, label }) => {
          const active = filter === value;
          const count = counts ? (value === "all" ? counts.all : counts[value]) : null;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-accent bg-accent font-medium text-accent-foreground"
                  : "border-border text-muted hover:border-accent/50 hover:text-text",
              )}
            >
              {label}
              {count != null && (
                <span className={cn("tabular-nums", active ? "opacity-70" : "text-muted")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {load.status === "loading" && (
          <div role="status" aria-label="Загрузка заявок">
            <SkeletonRows />
          </div>
        )}

        {load.status === "error" && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-6"
          >
            <p className="text-sm text-destructive">{load.message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Повторить
            </Button>
          </div>
        )}

        {load.status === "ready" && load.leads.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium">
              {filter === "all" ? "Заявок пока нет" : "Нет заявок с этим статусом"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {filter === "all"
                ? "Заявки появятся из формы на сайте."
                : "Выберите другой статус или вернитесь ко «Все»."}
            </p>
          </div>
        )}

        {load.status === "ready" && load.leads.length > 0 && (
          <>
            {/* Таблица — desktop (≥700px) */}
            <div className="hidden overflow-x-auto rounded-lg border border-border min-[700px]:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium">Дата</th>
                    <th className="px-4 py-2 font-medium">Имя</th>
                    <th className="px-4 py-2 font-medium">Телефон</th>
                    <th className="px-4 py-2 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {load.leads.map((lead) => (
                    <tr
                      key={lead.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Открыть заявку ${lead.name}`}
                      onClick={() => openLead(lead.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openLead(lead.id);
                        }
                      }}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-surface focus-visible:bg-surface focus-visible:outline-none"
                    >
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">
                        {formatDateTime(lead.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-medium">{lead.name}</td>
                      <td className="px-4 py-3 tabular-nums">{lead.phone}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Карточки — mobile (≤700px) */}
            <div className="flex flex-col gap-2 min-[700px]:hidden">
              {load.leads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => openLead(lead.id)}
                  className="rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-surface/70"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{lead.name}</span>
                    <StatusBadge status={lead.status} />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-sm text-muted">
                    <span className="tabular-nums">{lead.phone}</span>
                    <span className="tabular-nums">{formatDateTime(lead.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Детали заявки */}
      <Sheet
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-display">Заявка</SheetTitle>
                <SheetDescription>Детали, смена статуса и удаление заявки.</SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 px-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Имя</span>
                  <span className="text-sm font-medium">{selected.name}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Телефон</span>
                  <a
                    href={`tel:${selected.phone}`}
                    className="text-sm font-medium tabular-nums hover:underline"
                  >
                    {selected.phone}
                  </a>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Дата создания</span>
                  <span className="text-sm tabular-nums">{formatDateTime(selected.createdAt)}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Дата обновления</span>
                  <span className="text-sm tabular-nums">{formatDateTime(selected.updatedAt)}</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="lead-status" className="text-xs text-muted">
                    Статус
                  </label>
                  <select
                    id="lead-status"
                    aria-label="Статус заявки"
                    value={selected.status}
                    disabled={savingStatus}
                    onChange={(e) => void handleStatusChange(e.target.value as LeadStatus)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-text outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s} className="bg-surface text-text">
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  {savingStatus && (
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Сохраняем…
                    </span>
                  )}
                </div>

                {statusError && (
                  <p role="alert" className="text-sm text-destructive">
                    {statusError}
                  </p>
                )}
              </div>

              <SheetFooter>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmDelete(selected);
                  }}
                >
                  <Trash2 className="size-4" />
                  Удалить заявку
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Подтверждение удаления */}
      <Dialog
        open={confirmDelete != null}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить заявку?</DialogTitle>
            <DialogDescription>
              Заявка «{confirmDelete?.name}» будет удалена безвозвратно.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? "Удаляем…" : "Удалить навсегда"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
