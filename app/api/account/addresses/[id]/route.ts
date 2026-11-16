import { getCurrentUser } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { isSameOriginMutationRequest } from "@/lib/security/same-origin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutationRequest(_request)) return Response.json({ message: "Origem da requisição inválida." }, { status: 403 });
  if (!process.env.DATABASE_URL) return Response.json({ message: "Conta indisponível." }, { status: 503 });
  const user = await getCurrentUser(); if (!user?.id) return Response.json({ message: "Entre na sua conta." }, { status: 401 });
  const { id } = await params; const result = await getDb().address.deleteMany({ where: { id, userId: user.id } });
  return result.count ? new Response(null, { status: 204 }) : Response.json({ message: "Endereço não encontrado." }, { status: 404 });
}
