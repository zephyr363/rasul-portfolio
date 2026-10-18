import type { Route } from "./+types/privacy";
import { loader } from "./contact";
import { seo } from "~/shared/lib/seo";
export { loader };
export const meta: Route.MetaFunction = ({ loaderData: data }) =>
  data
    ? seo(
        data.site,
        "Конфиденциальность",
        "Информация о данных, передаваемых через форму заявки.",
        "/privacy",
      )
    : [];
export default function Privacy({
  loaderData: { site },
}: Route.ComponentProps) {
  return (
    <article className="section page-section prose">
      <p className="eyebrow">ДАННЫЕ И КОНФИДЕНЦИАЛЬНОСТЬ</p>
      <h1>О вашей заявке.</h1>
      <h2>Какие данные сохраняются</h2>
      <p>
        Форма сохраняет имя, email, тип проекта, текст сообщения, отметку
        согласия и дату отправки. Эти данные доступны авторизованному владельцу
        портфолио для рассмотрения предложения и ответа.
      </p>
      <h2>Cookies и внешние сервисы</h2>
      <p>
        Используются технические cookies для защиты формы и авторизации
        владельца. Сторонняя аналитика и рекламные трекеры не подключены.
      </p>
      <h2>Обращения по поводу данных</h2>
      {site.email ? (
        <p>
          Для запроса об удалении вашей заявки напишите на{" "}
          <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      ) : (
        <p>Контакт владельца для запросов об удалении данных пока не указан.</p>
      )}
      {site.demo_mode && (
        <aside className="demo-note">
          Тестовая конфигурация. До публичного запуска владелец должен указать
          свои реквизиты, контакт для обращений и срок хранения заявок, а также
          утвердить условия обработки данных.
        </aside>
      )}
    </article>
  );
}
