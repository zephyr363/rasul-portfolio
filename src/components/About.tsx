import { useLocale } from "@/lib/i18n";

import { Container } from "./Container";
import { SectionHeading } from "./SectionHeading";
import { SectionNext } from "./SectionNext";

/** «Кто я» + таймлайн опыта (#experience внутри секции #about). */
export function About() {
  const { copy } = useLocale();

  return (
    <section id="about" className="scroll-mt-20 border-b border-border py-[76px]">
      <Container>
        <SectionHeading heading={copy.about.heading} />

        <div className={copy.experience.items.length ? "grid grid-cols-1 gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12" : "grid grid-cols-1 gap-12"}>
          <div className="space-y-4 text-[16px]">
            <p className="text-[19px] font-semibold leading-[1.5] text-text">
              {copy.about.lead}
            </p>
            <p className="text-muted">{copy.about.body}</p>
          </div>

          {copy.experience.items.length > 0 && <div id="experience" className="scroll-mt-20 border-l-2 border-border pl-7">
            <h3 className="text-display mb-5 text-xl font-semibold">{copy.nav.links[3]}</h3>
            <ol className="space-y-8">
              {copy.experience.items.map((item, index) => (
                <li key={index} className="relative">
                  <span
                    className="absolute -left-[35px] top-1.5 h-[13px] w-[13px] rounded-full bg-accent"
                    aria-hidden="true"
                  />
                  <div className="text-mono-label text-xs text-accent">{item.date}</div>
                  <div className="text-display mt-1.5 text-xl font-semibold">{item.org}</div>
                  <p className="mt-1.5 text-[15px] text-muted">{item.role}</p>
                </li>
              ))}
            </ol>
          </div>}
        </div>

        <SectionNext href="#services" kind="toServices" />
      </Container>
    </section>
  );
}
