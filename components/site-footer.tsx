import Link from "next/link";
import { Icon } from "@/components/icons";
import { storeConfig } from "@/lib/config";
import { NewsletterForm } from "@/components/newsletter-form";

export function SiteFooter() {
  return <>
    <section className="club-callout"><div><span className="eyebrow">UM CÍRCULO PARA VOCÊ</span><h2>Faça parte do<br/><em>Clube BelaCiclo.</em></h2><p>Novidades e histórias da marca, direto no seu e-mail.</p></div><NewsletterForm/></section>
    <footer className="site-footer">
      <div className="footer-brand"><Link className="wordmark footer-wordmark" href="/"><span>Bela</span><i>Ciclo</i><small>MODA FEMININA · INFANTIL</small></Link><p>Moda para acompanhar<br/>cada ciclo da vida.</p><a href={`mailto:${storeConfig.email}`} className="social-link"><Icon name="mail"/> {storeConfig.email}</a></div>
      <div className="footer-column"><b>Explore</b><Link href="/colecoes">Coleções</Link><Link href="/colecoes?departamento=FEMININA">Moda feminina</Link><Link href="/colecoes?departamento=INFANTIL">Moda infantil</Link><Link href="/lookbook">Inspire-se</Link></div>
      <div className="footer-column"><b>Atendimento</b><Link href="/faq">Perguntas frequentes</Link><Link href="/entrega">Entrega</Link><Link href="/trocas">Trocas e devoluções</Link><Link href="/contato">Fale com a gente</Link></div>
      <div className="footer-column"><b>Informações</b><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link><Link href="/pagamento">Pagamento</Link><Link href="/minha-conta">Minha conta</Link></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} BelaCiclo · Todos os direitos reservados.</span><span>Moda feminina e infantil.</span></div>
    </footer>
  </>;
}
