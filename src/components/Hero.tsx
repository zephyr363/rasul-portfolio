import { useState } from "react";
import { useLocale } from "@/lib/i18n";

import { HERO_PHOTO_URL } from "@/lib/hero-photo";

import { Container } from "./Container";
import { SectionNext } from "./SectionNext";

/** Hero: H1 (простое приветствие) + фото с рамкой. */
export function Hero() {
  const { copy } = useLocale();
  const [loaded, setLoaded] = useState(false);

  return (
    <section className="border-b border-border py-16 sm:py-20 lg:py-[84px]">
      <Container>
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[7fr_5fr] lg:gap-14">
          <div>
            <h1 className="text-display text-[44px] font-bold leading-[1.05] sm:text-[68px]">
              {copy.hero.title}
            </h1>
            <div className="text-display mt-3.5 text-[22px] font-semibold text-text sm:text-[26px]">
              {copy.hero.sub}
            </div>
            <p className="mt-5 max-w-[540px] text-[17px] text-muted">{copy.hero.lead}</p>
          </div>

          <div className="relative aspect-[4/5] w-full max-w-[400px] justify-self-center lg:justify-self-end">
            <div
              className="absolute inset-[18px_-18px_-18px_18px] rounded-[22px] border-2 border-accent"
              aria-hidden="true"
            />
            <img
              key={copy.hero.photoUrl?.trim() || HERO_PHOTO_URL}
              src={copy.hero.photoUrl?.trim() || HERO_PHOTO_URL}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
              aria-busy={!loaded}
              alt={copy.hero.photoAlt}
              width={800}
              height={1000}
              className="relative aspect-[4/5] w-full max-w-[400px] rounded-[22px] border border-border object-cover object-[center_20%]"
            />
          </div>
        </div>

        <SectionNext href="#about" kind="toAbout" />
      </Container>
    </section>
  );
}
