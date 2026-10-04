import type { MetadataRoute } from "next";

import { getParts, getVehicles } from "@/lib/catalog";
import { CATEGORIES } from "@/lib/catalog/types";
import { SITE } from "@/lib/config/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [parts, vehicles] = await Promise.all([getParts(), getVehicles()]);
  return [
    { url: SITE.url, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/about`, changeFrequency: "monthly" },
    ...CATEGORIES.map((c) => ({ url: `${SITE.url}/shop/${c}`, changeFrequency: "daily" as const })),
    ...vehicles.map((v) => ({ url: `${SITE.url}/vehicle/${v.id}`, changeFrequency: "daily" as const })),
    ...parts.map((p) => ({ url: `${SITE.url}/part/${p.sku}`, lastModified: p.stockCheckedAt })),
  ];
}
