import Link from "next/link";
import { isAdmin } from "@/lib/admin";
import { AdminMarketing } from "@/components/admin-marketing";
export const dynamic = "force-dynamic";
export default async function AdminMarketingPage() { if (!await isAdmin()) return <section className="page-section"><div className="page-heading"><h1>Acesso <em>restrito.</em></h1></div><Link href="/admin">Voltar ao painel →</Link></section>; return <section className="page-section admin-page"><div className="breadcrumbs"><Link href="/admin">Painel</Link><span>/</span><span>Marketing</span></div><div className="page-heading"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Comunicação <em>e campanhas.</em></h1></div><AdminMarketing/></section>; }
