import { z } from "zod";
import { getCurrentUser } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { isSameOriginMutationRequest } from "@/lib/security/same-origin";

const addressSchema = z.object({ recipient: z.string().trim().min(2).max(120), postalCode: z.string().regex(/^\d{5}-?\d{3}$/), street: z.string().trim().min(2).max(180), number: z.string().trim().min(1).max(30), complement: z.string().trim().max(100).optional(), neighborhood: z.string().trim().min(2).max(100), city: z.string().trim().min(2).max(100), state: z.string().trim().length(2).transform((value) => value.toUpperCase()) });

export async function GET() {
  if (!process.env.DATABASE_URL) return Response.json({ message: "Conta indisponível." }, { status: 503 });
  try { const user = await getCurrentUser(); if (!user?.id) return Response.json({ message: "Entre na sua conta." }, { status: 401 }); const addresses = await getDb().address.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }); return Response.json({ addresses }); }
  catch { return Response.json({ message: "Não foi possível consultar endereços." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!isSameOriginMutationRequest(request)) return Response.json({ message: "Origem da requisição inválida." }, { status: 403 });
  if (!process.env.DATABASE_URL) return Response.json({ message: "Conta indisponível." }, { status: 503 });
  try { const user = await getCurrentUser(); if (!user?.id) return Response.json({ message: "Entre na sua conta." }, { status: 401 }); const parsed = addressSchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ message: "Confira os dados do endereço." }, { status: 400 }); const address = await getDb().address.create({ data: { ...parsed.data, userId: user.id, postalCode: parsed.data.postalCode.replace(/\D/g, "") } }); return Response.json({ address }, { status: 201 }); }
  catch { return Response.json({ message: "Não foi possível salvar o endereço." }, { status: 503 }); }
}
