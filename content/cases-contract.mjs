export function safeHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
export function adaptCase(item) {
  return { ...item, type: item.type === 'automation' ? 'ai' : item.type ?? 'website',
    ...Object.fromEntries(['ru', 'kz', 'en'].map(lang => [lang, { ...item[lang], title: item[lang]?.title, subtitle: item[lang]?.subtitle ?? item[lang]?.desc }])) };
}
export function validateCasesDoc(doc) {
  const errors = [];
  if (!doc || ![1, 2].includes(doc.version) || !Array.isArray(doc.cases)) return { ok: false, errors: ['document'] };
  const ids = new Set(); const orders = new Set();
  for (const raw of doc.cases) {
    if (!raw || typeof raw !== 'object') { errors.push('case'); continue; }
    const item = adaptCase(raw);
    if (!/^[a-z0-9-]{1,64}$/.test(item.id ?? '') || ids.has(item.id)) errors.push('id'); ids.add(item.id);
    if (!Number.isInteger(item.order) || orders.has(item.order)) errors.push('order'); orders.add(item.order);
    if (!['website', 'bot', 'ai'].includes(item.type) || (doc.version === 2 && !raw.type)) errors.push('type');
    for (const key of ['url', 'previewImageUrl']) if (item[key] !== undefined && item[key] !== '' && !safeHttpsUrl(item[key])) errors.push(key);
    for (const lang of ['ru', 'kz', 'en']) for (const key of ['title', 'subtitle']) {
      const value = doc.version === 2 ? raw[lang]?.[key] : item[lang]?.[key];
      if (typeof value !== 'string' || !value.trim() || value.length > 1000) errors.push(`${lang}.${key}`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
