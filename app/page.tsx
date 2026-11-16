import Link from "next/link";
import { ProductGrid } from "@/components/product-grid";
import { getCatalogProducts } from "@/lib/catalog";
import { Icon } from "@/components/icons";
import { RecentlyViewed } from "@/components/recently-viewed";
import { CampaignPhoto } from "@/components/campaign-photo";
import { CampaignVideo } from "@/components/campaign-video";
import { storeConfig } from "@/lib/config";
import { getProductPreparations } from "@/lib/catalog";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Moda feminina e infantil",
  description: "Conheça as coleções feminina e infantil da BelaCiclo e encontre peças para acompanhar cada fase da vida.",
  canonical: "/",
});

export default async function HomePage() {
  const catalog = await getCatalogProducts();
  const preparations = (await getProductPreparations()).filter((draft) => !catalog.some((product) => product.slug === draft.slug));
  const featured = [...catalog, ...preparations];
  return <>
    <section className="hero">
      <div className="hero-copy"><span className="eyebrow">MODA FEMININA · MODA INFANTIL</span><h1><span className="reveal-line">Seu estilo,</span><em className="reveal-line reveal-delay">em movimento.</em></h1><p>Uma nova experiência BelaCiclo está sendo preparada para vestir diferentes fases da vida.</p><Link className="button button-dark" href="/colecoes">Explorar a loja <Icon name="arrow"/></Link><small className="hero-caption">BelaCiclo · uma história em movimento</small></div>
      <div className="hero-art hero-art--campaign"><CampaignVideo src="/campaigns/editorial-walk-blue.mp4" poster="/campaigns/editorial-walk-poster.jpg" label="Modelo caminhando com macacão azul e bolsa" eager className="campaign-media--hero" fallback={<CampaignPhoto src="/campaigns/editorial-walk-poster.jpg" alt="Modelo caminhando com macacão azul e bolsa ao ar livre" movement="zoom" priority/>}/><div className="hero-side-note">01 / BELACICLO</div><div className="hero-credit">CAMPANHA · EM MOVIMENTO</div></div>
      <a href="#colecao" className="hero-scroll">Role para descobrir <span>↓</span></a>
    </section>

    <section className="category-section section-wrap scroll-reveal" id="colecao"><div className="section-heading"><div><span className="eyebrow">ENCONTRE SEU CAMINHO</span><h2>Uma loja para <em>cada ciclo.</em></h2></div></div><div className="department-grid">
      <Link className="department-card department-card--women" href="/colecoes?departamento=FEMININA"><span className="department-index">01 / COLEÇÃO</span><div><h3>Moda feminina</h3><p>Conheça as peças disponíveis no catálogo oficial.</p></div><span className="category-arrow"><Icon name="arrow"/></span></Link>
      <Link className="department-card department-card--kids" href="/colecoes?departamento=INFANTIL"><span className="department-index">02 / COLEÇÃO</span><div><h3>Moda infantil</h3><p>Uma nova coleção está sendo preparada.</p></div><span className="category-arrow"><Icon name="arrow"/></span></Link>
    </div></section>

    <section className="featured-section scroll-reveal"><div className="section-wrap"><div className="section-heading"><div><span className="eyebrow">CATÁLOGO BELACICLO</span><h2>Peças para <em>este momento.</em></h2></div><span className="demo-notice">{catalog.length ? "Disponibilidade confirmada no cadastro" : "Seleção em preparação"}</span></div><ProductGrid items={featured} limit={4}/><p className="catalog-disclosure">As peças sem fotografia oficial ou estoque confirmado aparecem como preparação e não podem ser compradas.</p><div className="center-action"><Link className="button button-outline" href="/colecoes">Ver catálogo <Icon name="arrow"/></Link></div></div></section>

    <section className="editorial-section scroll-reveal"><div className="editorial-visual editorial-visual--campaign"><CampaignVideo src="/campaigns/editorial-blazer-detail.mp4" poster="/campaigns/editorial-blazer-poster.jpg" label="Detalhe das mãos tocando a textura de um blazer branco" className="campaign-media--editorial" fallback={<CampaignPhoto src="/campaigns/editorial-blazer-poster.jpg" alt="Detalhe das mãos tocando a textura de um blazer branco" movement="pan"/>}/><span>TEXTURAS · DETALHES · BELACICLO</span></div><div className="editorial-text"><span className="eyebrow">SOBRE A BELACICLO</span><h2>Moda para os<br/>seus <em>movimentos.</em></h2><p>A vida acontece em muitas fases. BelaCiclo acompanha cada ciclo com uma seleção que reúne moda feminina e infantil.</p><Link className="text-link" href="/lookbook">Conheça nosso universo <Icon name="arrow"/></Link></div></section>

    <section className="lookbook-section section-wrap scroll-reveal"><div className="lookbook-head"><span className="eyebrow">INSPIRAÇÃO EM MOVIMENTO</span><h2>Um olhar <em>para a coleção.</em></h2><p>Fotografias editoriais da campanha BelaCiclo.</p></div><Link href="/lookbook" className="lookbook-preview"><CampaignPhoto src="/campaigns/hero-poster.jpg" alt="Mulher em um blazer claro à luz do sol" movement="pan"/><span className="lookbook-preview-label">Ver campanha completa <Icon name="arrow"/></span></Link></section>

    <section className="promise-strip scroll-reveal"><div><span className="promise-icon">01</span><h3>Feminino</h3><p>Uma coleção em preparação.</p></div><div><span className="promise-icon">02</span><h3>Infantil</h3><p>Um novo ciclo em breve.</p></div><div><span className="promise-icon">03</span><h3>Atendimento</h3><p>Fale com a BelaCiclo pelo e-mail oficial.</p></div></section>
    <RecentlyViewed/>
    <section className="instagram-section scroll-reveal"><div><span className="eyebrow">ATENDIMENTO BELA CICLO</span><h2>Vamos conversar <em>por e-mail?</em></h2><a className="text-link" href={`mailto:${storeConfig.email}`}><Icon name="mail"/> {storeConfig.email} <Icon name="arrow"/></a></div><a className="instagram-art" href={`mailto:${storeConfig.email}`} aria-label={`Enviar e-mail para ${storeConfig.email}`}><div className="insta-window"><span>B</span><i>Ciclo</i></div><small>CANAL OFICIAL · E-MAIL</small></a></section>
  </>;
}
