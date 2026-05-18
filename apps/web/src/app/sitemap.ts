import type { MetadataRoute } from "next";
import { BASE_URL, jobToSlug } from "@/lib/seo";

interface SitemapJob {
  title: string;
  company: string;
  url: string;
}

async function fetchSitemapJobs(): Promise<SitemapJob[]> {
  try {
    const apiUrl =
      process.env.API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";
    const res = await fetch(`${apiUrl}/api/public/job-sitemap`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.jobs) ? data.jobs : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const jobs = await fetchSitemapJobs();

  const jobRoutes: MetadataRoute.Sitemap = jobs
    .filter((j) => j.title && j.company && j.url)
    .map((j) => ({
      url: `${BASE_URL}/jobs/${jobToSlug(j.title, j.company, j.url)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  return [...staticRoutes, ...jobRoutes];
}
