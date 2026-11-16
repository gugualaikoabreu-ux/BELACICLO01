import { createHash, timingSafeEqual } from "node:crypto";
import { expirePendingReservations } from "@/lib/stock-reservations";

function validSecret(request: Request) {
  const secret = process.env.RESERVATION_CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied) return false;
  const expectedDigest = createHash("sha256").update(secret).digest();
  const receivedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}

export async function POST(request: Request) {
  if (!validSecret(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  try { const expiredOrders = await expirePendingReservations(); return Response.json({ expiredOrders }); }
  catch { return Response.json({ message: "Não foi possível liberar as reservas expiradas." }, { status: 503 }); }
}
