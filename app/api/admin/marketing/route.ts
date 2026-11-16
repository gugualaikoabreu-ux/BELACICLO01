import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
const campaignSchema = z.object({ message: z.string().trim().min(1).max(180), active: z.boolean(), startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional() });
export async function GET(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const [campaigns, subscriptions] = await Promise.all([getDb().campaign.findMany({ orderBy: { updatedAt: "desc" } }), getDb().newsletterSubscription.count({ where: { status: "SUBSCRIBED" } })]);
  return Response.json({ campaigns, activeSubscribers: subscriptions });
}
export async function POST(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const parsed = campaignSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ message: "Configuração de campanha inválida." }, { status: 400 });
  const campaign = await getDb().campaign.create({ data: { message: parsed.data.message, active: parsed.data.active, startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null, endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null } });
  return Response.json({ campaign }, { status: 201 });
}
