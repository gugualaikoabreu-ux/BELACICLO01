import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { expirePendingReservations } from "@/lib/stock-reservations";
import { recordManualPaymentReviewStatus } from "@/lib/order-payment";

const bodySchema = z.object({
  status: z.enum(["PROOF_RECEIVED", "UNIDENTIFIED"]),
  note: z.string().trim().max(500).default(""),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const admin = await getCurrentUser();
  if (!admin?.id || !admin.email) return Response.json({ message: "Sessão administrativa inválida." }, { status: 401 });
  if (!await enforceRateLimit("admin-payment-review", requestIp(request), 20, 60)) return Response.json({ message: "Limite temporário excedido." }, { status: 429 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ message: "Atualização de pagamento inválida." }, { status: 400 });
  if (parsed.data.status === "UNIDENTIFIED" && parsed.data.note.length < 3) return Response.json({ message: "Informe o motivo pelo qual o pagamento não foi identificado." }, { status: 400 });
  const { id } = await params;

  try {
    await expirePendingReservations();
    const result = await getDb().$transaction((tx) => recordManualPaymentReviewStatus(tx, {
      orderId: id,
      status: parsed.data.status,
      adminUserId: admin.id,
      adminEmail: admin.email!,
      note: parsed.data.note,
    }));
    return Response.json({ order: result.order, alreadyUpdated: result.alreadyUpdated, message: result.alreadyUpdated ? "Este status já estava registrado." : "Conferência do comprovante atualizada." });
  } catch (error) {
    const safeMessages = new Set(["Pedido não encontrado.", "Este pedido não usa PIX manual.", "Este pedido não pode receber atualização de conferência.", "Este pagamento não pode receber atualização de conferência.", "O prazo da reserva expirou; não atualize este pagamento.", "Informe o motivo pelo qual o pagamento não foi identificado."]);
    const message = error instanceof Error && safeMessages.has(error.message) ? error.message : "Não foi possível atualizar a conferência do pagamento.";
    return Response.json({ message }, { status: 409 });
  }
}
