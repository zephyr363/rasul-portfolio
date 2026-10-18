import { useEffect, useState } from "react";
import { useStore } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  api,
  refreshSession,
  useLoginMutation,
  useLogoutMutation,
  useInboxQuery,
  announceLogout,
} from "~/shared/api/client";
import { useAppDispatch, useAppSelector, type AppStore } from "~/app/store";
import { tokenReceived, signedOut } from "~/features/auth/authSlice";
import { Button } from "~/shared/ui/button";
export const meta = () => [
  { title: "Кабинет — Portfolio" },
  { name: "robots", content: "noindex, nofollow" },
];
const schema = z.object({
  username: z.string().min(1, "Укажите логин"),
  password: z.string().min(1, "Укажите пароль"),
});
export default function Studio() {
  const dispatch = useAppDispatch();
  const store = useStore() as AppStore;
  const status = useAppSelector((s) => s.auth.status);
  const [login, { isLoading }] = useLoginMutation();
  const [logout] = useLogoutMutation();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const bootstrap = () =>
    void refreshSession(
      {
        dispatch: store.dispatch,
        getState: store.getState,
        signal: new AbortController().signal,
        abort() {},
        extra: undefined,
        endpoint: "bootstrap",
        type: "query",
      },
      {},
    );
  useEffect(() => {
    bootstrap();
    const channel = new BroadcastChannel("portfolio-session");
    channel.onmessage = (e) => {
      if (e.data === "logout") {
        dispatch(signedOut());
        dispatch(api.util.resetApiState());
      }
    };
    return () => channel.close();
  }, []);
  async function signOut() {
    setError("");
    try {
      await logout().unwrap();
      dispatch(signedOut());
      dispatch(api.util.resetApiState());
      announceLogout();
    } catch {
      setError(
        "Не удалось завершить серверную сессию. Повторите выход после восстановления соединения.",
      );
    }
  }
  return (
    <section className="section page-section studio">
      <p className="eyebrow">PRIVATE / STUDIO</p>
      <div className="page-title-row">
        <h1>
          Кабинет<span className="muted">.</span>
        </h1>
        {status === "authenticated" && (
          <Button variant="outline" onClick={signOut}>
            Выйти
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {status === "loading" ? (
        <p role="status">Восстанавливаем сессию…</p>
      ) : status === "offline" ? (
        <div>
          <p>
            Не удалось связаться с сервером. Состояние сессии будет проверено
            после повторного подключения.
          </p>
          <Button onClick={bootstrap}>Повторить</Button>
        </div>
      ) : status === "authenticated" ? (
        <>
          <p>
            Управление контентом:{" "}
            <a className="text-link" href="/admin/">
              Django Admin ↗
            </a>
          </p>
          <Inbox />
        </>
      ) : (
        <form
          className="login-form contact-form"
          onSubmit={handleSubmit(async (data) => {
            setError("");
            try {
              const result = await login(data).unwrap();
              dispatch(tokenReceived(result.access));
            } catch {
              setError(
                "Не удалось войти. Проверьте логин, пароль и соединение.",
              );
            }
          })}
        >
          <p>Вход для владельца портфолио.</p>
          <label>
            Логин
            <input {...register("username")} autoComplete="username" />
            <span className="field-error">{errors.username?.message}</span>
          </label>
          <label>
            Пароль
            <input
              {...register("password")}
              type="password"
              autoComplete="current-password"
            />
            <span className="field-error">{errors.password?.message}</span>
          </label>
          <Button disabled={isLoading}>
            {isLoading ? "Входим…" : "Войти"}
          </Button>
        </form>
      )}
    </section>
  );
}
function Inbox() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const { data, isFetching, error, refetch } = useInboxQuery({
    page,
    status,
    search,
    ordering,
  });
  return (
    <div className="inbox">
      <h2>Входящие заявки</h2>
      <div className="inbox-filters">
        <input
          aria-label="Поиск заявок"
          placeholder="Поиск по имени, email, сообщению"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Статус заявки"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          <option value="new">Новые</option>
          <option value="read">Прочитанные</option>
          <option value="closed">Закрытые</option>
        </select>
        <select
          aria-label="Порядок заявок"
          value={ordering}
          onChange={(e) => setOrdering(e.target.value)}
        >
          <option value="-created_at">Сначала новые</option>
          <option value="created_at">Сначала старые</option>
        </select>
      </div>
      {isFetching && <p role="status">Загрузка…</p>}
      {error ? (
        <div role="alert">
          Не удалось загрузить заявки.{" "}
          <Button onClick={() => refetch()}>Повторить</Button>
        </div>
      ) : (
        <>
          {data?.results.length === 0 && (
            <p className="empty-state">Заявок пока нет.</p>
          )}
          {data?.results.map((item) => (
            <article className="inquiry" key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <a href={`mailto:${item.email}`}>{item.email}</a>
              </div>
              <p className="eyebrow">
                {item.project_type} · {item.status} ·{" "}
                {new Date(item.created_at).toLocaleDateString("ru-RU", {
                  timeZone: "Asia/Qyzylorda",
                })}
              </p>
              <p className="inquiry-message">{item.message}</p>
            </article>
          ))}
          <div className="pagination">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Назад
            </Button>
            <span>
              Страница {page} · Всего: {data?.count ?? 0}
            </span>
            <Button
              variant="outline"
              disabled={!data?.next}
              onClick={() => setPage(page + 1)}
            >
              Далее
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
