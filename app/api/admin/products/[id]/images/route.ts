import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { productImageUrlSchema } from "@/lib/product-image-url";

const schema = z.object({ url: productImageUrlSchema, alt: z.string().trim().min(3).max(250) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  if (!await enforceRateLimit("admin-product-images", requestIp(request), 60, 60)) return Response.json({ message: "Limite temporário excedido." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Informe uma URL HTTPS ou uma foto enviada à loja, com texto alternativo válido." }, { status: 400 });
  const { id } = await params;
  try {
    const db = getDb();
    const product = await db.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) return Response.json({ message: "Produto não encontrado." }, { status: 404 });
    const last = await db.productImage.findFirst({ where: { productId: id }, orderBy: { position: "desc" }, select: { position: true } });
    const image = await db.productImage.create({ data: { productId: id, ...parsed.data, position: (last?.position ?? -1) + 1 } });
    return Response.json({ image }, { status: 201 });
  } catch { return Response.json({ message: "Não foi possível adicionar a imagem." }, { status: 400 }); }
}
