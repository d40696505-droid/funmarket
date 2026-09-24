import type { MetadataRoute } from "next";
import { searchServices } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";
const MAX_PAGES = 10;

// Иначе sitemap собирается один раз при сборке и не видит новых услуг.
export const revalidate = 3600;

async function loadAllServiceIds(): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await searchServices({ page, limit: 50, sortBy: "newest" }).catch(
      () => null,
    );
    if (!result || result.items.length === 0) break;
    ids.push(...result.items.map((s) => s.id));
    if (result.items.length < 50) break;
  }
  return ids;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const serviceIds = await loadAllServiceIds();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/catalog`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/map`, changeFrequency: "daily", priority: 0.5 },
  ];

  const serviceEntries: MetadataRoute.Sitemap = serviceIds.map((id) => ({
    url: `${SITE_URL}/services/${id}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticEntries, ...serviceEntries];
}
