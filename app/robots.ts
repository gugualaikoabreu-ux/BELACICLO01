import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const live = process.env.STORE_INDEXING_ENABLED === "true";
  return { rules: [{ userAgent: "*", allow: live ? "/" : [], disallow: live ? ["/admin", "/api", "/minha-conta"] : ["/"] }], sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/sitemap.xml` };
}
