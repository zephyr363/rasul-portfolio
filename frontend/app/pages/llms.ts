import { serverApi } from "~/shared/api/server";
import type { Site } from "~/shared/types";
export async function loader() {
  const site = await serverApi<Site>("site/");
  return new Response(
    `# ${site.name} — ${site.profession}\n\n${site.demo_mode ? "Предпросмотр: канонический домен ещё не настроен.\n" : ""}${site.intro}\n\n- [Опыт и стек](${new URL("/experience", site.site_url).href})\n- [Проекты](${new URL("/projects", site.site_url).href})\n- [Обо мне](${new URL("/about", site.site_url).href})\n- [Связаться](${new URL("/contact", site.site_url).href})\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
