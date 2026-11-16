import Link from "next/link";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { getCorreiosSetupStatus } from "@/lib/shipping/correios";
import { getStoreShippingSettings } from "@/lib/shipping/store-settings";
import { AdminShippingSettings } from "@/components/admin-shipping-settings";

export const dynamic = "force-dynamic";

const credentialStatus = [
  ["Usuário / ID Correios", "CORREIOS_ID_CORREIOS"],
  ["Código de acesso às APIs do CWS", "CORREIOS_API_ACCESS_CODE"],
  ["Número do contrato Correios", "CORREIOS_CONTRACT"],
  ["Cartão de postagem ativo", "CORREIOS_POSTING_CARD"],
  ["Diretoria Regional do contrato", "CORREIOS_DR"],
] as const;

export default async function AdminShippingPage() {
  if (!await isAdmin()) return <section className="page-section"><div className="page-heading"><h1>Acesso <em>restrito.</em></h1></div><Link href="/admin">Voltar ao painel →</Link></section>;

  const setup = getCorreiosSetupStatus();
  const storeSettings = await getStoreShippingSettings();
  const shippingHistory = storeSettings.settingsTableAvailable
    ? await getDb().shippingSettingsHistory.findMany({ where: { settingsId: "store" }, orderBy: { createdAt: "desc" }, take: 30 }).catch(() => [])
    : [];
  const fixedRateConfigured = storeSettings.fixedShippingEnabled && storeSettings.fixedShippingCents !== null;
  const incompletePackageCount = await getDb().product.count({
    where: {
      active: true,
      demo: false,
      OR: [
        { weightGrams: null },
        { weightGrams: { lte: 0 } },
        { weightGrams: { gt: 30_000 } },
        { lengthCm: null },
        { lengthCm: { lte: 0 } },
        { lengthCm: { gt: 100 } },
        { widthCm: null },
        { widthCm: { lte: 0 } },
        { widthCm: { gt: 100 } },
        { heightCm: null },
        { heightCm: { lte: 0 } },
        { heightCm: { gt: 100 } },
      ],
    },
  });
  const origin = storeSettings.originPostalCode.length === 8 ? `${storeSettings.originPostalCode.slice(0, 5)}-${storeSettings.originPostalCode.slice(5)}` : storeSettings.originPostalCode;

  return <section className="page-section admin-page">
    <div className="breadcrumbs"><Link href="/admin">Painel</Link><span>/</span><span>Frete</span></div>
    <div className="page-heading"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Configurações de <em>frete.</em></h1><p>Gerencie tarifas regionais, frete fixo, frete grátis e Correios.</p></div>
    <div className="checkout-status">
      <b>{setup.ready ? "Credenciais preenchidas; valide a cotação em homologação" : "Integração aguardando credenciais"}</b>
      <p>CEP de origem: <strong>{origin}</strong> · Ambiente: <strong>{setup.mode === "production" ? "Produção" : "Homologação"}</strong> · Serviços candidatos: {setup.services.map((service) => `${service.name} (${service.code})`).join(", ") || "não configurados"}.</p>
      {!setup.ready && <p>Sem credenciais válidas dos Correios, o checkout oferece as tarifas regionais configuradas ou modalidades manuais ativas. Sem preço real disponível, a finalização fica bloqueada.</p>}
    </div>

    <div className="admin-metrics">
      <article><span>CEP de origem</span><b>{origin}</b><small>Regra do painel; usa a variável do servidor como fallback</small></article>
      <article><span>Produtos ativos sem pacote completo</span><b>{incompletePackageCount}</b><small>Precisam de peso e 3 dimensões reais</small></article>
      <article><span>Frete regional</span><b>{storeSettings.regionalShippingEnabled ? "Ativo" : "Inativo"}</b><small>Tarifas por município do CEP</small></article>
      <article><span>Frete fixo</span><b>{fixedRateConfigured ? "Ativo" : "Inativo"}</b><small>Ativado somente com tarifa informada</small></article>
    </div>

    <AdminShippingSettings initialSettings={storeSettings} initialHistory={shippingHistory} correiosAvailable={setup.ready} requiresMigration={!storeSettings.settingsTableAvailable}/>

    <div className="shipping-admin-list">
      <h2>Credenciais e permissões que faltam</h2>
      <p>Os valores nunca são exibidos aqui. Adicione credenciais apenas às variáveis privadas do servidor (arquivo local <code>.env.local</code> em desenvolvimento ou variáveis do provedor em produção), sem prefixo <code>NEXT_PUBLIC_</code>.</p>
      <ul>{credentialStatus.map(([label, key]) => <li key={key}>{label} (<code>{key}</code>): {process.env[key]?.trim() ? "configurado" : "pendente"}</li>)}</ul>
      <p>Para PAC/SEDEX, o contrato deve ter as APIs Correios <strong>PREÇOS (38202)</strong> e <strong>PRAZOS (38210)</strong> vinculadas ao cartão de postagem. Informe o número do contrato e a respectiva <code>CORREIOS_DR</code>. Teste primeiro em homologação e só depois altere <code>CORREIOS_MODE</code> para produção.</p>
      {setup.missing.length > 0 && <p><strong>Pendências identificadas:</strong> {setup.missing.join(" · ")}</p>}
      <p>Os códigos de produto podem ser ajustados pela variável privada <code>CORREIOS_SERVICE_CODES</code>. A loja só mostra as modalidades PAC/SEDEX que os Correios conseguirem cotar para o CEP e a embalagem da sacola.</p>
    </div>

    <div className="shipping-admin-list">
      <h2>Dados reais das embalagens</h2>
      <p>Preencha peso, comprimento, largura e altura na seção <strong>Produtos → Editar peça, envio e tamanhos</strong>, usando a embalagem pronta para postagem. Produtos sem qualquer um desses dados ficam fora da cotação dos Correios.</p>
      <Link className="button button-outline" href="/admin/produtos">Revisar dados de envio dos produtos →</Link>
    </div>
  </section>;
}
