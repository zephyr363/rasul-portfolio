// Shared locales document contract (v2).
//
// Pure ESM module with no Node.js runtime dependencies so it can be imported by
// the CRM (admin-server, phase 2), the frontend build, and CI/CLI tooling alike.
//
// Document shape (single source of truth for visible site strings):
//   {
//     "version": 1,
//     "locales": { "ru": {…}, "kz": {…}, "en": {…} }
//   }
//
// Contract v2:
//   - doc.version === 1
//   - doc.locales has EXACTLY the keys ru, kz, en (no more, no less)
//   - each locale matches the exact key whitelist below (no extra/missing keys)
//   - every string is a non-empty string after trim, has no control characters
//     (NUL and C0/C1 controls are rejected), and respects a per-category max
//     length:
//       * meta.*            ≤ 300  (SEO title / description)
//       * headings/labels   ≤ 200  (hero.title/sub, section headings,
//                                  nav.*, buttons, photoAlt, capabilitiesTitle,
//                                  experience date/org, form fields)
//       * paragraphs        ≤ 1000 (hero.lead, services intro/body/result,
//                                  about lead/body, contact invite,
//                                  experience role)
//   - fixed array lengths (by actual content):
//       * nav.links         === 5
//       * services.capabilities === 4
//       * experience.items: variable length (including empty), independently per locale
//   - `next` is OPTIONAL (backward compatibility with older documents that
//     predate the section transition strings): if present, all four fields
//     (toAbout/toServices/toCases/toContact) are required; if absent, valid.
//   - `lang` field of each locale equals its own top-level key ("ru" → "ru", …)
//   - cross-locale structure identity: because every locale is validated
//     against the SAME whitelist. Fixed arrays have equal lengths across
//     ru/kz/en; experience.items may differ independently per locale.

const VERSION = 1;
const LANGS = ['ru', 'kz', 'en'];

// Per-category max string lengths (see contract notes above).
const MAX_META = 300;
const MAX_HEADING = 200;
const MAX_PARAGRAPH = 1000;

// Control characters: C0 (U+0000–U+001F), DEL (U+007F), and C1 (U+0080–U+009F).
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/;

// Keys that MAY be absent from a locale object (optional blocks). `next` был
// добавлен позже, поэтому старые документы без него остаются валидными.
const OPTIONAL_KEYS = new Set(['next', 'photoUrl']);

// Exact schema. Leaf nodes are category names ("meta" | "heading" | "paragraph")
// whose max length is resolved via MAX_*; array nodes carry a fixed length and
// an item schema; object nodes map key → child schema. The `lang` leaf is
// special-cased (must equal the locale key) and is NOT length-checked.
const SCHEMA = {
  lang: 'lang',
  meta: {
    title: 'meta',
    description: 'meta',
  },
  nav: {
    logo: 'heading',
    links: { len: 5, item: 'heading' },
    cta: 'heading',
  },
  hero: {
    title: 'heading',
    sub: 'heading',
    lead: 'paragraph',
    ctaPrimary: 'heading',
    ctaSecondary: 'heading',
    photoAlt: 'heading',
    photoUrl: 'photoUrl',
  },
  cases: {
    heading: 'heading',
  },
  services: {
    heading: 'heading',
    intro: 'paragraph',
    body: 'paragraph',
    result: 'paragraph',
    capabilitiesTitle: 'heading',
    capabilities: { len: 4, item: 'heading' },
  },
  about: {
    heading: 'heading',
    lead: 'paragraph',
    body: 'paragraph',
  },
  experience: {
    items: {
      len: null,
      item: {
        date: 'heading',
        org: 'heading',
        role: 'paragraph',
      },
    },
  },
  next: {
    toAbout: 'heading',
    toServices: 'heading',
    toCases: 'heading',
    toContact: 'heading',
  },
  contact: {
    heading: 'heading',
    invite: 'paragraph',
    telegramLabel: 'heading',
    whatsappLabel: 'heading',
    emailLabel: 'heading',
    form: {
      title: 'heading',
      nameLabel: 'heading',
      namePlaceholder: 'heading',
      phoneLabel: 'heading',
      phonePlaceholder: 'heading',
      nameError: 'heading',
      phoneError: 'heading',
      cta: 'heading',
      success: 'heading',
      sending: 'heading',
      submitError: 'heading',
    },
  },
};

const MAX_BY_CATEGORY = {
  meta: MAX_META,
  heading: MAX_HEADING,
  paragraph: MAX_PARAGRAPH,
};

/** Проверка строки: непустая, без control-символов, в пределах лимита. */
function checkString(value, category, path, errors) {
  if (typeof value !== 'string') {
    errors.push(`${path}: не строка`);
    return;
  }
  if (value.trim() === '') {
    errors.push(`${path}: пустая строка`);
    return;
  }
  if (CONTROL_RE.test(value)) {
    errors.push(`${path}: control-символ`);
    return;
  }
  const max = MAX_BY_CATEGORY[category];
  if (value.length > max) {
    errors.push(`${path}: длина ${value.length} > ${max}`);
  }
}

/** Рекурсивная валидация узла по схеме. */
function validateNode(value, schema, path, lang, errors) {
  if (typeof schema === 'string') {
    if (schema === 'photoUrl') {
      if (typeof value !== 'string' || CONTROL_RE.test(value) || value.length > 2048) {
        errors.push(`${path}: ожидается HTTPS URL изображения (до 2048 символов)`);
      } else if (value.trim()) {
        try {
          const url = new URL(value.trim());
          if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error();
        } catch {
          errors.push(`${path}: ожидается HTTPS URL изображения`);
        }
      }
      return;
    }
    if (schema === 'lang') {
      if (value !== lang) errors.push(`${path}: lang должен быть "${lang}"`);
    } else {
      checkString(value, schema, path, errors);
    }
    return;
  }

  if (schema && typeof schema === 'object' && Array.isArray(schema)) {
    // Not used by the current schema — kept for exhaustiveness.
    errors.push(`${path}: unexpected array schema`);
    return;
  }

  if (schema && typeof schema === 'object' && 'len' in schema) {
    if (!Array.isArray(value)) {
      errors.push(`${path}: ожидается массив`);
      return;
    }
    if (schema.len !== null && value.length !== schema.len) {
      errors.push(`${path}: длина массива ${value.length} ≠ ${schema.len}`);
    }
    for (let i = 0; i < value.length; i++) {
      validateNode(value[i], schema.item, `${path}[${i}]`, lang, errors);
    }
    return;
  }

  // Object node: value must be a plain object with the EXACT key set.
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${path}: ожидается объект`);
    return;
  }
  const schemaKeys = Object.keys(schema);
  const valueKeys = Object.keys(value);
  for (const key of schemaKeys) {
    if (!(key in value) && !OPTIONAL_KEYS.has(key)) {
      errors.push(`${path}.${key}: отсутствует`);
    }
  }
  for (const key of valueKeys) {
    if (!(key in schema)) {
      errors.push(`${path}.${key}: неожиданный ключ`);
    }
  }
  for (const key of schemaKeys) {
    if (key in value) {
      validateNode(value[key], schema[key], `${path}.${key}`, lang, errors);
    }
  }
}

/**
 * Валидирует документ локалей.
 * @param {unknown} doc
 * @returns {{ok: true} | {ok: false, errors: string[]}}
 */
export function validateLocalesDoc(doc) {
  if (!doc || typeof doc !== 'object') return { ok: false, errors: ['document'] };
  const errors = [];

  if (doc.version !== VERSION) errors.push('version');

  // Reject top-level keys outside the fixed document shape.
  for (const key of Object.keys(doc)) {
    if (key !== 'version' && key !== 'locales') {
      errors.push(`unexpected key: ${key}`);
    }
  }

  if (!doc.locales || typeof doc.locales !== 'object' || Array.isArray(doc.locales)) {
    errors.push('locales');
    return { ok: false, errors };
  }

  const localeKeys = Object.keys(doc.locales);
  for (const lang of LANGS) {
    if (!(lang in doc.locales)) errors.push(`locales.${lang}: отсутствует`);
  }
  for (const key of localeKeys) {
    if (!LANGS.includes(key)) errors.push(`locales.${key}: неожиданная локаль`);
  }

  for (const lang of LANGS) {
    if (!(lang in doc.locales)) continue;
    validateNode(doc.locales[lang], SCHEMA, `locales.${lang}`, lang, errors);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}
