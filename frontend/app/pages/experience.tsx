import type { Route } from "./+types/experience";
import { loader as homeLoader } from "./home";
import { Career, Skills } from "~/widgets/career";
import { seo } from "~/shared/lib/seo";
export const loader = homeLoader;
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
