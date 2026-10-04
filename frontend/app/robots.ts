import type { MetadataRoute } from "next";

import { SITE } from "@/lib/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/checkout", "/order/", "/api/"] },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
