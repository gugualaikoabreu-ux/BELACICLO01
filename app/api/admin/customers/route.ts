import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
export async function GET(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const customers = await getDb().user.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, name: true, email: true, createdAt: true, _count: { select: { orders: true } } } });
  return Response.json({ customers });
}
