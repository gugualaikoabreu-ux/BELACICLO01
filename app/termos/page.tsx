import { PolicyContent } from "@/components/policy-content";
import { createPageMetadata } from "@/lib/seo";
import { storeConfig } from "@/lib/config";

export const metadata = createPageMetadata({
  title: "Termos de uso",
  description: "Consulte as condições de uso dos canais digitais da BelaCiclo.",
  canonical: "/termos",
});

export default function TermsPage() { return <PolicyContent title="Termos de uso" intro="Condições gerais para navegação nos canais BelaCiclo." sections={[
  { title: "Identificação da loja", body: "Razão social, CNPJ, endereço e contato comercial ainda precisam ser fornecidos pela responsável e revisados antes da abertura comercial." },
  { title: "Disponibilidade da loja", body: "O catálogo apresenta apenas produtos publicados com fotografia e disponibilidade confirmada. Peças identificadas como preparação não podem ser compradas. O checkout exige uma conta com e-mail confirmado e depende das configurações de pagamento e entrega." },
  { title: "Uso dos canais", body: "Ao navegar, o visitante deve utilizar os canais de forma lícita e respeitar os direitos sobre marcas, conteúdo e dados pessoais. Estes termos precisam de revisão jurídica e complementação antes da publicação comercial." },
  { title: "Atendimento e legislação", body: `As relações de consumo seguirão a legislação brasileira aplicável. O canal oficial disponível é o e-mail ${storeConfig.email}. Razão social, CNPJ e endereço da loja ainda precisam ser informados e revisados antes da abertura comercial.` }
]}/>; }
