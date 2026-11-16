import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { expirePendingReservations } from "@/lib/stock-reservations";
import { confirmOrderPaymentManually } from "@/lib/order-payment";

const bodySchema = z.object({ note: z.string().trim().max(500).default("") });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return Response.json({ message: "Banco de dados não configurado." }, { status: 503 });
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const admin = await getCurrentUser();
  if (!admin?.id) return Response.json({ message: "Sessão administrativa inválida." }, { status: 401 });
  if (!await enforceRateLimit("admin-payment-confirmation", requestIp(request), 12, 60)) return Response.json({ message: "Limite temporário excedido." }, { status: 429 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ message: "Observação inválida." }, { status: 400 });
  const { id } = await params;

  try {
    await expirePendingReservations();
    const result = await getDb().$transaction((tx) => confirmOrderPaymentManually(tx, id, admin.id, parsed.data.note, undefined, admin.email ?? ""));
    return Response.json({ order: result.order, alreadyApproved: result.alreadyApproved, message: result.alreadyApproved ? "Este pagamento já estava confirmado." : "Pagamento confirmado após a conferência bancária." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível confirmar o pagamento.";
    return Response.json({ message }, { status: 409 });
  }
}
