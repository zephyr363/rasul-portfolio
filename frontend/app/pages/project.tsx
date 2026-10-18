import { Link } from "react-router";
import type { Route } from "./+types/project";
import { serverApi } from "~/shared/api/server";
import type { Site, Project } from "~/shared/types";
import { seo } from "~/shared/lib/seo";
export async function loader({ params }: Route.LoaderArgs) {
  const [site, project] = await Promise.all([
    serverApi<Site>("site/"),
    serverApi<Project>(`projects/${encodeURIComponent(params.slug!)}/`),
  ]);
  return { site, project };
}
export const meta: Route.MetaFunction = ({ loaderData: data }) =>
  data
    ? seo(
        data.site,
        data.project.title,
        data.project.summary,
        `/projects/${data.project.slug}`,
        data.project.cover,
      )
    : [];
export default function ProjectPage({
  loaderData: { project },
}: Route.ComponentProps) {
  return (
    <article className="section page-section">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link to="/">Главная</Link>
        <span>/</span>
        <Link to="/projects">Проекты</Link>
        <span>/</span>
        <span>{project.title}</span>
      </nav>
      <p className="eyebrow">{project.stack}</p>
      <div className="page-title-row">
        <h1>{project.title}</h1>
        <p>{project.summary}</p>
      </div>
      {project.cover && (
        <img
          className="project-cover"
          src={project.cover}
          alt={project.title}
          width="1400"
          height="800"
        />
      )}
      <div className="project-description">
        {project.description
          .split("\n")
          .filter(Boolean)
          .map((text, i) => (
            <p key={i}>{text}</p>
          ))}
      </div>
      <div className="project-links">
        {project.url && (
          <a
            className="text-link"
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Сайт проекта ↗
          </a>
        )}
        {project.repository && (
          <a
            className="text-link"
            href={project.repository}
            target="_blank"
            rel="noopener noreferrer"
          >
            Исходный код ↗
          </a>
        )}
      </div>
      <Link className="text-link" to="/projects">
        ← Все проекты
      </Link>
    </article>
  );
}
