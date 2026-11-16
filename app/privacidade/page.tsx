import { PolicyContent } from "@/components/policy-content";
import { createPageMetadata } from "@/lib/seo";
import { storeConfig } from "@/lib/config";

export const metadata = createPageMetadata({
  title: "Política de privacidade",
  description: "Entenda como a BelaCiclo pretende tratar dados pessoais e solicitações de privacidade.",
  canonical: "/privacidade",
});

export default function PrivacyPage() { return <PolicyContent title="Política de privacidade" intro="Como a BelaCiclo pretende tratar os dados pessoais em seus canais digitais." sections={[
  { title: "Controlador e contato", body: `A razão social e o CNPJ do controlador ainda precisam ser fornecidos. O contato oficial disponível para dúvidas e solicitações de privacidade é ${storeConfig.email}. Não inserimos dados de empresa fictícios.` },
  { title: "Dados e finalidades", body: "A aplicação utiliza Supabase Auth e PostgreSQL para contas, endereços e pedidos. A newsletter registra consentimento e exige confirmação por e-mail; essa confirmação depende da configuração do serviço de envio em cada ambiente." },
  { title: "Cookies e métricas", body: "O carrinho, favoritos e itens vistos usam armazenamento local do navegador nesta demonstração. A integração com Google Analytics está desativada até a definição do identificador e da gestão de consentimento." },
  { title: "Direitos e retenção", body: `Solicitações de acesso, correção, portabilidade, eliminação e demais direitos previstos na LGPD podem ser enviadas para ${storeConfig.email}. Os prazos de retenção devem ser definidos conforme as obrigações aplicáveis e as finalidades reais.` },
  { title: "Segurança e compartilhamento", body: "Integrações com pagamento, entrega, hospedagem, envio de e-mail e armazenamento de imagens só devem ser ativadas com fornecedores definidos, contratos e controles de acesso revisados." }
]}/>; }
