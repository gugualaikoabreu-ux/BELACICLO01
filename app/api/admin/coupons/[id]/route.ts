import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
const schema = z.object({ active: z.boolean() });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ message: "Status inválido." }, { status: 400 });
  const { id } = await params; try { return Response.json({ coupon: await getDb().coupon.update({ where: { id }, data: parsed.data }) }); } catch { return Response.json({ message: "Cupom não encontrado." }, { status: 404 }); }
}
