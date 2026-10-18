import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import type { Route } from "./+types/projects";
import { serverApi } from "~/shared/api/server";
import type { Site, Project } from "~/shared/types";
import { seo } from "~/shared/lib/seo";
export async function loader() {
  const [site, projects] = await Promise.all([
    serverApi<Site>("site/"),
    serverApi<Project[]>("projects/"),
  ]);
  return { site, projects };
}
export const meta: Route.MetaFunction = ({ loaderData: data }) =>
  data
    ? seo(
        data.site,
        "Проекты",
        "Задачи, технологии и решения в проектах backend-разработчика.",
        "/projects",
      )
    : [];
export default function Projects({
  loaderData: { projects },
}: Route.ComponentProps) {
  return (
    <section className="section page-section">
      <p className="eyebrow">ОТ ЗАДАЧИ К РЕШЕНИЮ</p>
      <div className="page-title-row">
        <h1>
          Проекты<span className="muted">.</span>
        </h1>
        <p>Контекст, подход и результат.</p>
      </div>
      {projects.length ? (
        <div className="project-grid">
          {projects.map((p) => (
            <Link
              to={`/projects/${p.slug}`}
              className="project-card"
              key={p.slug}
            >
              {p.cover && (
                <img
                  src={p.cover}
                  alt={p.title}
                  width="800"
                  height="500"
                  loading="lazy"
                />
              )}
              <span className="eyebrow">{p.stack}</span>
              <h2>
                {p.title}
                <ArrowUpRight size={22} />
              </h2>
              <p>{p.summary}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="projects-empty">
          <span className="eyebrow">СКОРО ЗДЕСЬ</span>
          <h2>
            У каждой системы
            <br />
            есть своя история.
          </h2>
          <p>
            Подробные описания проектов пока не опубликованы. С моими задачами и
            технологиями можно познакомиться в разделе опыта работы.
          </p>
          <Link to="/experience" className="text-link">
            Посмотреть опыт ↗
          </Link>
        </div>
      )}
    </section>
  );
}
