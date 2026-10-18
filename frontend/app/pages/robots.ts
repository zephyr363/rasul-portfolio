import { serverApi } from "~/shared/api/server";
import type { Site } from "~/shared/types";
export async function loader() {
  const site = await serverApi<Site>("site/");
  return new Response(
    site.demo_mode
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nAllow: /\nDisallow: /studio\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${new URL("/sitemap.xml", site.site_url).href}\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
