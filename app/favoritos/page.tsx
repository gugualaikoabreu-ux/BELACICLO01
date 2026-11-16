"use client";

import Link from "next/link";
import { ProductGrid } from "@/components/product-grid";
import { useStore } from "@/components/store-context";

export default function FavoritesPage() {
  const { favorites, catalog } = useStore();
  const saved = catalog.filter((product) => favorites.includes(product.id));
  return <section className="page-section"><div className="page-heading"><span className="eyebrow">SELEÇÃO PESSOAL</span><h1>Seus <em>favoritos.</em></h1><p>Peças que você guardou para rever.</p></div>{saved.length ? <ProductGrid items={saved}/> : <div className="empty-state"><span className="empty-glyph">♡</span><h2>Seu espaço, do seu jeito.</h2><p>Toque no coração de uma peça para salvá-la aqui.</p><Link className="button button-outline" href="/colecoes">Explorar peças <span>→</span></Link></div>}</section>;
}
