import { test, expect } from "@playwright/test";

test("SSR pages contain CMS content and metadata without JavaScript", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".hero-story h2")).toContainText("Расул");
  await expect(
    page.getByRole("heading", { name: "Java-разработчик", exact: true }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  expect((await request.get("/portfolio")).status()).toBe(404);
  expect((await request.get("/portfolio/editorial")).status()).toBe(404);
  expect((await request.get("/portfolio/does-not-exist")).status()).toBe(404);
  expect((await request.get("/does-not-exist")).status()).toBe(404);
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Disallow: /",
  );
  expect(await (await request.get("/sitemap.xml")).text()).toContain("<urlset");
  await context.close();
});

test("landing shows services and 2K portraits, with no gallery links", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".service-card")).toHaveCount(3);
  await expect(
    page.getByRole("link", { name: "Фотографии", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('a[href^="/portfolio"]')).toHaveCount(0);
  expect(
    await page
      .locator(".hero-figure img")
      .evaluate((img) => (img as HTMLImageElement).naturalHeight),
  ).toBe(2048);
  await expect(page.locator("h1")).toContainText("ваш бизнес");
  await page.locator(".hero-actions .button").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Ваша идея",
  );
});

test("contact form validates and persists an inquiry through Django", async ({
  page,
}) => {
  await page.goto("/contact", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.locator("#name-error")).toContainText("Укажите имя");
  await page.getByLabel("Ваше имя").fill("E2E Portfolio Test");
  await page.getByLabel("Email", { exact: true }).fill("e2e@example.com");
  await page.getByLabel("Тип проекта").selectOption("Backend-разработка");
  await page
    .getByLabel("Несколько слов об идее")
    .fill(
      "Проверка формы портфолио: разработка REST API, интеграция PostgreSQL, тестовая заявка.",
    );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(
    page.getByRole("heading", { name: "Идея уже в пути." }),
  ).toBeVisible();
});

test("staff session restores after reload, reauthenticates a 401 and logs out across tabs", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.E2E_PASSWORD,
    "E2E_PASSWORD must be supplied for a local test account",
  );
  await page.goto("/studio", { waitUntil: "networkidle" });
  await page
    .getByLabel("Логин", { exact: true })
    .fill(process.env.E2E_USERNAME || "owner");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Входящие заявки" }),
  ).toBeVisible();
  await expect(
    page.getByText("E2E Portfolio Test", { exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).length + Object.keys(sessionStorage).length,
    ),
  ).toBe(0);
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "portfolio_refresh",
  );
  const cookie = (await context.cookies()).find(
    (c) => c.name === "portfolio_refresh",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.path).toBe("/api/v1/auth/");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Входящие заявки" }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/studio");
  await expect(
    other.getByRole("heading", { name: "Входящие заявки" }),
  ).toBeVisible();
  // Force a protected API failure, then verify a refresh and a successful retry.
  let failures = 0;
  let refreshes = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/auth/refresh/")) refreshes++;
  });
  await page.route("**/api/v1/inbox/**", async (route) => {
    if (failures < 1) {
      failures++;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: '{"detail":"expired"}',
      });
    } else await route.continue();
  });
  await page.getByLabel("Поиск заявок").fill("E2E");
  await expect.poll(() => failures).toBe(1);
  await expect.poll(() => refreshes).toBe(1);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByText("E2E Portfolio Test", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toBeVisible();
  await expect(
    other.getByRole("button", { name: "Войти", exact: true }),
  ).toBeVisible();
  await other.close();
});

test("mobile layouts, navigation and desktop screenshot", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [375, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/", { waitUntil: "networkidle" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator("img")
        .evaluateAll((imgs) =>
          imgs
            .filter((i) => i.getAttribute("loading") !== "lazy")
            .every(
              (i) =>
                (i as HTMLImageElement).complete &&
                (i as HTMLImageElement).naturalWidth > 0,
            ),
        ),
    ).toBe(true);
    if (width === 1440)
      await page.screenshot({
        path: "../.runtime/serif-desktop.png",
        fullPage: true,
      });
    if (width === 375) {
      await page.screenshot({
        path: "../.runtime/serif-mobile.png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "Открыть меню" }).click();
      await page
        .getByRole("navigation", { name: "Мобильная навигация" })
        .getByRole("link", { name: "Обсудить проект" })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Ваша идея",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
