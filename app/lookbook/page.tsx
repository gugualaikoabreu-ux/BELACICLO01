import Link from "next/link";
import { CampaignPhoto } from "@/components/campaign-photo";
import { CampaignVideo } from "@/components/campaign-video";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Editorial de moda BelaCiclo",
  description: "Veja a campanha editorial da BelaCiclo em fotos e vídeos de moda feminina à luz natural.",
  canonical: "/lookbook",
});

export default function LookbookPage() {
  return <section className="page-section lookbook-page">
    <div className="page-heading"><span className="eyebrow">CAMPANHA BELACICLO</span><h1>Vestir a vida <em>como ela vem.</em></h1><p>Fotografias editoriais para apresentar a atmosfera da marca.</p></div>
    <div className="lookbook-campaign-frame"><CampaignVideo src="/campaigns/hero-sunlight.mp4" poster="/campaigns/hero-poster.jpg" label="Mulher em um blazer claro à luz do sol" className="campaign-media--lookbook" fallback={<CampaignPhoto src="/campaigns/hero-poster.jpg" alt="Mulher em um blazer claro à luz do sol" movement="zoom"/>}/><div className="lookbook-campaign-caption"><span>EM MOVIMENTO</span><p>Um novo ciclo, no seu próprio ritmo.</p></div></div>
    <div className="lookbook-photo-grid"><figure><CampaignPhoto src="/campaigns/hero-poster.jpg" alt="Mulher em um blazer claro à luz do sol" movement="pan"/><figcaption><span>01 / LUZ NATURAL</span><strong>Texturas que ganham vida.</strong></figcaption></figure><figure><CampaignPhoto src="/campaigns/editorial-blazer-poster.jpg" alt="Detalhe de um blazer branco" movement="zoom"/><figcaption><span>02 / DETALHES</span><strong>Um olhar mais próximo.</strong></figcaption></figure></div>
    <div className="lookbook-closing"><span className="eyebrow">LOJA EM PREPARAÇÃO</span><h2>Moda feminina e infantil<br/>em novos ciclos.</h2><Link href="/colecoes" className="button button-dark">Acompanhar coleção <span>→</span></Link></div>
  </section>;
}
