import { NewsletterForm } from "@/components/newsletter-form";
import { createPageMetadata } from "@/lib/seo";
const confirmationEmailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export const metadata = createPageMetadata({
  title: "Clube BelaCiclo",
  description: "Receba novidades e histórias da marca no seu e-mail. Inscreva-se no Clube BelaCiclo.",
  canonical: "/clube",
});

export default function ClubPage() { return <section className="page-section club-page"><div className="page-heading"><span className="eyebrow">UM CÍRCULO PARA VOCÊ</span><h1>Bem-vinda ao <em>Clube BelaCiclo.</em></h1><p>Novidades e histórias da marca, direto no seu e-mail.</p></div><div className="club-page-panel"><div className="club-orbit">B</div><div><span className="eyebrow">INSCRIÇÃO COM CONSENTIMENTO</span><h2>Vamos manter contato?</h2><p>{confirmationEmailConfigured ? "Sua inscrição só fica ativa depois que você confirma o link enviado por e-mail. Você poderá cancelar quando quiser pelo link de descadastro." : "A inscrição exige confirmação por e-mail. O serviço de envio ainda não está configurado neste ambiente; a confirmação poderá ficar pendente até essa configuração ser concluída."}</p><NewsletterForm/></div></div></section>; }
