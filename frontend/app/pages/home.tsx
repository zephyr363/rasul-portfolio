import { Link } from "react-router";
import {
  ArrowUpRight,
  ArrowRight,
  Braces,
  Workflow,
  Database,
  Check,
} from "lucide-react";
import type { Route } from "./+types/home";
import { serverApi } from "~/shared/api/server";
import type {
  Site,
  Experience,
  SkillGroup,
  Project,
  Service,
} from "~/shared/types";
import { seo, jsonLd } from "~/shared/lib/seo";
import { Career, Skills } from "~/widgets/career";
import { Button } from "~/shared/ui/button";

export async function loader() {
  const [site, experience, skills, projects, services] = await Promise.all([
    serverApi<Site>("site/"),
    serverApi<Experience[]>("experience/"),
    serverApi<SkillGroup[]>("skills/"),
    serverApi<Project[]>("projects/"),
    serverApi<Service[]>("services/"),
  ]);
  return { site, experience, skills, projects, services };
}
export const meta: Route.MetaFunction = ({ loaderData: data }) =>
  data
    ? seo(
        data.site,
        data.site.seo_title,
        data.site.seo_description,
        "/",
        data.site.portrait_main,
      )
    : [];
const icons = [Braces, Database, Workflow];
export default function Home({
  loaderData: { site, experience, skills, projects, services },
}: Route.ComponentProps) {
  return (
    <>
      <section className="landing-hero container" aria-labelledby="hero-title">
        <div className="hero-heading">
          <p className="eyebrow">
            <span className="gold-dot" /> {site.profession} · {site.city}
          </p>
          <h1 id="hero-title">
            {site.hero_title ===
            "Технологии, которые работают на ваш бизнес." ? (
              <>
                Технологии, которые
                <br />
                работают на <em>ваш бизнес.</em>
              </>
            ) : (
              site.hero_title
            )}
          </h1>
          <p className="hero-subtitle">
            Серверная разработка с вниманием к деталям.
            <br className="desktop-break" /> От вашей идеи — к понятному
            техническому решению.
          </p>
        </div>
        <div className="hero-editorial">
          <div className="hero-story">
            <p className="eyebrow">РАЗРАБОТЧИК. ПАРТНЁР ПО ЗАДАЧЕ.</p>
            <h2>
              Приятно познакомиться.
              <br />Я {site.name.split(" ")[0]}
              <span className="gold-period">.</span>
            </h2>
            <p className="hero-proposition">{site.hero_copy}</p>
            <div className="hero-actions">
              <Button asChild>
                <Link to="/contact">
                  Обсудить проект <ArrowUpRight size={17} />
                </Link>
              </Button>
              <a href="#services" className="quiet-link">
                Чем могу помочь <ArrowRight size={16} />
              </a>
            </div>
            <div className="hero-signature">
              <span className="signature-name">{site.name}</span>
              <span>Python &amp; Java Developer</span>
            </div>
          </div>
          <figure className="hero-figure">
            <div className="portrait-mat">
              <div className="portrait-crop">
                {site.portrait_main && (
                  <img
                    src={site.portrait_main}
                    alt={site.portrait_alt}
                    width="1363"
                    height="2048"
                    fetchPriority="high"
                  />
                )}
              </div>
              <span className="portrait-corner" aria-hidden="true" />
            </div>
            <figcaption>
              <span>{site.name}</span>
              <span>Личный подход к вашей задаче</span>
            </figcaption>
          </figure>
        </div>
        <div className="hero-bottom-note">
          <span>СОЗДАЮ ТО, ЧТО РАБОТАЕТ ЗА ИНТЕРФЕЙСОМ</span>
          <a href="#services" aria-label="Перейти к направлениям работы">
            Листайте дальше <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <section className="section service-section" id="services">
        <div className="container">
          <div className="section-label">
            <span /> <p className="eyebrow">ЧЕМ МОГУ ПОМОЧЬ</p> <span />
          </div>
          <div className="section-heading centered">
            <h2>
              Ваша задача.
              <br />
              <em>Моя техническая экспертиза.</em>
            </h2>
            <p>
              Подключаюсь там, где продукту нужна надёжная серверная основа
              <br className="desktop-break" /> и разработчик, который вникает в
              контекст.
            </p>
          </div>
          <div className="service-grid">
            {services.map((service, i) => {
              const Icon = icons[i % icons.length];
              return (
                <article className="service-card" key={service.id}>
                  <div className="service-card-top">
                    <Icon size={25} strokeWidth={1.2} />
                    <span className="eyebrow">0{i + 1}</span>
                  </div>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <div className="service-tech">
                    {service.technologies.split(",").map((t) => (
                      <span key={t}>{t.trim()}</span>
                    ))}
                  </div>
                  <Link
                    className="service-link"
                    to="/contact"
                    aria-label={`Обсудить: ${service.title}`}
                  >
                    Обсудить задачу <ArrowUpRight size={16} />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section approach-section container" id="approach">
        <div className="approach-grid">
          <div className="approach-portrait">
            <figure>
              {site.portrait_detail && (
                <img
                  src={site.portrait_detail}
                  alt={`Портрет: ${site.name}`}
                  width="1424"
                  height="2048"
                  loading="lazy"
                />
              )}
              <figcaption>ЗА КАЖДЫМ РЕШЕНИЕМ — ЧЕЛОВЕК</figcaption>
            </figure>
          </div>
          <div className="approach-copy">
            <p className="eyebrow">О ПОДХОДЕ</p>
            <h2>
              Не просто код.
              <br />
              <em>Внимание к сути.</em>
            </h2>
            <p>
              Хорошая разработка начинается с понимания того, что нужно людям и
              бизнесу. Мне важно разобраться в задаче, обсудить ограничения и
              предложить решение, которое можно развивать дальше.
            </p>
            <ul className="approach-principles">
              <li>
                <Check size={16} />
                <span>Понятная коммуникация и внимание к контексту</span>
              </li>
              <li>
                <Check size={16} />
                <span>Поддерживаемый код и продуманная работа с данными</span>
              </li>
              <li>
                <Check size={16} />
                <span>
                  Тестирование, ревью и аккуратная работа с изменениями
                </span>
              </li>
            </ul>
            <Link to="/about" className="text-link">
              Узнать обо мне больше <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section experience-section" id="experience">
        <div className="container">
          <div className="section-label">
            <span />
            <p className="eyebrow">ПРОФЕССИОНАЛЬНЫЙ ПУТЬ</p>
            <span />
          </div>
          <div className="section-heading centered">
            <h2>
              Опыт, на который
              <br />
              <em>можно опереться.</em>
            </h2>
            <p>
              Разработка серверных приложений, автоматизация
              <br className="desktop-break" /> и работа с IT-инфраструктурой.
            </p>
          </div>
          <Career items={experience} />
          <div className="section-bottom-link">
            <Link to="/experience" className="text-link">
              Подробнее об опыте и технологиях <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section technology-section container">
        <div className="section-heading split">
          <div>
            <p className="eyebrow">ИНСТРУМЕНТЫ В РАБОТЕ</p>
            <h2>
              Правильный инструмент
              <br />
              <em>для каждой задачи.</em>
            </h2>
          </div>
          <p>
            Выбор технологий следует за задачей.
            <br />
            Мой основной стек — Python и Java.
          </p>
        </div>
        <Skills groups={skills} />
      </section>

      {projects.length > 0 && (
        <section className="section container">
          <div className="section-heading split">
            <div>
              <p className="eyebrow">ИЗБРАННЫЕ ПРОЕКТЫ</p>
              <h2>
                От замысла <em>к реализации.</em>
              </h2>
            </div>
            <Link to="/projects" className="text-link">
              Все проекты <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="project-grid">
            {projects.slice(0, 3).map((p) => (
              <Link
                key={p.slug}
                to={`/projects/${p.slug}`}
                className="project-card"
              >
                <span className="eyebrow">{p.stack}</span>
                <h3>
                  {p.title}
                  <ArrowUpRight size={22} />
                </h3>
                <p>{p.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section contact-banner">
        <div className="container">
          <div className="section-label">
            <span />
            <p className="eyebrow">СЛЕДУЮЩАЯ ГЛАВА</p>
            <span />
          </div>
          <h2>
            Обсудим, что я могу
            <br />
            <em>сделать для вас?</em>
          </h2>
          <p>
            Расскажите о проекте, задаче или предложении о работе.
            <br />
            Начнём с простого разговора.
          </p>
          <Button asChild>
            <Link to="/contact">
              Написать мне <ArrowUpRight size={17} />
            </Link>
          </Button>
          {site.email && (
            <a className="contact-email" href={`mailto:${site.email}`}>
              {site.email}
            </a>
          )}
          <div className="contact-meta">
            <span>{site.city}</span>
            <span>{site.work_format}</span>
          </div>
        </div>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              { "@type": "WebSite", name: site.seo_title, url: site.site_url },
              {
                "@type": "Person",
                name: site.name,
                jobTitle: site.profession,
                description: site.intro,
                homeLocation: { "@type": "Place", name: site.city },
                knowsAbout: skills.flatMap((s) =>
                  s.skills.split(",").map((v) => v.trim()),
                ),
              },
            ],
          }),
        }}
      />
    </>
  );
}
