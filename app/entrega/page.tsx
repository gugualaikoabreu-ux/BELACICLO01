import { PolicyContent } from "@/components/policy-content";
import { createPageMetadata } from "@/lib/seo";
import { hasCorreiosSettings } from "@/lib/shipping/correios";
import { getStoreShippingSettings } from "@/lib/shipping/store-settings";
import { formatCurrency } from "@/lib/config";

export const metadata = createPageMetadata({
  title: "Entrega e frete",
  description: "Saiba como a BelaCiclo calcula, combina e acompanha a entrega dos pedidos.",
  canonical: "/entrega",
});

export default async function DeliveryPage() {
  const correiosReady = hasCorreiosSettings();
  const settings = await getStoreShippingSettings();
  const regionalActive = settings.settingsTableAvailable && settings.regionalShippingEnabled;
  const correiosActive = correiosReady && settings.correiosShippingEnabled;
  const intro = correiosActive
    ? "O checkout consulta preço e prazo dos Correios com o CEP de origem 81570-001, o CEP de destino e as dimensões cadastradas para os produtos."
    : regionalActive
      ? "O checkout identifica a região pelo CEP e consulta a tarifa regional configurada pela BelaCiclo. A cotação automática dos Correios depende de contrato e credenciais."
      : "O checkout só permite finalizar quando consegue apresentar um preço de entrega válido. As regras regionais estão aguardando ativação; a cotação dos Correios também depende de contrato e credenciais.";
  return <PolicyContent title="Política de entrega" intro={intro} sections={[
    { title: "Tarifas regionais", body: regionalActive ? `${formatCurrency(settings.curitibaMetroShippingCents)} para Curitiba e os 29 municípios da Região Metropolitana, ${formatCurrency(settings.interiorParanaShippingCents)} para o interior do Paraná e ${formatCurrency(settings.otherStatesShippingCents)} para outros estados. A cidade e a UF são confirmadas pelo CEP no servidor. A tarifa aplicada fica registrada no pedido; alterações futuras não recalculam pedidos existentes.` : "As tarifas regionais iniciais definidas são R$ 10,00 para Curitiba e os 29 municípios da Região Metropolitana, R$ 20,00 para o interior do Paraná e R$ 30,00 para outros estados. Elas só serão exibidas no checkout quando essa modalidade estiver ativa." },
    { title: "PAC e SEDEX", body: !correiosReady ? "A consulta PAC e SEDEX depende das credenciais, serviços e permissões de contrato dos Correios. Nenhum prazo ou valor é presumido." : correiosActive ? "Quando os Correios disponibilizam uma modalidade para o CEP e a embalagem, o checkout apresenta o preço e o prazo retornados pela API." : "As credenciais estão disponíveis, mas essa opção ainda precisa ser ativada pelo painel administrativo." },
    { title: "Outras regras configuráveis", body: "Frete fixo nacional e frete grátis por valor mínimo são opções administrativas independentes, inicialmente desativadas. Se ativadas, aparecem junto às tarifas regionais no checkout. Sem preço real de entrega, o checkout bloqueia a finalização." },
    { title: "Prazo estimado", body: "O painel pode informar uma faixa estimada em dias úteis para as tarifas da loja. O prazo exibido é salvo como snapshot no pedido; para Correios, o checkout usa o prazo retornado na cotação oficial." },
    { title: "Acompanhamento", body: "Depois da postagem, a equipe poderá registrar o código e o link oficial de rastreamento no pedido. Não exibimos prazos ou atualizações estimadas." },
  ]}/>;
}
