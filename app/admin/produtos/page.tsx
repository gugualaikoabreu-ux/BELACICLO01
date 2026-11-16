import Link from "next/link";
import { isAdmin } from "@/lib/admin";
import { AdminProducts } from "@/components/admin-products";
export const dynamic = "force-dynamic";
export default async function AdminProductsPage() { if (!await isAdmin()) return <section className="page-section"><div className="page-heading"><h1>Acesso <em>restrito.</em></h1></div><Link href="/admin">Voltar ao painel →</Link></section>; return <section className="page-section admin-page"><div className="breadcrumbs"><Link href="/admin">Painel</Link><span>/</span><span>Produtos</span></div><div className="page-heading"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Catálogo de <em>produtos.</em></h1></div><AdminProducts/></section>; }
