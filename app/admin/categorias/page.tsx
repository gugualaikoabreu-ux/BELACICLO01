import Link from "next/link";
import { isAdmin } from "@/lib/admin";
import { AdminCategories } from "@/components/admin-categories";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  if (!await isAdmin()) return <section className="page-section"><div className="page-heading"><h1>Acesso <em>restrito.</em></h1></div><Link href="/admin">Voltar ao painel →</Link></section>;
  return <section className="page-section admin-page"><div className="breadcrumbs"><Link href="/admin">Painel</Link><span>/</span><span>Categorias</span></div><div className="page-heading"><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Categorias da <em>loja.</em></h1><p>Ao desativar uma categoria, os produtos ativos vinculados também deixam de aparecer na loja.</p></div><AdminCategories/></section>;
}
