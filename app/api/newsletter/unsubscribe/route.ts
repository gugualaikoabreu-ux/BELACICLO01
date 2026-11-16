import { getDb } from "@/lib/db";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length !== 64 || !process.env.DATABASE_URL) return Response.json({ message: "Link inválido." }, { status: 400 });
  const result = await getDb().newsletterSubscription.updateMany({ where: { unsubscribeToken: token }, data: { status: "UNSUBSCRIBED", confirmationToken: null } });
  if (!result.count) return new Response("Este link não está mais ativo.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response("Inscrição cancelada. Você não receberá novas comunicações do Clube BelaCiclo.", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
}
