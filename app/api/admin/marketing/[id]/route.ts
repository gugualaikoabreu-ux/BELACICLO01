import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
const schema = z.object({ message: z.string().trim().min(1).max(180).optional(), active: z.boolean().optional(), startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional() }).refine((value) => Object.keys(value).length > 0);
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const { id } = await params; const parsed = schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ message: "Configuração inválida." }, { status: 400 });
  const { startsAt, endsAt, ...fields } = parsed.data;
  try { const campaign = await getDb().campaign.update({ where: { id }, data: { ...fields, ...(startsAt === undefined ? {} : { startsAt: startsAt ? new Date(startsAt) : null }), ...(endsAt === undefined ? {} : { endsAt: endsAt ? new Date(endsAt) : null }) } }); return Response.json({ campaign }); }
  catch { return Response.json({ message: "Campanha não encontrada." }, { status: 404 }); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const { id } = await params; try { await getDb().campaign.delete({ where: { id } }); return new Response(null, { status: 204 }); } catch { return Response.json({ message: "Campanha não encontrada." }, { status: 404 }); }
}
