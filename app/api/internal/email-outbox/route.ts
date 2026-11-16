import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";
import { renderOrderEmail } from "@/lib/order-notifications";

function authorized(request: Request) {
  const secret = process.env.EMAIL_CRON_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret) return false;
  const a = Buffer.from(secret); const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  if (!process.env.DATABASE_URL || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return Response.json({ message: "Banco de dados ou serviço de e-mail não configurado." }, { status: 503 });
  const db = getDb(); const now = new Date();
  await db.emailOutbox.updateMany({ where: { status: "PROCESSING", updatedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) } }, data: { status: "PENDING" } });
  const entries = await db.emailOutbox.findMany({ where: { status: "PENDING", attempts: { lt: 5 }, nextAttemptAt: { lte: now } }, orderBy: { createdAt: "asc" }, take: 20 });
  let sent = 0; let failed = 0;
  for (const entry of entries) {
    const claimed = await db.emailOutbox.updateMany({ where: { id: entry.id, status: "PENDING" }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    try {
      const message = renderOrderEmail(entry.template, entry.payload);
      await sendTransactionalEmail({ to: entry.recipient, ...message, idempotencyKey: entry.dedupeKey });
      await db.emailOutbox.update({ where: { id: entry.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      sent++;
    } catch {
      const attempts = entry.attempts + 1;
      await db.emailOutbox.update({ where: { id: entry.id }, data: { status: attempts >= 5 ? "FAILED" : "PENDING", nextAttemptAt: new Date(Date.now() + Math.min(3600, 60 * 2 ** attempts) * 1000), lastError: "Falha de envio; detalhe omitido para não registrar dados sensíveis." } });
      failed++;
    }
  }
  return Response.json({ processed: entries.length, sent, failed });
}
