import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { deleteManagedProductImage } from "@/lib/media/storage";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  if (!await enforceRateLimit("admin-product-images", requestIp(request), 60, 60)) return Response.json({ message: "Limite temporário excedido." }, { status: 429 });
  const { id, imageId } = await params;
  try {
    const db = getDb();
    const image = await db.productImage.findFirst({ where: { id: imageId, productId: id }, select: { id: true, url: true } });
    if (!image) return Response.json({ message: "Imagem não encontrada." }, { status: 404 });
    await deleteManagedProductImage(image.url);
    const result = await db.productImage.deleteMany({ where: { id: imageId, productId: id } });
    if (result.count !== 1) return Response.json({ message: "Imagem não encontrada." }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch { return Response.json({ message: "Não foi possível remover a imagem." }, { status: 400 }); }
}
