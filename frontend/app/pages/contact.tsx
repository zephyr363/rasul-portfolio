import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, Check } from "lucide-react";
import type { Route } from "./+types/contact";
import type { Site } from "~/shared/types";
import { serverApi } from "~/shared/api/server";
import { seo } from "~/shared/lib/seo";
import { useContactMutation } from "~/shared/api/client";
import { Button } from "~/shared/ui/button";
const schema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(120),
  email: z.email("Проверьте email"),
  project_type: z.string().min(1, "Выберите тип проекта").max(80),
  message: z
    .string()
    .trim()
    .min(20, "Минимум 20 символов")
    .max(4000, "Максимум 4000 символов"),
  consent: z.boolean().refine(Boolean, "Необходимо согласие"),
});
export async function loader() {
  return { site: await serverApi<Site>("site/") };
}
export const meta: Route.MetaFunction = ({ loaderData: data }) =>
  data
    ? seo(
        data.site,
        "Обсудить проект",
        "Свяжитесь с backend-разработчиком: расскажите о проекте, задаче или предложении о работе.",
        "/contact",
      )
    : [];
export default function Contact({
  loaderData: { site },
}: Route.ComponentProps) {
  const [send, { isLoading }] = useContactMutation();
  const [success, setSuccess] = useState(false);
  const [failure, setFailure] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { consent: false },
  });
  const submit = handleSubmit(async (data) => {
    setFailure("");
    try {
      await send(data).unwrap();
      setSuccess(true);
    } catch (e) {
      const error = e as { status?: number; data?: Record<string, string[]> };
      if (error.status === 400 && error.data) {
        for (const [key, value] of Object.entries(error.data))
          if (key in data)
            setError(key as keyof typeof data, {
              message: Array.isArray(value) ? value.join(" ") : String(value),
            });
      }
      setFailure(
        error.status === 429
          ? "Слишком много заявок. Попробуйте позже."
          : "Не удалось отправить заявку. Проверьте соединение и попробуйте снова.",
      );
    }
  });
  return (
    <section className="section page-section">
      <p className="eyebrow">НАЧНЁМ С РАЗГОВОРА</p>
      <div className="page-title-row">
        <h1>
          Ваша идея.
          <br />
          <em>Следующее решение.</em>
        </h1>
      </div>
      <div className="contact-layout">
        <div className="contact-info">
          <h2>
            Давайте создадим
            <br />
            что-то интересное.
          </h2>
          <p>
            Расскажите о задаче, проекте или вакансии. Укажите стек, сроки и
            формат сотрудничества — так будет проще обсудить детали.
          </p>
          {site.email && (
            <a href={`mailto:${site.email}`} className="text-link">
              {site.email}
              <ArrowUpRight size={18} />
            </a>
          )}
          {site.phone && (
            <a
              className="text-link"
              href={`tel:${site.phone.replace(/[^+\d]/g, "")}`}
            >
              {site.phone}
              <ArrowUpRight size={18} />
            </a>
          )}
          {site.instagram && (
            <a
              href={site.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Социальная сеть ↗
            </a>
          )}
          <div className="contact-small">
            <p>Backend-разработка и REST API</p>
            <p>Автоматизация и интеграции</p>
            <p>Полная, частичная и проектная занятость</p>
          </div>
          {site.demo_mode && (
            <p className="demo-note">
              Сайт в режиме предпросмотра. Заявки сохраняются в базе,
              email-уведомления не отправляются.
            </p>
          )}
        </div>
        {success ? (
          <div className="success-box" role="status">
            <Check size={36} />
            <h2>Идея уже в пути.</h2>
            <p>Заявка сохранена. Спасибо, что рассказали о проекте.</p>
            <Button variant="outline" onClick={() => setSuccess(false)}>
              Отправить ещё одну
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="contact-form">
            <div className="form-row">
              <label>
                Ваше имя
                <input
                  {...register("name")}
                  aria-label="Ваше имя"
                  autoComplete="name"
                  placeholder="Как к вам обращаться"
                  aria-invalid={!!errors.name}
                  aria-describedby="name-error"
                />
                <span id="name-error" className="field-error">
                  {errors.name?.message}
                </span>
              </label>
              <label>
                Email
                <input
                  {...register("email")}
                  aria-label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={!!errors.email}
                  aria-describedby="email-error"
                />
                <span id="email-error" className="field-error">
                  {errors.email?.message}
                </span>
              </label>
            </div>
            <label>
              Тип проекта
              <select
                {...register("project_type")}
                aria-label="Тип проекта"
                aria-invalid={!!errors.project_type}
                aria-describedby="type-error"
              >
                <option value="">Выберите формат</option>
                <option>Backend-разработка</option>
                <option>REST API и интеграции</option>
                <option>Автоматизация</option>
                <option>Предложение о работе</option>
                <option>Другое</option>
              </select>
              <span id="type-error" className="field-error">
                {errors.project_type?.message}
              </span>
            </label>
            <label>
              Несколько слов об идее
              <textarea
                {...register("message")}
                aria-label="Несколько слов об идее"
                rows={5}
                placeholder="Задача, стек, сроки, формат работы — всё, что уже известно"
                aria-invalid={!!errors.message}
                aria-describedby="message-error"
              />
              <span id="message-error" className="field-error">
                {errors.message?.message}
              </span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                {...register("consent")}
                aria-describedby="consent-error"
              />
              <span>
                Согласен на обработку данных для ответа на заявку.{" "}
                <Link to="/privacy">Условия конфиденциальности</Link>
              </span>
            </label>
            <span id="consent-error" className="field-error">
              {errors.consent?.message}
            </span>
            {failure && (
              <p role="alert" className="field-error">
                {failure}
              </p>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Отправляем…" : "Отправить заявку"}
              <ArrowUpRight size={18} />
            </Button>
            <p className="form-footnote">
              Детали проекта доступны только владельцу портфолио.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
