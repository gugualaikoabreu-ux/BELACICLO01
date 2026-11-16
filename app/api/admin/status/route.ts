import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const allowed = await isAdmin();
  return Response.json({ isAdmin: allowed }, { headers: { "Cache-Control": "no-store" } });
}
