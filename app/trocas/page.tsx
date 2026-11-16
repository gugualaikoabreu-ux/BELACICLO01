import { PolicyContent } from "@/components/policy-content";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Trocas e devoluções",
  description: "Consulte as informações da BelaCiclo sobre trocas, devoluções e atendimento pós-compra.",
  canonical: "/trocas",
});

export default function ReturnsPage() { return <PolicyContent title="Trocas e devoluções" intro="Uma política clara e respeitosa será publicada com os procedimentos reais da loja." sections={[
  { title: "Direito de arrependimento", body: "Nas compras realizadas fora do estabelecimento comercial, o consumidor conta com o direito de arrependimento no prazo legal previsto no Código de Defesa do Consumidor, observadas as hipóteses aplicáveis. O exercício do direito não será restringido por esta página." },
  { title: "Produtos com defeito", body: "O atendimento de produtos com vício ou defeito observará os direitos e prazos legais. Instruções de solicitação, logística reversa e reembolso serão detalhadas após a definição do processo operacional." },
  { title: "Como solicitar", body: "O procedimento de troca, devolução e reembolso ainda será configurado. Para a abertura comercial, a loja deve publicar canal de atendimento, etapas, prazos e orientações compatíveis com a legislação." },
  { title: "Revisão", body: "Este conteúdo é preliminar e deve ser revisado com os dados empresariais e a operação real da BelaCiclo antes de entrar em vigor." }
]}/>; }
