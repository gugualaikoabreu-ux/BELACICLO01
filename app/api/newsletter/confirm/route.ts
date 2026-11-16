import { getDb } from "@/lib/db";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length !== 64 || !process.env.DATABASE_URL) return Response.json({ message: "Link inválido ou expirado." }, { status: 400 });
  const result = await getDb().newsletterSubscription.updateMany({ where: { confirmationToken: token, status: "PENDING" }, data: { status: "SUBSCRIBED", confirmationToken: null } });
  if (!result.count) return new Response("Este link já foi utilizado ou expirou.", { status: 410, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response("Inscrição confirmada. Obrigada por fazer parte do Clube BelaCiclo!", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
}
