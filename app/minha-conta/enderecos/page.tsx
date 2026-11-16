import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { CustomerAddresses } from "@/components/customer-addresses";
export const dynamic = "force-dynamic";
export default async function AddressesPage() {
  if (!process.env.DATABASE_URL) return <section className="page-section"><div className="page-heading"><h1>Meus <em>endereços.</em></h1></div><p className="empty-note">O banco de dados ainda não está configurado.</p></section>;
  const user = await getCurrentUser();
  if (!user?.id) return <section className="page-section"><div className="page-heading"><h1>Acesse <em>sua conta.</em></h1></div><Link href="/minha-conta">Entrar →</Link></section>;
  return <section className="page-section account-page"><div className="breadcrumbs"><Link href="/minha-conta">Minha conta</Link><span>/</span><span>Endereços</span></div><div className="page-heading"><span className="eyebrow">MEUS DADOS</span><h1>Meus <em>endereços.</em></h1></div><CustomerAddresses/></section>;
}
