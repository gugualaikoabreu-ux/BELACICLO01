import Link from "next/link";
import { isAdmin } from "@/lib/admin";
import { AdminCustomers } from "@/components/admin-customers";
export const dynamic = "force-dynamic";
export default async function AdminCustomersPage() { if (!await isAdmin()) return <section className="page-section"><div className="page-heading"><h1>Acesso <em>restrito.</em></h1></div><Link href="/admin">Voltar ao painel →</Link></section>; return <section className="page-section admin-page"><div className="breadcrumbs"><Link href="/admin">Painel</Link><span>/</span><span>Clientes</span></div><div className="page-heading"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Área de <em>clientes.</em></h1><p>Dados limitados ao necessário para atendimento e pedidos.</p></div><AdminCustomers/></section>; }
