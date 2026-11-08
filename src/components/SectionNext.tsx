import type { Lang } from "@/content/types";
import { useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Строки переходов «дальше» (совпадают с шаблоном content/locales.json). */
interface NextCopy {
  toAbout: string;
  toServices: string;
  toCases: string;
  toContact: string;
}

/**
 * Дефолтные тексты переходов. Используются как фолбэк для документов без блока
 * `next` (старые документы Firestore) — переходы показываются сразу, без
 * миграции данных. Источник — единый, чтобы не дублировать строки в компонентах.
 */
const NEXT_FALLBACK: Record<Lang, NextCopy> = {
  ru: {
    toAbout: "Кто я и чем помогу вам ↓",
    toServices: "Что я могу сделать для вашего бизнеса ↓",
    toCases: "Как это работает на деле ↓",
    toContact: "Обсудим вашу задачу ↓",
  },
  kz: {
    toAbout: "Мен кіммін, сізге қалай көмектесемін ↓",
    toServices: "Сіздің бизнесіңіз үшін не істей аламын ↓",
    toCases: "Іс жүзінде қалай жұмыс істейді ↓",
    toContact: "Міндетіңізді талқылайық ↓",
  },
  en: {
    toAbout: "Who I am and how I can help ↓",
    toServices: "What I can do for your business ↓",
    toCases: "How it works in practice ↓",
    toContact: "Let's discuss your task ↓",
  },
};

export type NextKey = keyof NextCopy;

/**
 * Переход-строка в конце секции: якорная ссылка к следующей секции (↓ уже входит
 * в строку). Текст берётся из `copy.next[kind]`, при его отсутствии — из
 * `NEXT_FALLBACK` для активной локали. Стилизована как деликатный «дальше»-линк
 * с верхним разделителем, не дублирует CTA-кнопки.
 */
export function SectionNext({
  href,
  kind,
  className,
}: {
  href: string;
  kind: NextKey;
  className?: string;
}) {
  const { copy, lang } = useLocale();
  const label = copy.next?.[kind] ?? NEXT_FALLBACK[lang][kind];

  return (
    <div className={cn("mt-14 border-t border-border pt-7", className)}>
      <a
        href={href}
        className="group inline-flex items-center gap-2 text-[15px] font-semibold text-text transition-colors hover:text-accent"
      >
        {label}
      </a>
    </div>
  );
}
