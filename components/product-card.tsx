"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { ProductArt } from "@/components/product-art";
import { useStore } from "@/components/store-context";
import { formatCurrency } from "@/lib/config";
import type { Product } from "@/lib/products";
import { trackStoreEvent } from "@/lib/analytics-client";
import { useRouter } from "next/navigation";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { toggleFavorite, isFavorite, addToCart } = useStore();
  const router = useRouter();
  return <article className="product-card" style={{ animationDelay: `${index * 70}ms` }}>
    <div className="product-visual">
      {product.isPreparation ? <ProductArt product={product}/> : <Link href={`/produto/${product.slug}`} aria-label={`Ver ${product.name}`}><ProductArt product={product}/></Link>}
      {!product.isPreparation && <button className={`favorite-button ${isFavorite(product.id) ? "is-favorite" : ""}`} onClick={() => toggleFavorite(product.id)} aria-label={isFavorite(product.id) ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}><Icon name="heart"/></button>}
      {product.isPreparation
        ? <button className="quick-add" disabled aria-label={`${product.name}: estoque não confirmado`}><span>Estoque não confirmado</span></button>
        : <button className="quick-add" disabled={!product.variants.length} onClick={() => { if (product.variants.length !== 1) { router.push(`/produto/${product.slug}`); return; } const variant = product.variants[0]; addToCart(product.id, variant.size ?? "Único", 1, variant.id, variant.color ?? ""); trackStoreEvent("add_to_cart", { currency: "BRL", value: product.price / 100, items: [{ item_id: product.id, item_name: product.name, item_category: product.category, price: product.price / 100, quantity: 1 }] }); }}><Icon name={product.variants.length !== 1 ? "arrow" : "plus"}/>{product.variants.length !== 1 ? " Escolher variação" : " Adicionar"}</button>}
    </div>
    <div className="product-info"><div>{product.isPreparation ? <span className="product-name">{product.name}</span> : <Link href={`/produto/${product.slug}`} className="product-name">{product.name}</Link>}<span className="product-note">{product.isPreparation ? (product.sizes.length ? `Tamanhos informados: ${product.sizes.join(" · ")}` : "Tamanhos e disponibilidade em cadastro") : `${product.colorName} · ${product.category}`}</span></div><span className="product-price">{product.isPreparation && product.price <= 0 ? "Preço a confirmar" : <>{product.regularPrice && product.regularPrice > product.price && <s>{formatCurrency(product.regularPrice)} </s>}{formatCurrency(product.price)}</>}</span></div>
  </article>;
}
