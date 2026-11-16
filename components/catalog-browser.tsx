"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CatalogFilters } from "@/components/catalog-filters";
import { ProductGrid } from "@/components/product-grid";
import type { Product } from "@/lib/products";

export function CatalogBrowser({ items, active }: { items: Product[]; active: string }) {
  const [size, setSize] = useState("");
  const [sort, setSort] = useState("featured");
  const [query, setQuery] = useState("");
  const router = useRouter();
  const sizes = [...new Set(items.flatMap((product) => product.sizes))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const categories = [...new Set(items.map((product) => product.category))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const visible = useMemo(() => {
    const result = items.filter((product) => (!size || product.sizes.includes(size)) && (!query || `${product.name} ${product.category} ${product.note}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))));
    if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
    if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return result;
  }, [items, size, sort, query]);

  return <>
    <CatalogFilters active={active}/>
    <div className="catalog-toolbar" aria-label="Pesquisar e refinar produtos">
      <label className="catalog-search"><span>Buscar na coleção</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome ou categoria"/></label>
      <label><span>Tamanho</span><select value={size} onChange={(event) => setSize(event.target.value)}><option value="">Todos</option>{sizes.map((value) => <option key={value}>{value}</option>)}</select></label>
      {categories.length > 1 && <label><span>Categoria</span><select value={categories.includes(active) ? active : ""} onChange={(event) => { const value = event.target.value; router.push(value ? `/colecoes?categoria=${encodeURIComponent(value)}` : "/colecoes"); }}><option value="">Todas</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>}
      <label><span>Ordenar</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Destaques</option><option value="name">Nome</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option></select></label>
    </div>
    {visible.length ? <ProductGrid items={visible}/> : <div className="empty-state catalog-empty"><span className="empty-glyph">B.</span><h2>Nenhuma peça encontrada.</h2><p>Ajuste o tamanho ou a busca para ver outros itens desta coleção.</p></div>}
    <p className="catalog-result-count" aria-live="polite">{visible.length} {visible.length === 1 ? "peça" : "peças"} nesta seleção</p>
  </>;
}
