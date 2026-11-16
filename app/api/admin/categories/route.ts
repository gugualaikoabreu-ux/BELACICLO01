import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { categorySlug } from "@/lib/category-slug";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  department: z.enum(["FEMININA", "INFANTIL"]),
  description: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  try {
    const categories = await getDb().category.findMany({ orderBy: [{ department: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
    return Response.json({ categories });
  } catch { return Response.json({ message: "Não foi possível consultar as categorias." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  if (!await enforceRateLimit("admin-categories", requestIp(request), 30, 60)) return Response.json({ message: "Limite temporário excedido." }, { status: 429 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Informe nome, departamento e descrição válidos." }, { status: 400 });
  try {
    const { name, department, description } = parsed.data;
    const category = await getDb().category.upsert({
      where: { slug: categorySlug(name, department) },
      create: { slug: categorySlug(name, department), name, department, description: description || null, active: true },
      update: { name, department, description: description || null, active: true },
    });
    return Response.json({ category }, { status: 201 });
  } catch { return Response.json({ message: "Não foi possível salvar a categoria." }, { status: 409 }); }
}
