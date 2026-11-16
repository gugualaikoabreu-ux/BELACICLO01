import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { isSameOriginMutationRequest } from "@/lib/security/same-origin";

const schema = z.object({ email: z.string().trim().email().max(254), consent: z.literal(true) });
export async function POST(request: Request) {
  if (!isSameOriginMutationRequest(request)) return Response.json({ message: "Origem da requisição inválida." }, { status: 403 });
  if (!process.env.DATABASE_URL) return Response.json({ message: "A inscrição ainda não está ativa. O armazenamento seguro não foi configurado." }, { status: 503 });
  try {
    if (!await enforceRateLimit("newsletter", requestIp(request), 5, 60)) return Response.json({ message: "Muitas tentativas. Aguarde um minuto e tente novamente." }, { status: 429 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Informe um e-mail válido e autorize o recebimento de comunicações." }, { status: 400 });
    const email = parsed.data.email.toLowerCase();
    const confirmationToken = randomBytes(32).toString("hex");
    const unsubscribeToken = randomBytes(32).toString("hex");
    const subscription = await getDb().newsletterSubscription.upsert({
      where: { email },
      create: { email, status: "PENDING", consentAt: new Date(), confirmationToken, unsubscribeToken },
      update: { status: "PENDING", consentAt: new Date(), confirmationToken, unsubscribeToken }
    });
    const confirmUrl = `${process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin}/api/newsletter/confirm?token=${subscription.confirmationToken}`;
    try {
      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin}/api/newsletter/unsubscribe?token=${subscription.unsubscribeToken}`;
      await sendTransactionalEmail({ to: email, subject: "Confirme sua inscrição no Clube BelaCiclo", html: `<p>Você pediu para receber novidades da BelaCiclo.</p><p><a href="${confirmUrl}">Confirmar inscrição</a></p><p>Se não fez este pedido, ignore esta mensagem.</p><p><a href="${unsubscribeUrl}">Cancelar inscrição</a></p>` });
    } catch {
      return Response.json({ message: "Seu pedido de inscrição foi recebido, mas a confirmação por e-mail ainda não está configurada." }, { status: 503 });
    }
    return Response.json({ message: "Enviamos um e-mail para confirmar sua inscrição no Clube BelaCiclo." }, { status: 200 });
  } catch {
    return Response.json({ message: "Não foi possível concluir a inscrição agora." }, { status: 503 });
  }
}
