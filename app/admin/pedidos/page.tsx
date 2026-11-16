import Link from "next/link";
import { isAdmin } from "@/lib/admin";
import { AdminOrders } from "@/components/admin-orders";
export const dynamic = "force-dynamic";
export default async function AdminOrdersPage() { if (!await isAdmin()) return <section className="page-section"><div className="page-heading"><h1>Acesso <em>restrito.</em></h1></div><Link href="/admin">Voltar ao painel →</Link></section>; return <section className="page-section admin-page"><div className="breadcrumbs"><Link href="/admin">Painel</Link><span>/</span><span>Pedidos</span></div><div className="page-heading"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Pedidos e <em>entregas.</em></h1><p>Confirme pagamentos somente depois de conferir o crédito no banco. O webhook está desativado.</p></div><AdminOrders/></section>; }
