import type { Product } from "@/lib/products";
import Image from "next/image";

export function ProductArt({ product, className = "" }: { product: Product; className?: string }) {
  if (product.imageUrl) {
    return <div className={`product-art ${className}`}>
      <Image className="catalog-photo" src={product.imageUrl} alt={product.imageAlt || product.name} fill sizes="(max-width: 720px) 50vw, (max-width: 1100px) 33vw, 25vw" unoptimized loading="lazy"/>
    </div>;
  }

  return <div className={`product-art product-art--missing ${className}`} role="img" aria-label={`Fotografia oficial de ${product.name} necessária`}>
    <span>Fotografia da peça</span>
    <small>Imagem oficial em preparação</small>
  </div>;
}
