import { serverApi } from "~/shared/api/server";
import type { Site, Project } from "~/shared/types";
const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
export async function loader() {
  const [site, projects] = await Promise.all([
    serverApi<Site>("site/"),
    serverApi<Project[]>("projects/"),
  ]);
  const pages = site.demo_mode
    ? []
    : [
        ...[
          "/",
          "/experience",
          "/projects",
          "/about",
          "/contact",
          "/privacy",
        ].map((path) => ({ path, modified: site.updated_at })),
        ...projects.map((p) => ({
          path: `/projects/${p.slug}`,
          modified: p.updated_at,
        })),
      ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((p) => `<url><loc>${escape(new URL(p.path, site.site_url).href)}</loc><lastmod>${escape(p.modified)}</lastmod></url>`).join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
