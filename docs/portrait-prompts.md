# Портреты для лендинга Serif

Использован встроенный ImageGen. Исходники пользователя не изменены. Два результата сохранены в проекте:

- `output/portraits/rasul-professional-2k.png` — 1363 × 2048 px; WebP для сайта — `backend/seed_media/rasul-professional-2k.webp`.
- `output/portraits/rasul-portrait-2k.png` — 1424 × 2048 px; WebP для сайта — `backend/seed_media/rasul-portrait-2k.webp`.

Это AI-обработка исходных референсов с последующим экспортом на длинную сторону 2048 px. ImageGen вернул промежуточные изображения 1023 × 1537 и 1046 × 1504 px; экспорт увеличивает размеры, а не доказывает наличие оригинальных оптических деталей 2K. При обработке могут появляться восстановленные моделью детали. В лендинге используются только два выбранных портрета; фотогалерея удалена.

## Промпт 1 — деловой портрет

Use case: identity-preserve. Asset type: professional backend developer personal landing page portrait. Image 1 is the EDIT TARGET: a full-length standing photograph in black button shirt and black trousers against a plain grey studio wall. Image 2 is supporting face identity reference only. Restore and upscale Image 1 into a refined, natural professional photograph, 1360 x 2048 pixels (2K long edge). Preserve the exact identity, face, age, hairstyle, expression, pose, body proportions, black shirt, trousers, belt and shoes. Preserve the full body and head completely, with a little headroom; do not crop shoes. Keep the uncluttered light warm-grey wall and floor, gently balanced natural light. Recover clean believable detail from this low resolution source without changing facial features. Natural skin texture, precise eyes, realistic fabric, neutral warm photographic color. No beauty filter, no plastic skin, no dramatic restyling, no new objects, no computer, no props, no lettering, no graphics, no watermark. This is a faithful high fidelity restoration, not a different portrait.

## Промпт 2 — портрет анфас

Use case: identity-preserve. Asset type: secondary portrait for a serif editorial personal developer website. Input image is EDIT TARGET. Faithfully restore and upscale this exact head-and-shoulders portrait to 1424 x 2048 pixels, 2K long edge. Preserve the same person's exact face shape, eyes, nose, lips, hair, eyebrows, apparent age, natural neutral expression, black knit crewneck and light grey background. Retain the original frontal angle and head-and-shoulders framing, add only a little neutral background headroom if needed to keep all hair visible. Balanced soft natural light and subtly warm neutral color, genuine skin pores and hair detail. Do not redesign the face or beautify, do not change clothing, do not invent props or scenery. No text, no watermark, no collage. High fidelity photographic restoration of the original.
