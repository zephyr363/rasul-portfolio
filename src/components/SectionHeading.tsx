import { cn } from "@/lib/utils";

/**
 * Шапка секции: дисплейный h2 с приглушённой второй частью.
 * `heading` — единая строка вида «Кейсы — Примеры в работе.». Первый делитель
 * « — » разбивает её на обычную первую часть (включая дефис) и приглушённую (dim)
 * вторую. Без делителя весь текст рендерится обычным цветом.
 */
export function SectionHeading({
  heading,
  className,
}: {
  heading: string;
  className?: string;
}) {
  const divider = " — ";
  const idx = heading.indexOf(divider);
  const hasAccent = idx !== -1;
  const lead = hasAccent ? heading.slice(0, idx + divider.length) : heading;
  const accent = hasAccent ? heading.slice(idx + divider.length) : "";

  return (
    <div className={cn("mb-9", className)}>
      <h2 className="text-display text-4xl font-bold sm:text-[44px]">
        {lead}
        {hasAccent && <span className="text-dim">{accent}</span>}
      </h2>
    </div>
  );
}
