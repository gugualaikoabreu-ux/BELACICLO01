import { Icon } from "@/components/icons";
import { storeConfig } from "@/lib/config";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Fale com a Bela Ciclo",
  description: "Entre em contato com a equipe Bela Ciclo pelo e-mail oficial.",
  canonical: "/contato",
});

export default function ContactPage() {
  return <section className="page-section contact-page"><div className="page-heading"><span className="eyebrow">ATENDIMENTO BELA CICLO</span><h1>Conte com a <em>gente.</em></h1><p>O canal oficial de atendimento é o e-mail da loja.</p></div><div className="contact-card"><span className="contact-icon"><Icon name="mail"/></span><div><span className="eyebrow">E-MAIL OFICIAL</span><h2>Estamos por aqui.</h2><p>Envie sua dúvida para a equipe Bela Ciclo.</p><a className="button button-dark" href={`mailto:${storeConfig.email}`}>Enviar e-mail <Icon name="arrow"/></a></div></div></section>;
}
