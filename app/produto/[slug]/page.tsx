import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { getCatalogProduct, getCatalogProducts } from "@/lib/catalog";

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  if (!product) return { title: "Peça indisponível", robots: { index: false, follow: false } };
  return {
    title: product.name,
    description: `${product.name} — ${product.note} Confira tamanhos e disponibilidade na BelaCiclo.`,
    alternates: { canonical: `/produto/${product.slug}` },
    openGraph: { title: `${product.name} · BelaCiclo`, description: product.note, type: "website", ...(product.imageUrl ? { images: [{ url: product.imageUrl, alt: product.imageAlt ?? product.name }] } : {}) },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  if (!product) notFound();
  const catalog = await getCatalogProducts();
  const related = product.related.map((id) => catalog.find((item) => item.id === id || item.slug === id)).filter((item) => item !== undefined);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.note,
    category: product.category,
    brand: { "@type": "Brand", name: "BelaCiclo" },
    ...(product.images?.length ? { image: product.images.map((image) => image.url) } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: (product.price / 100).toFixed(2),
      availability: product.variants.some((variant) => variant.available) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/produto/${product.slug}`,
    },
  };
  return <section className="product-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}/><ProductDetail product={product} related={related}/></section>;
}
