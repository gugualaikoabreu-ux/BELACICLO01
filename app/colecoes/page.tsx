import { CatalogBrowser } from "@/components/catalog-browser";
import { getCatalogProducts, getProductPreparations } from "@/lib/catalog";
import { CampaignVideo } from "@/components/campaign-video";
import { CampaignPhoto } from "@/components/campaign-photo";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Coleções femininas e infantis",
  description: "Explore as coleções de moda feminina e infantil da BelaCiclo e encontre peças para diferentes momentos.",
  canonical: "/colecoes",
});

type Department = "FEMININA" | "INFANTIL";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ categoria?: string; departamento?: Department }> }) {
  const { categoria, departamento } = await searchParams;
  const catalog = await getCatalogProducts();
  const preparations = (await getProductPreparations()).filter((draft) => !catalog.some((product) => product.slug === draft.slug));
  const listing = [...catalog, ...preparations];
  const filtered = listing.filter((product) => (!departamento || product.department === departamento) && (!categoria || product.category === categoria));
  const departmentTitle = categoria ?? (departamento === "INFANTIL" ? "Moda infantil" : departamento === "FEMININA" ? "Moda feminina" : "Coleções");
  return <section className="page-section catalog-page">
    <div className="page-heading"><span className="eyebrow">COLEÇÃO BELACICLO</span><h1>{departmentTitle} para <em>seguir seu ritmo.</em></h1><p>Explore as peças e refine por tamanho, categoria ou faixa de preço.</p></div>
    {categoria === "Alfaiataria" && <div className="collection-campaign-frame"><CampaignVideo src="/campaigns/collection-blazers.mp4" poster="/campaigns/collection-blazers-poster.jpg" label="Blazers organizados em um cabideiro" className="campaign-media--collection" fallback={<CampaignPhoto src="/campaigns/collection-blazers-poster.jpg" alt="Blazers organizados em um cabideiro" movement="pan"/>}/><div className="collection-campaign-caption"><span>ALFAIATARIA BELACICLO</span><p>Uma seleção editorial em movimento.</p></div></div>}
    <CatalogBrowser items={filtered} active={categoria ?? departamento ?? "Todas"}/>
  </section>;
}
