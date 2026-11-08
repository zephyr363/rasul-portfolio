import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  describeSeedError,
  seedLocalesIfEmpty,
  type SeedResult,
} from "@/admin/lib/seed";
import {
  describeContentError,
  getLocales,
  saveLocales,
  validateContentDoc,
  type ContentDoc,
} from "@/data/content";
import type { Lang, LocaleCopy } from "@/content/types";
import { HERO_PHOTO_URL } from "@/lib/hero-photo";
import { useUnsavedChanges } from "@/admin/lib/navigation-protection";

const LANGS: Lang[] = ["ru", "kz", "en"];
const LANG_LABELS: Record<Lang, string> = { ru: "RU", kz: "KZ", en: "EN" };

// Максимальные длины строк из контракта v2 (locales-contract.mjs).
const MAX_META = 300;
const MAX_HEADING = 200;
const MAX_PARAGRAPH = 1000;

type MaxLen = typeof MAX_META | typeof MAX_HEADING | typeof MAX_PARAGRAPH;

interface StringField {
  kind: "text" | "textarea";
  path: string;
  label: string;
  max: MaxLen;
}

interface ArrayField {
  kind: "array";
  path: string;
  label: string;
  length: number;
  itemMax: MaxLen;
}

interface ObjectArrayField {
  kind: "objectArray";
  path: string;
  label: string;
  itemFields: { path: string; label: string; max: MaxLen; multiline?: boolean }[];
}

type Field = StringField | ArrayField | ObjectArrayField;

function PhotoPreview({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <p role="status" className="text-sm text-destructive">Не удалось загрузить фото. Проверьте доступность ссылки. Другое фото не подставляется.</p> : (
    <img src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="aspect-[4/5] w-40 rounded-lg object-cover" />
  );
}

function previewUrl(value: string): string | null {
  if (!value.trim()) return HERO_PHOTO_URL;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password && !/[\u0000-\u001f\u007f-\u009f]/.test(value) && value.length <= 2048 ? url.href : null;
  } catch { return null; }
}

function DebouncedPhotoPreview({ value, lang, alt }: { value: string; lang: Lang; alt: string }) {
  const normalized = previewUrl(value);
  const [committed, setCommitted] = useState<string | null>(null);
  useEffect(() => {
    if (!normalized) return;
    const timer = window.setTimeout(() => setCommitted(normalized), 300);
    return () => window.clearTimeout(timer);
  }, [normalized]);
  return normalized && committed ? <PhotoPreview key={`${lang}:${committed}`} src={committed} alt={alt} /> : null;
}

interface Section {
  id: string;
  label: string;
  fields: Field[];
}

/**
 * Схема полей по фактическим ключам `LocaleCopy` (порядок: Заголовок →
 * Описание → уникальные поля/массивы). Фиксированные массивы — без add/remove,
 * только редактирование существующих элементов (длины из контракта v2).
 */
const SECTIONS: Section[] = [
  {
    id: "meta",
    label: "Meta",
    fields: [
      { kind: "text", path: "meta.title", label: "Заголовок (SEO)", max: MAX_META },
      { kind: "textarea", path: "meta.description", label: "Описание (SEO)", max: MAX_META },
    ],
  },
  {
    id: "nav",
    label: "Навигация",
    fields: [
      { kind: "text", path: "nav.logo", label: "Логотип", max: MAX_HEADING },
      { kind: "array", path: "nav.links", label: "Пункты меню", length: 5, itemMax: MAX_HEADING },
      { kind: "text", path: "nav.cta", label: "Кнопка (CTA)", max: MAX_HEADING },
    ],
  },
  {
    id: "hero",
    label: "Hero",
    fields: [
      { kind: "text", path: "hero.title", label: "Заголовок", max: MAX_HEADING },
      { kind: "text", path: "hero.sub", label: "Подзаголовок", max: MAX_HEADING },
      { kind: "textarea", path: "hero.lead", label: "Лид", max: MAX_PARAGRAPH },
      { kind: "text", path: "hero.ctaPrimary", label: "Основная кнопка", max: MAX_HEADING },
      { kind: "text", path: "hero.ctaSecondary", label: "Второстепенная кнопка", max: MAX_HEADING },
      { kind: "text", path: "hero.photoAlt", label: "Alt фото", max: MAX_HEADING },
    ],
  },
  {
    id: "cases",
    label: "Кейсы",
    fields: [{ kind: "text", path: "cases.heading", label: "Заголовок", max: MAX_HEADING }],
  },
  {
    id: "services",
    label: "Услуги",
    fields: [
      { kind: "text", path: "services.heading", label: "Заголовок", max: MAX_HEADING },
      { kind: "textarea", path: "services.intro", label: "Описание", max: MAX_PARAGRAPH },
      { kind: "textarea", path: "services.body", label: "Текст", max: MAX_PARAGRAPH },
      { kind: "textarea", path: "services.result", label: "Результат", max: MAX_PARAGRAPH },
      { kind: "text", path: "services.capabilitiesTitle", label: "Заголовок возможностей", max: MAX_HEADING },
      { kind: "array", path: "services.capabilities", label: "Возможности", length: 4, itemMax: MAX_HEADING },
    ],
  },
  {
    id: "about",
    label: "Обо мне",
    fields: [
      { kind: "text", path: "about.heading", label: "Заголовок", max: MAX_HEADING },
      { kind: "textarea", path: "about.lead", label: "Лид", max: MAX_PARAGRAPH },
      { kind: "textarea", path: "about.body", label: "Текст", max: MAX_PARAGRAPH },
    ],
  },
  {
    id: "experience",
    label: "Опыт",
    fields: [
      {
        kind: "objectArray",
        path: "experience.items",
        label: "Места опыта",
        itemFields: [
          { path: "date", label: "Период", max: MAX_HEADING },
          { path: "org", label: "Организация", max: MAX_HEADING },
          { path: "role", label: "Роль", max: MAX_PARAGRAPH, multiline: true },
        ],
      },
    ],
  },
  {
    id: "contact",
    label: "Контакты",
    fields: [
      { kind: "text", path: "contact.heading", label: "Заголовок", max: MAX_HEADING },
      { kind: "textarea", path: "contact.invite", label: "Приглашение", max: MAX_PARAGRAPH },
      { kind: "text", path: "contact.telegramLabel", label: "Telegram (лейбл)", max: MAX_HEADING },
      { kind: "text", path: "contact.whatsappLabel", label: "WhatsApp (лейбл)", max: MAX_HEADING },
      { kind: "text", path: "contact.emailLabel", label: "Email (лейбл)", max: MAX_HEADING },
      { kind: "text", path: "contact.form.title", label: "Форма: заголовок", max: MAX_HEADING },
      { kind: "text", path: "contact.form.nameLabel", label: "Форма: имя (лейбл)", max: MAX_HEADING },
      { kind: "text", path: "contact.form.namePlaceholder", label: "Форма: имя (плейсхолдер)", max: MAX_HEADING },
      { kind: "text", path: "contact.form.phoneLabel", label: "Форма: телефон (лейбл)", max: MAX_HEADING },
      { kind: "text", path: "contact.form.phonePlaceholder", label: "Форма: телефон (плейсхолдер)", max: MAX_HEADING },
      { kind: "text", path: "contact.form.nameError", label: "Форма: ошибка имени", max: MAX_HEADING },
      { kind: "text", path: "contact.form.phoneError", label: "Форма: ошибка телефона", max: MAX_HEADING },
      { kind: "text", path: "contact.form.cta", label: "Форма: кнопка", max: MAX_HEADING },
      { kind: "text", path: "contact.form.success", label: "Форма: успех", max: MAX_HEADING },
      { kind: "text", path: "contact.form.sending", label: "Форма: отправка", max: MAX_HEADING },
      { kind: "text", path: "contact.form.submitError", label: "Форма: ошибка отправки", max: MAX_HEADING },
    ],
  },
];

/** Чтение значения по dotted-пути относительно локали. */
function getAt(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, root);
}

/** Глубокий клон (документ — чистые JSON-данные). */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Новый объект с установленным значением по dotted-пути. */
function setAtPath<T>(root: T, path: string, value: unknown): T {
  const next = clone(root) as unknown as Record<string, unknown>;
  const keys = path.split(".");
  let node = next;
  for (let i = 0; i < keys.length - 1; i++) {
    node = node[keys[i]] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
  return next as unknown as T;
}

/** Маппинг ошибок контракта в ошибки по полям (ключ `<lang>.<path>`). */
function mapContractErrors(errors: string[]): {
  fieldErrors: Record<string, string>;
  general: string[];
} {
  const fieldErrors: Record<string, string> = {};
  const general: string[] = [];
  for (const e of errors) {
    const idx = e.indexOf(": ");
    const path = idx >= 0 ? e.slice(0, idx) : e;
    const msg = idx >= 0 ? e.slice(idx + 2) : e;
    const m = /^locales\.(ru|kz|en)\.(.+)$/.exec(path);
    if (m) {
      fieldErrors[`${m[1]}.${m[2]}`] = msg;
    } else {
      general.push(e);
    }
  }
  return { fieldErrors, general };
}

type LoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "empty" }
  | { status: "error"; message: string };

/**
 * Раздел «Контент» (FB-T7B): левое меню секций, переключатель RU/KZ/EN,
 * редактирование полей контракта локалей, локальная валидация и сохранение
 * всего документа целиком (saveLocales).
 */
export function ContentPage() {
  const experienceKeys = useRef<Record<Lang, string[]>>({ ru: [], kz: [], en: [] });
  const nextExperienceKey = useRef(0);
  function resetExperienceKeys(doc: ContentDoc) {
    for (const locale of LANGS) {
      experienceKeys.current[locale] = doc.locales[locale].experience.items.map(() => `experience-${nextExperienceKey.current++}`);
    }
  }
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [draft, setDraft] = useState<ContentDoc | null>(null);
  const [loaded, setLoaded] = useState<ContentDoc | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [lang, setLang] = useState<Lang>("ru");
  const [sectionId, setSectionId] = useState<string>(SECTIONS[0].id);

  const dirty = draft !== null && loaded !== null && JSON.stringify(draft) !== JSON.stringify(loaded);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Импорт шаблона (пустое состояние).
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<SeedResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  useUnsavedChanges({ dirty, pending: saving || importing });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getLocales({ forceRefresh: true })
      .then((docData) => {
        if (cancelled) return;
        setDraft(clone(docData));
        resetExperienceKeys(docData);
        setLoaded(clone(docData));
        setSaved(false);
        setFieldErrors({});
        setLoad({ status: "ready" });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = describeContentError(err);
        if (/не найден/i.test(message)) {
          setLoad({ status: "empty" });
        } else {
          setLoad({ status: "error", message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function markDirty() {
    setSaved(false);
    setFieldErrors({});
    setSaveError(null);
  }

  function updateField(path: string, value: unknown) {
    setDraft((prev) => {
      if (!prev) return prev;
      const locale = setAtPath<LocaleCopy>(prev.locales[lang], path, value);
      return { ...prev, locales: { ...prev.locales, [lang]: locale } };
    });
    markDirty();
  }

  function updateArrayItem(path: string, index: number, value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const arr = [...(getAt(prev.locales[lang], path) as string[])];
      arr[index] = value;
      const locale = setAtPath<LocaleCopy>(prev.locales[lang], path, arr);
      return { ...prev, locales: { ...prev.locales, [lang]: locale } };
    });
    markDirty();
  }

  function updateObjectItem(path: string, index: number, subPath: string, value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const arr = clone(getAt(prev.locales[lang], path)) as Record<string, unknown>[];
      arr[index][subPath] = value;
      const locale = setAtPath<LocaleCopy>(prev.locales[lang], path, arr);
      return { ...prev, locales: { ...prev.locales, [lang]: locale } };
    });
    markDirty();
  }

  function handleReset() {
    if (!loaded) return;
    setDraft(clone(loaded));
    resetExperienceKeys(loaded);
    setSaved(false);
    setFieldErrors({});
    setSaveError(null);
  }

  function changeExperience(index?: number) {
    if (!draft || saving || importing) return;
    const items = [...draft.locales[lang].experience.items];
    if (index === undefined) {
      items.push({ date: "", org: "", role: "" });
      experienceKeys.current[lang].push(`experience-${nextExperienceKey.current++}`);
    } else {
      items.splice(index, 1);
      experienceKeys.current[lang].splice(index, 1);
    }
    updateField("experience.items", items);
  }

  async function handleSave() {
    if (!draft || saving || importing) return;
    const errors = validateContentDoc(draft);
    if (errors.length) {
      const mapped = mapContractErrors(errors);
      setFieldErrors(mapped.fieldErrors);
      setSaveError("Есть ошибки валидации — исправьте поля и сохраните ещё раз.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveLocales(draft);
      setLoaded(clone(draft));
      setSaved(true);
    } catch (err) {
      setSaveError(describeContentError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    if (importing || saving) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const result = await seedLocalesIfEmpty();
      setImportResult(result);
      if (!result.skipped) setReloadKey((k) => k + 1);
    } catch (err) {
      setImportError(describeSeedError(err));
    } finally {
      setImporting(false);
    }
  }

  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];

  function errorFor(locale: Lang, key: string): string | undefined {
    return fieldErrors[`${locale}.${key}`];
  }

  function renderField(field: Field) {
    if (field.kind === "text" || field.kind === "textarea") {
      const value = String(getAt(draft?.locales[lang], field.path) ?? "");
      const err = errorFor(lang, field.path);
      const id = `content-${lang}-${field.path.replaceAll(".", "-")}`;
      const Comp = field.kind === "textarea" ? Textarea : Input;
      return (
        <div key={field.path} className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-xs text-muted">
            {field.label}
          </label>
          <Comp
            className="min-h-11 sm:min-h-0"
            id={id}
            disabled={saving || importing}
            value={value}
            maxLength={field.max}
            aria-invalid={err != null}
            onChange={(e) => updateField(field.path, e.target.value)}
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      );
    }

    if (field.kind === "array") {
      const items = (getAt(draft?.locales[lang], field.path) as string[]) ?? [];
      const groupErr = errorFor(lang, field.path);
      return (
        <div key={field.path} className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">{field.label}</span>
          {items.map((item, i) => {
            const err = errorFor(lang, `${field.path}[${i}]`);
            const id = `content-${lang}-${field.path.replaceAll(".", "-")}-${i}`;
            return (
              <div key={i} className="flex flex-col gap-1">
                <Input
                  className="min-h-11 sm:min-h-0"
                  id={id}
                  disabled={saving || importing}
                  aria-label={`${field.label} ${i + 1}`}
                  value={item}
                  maxLength={field.itemMax}
                  aria-invalid={err != null}
                  onChange={(e) => updateArrayItem(field.path, i, e.target.value)}
                />
                {err && <p className="text-xs text-destructive">{err}</p>}
              </div>
            );
          })}
          {groupErr && <p className="text-xs text-destructive">{groupErr}</p>}
        </div>
      );
    }

    // objectArray
    if (field.kind === "objectArray") {
      const items =
        (getAt(draft?.locales[lang], field.path) as Record<string, unknown>[]) ?? [];
      const groupErr = errorFor(lang, field.path);
      return (
        <div key={field.path} className="flex flex-col gap-3">
          <span className="text-xs text-muted">{field.label}</span>
          {items.map((item, i) => (
            <fieldset key={experienceKeys.current[lang][i]} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <legend>Опыт {i + 1} — {LANG_LABELS[lang]}</legend>
              <Button type="button" variant="outline" disabled={saving || importing} aria-label={`Удалить опыт ${i + 1} — ${LANG_LABELS[lang]}`} onClick={() => changeExperience(i)}>Удалить опыт</Button>
              {field.itemFields.map((sub) => {
                const value = String(item[sub.path] ?? "");
                const err = errorFor(lang, `${field.path}[${i}].${sub.path}`);
                const id = `content-${lang}-${field.path.replaceAll(".", "-")}-${i}-${sub.path}`;
                const Comp = sub.multiline ? Textarea : Input;
                return (
                  <div key={sub.path} className="flex flex-col gap-1.5">
                    <label htmlFor={id} className="text-xs text-muted">
                      {sub.label}
                    </label>
                    <Comp
                      className="min-h-11 sm:min-h-0"
                      id={id}
                      disabled={saving || importing}
                      value={value}
                      maxLength={sub.max}
                      aria-invalid={err != null}
                      aria-describedby={err ? `${id}-error` : undefined}
                      onChange={(e) => updateObjectItem(field.path, i, sub.path, e.target.value)}
                    />
                    {err && <p id={`${id}-error`} className="text-xs text-destructive">{err}</p>}
                  </div>
                );
              })}
            </fieldset>
          ))}
          <p className="text-xs text-muted">Изменения только для {LANG_LABELS[lang]}. Другие языки не меняются. Заполните период, организацию и роль нового опыта перед сохранением. Пустой список скрывает блок опыта на сайте.</p>
          <Button type="button" variant="outline" disabled={saving || importing} onClick={() => changeExperience()}>Добавить опыт</Button>
          {groupErr && <p className="text-xs text-destructive">{groupErr}</p>}
        </div>
      );
    }

    return null;
  }

  return (
    <div>
      <section className="mb-6 space-y-3 rounded-lg border border-border p-4" aria-label="Фото Hero">
        <h2 className="font-bold">Фото Hero</h2>
        <p className="text-sm text-muted">
          В секции Hero укажите HTTPS-ссылку на фото для выбранного языка и сохраните.
          Файлы не загружаются и не копируются. Пустая ссылка использует исходное внешнее фото.
        </p>
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-display text-2xl font-bold">Контент</h1>
        <div className="ml-auto flex items-center gap-2">
          <span aria-live="polite" className="text-sm text-muted">
            {saving && (
              <span className="flex items-center gap-1.5">
                <LoaderCircle className="size-3.5 animate-spin" />
                Сохраняем…
              </span>
            )}
            {!saving && saved && <span className="text-success">Сохранено ✓</span>}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!dirty || saving}
          >
            <RotateCcw className="size-4" />
            Отменить правки
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving || importing || load.status !== "ready"}>
            <Save className="size-4" />
            Сохранить
          </Button>
        </div>
      </div>

      <p className="mt-2 max-w-[560px] text-sm text-muted">
        Тексты сайта из Firestore. Выберите секцию и язык, отредактируйте поля и
        сохраните.
      </p>

      {dirty && (
        <p className="mt-2 text-sm text-warning">Есть несохранённые изменения.</p>
      )}

      {saveError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {saveError}
        </p>
      )}

      <div className="mt-5">
        {load.status === "loading" && (
          <div className="flex flex-col gap-2" role="status" aria-label="Загрузка контента">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
        )}

        {load.status === "error" && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-6"
          >
            <p className="text-sm text-destructive">{load.message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Повторить
            </Button>
          </div>
        )}

        {load.status === "empty" && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium">Данных нет</p>
            <p className="mt-1 text-sm text-muted">
              Документ локалей отсутствует в Firestore. Импортируйте из шаблона.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? "Импортируем…" : "Импортировать из шаблона"}
            </Button>
            {importResult && (
              <p role="status" className="mt-3 text-sm text-muted">
                {importResult.skipped
                  ? "Тексты уже есть в Firestore — импорт пропущен."
                  : "Тексты импортированы в siteContent/locales."}
              </p>
            )}
            {importError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {importError}
              </p>
            )}
          </div>
        )}

        {load.status === "ready" && draft && (
          <div className="flex flex-col gap-6 min-[700px]:flex-row">
            {/* Левое меню секций */}
            <nav
              className="flex min-w-0 shrink-0 flex-row gap-1 overflow-x-auto min-[700px]:w-52 min-[700px]:flex-col"
              aria-label="Секции контента"
            >
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSectionId(s.id)}
                  aria-pressed={section.id === s.id}
                  className={cn(
                    "shrink-0 min-h-11 sm:min-h-0 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                    section.id === s.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted hover:bg-surface hover:text-text",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </nav>

            {/* Правая панель */}
            <div className="min-w-0 flex-1">
              <div className="flex gap-1" role="group" aria-label="Язык контента">
                {LANGS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={lang === l}
                    onClick={() => setLang(l)}
                    className={cn(
                      "min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      lang === l
                        ? "bg-accent text-accent-foreground"
                        : "text-muted hover:bg-surface hover:text-text",
                    )}
                  >
                    {LANG_LABELS[l]}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-4 rounded-lg border border-border p-4">
                {section.id === "hero" && (() => {
                  const value = draft.locales[lang].hero.photoUrl ?? "";
                  const id = `content-${lang}-hero-photoUrl`;
                  const err = errorFor(lang, "hero.photoUrl");
                  let valid = !value.trim();
                  try {
                    const url = new URL(value.trim());
                    valid = url.protocol === "https:" && !!url.hostname && !url.username && !url.password && !/[\u0000-\u001f\u007f-\u009f]/.test(value) && value.length <= 2048;
                  } catch { /* Blank uses default; invalid URLs are never requested. */ }
                  return <div className="flex flex-col gap-2">
                    <label htmlFor={id}>HTTPS URL фото — {LANG_LABELS[lang]}</label>
                    <Input className="min-h-11 sm:min-h-0" id={id} type="url" value={value} maxLength={2048} disabled={saving || importing} aria-invalid={!!err || !valid} aria-describedby={`${id}-help ${id}-error`} onChange={(e) => updateField("hero.photoUrl", e.target.value)} />
                    <p id={`${id}-help`} className="text-xs text-muted">Только для выбранного языка. Пустое поле — исходное фото. Нужна общедоступная HTTPS-ссылка на изображение, без загрузки файла.</p>
                    <p id={`${id}-error`} className="text-xs text-destructive">{err || (!valid ? "Укажите корректную HTTPS-ссылку на изображение." : "")}</p>
                    <DebouncedPhotoPreview key={lang} lang={lang} value={value} alt={`Предпросмотр: ${draft.locales[lang].hero.photoAlt}`} />
                  </div>;
                })()}
                {section.fields.map(renderField)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
