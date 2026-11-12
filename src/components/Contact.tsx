import { useRef, useState, type FormEvent } from "react";

import { createLead } from "@/data/leads";
import { buildContactUrls } from "@/lib/contact";
import { useLocale } from "@/lib/i18n";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Container } from "./Container";
import { SectionHeading } from "./SectionHeading";
import { ArrowIcon, EmailIcon, TelegramIcon, WhatsAppIcon } from "./icons";

/** Длина национального номера без кода страны. */
const PHONE_DIGITS = 10;

type SubmitStatus = "idle" | "sending" | "success" | "error";

/**
 * Цифры национального номера. Код страны из ввода отбрасывается:
 * из готовой маски («+7 …») и из вставленного полного номера (7…/8…, 11 цифр).
 */
function nationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (/^\s*\+7/.test(raw)) digits = digits.slice(1);
  else if (digits.length > PHONE_DIGITS && (digits[0] === "7" || digits[0] === "8")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, PHONE_DIGITS);
}

/** Маска `+7 (999) 999-99-99` из национальных цифр; `+7` подставляется сама. */
function formatPhone(national: string): string {
  if (!national) return "";
  let out = "+7 (" + national.slice(0, 3);
  if (national.length >= 3) out += ")";
  if (national.length >= 4) out += " " + national.slice(3, 6);
  if (national.length >= 7) out += "-" + national.slice(6, 8);
  if (national.length >= 9) out += "-" + national.slice(8, 10);
  return out;
}

/** Позиция в маске после N-й цифры (0 — начало строки). */
function caretAfterDigits(mask: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (/\d/.test(mask[i]) && (seen += 1) === digitCount) return i + 1;
  }
  return mask.length;
}

/** Маска + позиция каретки: без восстановления курсор прыгает в конец. */
function maskPhone(raw: string, caret: number): { value: string; caret: number } {
  const hasPrefix = /^\s*\+7/.test(raw);
  const national = nationalDigits(raw);
  const value = formatPhone(national);
  const before = raw.slice(0, caret).replace(/\D/g, "");
  const count = Math.min((hasPrefix ? before.slice(1) : before).length, national.length);
  // +1 — цифра кода страны, она уже есть в маске.
  return { value, caret: caretAfterDigits(value, count + 1) };
}

const PLATFORM_LINK =
  "group flex items-center gap-3.5 rounded-[12px] border border-border bg-surface px-4 py-3.5 text-[15px] font-semibold text-text transition-colors hover:border-accent hover:text-accent";
const PLATFORM_ICON =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-bg text-accent";
const ARROW_CLASS =
  "size-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5";

/** Контакты: invite + кнопки-платформы (иконка + название + стрелка) + brief-форма. */
export function Contact() {
  const { copy } = useLocale();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const hpRef = useRef<HTMLInputElement | null>(null);

  const urls = buildContactUrls({});
  const { form } = copy.contact;

  /** Изменение полей сбрасывает итог (успех/ошибка) — новый сабмит разрешён. */
  const resetOutcome = () => {
    if (status !== "idle") setStatus("idle");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;

    const next: { name?: string; phone?: string } = {};
    if (!name.trim()) next.name = form.nameError;
    if (phone.replace(/\D/g, "").length !== PHONE_DIGITS + 1) next.phone = form.phoneError;
    setErrors(next);
    if (next.name || next.phone) return;

    const trimmedName = name.trim();
    const hp = hpRef.current?.value ?? "";

    setStatus("sending");
    try {
      await createLead({ name: trimmedName, phone, hp });
      setName("");
      setPhone("");
      setErrors({});
      setStatus("success");
    } catch {
      // Firestore-ошибка (сеть/rules/данные) — показываем submitError без
      // auto-Telegram-фолбэка: ссылки Telegram/WhatsApp остаются отдельными
      // кнопками контактов.
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="scroll-mt-20 border-b border-border py-[76px]">
      <Container>
        <SectionHeading heading={copy.contact.heading} />

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="mb-6 max-w-[520px] text-[17px] text-muted">{copy.contact.invite}</p>

            <div className="flex max-w-[380px] flex-col gap-3">
              <a
                href={urls.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className={PLATFORM_LINK}
              >
                <span className={PLATFORM_ICON}>
                  <TelegramIcon className="size-5" />
                </span>
                <span className="flex-1">{copy.contact.telegramLabel}</span>
                <ArrowIcon className={ARROW_CLASS} />
              </a>

              <a
                href={urls.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={PLATFORM_LINK}
              >
                <span className={PLATFORM_ICON}>
                  <WhatsAppIcon className="size-5" />
                </span>
                <span className="flex-1">{copy.contact.whatsappLabel}</span>
                <ArrowIcon className={ARROW_CLASS} />
              </a>

              <a href={urls.mailto} className={PLATFORM_LINK}>
                <span className={PLATFORM_ICON}>
                  <EmailIcon className="size-5" />
                </span>
                <span className="flex-1">{copy.contact.emailLabel}</span>
                <ArrowIcon className={ARROW_CLASS} />
              </a>
            </div>
          </div>

          <form
            className="rounded-[18px] border border-border bg-surface p-5 sm:p-7"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="text-xs text-accent">{form.title}</div>

            <label
              htmlFor="cf-name"
              className="mt-3.5 mb-1.5 block text-[11px] text-muted"
            >
              {form.nameLabel}
            </label>
            <Input
              id="cf-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                resetOutcome();
              }}
              placeholder={form.namePlaceholder}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "cf-name-error" : undefined}
              className="h-12 rounded-[10px] border-border bg-bg text-[15px]"
            />
            {errors.name && (
              <p id="cf-name-error" role="alert" className="mt-1.5 text-xs text-destructive">
                {errors.name}
              </p>
            )}

            <label
              htmlFor="cf-phone"
              className="mt-3.5 mb-1.5 block text-[11px] text-muted"
            >
              {form.phoneLabel}
            </label>
            <Input
              id="cf-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                const input = e.target;
                const next = maskPhone(input.value, input.selectionStart ?? input.value.length);
                input.value = next.value;
                input.setSelectionRange(next.caret, next.caret);
                setPhone(next.value);
                resetOutcome();
              }}
              placeholder={form.phonePlaceholder}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? "cf-phone-error" : undefined}
              className="h-12 rounded-[10px] border-border bg-bg text-[15px]"
            />
            {errors.phone && (
              <p id="cf-phone-error" role="alert" className="mt-1.5 text-xs text-destructive">
                {errors.phone}
              </p>
            )}

            <input
              ref={hpRef}
              type="text"
              name="hp"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              defaultValue=""
              className="sr-only"
            />

            <Button
              type="submit"
              disabled={status === "sending"}
              className="mt-5 h-12 w-full rounded-[10px] font-semibold"
            >
              {status === "sending" ? form.sending : form.cta}
            </Button>

            {status === "success" && (
              <p role="status" className="mt-3 text-sm text-accent">
                {form.success}
              </p>
            )}

            {status === "error" && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {form.submitError}
              </p>
            )}
          </form>
        </div>
      </Container>
    </section>
  );
}
