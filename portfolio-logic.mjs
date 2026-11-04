export const SUPPORTED_LANGS = ['ru', 'kz', 'en'];

export function computeChapterFromProgress(progress) {
  const clamped = Math.min(1, Math.max(0, Number(progress) || 0));
  return Math.min(4, Math.floor(clamped * 5));
}

export function computeScrollTargetForChapter(chapterIndex, totalScrollDistance) {
  const idx = Math.min(4, Math.max(0, Number(chapterIndex) || 0));
  const dist = Math.max(0, Number(totalScrollDistance) || 0);
  // Target the middle of the chapter's scroll slice for stable activation
  const ratio = idx === 0 ? 0 : Math.min(0.98, (idx + 0.1) / 5);
  return Math.round(ratio * dist);
}

export function buildConsultationMessage({ lang = 'ru', topicLabel = '', projectNote = '', baseGreeting = '' }) {
  const cleanTopic = String(topicLabel || '').trim();
  const cleanNote = String(projectNote || '').trim();

  if (lang === 'en') {
    const parts = [baseGreeting || 'Hi Rasul! I saw your portfolio and would like to discuss cooperation.'];
    if (cleanTopic) parts.push(`Format: ${cleanTopic}.`);
    if (cleanNote) parts.push(`Task details: ${cleanNote}`);
    return parts.join(' ');
  }

  if (lang === 'kz') {
    const parts = [baseGreeting || 'Сәлем, Расул! Портфолиоңды көрдім, жоба бойынша байланысқым келеді.'];
    if (cleanTopic) parts.push(`Бағыт: ${cleanTopic}.`);
    if (cleanNote) parts.push(`Қысқаша сипаттама: ${cleanNote}`);
    return parts.join(' ');
  }

  const parts = [baseGreeting || 'Привет, Расул! Посмотрел(а) твоё портфолио, хочу обсудить сотрудничество.'];
  if (cleanTopic) parts.push(`Формат: ${cleanTopic}.`);
  if (cleanNote) parts.push(`Задача: ${cleanNote}`);
  return parts.join(' ');
}

export function buildContactUrls({ phone = '77085480859', telegramUser = 'ahmetov_rasul', email = 'rasulakhmetov2004@gmail.com', message = '', subject = 'Сотрудничество / Backend Project' }) {
  const encodedMsg = encodeURIComponent(message);
  const encodedSubj = encodeURIComponent(subject);
  return {
    whatsapp: `https://wa.me/${phone}?text=${encodedMsg}`,
    telegram: `https://t.me/${telegramUser}?text=${encodedMsg}`,
    mailto: `mailto:${email}?subject=${encodedSubj}&body=${encodedMsg}`,
  };
}
