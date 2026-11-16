import { z } from "zod";
import { getCurrentUser } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { isSameOriginMutationRequest } from "@/lib/security/same-origin";

const bodySchema = z.object({ productId: z.string().min(1).max(180) });
async function customerId() { return (await getCurrentUser())?.id; }

export async function GET() {
  if (!process.env.DATABASE_URL) return Response.json({ message: "Conta não configurada." }, { status: 503 });
  try { const id = await customerId(); if (!id) return Response.json({ message: "Entre para sincronizar seus favoritos." }, { status: 401 }); const favorites = await getDb().favorite.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, select: { productId: true } }); return Response.json({ favorites: favorites.map((item) => item.productId) }); }
  catch { return Response.json({ message: "Não foi possível consultar favoritos." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!isSameOriginMutationRequest(request)) return Response.json({ message: "Origem da requisição inválida." }, { status: 403 });
  if (!process.env.DATABASE_URL) return Response.json({ message: "Conta não configurada." }, { status: 503 });
  try { const id = await customerId(); if (!id) return Response.json({ message: "Entre para sincronizar seus favoritos." }, { status: 401 }); const parsed = bodySchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ message: "Produto inválido." }, { status: 400 }); const product = await getDb().product.findFirst({ where: { id: parsed.data.productId, active: true, demo: false }, select: { id: true } }); if (!product) return Response.json({ message: "Produto indisponível." }, { status: 404 }); await getDb().favorite.upsert({ where: { userId_productId: { userId: id, productId: product.id } }, create: { userId: id, productId: product.id }, update: {} }); return Response.json({ saved: true }); }
  catch { return Response.json({ message: "Não foi possível salvar o favorito." }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutationRequest(request)) return Response.json({ message: "Origem da requisição inválida." }, { status: 403 });
  if (!process.env.DATABASE_URL) return Response.json({ message: "Conta não configurada." }, { status: 503 });
  try { const id = await customerId(); if (!id) return Response.json({ message: "Entre para sincronizar seus favoritos." }, { status: 401 }); const parsed = bodySchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ message: "Produto inválido." }, { status: 400 }); await getDb().favorite.deleteMany({ where: { userId: id, productId: parsed.data.productId } }); return Response.json({ saved: false }); }
  catch { return Response.json({ message: "Não foi possível remover o favorito." }, { status: 503 }); }
}
