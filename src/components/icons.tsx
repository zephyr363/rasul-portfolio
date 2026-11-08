/**
 * Собственные inline SVG-иконки платформ (без новых зависимостей).
 * Логотипы-заменители нарисованы штрихом по `currentColor`, поэтому наследуют
 * цвет текста ссылки. Все иконки — декоративные (`aria-hidden`): доступное имя
 * кнопки задаёт текст платформы рядом.
 */

type IconProps = {
  className?: string;
};

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Telegram: бумажный самолётик. */
export function TelegramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

/** WhatsApp: телефонная трубка в круге. */
export function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
      <circle cx="12" cy="12" r="8.7" />
      <path d="M9.2 8.2c.6-.7 1.5-.6 2 .2l.5.9c.5.9.2 2-.6 2.6-.3.3-.4.7-.2 1.1a8.6 8.6 0 0 0 3 3c.4.2.8.1 1.1-.2.6-.8 1.7-1.1 2.6-.6l.9.5c.8.4 1 1.3.2 2l-.3.3c-.8.9-2.2 1-3.5.4a11 11 0 0 1-6.9-6.9c-.6-1.3-.5-2.7.3-3.5l.3-.3Z" />
    </svg>
  );
}

/** Email: конверт. */
export function EmailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

/** Стрелка «наружу» для кнопок-платформ. */
export function ArrowIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}
