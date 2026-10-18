export type Site = {
  hero_title: string;
  hero_copy: string;
  portrait_main: string;
  portrait_detail: string;
  portrait_alt: string;
  profession: string;
  phone: string;
  work_format: string;
  education: string;
  languages: string;
  name: string;
  tagline: string;
  city: string;
  intro: string;
  biography: string;
  email: string;
  instagram: string;
  seo_title: string;
  seo_description: string;
  site_url: string;
  demo_mode: boolean;
  google_verification: string;
  bing_verification: string;
  updated_at: string;
};
export type Photo = {
  id: number;
  image: string;
  alt: string;
  featured: boolean;
  order: number;
};
export type Collection = {
  slug: string;
  title: string;
  description: string;
  photos: Photo[];
  updated_at: string;
};
export type Inquiry = {
  id: number;
  name: string;
  email: string;
  project_type: string;
  message: string;
  consent: boolean;
  status: string;
  created_at: string;
};
export type InquiryInput = Omit<Inquiry, "id" | "status" | "created_at">;
export type Experience = {
  id: number;
  company: string;
  role: string;
  city: string;
  start: string;
  end: string | null;
  description: string;
};
export type SkillGroup = { id: number; title: string; skills: string };
export type Service = {
  id: number;
  title: string;
  description: string;
  technologies: string;
};
export type Project = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  stack: string;
  cover: string;
  url: string;
  repository: string;
  updated_at: string;
};
