import Link from "next/link";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { formatCurrency } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

async function readMetric<T>(name: string, query: () => Promise<T>): Promise<T | null> {
  try {
    return await query();
  } catch (error) {
    console.error("[admin dashboard] metric unavailable", name, error instanceof Error ? error.name : "UnknownError");
    return null;
  }
}

export default async function AdminPage() {
  if (!process.env.DATABASE_URL || !isSupabaseConfigured) return <section className="page-section admin-page"><div className="page-heading"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Configuração <em>pendente.</em></h1><p>Conecte o banco de dados e configure a autenticação do Supabase antes de abrir o painel.</p></div></section>;
  if (!await isAdmin()) return <section className="page-section admin-page"><div className="page-heading"><span className="eyebrow">ACESSO RESTRITO</span><h1>Área <em>administrativa.</em></h1><p>Entre com uma conta autorizada e verificada da BelaCiclo.</p></div><Link href="/minha-conta" className="button button-dark">Entrar na conta →</Link></section>;

  const db = getDb();
  const [sales, orderCount, pendingRows, paidCount, sentCount, cancelledCount, productCount, lowStockRows, customerCount] = await Promise.all([
    readMetric("sales", () => db.order.aggregate({ where: { paymentStatus: "APPROVED" }, _sum: { total: true } })),
    readMetric("orders", () => db.order.count()),
    readMetric("pending-orders", () => db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS "count" FROM "orders" WHERE "paymentStatus"::text IN ('PENDING', 'PROOF_RECEIVED', 'UNIDENTIFIED')`),
    readMetric("paid-orders", () => db.order.count({ where: { paymentStatus: "APPROVED" } })),
    readMetric("sent-orders", () => db.order.count({ where: { status: "SHIPPED" } })),
    readMetric("cancelled-orders", () => db.order.count({ where: { status: "CANCELLED" } })),
    readMetric("products", () => db.product.count()),
    readMetric("low-stock", () => db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS "count" FROM "product_variants" v JOIN "products" p ON p."id" = v."productId" WHERE p."active" = true AND p."demo" = false AND v."active" = true AND (v."stock" - v."reserved") <= 5`),
    readMetric("customers", () => db.user.count())
  ]);

  const pendingCount = pendingRows ? Number(pendingRows[0]?.count ?? BigInt(0)) : null;
  const lowStockCount = lowStockRows ? Number(lowStockRows[0]?.count ?? BigInt(0)) : null;
  const metrics = [
    { title: "Faturamento confirmado", value: sales ? formatCurrency(sales._sum.total ?? 0) : "—", detail: sales ? "Somente pagamentos conferidos no banco" : "Indicador indisponível" },
    { title: "Pedidos", value: orderCount === null ? "—" : String(orderCount), detail: orderCount === null ? "Indicador indisponível" : "Todos os status" },
    { title: "Aguardando conferência", value: pendingCount === null ? "—" : String(pendingCount), detail: pendingCount === null ? "Indicador indisponível" : "PIX aguardando ou em revisão" },
    { title: "Pedidos pagos", value: paidCount === null ? "—" : String(paidCount), detail: paidCount === null ? "Indicador indisponível" : "Confirmação registrada" },
    { title: "Pedidos enviados", value: sentCount === null ? "—" : String(sentCount), detail: sentCount === null ? "Indicador indisponível" : "Em transporte" },
    { title: "Pedidos cancelados", value: cancelledCount === null ? "—" : String(cancelledCount), detail: cancelledCount === null ? "Indicador indisponível" : "Cancelados ou expirados" },
    { title: "Produtos cadastrados", value: productCount === null ? "—" : String(productCount), detail: productCount === null ? "Indicador indisponível" : "Catálogo administrativo" },
    { title: "Estoque baixo", value: lowStockCount === null ? "—" : String(lowStockCount), detail: lowStockCount === null ? "Indicador indisponível" : "Variações com até 5 unidades" },
    { title: "Clientes", value: customerCount === null ? "—" : String(customerCount), detail: customerCount === null ? "Indicador indisponível" : "Contas cadastradas" }
  ];
  const hasUnavailableMetrics = metrics.some((metric) => metric.value === "—");

  return <section className="page-section admin-page"><div className="page-heading"><span className="eyebrow">PAINEL BELACICLO</span><h1>Visão <em>da loja.</em></h1><p>Indicadores calculados a partir dos dados cadastrados.</p></div>{hasUnavailableMetrics && <p className="admin-data-warning" role="status">Alguns indicadores não puderam ser consultados. O restante do painel continua disponível; confira a conexão e o schema do banco.</p>}<div className="admin-metrics">{metrics.map((metric) => <article key={metric.title}><span>{metric.title}</span><b>{metric.value}</b><small>{metric.detail}</small></article>)}</div><div className="admin-nav"><Link href="/admin/produtos"><span>01</span><b>Produtos</b><small>Catálogo, variações e estoque</small><i>→</i></Link><Link href="/admin/categorias"><span>02</span><b>Categorias</b><small>Organização do catálogo</small><i>→</i></Link><Link href="/admin/pedidos"><span>03</span><b>Pedidos</b><small>Pagamento, status e rastreamento</small><i>→</i></Link><Link href="/admin/clientes"><span>04</span><b>Clientes</b><small>Contas e pedidos associados</small><i>→</i></Link><Link href="/admin/marketing"><span>05</span><b>Marketing</b><small>Campanhas e Clube BelaCiclo</small><i>→</i></Link><Link href="/admin/frete"><span>06</span><b>Frete</b><small>Correios, embalagens e credenciais</small><i>→</i></Link></div></section>;
}
