import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SUPPORTED_LANGS,
  computeChapterFromProgress,
  computeScrollTargetForChapter,
  buildConsultationMessage,
  buildContactUrls,
} from './portfolio-logic.mjs';

test('computeChapterFromProgress maps [0..1] progress to chapters 0..4', () => {
  assert.equal(computeChapterFromProgress(0), 0);
  assert.equal(computeChapterFromProgress(0.19), 0);
  assert.equal(computeChapterFromProgress(0.21), 1);
  assert.equal(computeChapterFromProgress(0.55), 2);
  assert.equal(computeChapterFromProgress(0.79), 3);
  assert.equal(computeChapterFromProgress(0.95), 4);
  assert.equal(computeChapterFromProgress(1), 4);
});

test('computeScrollTargetForChapter calculates accurate scroll offset', () => {
  assert.equal(computeScrollTargetForChapter(0, 2000), 0);
  const ch2 = computeScrollTargetForChapter(2, 2000);
  assert.ok(ch2 >= 800 && ch2 < 1200);
  assert.equal(computeChapterFromProgress(ch2 / 2000), 2);
});

test('buildConsultationMessage formats RU, KZ, and EN messages with topic and note', () => {
  assert.equal(SUPPORTED_LANGS.length, 3);

  const ruMsg = buildConsultationMessage({
    lang: 'ru',
    topicLabel: 'Разработка Backend / API',
    projectNote: 'Нужен микросервис оплаты на Spring Boot',
  });
  assert.match(ruMsg, /Формат: Разработка Backend \/ API/);
  assert.match(ruMsg, /Задача: Нужен микросервис оплаты на Spring Boot/);

  const enMsg = buildConsultationMessage({
    lang: 'en',
    topicLabel: 'Java Developer (Team)',
    projectNote: 'Fintech API integration',
  });
  assert.match(enMsg, /Format: Java Developer \(Team\)/);
  assert.match(enMsg, /Task details: Fintech API integration/);
});

test('buildContactUrls generates valid WhatsApp, Telegram, and mailto links', () => {
  const urls = buildContactUrls({
    message: 'Привет, Расул! Задача: API',
    subject: 'Java Backend',
  });
  assert.ok(urls.whatsapp.startsWith('https://wa.me/77085480859?text='));
  assert.ok(urls.telegram.startsWith('https://t.me/ahmetov_rasul?text='));
  assert.ok(urls.mailto.startsWith('mailto:rasulakhmetov2004@gmail.com?subject='));
});

test('index.html contains core interactive sections and removes user-selected elements', () => {
  const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="projects"'), 'Case studies section #projects must exist');
  assert.ok(html.includes('id="servicesAccordion"'), 'Interactive expertise accordion must exist');
  assert.ok(html.includes('id="cvModal"'), 'CV modal must exist');
  assert.ok(!html.includes('<div class="top-micro"'), 'Selected #topMicro element must be removed');
  assert.ok(!html.includes('<div class="scrub-control"'), 'Selected .scrub-control element must be removed');
  assert.ok(!html.includes('<div class="brief-box reveal" id="briefTopicGroup">'), 'Selected #briefTopicGroup element must be removed');
  assert.ok(!html.includes('<div class="mail-row reveal">'), 'Selected .mail-row element must be removed');
  assert.ok(!html.includes('id="heroSeam"'), 'Selected #heroSeam element must be removed');
});

