import { storeConfig } from "./config.ts";

type Mail = { to: string; subject: string; html: string; idempotencyKey?: string };

export async function sendTransactionalEmail({ to, subject, html, idempotencyKey }: Mail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Envio de e-mail ainda não configurado.");
  if (idempotencyKey !== undefined && (!idempotencyKey.trim() || idempotencyKey.length > 256)) throw new Error("Chave idempotente de e-mail inválida.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ from, to, subject, html: emailLayout(html) }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Falha no serviço de e-mail.");
}

function emailLayout(content: string) {
  const contactEmail = storeConfig.email.replace(/[&<>"']/g, "");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:32px 12px;background:#f4f0e9;color:#171717;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#faf8f4;border-collapse:collapse"><tr><td style="padding:26px 30px;background:#101827;color:#faf8f4;font-size:24px;font-family:Georgia,serif">Bela<span style="color:#d6ad62">Ciclo</span><div style="margin-top:4px;color:#d6ad62;font:9px Arial,sans-serif;letter-spacing:3px">MODA FEMININA · INFANTIL</div></td></tr><tr><td style="padding:30px;line-height:1.7;font-size:14px">${content}</td></tr><tr><td style="padding:16px 30px;border-top:1px solid #e9dfd2;color:#817d76;font-size:10px">Mensagem transacional da Bela Ciclo. Dúvidas? Escreva para <a href="mailto:${contactEmail}">${contactEmail}</a>.</td></tr></table></body></html>`;
}
