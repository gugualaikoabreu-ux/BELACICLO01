"use client";

import { useStore } from "@/components/store-context";
import { ProductCard } from "@/components/product-card";
export function RecentlyViewed() {
  const { viewed, catalog } = useStore();
  const recent = viewed.map((id) => catalog.find((product) => product.id === id)).filter((product) => product !== undefined);
  if (!recent.length) return null;
  return <section className="recent-section section-wrap"><div className="section-heading"><div><span className="eyebrow">RETOME DE ONDE PAROU</span><h2>Vistas <em>recentemente.</em></h2></div></div><div className="product-grid">{recent.slice(0, 4).map((product, index) => <ProductCard key={product.id} product={product} index={index}/>)}</div></section>;
}
