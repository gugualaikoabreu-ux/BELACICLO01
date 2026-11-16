import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { storeConfig } from "@/lib/config";
import { CustomerOrdersList } from "@/components/customer-orders-list";
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  if (!process.env.DATABASE_URL) return <section className="page-section"><div className="page-heading"><span className="eyebrow">ÁREA DO CLIENTE</span><h1>Meus <em>pedidos.</em></h1></div><p className="empty-note">A conta ainda não está conectada ao banco de dados.</p></section>;
  const user = await getCurrentUser();
  if (!user?.id) return <section className="page-section"><div className="page-heading"><h1>Entre para ver <em>seus pedidos.</em></h1></div><Link className="button button-dark" href="/minha-conta">Acessar minha conta →</Link></section>;
  const orders = await getDb().order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      total: true,
      items: { select: { id: true } },
    },
  });
  const customerOrders = orders.map((order) => ({
    id: order.id,
    number: order.number,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: order.total,
    itemCount: order.items.length,
  }));
  return <section className="page-section orders-page"><div className="page-heading"><span className="eyebrow">ÁREA DO CLIENTE</span><h1>Meus <em>pedidos.</em></h1><p>Acompanhe seus pedidos e veja as opções disponíveis para cada um.</p></div><Link className="button button-outline orders-continue-shopping" href="/colecoes">Continuar comprando <span aria-hidden="true">→</span></Link><CustomerOrdersList orders={customerOrders} userId={user.id} email={storeConfig.email} /></section>;
}
