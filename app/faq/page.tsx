import { createPageMetadata } from "@/lib/seo";
import { FaqList } from "@/components/faq-list";
export const metadata = createPageMetadata({
  title: "Perguntas frequentes",
  description: "Tire dúvidas sobre pedidos, pagamentos, entregas, trocas e atendimento da BelaCiclo.",
  canonical: "/faq",
});
export default function FAQPage() { return <section className="page-section faq-page"><div className="page-heading"><span className="eyebrow">ESTAMOS AQUI PARA AJUDAR</span><h1>Vamos esclarecer <em>as coisas.</em></h1><p>Respostas honestas sobre a loja e o que ainda está sendo preparado.</p></div><FaqList/></section>; }
