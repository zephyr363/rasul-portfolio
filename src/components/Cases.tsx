import { useState } from "react";
import { Globe, Send, Sparkles, ExternalLink } from "lucide-react";
import type { CaseItem, Lang } from "@/content/types";
import { getCaseLocale } from "@/lib/cases";
import { useLocale } from "@/lib/i18n";
// @ts-expect-error shared dependency-free contract
import { safeHttpsUrl } from "../../content/cases-contract.mjs";
import { Container } from "./Container";
import { SectionHeading } from "./SectionHeading";
import { SectionNext } from "./SectionNext";

const OPEN: Record<Lang, Record<CaseItem['type'], string>> = {
  ru: { website: 'Открыть сайт', bot: 'Открыть бота', ai: 'Открыть ИИ-проект' },
  kz: { website: 'Сайтты ашу', bot: 'Ботты ашу', ai: 'ЖИ жобасын ашу' },
  en: { website: 'Open website', bot: 'Open bot', ai: 'Open AI project' },
};
function Preview({ item }: { item: CaseItem }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const Icon = item.type === 'bot' ? Send : item.type === 'ai' ? Sparkles : Globe;
  const src = item.type === 'website' && safeHttpsUrl(item.previewImageUrl);
  return <div className="relative flex h-[150px] items-center justify-center overflow-hidden rounded-xl border border-border bg-bg" aria-busy={!!src && state === 'loading'}>
    <Icon className="size-10 text-muted" aria-hidden="true" />
    {src && state !== 'error' && <img src={src} alt="" loading="lazy" width={560} height={300} onLoad={() => setState('ready')} onError={() => setState('error')} className={`absolute inset-0 h-full w-full object-cover ${state === 'loading' ? 'opacity-0' : ''}`} />}
  </div>;
}
export function Cases({ cases }: { cases: readonly CaseItem[] }) {
  const { copy, lang } = useLocale();
  return <section id="cases" className="scroll-mt-20 border-b border-border py-[76px]">
    <span id="projects" aria-hidden="true" />
    <Container><SectionHeading heading={copy.cases.heading} />
      <div className="space-y-[18px]">{cases.map(item => {
        const loc = getCaseLocale(item, lang); const url = safeHttpsUrl(item.url);
        return <article key={item.id} className="grid items-center gap-7 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[280px_1fr]">
          <Preview key={`${item.id}-${item.previewImageUrl}`} item={item} />
          <div><h3 className="text-display mb-2 text-2xl font-semibold">{loc.title}</h3>
            <p className="text-[15px] text-muted">{loc.subtitle}</p>
            {url && <a className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm hover:bg-bg" href={url} target="_blank" rel="noopener noreferrer">{OPEN[lang][item.type]}<ExternalLink className="size-4" aria-hidden="true" /></a>}
          </div>
        </article>;
      })}</div><SectionNext href="#contact" kind="toContact" />
    </Container>
  </section>;
}
