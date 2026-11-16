"use client";

import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/products";

export function ProductGrid({ items, limit }: { items: Product[]; limit?: number }) {
  return <div className="product-grid">{items.slice(0, limit).map((product, index) => <ProductCard key={product.id} product={product} index={index}/>)}</div>;
}
