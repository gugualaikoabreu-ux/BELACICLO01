import type { MetadataRoute } from "next";
import { getCatalogProducts } from "@/lib/catalog";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const routes = ["", "/colecoes", "/lookbook", "/clube", "/faq", "/contato", "/privacidade", "/termos", "/entrega", "/trocas", "/pagamento"];
  const products = await getCatalogProducts();
  return [...routes.map((path) => ({ url: `${base}${path}`, lastModified: new Date() })), ...products.map((product) => ({ url: `${base}/produto/${product.slug}`, lastModified: new Date() }))];
}
