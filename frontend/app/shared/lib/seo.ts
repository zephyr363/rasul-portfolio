import type { Site } from "~/shared/types";
export function seo(
  site: Site,
  title: string,
  description: string,
  path: string,
  image?: string,
) {
  const url = new URL(path, site.site_url).href;
  return [
    { title: `${title} — ${site.name}` },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:title", content: `${title} — ${site.name}` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    ...(image
      ? [{ property: "og:image", content: new URL(image, site.site_url).href }]
      : []),
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "robots",
      content: site.demo_mode ? "noindex, nofollow" : "index, follow",
    },
  ];
}
export function jsonLd(data: object) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
