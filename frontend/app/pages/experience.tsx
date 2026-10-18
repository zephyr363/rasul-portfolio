import type { Route } from "./+types/experience";
import { serverApi } from "~/shared/api/server";
import type { Experience, Site, SkillGroup } from "~/shared/types";
import { Career, Skills } from "~/widgets/career";
import { seo } from "~/shared/lib/seo";
export async function loader() {
  const [site, experience, skills] = await Promise.all([
    serverApi<Site>("site/"),
    serverApi<Experience[]>("experience/"),
    serverApi<SkillGroup[]>("skills/"),
  ]);
  return { site, experience, skills };
}
export const meta: Route.MetaFunction = ({ loaderData: data }) =>
  data
    ? seo(
        data.site,
        "Опыт и стек",
        "Опыт backend-разработки, работа с Java и Python, автоматизация процессов и IT-инфраструктура.",
        "/experience",
      )
    : [];
export default function ExperiencePage({
  loaderData: { experience, skills },
}: Route.ComponentProps) {
  return (
    <>
      <section className="section page-section">
        <p className="eyebrow">ПРОФЕССИОНАЛЬНЫЙ ПУТЬ</p>
        <div className="page-title-row">
          <h1>
            Опыт &amp; стек<span className="muted">.</span>
          </h1>
          <p>
            Разработка серверной части,
            <br />
            автоматизация и работа с командой.
          </p>
        </div>
        <Career items={experience} />
      </section>
      <section className="section container skills-section">
        <div className="section-heading">
          <h2>Технологии в работе.</h2>
        </div>
        <Skills groups={skills} />
      </section>
    </>
  );
}
