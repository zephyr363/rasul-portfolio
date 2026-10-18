import { type RouteConfig, index, route } from "@react-router/dev/routes";
export default [
  route("experience", "pages/experience.tsx"),
  route("projects", "pages/projects.tsx"),
  route("projects/:slug", "pages/project.tsx"),
  index("pages/home.tsx"),
  route("about", "pages/about.tsx"),
  route("contact", "pages/contact.tsx"),
  route("privacy", "pages/privacy.tsx"),
  route("studio", "pages/studio.tsx"),
  route("robots.txt", "pages/robots.ts"),
  route("sitemap.xml", "pages/sitemap.ts"),
  route("llms.txt", "pages/llms.ts"),
] satisfies RouteConfig;
