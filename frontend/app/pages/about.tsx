import { Link } from "react-router";
import type { Route } from "./+types/about";
import { serverApi } from "~/shared/api/server";
import type { Site } from "~/shared/types";
import { seo } from "~/shared/lib/seo";
export async function loader() {
  return { site: await serverApi<Site>("site/") };
}
export const meta: Route.MetaFunction = ({ loaderData: data }) =>
  data
    ? seo(
        data.site,
        "Обо мне",
        data.site.intro,
        "/about",
        data.site.portrait_detail,
      )
    : [];
export default function About({ loaderData: { site } }: Route.ComponentProps) {
  return (
    <section className="section page-section container">
      <p className="eyebrow">ЧЕЛОВЕК ЗА РЕШЕНИЕМ</p>
      <div className="page-title-row">
        <h1>
          Давайте <em>знакомиться.</em>
        </h1>
        <span>{site.city}</span>
      </div>
      <div className="about-page-grid">
        <div className="about-photo">
          {site.portrait_detail && (
            <img
              src={site.portrait_detail}
              alt={site.portrait_alt}
              width="1424"
              height="2048"
            />
          )}
          <span className="photo-signature">{site.name}</span>
        </div>
        <div className="about-copy">
          <p className="eyebrow">{site.profession}</p>
          <h2>{site.name}</h2>
          <p className="large-copy">{site.intro}</p>
          <p>{site.biography}</p>
          <div className="about-detail">
            <h3>Образование</h3>
            <p>{site.education}</p>
          </div>
          <div className="about-detail">
            <h3>Языки</h3>
            <p>{site.languages}</p>
          </div>
          <div className="about-detail">
            <h3>Формат работы</h3>
            <p>{site.work_format}</p>
          </div>
          <Link to="/contact" className="text-link">
            Обсудить сотрудничество ↗
          </Link>
        </div>
      </div>
    </section>
  );
}
