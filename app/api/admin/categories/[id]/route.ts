import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { categorySlug } from "@/lib/category-slug";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  department: z.enum(["FEMININA", "INFANTIL"]).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  if (!await enforceRateLimit("admin-categories", requestIp(request), 30, 60)) return Response.json({ message: "Limite temporário excedido." }, { status: 429 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Dados de categoria inválidos." }, { status: 400 });
  const { id } = await params;
  try {
    const result = await getDb().$transaction(async (tx) => {
      const current = await tx.category.findUnique({ where: { id } });
      if (!current) return { kind: "missing" as const };
      const name = parsed.data.name ?? current.name;
      const department = parsed.data.department ?? current.department;
      const changedIdentity = name !== current.name || department !== current.department;
      const category = await tx.category.update({
        where: { id },
        data: {
          name,
          department,
          slug: changedIdentity ? categorySlug(name, department) : current.slug,
          ...(parsed.data.description === undefined ? {} : { description: parsed.data.description || null }),
          ...(parsed.data.active === undefined ? {} : { active: parsed.data.active }),
        },
      });
      if (changedIdentity) await tx.product.updateMany({ where: { categoryId: id }, data: { category: name, department } });
      if (parsed.data.active === false) await tx.product.updateMany({ where: { categoryId: id, active: true }, data: { active: false } });
      return { kind: "updated" as const, category };
    });
    if (result.kind === "missing") return Response.json({ message: "Categoria não encontrada." }, { status: 404 });
    return Response.json({ category: result.category });
  } catch { return Response.json({ message: "Não foi possível atualizar a categoria. Verifique se já existe outra com esse nome." }, { status: 409 }); }
}
