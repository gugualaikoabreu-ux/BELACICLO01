import { ProductGrid } from "@/components/product-grid";
import { getCatalogProducts, getProductPreparations } from "@/lib/catalog";
import { createPageMetadata } from "@/lib/seo";

type SearchPageProps = { searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const term = q.trim().slice(0, 80);
  return createPageMetadata({
    title: term ? `Resultados da busca: ${term}` : "Buscar produtos",
    description: term ? `Resultados de busca por ${term} no catálogo da BelaCiclo.` : "Pesquise peças no catálogo feminino e infantil da BelaCiclo.",
    noIndex: true,
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const catalog = await getCatalogProducts();
  const preparations = (await getProductPreparations()).filter((draft) => !catalog.some((product) => product.slug === draft.slug));
  const listing = [...catalog, ...preparations];
  const term = q.toLocaleLowerCase("pt-BR");
  const result = listing.filter((p) => `${p.name} ${p.category} ${p.note}`.toLocaleLowerCase("pt-BR").includes(term));
  return <section className="page-section"><div className="page-heading"><span className="eyebrow">PESQUISA</span><h1>Resultados para <em>“{q || "tudo"}”</em></h1><p>{result.length} peça(s) encontrada(s); itens em preparação não podem ser comprados.</p></div>{result.length ? <ProductGrid items={result}/> : <p className="empty-note">Não encontramos peças com esse termo. <a href="/colecoes">Explore as coleções</a>.</p>}</section>;
}
