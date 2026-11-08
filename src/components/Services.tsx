import { useLocale } from "@/lib/i18n";

import { Container } from "./Container";
import { SectionHeading } from "./SectionHeading";
import { SectionNext } from "./SectionNext";

/** «Что я делаю»: текст-колонка + теги «Мои возможности» (#-префикс лайм). */
export function Services() {
  const { copy } = useLocale();

  return (
    <section id="services" className="scroll-mt-20 border-b border-border py-[76px]">
      <span id="expertise" className="block h-0" aria-hidden="true" />
      <Container>
        <SectionHeading heading={copy.services.heading} />

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
          <div className="space-y-4 text-[16px]">
            <p className="text-[19px] font-semibold leading-[1.5] text-text">
              {copy.services.intro}
            </p>
            <p className="text-muted">{copy.services.body}</p>
            <p className="text-muted">{copy.services.result}</p>
          </div>

          <div>
            <h3 className="text-display mb-1.5 text-xl font-semibold">
              {copy.services.capabilitiesTitle}
            </h3>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {copy.services.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium"
                >
                  <span className="text-accent" aria-hidden="true">
                    #{" "}
                  </span>
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>

        <SectionNext href="#cases" kind="toCases" />
      </Container>
    </section>
  );
}
